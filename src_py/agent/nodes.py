"""
Agent nodes for the PC Assistant Agent using LangGraph concepts
"""
from typing import Dict, Any
from langchain_core.runnables import RunnableConfig
from config.env import load_config, validate_config
from llm.factory import LLMFallbackFactory
import logging

logger = logging.getLogger(__name__)

def planner_node(state: Dict[str, Any], config: RunnableConfig) -> Dict[str, Any]:
    """
    Planner node: Creates a step-by-step plan to accomplish the user's goal.

    Args:
        state: Current agent state
        config: LangGraph runtime configuration

    Returns:
        Updated state with plan
    """
    logger.info("Planner node: Creating execution plan")

    try:
        # Extract state variables
        user_prompt = state.get("user_prompt", "")
        _chat_id = state.get("chat_id", "")  # Currently unused but may be needed in future

        if not user_prompt:
            return {
                **state,
                "error": "No user prompt provided",
                "is_complete": True
            }

        # Load configuration and initialize LLM factory
        app_config = load_config()
        validate_config(app_config)
        llm_factory = LLMFallbackFactory(app_config)

        # Create planning prompt
        planning_prompt = f"""
        Create a detailed, step-by-step implementation plan to accomplish the following task: "{user_prompt}".
        Focus on what tools to use, what commands to run, what files to read/write, and state the expected outcomes.
        Return ONLY the plan in clear markdown formatting.
        """

        # Generate plan using LLM with fallback
        plan = llm_factory.generate_text_with_fallback(
            prompt=planning_prompt,
            system_instruction="You are an expert software engineer and system assistant. Create clear, actionable plans.",
            temperature=0.3,  # Lower temperature for more focused planning
            max_tokens=2000
        )

        logger.info(f"Planner created plan: {plan[:100]}...")

        return {
            **state,
            "current_plan": plan,
            "plan_step": 0,
            "execution_results": [],
            "tools_used": [],
            "needs_more_steps": True,
            "is_complete": False
        }

    except Exception as e:
        logger.error(f"Error in planner node: {e}")
        return {
            **state,
            "error": f"Planning failed: {str(e)}",
            "is_complete": True
        }

def agent_node(state: Dict[str, Any], config: RunnableConfig) -> Dict[str, Any]:
    """
    Agent node: Executes the plan step by step using available tools.

    Args:
        state: Current agent state
        config: LangGraph runtime configuration

    Returns:
        Updated state with execution results
    """
    logger.info(f"Agent node: Executing step {state.get('plan_step', 0)}")

    try:
        # Extract state variables
        current_plan = state.get("current_plan", "")
        plan_step = state.get("plan_step", 0)
        execution_results = state.get("execution_results", [])
        tools_used = state.get("tools_used", [])

        if not current_plan:
            return {
                **state,
                "error": "No plan to execute",
                "is_complete": True
            }

        # In a full implementation, we would parse the plan and execute steps
        # For this example, we'll simulate executing a simple step

        # Simple simulation: if we haven't executed any steps yet, execute a basic filesystem operation
        if plan_step == 0 and len(execution_results) == 0:
            # Try to read the current directory as a simple first step
            from tools.filesystem import list_directory
            result = list_directory(".")

            execution_results.append({
                "step": plan_step,
                "action": "list_directory",
                "parameters": {"directory_path": "."},
                "result": result
            })

            tools_used.append("list_directory")
            plan_step += 1

            logger.info(f"Executed step {plan_step-1}: list_directory")

            # Check if we should continue (in a real implementation, this would be based on plan completion)
            needs_more_steps = plan_step < 3  # Simulate 3-step plan for example
            is_complete = not needs_more_steps

            return {
                **state,
                "plan_step": plan_step,
                "execution_results": execution_results,
                "tools_used": tools_used,
                "needs_more_steps": needs_more_steps,
                "is_complete": is_complete
            }

        # If we've executed some steps, mark as complete for this example
        else:
            return {
                **state,
                "needs_more_steps": False,
                "is_complete": True,
                "message": "Plan execution completed (simplified example)"
            }

    except Exception as e:
        logger.error(f"Error in agent node: {e}")
        return {
            **state,
            "error": f"Agent execution failed: {str(e)}",
            "is_complete": True
        }

def fallback_node(state: Dict[str, Any], config: RunnableConfig) -> Dict[str, Any]:
    """
    Fallback node: Handles errors and provides alternative execution paths.

    Args:
        state: Current agent state
        config: LangGraph runtime configuration

    Returns:
        Updated state after fallback handling
    """
    logger.info("Fallback node: Handling errors or providing alternatives")

    error = state.get("error")
    if not error:
        # No error, just pass through
        return state

    logger.warning(f"Fallback node handling error: {error}")

    # In a full implementation, we might try different approaches here
    # For now, we'll just mark as complete with the error
    return {
        **state,
        "needs_more_steps": False,
        "is_complete": True,
        "fallback_applied": True
    }

def reflect_node(state: Dict[str, Any], config: RunnableConfig) -> Dict[str, Any]:
    """
    Reflect node: Reviews execution results and determines if goal is met.

    Args:
        state: Current agent state
        config: LangGraph runtime configuration

    Returns:
        Updated state after reflection
    """
    logger.info("Reflect node: Reviewing execution results")

    try:
        # Extract state variables
        execution_results = state.get("execution_results", [])
        user_prompt = state.get("user_prompt", "")

        # Simple reflection: if we have execution results, consider it successful
        # In a real implementation, this would evaluate if the user's goal was met
        if execution_results:
            reflection = f"Completed {len(execution_results)} execution steps toward goal: '{user_prompt[:50]}...'"
            is_complete = True
        else:
            reflection = "No execution steps were completed"
            is_complete = False

        return {
            **state,
            "reflection": reflection,
            "is_complete": is_complete
        }

    except Exception as e:
        logger.error(f"Error in reflect node: {e}")
        return {
            **state,
            "error": f"Reflection failed: {str(e)}",
            "is_complete": False
        }