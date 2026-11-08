# Phase 6: Your own post-writing model (LoRA distillation → DPO on real edits)

**Goal:** replace the 120B model for LinkedIn post writing with a small model you fine-tuned. Show it matches or beats the base model on your evals at a fraction of the cost, and serve it for free.

**Time:** 2–3 weeks · **Free compute:** Kaggle (training + eval) · **Free serving:** Cloudflare Workers AI LoRA adapters, with Groq as fallback

## The unique angle: a data flywheel
Every time a user edits a generated draft before publishing, Nexus has a natural **preference pair**: the draft (rejected) vs the version they published (chosen). That's real human preference data from the product, perfect for DPO, a method for learning from preferences. Few student projects have this.

## Step 1: supervised fine-tuning by distillation
- [ ] Build ~2–5k (report → post JSON) examples by running the current `gpt-oss-120b` post generator over many reports. Use the Phase 3 cached corpus plus public market articles.
- [ ] Filter with automatic checks: valid JSON, length limits, a hook line present, hashtag count, no unsupported numbers (Phase 4 verifier on post claims).
- [ ] Fine-tune a small base model with **LoRA** on Kaggle (Unsloth or TRL; QLoRA fits a T4). **Pick a base model Workers AI can serve LoRA adapters for:** check the current list in Cloudflare's docs (it has included Mistral-7B-Instruct, Gemma and Llama variants; adapters must be non-quantized, rank ≤ 8–32, < 300 MB).

## Step 2: DPO on preferences
- [ ] Collect pairs: (a) real user edits (draft → published), (b) synthetic pairs, i.e. good generations vs ones failing the step-1 checks, (c) your own A/B choices from a quick labelling page in the app.
- [ ] Train DPO on top of the LoRA model on Kaggle. Watch for over-optimisation: posts getting longer, more emojis.

## Evaluation (same held-out set for every model)
| Model | Format pass % | Factual consistency (Phase 4) | Pairwise win-rate vs 120B (judge) | Human pref (n=50) | Latency | Cost / post |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| base small model (prompted) | | | | | | |
| `gpt-oss-120b` (prompted) | | | | | | |
| + LoRA SFT | | | | | | |
| **+ DPO** | | | | | | |

- Judge with a model from a different family, swapping the A/B order each time (position bias).
- Report variance across 3 seeds. Vendor case studies often skip baselines; you won't.

## Serving (₹0)
- [ ] Upload the LoRA adapter to Workers AI (`adapter_config.json` + `adapter_model.safetensors`), and call it from the AI engine with the `lora` parameter.
- [ ] Free allowance: 10,000 neurons/day. Measure neurons per post, then set a daily cap (Phase 0 quota guard). Fall back to Groq when the cap is hit.
- [ ] Composer toggle: "Writer: Nexus-Writer (my model) / gpt-oss-120b", with the model name shown on each draft. Send the model choice and user edits to Langfuse, so the flywheel is visible.
- [ ] Publish the adapter + model card + eval table on Hugging Face.

## Done when
- [ ] Your model is live as an option in the composer, with a free-tier cap and fallback.
- [ ] An eval table with seeds shows where it wins, ties and loses.
- [ ] The edit → preference-pair pipeline is running, even if real-user data is small at first.

## Interview talking points
- "My DPO-tuned Nexus-Writer wins X% of head-to-heads against the 120B model it learned from, at Y× lower latency. Here's where it still loses."
- "Users' edits become preference data automatically. That's the flywheel."
