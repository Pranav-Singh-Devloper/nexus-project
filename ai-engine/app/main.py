import os
import json
import operator
import logging
import asyncio
import threading
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
                _embeddings_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")  # 384-dim, matches vector(384)
    return _embeddings_model

# --- State Definition ---
class AgentState(TypedDict):
    # Using add_messages handles ID deduplication automatically
    messages: Annotated[List[BaseMessage], operator.add]
    tool_calls_count: int

# --- Agent Builder ---
def build_research_agent(api_key: str):
    # Base LLM for fallbacks (no tools)
    llm_base = ChatOpenAI(
        model=GROQ_MODEL,
        openai_api_key=api_key,
        openai_api_base="https://api.groq.com/openai/v1",
        temperature=0,
        max_tokens=2048
    )
    
    # Tool-bound LLM
    tavily_tool = get_tavily_tool()
    llm_with_tools = llm_base.bind_tools([tavily_tool])

    async def call_model(state: AgentState):
        try:
            response = await llm_with_tools.ainvoke(state["messages"])
            return {"messages": [response]}
        except Exception as e:
            logger.warning(f"⚠️ LLM hallucinated tool or failed: {e}")
            # Fallback to pure text generation
            fallback_msg = SystemMessage(content="A tool error occurred. Provide a final summary based on existing data.")
            response = await llm_base.ainvoke(state["messages"] + [fallback_msg])
            return {"messages": [response], "tool_calls_count": 2}

    async def call_tool(state: AgentState):
        if state.get("tool_calls_count", 0) >= 2:
            return {"messages": [SystemMessage(content="Search limit reached.")]}

        last_message = state["messages"][-1]
        tool_messages = []

        for tool_call in last_message.tool_calls:
            # Catch models trying to pass 'cursor' or 'id' instead of 'query'
            query = tool_call["args"].get("query")
            if not query:
                continue 

            try:
                # Small delay to respect Groq rate limits
                await asyncio.sleep(1)
                result = await tavily_tool.ainvoke({"query": query})
                trimmed_result = str(result)[:2000] # Prevent 413 errors
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

    def should_continue(state: AgentState):
        if state.get("tool_calls_count", 0) >= 2: return END
        last_message = state["messages"][-1]
        return "tools" if last_message.tool_calls else END

    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", call_tool)
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")

    return workflow.compile()

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
    }

@app.post("/start-research")
async def start_research(request: ResearchRequest):
    api_keys = [os.getenv("GROQ_API_KEY"), os.getenv("GROQ_API_KEY_BACKUP")]
    available_keys = [k for k in api_keys if k]
    if not available_keys:
        raise HTTPException(status_code=503, detail="No GROQ_API_KEY configured.")

    system_prompt = """You are an expert market researcher. 
    Use the search tool for current facts. 
    After 2 searches, you MUST stop and provide a Markdown report."""

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
                "report": final_state["messages"][-1].content
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
                max_tokens=1024,
                model_kwargs={"response_format": {"type": "json_object"}}
            )

            messages = [
                SystemMessage(content=LINKEDIN_POST_PROMPT),
                HumanMessage(content=f"Transform the following research into a LinkedIn post + image package:\n\n{request.content[:4000]}")
            ]

            # Retry loop for JSON validation
            max_retries = 1
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