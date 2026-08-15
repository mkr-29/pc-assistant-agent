import assert from 'node:assert/strict';
import test from 'node:test';
import {
    cleanUserPrompt,
    evaluateTurnImportance,
    extractKeyEntities,
    distillAssistantResponse,
    createDistilledTurn
} from '../../src/agent/turnDistiller.js';

test('cleanUserPrompt removes voice note framing and image captions cleanly', () => {
    const voicePrompt = 'Voice note transcript:\nPlease build the react frontend.';
    assert.equal(cleanUserPrompt(voicePrompt), 'Please build the react frontend.');

    const imagePrompt = 'User sent image: /tmp/photo.jpg with caption: "Fix this error on the page"';
    assert.equal(cleanUserPrompt(imagePrompt), 'Fix this error on the page');

    const regularPrompt = 'What is the current git status?';
    assert.equal(cleanUserPrompt(regularPrompt), 'What is the current git status?');
});

test('evaluateTurnImportance accurately identifies ephemeral, medium, and high importance turns', () => {
    // Ephemeral
    assert.equal(evaluateTurnImportance('hi', 'Hello! How can I help you today?'), 'ephemeral');
    assert.equal(evaluateTurnImportance('thanks', 'You are welcome!'), 'ephemeral');
    assert.equal(evaluateTurnImportance('ok', 'Got it.'), 'ephemeral');
    assert.equal(evaluateTurnImportance('APPROVE', 'Proceeding.'), 'ephemeral');

    // High Importance
    assert.equal(evaluateTurnImportance('My preferred browser is Brave', 'I will use Brave.'), 'high');
    assert.equal(evaluateTurnImportance('Please commit the changes to git', 'Committed.'), 'high');
    assert.equal(evaluateTurnImportance('Schedule a reminder for tomorrow at 10 AM', 'Scheduled.'), 'high');
    assert.equal(evaluateTurnImportance('Run npm test on the server', 'Tests passed.'), 'high');
    assert.equal(evaluateTurnImportance('What is on port 4100?', 'Port 4100 is the agent bridge.'), 'high');

    // Medium Importance
    assert.equal(
        evaluateTurnImportance('Explain the difference between TCP and UDP in computer networking', 'TCP is connection-oriented while UDP is connectionless.'),
        'medium'
    );
});

test('extractKeyEntities detects file paths, URLs, and port numbers', () => {
    const text = 'Modified /Users/mkr/src/server.js and package.json to connect to https://api.example.com on port 4100';
    const entities = extractKeyEntities(text);

    assert.ok(entities.includes('/Users/mkr/src/server.js') || entities.includes('server.js'));
    assert.ok(entities.includes('package.json'));
    assert.ok(entities.includes('https://api.example.com'));
    assert.ok(entities.includes('port 4100'));
});

test('distillAssistantResponse compresses massive accessibility tree dumps into concise summaries', () => {
    const longTreeResponse = [
        'Captured accessibility tree:',
        '[1] button "Search"',
        '[2] textbox "Query"',
        '[3] link "Home"',
        '[4] link "About"',
        '[5] link "Contact"',
        '[6] button "Submit"',
        '[7] button "Reset"',
        '[8] link "Help"',
        '[9] link "Terms"',
        '[10] button "Cancel"',
        'Total 10 elements found.'
    ].join('\n');

    const distilled = distillAssistantResponse(longTreeResponse);
    assert.match(distilled, /\[1\] button "Search"/);
    assert.match(distilled, /additional elements omitted/);
    assert.ok(distilled.length < longTreeResponse.length);
});

test('createDistilledTurn packages cleaned prompt, distilled response, importance, and entities', () => {
    const turn = createDistilledTurn({
        userPrompt: 'Voice note transcript:\nUpdate docker-compose.yml for port 5432',
        assistantResponse: 'Updated docker-compose.yml with postgres on port 5432.'
    });

    assert.equal(turn.userPrompt, 'Update docker-compose.yml for port 5432');
    assert.equal(turn.importance, 'high');
    assert.ok(turn.entities.includes('docker-compose.yml'));
    assert.ok(turn.entities.includes('port 5432'));
});
