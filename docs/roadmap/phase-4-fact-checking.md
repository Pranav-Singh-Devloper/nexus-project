# Phase 4: Claim-level fact-checking (your own distilled model)

**Goal:** every sentence in a report is checked against its sources by a model **you trained**, small enough to run free on CPU. Unsupported claims are highlighted in the UI.

**Time:** ~2 weeks · **Free compute:** Kaggle (teacher labels, training), Render free CPU (serving, < 100 MB model)

## Why it impresses
It tackles the biggest problem with research agents, citations that don't support their claims. It's real ML work: teacher → student distillation, calibration, and evaluation on a public benchmark. And it demos beautifully.

## The size problem and the fix
- Strong open verifiers exist: **MiniCheck-Flan-T5-Large** (~0.77B, MIT licence, near GPT-4 level on the LLM-AggreFact benchmark per its paper) and **Bespoke-MiniCheck-7B** (stronger, but non-commercial licence).
- Neither fits a free 512 MB server.
- **So you distil:** use the big verifier as a *teacher* on Kaggle to label claim–evidence pairs, then train a *student* that's ~10–30× smaller (e.g. `deberta-v3-xsmall` / `MiniLM`, 22–70M parameters), and export it to **int8 ONNX (~25–70 MB)** to run on CPU in the AI engine.

## Pipeline

### 1. Claims and evidence
- [ ] Split reports into **atomic claims** (one fact per sentence, with numbers and named entities kept). Use simple rules first; use an LLM only if needed.
- [ ] For each claim, collect evidence from **its cited sources**: split the cached page text (Phase 3) into chunks and pick the top-k chunks by similarity (FastEmbed is already in the stack).

### 2. Teacher labels (Kaggle)
- [ ] Label ~20–50k (claim, evidence) pairs with MiniCheck-Flan-T5-Large: probability that the claim is supported. Sources: Nexus reports, plus public training data (MiniCheck's synthetic data; LLM-AggreFact is for **testing only**).
- [ ] Hand-label 300 pairs from Nexus reports yourself. This is your in-domain test set.

### 3. Student training (Kaggle)
- [ ] Fine-tune the student as a cross-encoder on `[claim] [SEP] [evidence]` with a soft-label (distillation) loss plus hard labels where available.
- [ ] **Calibrate** (temperature scaling) so 0.8 really means ~80% supported; report ECE (expected calibration error).
- [ ] Export to ONNX, quantize to int8, and check accuracy loss from quantization.

### 4. Evaluation
| Model | Size | LLM-AggreFact BAcc | Your 300 in-domain | CPU latency / claim |
| :--- | :-: | :-: | :-: | :-: |
| NLI baseline (off-the-shelf) | | | | |
| MiniCheck-FT5 (teacher) | 770M | | | |
| **Your student (int8 ONNX)** | ~22–70M | | | |
| LLM-as-judge (Groq) | 120B | | | |

The headline: "X% of the teacher's accuracy at Y× smaller, Z ms per claim on a free CPU."

### 5. Product
- [ ] AI engine endpoint `POST /verify` (or a step at the end of the research job): returns per-claim `{supported_prob, evidence_span, source_url}`.
- [ ] Optional **self-correction pass:** claims below a threshold go back to the agent ("rewrite or remove unsupported claims"). Measure the effect in Phase 3.
- [ ] UI: claims tinted green (supported), amber (weak), red (unsupported). Hover shows the evidence sentence and source. A report header shows "Fact-check: 42/47 claims supported".
- [ ] Send scores to Langfuse (`citation_precision`, `unsupported_rate`) on the report's trace.
- [ ] Publish the student model on Hugging Face with a model card (data, training, metrics, limits).

## Budget
- Kaggle: teacher labelling ≈ 1–3 GPU-hours; student training ≈ 1–2 GPU-hours.
- Serving: CPU only, inside the existing AI engine (keep total RAM < ~450 MB; load the model lazily).

## Done when
- [ ] A student model on Hugging Face with an eval table, calibrated, int8 ONNX.
- [ ] Live highlighting in reports; verification adds < 3 s per report.
- [ ] Phase 3 table gains real citation-precision numbers, plus an ablation with and without self-correction.

## Interview talking points
- "I distilled a 770M fact-checker into a 22M model that keeps X% of its accuracy and runs on a free CPU in Y ms per claim, and I calibrated it so the colours mean something."
- "Self-correction raised citation precision from A to B on Nexus-Bench at a cost of C tokens per report."
