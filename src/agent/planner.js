export function createPlanPrompt(userPrompt) {
    return [
        {
            role: 'user',
            content: `Create a detailed, step-by-step implementation plan to accomplish the following task: "${userPrompt}". Focus on what commands to run, what files to read/write, and state the expected outcomes. Return ONLY the plan in clear markdown formatting.`
        }
    ];
}
