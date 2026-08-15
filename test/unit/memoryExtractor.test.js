import assert from 'node:assert/strict';
import test from 'node:test';
import { extractUserFactsFromText, autoLearnFromTurn } from '../../src/agent/memoryExtractor.js';

test('extractUserFactsFromText detects name, role, browser, location, email, and preferences', () => {
    const { facts, profilePatch } = extractUserFactsFromText(
        'My name is Mayank, I am a senior engineer, I live in Bangalore. My favorite browser is Brave. My email is dev@mkr.ai.'
    );

    assert.equal(profilePatch.name, 'Mayank');
    assert.equal(profilePatch.role, 'senior engineer');
    assert.equal(profilePatch.location, 'Bangalore');
    assert.equal(profilePatch.preferredBrowser, 'Brave Browser');
    assert.equal(profilePatch.email, 'dev@mkr.ai');

    assert.ok(facts.some(f => f.category === 'identity' && f.text.includes('Mayank')));
    assert.ok(facts.some(f => f.category === 'work' && f.text.includes('senior engineer')));
    assert.ok(facts.some(f => f.category === 'location' && f.text.includes('Bangalore')));
    assert.ok(facts.some(f => f.category === 'contact' && f.text.includes('dev@mkr.ai')));
});

test('autoLearnFromTurn updates userProfileStore and knowledgeMemoryStore', () => {
    let patchedProfile = null;
    const addedProfileFacts = [];
    const addedKnowledgeFacts = [];

    const mockProfileStore = {
        updateProfile: patch => {
            patchedProfile = patch;
        },
        addFact: (text, category) => {
            addedProfileFacts.push({ text, category });
        }
    };

    const mockKnowledgeStore = {
        addMemory: fact => {
            addedKnowledgeFacts.push(fact);
        }
    };

    autoLearnFromTurn({
        userPrompt: 'Call me Mayank and always use Brave browser.',
        userProfileStore: mockProfileStore,
        knowledgeMemoryStore: mockKnowledgeStore
    });

    assert.equal(patchedProfile?.name, 'Mayank');
    assert.ok(addedProfileFacts.length >= 1);
    assert.ok(addedKnowledgeFacts.length >= 1);
});
