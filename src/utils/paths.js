import os from 'os';
import path from 'path';

export function resolveBasePath(basePath = os.homedir()) {
    if (!basePath) {
        return os.homedir();
    }

    if (basePath.startsWith('~')) {
        return path.join(os.homedir(), basePath.slice(1));
    }

    if (path.isAbsolute(basePath)) {
        return basePath;
    }

    return path.resolve(process.cwd(), basePath);
}

export function resolvePath(filePath, basePath = os.homedir()) {
    const resolvedBasePath = resolveBasePath(basePath);

    if (!filePath) {
        return resolvedBasePath;
    }

    if (filePath.startsWith('~')) {
        return path.join(os.homedir(), filePath.slice(1));
    }

    if (path.isAbsolute(filePath)) {
        return filePath;
    }

    return path.resolve(resolvedBasePath, filePath);
}
