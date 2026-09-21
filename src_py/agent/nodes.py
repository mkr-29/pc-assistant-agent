"""
LangGraph agent nodes for the PC Assistant Agent.
Implements real step-by-step plan execution with dynamic tool calling,
reflection synthesis, and fallback error handling.
"""
import asyncio
import json
import logging
import os
import re
from typing import Dict, Any, List, Optional
from langchain_core.runnables import RunnableConfig

from config.env import load_config, validate_config
from llm.factory import LLMFallbackFactory
from tools.registry import tool_registry

logger = logging.getLogger(__name__)

def _get_tools_summary() -> str:
    """Generate a readable list of registered tools and their descriptions"""
    categories = tool_registry.list_tools_by_category()
    summary_lines = []
    for cat, tools in categories.items():
        summary_lines.append(f"Category: {cat}")
        for t in tools:
            desc = tool_registry.get_tool_description(t).split("\n")[0]
            summary_lines.append(f"  - {t}: {desc}")
    return "\n".join(summary_lines)

def _parse_plan_steps(plan_text: str) -> List[str]:
    """Parse numbered or bulleted steps from LLM plan text"""
    steps = []
    lines = plan_text.strip().split("\n")
    for line in lines:
        cleaned = line.strip()
        # Match lines like "1. Do something", "Step 1: Do something", "1) Do something"
        match = re.match(r'^(?:step\s*)?(\d+)[\.\)\:]\s*(.+)$', cleaned, re.IGNORECASE)
        if match:
            step_desc = match.group(2).strip()
            if step_desc and not step_desc.lower().startswith("expected outcome"):
                steps.append(step_desc)

    # Fallback: check markdown bullet points if no numbered steps found
    if not steps:
        for line in lines:
            cleaned = line.strip()
            if cleaned.startswith(("- ", "* ")) and len(cleaned) > 4:
                steps.append(cleaned[2:].strip())

    return steps

async def planner_node(state: Dict[str, Any], config: Optional[RunnableConfig] = None) -> Dict[str, Any]:
    """
    Planner node: Generates an actionable step-by-step plan based on user prompt and available tools.
    """
    logger.info("Planner node: Formulating execution plan")

    user_prompt = state.get("user_prompt", "").strip()
    if not user_prompt:
        return {
            **state,
            "error": "No user prompt provided",
            "is_complete": True,
            "needs_more_steps": False
        }

    try:
        app_config = load_config()
        # Telegram token not strictly required during headless graph execution
        validate_config(app_config, require_telegram=False)
        llm_factory = LLMFallbackFactory(app_config)

        tools_summary = _get_tools_summary()
        knowledge = state.get("knowledge_memory", [])
        profile = state.get("user_profile", {})

        context_parts = []
        if profile:
            context_parts.append(f"User Profile: {json.dumps(profile)}")
        if knowledge:
            facts = [k.get("fact", "") for k in knowledge if k.get("fact")]
            context_parts.append(f"Known Facts: {'; '.join(facts)}")

        context_str = "\n".join(context_parts)

        planning_prompt = f"""You are an intelligent PC Assistant Agent planner.
You have direct execution capabilities on this machine including taking desktop screenshots (`take_screenshot`), running commands, interacting with macOS, reading/writing files, querying system info, web browsing, and sending photos/messages to Telegram.
Create a concise, step-by-step action plan to accomplish the user's request:
"{user_prompt}"

{context_str}

Available Tools:
{tools_summary}

Requirements:
1. Break the task into 1 to 4 concrete, ordered steps.
2. Number each step clearly (e.g., "1. Capture screen using take_screenshot").
3. Use available tools. For screenshot requests, ALWAYS use `take_screenshot`.
4. Keep the steps short and specific.
"""

        plan_text = await llm_factory.generate_text_with_fallback(
            prompt=planning_prompt,
            system_instruction="You are a system planner. Generate only clear, numbered execution steps.",
            temperature=0.2,
            max_tokens=1500
        )

        steps = _parse_plan_steps(plan_text)
        if not steps:
            # If no numbered steps could be parsed, treat the user prompt as a single step
            steps = [f"Execute: {user_prompt}"]

        logger.info(f"Planner formulated {len(steps)} steps: {steps}")

        return {
            **state,
            "current_plan": plan_text,
            "plan_steps": steps,
            "plan_step": 0,
            "max_steps": state.get("max_steps") or max(len(steps) + 2, 8),
            "execution_results": [],
            "tools_used": [],
            "needs_more_steps": len(steps) > 0,
            "is_complete": False,
            "error": None
        }

    except Exception as e:
        logger.error(f"Error in planner_node: {e}", exc_info=True)
        # Fallback to direct single step on error rather than aborting entirely
        return {
            **state,
            "current_plan": f"Direct execution for: {user_prompt}",
            "plan_steps": [f"Fulfill request: {user_prompt}"],
            "plan_step": 0,
            "max_steps": 5,
            "execution_results": [],
            "tools_used": [],
            "needs_more_steps": True,
            "is_complete": False,
            "error": None
        }

