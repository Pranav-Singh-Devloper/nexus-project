import os
import json
import re
import operator
import logging
import asyncio
import threading
import resource
import sys
import httpx
from typing import TypedDict, Annotated, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_tavily import TavilySearch
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, BaseMessage
from langgraph.graph import StateGraph, END
from fastembed import TextEmbedding

# --- Setup ---
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Nexus AI Engine (Master)")

# --- CORS (Essential for your React/Vite frontend) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust to ["http://localhost:5173"] for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq retires models regularly; override with GROQ_MODEL instead of editing code.
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
EMBED_MODEL = "BAAI/bge-small-en-v1.5"

# --- Global Tools & Embeddings (created lazily) ---
# Created on first use so the server always starts, even if an API key is
# missing or the embedding model download is slow. /health shows what's missing.
_tavily_tool = None
_embeddings_model = None
_lock = threading.Lock()

def get_tavily_tool():
    global _tavily_tool
    if _tavily_tool is None:
        with _lock:
            if _tavily_tool is None:
                _tavily_tool = TavilySearch(max_results=3, search_depth="advanced")
    return _tavily_tool

def get_embeddings_model():
    global _embeddings_model
    if _embeddings_model is None:
        with _lock:
            if _embeddings_model is None:
                # 384-dim, matches vector(384). One thread keeps memory low on free
                # 512 MB hosts; the model is pre-downloaded at build time into
                # FASTEMBED_CACHE so cold starts don't re-download it.
                _embeddings_model = TextEmbedding(
                    model_name=EMBED_MODEL,
                    cache_dir=os.getenv("FASTEMBED_CACHE") or None,
                    threads=int(os.getenv("EMBED_THREADS", "1")),
                )
    return _embeddings_model

# --- State Definition ---
class AgentState(TypedDict):
    # Using add_messages handles ID deduplication automatically
    messages: Annotated[List[BaseMessage], operator.add]
    tool_calls_count: int

# --- Agent Builder ---
def build_research_agent(api_key: str):
    def make_llm(temperature: float) -> ChatOpenAI:
        return ChatOpenAI(
            model=GROQ_MODEL,
            openai_api_key=api_key,
            openai_api_base="https://api.groq.com/openai/v1",
            temperature=temperature,
            # Room for the model's reasoning plus a full markdown report.
            max_tokens=4096
        )

    # Base LLM for fallbacks (no tools)
    llm_base = make_llm(0)

    # Tool-bound LLM. Retries use a little randomness: at temperature 0 the model
    # tends to repeat the exact same malformed tool call.
    tavily_tool = get_tavily_tool()
    tool_llms = [make_llm(t).bind_tools([WEB_SEARCH_TOOL]) for t in (0, 0.4, 0.7)]

    async def write_report_without_tools(state: AgentState):
        """Writes the report from a fresh, tool-free prompt.

        gpt-oss keeps trying to search when the conversation contains earlier
        tool calls, and Groq rejects that when no tools are offered. So the final
        write-up only sees the question and the gathered sources as plain text.
        """
        messages = state["messages"]
        rules = "\n".join(
            line for line in messages[0].content.splitlines() if "search" not in line.lower()
        )
        question = next((m.content for m in messages if isinstance(m, HumanMessage)), "")
        sources = "\n\n".join(
            m.content for m in messages
            if isinstance(m, ToolMessage) and m.content and not m.content.startswith("No query given")
        ) or "No web sources were found. Write from general knowledge and say so clearly."
        prompt = [
            SystemMessage(content=rules + "\nYou have no tools. Answer only with the report."),
            HumanMessage(content=(
                f"Research question: {question}\n\n"
                f"Sources gathered from web searches:\n\n{sources}\n\n"
                "Write the full report now."
            )),
        ]
        last_error = None
        for temperature in (0, 0.5):
            try:
                llm = llm_base if temperature == 0 else make_llm(temperature)
                response = await llm.ainvoke(prompt)
                if (response.content or "").strip():
                    return response
            except Exception as e:
                if "429" in str(e):
                    raise
                last_error = e
                logger.warning(f"⚠️ Report write-up attempt failed: {e}")
        raise last_error or RuntimeError("Model returned an empty report")

    async def call_model(state: AgentState):
        last_error = None
        for llm in tool_llms:
            try:
                response = await llm.ainvoke(state["messages"])
                return {"messages": [response]}
            except Exception as e:
                if "429" in str(e):
                    raise  # rate limit: let the caller rotate to the backup key
                last_error = e
                logger.warning(f"⚠️ Tool-call attempt failed, retrying: {e}")

        # Fallback: write the report from what we have, without tools.
        logger.warning(f"⚠️ Falling back to a no-tools report after: {last_error}")
        return {"messages": [await write_report_without_tools(state)], "tool_calls_count": 2}

    async def call_tool(state: AgentState):
        if state.get("tool_calls_count", 0) >= 2:
            return {"messages": [SystemMessage(content="Search limit reached.")]}

        last_message = state["messages"][-1]
        tool_messages = []

        for tool_call in last_message.tool_calls:
            # gpt-oss sometimes tries to "open" a result (passing 'id' or 'cursor')
            # instead of searching. Every tool call still needs a reply.
            query = (tool_call["args"] or {}).get("query")
            if not query:
                trimmed_result = (
                    "No query given. The results above already include page text. "
                    "To look something else up, call web_search with a new, specific 'query'."
                )
            else:
                try:
                    # Small delay to respect Groq rate limits
                    await asyncio.sleep(1)
                    result = await tavily_tool.ainvoke({"query": query})
                    trimmed_result = format_search_results(result)
                except Exception as e:
                    trimmed_result = f"Search Error: {str(e)}"

            tool_messages.append(ToolMessage(
                tool_call_id=tool_call["id"],
                content=trimmed_result,
                name=tool_call["name"]
            ))

        return {
            "messages": tool_messages,
            "tool_calls_count": state.get("tool_calls_count", 0) + 1
        }

    async def finalize(state: AgentState):
        """Writes the report when the search budget is spent or the model gave no text."""
        return {"messages": [await write_report_without_tools(state)]}

    def should_continue(state: AgentState):
        last_message = state["messages"][-1]
        wants_tools = bool(getattr(last_message, "tool_calls", None))
        if wants_tools and state.get("tool_calls_count", 0) < 2:
            return "tools"
        if wants_tools or not (last_message.content or "").strip():
            return "finalize"
        return END

    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", call_tool)
    workflow.add_node("finalize", finalize)
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", "finalize": "finalize", END: END})
    workflow.add_edge("tools", "agent")
    workflow.add_edge("finalize", END)

    return workflow.compile()

