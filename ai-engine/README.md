# Nexus AI engine

A FastAPI service that does the model work for Nexus: the research agent, LinkedIn post writing, image generation, and search embeddings. Only the Nexus server calls it.

**Stack:** Python 3.11+ · FastAPI · LangGraph + LangChain · Groq (`openai/gpt-oss-120b`, OpenAI-compatible API) · Tavily · FastEmbed · WaveSpeed

## Run

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # GROQ_API_KEY, TAVILY_API_KEY, WAVESPEED_API_KEY
uvicorn app.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs. In production the `Procfile` starts `uvicorn app.main:app` on `$PORT`.

## Endpoints

| Method | Path | In → Out |
| :--- | :--- | :--- |
| GET | `/health` | Which API keys are configured |
| POST | `/start-research` | `{ prompt }` → `{ status, report }`: a Markdown report (`## title`, `###` sections, tables, `### Sources`) |
| POST | `/generate-post` | `{ content }` (a report) → `{ post_html, hashtags, image_prompt, image_style }` |
| POST | `/generate-image` | `{ prompt, style }` → `{ image_url }` via WaveSpeed Z-Image Turbo |
| POST | `/create-vector` | `{ text }` → 384-dim embedding (`BAAI/bge-small-en-v1.5`) |

## How the research agent works

A LangGraph state graph loops **reason → search → reason** until the model has enough to answer, using Tavily for live web search (advanced depth, 3 results per query). The final report is cleaned up before it's returned: citation markers are stripped and stray code fences removed.

## Notes

- `gpt-oss-120b` is a reasoning model, and its reasoning tokens count toward `max_tokens`. Post generation uses `reasoning_effort="low"`, `max_tokens=4096` and JSON mode, with up to 2 retries, so the JSON isn't cut off.
- If `GROQ_API_KEY_BACKUP` is set, requests that hit a rate limit are retried with the backup key.
- Embeddings use FastEmbed (ONNX), so there's no PyTorch and memory stays small.
