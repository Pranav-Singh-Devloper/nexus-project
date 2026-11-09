const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Keeps Nexus inside the free tiers of the APIs behind it.
//   Groq (gpt-oss-120b):  ~200k tokens/day  → a research run is ~15–25k tokens
//   Tavily:               1,000 credits/month → a research run uses ~4
//   WaveSpeed:            images, kept modest
// Every limit can be changed with an env var, e.g. LIMIT_RESEARCH_GLOBAL_DAY=12.
const DEFAULTS = {
  research: { user_day: 3, global_day: 8, global_month: 200 },
  post: { user_day: 10, global_day: 40 },
  image: { user_day: 10, global_day: 30 },
};

const LABELS = { research: 'research runs', post: 'post generations', image: 'image generations' };

const limitFor = (action, window) => {
  const env = process.env[`LIMIT_${action.toUpperCase()}_${window.toUpperCase()}`];
  const n = env !== undefined ? Number(env) : DEFAULTS[action]?.[window];
  return Number.isFinite(n) ? n : null;
};

const periods = (now = new Date()) => ({
  day: now.toISOString().slice(0, 10),   // UTC day, resets at 00:00 UTC
  month: now.toISOString().slice(0, 7),
});

class LimitError extends Error {
  constructor(message, scope) {
    super(message);
    this.status = 429;
    this.code = scope === 'user' ? 'USER_DAILY_LIMIT' : 'FREE_TIER_LIMIT';
  }
}

async function bump(scope, action, period, delta) {
  const rows = await prisma.$queryRaw`
    INSERT INTO "UsageCounter" ("scope", "action", "period", "count", "updatedAt")
    VALUES (${scope}, ${action}, ${period}, ${delta}, NOW())
    ON CONFLICT ("scope", "action", "period")
    DO UPDATE SET "count" = "UsageCounter"."count" + ${delta}, "updatedAt" = NOW()
    RETURNING "count"
  `;
  return rows[0].count;
}

/**
 * Counts one use of `action` for this user. Throws LimitError (HTTP 429) if any
 * per-user or site-wide limit would be exceeded; nothing is counted in that case.
 * Returns a release() function to give the use back if the work fails on our side.
 */
async function consume(userId, action) {
  const { day, month } = periods();
  const checks = [
    { scope: userId, period: day, limit: limitFor(action, 'user_day'), who: 'user' },
    { scope: 'global', period: day, limit: limitFor(action, 'global_day'), who: 'global' },
    { scope: 'global', period: month, limit: limitFor(action, 'global_month'), who: 'global' },
  ].filter(c => c.limit !== null);

  const counted = [];
  try {
    for (const c of checks) {
      const count = await bump(c.scope, action, c.period, 1);
      counted.push(c);
      if (count > c.limit) {
        const label = LABELS[action] || action;
        throw new LimitError(
          c.who === 'user'
            ? `You've used today's ${c.limit} free ${label}. They reset at 00:00 UTC.`
            : `Nexus has reached its free ${label} limit for ${c.period.length === 7 ? 'this month' : 'today'}. Please try again ${c.period.length === 7 ? 'next month' : 'tomorrow'}.`,
          c.who,
        );
      }
    }
  } catch (err) {
    await Promise.all(counted.map(c => bump(c.scope, action, c.period, -1).catch(() => {})));
    throw err;
  }

  let released = false;
  return async function release() {
    if (released) return;
    released = true;
    await Promise.all(counted.map(c => bump(c.scope, action, c.period, -1).catch(() => {})));
  };
}

// Express helper: answers 429 with a clear message when a limit is hit.
function sendLimitError(res, err) {
  return res.status(err.status || 429).json({ error: err.message, code: err.code });
}

async function usageSummary(userId) {
  const { day } = periods();
  const rows = await prisma.usageCounter.findMany({ where: { scope: userId, period: day } });
  const used = Object.fromEntries(rows.map(r => [r.action, r.count]));
  return Object.fromEntries(Object.keys(DEFAULTS).map(a => [a, { used: used[a] || 0, limit: limitFor(a, 'user_day') }]));
}

module.exports = { consume, LimitError, sendLimitError, usageSummary, limitFor };
