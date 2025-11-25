import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import TypedDict, Annotated, List, Literal

# LangChain / LangGraph Imports
from langchain_groq import ChatGroq
from langchain_community.tools.tavily_search import TavilySearchResults
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, BaseMessage
import operator

load_dotenv()

app = FastAPI(title="Nexus AI Engine")

# --- 1. Setup Tools & Model ---
tavily_tool = TavilySearchResults(max_results=3)
tools = [tavily_tool]

# Bind tools to the LLM (This tells Llama 3 "You have these tools available")
llm = ChatGroq(
    temperature=5, 
    groq_api_key=os.getenv("GROQ_API_KEY"), 
    model_name="llama-3.3-70b-versatile"
).bind_tools(tools)

# --- 2. Define State ---
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]

# --- 3. Define Nodes ---

def call_model(state: AgentState):
    """The Brain: Decides to answer OR call a tool"""
    messages = state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

def call_tool(state: AgentState):
    """The Hands: Executes the tool action"""
    messages = state["messages"]
    last_message = messages[-1]
    
    # Check if the AI actually called a tool
    if not last_message.tool_calls:
        return {"messages": []}

    tool_call = last_message.tool_calls[0]
    print(f"🔎 Agent is searching for: {tool_call['args']}")
    
    # Execute Tavily Search
    tool_output = tavily_tool.invoke(tool_call['args'])
    
    # Create a message confirming the tool result
    tool_message = ToolMessage(
        tool_call_id=tool_call['id'], 
        content=str(tool_output),
        name=tool_call['name']
    )
    return {"messages": [tool_message]}

# --- 4. Define Logic (The "Router") ---
def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """Check if the last message has tool calls"""
    messages = state["messages"]
    last_message = messages[-1]
    
    if last_message.tool_calls:
        return "tools"  # Loop to tool node
    return "end"     # Stop and return answer

# --- 5. Build the Graph ---
workflow = StateGraph(AgentState)

workflow.add_node("agent", call_model)
workflow.add_node("tools", call_tool)

workflow.set_entry_point("agent")

# The Conditional Edge:
# If AI wants to search -> Go to 'tools'
# If AI is done -> Go to END
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "tools": "tools",
        "end": END
    }
)

# The Loop Back:
# After using a tool, go back to 'agent' to read the results
workflow.add_edge("tools", "agent")

app_graph = workflow.compile()

# --- 6. API Endpoint ---
class ResearchRequest(BaseModel):
    prompt: str

@app.post("/start-research")
async def start_research(request: ResearchRequest):
    try:
        # System prompt to give it a "Persona"
        system_prompt = """You are an elite business intelligence analyst. 
        Your goal is to provide a comprehensive, data-backed report.
        ALWAYS use the search tool to find real-time data before answering.
        Format your final answer in clean Markdown."""
        
        initial_state = {"messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.prompt)
        ]}
        
        # Run the graph (It might loop 2-3 times now!)
        final_state = await app_graph.ainvoke(initial_state)
        
        # Extract the very last message (The final answer)
        final_content = final_state["messages"][-1].content
        return {"status": "success", "report": final_content}
        
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))