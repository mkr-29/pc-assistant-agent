export function extractUserFactsFromText(text) {
    if (!text || typeof text !== 'string') return { facts: [], profilePatch: {} };

    const raw = text.trim();
    const facts = [];
    const profilePatch = {};

    // 1. Identity & Name
    const nameMatch = raw.match(/(?:my name is|i am called|call me)\s+([a-zA-Z0-9_]+)/i);
    if (nameMatch) {
        const candidate = nameMatch[1].trim();
        const stopWords = new Set(['and', 'or', 'to', 'for', 'the', 'a', 'an', 'please', 'sir', 'here', 'now', 'always', 'never']);
        if (!stopWords.has(candidate.toLowerCase())) {
            profilePatch.name = candidate;
            facts.push({ category: 'identity', text: `User's name is ${candidate}` });
        }
    }

    // 2. Role / Profession
    const roleMatch = raw.match(/(?:i am a|i work as an?|my role is(?: an?)?)\s+([a-zA-Z0-9_\s-]{3,40}(?:developer|engineer|designer|manager|student|researcher|founder|architect))/i);
    if (roleMatch) {
        const role = roleMatch[1].trim();
        profilePatch.role = role;
        facts.push({ category: 'work', text: `User is a ${role}` });
    }

    // 3. Location / City
    const locMatch = raw.match(/(?:i live in|i am based in|i am in|located in)\s+([A-Z][a-zA-Z\s,]{2,30})/i);
    if (locMatch) {
        const location = locMatch[1].trim();
        profilePatch.location = location;
        facts.push({ category: 'location', text: `User is located in ${location}` });
    }

    // 4. Email address
    const emailMatch = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
        const email = emailMatch[1].trim();
        profilePatch.email = email;
        facts.push({ category: 'contact', text: `User's email is ${email}` });
    }

    // 5. Browser preference
    const browserMatch = raw.match(/(?:my (?:favorite|default|preferred) browser is|i prefer using|use browser)\s+(Brave|Chrome|Firefox|Safari|Arc|Edge)/i);
    if (browserMatch) {
        const browser = browserMatch[1].trim();
        profilePatch.preferredBrowser = browser.toLowerCase().includes('brave') ? 'Brave Browser' : `${browser} Browser`;
        facts.push({ category: 'preference', text: `User prefers ${profilePatch.preferredBrowser}` });
    }

    // 6. Direct preference expressions
    const prefMatch = raw.match(/(?:i prefer|i like|i love|my favorite)\s+([^.\n]{4,80})/i);
    if (prefMatch && !browserMatch) {
        const pref = prefMatch[1].trim();
        facts.push({ category: 'preference', text: `User preference: ${pref}` });
    }

    // 7. Imperative user guidelines ("Always...", "Never...")
    const ruleMatch = raw.match(/(?:always|never)\s+([^.\n]{5,100})/i);
    if (ruleMatch) {
        facts.push({ category: 'guideline', text: `User guideline: ${ruleMatch[0].trim()}` });
    }

    return { facts, profilePatch };
}

export function autoLearnFromTurn({ userPrompt, userProfileStore, knowledgeMemoryStore }) {
    if (!userPrompt) return;

    try {
        const { facts, profilePatch } = extractUserFactsFromText(userPrompt);

        if (userProfileStore) {
            if (Object.keys(profilePatch).length > 0) {
                userProfileStore.updateProfile(profilePatch);
            }
            for (const f of facts) {
                userProfileStore.addFact(f.text, f.category);
            }
        }

        if (knowledgeMemoryStore) {
            for (const f of facts) {
                knowledgeMemoryStore.addMemory(f.text);
            }
        }
    } catch (err) {
        console.warn('[MemoryExtractor] Failed auto-extracting user facts:', err.message);
    }
}
