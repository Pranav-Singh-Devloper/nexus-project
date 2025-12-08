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

# --- 1. Setup Tools & Models ---

# A. Search Tool
tavily_tool = TavilySearchResults(max_results=3)
tools = [tavily_tool]

# B. LLM (Agent Brain)
llm = ChatGroq(
    temperature=0, 
    groq_api_key=os.getenv("GROQ_API_KEY"), 
    model_name="llama-3.3-70b-versatile" 
).bind_tools(tools)

# C. Embedding Model (For Hybrid Search)
# This runs locally on CPU
embeddings_model = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")

# --- 2. Define Agent State ---
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]

# --- 3. Define Agent Nodes ---

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

# --- 4. Build Agent Graph ---
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", call_tool)

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
workflow.add_edge("tools", "agent")

app_graph = workflow.compile()

# --- 5. API Endpoints ---

class ResearchRequest(BaseModel):
    prompt: str

class VectorRequest(BaseModel):
    text: str

# Endpoint 1: The Agent
@app.post("/start-research")
async def start_research(request: ResearchRequest):
    try:
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
        
        final_state = await app_graph.ainvoke(initial_state)
        final_content = final_state["messages"][-1].content
        
        return {"status": "success", "report": final_content}
        
    except Exception as e:
        print(f"Agent Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 2: The Vectorizer (RESTORED!)
@app.post("/create-vector")
async def create_vector(request: VectorRequest):
    try:
        # Convert text to a list of floats (vector)
        vector = embeddings_model.embed_query(request.text)
        return {"vector": vector}
    except Exception as e:
        print(f"Vector Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))