# The tool the model sees. 'query' is deliberately optional and extra keys are
# allowed: Groq rejects calls that don't match the schema before our code can
# handle them, and gpt-oss occasionally sends browser-style args ('id', 'cursor').
WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the live web for current facts, figures and sources. "
            "Always pass a specific 'query'. Results include page text, so there is no need to open them."
        ),
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "What to search for."}},
            "required": [],
            "additionalProperties": True,
        },
    },
}


def format_search_results(result, limit: int = 3500) -> str:
    """Turns a Tavily response into compact numbered sources the model can cite."""
    items = result.get("results", []) if isinstance(result, dict) else []
    if not items:
        return str(result)[:limit]
    blocks = []
    for i, r in enumerate(items, 1):
        content = " ".join((r.get("content") or "").split())[:900]
        blocks.append(f"[{i}] {r.get('title', '').strip()}\n{r.get('url', '')}\n{content}")
    return "\n\n".join(blocks)[:limit]


def clean_report(text: str) -> str:
    """Remove gpt-oss citation markers (e.g. 【0†content】) and stray code fences."""
    text = re.sub(r"【[^】]*】", "", text or "")
    text = re.sub(r"^```(?:markdown|md)?\s*\n|\n```\s*$", "", text.strip())
    return re.sub(r"[ \t]+\n", "\n", text).strip()

# --- API Schemas ---
class ResearchRequest(BaseModel):
    prompt: str

class VectorRequest(BaseModel):
    # Updated to match what your frontend/agent likely sends
    text: str 
    metadata: dict = {}

class GeneratePostRequest(BaseModel):
    content: str

class GenerateImageRequest(BaseModel):
    prompt: str
    style: str = "square"

