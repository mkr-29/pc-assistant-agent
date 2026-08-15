import fs from 'fs';
import path from 'path';

export function createAiWebAgentTools({
    browserTools = {},
    ai = null,
    config = {},
    resolveToolPath = p => p
} = {}) {
    const defaultModel = config.agent?.primaryModel || 'gemini-2.5-flash';

    async function callLlmStructured(prompt, systemInstruction = '') {
        if (!ai || typeof ai.models?.generateContent !== 'function') {
            throw new Error('AI Web Agent requires Gemini API key for visual and semantic reasoning.');
        }

        const contents = [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ];

        const response = await ai.models.generateContent({
            model: defaultModel,
            contents,
            config: {
                systemInstruction: systemInstruction || 'You are an autonomous AI Web Agent browser driver. Return only valid JSON without markdown wrapping.',
                temperature: 0.1
            }
        });

        const rawText = response.text ? response.text.trim() : '';
        const cleaned = rawText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/, '')
            .replace(/\s*```$/, '')
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch {
            return { rawOutput: rawText };
        }
    }

    return {
        aiWebAgentAct: async ({ goal, url, maxSteps = 5, takeScreenshot = true } = {}) => {
            if (!goal || typeof goal !== 'string') {
                return { status: 'Error', message: 'A goal string is required for aiWebAgentAct.' };
            }

            const stepsLog = [];
            const safeMaxSteps = Math.max(1, Math.min(Number(maxSteps) || 5, 15));

            try {
                if (url && browserTools.browserNavigate) {
                    const navRes = await browserTools.browserNavigate({ url, takeScreenshot });
                    if (navRes.status === 'Error') return navRes;
                    stepsLog.push({ step: 0, action: 'navigate', url, status: 'Success' });
                }

                for (let stepIndex = 1; stepIndex <= safeMaxSteps; stepIndex++) {
                    const snapshotRes = await browserTools.browserSnapshot({
                        maxTextLength: 3000,
                        maxElements: 30,
                        takeScreenshot
                    });

                    if (snapshotRes.status === 'Error') {
                        return {
                            status: 'Error',
                            message: `Failed to inspect page on step ${stepIndex}: ${snapshotRes.message}`,
                            stepsLog
                        };
                    }

                    const prompt = `
Goal: "${goal}"
Current URL: ${snapshotRes.url}
Page Title: ${snapshotRes.title}

Visible Page Text Summary:
${snapshotRes.visibleText ? snapshotRes.visibleText.slice(0, 1500) : 'None'}

Interactive Elements:
${JSON.stringify(snapshotRes.elements || [], null, 2)}

Previous Step History:
${JSON.stringify(stepsLog, null, 2)}

Decide the NEXT single best action to make progress toward the Goal.
Return a JSON object matching this schema:
{
  "action": "click" | "type" | "pressKey" | "navigate" | "done" | "fail",
  "selector": "CSS selector or element selector (for click/type)",
  "text": "Element label text (alternative to selector)",
  "value": "Text string to type (for type action)",
  "key": "Key name e.g. Enter, Escape, ArrowDown (for pressKey)",
  "url": "Target URL (for navigate)",
  "reason": "Short explanation of why this step is taken",
  "finalAnswer": "Final answer or summary to user (only when action is 'done')"
}
`;

                    const plan = await callLlmStructured(
                        prompt,
                        'You are an autonomous web browsing agent. Make deterministic, goal-oriented progress. When the goal is completed or answered, choose action "done" with finalAnswer.'
                    );

                    const actionType = plan.action || 'done';

                    if (actionType === 'done') {
                        stepsLog.push({ step: stepIndex, action: 'done', reason: plan.reason, finalAnswer: plan.finalAnswer });
                        return {
                            status: 'Success',
                            completed: true,
                            goal,
                            finalAnswer: plan.finalAnswer || plan.reason || 'Goal accomplished successfully.',
                            totalSteps: stepsLog.length,
                            currentUrl: snapshotRes.url,
                            screenshotPath: snapshotRes.screenshotPath,
                            stepsLog
                        };
                    }

                    if (actionType === 'fail') {
                        stepsLog.push({ step: stepIndex, action: 'fail', reason: plan.reason });
                        return {
                            status: 'Error',
                            completed: false,
                            goal,
                            message: `AI Web Agent could not complete goal: ${plan.reason || 'Unknown failure'}`,
                            stepsLog
                        };
                    }

                    let actionResult = null;
                    if (actionType === 'click' && browserTools.browserClick) {
                        actionResult = await browserTools.browserClick({
                            selector: plan.selector,
                            text: plan.text,
                            takeScreenshot
                        });
                    } else if (actionType === 'type' && browserTools.browserType) {
                        actionResult = await browserTools.browserType({
                            selector: plan.selector,
                            text: plan.text,
                            value: plan.value,
                            takeScreenshot
                        });
                    } else if (actionType === 'pressKey' && browserTools.browserPressKey) {
                        actionResult = await browserTools.browserPressKey({
                            key: plan.key || 'Enter',
                            takeScreenshot
                        });
                    } else if (actionType === 'navigate' && browserTools.browserNavigate) {
                        actionResult = await browserTools.browserNavigate({
                            url: plan.url,
                            takeScreenshot
                        });
                    } else {
                        actionResult = { status: 'Error', message: `Unknown or unhandled action type: ${actionType}` };
                    }

                    stepsLog.push({
                        step: stepIndex,
                        action: actionType,
                        plan,
                        result: actionResult
                    });

                    if (actionResult && actionResult.status === 'Error') {
                        // Continue to next iteration so LLM can adapt/retry
                    }
                }

                // If max steps reached without 'done'
                const finalSnapshot = await browserTools.browserSnapshot({ maxTextLength: 2000, takeScreenshot });
                return {
                    status: 'Success',
                    completed: false,
                    goal,
                    message: `AI Web Agent executed ${safeMaxSteps} steps. Page state retrieved.`,
                    currentUrl: finalSnapshot.url,
                    screenshotPath: finalSnapshot.screenshotPath,
                    stepsLog
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `AI Web Agent error: ${error.message}`,
                    stepsLog
                };
            }
        },

        aiWebAgentExtract: async ({ instruction, schema = null, url } = {}) => {
            if (!instruction || typeof instruction !== 'string') {
                return { status: 'Error', message: 'instruction is required for aiWebAgentExtract.' };
            }

            try {
                if (url && browserTools.browserNavigate) {
                    await browserTools.browserNavigate({ url });
                }

                const semanticsRes = browserTools.browserExtractPageSemantics
                    ? await browserTools.browserExtractPageSemantics({ maxContentLength: 8000 })
                    : await browserTools.browserSnapshot({ maxTextLength: 8000 });

                const pageData = semanticsRes.data || semanticsRes;

                const prompt = `
Extraction Goal: "${instruction}"
Target Schema (Optional): ${schema ? JSON.stringify(schema, null, 2) : 'Infer clean JSON object/array structure'}

Page Title: ${semanticsRes.title || 'Unknown'}
URL: ${semanticsRes.url || 'Unknown'}

Page Content & Tables:
${JSON.stringify(pageData, null, 2)}

Extract the requested data accurately according to the instructions. Return valid JSON only.
`;

                const extracted = await callLlmStructured(
                    prompt,
                    'You are an expert web data extractor. Output only clean valid JSON matching the user requirements.'
                );

                return {
                    status: 'Success',
                    instruction,
                    url: semanticsRes.url,
                    title: semanticsRes.title,
                    data: extracted
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `AI Web Agent extraction failed: ${error.message}`
                };
            }
        },

        aiWebAgentObserve: async ({ instruction, url } = {}) => {
            if (!instruction || typeof instruction !== 'string') {
                return { status: 'Error', message: 'instruction is required for aiWebAgentObserve.' };
            }

            try {
                if (url && browserTools.browserNavigate) {
                    await browserTools.browserNavigate({ url });
                }

                const snapshotRes = await browserTools.browserSnapshot({ maxElements: 40 });
                if (snapshotRes.status === 'Error') return snapshotRes;

                const prompt = `
User Instruction: "${instruction}"
Current Page Title: ${snapshotRes.title}
Current URL: ${snapshotRes.url}

Available Interactive Elements on Page:
${JSON.stringify(snapshotRes.elements || [], null, 2)}

Analyze which elements are most relevant for fulfilling the instruction.
Return a JSON array of observed actionable candidates:
[
  {
    "element": "Description of element e.g. 'Search Input' or 'Add to Cart Button'",
    "selector": "CSS selector",
    "suggestedAction": "click" | "type" | "select",
    "confidence": 0.95,
    "reason": "Why this element matches the instruction"
  }
]
`;

                const observations = await callLlmStructured(
                    prompt,
                    'You are an expert web usability and DOM observer. Return only a valid JSON array of observations.'
                );

                return {
                    status: 'Success',
                    instruction,
                    url: snapshotRes.url,
                    totalCandidates: Array.isArray(observations) ? observations.length : 0,
                    candidates: observations
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `AI Web Agent observe failed: ${error.message}`
                };
            }
        }
    };
}
