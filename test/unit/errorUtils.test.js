import assert from 'node:assert/strict';
import test from 'node:test';
import { isRateLimitError } from '../../src/llm/errorUtils.js';

test('isRateLimitError recognizes status and code based rate limits', () => {
    assert.equal(isRateLimitError({ status: 429 }), true);
    assert.equal(isRateLimitError({ response: { status: 429 } }), true);
    assert.equal(isRateLimitError({ code: 'RESOURCE_EXHAUSTED' }), true);
});

test('isRateLimitError recognizes Gemini quota messages', () => {
    assert.equal(isRateLimitError(new Error('429 RESOURCE_EXHAUSTED: quota exceeded')), true);
    assert.equal(isRateLimitError(new Error('The request hit a rate limit.')), true);
});

test('isRateLimitError rejects unrelated errors', () => {
    assert.equal(isRateLimitError(new Error('Invalid API key')), false);
    assert.equal(isRateLimitError({ status: 401, message: 'Unauthorized' }), false);
});
