const CRYPTO_SLUG_MAP = {
    btc: 'bitcoin',
    bitcoin: 'bitcoin',
    eth: 'ethereum',
    ethereum: 'ethereum',
    sol: 'solana',
    solana: 'solana',
    doge: 'dogecoin',
    dogecoin: 'dogecoin',
    xrp: 'ripple',
    ripple: 'ripple',
    ada: 'cardano',
    cardano: 'cardano',
    bnb: 'binancecoin',
    binancecoin: 'binancecoin'
};

export function createFinanceTools() {
    return {
        getStockPrice: async ({ symbol } = {}) => {
            if (!symbol || typeof symbol !== 'string') {
                return { status: 'Error', message: 'A stock symbol ticker is required (e.g. "AAPL", "NVDA", "MSFT").' };
            }

            const cleanSymbol = symbol.trim().toUpperCase();

            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?interval=1d&range=1d`;
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PCAssistantBot/1.0)' }
                });

                if (!response.ok) {
                    return {
                        status: 'Error',
                        statusCode: response.status,
                        message: `Failed to fetch stock quote for '${cleanSymbol}': HTTP ${response.status}`
                    };
                }

                const data = await response.json();
                const result = data.chart?.result?.[0];

                if (!result) {
                    return {
                        status: 'Error',
                        message: `No market data returned for symbol '${cleanSymbol}'. Check if the ticker symbol is valid.`
                    };
                }

                const meta = result.meta || {};
                const currentPrice = meta.regularMarketPrice ?? meta.chartPreviousClose;
                const previousClose = meta.previousClose ?? meta.chartPreviousClose;
                const change = currentPrice && previousClose ? +(currentPrice - previousClose).toFixed(2) : 0;
                const changePercent = previousClose ? +((change / previousClose) * 100).toFixed(2) : 0;

                return {
                    status: 'Success',
                    symbol: cleanSymbol,
                    shortName: meta.shortName || cleanSymbol,
                    currency: meta.currency || 'USD',
                    exchangeName: meta.exchangeName || '',
                    currentPrice,
                    previousClose,
                    change,
                    changePercent: `${changePercent > 0 ? '+' : ''}${changePercent}%`,
                    dayHigh: meta.regularMarketDayHigh || null,
                    dayLow: meta.regularMarketDayLow || null,
                    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
                    fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
                    marketState: meta.marketState || 'REGULAR'
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to get stock quote for '${cleanSymbol}': ${error.message}`
                };
            }
        },

        getCryptoPrice: async ({ symbol, vsCurrency = 'usd' } = {}) => {
            if (!symbol || typeof symbol !== 'string') {
                return { status: 'Error', message: 'A cryptocurrency symbol or name is required (e.g. "BTC", "ETH", "SOL", "bitcoin").' };
            }

            const inputKey = symbol.trim().toLowerCase();
            const coinId = CRYPTO_SLUG_MAP[inputKey] || inputKey;
            const targetVs = (vsCurrency || 'usd').trim().toLowerCase();

            try {
                // Strategy 1: CoinGecko API
                const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(targetVs)}&include_24hr_change=true&include_market_cap=true`;
                const cgRes = await fetch(cgUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PCAssistantBot/1.0)' }
                });

                if (cgRes.ok) {
                    const data = await cgRes.json();
                    const coinData = data[coinId];

                    if (coinData && coinData[targetVs] !== undefined) {
                        const price = coinData[targetVs];
                        const change24h = coinData[`${targetVs}_24h_change`];
                        const marketCap = coinData[`${targetVs}_market_cap`];

                        return {
                            status: 'Success',
                            symbol: symbol.toUpperCase(),
                            name: coinId,
                            vsCurrency: targetVs.toUpperCase(),
                            price,
                            change24hPercent: change24h ? `${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%` : null,
                            marketCap: marketCap ? Math.round(marketCap) : null
                        };
                    }
                }
            } catch {
                // Fallback to Yahoo Finance
            }

            // Strategy 2: Yahoo Finance Crypto Ticker (e.g. BTC-USD, ETH-USD)
            try {
                const ySymbol = `${symbol.toUpperCase()}-${targetVs.toUpperCase()}`;
                const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=1d&range=1d`;
                const yRes = await fetch(yUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PCAssistantBot/1.0)' }
                });

                if (yRes.ok) {
                    const data = await yRes.json();
                    const meta = data.chart?.result?.[0]?.meta;
                    if (meta && meta.regularMarketPrice) {
                        const price = meta.regularMarketPrice;
                        const prev = meta.previousClose || price;
                        const changePercent = prev ? +(((price - prev) / prev) * 100).toFixed(2) : 0;

                        return {
                            status: 'Success',
                            symbol: symbol.toUpperCase(),
                            vsCurrency: targetVs.toUpperCase(),
                            price,
                            change24hPercent: `${changePercent > 0 ? '+' : ''}${changePercent}%`,
                            dayHigh: meta.regularMarketDayHigh || null,
                            dayLow: meta.regularMarketDayLow || null
                        };
                    }
                }
            } catch {
                // Return clear error below
            }

            return {
                status: 'Error',
                message: `Could not retrieve cryptocurrency price for '${symbol}'. Check the symbol or try full coin name (e.g. "bitcoin", "ethereum").`
            };
        },

        convertCurrency: async ({ amount = 1, from, to } = {}) => {
            if (!from || !to) {
                return { status: 'Error', message: 'Both "from" and "to" currency codes are required (e.g. from: "USD", to: "EUR").' };
            }

            const fromCode = String(from).trim().toUpperCase();
            const toCode = String(to).trim().toUpperCase();
            const safeAmount = Number(amount) || 1;

            try {
                const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(fromCode)}`;
                const response = await fetch(url);

                if (!response.ok) {
                    return {
                        status: 'Error',
                        statusCode: response.status,
                        message: `Failed to fetch exchange rates for base currency '${fromCode}'`
                    };
                }

                const data = await response.json();
                const rate = data.rates?.[toCode];

                if (!rate) {
                    return {
                        status: 'Error',
                        message: `Exchange rate not found for currency pair '${fromCode}' to '${toCode}'.`
                    };
                }

                const convertedAmount = +(safeAmount * rate).toFixed(4);

                return {
                    status: 'Success',
                    amount: safeAmount,
                    from: fromCode,
                    to: toCode,
                    exchangeRate: rate,
                    convertedAmount,
                    lastUpdateUtc: data.time_last_update_utc || null,
                    summary: `${safeAmount} ${fromCode} = ${convertedAmount} ${toCode} (rate: 1 ${fromCode} = ${rate} ${toCode})`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Currency conversion error: ${error.message}`
                };
            }
        }
    };
}
