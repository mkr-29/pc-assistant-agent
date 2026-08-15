const GREETING_PATTERNS = [
    /^(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening|night)|howdy|sup)[\s!.]*$/i,
    /^(?:thanks|thank\s+you|thx|ty|cool|ok|okay|got\s+it|great|nice|awesome|sure|fine|k)[\s!.]*$/i,
    /^(?:yes|no|yep|nope|approve|allow|deny|cancel)[\s!.]*$/i
];

const HIGH_IMPORTANCE_PATTERNS = [
    /(?:remember|prefer|favorite|my\s+name|i\s+am|i\s+live|email|work\s+as|always|never|timezone|setting|config)/i,
    /(?:create|modify|edit|update|delete|write|run|test|lint|git|commit|push|build|deploy|install|fix|debug)/i,
    /(?:schedule|reminder|alarm|timer|cron|task|calendar|meeting|appointment)/i,
    /(?:project|workspace|repository|file|directory|path|endpoint|port|database|docker|server)/i,
    /(?:\.js|\.ts|\.py|\.json|\.md|\.html|\.css|\.sh|\.env)/i,
    /(?:https?:\/\/|[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/i
];

export function cleanUserPrompt(userPrompt) {
    if (!userPrompt || typeof userPrompt !== 'string') return '';
    let text = userPrompt.trim();

    // Strip voice note framing
    if (text.startsWith('Voice note transcript:\n')) {
        text = text.replace(/^Voice note transcript:\n+/, '').trim();
    } else if (text.includes('The user sent a Telegram voice note. Transcript:\n"""')) {
        const match = text.match(/"""\n([\s\S]*?)\n"""/);
        if (match) text = match[1].trim();
    }

    // Strip image prompt framing
    if (text.startsWith('User sent image:')) {
        const captionMatch = text.match(/with caption:\s*"([^"]+)"/);
        if (captionMatch) {
            text = captionMatch[1].trim();
        }
    }

    return text;
}

export function evaluateTurnImportance(userPrompt, assistantResponse) {
    const cleanPrompt = cleanUserPrompt(userPrompt);
    const cleanResponse = String(assistantResponse || '').trim();

    if (!cleanPrompt && !cleanResponse) {
        return 'ephemeral';
    }

    // Check for pure greeting or acknowledgments
    const isPromptGreeting = GREETING_PATTERNS.some(p => p.test(cleanPrompt));
    const isResponseGreeting = cleanResponse.length < 100 && GREETING_PATTERNS.some(p => p.test(cleanResponse));

    if (isPromptGreeting && (isResponseGreeting || cleanResponse.length < 80)) {
        return 'ephemeral';
    }

    // Check for high-value technical, personal, or action content
    for (const pattern of HIGH_IMPORTANCE_PATTERNS) {
        if (pattern.test(cleanPrompt) || pattern.test(cleanResponse)) {
            return 'high';
        }
    }

    if (cleanPrompt.length > 50 || cleanResponse.length > 150) {
        return 'medium';
    }

    return isPromptGreeting ? 'ephemeral' : 'low';
}

export function extractKeyEntities(text) {
    if (!text || typeof text !== 'string') return [];
    const entities = new Set();

    // File paths
    const pathMatches = text.match(/(?:\/[\w.-]+)+\.[\w]+|\b[\w.-]+\.(?:js|ts|py|json|md|html|css|sh|env|txt|yaml|yml)\b/g);
    if (pathMatches) {
        for (const p of pathMatches) entities.add(p);
    }

    // URLs
    const urlMatches = text.match(/https?:\/\/[^\s),"]+/g);
    if (urlMatches) {
        for (const u of urlMatches) entities.add(u);
    }

    // Ports
    const portMatches = text.match(/\bport\s+(\d{2,5})\b|\b:(\d{4,5})\b/gi);
    if (portMatches) {
        for (const p of portMatches) entities.add(p.toLowerCase());
    }

    return Array.from(entities);
}

export function distillAssistantResponse(assistantResponse, maxChars = 1200) {
    if (!assistantResponse || typeof assistantResponse !== 'string') return '';
    let text = assistantResponse.trim();

    // Remove repetitive markdown task complete banners
    text = text.replace(/^🤖\s*\*\*Task Complete:\*\*\s*\n*/i, '');
    text = text.replace(/^Task Complete \(Plain Text Fallback\):\s*\n*/i, '');

    // Compress massive accessibility tree dumps or long item lists
    if (text.includes('[1] ') && text.includes('[10] ')) {
        const lines = text.split('\n');
        const summaryLines = [];
        let listCount = 0;

        for (const line of lines) {
            if (/^\[\d+\]\s+/.test(line)) {
                listCount++;
                if (listCount <= 5) {
                    summaryLines.push(line);
                }
            } else {
                summaryLines.push(line);
            }
        }

        if (listCount > 5) {
            summaryLines.push(`... (${listCount - 5} additional elements omitted)`);
        }
        text = summaryLines.join('\n');
    }

    // Truncate if still excessively long
    if (text.length > maxChars) {
        text = `${text.slice(0, maxChars - 15)}\n[truncated]`;
    }

    return text;
}

export function createDistilledTurn({ userPrompt, assistantResponse, timestamp }) {
    const cleanedPrompt = cleanUserPrompt(userPrompt);
    const distilledResponse = distillAssistantResponse(assistantResponse);
    const importance = evaluateTurnImportance(cleanedPrompt, distilledResponse);
    const entities = extractKeyEntities(`${cleanedPrompt} ${distilledResponse}`);

    return {
        timestamp: timestamp || new Date().toISOString(),
        userPrompt: cleanedPrompt,
        assistantResponse: distilledResponse,
        importance,
        entities
    };
}
