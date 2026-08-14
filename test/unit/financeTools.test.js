import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFinanceTools } from '../../src/tools/implementations/financeTools.js';

describe('financeTools', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('getStockPrice', () => {
        it('returns error when symbol is missing', async () => {
            const tools = createFinanceTools();
            const res = await tools.getStockPrice({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /symbol ticker is required/i);
        });

        it('fetches and formats stock quote from Yahoo Finance API mock', async () => {
            globalThis.fetch = async (url) => {
                assert.ok(url.includes('query1.finance.yahoo.com/v8/finance/chart/NVDA'));
                return {
                    ok: true,
                    json: async () => ({
                        chart: {
                            result: [
                                {
                                    meta: {
                                        symbol: 'NVDA',
                                        shortName: 'NVIDIA Corporation',
                                        currency: 'USD',
                                        regularMarketPrice: 130.50,
                                        chartPreviousClose: 125.00,
                                        regularMarketDayHigh: 132.00,
                                        regularMarketDayLow: 124.50
                                    }
                                }
                            ]
                        }
                    })
                };
            };

            const tools = createFinanceTools();
            const res = await tools.getStockPrice({ symbol: 'NVDA' });

            assert.equal(res.status, 'Success');
            assert.equal(res.symbol, 'NVDA');
            assert.equal(res.currentPrice, 130.50);
            assert.equal(res.change, 5.50);
            assert.equal(res.changePercent, '+4.4%');
            assert.equal(res.dayHigh, 132.00);
        });
    });

    describe('getCryptoPrice', () => {
        it('fetches crypto price from CoinGecko mock', async () => {
            globalThis.fetch = async (url) => {
                if (url.includes('api.coingecko.com')) {
                    return {
                        ok: true,
                        json: async () => ({
                            bitcoin: {
                                usd: 95000,
                                usd_24h_change: 3.25,
                                usd_market_cap: 1800000000000
                            }
                        })
                    };
                }
                return { ok: false };
            };

            const tools = createFinanceTools();
            const res = await tools.getCryptoPrice({ symbol: 'BTC', vsCurrency: 'usd' });

            assert.equal(res.status, 'Success');
            assert.equal(res.symbol, 'BTC');
            assert.equal(res.price, 95000);
            assert.equal(res.change24hPercent, '+3.25%');
        });
    });

    describe('convertCurrency', () => {
        it('returns error when from or to currency is missing', async () => {
            const tools = createFinanceTools();
            const res = await tools.convertCurrency({ from: 'USD' });
            assert.equal(res.status, 'Error');
            assert.match(res.message, /both "from" and "to"/i);
        });

        it('converts currencies with live exchange rates', async () => {
            globalThis.fetch = async () => ({
                ok: true,
                json: async () => ({
                    rates: {
                        EUR: 0.92,
                        INR: 86.50
                    }
                })
            });

            const tools = createFinanceTools();
            const res = await tools.convertCurrency({ amount: 100, from: 'USD', to: 'EUR' });

            assert.equal(res.status, 'Success');
            assert.equal(res.from, 'USD');
            assert.equal(res.to, 'EUR');
            assert.equal(res.exchangeRate, 0.92);
            assert.equal(res.convertedAmount, 92.00);
        });
    });
});
