import { GoogleGenAI } from '@google/genai';

export function createGeminiClient(config) {
    if (!config.geminiApiKey) {
        return null;
    }

    return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

export async function callGeminiChat({ ai, modelName, messages }) {
    if (!ai) {
        throw new Error('Gemini client is not configured. Set GEMINI_API_KEY to use Gemini models.');
    }

    console.log(`[Gemini SDK] Sending chat request to model ${modelName}...`);

    const contents = messages.map(message => ({
        role: message.role === 'assistant' ? 'model' : message.role,
        parts: [{ text: message.content }]
    }));

    const response = await ai.models.generateContent({
        model: modelName,
        contents
    });

    return response.text;
}

export async function runAgentLoopGemini({
    ai,
    userPrompt,
    systemInstruction,
    toolImplementations,
    geminiTools,
    modelName = 'gemini-2.5-flash'
}) {
    if (!ai) {
        throw new Error('Gemini client is not configured. Set GEMINI_API_KEY to use Gemini models.');
    }

    const contents = [{ role: 'user', parts: [{ text: userPrompt }] }];

    while (true) {
        const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
                systemInstruction,
                tools: geminiTools
            }
        });

        const candidate = response.candidates?.[0];
        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            contents.push(candidate.content);

            const toolResponses = [];
            for (const call of functionCalls) {
                const { name, args, id } = call;
                console.log(`[Agent Action] Calling tool (Gemini): ${name} with args:`, args);

                try {
                    const result = await toolImplementations[name](args);
                    toolResponses.push({
                        functionResponse: { name, response: result, id }
                    });
                } catch (err) {
                    console.error(`[Agent Action Error] Tool ${name} failed:`, err.message);
                    toolResponses.push({
                        functionResponse: { name, response: { error: err.message }, id }
                    });
                }
            }

            contents.push({
                role: 'user',
                parts: toolResponses
            });

            continue;
        }

        return response.text;
    }
}
