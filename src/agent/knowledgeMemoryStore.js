import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_MEMORY_FILE = path.resolve(process.cwd(), '.data/knowledge-memory.json');
const DEFAULT_MAX_ITEMS = 100;
const DEFAULT_MAX_FACT_CHARACTERS = 1000;

function createEmptyStore() {
    return { memories: [] };
}

function createMemoryId() {
    return `mem_${crypto.randomUUID()}`;
}

function truncateText(value, maxLength) {
    const text = String(value || '');
    if (text.length <= maxLength) {
        return text;
    }

    return text.slice(0, maxLength).trimEnd();
}

function normalizeMemory(input, { now, idFactory, maxFactCharacters }) {
    const fact = truncateText(String(input.fact || '').trim(), maxFactCharacters);

    if (!fact) {
        throw new Error('Memory fact must not be empty.');
    }

    const timestamp = now().toISOString();

    return {
        id: input.id || idFactory(),
        fact,
        createdAt: input.createdAt || timestamp,
        updatedAt: timestamp
    };
}

function normalizeStore(parsed) {
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.memories)) {
        return createEmptyStore();
    }

    return {
        memories: parsed.memories
            .filter(memory => memory && typeof memory === 'object' && memory.id && memory.fact)
            .map(memory => ({
                id: String(memory.id),
                fact: String(memory.fact),
                createdAt: memory.createdAt || null,
                updatedAt: memory.updatedAt || memory.createdAt || null
            }))
    };
}

export function createKnowledgeMemoryStore({
    filePath = DEFAULT_MEMORY_FILE,
    maxItems = DEFAULT_MAX_ITEMS,
    maxFactCharacters = DEFAULT_MAX_FACT_CHARACTERS,
    now = () => new Date(),
    idFactory = createMemoryId
} = {}) {
    function readStore() {
        if (!fs.existsSync(filePath)) {
            return createEmptyStore();
        }

        try {
            return normalizeStore(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
        } catch (error) {
            console.warn(`[KnowledgeMemory] Failed to read memory file. Starting fresh: ${error.message}`);
            return createEmptyStore();
        }
    }

    function writeStore(store) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const tmpPath = `${filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
        fs.renameSync(tmpPath, filePath);
    }

    function trimMemories(memories) {
        return memories.slice(-maxItems);
    }

    return {
        listMemories() {
            return readStore().memories;
        },

        addMemory(fact) {
            const store = readStore();
            const memory = normalizeMemory({ fact }, { now, idFactory, maxFactCharacters });
            store.memories = trimMemories([...store.memories, memory]);
            writeStore(store);
            return memory;
        },

        forgetMemory(id) {
            const store = readStore();
            const memoryId = String(id || '').trim();
            const memory = store.memories.find(item => item.id === memoryId) || null;

            if (!memory) {
                return null;
            }

            store.memories = store.memories.filter(item => item.id !== memoryId);
            writeStore(store);
            return memory;
        }
    };
}
