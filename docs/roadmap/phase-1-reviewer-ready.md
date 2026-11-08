# Phase 1: Reviewer-ready

**Goal:** a reviewer can see the whole product in one click, an engineer can run it with one command, and the README proves it works before anyone reads code.

**Time:** ~2 weeks · **Order:** 1A → 1B → 1C (v1). Return to 1C for v2 after Phases 2–4.

---

## 1A. "Try the demo" (no sign-up)

Reviewers almost never create accounts. This is the cheapest, biggest win.

### How it works
- A **"Try the demo"** button on the sign-in page calls `POST /auth/demo`.
- The server **clones a template demo user** into a fresh sandbox user (`isDemo = true`, `demoExpiresAt = now + 24h`) and issues a normal session cookie. Each visitor gets their own copy, so nobody sees anyone else's edits.
- The template contains: 4–6 **real, high-quality research reports** (generated once, hand-checked), notes, drafts in every state (draft / scheduled / published / failed), and generated images (stored as static files, not WaveSpeed URLs that can expire).
- A banner at the top: "You're in demo mode. Sign up to save your work."

### Guardrails (protect free allowances)
- Demo users can't connect LinkedIn/X or publish. "Post" and "Schedule" open a friendly "sign up to publish" dialog.
- New research in demo: **replay a recorded agent run** (stream saved events from a real run, Phase 2) instead of calling Groq and Tavily. Optionally allow 1 real run per demo session, under a global daily cap.
- Post generation in demo: real call under a small global cap, else a cached result.
- Clean-up: a daily GitHub Actions job (free) calls `POST /internal/cleanup-demo` to delete expired sandbox users. Neon's 1 GB is plenty, but don't let it grow forever.

### Tasks
- [ ] Prisma: `User.isDemo Boolean @default(false)`, `User.demoExpiresAt DateTime?`; migration.
- [ ] `server/scripts/seed-demo.js`: builds the template user from `server/demo/*.json` (reports, notes, drafts). Idempotent.
- [ ] `POST /auth/demo`: clone in one transaction, rate-limit by IP (e.g. 10/hour).
- [ ] Block publish/connect for demo users server-side (not just in the UI).
- [ ] Client: "Try the demo" on Auth page, demo banner, "sign up to publish" dialog.
- [ ] Cleanup endpoint + scheduled GitHub Action.

---

## 1B. Built to last: tests, CI, one-command run, a real job queue

### Job queue (replaces fire-and-forget)
Today, creating a project fires an HTTP call to the AI engine and hopes. A crash, deploy or timeout loses the job and leaves it "Initializing…" forever.

**Design (free and scale-to-zero friendly):** a `jobs` table in Postgres used as a queue. No Redis, and nothing polls constantly.

| Column | Purpose |
| :--- | :--- |
| `id, type` (`research`, `generate_post`, `generate_image`, `publish`) | what to do |
| `payload jsonb, status` (`queued`, `running`, `succeeded`, `failed`, `dead`) | state |
| `attempts, max_attempts, run_after, locked_until, last_error` | retries, back-off, crash recovery |
| `user_id, project_id` | ownership |

- **Enqueue** in the same transaction as the project insert.
- **Worker** runs inside the server process. It claims jobs with `UPDATE … WHERE status='queued' AND run_after <= now() … FOR UPDATE SKIP LOCKED` and is **triggered on enqueue and on wake-up**, not by a timer. That way Neon can scale to zero.
- **Retries** with exponential back-off for timeouts and 429s; after `max_attempts` → `dead`, shown in the UI with a "Retry" button.
- **Crash recovery:** jobs `running` past `locked_until` go back to `queued` the next time the worker wakes.
- **Idempotency:** the AI engine gets `job_id`; results are written only if the job is still current.
- Scheduled posts become `publish` jobs with `run_after = scheduledAt`, woken by the exact-time callback from Phase 0.

### Tests
| Layer | Tooling (free) | What to cover |
| :--- | :--- | :--- |
| Server | Vitest + Supertest, Postgres in Docker | auth + session renewal, drafts CRUD and ownership, job queue (claim, retry, dead-letter, crash recovery), scheduler, quota guard, demo clone + guardrails |
| AI engine | pytest + a fake chat model | `clean_report`, post JSON parsing and retries, key rotation on 429, mock mode, search cache |
| Client | Vitest + React Testing Library | composer autosave, connection banners, Posts filters, theme toggle |
| End to end | Playwright | sign-in → research (mock) → report → generate post → draft → schedule; demo mode flow |

Target: the important paths covered, not 100%. Put a coverage badge in the README.

