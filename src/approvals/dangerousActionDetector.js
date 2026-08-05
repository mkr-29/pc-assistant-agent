import path from 'path';

const DEFAULT_MANY_FILE_WRITE_THRESHOLD = 5;
const SENSITIVE_PATH_PATTERNS = [
    /(?:^|\/)\.env(?:\.|$)/i,
    /(?:^|\/)\.ssh(?:\/|$)/i,
    /(?:^|\/)credentials(?:\.json)?$/i,
    /(?:^|\/)secrets?(?:\.json|\.yaml|\.yml|\.txt)?$/i,
    /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/i,
    /\.(?:pem|key|p12|pfx)$/i
];

function tokenizeCommand(command) {
    const tokens = [];
    let current = '';
    let quote = null;
    let escaped = false;

    for (const char of String(command || '')) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if ((char === '"' || char === "'") && quote === null) {
            quote = char;
            continue;
        }

        if (char === quote) {
            quote = null;
            continue;
        }

        if (/\s|[;&|()]/.test(char) && quote === null) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (current) {
        tokens.push(current);
    }

    return tokens;
}

function commandDetails(command) {
    const raw = String(command || '').trim();
    const normalized = raw.toLowerCase();
    const tokens = tokenizeCommand(raw);
    const lowerTokens = tokens.map(token => token.toLowerCase());

    return { raw, normalized, tokens, lowerTokens };
}

function hasToken(lowerTokens, values) {
    return lowerTokens.some(token => values.includes(token));
}

function hasOption(lowerTokens, option) {
    return lowerTokens.some(token => token === option || token.startsWith(`${option}`));
}

function hasCommandSequence(lowerTokens, sequence) {
    return lowerTokens.some((_, index) => (
        sequence.every((value, offset) => lowerTokens[index + offset] === value)
    ));
}

function isPackageManagerInstall(lowerTokens) {
    const packageManagerSubcommands = new Map([
        ['npm', ['install', 'i', 'add', 'update', 'upgrade', 'uninstall', 'remove', 'rm']],
        ['yarn', ['add', 'install', 'remove', 'upgrade', 'up']],
        ['pnpm', ['add', 'install', 'update', 'upgrade', 'remove', 'rm']],
        ['bun', ['add', 'install', 'update', 'remove']],
        ['pip', ['install', 'uninstall']],
        ['pip3', ['install', 'uninstall']],
        ['uv', ['add', 'remove', 'sync', 'pip']],
        ['brew', ['install', 'uninstall', 'upgrade', 'update', 'remove']],
        ['apt', ['install', 'remove', 'purge', 'upgrade', 'dist-upgrade']],
        ['apt-get', ['install', 'remove', 'purge', 'upgrade', 'dist-upgrade']],
        ['dnf', ['install', 'remove', 'upgrade']],
        ['yum', ['install', 'remove', 'update']],
        ['gem', ['install', 'uninstall', 'update']],
        ['cargo', ['install', 'uninstall']]
    ]);

    for (let index = 0; index < lowerTokens.length; index += 1) {
        const token = lowerTokens[index];
        const subcommands = packageManagerSubcommands.get(token);

        if (!subcommands) {
            continue;
        }

        if (token === 'uv' && lowerTokens[index + 1] === 'pip') {
            return ['install', 'uninstall'].includes(lowerTokens[index + 2]);
        }

        if (subcommands.includes(lowerTokens[index + 1])) {
            return true;
        }
    }

    return hasCommandSequence(lowerTokens, ['python', '-m', 'pip', 'install'])
        || hasCommandSequence(lowerTokens, ['python3', '-m', 'pip', 'install']);
}

