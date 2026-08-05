import fs from 'fs';
import path from 'path';

const DEFAULT_MAX_RESULTS = 50;
const MAX_RESULTS_LIMIT = 200;
const DEFAULT_MAX_MATCHES_PER_FILE = 5;
const MAX_MATCHES_PER_FILE_LIMIT = 20;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const IGNORED_DIRECTORY_NAMES = new Set([
    '.git',
    'node_modules',
    '.data',
    'coverage',
    'dist',
    'build',
    'graphify-out'
]);

function clampInteger(value, defaultValue, min, max) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return defaultValue;
    }

    return Math.min(Math.max(Math.trunc(numericValue), min), max);
}

function normalizeExtensions(extensions) {
    if (!Array.isArray(extensions)) {
        return [];
    }

    return extensions
        .map(extension => String(extension).trim().toLowerCase())
        .filter(Boolean)
        .map(extension => (extension.startsWith('.') ? extension : `.${extension}`));
}

function hasAllowedExtension(filePath, extensions) {
    return extensions.length === 0 || extensions.includes(path.extname(filePath).toLowerCase());
}

function assertSearchRoot(rootPath) {
    const stats = fs.statSync(rootPath);

    if (!stats.isDirectory()) {
        throw new Error(`Search root is not a directory: ${rootPath}`);
    }
}

function isIgnoredDirectory(dirent) {
    return dirent.isDirectory() && IGNORED_DIRECTORY_NAMES.has(dirent.name);
}

function formatFileResult(rootPath, filePath, stats) {
    return {
        relativePath: path.relative(rootPath, filePath),
        filePath,
        type: 'file',
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString()
    };
}

function walkDirectory(rootPath, visitEntry) {
    const stack = [rootPath];

    while (stack.length > 0) {
        const currentPath = stack.pop();
        let entries;

        try {
            entries = fs.readdirSync(currentPath, { withFileTypes: true });
        } catch {
            continue;
        }

        entries.sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            if (entry.isSymbolicLink() || isIgnoredDirectory(entry)) {
                continue;
            }

            const entryPath = path.join(currentPath, entry.name);
            visitEntry(entryPath, entry);

            if (entry.isDirectory()) {
                stack.push(entryPath);
            }
        }
    }
}

function isLikelyText(buffer) {
    return !buffer.includes(0);
}