async def agent_node(state: Dict[str, Any], config: Optional[RunnableConfig] = None) -> Dict[str, Any]:
    """
    Agent node: Executes the current plan step by dynamically selecting and executing tools.
    """
    plan_step = state.get("plan_step", 0)
    plan_steps = state.get("plan_steps", [])
    max_steps = state.get("max_steps", 10)
    execution_results = list(state.get("execution_results", []))
    tools_used = list(state.get("tools_used", []))
    user_prompt = state.get("user_prompt", "")

    logger.info(f"Agent node: Executing step {plan_step + 1}/{len(plan_steps)}")

    if plan_step >= len(plan_steps) or plan_step >= max_steps:
        logger.info("All plan steps or max steps completed. Proceeding to reflection.")
        return {
            **state,
            "needs_more_steps": False,
            "is_complete": False
        }

    current_step_desc = plan_steps[plan_step]

    try:
        app_config = load_config()
        llm_factory = LLMFallbackFactory(app_config)

        # Get schemas of all registered tools
        tools_schema = tool_registry.get_tools_schema()

        # Build prompt for executing this specific step
        exec_prompt = f"""Goal: "{user_prompt}"
Current step ({plan_step + 1}/{len(plan_steps)}): "{current_step_desc}"

Previous execution history:
{json.dumps(execution_results[-3:], indent=2, default=str) if execution_results else "No previous steps executed yet."}

Select the tool needed to execute this step and provide valid parameters.
- To capture the screen/screenshot, call `take_screenshot`.
- To send photos via Telegram, call `send_telegram_photo`.
- If no tool is required, explain your finding.
"""

        tool_response = await llm_factory.generate_text_with_tools_fallback(
            prompt=exec_prompt,
            tools=tools_schema,
            system_instruction="You are an autonomous assistant. Call tools with correct parameters to execute the plan step.",
            temperature=0.2
        )

        step_output = {}
        tool_calls = tool_response.get("tool_calls", [])
        response_text = tool_response.get("text", "")

        if tool_calls:
            for call in tool_calls:
                tool_name = call.get("name")
                tool_args = call.get("arguments", {})

                logger.info(f"Agent calling tool '{tool_name}' with arguments: {tool_args}")
                try:
                    tool_fn = tool_registry.get_tool(tool_name)
                    if not tool_fn:
                        call_result = {"error": f"Tool '{tool_name}' not found in registry."}
                    else:
                        call_result = await tool_registry.execute_tool(tool_name, **tool_args)

                    if tool_name not in tools_used:
                        tools_used.append(tool_name)

                except Exception as tool_err:
                    logger.warning(f"Error executing tool '{tool_name}': {tool_err}")
                    call_result = {"error": str(tool_err)}

                step_output = {
                    "step": plan_step + 1,
                    "step_description": current_step_desc,
                    "action": tool_name,
                    "parameters": tool_args,
                    "result": call_result
                }
                execution_results.append(step_output)
        else:
            # Check if this step was meant to capture a screenshot or send it via Telegram
            desc_lower = current_step_desc.lower()
            if any(w in desc_lower for w in ("send_telegram_photo", "send via telegram", "send the captured screenshot", "send to the user via telegram")):
                # Find previously captured screenshot file
                prev_photo = None
                for er in execution_results:
                    r = er.get("result", {})
                    if isinstance(r, dict):
                        p = r.get("photo_path") or r.get("file_path")
                        if p and isinstance(p, str) and os.path.exists(p):
                            prev_photo = p
                            break
                if prev_photo:
                    logger.info(f"Executing send_telegram_photo fallback with {prev_photo}")
                    call_result = await tool_registry.execute_tool("send_telegram_photo", photo_path=prev_photo, caption="📸 Screen Capture")
                    if "send_telegram_photo" not in tools_used:
                        tools_used.append("send_telegram_photo")
                    step_output = {
                        "step": plan_step + 1,
                        "step_description": current_step_desc,
                        "action": "send_telegram_photo",
                        "parameters": {"photo_path": prev_photo},
                        "result": call_result
                    }
                    execution_results.append(step_output)
                else:
                    step_output = {
                        "step": plan_step + 1,
                        "step_description": current_step_desc,
                        "action": "reasoning",
                        "parameters": {},
                        "result": response_text
                    }
                    execution_results.append(step_output)
            elif any(w in desc_lower for w in ("screenshot", "screencapture", "capture screen", "take a screen", "take_screenshot")):
                logger.info("Executing take_screenshot fallback based on step description")
                call_result = await tool_registry.execute_tool("take_screenshot")
                if "take_screenshot" not in tools_used:
                    tools_used.append("take_screenshot")
                step_output = {
                    "step": plan_step + 1,
                    "step_description": current_step_desc,
                    "action": "take_screenshot",
                    "parameters": {},
                    "result": call_result
                }
                execution_results.append(step_output)
            else:
                step_output = {
                    "step": plan_step + 1,
                    "step_description": current_step_desc,
                    "action": "reasoning",
                    "parameters": {},
                    "result": response_text
                }
                execution_results.append(step_output)

        next_step = plan_step + 1
        has_more = (next_step < len(plan_steps)) and (next_step < max_steps)

        return {
            **state,
            "plan_step": next_step,
            "execution_results": execution_results,
            "tools_used": tools_used,
            "needs_more_steps": has_more,
            "is_complete": not has_more,
            "error": None
        }

    except Exception as e:
        logger.error(f"Error in agent_node step {plan_step}: {e}", exc_info=True)
        return {
            **state,
            "error": f"Step {plan_step + 1} execution failed: {str(e)}",
            "needs_more_steps": False,
            "is_complete": False
        }

