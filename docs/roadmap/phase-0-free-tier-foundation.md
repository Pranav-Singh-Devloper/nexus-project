# Phase 0: Free-tier foundation

**Goal:** the live app runs at ₹0 forever, and nothing a reviewer does can burn through a free allowance.

**Time:** 3–4 days · **Prerequisite for:** everything

## Why this comes first

Railway isn't free anymore. New accounts get a one-time $5 trial; after that the free plan gives $1 of credit a month (about 0.5 GB RAM per service), which won't run both the backend and the AI engine. If Nexus goes down while a recruiter is looking, nothing else in this roadmap matters.

> **Check now:** open the Railway dashboard → Usage / Billing. If you're past the trial, the backend and AI engine are at risk.

## Target hosting (all free)

| Part | Host | Notes |
| :--- | :--- | :--- |
| Client | Vercel Hobby | unchanged |
| Server (Node) | Render free web service | 512 MB, sleeps after 15 min idle, ~1 min cold start |
| AI engine (FastAPI) | Render free web service | same limits; keep memory under ~450 MB |
| Database | Neon free | already used; 1 GB, 100 compute-hours/month |

Render's 750 free instance-hours are **shared across a workspace**. Two services awake all the time would need ~1,490 hours, so let them sleep when idle and don't keep both warm with pings.

## Tasks

### Move hosting
- [ ] Create Render services for `server/` (Node) and `ai-engine/` (Python), same env vars as Railway (see `server/.env.example`, `ai-engine/.env.example`).
- [ ] Measure AI engine memory at idle and during a research run (`/health` can report RSS). Target < 450 MB. If it's over, load FastEmbed lazily (it already is) and trim imports.
- [ ] Point `VITE_API_URL` (Vercel) and `AI_SERVICE_URL` (server) at the new URLs. Update OAuth redirect URLs at Google, LinkedIn and X to the new server URL.
- [ ] Add a "waking up the server…" state in the client: if the first request takes > 3 s, show a friendly banner instead of a blank page (cold starts take up to a minute).
- [ ] Delete the Railway services once Render is verified.

### Make scheduled posts work on a sleeping server
The current `setInterval` scheduler only runs while the process is awake, and on Render it won't be.
- [ ] When a post is scheduled, register a one-off HTTP callback for its exact time (Upstash QStash free tier, or similar) to `POST /internal/run-scheduler` with a shared secret header. That wakes the server just in time.
- [ ] Add a cron-job.org (free) or GitHub Actions safety-net ping every 30 min to the same endpoint, to catch anything missed. Don't ping more often: each wake also wakes Neon, and Neon compute-hours are limited.
- [ ] Remove the always-on `setInterval` loop.

### Protect free allowances
- [ ] `usage_counters` table: `(provider, day, units)`. Before each Groq / Tavily / WaveSpeed call, check and increment. Refuse with "Daily free limit reached, try again tomorrow" before the provider does.
- [ ] Per-user limits: e.g. 3 research runs / day, 10 post generations / day (demo users get less, see Phase 1).
- [ ] Search cache: `search_cache(query_hash, depth, results_json, created_at)`. The agent reads from it first. This also powers reproducible evals in Phase 3.
- [ ] `AI_MOCK=1` in the AI engine returns canned reports, posts and images instantly (used by tests, CI, `docker compose`, demo).

### Accounts to create (free, no card)
- [ ] Langfuse Cloud (Hobby): for Phase 2.
- [ ] Kaggle: verify your phone number to unlock GPUs; check your weekly quota in Settings.
- [ ] Hugging Face: for models, datasets and up to 2 ZeroGPU Spaces.
- [ ] Cloudflare: Workers AI free tier, for Phase 6.

## Done when
- [ ] The live app works with Railway deleted, and nothing is billed anywhere.
- [ ] A scheduled post goes out within a minute of its time while the server was asleep.
- [ ] Hitting a daily cap shows a friendly message, never a 500 error.
- [ ] The whole app runs locally with `AI_MOCK=1` and no API keys.

## Interview talking point
"I designed it for scale-to-zero free infrastructure. Nothing polls. Scheduled work wakes the server with an exact-time callback, every external API sits behind a quota guard, and web searches are cached, which also made my evals reproducible."