### CI (GitHub Actions, free on public repos)
- `ci.yml` on every push and PR: lint (ESLint, Ruff), unit tests for all three services, build the client, Playwright e2e against `docker compose` in mock mode.
- `nightly-bench.yml` (Phase 3): a small benchmark subset with cached search, results committed to `evals/results/`.
- Required checks on `main`; README badges for CI status and coverage.

### One-command run
`docker-compose.yml` at the repo root:
- `db`: `pgvector/pgvector:pg16`
- `ai-engine`: FastAPI, `AI_MOCK=1` by default
- `server`: runs `prisma migrate deploy`, seeds the demo user, then starts
- `client`: built and served (or Vite dev with a profile)

`docker compose up` → open http://localhost:5173 → "Try the demo". No API keys needed; add keys to `.env` to switch off mock mode.

### Tasks
- [ ] `jobs` table + worker + API (`GET /api/jobs/:id`), and switch research and image generation to jobs.
- [ ] Mock mode in the AI engine (Phase 0) and a `FakeListChatModel` for tests.
- [ ] Test suites per the table, then `ci.yml`.
- [ ] Dockerfiles for server, AI engine and client; `docker-compose.yml`; README "Run with Docker" section.

---

## 1C. Results at the top of the README

### v1 (now)
- **Hero:** logo, one-line pitch, "Live demo" and "Try the demo" buttons, the demo video.
- **Results table**, with placeholder rows clearly marked "coming in Phase 3": report quality, citation accuracy, unsupported-claim rate, cost and latency per report.
- **"What I tried, what failed and why"**, a short honest write-up. Real examples from this project:
  - `gpt-oss-120b` JSON output was cut off because reasoning tokens count toward `max_tokens` → fixed with `reasoning_effort="low"`, a bigger budget and retries.
  - Citation markers such as `【0†…】` leaked into reports → cleaned on both the engine and client side.
  - LinkedIn only gives refresh tokens to approved partners, so connections expire after 60 days → expiry warnings and one-click reconnect.
  - Free hosting sleeps, so a polling scheduler breaks → exact-time wake-up callbacks (Phase 0).
- Architecture diagram (already there) plus a "How it's tested" section.

### v2 (after Phases 2–4)
- Real numbers from `evals/results/*.json` (generated, never typed by hand).
- Video re-cut to show the live agent view, the benchmark and fact-checking highlights.

### The 2-minute demo video (₹0)
| Tool | Role | Free terms |
| :--- | :--- | :--- |
| **Playwright** | Scripted, repeatable screen recordings of the real app (`video: 'on'`), in light and dark | free, open source |
| **Manim Community** | Explainer animations: the agent loop (reason → search → reason), the job queue, the benchmark pipeline, distillation | MIT |
| **Remotion** | Edits it all in React: intro with the logo, captions, zooms, transitions, outro with links; renders the MP4 | free for individuals |
| **ElevenLabs** | Voiceover | free plan ≈ 10 min audio/month; non-commercial; credit "Voice: ElevenLabs" in the video description and README |
| **Kokoro-82M** (fallback) | Local open-source TTS if credits run out | Apache-2.0 |

**Script outline (≈ 280 words, about 2 min):**
1. 0:00–0:10 Hook: "One question in, a cited market report and a ready LinkedIn post out."
2. 0:10–0:35 Live run: the agent searching and reasoning (Manim overlay of the loop).
3. 0:35–0:55 Report with fact-check highlights (Phase 4), hover to see the source.
4. 0:55–1:15 Generate post → composer → schedule.
5. 1:15–1:40 Under the hood: benchmark table, distilled model, job queue (Manim).
6. 1:40–2:00 "What I learned" plus links.

**Pipeline:** `video/` folder → `manim/` scenes rendered to MP4 → Playwright clips in `video/clips/` → Remotion composition `video/src/Demo.tsx` → `npx remotion render`. Keep the voiceover script in `video/script.md` so re-recording is one command.

**Hosting the video for free:** upload the MP4 by dragging it into a GitHub issue or PR comment to get a `user-attachments` URL (keep it under ~10 MB) and embed that in the README. Also post an unlisted YouTube copy with a thumbnail link.

## Done when
- [ ] "Try the demo" → full product with real data in under 5 s (warm server).
- [ ] Kill the server mid-research → restart → the job finishes or retries on its own.
- [ ] `docker compose up` works on a clean machine with no keys.
- [ ] CI is green and required on `main`; badges in the README.
- [ ] The README opens with the video, the results table (v1) and the write-up.

## Interview talking points
- "Research jobs survive crashes and deploys: a Postgres queue with `SKIP LOCKED`, back-off, dead-lettering and leases. It's woken on demand so the free database can scale to zero."
- "Every external call has a mock, so CI runs the full flow end to end without keys or cost."