export function createFilesystemTools({ resolveToolPath }) {
    return {
        readFile: ({ filePath }) => {
            const resolvedPath = resolveToolPath(filePath);
            return { content: fs.readFileSync(resolvedPath, 'utf-8') };
        },

        writeFile: ({ filePath, content }) => {
            const resolvedPath = resolveToolPath(filePath);
            fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
            fs.writeFileSync(resolvedPath, content, 'utf-8');
            return { status: 'Success', message: `Successfully updated ${filePath}` };
        },

        listDirectory: ({ directoryPath }) => {
            const resolvedPath = resolveToolPath(directoryPath);
            const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
            const list = items.map(item => {
                const fullItemPath = path.join(resolvedPath, item.name);
                let size = 0;

                try {
                    size = item.isFile() ? fs.statSync(fullItemPath).size : 0;
                } catch {
                    size = 0;
                }

                return {
                    name: item.name,
                    type: item.isDirectory() ? 'directory' : 'file',
                    sizeBytes: size
                };
            });

            return { directoryPath: resolvedPath, items: list };
        },

        searchFiles: ({ query, directoryPath, maxResults, extensions, includeDirectories = false }) => {
            const resolvedPath = resolveToolPath(directoryPath);
            assertSearchRoot(resolvedPath);

            const normalizedQuery = String(query || '').trim().toLowerCase();
            const limit = clampInteger(maxResults, DEFAULT_MAX_RESULTS, 1, MAX_RESULTS_LIMIT);
            const allowedExtensions = normalizeExtensions(extensions);
            const results = [];
            let totalMatches = 0;

            if (!normalizedQuery) {
                return {
                    rootPath: resolvedPath,
                    query: query || '',
                    results,
                    totalMatches,
                    truncated: false
                };
            }

            walkDirectory(resolvedPath, (entryPath, entry) => {
                if (!includeDirectories && entry.isDirectory()) {
                    return;
                }

                if (entry.isFile() && !hasAllowedExtension(entryPath, allowedExtensions)) {
                    return;
                }

                const relativePath = path.relative(resolvedPath, entryPath);
                const searchTarget = `${entry.name}\n${relativePath}`.toLowerCase();

                if (!searchTarget.includes(normalizedQuery)) {
                    return;
                }

                totalMatches += 1;

                if (results.length >= limit) {
                    return;
                }

                let stats;
                try {
                    stats = fs.statSync(entryPath);
                } catch {
                    return;
                }

                results.push({
                    relativePath,
                    filePath: entryPath,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    sizeBytes: entry.isFile() ? stats.size : 0,
                    modifiedAt: stats.mtime.toISOString()
                });
            });

            return {
                rootPath: resolvedPath,
                query,
                results,
                totalMatches,
                truncated: totalMatches > results.length
            };
        },

        searchText: ({ query, directoryPath, maxResults, maxMatchesPerFile, extensions, caseSensitive = false }) => {
            const resolvedPath = resolveToolPath(directoryPath);
            assertSearchRoot(resolvedPath);

            const searchQuery = String(query || '');
            const comparableQuery = caseSensitive ? searchQuery : searchQuery.toLowerCase();
            const limit = clampInteger(maxResults, DEFAULT_MAX_RESULTS, 1, MAX_RESULTS_LIMIT);
            const perFileLimit = clampInteger(maxMatchesPerFile, DEFAULT_MAX_MATCHES_PER_FILE, 1, MAX_MATCHES_PER_FILE_LIMIT);
            const allowedExtensions = normalizeExtensions(extensions);
            const results = [];
            let totalMatches = 0;

            if (!comparableQuery) {
                return {
                    rootPath: resolvedPath,
                    query: searchQuery,
                    results,
                    totalMatches,
                    truncated: false
                };
            }

            walkDirectory(resolvedPath, (entryPath, entry) => {
                if (!entry.isFile() || !hasAllowedExtension(entryPath, allowedExtensions)) {
                    return;
                }

                let stats;
                try {
                    stats = fs.statSync(entryPath);
                } catch {
                    return;
                }

                if (stats.size > MAX_TEXT_FILE_BYTES) {
                    return;
                }

                let content;
                try {
                    const buffer = fs.readFileSync(entryPath);
                    if (!isLikelyText(buffer)) {
                        return;
                    }
                    content = buffer.toString('utf-8');
                } catch {
                    return;
                }

                const lines = content.split(/\r?\n/);
                let matchesInFile = 0;

                for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
                    const line = lines[lineIndex];
                    const comparableLine = caseSensitive ? line : line.toLowerCase();

                    if (!comparableLine.includes(comparableQuery)) {
                        continue;
                    }

                    totalMatches += 1;

                    if (matchesInFile >= perFileLimit || results.length >= limit) {
                        continue;
                    }

                    matchesInFile += 1;
                    results.push({
                        relativePath: path.relative(resolvedPath, entryPath),
                        filePath: entryPath,
                        lineNumber: lineIndex + 1,
                        preview: line.trim().slice(0, 240)
                    });
                }
            });

            return {
                rootPath: resolvedPath,
                query: searchQuery,
                results,
                totalMatches,
                truncated: totalMatches > results.length
            };
        },

        findRecentFiles: ({ directoryPath, maxResults, extensions, sinceHours }) => {
            const resolvedPath = resolveToolPath(directoryPath);
            assertSearchRoot(resolvedPath);

            const limit = clampInteger(maxResults, DEFAULT_MAX_RESULTS, 1, MAX_RESULTS_LIMIT);
            const allowedExtensions = normalizeExtensions(extensions);
            const sinceHoursNumber = Number(sinceHours);
            const hasSinceFilter = Number.isFinite(sinceHoursNumber) && sinceHoursNumber > 0;
            const modifiedSince = hasSinceFilter ? Date.now() - (sinceHoursNumber * 60 * 60 * 1000) : null;
            const matches = [];

            walkDirectory(resolvedPath, (entryPath, entry) => {
                if (!entry.isFile() || !hasAllowedExtension(entryPath, allowedExtensions)) {
                    return;
                }

                let stats;
                try {
                    stats = fs.statSync(entryPath);
                } catch {
                    return;
                }

                if (modifiedSince !== null && stats.mtimeMs < modifiedSince) {
                    return;
                }

                matches.push(formatFileResult(resolvedPath, entryPath, stats));
            });

            matches.sort((left, right) => new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime());

            return {
                rootPath: resolvedPath,
                results: matches.slice(0, limit),
                truncated: matches.length > limit
            };
        }
    };
}
