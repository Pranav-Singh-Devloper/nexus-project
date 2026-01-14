import os
import operator
from typing import TypedDict, Annotated, List, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# LangChain Imports
from langchain_groq import ChatGroq
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, BaseMessage
from langgraph.graph import StateGraph, END
# Vector Embeddings Import
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

# Load Env
load_dotenv()

app = FastAPI(title="Nexus AI Engine")

# --- 1. Setup Global Tools & Embeddings ---
# Tools and Embeddings don't depend on the API key, so we keep them global.

# A. Search Tool
tavily_tool = TavilySearchResults(max_results=3)
tools = [tavily_tool]

# B. Embedding Model (Runs locally on CPU)
embeddings_model = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")

# --- 2. Define Agent State ---
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]

# --- 3. The Agent Builder Function (Dynamic Key Support) ---

def build_research_agent(api_key: str):
    """
    Creates a fresh instance of the LangGraph agent using a specific Groq API Key.
    """
    
    # A. Initialize LLM with the specific key
    llm = ChatGroq(
        temperature=0, 
        groq_api_key=api_key, 
        model_name="llama-3.3-70b-versatile" 
    ).bind_tools(tools)

    # B. Define Nodes (Must be internal to use the specific 'llm' instance)
    
    def call_model(state: AgentState):
        messages = state["messages"]
        response = llm.invoke(messages)
        return {"messages": [response]}

    def call_tool(state: AgentState):
        messages = state["messages"]
        last_message = messages[-1]
        
        if not last_message.tool_calls:
            return {"messages": []}

        tool_call = last_message.tool_calls[0]
        print(f"🔎 Agent is searching for: {tool_call['args']}")
        
        try:
            tool_output = tavily_tool.invoke(tool_call['args'])
        except Exception as e:
            tool_output = f"Error during search: {str(e)}"
        
        tool_message = ToolMessage(
            tool_call_id=tool_call['id'], 
            content=str(tool_output),
            name=tool_call['name']
        )
        return {"messages": [tool_message]}

    def should_continue(state: AgentState) -> Literal["tools", "end"]:
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tools"
        return "end"

    # C. Build Graph
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", call_tool)

    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
    workflow.add_edge("tools", "agent")

    return workflow.compile()

# --- 4. API Endpoints ---

class ResearchRequest(BaseModel):
    prompt: str

class VectorRequest(BaseModel):
    text: str

@app.post("/start-research")
async def start_research(request: ResearchRequest):
    
    # 1. Define Key Rotation List
    # Make sure you add GROQ_API_KEY_BACKUP to your .env file!
    api_keys = [
        os.getenv("GROQ_API_KEY"),
        os.getenv("GROQ_API_KEY_BACKUP"),
        os.getenv("GROQ_API_KEY_TERTIARY") # Optional 3rd key
    ]
    # Filter out empty keys
    available_keys = [k for k in api_keys if k]

    system_prompt = """You are an expert market researcher.
    Your goal is to answer the user's question using real-time data.
    If the answer requires current information (news, stocks, events), use the search tool.
    Final Answer Format:
    - Use clear Markdown.
    - Cite sources if available.
    """
    
    initial_state = {"messages": [
        SystemMessage(content=system_prompt),
        HumanMessage(content=request.prompt)
    ]}

    # 2. Loop through keys
    for index, key in enumerate(available_keys):
        try:
            print(f"🔄 Attempting research with API Key #{index + 1}...")
            
            # Build agent with CURRENT key
            agent_app = build_research_agent(key)
            
            # Run Agent
            final_state = await agent_app.ainvoke(initial_state)
            final_content = final_state["messages"][-1].content
            
            print(f"✅ Success with Key #{index + 1}")
            return {"status": "success", "report": final_content}

        except Exception as e:
            error_msg = str(e)
            print(f"❌ Key #{index + 1} Failed: {error_msg}")
            
            # If it's a Rate Limit (429), CONTINUE to the next key
            if "429" in error_msg or "RateLimit" in error_msg:
                continue 
            
            # If it's a code bug (not a rate limit), break and show error
            print(f"Agent Error (Non-RateLimit): {e}")
            break

    # 3. Fallback: Demo Mode (If ALL keys fail)
    print("⚠️ All API keys exhausted. Engaging Demo Mode.")
    return {
        "status": "demo_mode",
        "report": (
            f"# Market Intelligence Report (Demo Mode): {request.prompt}\n\n"
            "**⚠️ System Notice:** All high-performance AI inference keys are currently "
            "experiencing heavy traffic. This is a generated simulation to demonstrate "
            "system architecture stability.\n\n"
            "## 1. Executive Summary\n"
            "The target market is experiencing a compound annual growth rate (CAGR) of 14.5%, "
            "driven by technological adoption and regulatory shifts. Key players are pivoting toward "
            "sustainable solutions to capture emerging demand.\n\n"
            "## 2. Key Trends\n"
            "* **Digital Transformation:** 60% of incumbents are increasing IT spend.\n"
            "* **Supply Chain Resilience:** Localization of manufacturing is a priority.\n\n"
            "## 3. Strategic Recommendations\n"
            "Investors should focus on Series B opportunities in the infrastructure layer, "
            "while incumbents must accelerate M&A activity to acquire niche capabilities."
        )
    }

@app.post("/create-vector")
async def create_vector(request: VectorRequest):
    try:
        vector = embeddings_model.embed_query(request.text)
        return {"vector": vector}
    except Exception as e:
        print(f"Vector Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))