# Phase 2: Live agent view with Langfuse

**Goal:** watch the LangGraph research agent work in real time inside Nexus, and keep a full trace of every run (prompts, tool calls, tokens, latency) in Langfuse.

**Time:** ~1 week · **Free tier:** Langfuse Cloud Hobby (50k units/month, 30-day retention, 2 users)

## Why Langfuse
The agent is a LangGraph graph, and Langfuse traces LangGraph out of the box through its LangChain callback handler. You get nested spans for every node, LLM call and Tavily tool call with no manual instrumentation. The same tool also holds **datasets, experiments and scores**, which Phases 3–6 reuse, so all the evidence lives in one place.

## Two views of the same run

| | In-app live view | Langfuse |
| :--- | :--- | :--- |
| Who | reviewer / user | you, interviewers via a public link |
| What | steps appearing as they happen | full trace: prompts, outputs, tokens, timings, scores |
| How | Server-Sent Events from LangGraph's event stream | `CallbackHandler` on the graph run |

Both come from **one run**: the handler records to Langfuse while the same execution streams events to the browser.

## Implementation

### AI engine (FastAPI)
- [ ] Add `langfuse` to `requirements.txt`; env `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` (cloud region URL).
- [ ] Wrap the research run (Langfuse Python SDK v3 pattern, check the current docs):
  ```python
  from langfuse import get_client
  from langfuse.langchain import CallbackHandler

  langfuse = get_client()
  handler = CallbackHandler()

  with langfuse.start_as_current_span(name="research") as span:
      span.update_trace(user_id=user_id, session_id=project_id,
                        tags=["research", model_name], metadata={"job_id": job_id})
      async for event in agent_app.astream_events(state, config={"callbacks": [handler]}, version="v2"):
          await publish(job_id, to_ui_event(event))   # see "Streaming" below
  trace_id = langfuse.get_current_trace_id()
  ```
- [ ] `to_ui_event` maps raw events to a small schema: `plan`, `search` (query, n results), `source` (url, title), `thinking` (short summary, never full hidden reasoning), `writing`, `done`, `error`. Each event carries `tokens_in/out`, `ms`, and a cost estimate.
- [ ] Register `gpt-oss-120b` with custom pricing in Langfuse (Settings → Models) so traces show an **"equivalent cost"** even though Groq's free tier charges you nothing.
- [ ] Return `trace_id` with the report, and store it on the project.
- [ ] Attach scores later (Phases 3–4): `langfuse.create_score(trace_id=…, name="citation_precision", value=…)`.

### Streaming to the browser
- [ ] The AI engine writes events to Postgres (`job_events(job_id, seq, type, data, ts)`) as they happen. The worker owns the run, so the client can reconnect without losing anything.
- [ ] Server: `GET /api/jobs/:id/events` (Server-Sent Events). Send stored events first, then new ones as they arrive. Close on `done`.
- [ ] Keep it cheap: send events in batches, and stop the stream as soon as the job finishes, so Neon can sleep.

### Client
- [ ] A **live run panel** on the dashboard and project page: a vertical timeline. Each step animates in with an icon (search, read, write), the query text, source favicons, and per-step time and tokens.
- [ ] Header stats ticking up live: elapsed time, sources read, tokens, equivalent cost.
- [ ] **"Open full trace"**: a link to the Langfuse trace. For showcase runs, make the trace public in Langfuse so reviewers can open it without an account.
- [ ] **Replay mode:** plays back a saved `job_events` run at real speed. Demo users (Phase 1) see this, so watching an agent costs ₹0 and always works.

## Budget check
A research run is roughly 1 trace + ~30–80 observations. Hobby's 50k units/month covers several hundred runs. Benchmark runs (Phase 3) use Langfuse Experiments; if units get tight, trace a sample (e.g. every 5th bench item). Data is kept for 30 days, so **export showcase traces** (JSON) into `evals/traces/` and replay from there.

## Done when
- [ ] Starting research shows the first live step within ~2 s.
- [ ] Refreshing mid-run resumes the timeline with nothing lost.
- [ ] Each completed report links to its Langfuse trace, and 2–3 showcase traces are public.
- [ ] The demo account can replay a real run with zero API calls.

## Interview talking points
- "Every agent run is a Langfuse trace: I can open any bad report and see which search or step went wrong. That's how I found and fixed X." Keep a real example ready.
- "The live view and the trace come from one execution: LangGraph's event stream feeds the UI over SSE, and the Langfuse callback records the same spans."