function classifyTerminalCommand(command) {
    const { raw, normalized, lowerTokens } = commandDetails(command);

    if (!raw) {
        return {
            requiresApproval: false,
            category: 'safe',
            reason: 'No command was provided.',
            summary: ''
        };
    }

    if (hasCommandSequence(lowerTokens, ['git', 'reset']) && hasOption(lowerTokens, '--hard')) {
        return approval('deletion', 'git reset --hard can discard local changes.', raw);
    }

    if (hasCommandSequence(lowerTokens, ['git', 'clean'])) {
        return approval('deletion', 'git clean can delete untracked files.', raw);
    }

    if (hasToken(lowerTokens, ['rm', 'rmdir'])) {
        return approval('deletion', 'Deletion command detected.', raw);
    }

    if (hasCommandSequence(lowerTokens, ['find']) && lowerTokens.includes('-delete')) {
        return approval('deletion', 'find -delete can remove many files.', raw);
    }

    if (hasCommandSequence(lowerTokens, ['docker', 'system', 'prune'])
        || hasCommandSequence(lowerTokens, ['docker', 'volume', 'prune'])
        || hasCommandSequence(lowerTokens, ['docker', 'container', 'prune'])
        || hasCommandSequence(lowerTokens, ['docker', 'image', 'prune'])
        || hasCommandSequence(lowerTokens, ['docker', 'rm'])
        || hasCommandSequence(lowerTokens, ['docker', 'rmi'])) {
        return approval('deletion', 'Destructive Docker cleanup command detected.', raw);
    }

    if (isPackageManagerInstall(lowerTokens)) {
        return approval('install', 'Package manager install, update, or uninstall command detected.', raw);
    }

    if (hasToken(lowerTokens, ['kill', 'pkill', 'killall'])
        || hasCommandSequence(lowerTokens, ['docker', 'kill'])
        || hasCommandSequence(lowerTokens, ['docker', 'stop'])
        || hasCommandSequence(lowerTokens, ['docker', 'restart'])
        || (hasToken(lowerTokens, ['fuser']) && hasOption(lowerTokens, '-k'))) {
        return approval('process', 'Process termination command detected.', raw);
    }

    if ((hasToken(lowerTokens, ['sed']) && lowerTokens.some(token => token === '-i' || token.startsWith('-i')))
        || (hasToken(lowerTokens, ['perl']) && lowerTokens.some(token => token.includes('i') && token.startsWith('-p')))
        || (hasToken(lowerTokens, ['find']) && lowerTokens.includes('-exec'))
        || (hasToken(lowerTokens, ['xargs']) && /(rm|sed|perl|mv|cp|chmod|chown)\b/i.test(normalized))
        || (hasToken(lowerTokens, ['rsync']) && lowerTokens.includes('--delete'))
        || (hasToken(lowerTokens, ['chmod', 'chown', 'cp', 'mv']) && hasOption(lowerTokens, '-r'))
        || /\*\*|\*\.[a-z0-9]+|\*\/|\s\*\s/i.test(raw)) {
        return approval('bulk_modification', 'Command may modify many files.', raw);
    }

    return {
        requiresApproval: false,
        category: 'safe',
        reason: 'No dangerous command pattern detected.',
        summary: raw
    };
}

function approval(category, reason, summary) {
    return {
        requiresApproval: true,
        category,
        reason,
        summary
    };
}

function normalizePathForMatching(filePath) {
    return String(filePath || '').replace(/\\/g, '/');
}

function isSensitivePath(filePath) {
    const normalizedPath = normalizePathForMatching(filePath);

    return SENSITIVE_PATH_PATTERNS.some(pattern => pattern.test(normalizedPath));
}

function isOutsideTargetPath(resolvedPath, targetProjectPath) {
    if (!resolvedPath || !targetProjectPath) {
        return false;
    }

    const relativePath = path.relative(targetProjectPath, resolvedPath);
    return relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);
}

function classifyFileWrite({
    filePath,
    resolvedPath,
    targetProjectPath,
    writtenFilePaths,
    manyFileThreshold = DEFAULT_MANY_FILE_WRITE_THRESHOLD,
    bulkWriteApproved = false
} = {}) {
    const summary = resolvedPath || filePath || '';

    if (isSensitivePath(filePath) || isSensitivePath(resolvedPath)) {
        return approval('sensitive_file', 'File path looks like it may contain secrets or credentials.', summary);
    }

    if (isOutsideTargetPath(resolvedPath, targetProjectPath)) {
        return approval('outside_project', 'File write targets a path outside TARGET_PROJECT_PATH.', summary);
    }

    const threshold = Number.isInteger(manyFileThreshold) && manyFileThreshold > 0
        ? manyFileThreshold
        : DEFAULT_MANY_FILE_WRITE_THRESHOLD;
    const writeCount = writtenFilePaths instanceof Set ? writtenFilePaths.size : 0;

    if (!bulkWriteApproved && writeCount + 1 > threshold) {
        return approval('bulk_file_write', `This run is about to write more than ${threshold} distinct files.`, summary);
    }

    return {
        requiresApproval: false,
        category: 'safe',
        reason: 'No risky file-write pattern detected.',
        summary
    };
}

function classifyOpenTerminal({ command } = {}) {
    const trimmedCmd = String(command || '').trim();

    return approval(
        'terminal_execution',
        'Opening a terminal window to run commands requires user approval.',
        trimmedCmd ? `Open Terminal and run: ${trimmedCmd}` : 'Open Terminal window'
    );
}

export {
    classifyTerminalCommand,
    classifyFileWrite,
    classifyOpenTerminal,
    isSensitivePath,
    tokenizeCommand
};
