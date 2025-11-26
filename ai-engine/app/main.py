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

# Load Env
load_dotenv()

app = FastAPI(title="Nexus AI Engine")

# --- 1. Setup Tools ---
tavily_tool = TavilySearchResults(max_results=3)
tools = [tavily_tool]

# --- 2. Setup Model (Llama 3.3 - The New Standard) ---
# We use temperature=0 for strict adherence to facts.
llm = ChatGroq(
    temperature=0, 
    groq_api_key=os.getenv("GROQ_API_KEY"), 
    model_name="llama-3.3-70b-versatile" 
).bind_tools(tools)

# --- 3. Define State ---
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]

# --- 4. Define Nodes ---

def call_model(state: AgentState):
    messages = state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

def call_tool(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    
    # Defensive coding: If no tool calls, skip
    if not last_message.tool_calls:
        return {"messages": []}

    tool_call = last_message.tool_calls[0]
    print(f"🔎 Agent is searching for: {tool_call['args']}")
    
    # Execute Search
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

# --- 5. Build Graph ---
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", call_tool)

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
workflow.add_edge("tools", "agent")

app_graph = workflow.compile()

# --- 6. API Endpoint ---
class ResearchRequest(BaseModel):
    prompt: str

@app.post("/start-research")
async def start_research(request: ResearchRequest):
    try:
        # RELIABLE PROMPT STRATEGY:
        # Don't micro-manage the model ("Always do X"). 
        # Instead, give it a clear goal and format.
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
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))