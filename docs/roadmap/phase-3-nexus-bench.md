# Phase 3: Nexus-Bench, a test suite for your research agent

**Goal:** answer "how do you know it works?" with numbers. Score report quality and citation accuracy, then run ablations to show which parts of the agent actually help.

**Time:** ~2 weeks · **Free compute:** Kaggle (full runs), GitHub Actions + Groq free tier (small nightly subset)

## Grounding in current research
2026 deep-research benchmarks (DeepResearch Bench, DeepResearch Bench II) score reports with a **rubric LLM judge** and measure **citation accuracy separately**, because LLM judges have known biases: they prefer longer answers, agree too readily, and favour their own outputs. Nexus-Bench follows the same design at portfolio scale.

## The dataset (`evals/nexus-bench/`)
- [ ] **60–100 market questions** across sectors (fintech, EV, SaaS, health, India-specific…) and types (market size, competitors, trends, regulation, pricing).
- [ ] For each: a **rubric** of 5–8 checkable points written by you, e.g. "names at least 3 major players", "gives a market size with year and source", "mentions the 2025 regulation X".
- [ ] For 20 of them, a short **reference answer** you research by hand. This is your human ground truth.
- [ ] Publish as a Hugging Face dataset (free) with a dataset card. Public, citable work.

## Frozen retrieval (key for ₹0 and rigour)
- [ ] Run each question once with live Tavily search and store every result in the **search cache** (Phase 0).
- [ ] All later runs replay the cache, so comparisons differ **only** in the part you changed, and re-runs cost 0 Tavily credits.
- [ ] Ship the snapshot with the dataset (URLs + extracted text) so others can reproduce.

## Metrics
| Metric | How | Notes |
| :--- | :--- | :--- |
| **Rubric score** (0–1) | LLM judge checks each rubric item: met / partly / not met | report mean ± 95% bootstrap CI |
| **Citation precision** | for each cited claim, does the cited page support it? (Phase 4 verifier) | claim-level |
| **Citation recall** | share of factual claims that have a citation | |
| **Unsupported-claim rate** | claims with no supporting source | lower is better |
| **Coverage** | distinct sources used, distinct domains | |
| **Cost & latency** | tokens, seconds, equivalent $ (from Langfuse) | per report |

### Making the judge trustworthy
- [ ] Use a **different model family** from the one writing reports, to reduce self-preference. Free options: an open model (e.g. Qwen3-8B / 14B) on Kaggle via vLLM; Gemini's free tier if limits allow.
- [ ] **Calibrate:** score the 20 human-referenced reports yourself, then report judge–human agreement (Cohen's κ or Spearman). If it's low, fix the rubric prompts before trusting anything else.
- [ ] Shuffle rubric order, and use a temperature of 0 with 3 samples (majority vote).

## Ablations: what actually helps?
Run every configuration on the same frozen cache, ideally with 3 seeds:

| Config | Change |
| :--- | :--- |
| baseline | current agent |
| no-search | model answers from memory (shows how much search matters) |
| 1 vs 3 vs 5 results per query | retrieval depth |
| max 2 vs 5 vs 10 agent loops | reasoning budget |
| prompt v1 vs v2 | report-format prompt |
| + fact-check rewrite (Phase 4) | does verification improve citation precision? |
| `gpt-oss-120b` vs `gpt-oss-20b` vs your distilled model (Phase 6) | model size vs quality vs cost |

Present it as a table plus one chart: **quality vs cost per report**, a Pareto frontier.

## Wiring it up
- [ ] `evals/run_bench.py --config configs/baseline.yaml --subset all|nightly`: runs the agent on the cached corpus and writes `evals/results/<date>-<config>.json`.
- [ ] Each run is a **Langfuse dataset run**, so configs can be compared side by side in the Langfuse UI. Scores are attached to traces.
- [ ] `evals/report.py`: builds the README table (Markdown) and the chart (PNG/SVG) from `evals/results/`. Numbers are never typed by hand.
- [ ] **Kaggle notebook** `evals/kaggle/full_bench.ipynb`: full run with the open-model judge on free GPUs.
- [ ] **`nightly-bench.yml`** (GitHub Actions): 10-question subset, cached search, Groq free tier (stays well under ~200k tokens/day). Commits the results JSON and fails if quality drops by more than X.

## Budget
- Groq: ~10 nightly questions × ~15k tokens ≈ 150k tokens, under the ~200k/day free limit. Run full sweeps on Kaggle with open models, not Groq.
- Tavily: only the first live pass (≈ 100 questions × ~10 credits) ≈ 1,000 credits, so spread it over 1–2 months, or start with 50 questions.
- Kaggle: a full sweep ≈ a few GPU-hours with vLLM batching, well within ~30 h/week.

## Done when
- [ ] A dataset with rubrics, frozen sources and 20 human references, published on Hugging Face.
- [ ] Judge–human agreement reported.
- [ ] An ablation table with confidence intervals, plus a quality-vs-cost chart in the README (generated).
- [ ] Nightly CI subset green, with history in `evals/results/`.

## Interview talking points
- "Retrieval is frozen, so every comparison isolates one change. My judge agrees with my own ratings at κ = X."
- "Turning off search dropped the rubric score from A to B, and going from 3 to 5 results per query added nothing but cost, so I kept 3." Use your real findings.