async def reflect_node(state: Dict[str, Any], config: Optional[RunnableConfig] = None) -> Dict[str, Any]:
    """
    Reflect node: Reviews all execution results and synthesizes a comprehensive final response.
    """
    logger.info("Reflect node: Synthesizing final response")

    user_prompt = state.get("user_prompt", "")
    current_plan = state.get("current_plan", "")
    execution_results = state.get("execution_results", [])
    tools_used = state.get("tools_used", [])

    try:
        app_config = load_config()
        llm_factory = LLMFallbackFactory(app_config)

        reflection_prompt = f"""You are the PC Assistant.
The user requested: "{user_prompt}"

Execution Plan:
{current_plan}

Actual Execution Results:
{json.dumps(execution_results, indent=2, default=str)}

Tools Used: {', '.join(tools_used) if tools_used else 'None'}

Please provide a clear, helpful, and well-structured final answer to the user.
Directly state what was found or completed, and present the information in a concise, readable format.
"""

        reflection_text = await llm_factory.generate_text_with_fallback(
            prompt=reflection_prompt,
            system_instruction="You are a helpful PC assistant. Present execution outcomes clearly and directly.",
            temperature=0.3,
            max_tokens=2500
        )

        detected_photo = state.get("photo_path")
        if not detected_photo:
            for er in execution_results:
                r = er.get("result", {})
                if isinstance(r, dict):
                    p = r.get("photo_path") or r.get("file_path")
                    if p and isinstance(p, str) and p.lower().endswith((".png", ".jpg", ".jpeg")) and os.path.exists(p):
                        detected_photo = p
                        break

        # If a screenshot was captured, ensure canned refusal text is replaced with a clear confirmation
        if detected_photo and any(w in user_prompt.lower() for w in ("screenshot", "screen shot", "capture screen")):
            if any(ref in reflection_text.lower() for ref in ("can't capture", "cannot capture", "can't take", "cannot take", "sorry, but i can't")):
                reflection_text = "📸 Here is a screenshot of your screen:"

        res_state = {
            **state,
            "reflection": reflection_text,
            "final_response": reflection_text,
            "is_complete": True,
            "needs_more_steps": False,
            "error": None
        }
        if detected_photo:
            res_state["photo_path"] = detected_photo
        return res_state

    except Exception as e:
        logger.error(f"Error in reflect_node: {e}", exc_info=True)
        # Fallback reflection from raw results
        fallback_summary = f"Processed request: '{user_prompt}'. Executed {len(execution_results)} step(s)."
        if execution_results:
            last_res = execution_results[-1].get("result")
            fallback_summary += f"\nLast result: {last_res}"

        return {
            **state,
            "reflection": fallback_summary,
            "final_response": fallback_summary,
            "is_complete": True,
            "needs_more_steps": False
        }

async def fallback_node(state: Dict[str, Any], config: Optional[RunnableConfig] = None) -> Dict[str, Any]:
    """
    Fallback node: Handles execution errors, provides diagnostics and graceful recovery.
    """
    error = state.get("error", "An unexpected error occurred during execution.")
    user_prompt = state.get("user_prompt", "")
    execution_results = state.get("execution_results", [])

    logger.warning(f"Fallback node handling error: {error}")

    fallback_response = (
        f"I encountered an issue while processing your request: '{user_prompt}'.\n\n"
        f"Details: {error}\n"
    )

    if execution_results:
        fallback_response += f"\nI was able to complete {len(execution_results)} step(s) before encountering the error."

    return {
        **state,
        "reflection": fallback_response,
        "final_response": fallback_response,
        "needs_more_steps": False,
        "is_complete": True,
        "fallback_applied": True
    }