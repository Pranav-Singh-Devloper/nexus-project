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

### Make scheduled posts work on a sleeping server ✅
The old `setInterval` scheduler only ran while the process was awake (and kept the free database awake too).
- [x] Due posts are published whenever the server wakes up for **any** request (debounced to once a minute), so no secret or special call is needed.
- [x] Public `GET /api/wake`: safe to expose, it only publishes posts that are already due.
- [x] Pingers: cron-job.org (reliable, free) + GitHub Actions `scheduler.yml` as backup, every 30 min. Posts go out within ~30 min of their time (said in the schedule dialog).
- [x] No interval timer: keeps Neon's 100 compute-hours/month safe.
- [ ] Optional later: exact-time wake-ups (e.g. Upstash QStash) if 30 minutes isn't precise enough.

### Protect free allowances
- [x] `UsageCounter` table: per-user and site-wide daily (and monthly) counts for research, post and image generation, checked atomically before each call; refunded if the call fails on our side; limits overridable with `LIMIT_<ACTION>_<WINDOW>` env vars.
- [x] Defaults: research 3/user/day, 8/day site-wide, 200/month; posts 10/user, 40/day; images 10/user, 30/day. `GET /api/usage` + "runs left today" in the UI. (Demo users: Phase 1.)
- [x] Search cache (`SearchCache` table / JSON-lines file / memory), keyed by normalised query + params, 7-day TTL in production, frozen for evals.
- [x] `AI_MOCK=1` in the AI engine returns canned reports, posts, images and deterministic vectors instantly.

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
