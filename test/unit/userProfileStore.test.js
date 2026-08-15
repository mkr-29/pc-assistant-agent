import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createUserProfileStore } from '../../src/agent/userProfileStore.js';

test('userProfileStore manages profile attributes, facts, and formatted output', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-profile-test-'));
    const filePath = path.join(tempDir, 'user-profile.json');

    try {
        const store = createUserProfileStore({ filePath });
        const initial = store.getProfile();

        assert.equal(initial.name, null);
        assert.equal(initial.preferredBrowser, 'Brave Browser');

        // Update profile
        store.updateProfile({
            name: 'Mayank',
            role: 'Lead Architect',
            location: 'Bangalore',
            email: 'mayank@example.com',
            preferredBrowser: 'Brave Browser',
            defaultWorkspace: '/Users/mkr-27/Desktop/MY/MKR',
            techStack: ['Node.js', 'Python'],
            preferences: { theme: 'dark', music: 'Lo-Fi' }
        });

        const updated = store.getProfile();
        assert.equal(updated.name, 'Mayank');
        assert.equal(updated.role, 'Lead Architect');
        assert.equal(updated.location, 'Bangalore');
        assert.equal(updated.email, 'mayank@example.com');
        assert.deepEqual(updated.techStack, ['Node.js', 'Python']);
        assert.equal(updated.preferences.music, 'Lo-Fi');

        // Add facts
        const fact1 = store.addFact('Works on PC Assistant Agent', 'work');
        const fact2 = store.addFact('Prefers keyboard navigation', 'preference');
        assert.ok(fact1.id);
        assert.equal(fact1.category, 'work');

        // Duplicate fact shouldn't create duplicate
        const fact1Dup = store.addFact('Works on PC Assistant Agent', 'work');
        assert.equal(fact1Dup.id, fact1.id);

        // Search facts
        const matched = store.searchFacts('Assistant');
        assert.equal(matched.length, 1);
        assert.equal(matched[0].text, 'Works on PC Assistant Agent');

        // Format for prompt
        const formatted = store.formatForPrompt();
        assert.match(formatted, /User Name:\*\* Mayank/);
        assert.match(formatted, /Lead Architect/);
        assert.match(formatted, /Brave Browser/);
        assert.match(formatted, /Works on PC Assistant Agent/);

        // Remove fact
        const removed = store.removeFact(fact1.id);
        assert.equal(removed, true);
        assert.equal(store.getProfile().facts.length, 1);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
