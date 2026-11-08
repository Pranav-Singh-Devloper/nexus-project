# Phase 8 (stretch): Knowledge graph + RL-trained search agent

Pick one, or neither. These are high-ceiling, higher-risk add-ons once Phases 1–4 are solid.

---

## 8A. Market knowledge graph + GraphRAG

**Goal:** turn every report into a growing graph of companies, products, people, funding rounds and markets. Answer questions that span many reports.

**Free stack:** Groq free tier (extraction, under daily caps) · Neon Postgres (`entities`, `relations` tables) · react-force-graph or Cytoscape.js (free) in the client

- [ ] Entity and relation extraction per report, into typed triples (`Company —competes_with→ Company`, `Company —raised→ FundingRound`), each with the source sentence and URL.
- [ ] **Entity resolution:** merge "Reliance Jio", "Jio Platforms" and "JPL" with embeddings plus rules, and measure precision on 100 hand-checked merges.
- [ ] Graph view page: zoom, filter by type, click a node to see the reports and sources mentioning it.
- [ ] GraphRAG questions ("Which competitors of X raised money in 2026?"): compare against plain vector RAG on 30 multi-hop questions you write. Report accuracy for both, since GraphRAG doesn't always win and showing when it does is the point.

**Talking point:** "On multi-hop questions GraphRAG beat vector RAG by X points. On single-fact questions it was slower and no better, so the router only uses it when the question needs it."

---

## 8B. Mini Search-R1: teach a small model to search with RL

**Goal:** reproduce the core idea of Search-R1 at a free-GPU scale: a small model learns **when and what to search** through reinforcement learning (GRPO), rewarded for correct final answers.

**Free stack:** Kaggle GPUs (2× T4 or P100, 12 h sessions) · TRL `GRPOTrainer` with LoRA · a **local BM25 retriever** over a Wikipedia subset (no paid search API) · NQ / HotpotQA subsets

- [ ] Base: a 0.5–1.5B instruct model (e.g. Qwen 0.5B/1.5B). Rollouts use `<search>query</search>` → retrieved passages → `<answer>`.
- [ ] Reward: exact match / F1 on the answer, plus a small format reward. **Mask retrieved tokens from the loss**, as Search-R1 does, so the model isn't trained on text it didn't write.
- [ ] Baselines: no retrieval; single-shot RAG (retrieve once); your RL model. Report EM/F1 and average searches per question.
- [ ] Be honest about scale: the official reproductions use 8×A100 for hours. A T4 run will be small, so frame it as a **scaled-down reproduction**, with learning curves and what you'd do with more compute.
- [ ] Optional: plug the trained model in as an experimental "Nexus-Searcher" for the demo, served from a ZeroGPU Space.

**Talking point:** "With GRPO on a 1.5B model on free GPUs, EM went from A (single-shot RAG) to B. The model learned to issue a second search when the first results didn't contain the entity. Here are the reward curves and the failure modes."

---

## Picking between them
- Agents / LLM-application roles → **8A** (product-visible, demos well).
- Research engineer / RL / deep learning roles → **8B** (training depth, RL, reproduction rigour).
