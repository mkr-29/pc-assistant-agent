import { customTools } from '../definitions.js';

export const openAICompatibleTools = customTools.map(tool => ({
    type: 'function',
    function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
    }
}));

export const azureTools = openAICompatibleTools;
