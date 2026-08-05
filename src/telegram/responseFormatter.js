export function formatTaskCompleteMarkdown(finalOutcome) {
    return `🤖 **Task Complete:**\n\n${finalOutcome}`;
}

export function formatTaskCompletePlain(finalOutcome) {
    return `Task Complete (Plain Text Fallback):\n\n${finalOutcome}`;
}

export function formatErrorMessage(error) {
    return `❌ **Error Encountered:** ${error.message}`;
}
