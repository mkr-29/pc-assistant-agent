import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

const execFileAsync = promisify(execFile);

const SYSTEM_PATH = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/Library/Frameworks/Python.framework/Versions/3.14/bin',
    process.env.PATH || ''
].join(':');

function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function sanitizeFilename(name) {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

function extractFilenameFromHeaders(contentDisposition, url) {
    if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        if (match && match[1]) {
            return sanitizeFilename(decodeURIComponent(match[1]));
        }
    }

    try {
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname;
        const basename = path.basename(pathname);
        if (basename && basename.length > 0 && basename.includes('.')) {
            return sanitizeFilename(decodeURIComponent(basename));
        }
    } catch {
        // Fallback
    }

    return `download_${Date.now()}`;
}

export function createDownloadTools({
    resolveToolPath = p => p,
    fetchFn = globalThis.fetch,
    execFileFn = execFileAsync
} = {}) {
    async function downloadFile({
        url,
        outputPath,
        filename,
        timeoutMs = 60000
    }) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            throw new Error('A valid HTTP/HTTPS url is required for downloadFile.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetchFn(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed with HTTP ${response.status}: ${response.statusText}`);
            }

            let resolvedOutput;
            if (outputPath) {
                resolvedOutput = resolveToolPath(outputPath);
                // If outputPath is an existing directory or ends with a slash
                if (fs.existsSync(resolvedOutput) && fs.statSync(resolvedOutput).isDirectory()) {
                    const derivedName = filename || extractFilenameFromHeaders(response.headers.get('content-disposition'), url);
                    resolvedOutput = path.join(resolvedOutput, derivedName);
                }
            } else {
                const derivedName = filename || extractFilenameFromHeaders(response.headers.get('content-disposition'), url);
                const downloadsDir = resolveToolPath('.data/downloads');
                resolvedOutput = path.join(downloadsDir, derivedName);
            }

            ensureDirectoryExists(resolvedOutput);

            if (response.body && typeof response.body.getReader === 'function') {
                const reader = response.body.getReader();
                const writeStream = fs.createWriteStream(resolvedOutput);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    writeStream.write(Buffer.from(value));
                }
                await new Promise((resolve, reject) => {
                    writeStream.end(resolve);
                    writeStream.on('error', reject);
                });
            } else if (response.body && typeof response.body.pipe === 'function') {
                const writeStream = fs.createWriteStream(resolvedOutput);
                await pipeline(response.body, writeStream);
            } else {
                const arrayBuffer = await response.arrayBuffer();
                fs.writeFileSync(resolvedOutput, Buffer.from(arrayBuffer));
            }

            const stat = fs.statSync(resolvedOutput);
            const contentType = response.headers.get('content-type') || 'application/octet-stream';

            return {
                status: 'Success',
                filePath: resolvedOutput,
                url,
                contentType,
                sizeBytes: stat.size,
                summary: `Successfully downloaded file from ${url} to ${resolvedOutput} (${(stat.size / 1024).toFixed(1)} KB).`
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function downloadMedia({
        url,
        outputPath,
        extractAudio = false,
        audioFormat = 'mp3',
        videoQuality = 'best',
        format = 'best'
    }) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            throw new Error('A valid media url is required for downloadMedia.');
        }

        const downloadsDir = resolveToolPath('.data/downloads');
        ensureDirectoryExists(path.join(downloadsDir, 'placeholder.tmp'));

        let targetTemplate;
        if (outputPath) {
            const resolved = resolveToolPath(outputPath);
            if (path.extname(resolved)) {
                targetTemplate = resolved;
            } else {
                targetTemplate = path.join(resolved, '%(title)s.%(ext)s');
            }
        } else {
            targetTemplate = path.join(downloadsDir, '%(title)s.%(ext)s');
        }

        ensureDirectoryExists(targetTemplate.replace(/%\([^)]+\)s/g, 'temp'));

        const args = [
            '--no-playlist',
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=android,web',
            '--print', 'after_move:filepath',
            '--print', 'title',
            '--print', 'duration',
            '-o', targetTemplate
        ];

        if (extractAudio) {
            args.push('-x', '--audio-format', audioFormat, '--audio-quality', '0');
        } else {
            if (videoQuality === 'best') {
                args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
            } else if (videoQuality.includes('p')) {
                const height = videoQuality.replace('p', '');
                args.push('-f', `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}]/best`);
            } else {
                args.push('-f', format || 'best');
            }
        }

        args.push(url);

        try {
            const env = { ...process.env, PATH: SYSTEM_PATH };
            const { stdout } = await execFileFn('yt-dlp', args, { env, maxBuffer: 10 * 1024 * 1024 });

            const lines = stdout.trim().split('\n').filter(Boolean);
            const downloadedPath = lines[lines.length - 3] || lines[0];
            const title = lines[lines.length - 2] || 'Media';
            const durationSec = Number(lines[lines.length - 1]) || undefined;

            let finalPath = downloadedPath;
            if (!fs.existsSync(finalPath)) {
                // If stdout line parsing varied, search directory for newly created file
                const parentDir = path.dirname(targetTemplate.replace(/%\([^)]+\)s/g, ''));
                if (fs.existsSync(parentDir)) {
                    const files = fs.readdirSync(parentDir).map(f => path.join(parentDir, f));
                    files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
                    if (files.length > 0) finalPath = files[0];
                }
            }

            const stat = fs.existsSync(finalPath) ? fs.statSync(finalPath) : { size: 0 };

            return {
                status: 'Success',
                filePath: finalPath,
                title,
                durationSeconds: durationSec,
                extractAudio: Boolean(extractAudio),
                sizeBytes: stat.size,
                summary: `Successfully downloaded media "${title}" to ${finalPath} (${(stat.size / (1024 * 1024)).toFixed(2)} MB).`
            };
        } catch (err) {
            throw new Error(`downloadMedia failed: ${err.message}`);
        }
    }

    return {
        downloadFile,
        downloadMedia
    };
}
