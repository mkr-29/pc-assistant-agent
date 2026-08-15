import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAiWebAgentTools } from '../../src/tools/implementations/aiWebAgentTools.js';

describe('aiWebAgentTools', () => {
    describe('aiWebAgentAct', () => {
        it('returns error when goal is missing', async () => {
            const tools = createAiWebAgentTools();
            const res = await tools.aiWebAgentAct({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /goal string is required/i);
        });

        it('executes autonomous goal loop and finishes with done action', async () => {
            const actionsExecuted = [];
            const mockBrowser = {
                browserNavigate: async (args) => { actionsExecuted.push({ action: 'navigate', ...args }); return { status: 'Success' }; },
                browserSnapshot: async () => ({
                    status: 'Success',
                    url: 'https://store.example.com',
                    title: 'Electronics Store',
                    visibleText: 'Latest Phones in Stock',
                    elements: [{ tag: 'button', text: 'Add to Cart', selector: '#add-cart' }]
                }),
                browserClick: async (args) => { actionsExecuted.push({ action: 'click', ...args }); return { status: 'Success' }; }
            };

            let callCount = 0;
            const mockAi = {
                models: {
                    generateContent: async () => {
                        callCount++;
                        if (callCount === 1) {
                            return { text: JSON.stringify({ action: 'click', selector: '#add-cart', reason: 'Click Add to Cart button' }) };
                        }
                        return { text: JSON.stringify({ action: 'done', finalAnswer: 'Added item to cart successfully' }) };
                    }
                }
            };

            const tools = createAiWebAgentTools({
                browserTools: mockBrowser,
                ai: mockAi
            });

            const res = await tools.aiWebAgentAct({
                goal: 'Add phone to cart',
                url: 'https://store.example.com'
            });

            assert.equal(res.status, 'Success');
            assert.equal(res.completed, true);
            assert.equal(res.finalAnswer, 'Added item to cart successfully');
            assert.equal(actionsExecuted.length, 2); // navigate + click
        });
    });

    describe('aiWebAgentExtract', () => {
        it('extracts structured data using LLM', async () => {
            const mockBrowser = {
                browserNavigate: async () => ({ status: 'Success' }),
                browserExtractPageSemantics: async () => ({
                    status: 'Success',
                    url: 'https://example.com/pricing',
                    title: 'Pricing Plans',
                    data: {
                        mainContent: { text: 'Starter Plan $10/mo, Pro Plan $30/mo, Enterprise $100/mo' }
                    }
                })
            };

            const mockAi = {
                models: {
                    generateContent: async () => ({
                        text: JSON.stringify({
                            plans: [
                                { name: 'Starter', price: '$10/mo' },
                                { name: 'Pro', price: '$30/mo' },
                                { name: 'Enterprise', price: '$100/mo' }
                            ]
                        })
                    })
                }
            };

            const tools = createAiWebAgentTools({
                browserTools: mockBrowser,
                ai: mockAi
            });

            const res = await tools.aiWebAgentExtract({
                instruction: 'Extract all pricing tiers and rates',
                url: 'https://example.com/pricing'
            });

            assert.equal(res.status, 'Success');
            assert.equal(res.data.plans.length, 3);
            assert.equal(res.data.plans[1].name, 'Pro');
        });
    });

    describe('aiWebAgentObserve', () => {
        it('observes actionable elements on the page', async () => {
            const mockBrowser = {
                browserSnapshot: async () => ({
                    status: 'Success',
                    url: 'https://example.com',
                    title: 'Homepage',
                    elements: [
                        { tag: 'input', text: 'Search products', selector: '#search-input' },
                        { tag: 'button', text: 'Sign In', selector: '#sign-in' }
                    ]
                })
            };

            const mockAi = {
                models: {
                    generateContent: async () => ({
                        text: JSON.stringify([
                            { element: 'Search Input', selector: '#search-input', suggestedAction: 'type', confidence: 0.95 }
                        ])
                    })
                }
            };

            const tools = createAiWebAgentTools({
                browserTools: mockBrowser,
                ai: mockAi
            });

            const res = await tools.aiWebAgentObserve({
                instruction: 'Find the search box to query for headphones'
            });

            assert.equal(res.status, 'Success');
            assert.equal(res.totalCandidates, 1);
            assert.equal(res.candidates[0].selector, '#search-input');
        });
    });
});
