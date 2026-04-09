import os
import operator
import logging
import asyncio
from typing import TypedDict, Annotated, List, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_tavily import TavilySearch
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, BaseMessage
from langgraph.graph import StateGraph, END, MessagesState
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

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

# --- Global Tools & Embeddings ---
tavily_tool = TavilySearch(max_results=3, search_depth="advanced")
embeddings_model = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")

# --- State Definition ---
class AgentState(TypedDict):
    # Using add_messages handles ID deduplication automatically
    messages: Annotated[List[BaseMessage], operator.add]
    tool_calls_count: int

# --- Agent Builder ---
def build_research_agent(api_key: str):
    # Base LLM for fallbacks (no tools)
    llm_base = ChatOpenAI(
        model="llama-3.3-70b-versatile", # Highly recommended for Groq
        openai_api_key=api_key,
        openai_api_base="https://api.groq.com/openai/v1",
        temperature=0,
        max_tokens=2048
    )
    
    # Tool-bound LLM
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

# --- Endpoints ---

@app.post("/start-research")
async def start_research(request: ResearchRequest):
    api_keys = [os.getenv("GROQ_API_KEY"), os.getenv("GROQ_API_KEY_BACKUP")]
    available_keys = [k for k in api_keys if k]

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
        except Exception as e:
            if "429" in str(e):
                logger.error("Rate limit hit, rotating key...")
                continue
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=503, detail="All API keys exhausted.")

@app.post("/create-vector")
async def create_vector(request: VectorRequest):
    try:
        # This converts the report text into a list of floats
        vector = embeddings_model.embed_query(request.text)
        logger.info("✅ Vector generated successfully")
        return {"status": "success", "vector_length": len(vector), "vector": vector}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))