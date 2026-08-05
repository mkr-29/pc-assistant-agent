import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MAX_OUTPUT_CHARS = 12000;
const MAX_OUTPUT_CHARS = 60000;
const DEFAULT_MAX_DIFF_CHARS = 30000;
const MAX_DIFF_CHARS = 120000;
const GIT_TIMEOUT_MS = 30000;
const SECRET_FILE_PATTERNS = [
    /^\.env(?:\.|$)/,
    /(?:^|\/)\.env(?:\.|$)/,
    /(?:^|\/)credentials(?:\.json)?$/i,
    /(?:^|\/)secrets?(?:\.json|\.yaml|\.yml|\.txt)?$/i,
    /(?:^|\/)id_rsa$/i,
    /\.(?:pem|key|p12|pfx)$/i
];

function clampInteger(value, defaultValue, min, max) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return defaultValue;
    }

    return Math.min(Math.max(Math.trunc(numericValue), min), max);
}

function truncateText(text, maxChars) {
    const normalizedText = text || '';

    if (normalizedText.length <= maxChars) {
        return {
            text: normalizedText,
            truncated: false,
            originalLength: normalizedText.length
        };
    }

    const marker = `\n[truncated ${normalizedText.length - maxChars} characters]\n`;
    const sliceLength = Math.max(0, maxChars - marker.length);

    return {
        text: `${normalizedText.slice(0, sliceLength)}${marker}`,
        truncated: true,
        originalLength: normalizedText.length
    };
}

function assertDirectory(projectPath) {
    const stats = fs.statSync(projectPath);

    if (!stats.isDirectory()) {
        throw new Error(`Project path is not a directory: ${projectPath}`);
    }
}

function readPackageJson(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
}

function buildScriptCommand(scriptName) {
    if (scriptName === 'test') {
        return {
            file: 'npm',
            args: ['test'],
            displayCommand: 'npm test'
        };
    }

    return {
        file: 'npm',
        args: ['run', scriptName],
        displayCommand: `npm run ${scriptName}`
    };
}

