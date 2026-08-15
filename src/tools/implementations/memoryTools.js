export function createMemoryTools({ userProfileStore, knowledgeMemoryStore, conversationHistoryStore, chatId } = {}) {
    return {
        rememberUserFact: async ({ fact, category = 'general' } = {}) => {
            if (!fact || !String(fact).trim()) {
                return { status: 'Error', message: 'fact parameter is required' };
            }

            const cleanFact = String(fact).trim();
            const savedProfileFact = userProfileStore?.addFact?.(cleanFact, category);
            const savedKnowledgeFact = knowledgeMemoryStore?.addMemory?.(cleanFact);

            return {
                status: 'Success',
                fact: cleanFact,
                category: category || 'general',
                id: savedProfileFact?.id || savedKnowledgeFact?.id || null,
                message: `Learned and stored fact: "${cleanFact}"`
            };
        },

        getUserProfile: async () => {
            if (!userProfileStore) {
                return { status: 'Error', message: 'User profile store not configured' };
            }

            const profile = userProfileStore.getProfile();
            return {
                status: 'Success',
                profile
            };
        },

        updateUserProfile: async (patch = {}) => {
            if (!userProfileStore) {
                return { status: 'Error', message: 'User profile store not configured' };
            }

            const updated = userProfileStore.updateProfile(patch);
            return {
                status: 'Success',
                profile: updated,
                message: 'Updated user profile successfully.'
            };
        },

        searchUserMemories: async ({ query } = {}) => {
            const profileFacts = userProfileStore?.searchFacts?.(query) || [];
            const knowledge = knowledgeMemoryStore?.listMemories?.() || [];
            const history = (chatId && conversationHistoryStore) ? conversationHistoryStore.getHistory(chatId) : [];

            const queryLower = String(query || '').toLowerCase().trim();
            const matchedKnowledge = queryLower
                ? knowledge.filter(k => k.fact.toLowerCase().includes(queryLower))
                : knowledge;

            const matchedHistory = queryLower
                ? history.filter(h => `${h.userPrompt} ${h.assistantResponse}`.toLowerCase().includes(queryLower))
                : history.slice(-5);

            return {
                status: 'Success',
                query: query || null,
                profileFacts,
                longTermKnowledge: matchedKnowledge,
                relevantHistoryTurns: matchedHistory
            };
        }
    };
}