# --- LinkedIn Post Prompt ---
LINKEDIN_POST_PROMPT = """You are a world-class LinkedIn creator and visual strategist.

Given research content, generate two things:
1. A high-performing LinkedIn post in valid HTML.
2. A single detailed image prompt that visually matches the post.

Return STRICT JSON only, using exactly this schema:
{
    "post_html": "...",
    "image_prompt": "...",
    "image_style": "...",
    "image_alt": "...",
    "hashtags": ["...", "...", "..."]
}

Post Rules:
1. Use ONLY valid simple HTML tags: <strong>, <em>, <u>, <s>, <br>, <p>, <ul>, <ol>, <li>, <a>
2. Do NOT use <div>, <span>, markdown, inline styles, or CSS classes.
3. Concise, punchy, high-signal. Start with a strong hook, end with curiosity.
4. Exactly 3 to 5 hashtags in the JSON array.
5. Do not include hashtags inside post_html.

Image Prompt Rules:
1. Match the post's core thematic insight, not just generic visuals.
2. Be specific, vivid, and production-ready for text-to-image.
3. Describe subject, composition, mood, lighting, color palette, camera perspective, and realism.
4. Avoid text overlays, logos, watermarks, or UI screenshots unless strictly required.
5. For style, use one of: "square", "wide".

Do not explain your reasoning. Output ONLY valid JSON."""

# --- Endpoints ---

@app.get("/health")
def health():
    # Reports only whether each setting is present, never its value.
    keys = ["GROQ_API_KEY", "GROQ_API_KEY_BACKUP", "TAVILY_API_KEY", "WAVESPEED_API_KEY"]
    return {
        "status": "ok",
        "model": GROQ_MODEL,
        "configured": {k: bool(os.getenv(k)) for k in keys},
        "embeddings_loaded": _embeddings_model is not None,
        "memory_mb": _memory_mb(),
    }


def _memory_mb():
    """Current resident memory (Linux) or peak (macOS), to watch free-tier RAM limits."""
    try:
        with open("/proc/self/statm") as f:
            return round(int(f.read().split()[1]) * os.sysconf("SC_PAGE_SIZE") / 2**20)
    except OSError:
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return round(peak / (2**20 if sys.platform == "darwin" else 2**10))