function parseCommandOverride(command) {
    const trimmed = String(command || '').trim();

    if (!trimmed) {
        throw new Error('Command override must not be empty.');
    }

    if (/[|&;<>()`$]/.test(trimmed)) {
        throw new Error('Command override cannot contain shell operators.');
    }

    const parts = [];
    let current = '';
    let quote = null;

    for (const char of trimmed) {
        if ((char === '"' || char === "'") && quote === null) {
            quote = char;
            continue;
        }

        if (char === quote) {
            quote = null;
            continue;
        }

        if (/\s/.test(char) && quote === null) {
            if (current) {
                parts.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (quote !== null) {
        throw new Error('Command override contains an unterminated quote.');
    }

    if (current) {
        parts.push(current);
    }

    if (parts.length === 0) {
        throw new Error('Command override must include a command.');
    }

    return {
        file: parts[0],
        args: parts.slice(1),
        displayCommand: trimmed
    };
}

function runCommand({ cwd, file, args = [], displayCommand, timeoutMs, maxOutputChars }) {
    const resolvedTimeoutMs = clampInteger(timeoutMs, DEFAULT_TIMEOUT_MS, 1000, MAX_TIMEOUT_MS);
    const resolvedMaxOutputChars = clampInteger(maxOutputChars, DEFAULT_MAX_OUTPUT_CHARS, 1000, MAX_OUTPUT_CHARS);

    return new Promise(resolve => {
        execFile(
            file,
            args,
            {
                cwd,
                timeout: resolvedTimeoutMs,
                maxBuffer: Math.max(resolvedMaxOutputChars * 4, 1024 * 1024)
            },
            (error, stdout = '', stderr = '') => {
                const truncatedStdout = truncateText(stdout, resolvedMaxOutputChars);
                const truncatedStderr = truncateText(stderr, resolvedMaxOutputChars);
                const timedOut = Boolean(error?.killed || error?.signal === 'SIGTERM');

                resolve({
                    status: !error ? 'passed' : timedOut ? 'timed_out' : 'failed',
                    command: displayCommand || [file, ...args].join(' '),
                    cwd,
                    exitCode: typeof error?.code === 'number' ? error.code : error ? null : 0,
                    signal: error?.signal || null,
                    timedOut,
                    timeoutMs: resolvedTimeoutMs,
                    stdout: truncatedStdout.text,
                    stderr: truncatedStderr.text,
                    truncated: truncatedStdout.truncated || truncatedStderr.truncated,
                    stdoutOriginalLength: truncatedStdout.originalLength,
                    stderrOriginalLength: truncatedStderr.originalLength,
                    error: error ? error.message : null
                });
            }
        );
    });
}

function runGit({ cwd, args, timeoutMs = GIT_TIMEOUT_MS, maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS }) {
    return runCommand({
        cwd,
        file: 'git',
        args,
        displayCommand: `git ${args.join(' ')}`,
        timeoutMs,
        maxOutputChars
    });
}

async function getGitRoot(projectPath) {
    const result = await runGit({
        cwd: projectPath,
        args: ['rev-parse', '--show-toplevel'],
        maxOutputChars: 2000
    });

    if (result.status !== 'passed') {
        return null;
    }

    return result.stdout.trim();
}

function parseGitStatusLines(statusOutput) {
    return statusOutput
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => ({
            status: line.slice(0, 2).trim(),
            path: line.slice(3).trim()
        }));
}

function parseNameStatus(output) {
    return output
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => {
            const [status, ...fileParts] = line.split(/\t/);
            return {
                status,
                path: fileParts.join('\t')
            };
        });
}

function getProjectInfo(projectPath) {
    assertDirectory(projectPath);

    const packageJson = readPackageJson(projectPath);
    const scripts = packageJson?.scripts || {};

    return {
        projectPath,
        packageJson,
        scripts,
        projectTypes: packageJson ? ['node'] : []
    };
}

function buildRunnableScript(projectPath, scriptName, commandOverride) {
    if (commandOverride) {
        return parseCommandOverride(commandOverride);
    }

    const { scripts } = getProjectInfo(projectPath);

    if (!scripts[scriptName]) {
        return null;
    }

    return buildScriptCommand(scriptName);
}

function isSecretPath(filePath) {
    const normalizedPath = String(filePath || '').replace(/\\/g, '/');

    return SECRET_FILE_PATTERNS.some(pattern => pattern.test(normalizedPath));
}

function normalizeCommitFile(filePath, repoRoot) {
    const rawPath = String(filePath || '').trim();

    if (!rawPath) {
        throw new Error('Commit file paths must not be empty.');
    }

    const relativePath = path.isAbsolute(rawPath)
        ? path.relative(repoRoot, rawPath)
        : rawPath;

    if (
        relativePath.startsWith('..')
        || path.isAbsolute(relativePath)
        || relativePath === '.git'
        || relativePath.includes('.git/')
    ) {
        throw new Error(`Refusing to stage file outside the git repository: ${rawPath}`);
    }

    return relativePath;
}

function rejectSecretFiles(files) {
    const secretFiles = files.filter(isSecretPath);

    if (secretFiles.length > 0) {
        return {
            status: 'rejected_secret_files',
            message: 'Refusing to commit files that look like secrets.',
            files: secretFiles
        };
    }

    return null;
}

async function getStagedFiles(projectPath) {
    const result = await runGit({
        cwd: projectPath,
        args: ['diff', '--cached', '--name-only'],
        maxOutputChars: MAX_OUTPUT_CHARS
    });

    if (result.status !== 'passed') {
        return [];
    }

    return result.stdout.split(/\r?\n/).filter(Boolean);
}

export function createProjectTools({ resolveToolPath }) {
    return {
        inspectProject: async ({ projectPath } = {}) => {
            const resolvedPath = resolveToolPath(projectPath);
            const projectInfo = getProjectInfo(resolvedPath);
            const gitRoot = await getGitRoot(resolvedPath);

            return {
                status: 'ok',
                projectPath: resolvedPath,
                projectTypes: projectInfo.projectTypes,
                packageJsonFound: Boolean(projectInfo.packageJson),
                packageName: projectInfo.packageJson?.name || null,
                scripts: projectInfo.scripts,
                suggestedCommands: {
                    test: projectInfo.scripts.test ? 'npm test' : null,
                    lint: projectInfo.scripts.lint ? 'npm run lint' : null
                },
                git: {
                    isRepository: Boolean(gitRoot),
                    root: gitRoot
                }
            };
        },

        runProjectTests: async ({ projectPath, commandOverride, timeoutMs, maxOutputChars } = {}) => {
            const resolvedPath = resolveToolPath(projectPath);
            let command;

            try {
                command = buildRunnableScript(resolvedPath, 'test', commandOverride);
            } catch (error) {
                return {
                    status: 'invalid_command',
                    projectPath: resolvedPath,
                    message: error.message
                };
            }

            if (!command) {
                return {
                    status: 'not_configured',
                    projectPath: resolvedPath,
                    message: 'No test script was found for this project.'
                };
            }

            return runCommand({
                cwd: resolvedPath,
                ...command,
                timeoutMs,
                maxOutputChars
            });
        },

        runProjectLint: async ({ projectPath, commandOverride, timeoutMs, maxOutputChars } = {}) => {
            const resolvedPath = resolveToolPath(projectPath);
            let command;

            try {
                command = buildRunnableScript(resolvedPath, 'lint', commandOverride);
            } catch (error) {
                return {
                    status: 'invalid_command',
                    projectPath: resolvedPath,
                    message: error.message
                };
            }

            if (!command) {
                return {
                    status: 'not_configured',
                    projectPath: resolvedPath,
                    message: 'No lint script was found for this project.'
                };
            }

            return runCommand({
                cwd: resolvedPath,
                ...command,
                timeoutMs,
                maxOutputChars
            });
        },

        getGitStatus: async ({ projectPath } = {}) => {
            const resolvedPath = resolveToolPath(projectPath);
            assertDirectory(resolvedPath);

            const gitRoot = await getGitRoot(resolvedPath);

            if (!gitRoot) {
                return {
                    status: 'not_git_repo',
                    projectPath: resolvedPath,
                    message: 'This directory is not inside a git repository.'
                };
            }

            const [branch, porcelain, unstagedStat, stagedStat] = await Promise.all([
                runGit({ cwd: resolvedPath, args: ['rev-parse', '--abbrev-ref', 'HEAD'], maxOutputChars: 2000 }),
                runGit({ cwd: resolvedPath, args: ['status', '--short'], maxOutputChars: MAX_OUTPUT_CHARS }),
                runGit({ cwd: resolvedPath, args: ['diff', '--stat'], maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS }),
                runGit({ cwd: resolvedPath, args: ['diff', '--cached', '--stat'], maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS })
            ]);

            return {
                status: 'ok',
                projectPath: resolvedPath,
                gitRoot,
                branch: branch.stdout.trim() || null,
                changedFiles: parseGitStatusLines(porcelain.stdout),
                porcelain: porcelain.stdout,
                diffStats: {
                    unstaged: unstagedStat.stdout,
                    staged: stagedStat.stdout
                }
            };
        },

        summarizeGitDiff: async ({ projectPath, scope = 'both', maxDiffChars } = {}) => {
            const resolvedPath = resolveToolPath(projectPath);
            assertDirectory(resolvedPath);

            const gitRoot = await getGitRoot(resolvedPath);

            if (!gitRoot) {
                return {
                    status: 'not_git_repo',
                    projectPath: resolvedPath,
                    message: 'This directory is not inside a git repository.'
                };
            }

            const normalizedScope = ['unstaged', 'staged', 'both'].includes(scope) ? scope : 'both';
            const diffLimit = clampInteger(maxDiffChars, DEFAULT_MAX_DIFF_CHARS, 1000, MAX_DIFF_CHARS);
            const includeUnstaged = normalizedScope === 'unstaged' || normalizedScope === 'both';
            const includeStaged = normalizedScope === 'staged' || normalizedScope === 'both';
            const result = {
                status: 'ok',
                projectPath: resolvedPath,
                gitRoot,
                scope: normalizedScope,
                diffs: {}
            };

            if (includeUnstaged) {
                const [stat, names, diff] = await Promise.all([
                    runGit({ cwd: resolvedPath, args: ['diff', '--stat'], maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS }),
                    runGit({ cwd: resolvedPath, args: ['diff', '--name-status'], maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS }),
                    runGit({ cwd: resolvedPath, args: ['diff'], maxOutputChars: diffLimit })
                ]);

                result.diffs.unstaged = {
                    stat: stat.stdout,
                    files: parseNameStatus(names.stdout),
                    diff: diff.stdout,
                    truncated: diff.truncated
                };
            }

            if (includeStaged) {
                const [stat, names, diff] = await Promise.all([
                    runGit({ cwd: resolvedPath, args: ['diff', '--cached', '--stat'], maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS }),
                    runGit({ cwd: resolvedPath, args: ['diff', '--cached', '--name-status'], maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS }),
                    runGit({ cwd: resolvedPath, args: ['diff', '--cached'], maxOutputChars: diffLimit })
                ]);

                result.diffs.staged = {
                    stat: stat.stdout,
                    files: parseNameStatus(names.stdout),
                    diff: diff.stdout,
                    truncated: diff.truncated
                };
            }

            return result;
        },

        createGitCommit: async ({ projectPath, message, files, confirmed } = {}) => {
            const resolvedPath = resolveToolPath(projectPath);
            assertDirectory(resolvedPath);

            if (!confirmed) {
                return {
                    status: 'confirmation_required',
                    projectPath: resolvedPath,
                    message: 'Explicit user confirmation is required before creating a git commit.'
                };
            }

            const commitMessage = String(message || '').trim();

            if (!commitMessage) {
                return {
                    status: 'invalid_message',
                    projectPath: resolvedPath,
                    message: 'Commit message must not be empty.'
                };
            }

            const gitRoot = await getGitRoot(resolvedPath);

            if (!gitRoot) {
                return {
                    status: 'not_git_repo',
                    projectPath: resolvedPath,
                    message: 'This directory is not inside a git repository.'
                };
            }

            if (Array.isArray(files) && files.length > 0) {
                let normalizedFiles;

                try {
                    normalizedFiles = files.map(filePath => normalizeCommitFile(filePath, gitRoot));
                } catch (error) {
                    return {
                        status: 'invalid_files',
                        projectPath: resolvedPath,
                        message: error.message
                    };
                }

                const secretRejection = rejectSecretFiles(normalizedFiles);

                if (secretRejection) {
                    return {
                        ...secretRejection,
                        projectPath: resolvedPath
                    };
                }

                const addResult = await runGit({
                    cwd: resolvedPath,
                    args: ['add', '--', ...normalizedFiles],
                    maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS
                });

                if (addResult.status !== 'passed') {
                    return {
                        status: 'stage_failed',
                        projectPath: resolvedPath,
                        result: addResult
                    };
                }
            }

            const stagedFiles = await getStagedFiles(resolvedPath);

            if (stagedFiles.length === 0) {
                return {
                    status: 'nothing_staged',
                    projectPath: resolvedPath,
                    message: 'No staged changes are available to commit.'
                };
            }

            const stagedSecretRejection = rejectSecretFiles(stagedFiles);

            if (stagedSecretRejection) {
                return {
                    ...stagedSecretRejection,
                    projectPath: resolvedPath
                };
            }

            const commitResult = await runGit({
                cwd: resolvedPath,
                args: ['commit', '-m', commitMessage],
                timeoutMs: GIT_TIMEOUT_MS,
                maxOutputChars: DEFAULT_MAX_OUTPUT_CHARS
            });

            return {
                status: commitResult.status === 'passed' ? 'committed' : 'failed',
                projectPath: resolvedPath,
                gitRoot,
                files: stagedFiles,
                result: commitResult
            };
        }
    };
}
