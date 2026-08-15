import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createContextualPrompt,
    formatConversationHistory,
    formatKnowledgeMemory
} from '../../src/agent/conversationContext.js';

test('createContextualPrompt includes laptop context, prior turns, and current request', () => {
    const prompt = createContextualPrompt({
        userPrompt: 'What did I ask you to remember?',
        config: { targetProjectPath: '/tmp/my-project' },
        currentDate: new Date('2026-07-22T00:00:00.000Z'),
        userProfile: '- **Preferred Desktop Browser:** Brave Browser',
        knowledgeMemory: [
            {
                id: 'mem_1',
                fact: 'Preferred project folder is /Users/example/project.'
            }
        ],
        conversationHistory: [
            {
                timestamp: '2026-07-21T18:00:00.000Z',
                userPrompt: 'Remember that my main project is MKR.',
                assistantResponse: 'Got it.'
            }
        ]
    });

    assert.match(prompt, /## User Profile & Learned Facts/);
    assert.match(prompt, /Brave Browser/);
    assert.match(prompt, /## Local laptop context/);
    assert.match(prompt, /Configured target project path: \/tmp\/my-project/);
    assert.match(prompt, /Resolved target project path: \/tmp\/my-project/);
    assert.match(prompt, /Current ISO time: 2026-07-22T00:00:00.000Z/);
    assert.match(prompt, /Local timezone:/);
    assert.match(prompt, /schedule Telegram reminders/);
    assert.match(prompt, /## Long-term knowledge memory/);
    assert.match(prompt, /mem_1: Preferred project folder is \/Users\/example\/project\./);
    assert.match(prompt, /## Relevant Conversation History/);
    assert.match(prompt, /Remember that my main project is MKR\./);
    assert.match(prompt, /## Current user request/);
    assert.match(prompt, /What did I ask you to remember\?/);
});

test('formatConversationHistory returns an explicit empty-history message', () => {
    assert.equal(
        formatConversationHistory([]),
        'No previous conversation in this Telegram chat.'
    );
});

test('formatConversationHistory keeps recent turns within the character budget', () => {
    const history = [
        {
            userPrompt: 'old user message '.repeat(20),
            assistantResponse: 'old assistant response '.repeat(20)
        },
        {
            userPrompt: 'recent user message',
            assistantResponse: 'recent assistant response'
        }
    ];

    const formatted = formatConversationHistory(history, { maxCharacters: 120 });

    assert.doesNotMatch(formatted, /old user message/);
    assert.match(formatted, /recent user message/);
});

test('formatKnowledgeMemory returns an explicit empty-memory message', () => {
    assert.equal(
        formatKnowledgeMemory([]),
        'No long-term knowledge memory has been saved.'
    );
});

test('formatKnowledgeMemory keeps recent memories within the character budget', () => {
    const formatted = formatKnowledgeMemory(
        [
            { id: 'mem_old', fact: 'old memory '.repeat(20) },
            { id: 'mem_recent', fact: 'recent memory' }
        ],
        { maxCharacters: 80 }
    );

    assert.doesNotMatch(formatted, /mem_old/);
    assert.match(formatted, /mem_recent: recent memory/);
});

test('formatConversationHistory pulls in relevant older turns when userPrompt matches older topic', () => {
    const history = [
        {
            userPrompt: 'Tell me about the Docker architecture for our postgres cluster',
            assistantResponse: 'The postgres cluster uses docker-compose with 3 nodes.'
        },
        {
            userPrompt: 'What is the weather today?',
            assistantResponse: 'The weather is sunny.'
        },
        {
            userPrompt: 'Play some music',
            assistantResponse: 'Playing Lo-Fi.'
        },
        {
            userPrompt: 'What time is it?',
            assistantResponse: 'It is 1 PM.'
        },
        {
            userPrompt: 'Take a screenshot',
            assistantResponse: 'Screenshot captured.'
        }
    ];

    const formatted = formatConversationHistory(history, {
        userPrompt: 'How many nodes are in the postgres docker cluster?',
        maxCharacters: 5000
    });

    assert.match(formatted, /postgres cluster uses docker-compose/);
    assert.match(formatted, /Relevant Past Context/);
});

