import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryTools } from '../../src/tools/implementations/memoryTools.js';

test('memoryTools allow explicit remembering, searching, and profile updates', async () => {
    let profile = {
        name: 'MKR',
        preferredBrowser: 'Brave Browser',
        facts: []
    };
    const knowledgeMemories = [];
    const conversationHistory = [
        {
            userPrompt: 'We designed the bridge architecture yesterday',
            assistantResponse: 'The bridge uses WebSocket on port 4100.'
        }
    ];

    const mockProfileStore = {
        getProfile: () => profile,
        updateProfile: patch => {
            profile = { ...profile, ...patch };
            return profile;
        },
        addFact: (text, category) => {
            const f = { id: 'fact_1', text, category };
            profile.facts.push(f);
            return f;
        },
        searchFacts: query => profile.facts.filter(f => f.text.toLowerCase().includes(query.toLowerCase()))
    };

    const mockKnowledgeStore = {
        addMemory: fact => {
            const m = { id: 'mem_1', fact };
            knowledgeMemories.push(m);
            return m;
        },
        listMemories: () => knowledgeMemories
    };

    const mockHistoryStore = {
        getHistory: chatId => (chatId === 123 ? conversationHistory : [])
    };

    const tools = createMemoryTools({
        userProfileStore: mockProfileStore,
        knowledgeMemoryStore: mockKnowledgeStore,
        conversationHistoryStore: mockHistoryStore,
        chatId: 123
    });

    // 1. rememberUserFact
    const rememberResult = await tools.rememberUserFact({ fact: 'Likes dark theme in VSCode', category: 'preference' });
    assert.equal(rememberResult.status, 'Success');
    assert.equal(rememberResult.fact, 'Likes dark theme in VSCode');

    // 2. getUserProfile
    const profileResult = await tools.getUserProfile();
    assert.equal(profileResult.status, 'Success');
    assert.equal(profileResult.profile.name, 'MKR');

    // 3. updateUserProfile
    const updateResult = await tools.updateUserProfile({ role: 'Principal AI Engineer' });
    assert.equal(updateResult.status, 'Success');
    assert.equal(profile.role, 'Principal AI Engineer');

    // 4. searchUserMemories
    const searchResult = await tools.searchUserMemories({ query: 'bridge' });
    assert.equal(searchResult.status, 'Success');
    assert.equal(searchResult.relevantHistoryTurns.length, 1);
    assert.match(searchResult.relevantHistoryTurns[0].assistantResponse, /WebSocket on port 4100/);
});