@app.post("/start-research")
async def start_research(request: ResearchRequest):
    api_keys = [os.getenv("GROQ_API_KEY"), os.getenv("GROQ_API_KEY_BACKUP")]
    available_keys = [k for k in api_keys if k]
    if not available_keys:
        raise HTTPException(status_code=503, detail="No GROQ_API_KEY configured.")

    system_prompt = """You are an expert market researcher.
Use the search tool for current facts. After 2 searches, you MUST stop and write the report.

Write the report in clean GitHub-flavoured Markdown:
- Start with a single "## " title, then short sections with "### " headings.
- Use bullet or numbered lists for key points and **bold** for key figures.
- Use Markdown tables for structured data. Keep each table cell on one line; do not use HTML such as <br>.
- End with a "### Sources" section listing each source as a Markdown link: [Publisher - Title](URL).
- Do not include citation markers like 【0†source】, and do not wrap the report in code fences."""

    initial_state = {
        "messages": [SystemMessage(content=system_prompt), HumanMessage(content=request.prompt)],
        "tool_calls_count": 0
    }

    for key in available_keys:
        try:
            agent_app = build_research_agent(key)
            final_state = await agent_app.ainvoke(initial_state, config={"recursion_limit": 10})
            return {
                "status": "success",
                "report": clean_report(final_state["messages"][-1].content)
            }
        except HTTPException:
            raise
        except Exception as e:
            if "429" in str(e):
                logger.error("Rate limit hit, rotating key...")
                continue
            logger.error(f"Research error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=503, detail="All API keys exhausted.")

@app.post("/generate-post")
async def generate_post(request: GeneratePostRequest):
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="Content is required.")

    api_keys = [os.getenv("GROQ_API_KEY"), os.getenv("GROQ_API_KEY_BACKUP")]
    available_keys = [k for k in api_keys if k]

    if not available_keys:
        raise HTTPException(status_code=503, detail="No API keys configured.")

    for key in available_keys:
        try:
            llm = ChatOpenAI(
                model=GROQ_MODEL,
                openai_api_key=key,
                openai_api_base="https://api.groq.com/openai/v1",
                temperature=0.7,
                # gpt-oss reasons before answering; those tokens count toward
                # max_tokens, so a small limit cuts the JSON off mid-way.
                max_tokens=4096,
                reasoning_effort="low",
                model_kwargs={"response_format": {"type": "json_object"}}
            )

            messages = [
                SystemMessage(content=LINKEDIN_POST_PROMPT),
                HumanMessage(content=f"Transform the following research into a LinkedIn post + image package:\n\n{clean_report(request.content)[:4000]}")
            ]

            # Retry loop for JSON validation
            max_retries = 2
            for attempt in range(max_retries + 1):
                try:
                    response = await llm.ainvoke(messages)
                    content = response.content.strip()
                    
                    # Remove markdown fences if it wrapped JSON
                    if content.startswith("```"):
                        content = content.split("\n", 1)[-1]
                        if content.endswith("```"):
                            content = content.rsplit("```", 1)[0]
                    
                    parsed = json.loads(content)
                    required_keys = ["post_html", "image_prompt", "image_style", "image_alt", "hashtags"]
                    
                    if not all(k in parsed for k in required_keys):
                        raise ValueError(f"Missing required keys. Found: {list(parsed.keys())}")
                    
                    # Normalize image prompt to ensure high quality
                    base_prompt = parsed["image_prompt"].strip()
                    # Strip vague words
                    base_prompt = base_prompt.replace("cool", "").replace("interesting", "").replace("  ", " ").strip()
                    # Enhance with global guidelines
                    enhanced_prompt = f"{base_prompt}, high quality, clean composition, professional lighting, minimal text, modern style"
                    
                    return {
                        "status": "success",
                        "post_html": parsed["post_html"],
                        "image_prompt": enhanced_prompt,
                        "image_style": parsed["image_style"],
                        "image_alt": parsed["image_alt"],
                        "hashtags": parsed["hashtags"]
                    }
                    
                except json.JSONDecodeError as e:
                    logger.warning(f"JSON parsing failed on attempt {attempt}: {e}")
                    if attempt == max_retries:
                        raise HTTPException(status_code=500, detail="Failed to generate valid JSON structure.")
                    # Provide feedback and retry
                    messages.append(response)
                    messages.append(HumanMessage(content="Your response was not valid JSON. Please return STRICT JSON only matching the exact schema requested without any extra markdown formatting."))
                except Exception as e:
                    if "429" in str(e):
                        raise  # let the outer handler rotate to the backup key
                    logger.warning(f"Validation failed on attempt {attempt}: {e}")
                    if attempt == max_retries:
                        raise HTTPException(status_code=500, detail=str(e))
                        
        except HTTPException:
            raise
        except Exception as e:
            if "429" in str(e):
                logger.warning("Rate limit hit on generate-post, rotating key...")
                continue
            logger.error(f"Generate post error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again shortly.")

@app.post("/generate-image")
async def generate_image(request: GenerateImageRequest):
    img_api_key = os.getenv("WAVESPEED_API_KEY")
    if not img_api_key:
        raise HTTPException(status_code=500, detail="Image generation API key not configured.")
        
    width = 1024
    height = 768 if request.style.lower() == "wide" else 1024
    
    payload = {
        "prompt": request.prompt,
        "size": f"{width}*{height}",
        "enable_sync_mode": True
    }
    
    headers = {
        "Authorization": f"Bearer {img_api_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo",
                json=payload,
                headers=headers,
                timeout=45.0
            )
            res.raise_for_status()
            data = res.json()
            
            # The synchronous API returns the outputs in data.outputs[0]
            if "data" in data and "outputs" in data["data"] and data["data"]["outputs"]:
                image_url = data["data"]["outputs"][0]
                return {"status": "success", "image_url": image_url}
            else:
                logger.error(f"Wavespeed sync mode failed. Response: {data}")
                raise HTTPException(status_code=500, detail=f"Wavespeed structure invalid or timed out: {data}")
    except httpx.HTTPStatusError as e:
        logger.error(f"Wavespeed HTTP Error: {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Image API returned error: {e.response.text}")
    except Exception as e:
        logger.error(f"Wavespeed API Error: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {e}")

@app.post("/create-vector")
def create_vector(request: VectorRequest):
    try:
        # This converts the report text into a list of floats
        vector = next(iter(get_embeddings_model().query_embed(request.text))).tolist()
        logger.info("✅ Vector generated successfully")
        return {"status": "success", "vector_length": len(vector), "vector": vector}
    except Exception as e:
        logger.error(f"Vector error: {e}")
        raise HTTPException(status_code=500, detail=str(e))