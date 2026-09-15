"""
Agent graph construction using LangGraph concepts
"""
from typing import Dict, Any
from langgraph.graph import StateGraph, END
from agent.state import AgentState
from agent.nodes import planner_node, agent_node, fallback_node, reflect_node
import logging

logger = logging.getLogger(__name__)

def create_agent_graph() -> StateGraph:
    """
    Create the agent workflow graph.

    Returns:
        Compiled LangGraph state graph
    """
    logger.info("Creating agent workflow graph")

    # Create the state graph
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("planner", planner_node)
    workflow.add_node("agent", agent_node)
    workflow.add_node("fallback", fallback_node)
    workflow.add_node("reflect", reflect_node)

    # Set entry point
    workflow.set_entry_point("planner")

    # Add edges
    workflow.add_edge("planner", "agent")
    workflow.add_edge("agent", "reflect")
    workflow.add_conditional_edges(
        "reflect",
        lambda state: "agent" if state.get("needs_more_steps", False) else "end",
        {
            "agent": "agent",
            "end": END
        }
    )

    # Add fallback edges for error handling
    workflow.add_edge("planner", "fallback")
    workflow.add_edge("agent", "fallback")
    workflow.add_edge("reflect", "fallback")
    workflow.add_conditional_edges(
        "fallback",
        lambda state: END if state.get("is_complete", False) else "agent",
        {
            "agent": "agent",
            "end": END
        }
    )

    # Compile the graph
    app = workflow.compile()

    logger.info("Agent workflow graph created and compiled")
    return app

# Create a default agent instance
agent_graph = create_agent_graph()