import os
import operator
from typing import TypedDict, Annotated, List, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# --- CHANGED: Groq (OpenAI Compatible) Import ---
from langchain_openai import ChatOpenAI

# LangChain Imports
from langchain_tavily import TavilySearch
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, BaseMessage
from langgraph.graph import StateGraph, END

# Vector Embeddings Import
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

# Load Env
load_dotenv()

app = FastAPI(title="Nexus AI Engine")

# --- 1. Setup Global Tools & Embeddings ---

# A. Search Tool
tavily_tool = TavilySearch(
    max_results=3,
    search_depth="basic"
)
tools = [tavily_tool]

# B. Embedding Model (Runs locally on CPU)
embeddings_model = FastEmbedEmbeddings(
    model_name="BAAI/bge-small-en-v1.5"
)

# --- 2. Define Agent State ---
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]

# --- 3. Agent Builder Function (Groq + Kimi K2) ---

def build_research_agent(api_key: str):
    """
    Creates a fresh instance of the LangGraph agent using Groq Cloud.
    """

    # 🔥 Groq via OpenAI-compatible endpoint
    llm = ChatOpenAI(
        model="moonshotai/kimi-k2-instruct-0905",
        openai_api_key=api_key,
        openai_api_base="https://api.groq.com/openai/v1",
        temperature=0,
        max_tokens=2048,
        request_timeout=60
    ).bind_tools(tools)

    # --- Graph Nodes ---

    def call_model(state: AgentState):
        response = llm.invoke(state["messages"])
        return {"messages": [response]}

    def call_tool(state: AgentState):
        last_message = state["messages"][-1]

        if not last_message.tool_calls:
            return {"messages": []}

        tool_call = last_message.tool_calls[0]
        print(f"🔎 Agent is searching for: {tool_call['args']}")

        try:
            tool_output = tavily_tool.invoke(tool_call["args"])
        except Exception as e:
            tool_output = f"Error during search: {str(e)}"

        tool_message = ToolMessage(
            tool_call_id=tool_call["id"],
            content=str(tool_output),
            name=tool_call["name"],
        )

        return {"messages": [tool_message]}

    def should_continue(state: AgentState) -> Literal["tools", "end"]:
        last_message = state["messages"][-1]
        return "tools" if last_message.tool_calls else "end"

    # --- Build Graph ---
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", call_model)
    workflow.add_node("tools", call_tool)

    workflow.set_entry_point("agent")
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "end": END},
    )
    workflow.add_edge("tools", "agent")

    return workflow.compile()

# --- 4. API Schemas ---

class ResearchRequest(BaseModel):
    prompt: str

class VectorRequest(BaseModel):
    text: str

# --- 5. Research Endpoint ---

@app.post("/start-research")
async def start_research(request: ResearchRequest):

    # 🔑 Groq Key Rotation
    api_keys = [
        os.getenv("GROQ_API_KEY"),
        os.getenv("GROQ_API_KEY_BACKUP")  # optional
    ]

    available_keys = [k for k in api_keys if k]

    if not available_keys:
        raise HTTPException(
            status_code=500,
            detail="No GROQ_API_KEY found in environment."
        )

    system_prompt = """You are an expert market researcher.
Your goal is to answer the user's question using real-time data.
If the answer requires current information (news, stocks, events), use the search tool.
Final Answer Format:
- Use clear Markdown.
- Cite sources if available.
"""

    initial_state = {
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.prompt),
        ]
    }

    for index, key in enumerate(available_keys):
        try:
            print(f"🔄 Attempting research with Groq Key #{index + 1}...")

            agent_app = build_research_agent(key)

            final_state = await agent_app.ainvoke(initial_state)
            final_content = final_state["messages"][-1].content

            print(f"✅ Success with Key #{index + 1}")

            return {
                "status": "success",
                "provider": "groq",
                "model": "moonshotai/kimi-k2-instruct-0905",
                "report": final_content,
            }

        except Exception as e:
            error_msg = str(e)
            print(f"❌ Key #{index + 1} Failed: {error_msg}")

            # Handle rate limit
            if "429" in error_msg:
                continue

            raise HTTPException(status_code=500, detail=error_msg)

    # Fallback if all keys fail
    raise HTTPException(
        status_code=503,
        detail="All Groq API keys exhausted."
    )

# --- 6. Embedding Endpoint ---

@app.post("/create-vector")
async def create_vector(request: VectorRequest):
    try:
        vector = embeddings_model.embed_query(request.text)
        return {"vector": vector}
    except Exception as e:
        print(f"Vector Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))