"""
Agent graph construction using LangGraph concepts and robust conditional edges.
"""
import logging
from typing import Dict, Any
from langgraph.graph import StateGraph, END
from agent.state import AgentState
from agent.nodes import planner_node, agent_node, fallback_node, reflect_node

logger = logging.getLogger(__name__)

def route_after_planner(state: Dict[str, Any]) -> str:
    """Route after planner: fallback on error, otherwise proceed to agent"""
    if state.get("error"):
        return "fallback"
    return "agent"

def route_after_agent(state: Dict[str, Any]) -> str:
    """Route after agent: fallback on error, loop if more steps needed, otherwise reflect"""
    if state.get("error"):
        return "fallback"
    if state.get("needs_more_steps", False):
        return "agent"
    return "reflect"

def route_after_reflect(state: Dict[str, Any]) -> str:
    """Route after reflect: fallback on error, otherwise end workflow"""
    if state.get("error"):
        return "fallback"
    return "end"

def create_agent_graph() -> StateGraph:
    """
    Create and compile the agent workflow graph with proper conditional transitions.

    Returns:
        Compiled LangGraph state graph application
    """
    logger.info("Building agent workflow state graph")

    workflow = StateGraph(AgentState)

    # Register nodes
    workflow.add_node("planner", planner_node)
    workflow.add_node("agent", agent_node)
    workflow.add_node("reflect", reflect_node)
    workflow.add_node("fallback", fallback_node)

    # Workflow entry point
    workflow.set_entry_point("planner")

    # Conditional routing from planner
    workflow.add_conditional_edges(
        "planner",
        route_after_planner,
        {
            "agent": "agent",
            "fallback": "fallback"
        }
    )

    # Conditional routing from agent
    workflow.add_conditional_edges(
        "agent",
        route_after_agent,
        {
            "agent": "agent",
            "reflect": "reflect",
            "fallback": "fallback"
        }
    )

    # Conditional routing from reflect
    workflow.add_conditional_edges(
        "reflect",
        route_after_reflect,
        {
            "end": END,
            "fallback": "fallback"
        }
    )

    # Fallback node always transitions to END
    workflow.add_edge("fallback", END)

    # Compile the graph
    app = workflow.compile()
    logger.info("Agent workflow graph successfully compiled")
    return app

# Default compiled graph instance
agent_graph = create_agent_graph()