# Phase 7: Vision: charts, tables and image quality control

**Goal:** give the agent eyes. Extract numbers from charts and tables in source PDFs and pages and turn them into real charts in reports. Automatically quality-check every generated post image.

**Time:** ~2 weeks · **Free compute:** Kaggle (model comparison + eval), Hugging Face ZeroGPU Space (live demo, ~5 GPU-min/day), Render CPU (light checks)

## 7A. Chart and table extraction

### Model comparison (the ML work)
- [ ] Build **Nexus-Charts**: 100–150 chart and table images from real market reports and PDFs the agent found (bar, line, pie, stacked, tables). Hand-label the underlying data points.
- [ ] Compare 3–4 open models on Kaggle:

| Model | Size | Licence | Numeric error (median %) | Series / label accuracy | Table cell F1 | Time / image (T4) |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Qwen3-VL-2B (or 4B) | | Apache-2.0 | | | | |
| PaddleOCR-VL (0.9B) | | | | | | |
| DeepSeek-OCR 2 (3B) | | MIT | | | | |
| Granite Vision (2B) | | | | | | |

- [ ] Error analysis: where each model fails (log scales, stacked bars, small fonts, legends). Include 3–4 failure screenshots in the write-up.
- [ ] Optional depth: a quick LoRA fine-tune of the best small VLM on synthetic charts (render charts from random data with matplotlib, so labels are free), and measure the gain.

### Product
- [ ] When the agent's sources include PDFs or images, crop candidate figures and send them to the **"Nexus Vision" ZeroGPU Space** (Gradio, free account) via `gradio_client`.
- [ ] Extracted data becomes a **real chart in the report** (render with Vega-Lite or Recharts in the client), labelled with the source and the extraction confidence.
- [ ] Budget guard: ZeroGPU's free quota is small (~5 GPU-minutes/day). Queue vision work as jobs (Phase 1), cache results by image hash, and skip with a note when the quota is used up.

## 7B. Generated-image quality control
- [ ] For each post image, compute: **relevance** (CLIP similarity between the image and the post or image prompt), **garbled-text detection** (OCR the image; diffusion models often produce fake letters), and **artifact checks** (very low variance, mostly one colour).
- [ ] Auto-regenerate once if a check fails, and show a small "QC passed" badge in the composer.
- [ ] Evaluate: hand-label 200 generated images as good or bad; report precision and recall of the QC gate and the regeneration rate.
- [ ] Where it runs: in the same ZeroGPU Space (fast). If the CPU model is small enough (e.g. a quantized CLIP ViT-B/32), in the AI engine; check RAM first.

## Done when
- [ ] Nexus-Charts published on Hugging Face with a model comparison table and failure analysis.
- [ ] At least one report in the demo account shows a chart rebuilt from a source PDF.
- [ ] The image QC gate is live, with a measured precision/recall.

## Interview talking points (CV roles)
- "I built a 150-image chart benchmark from real market PDFs and compared four open VLMs. The small one was within X% of the best and Y× faster, so that's what runs live."
- "My image QC gate catches garbled text with Z% recall, so users stop seeing broken images."
