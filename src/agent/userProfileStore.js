import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_PROFILE_FILE = path.resolve(process.cwd(), '.data/user-profile.json');

function createEmptyProfile() {
    return {
        name: null,
        role: null,
        location: null,
        email: null,
        preferredBrowser: 'Brave Browser',
        defaultWorkspace: null,
        techStack: [],
        preferences: {},
        facts: [],
        updatedAt: new Date().toISOString()
    };
}

function normalizeStore(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return createEmptyProfile();
    }

    return {
        name: parsed.name ? String(parsed.name).trim() : null,
        role: parsed.role ? String(parsed.role).trim() : null,
        location: parsed.location ? String(parsed.location).trim() : null,
        email: parsed.email ? String(parsed.email).trim() : null,
        preferredBrowser: parsed.preferredBrowser ? String(parsed.preferredBrowser).trim() : 'Brave Browser',
        defaultWorkspace: parsed.defaultWorkspace ? String(parsed.defaultWorkspace).trim() : null,
        techStack: Array.isArray(parsed.techStack) ? parsed.techStack.map(String) : [],
        preferences: (parsed.preferences && typeof parsed.preferences === 'object') ? parsed.preferences : {},
        facts: Array.isArray(parsed.facts)
            ? parsed.facts.filter(f => f && f.text).map(f => ({
                id: f.id || `fact_${crypto.randomUUID().slice(0, 8)}`,
                category: f.category || 'general',
                text: String(f.text).trim(),
                learnedAt: f.learnedAt || new Date().toISOString()
            }))
            : [],
        updatedAt: parsed.updatedAt || new Date().toISOString()
    };
}

export function createUserProfileStore({
    filePath = DEFAULT_PROFILE_FILE,
    now = () => new Date()
} = {}) {
    function readProfile() {
        if (!fs.existsSync(filePath)) {
            return createEmptyProfile();
        }

        try {
            return normalizeStore(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
        } catch (error) {
            console.warn(`[UserProfile] Failed to read user profile file. Starting fresh: ${error.message}`);
            return createEmptyProfile();
        }
    }

    function writeProfile(profile) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const tmpPath = `${filePath}.${process.pid}.tmp`;
        profile.updatedAt = now().toISOString();
        fs.writeFileSync(tmpPath, JSON.stringify(profile, null, 2), 'utf-8');
        fs.renameSync(tmpPath, filePath);
    }

    return {
        getProfile() {
            return readProfile();
        },

        updateProfile(patch = {}) {
            const profile = readProfile();
            if (patch.name !== undefined) profile.name = patch.name ? String(patch.name).trim() : null;
            if (patch.role !== undefined) profile.role = patch.role ? String(patch.role).trim() : null;
            if (patch.location !== undefined) profile.location = patch.location ? String(patch.location).trim() : null;
            if (patch.email !== undefined) profile.email = patch.email ? String(patch.email).trim() : null;
            if (patch.preferredBrowser !== undefined) profile.preferredBrowser = patch.preferredBrowser ? String(patch.preferredBrowser).trim() : 'Brave Browser';
            if (patch.defaultWorkspace !== undefined) profile.defaultWorkspace = patch.defaultWorkspace ? String(patch.defaultWorkspace).trim() : null;

            if (Array.isArray(patch.techStack)) {
                const merged = new Set([...profile.techStack, ...patch.techStack.map(String)]);
                profile.techStack = Array.from(merged);
            }

            if (patch.preferences && typeof patch.preferences === 'object') {
                profile.preferences = {
                    ...profile.preferences,
                    ...patch.preferences
                };
            }

            writeProfile(profile);
            return profile;
        },

        addFact(text, category = 'general') {
            const cleanText = String(text || '').trim();
            if (!cleanText) {
                throw new Error('Fact text must not be empty');
            }

            const profile = readProfile();
            const existing = profile.facts.find(f => f.text.toLowerCase() === cleanText.toLowerCase());
            if (existing) {
                return existing;
            }

            const newFact = {
                id: `fact_${crypto.randomUUID().slice(0, 8)}`,
                category: String(category || 'general').toLowerCase(),
                text: cleanText,
                learnedAt: now().toISOString()
            };

            profile.facts.push(newFact);
            writeProfile(profile);
            return newFact;
        },

        removeFact(idOrText) {
            const profile = readProfile();
            const target = String(idOrText || '').toLowerCase().trim();
            const initialLength = profile.facts.length;
            profile.facts = profile.facts.filter(f => f.id !== idOrText && f.text.toLowerCase() !== target);
            const removed = profile.facts.length < initialLength;
            if (removed) {
                writeProfile(profile);
            }
            return removed;
        },

        searchFacts(query) {
            const profile = readProfile();
            if (!query) return profile.facts;
            const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
            return profile.facts.filter(f => {
                const combined = `${f.category} ${f.text}`.toLowerCase();
                return terms.some(t => combined.includes(t));
            });
        },

        formatForPrompt() {
            const p = readProfile();
            const lines = [];

            if (p.name) lines.push(`- **User Name:** ${p.name}`);
            if (p.role) lines.push(`- **Role/Profession:** ${p.role}`);
            if (p.location) lines.push(`- **Location:** ${p.location}`);
            if (p.email) lines.push(`- **Email:** ${p.email}`);
            if (p.preferredBrowser) lines.push(`- **Preferred Desktop Browser:** ${p.preferredBrowser}`);
            if (p.defaultWorkspace) lines.push(`- **Primary Workspace/Path:** ${p.defaultWorkspace}`);
            if (p.techStack && p.techStack.length > 0) lines.push(`- **Tech Stack:** ${p.techStack.join(', ')}`);

            const prefEntries = Object.entries(p.preferences);
            if (prefEntries.length > 0) {
                lines.push('- **Preferences:**');
                for (const [k, v] of prefEntries) {
                    lines.push(`  - ${k}: ${v}`);
                }
            }

            if (p.facts.length > 0) {
                lines.push('- **Learned Facts:**');
                for (const f of p.facts.slice(-20)) {
                    lines.push(`  - [${f.category}] ${f.text}`);
                }
            }

            if (lines.length === 0) {
                return 'No user profile information recorded yet.';
            }

            return lines.join('\n');
        }
    };
}
