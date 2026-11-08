# Nexus roadmap: from "nice app" to "hire this person"

Goal: make Nexus a project that wins AI/ML, deep learning and computer vision internship interviews at top AI companies and startups.

**Hard rule: everything is built and run for ₹0.** No paid plans, no credit cards on file, no trials that turn into bills. Every phase lists the free service it uses and how much of the free allowance it needs.

## The idea in one paragraph

Today, every piece of intelligence in Nexus comes from someone else's API (Groq, Tavily, WaveSpeed). Interviewers at AI labs look for three things: **evals, baselines and ablations** (removing one part at a time to see what it contributes). These phases add ML that is *yours*: a benchmark, a fact-checking model you train, a post-writing model you fine-tune, and vision models you evaluate. Each comes with numbers you can defend. Free hosting can't run big models, so the pattern throughout is: **train and evaluate big on Kaggle's free GPUs, distil small, serve on a free CPU.**

## Phases

| # | Phase | Why it matters | Time |
| :-: | :--- | :--- | :-: |
| 0 | [Free-tier foundation](phase-0-free-tier-foundation.md) | Keeps the live app at ₹0 (moves off Railway), protects free allowances | 3–4 days |
| 1 | [Reviewer-ready](phase-1-reviewer-ready.md) | Demo account, tests + CI, one-command `docker compose`, a real job queue, README results + demo video | 2 weeks |
| 2 | [Live agent view with Langfuse](phase-2-langfuse-live-view.md) | Watch the LangGraph agent think in real time; traces, cost and latency | 1 week |
| 3 | [Nexus-Bench](phase-3-nexus-bench.md) | A test suite for your own research agent: rubric judge, citation checks, ablations | 2 weeks |
| 4 | [Claim-level fact-checking](phase-4-fact-checking.md) | Train and distil your own verifier; highlight unsupported claims in the UI | 2 weeks |
| 5 | [Prompt-injection red team](phase-5-prompt-injection.md) | Attack your own agent through web pages; measure and cut the success rate | 1 week |
| 6 | [Your own post-writing model](phase-6-own-model.md) | LoRA distillation, then DPO on real user edits; beat the base model | 2–3 weeks |
| 7 | [Vision: charts, tables, image QC](phase-7-vision.md) | Pull numbers out of charts in sources; auto-check generated images | 2 weeks |
| 8 | [Stretch: knowledge graph + RL search agent](phase-8-stretch.md) | GraphRAG across reports; a mini Search-R1 reproduction | open |

Phase 1 comes first: it gets reviewers to look. Its README table and video get filled in properly once Phases 2–4 exist (v1 now, v2 later).

### Which phases matter most for which role

- **LLM / agents / AI engineer intern:** 1 → 2 → 3 → 4 → 5
- **Deep learning / research engineer intern:** 1 → 3 → 4 → 6 (→ 8 RL)
- **Computer vision intern:** 1 → 3 → 7 (→ 4 for the distillation story)

## The free stack (and its limits)

All numbers were checked in November 2026 from public pricing pages and docs. Free tiers change, so **re-check in each service's dashboard before relying on a number.**

| Need | Free service | Free limit (approx.) | Used for |
| :--- | :--- | :--- | :--- |
| Frontend | Vercel Hobby | generous for a portfolio | React app |
| Backend + AI engine | Render free web services | 512 MB RAM, sleeps after 15 min idle, 750 instance-hours / workspace / month | Node API, FastAPI engine |
| Database | Neon free | 1 GB per project, 100 compute-hours / project / month, scales to zero after 5 min | Postgres + pgvector, job queue |
| LLM | Groq free | `gpt-oss-120b`: ~30 req/min, ~1,000 req/day, ~200k tokens/day | Agent, judge (CI subset) |
| Web search | Tavily free | 1,000 credits / month (advanced search = 2) | Agent search |
| Tracing + evals UI | Langfuse Cloud Hobby | 50k units / month, 30-day retention, 2 users | Phases 2–6 |
| GPUs for training and evals | Kaggle notebooks | ~30 GPU-hours / week (2× T4 or P100), 12 h sessions | Phases 3, 4, 6, 7, 8 |
| Small GPU demos | Hugging Face ZeroGPU Space (free account, up to 2) | ~5 GPU-minutes / day per user | Phase 7 vision demo |
| Serving your fine-tuned model | Cloudflare Workers AI (LoRA adapters) | 10,000 "neurons" / day | Phase 6 |
| Model + dataset hosting | Hugging Face Hub | free public repos | Phases 3–7 |
| CI | GitHub Actions | free minutes for public repos | Phase 1 onward |
| Exact-time callbacks | Upstash QStash or cron-job.org | free tier (check limits) | Waking the backend for scheduled posts |
| Video | Remotion (free for individuals), Manim CE (MIT), ElevenLabs free (~10 min audio / month, non-commercial, credit required), Kokoro TTS as fallback | | Phase 1 demo video |

### Budget rules that keep it at ₹0

1. **Cache every web search.** Store Tavily results by query hash. Evals replay the cache, so re-runs cost 0 credits and are reproducible.
2. **Mock mode everywhere.** `AI_MOCK=1` returns canned reports and posts, used by tests, CI, `docker compose` and local UI work.
3. **Daily caps in code.** A global counter per external API (Groq tokens, Tavily credits, ZeroGPU calls) refuses work before the provider does, with a friendly message.
4. **Let the database sleep.** No process may query Neon every few seconds (see Phase 1, job queue).
5. **Big compute only on Kaggle.** Training, full benchmark runs and model comparisons happen in notebooks, never on the hosted app.
6. **Export results to the repo.** Langfuse keeps data for 30 days, so every number in the README must come from a JSON file committed under `evals/results/`.

## Definition of done for the whole roadmap

- A reviewer clicks one button and sees the full product with real data, and can watch a real agent run.
- The README opens with a results table, a 2-minute video and a "what I tried, what failed" write-up.
- At least one model you trained is live in the product, with an eval showing why it's there.
- `docker compose up` runs the whole thing locally without any API keys.
- Every claim on your resume links to a number in `evals/results/`.
