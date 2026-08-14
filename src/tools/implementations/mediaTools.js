import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

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

function resolveOutputPath({ inputPath, outputPath, suffix = 'converted', targetExt, resolveToolPath }) {
    const resolvedInput = resolveToolPath(inputPath);
    if (outputPath) {
        return resolveToolPath(outputPath);
    }

    const parsed = path.parse(resolvedInput);
    const ext = targetExt || parsed.ext;
    const filename = `${parsed.name}-${suffix}-${Date.now()}${ext.startsWith('.') ? ext : `.${ext}`}`;
    const outputDir = path.dirname(resolvedInput);
    return path.join(outputDir, filename);
}

export function createMediaTools({
    resolveToolPath = p => p,
    execFileFn = execFileAsync
} = {}) {
    async function getMediaInfo({ inputPath }) {
        if (!inputPath) {
            throw new Error('inputPath is required for getMediaInfo.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Media file not found at: ${inputPath}`);
        }

        const env = { ...process.env, PATH: SYSTEM_PATH };
        const args = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            resolvedInput
        ];

        try {
            const { stdout } = await execFileFn('ffprobe', args, { env });
            const data = JSON.parse(stdout);
            const format = data.format || {};
            const streams = data.streams || [];

            const videoStream = streams.find(s => s.codec_type === 'video');
            const audioStream = streams.find(s => s.codec_type === 'audio');

            const result = {
                status: 'Success',
                filePath: resolvedInput,
                formatName: format.format_name,
                durationSeconds: format.duration ? parseFloat(format.duration) : undefined,
                sizeBytes: format.size ? parseInt(format.size, 10) : fs.statSync(resolvedInput).size,
                bitRate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined
            };

            if (videoStream) {
                let fps;
                if (videoStream.r_frame_rate) {
                    const [num, den] = videoStream.r_frame_rate.split('/');
                    if (den && den !== '0') fps = Number((parseInt(num, 10) / parseInt(den, 10)).toFixed(2));
                }

                result.video = {
                    codec: videoStream.codec_name,
                    width: videoStream.width,
                    height: videoStream.height,
                    fps,
                    aspectRatio: videoStream.display_aspect_ratio || (videoStream.width && videoStream.height ? `${videoStream.width}:${videoStream.height}` : undefined),
                    pixelFormat: videoStream.pix_fmt
                };
            }

            if (audioStream) {
                result.audio = {
                    codec: audioStream.codec_name,
                    sampleRate: audioStream.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined,
                    channels: audioStream.channels,
                    channelLayout: audioStream.channel_layout,
                    bitRate: audioStream.bit_rate ? parseInt(audioStream.bit_rate, 10) : undefined
                };
            }

            return result;
        } catch (err) {
            throw new Error(`getMediaInfo failed: ${err.message}`);
        }
    }

    async function convertVideoToAudio({
        inputPath,
        outputPath,
        format = 'mp3',
        audioBitrate = '192k',
        sampleRate
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for convertVideoToAudio.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Video file not found at: ${inputPath}`);
        }

        const normalizedFormat = String(format).toLowerCase().replace(/^\./, '');
        const targetExt = `.${normalizedFormat}`;

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'audio',
            targetExt,
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        const env = { ...process.env, PATH: SYSTEM_PATH };
        const args = ['-y', '-i', resolvedInput, '-vn'];

        switch (normalizedFormat) {
            case 'mp3':
                args.push('-c:a', 'libmp3lame', '-b:a', audioBitrate);
                break;
            case 'm4a':
            case 'aac':
                args.push('-c:a', 'aac', '-b:a', audioBitrate);
                break;
            case 'wav':
                args.push('-c:a', 'pcm_s16le');
                break;
            case 'flac':
                args.push('-c:a', 'flac');
                break;
            case 'ogg':
                args.push('-c:a', 'libvorbis', '-q:a', '6');
                break;
            case 'opus':
                args.push('-c:a', 'libopus', '-b:a', audioBitrate);
                break;
            default:
                args.push('-b:a', audioBitrate);
                break;
        }

        if (sampleRate) {
            args.push('-ar', String(sampleRate));
        }

        args.push(resolvedOutput);

        try {
            await execFileFn('ffmpeg', args, { env });
            const stat = fs.statSync(resolvedOutput);

            return {
                status: 'Success',
                outputPath: resolvedOutput,
                inputPath: resolvedInput,
                format: normalizedFormat.toUpperCase(),
                sizeBytes: stat.size,
                summary: `Successfully extracted audio from ${inputPath} to ${resolvedOutput} (${normalizedFormat.toUpperCase()}, ${(stat.size / 1024).toFixed(1)} KB).`
            };
        } catch (err) {
            throw new Error(`convertVideoToAudio failed: ${err.message}`);
        }
    }

    async function convertMedia({
        inputPath,
        outputPath,
        format,
        videoCodec,
        audioCodec,
        videoBitrate,
        audioBitrate,
        resolution,
        fps,
        startTime,
        duration
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for convertMedia.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Media file not found at: ${inputPath}`);
        }

        const normalizedFormat = format ? String(format).toLowerCase().replace(/^\./, '') : null;
        const targetExt = normalizedFormat ? `.${normalizedFormat}` : path.extname(resolvedInput);

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'converted',
            targetExt,
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        const env = { ...process.env, PATH: SYSTEM_PATH };
        const args = ['-y'];

        if (startTime) {
            args.push('-ss', String(startTime));
        }

        args.push('-i', resolvedInput);

        if (duration) {
            args.push('-t', String(duration));
        }

        if (videoCodec) args.push('-c:v', videoCodec);
        if (audioCodec) args.push('-c:a', audioCodec);
        if (videoBitrate) args.push('-b:v', videoBitrate);
        if (audioBitrate) args.push('-b:a', audioBitrate);
        if (fps) args.push('-r', String(fps));

        if (resolution) {
            // e.g. "1280x720" or "1920:-1"
            const scaleFilter = resolution.includes('x')
                ? `scale=${resolution.replace('x', ':')}`
                : `scale=${resolution}`;
            args.push('-vf', scaleFilter);
        }

        args.push(resolvedOutput);

        try {
            await execFileFn('ffmpeg', args, { env });
            const stat = fs.statSync(resolvedOutput);

            return {
                status: 'Success',
                outputPath: resolvedOutput,
                inputPath: resolvedInput,
                format: path.extname(resolvedOutput).replace('.', '').toUpperCase(),
                sizeBytes: stat.size,
                summary: `Successfully converted media to ${resolvedOutput} (${(stat.size / (1024 * 1024)).toFixed(2)} MB).`
            };
        } catch (err) {
            throw new Error(`convertMedia failed: ${err.message}`);
        }
    }

    async function trimMedia({
        inputPath,
        outputPath,
        startTime = '0',
        endTime,
        duration
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for trimMedia.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Media file not found at: ${inputPath}`);
        }

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'trimmed',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        const env = { ...process.env, PATH: SYSTEM_PATH };
        const args = ['-y', '-ss', String(startTime), '-i', resolvedInput];

        if (endTime) {
            args.push('-to', String(endTime));
        } else if (duration) {
            args.push('-t', String(duration));
        }

        args.push('-c', 'copy', resolvedOutput);

        try {
            await execFileFn('ffmpeg', args, { env });
            const stat = fs.statSync(resolvedOutput);

            return {
                status: 'Success',
                outputPath: resolvedOutput,
                startTime: String(startTime),
                endTime: endTime ? String(endTime) : undefined,
                duration: duration ? String(duration) : undefined,
                sizeBytes: stat.size,
                summary: `Successfully trimmed media (start: ${startTime}, end/dur: ${endTime || duration || 'end'}) to ${resolvedOutput}.`
            };
        } catch (err) {
            throw new Error(`trimMedia failed: ${err.message}`);
        }
    }

    async function compressMedia({
        inputPath,
        outputPath,
        crf = 28,
        preset = 'medium'
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for compressMedia.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Media file not found at: ${inputPath}`);
        }

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'compressed',
            targetExt: '.mp4',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        const env = { ...process.env, PATH: SYSTEM_PATH };
        const args = [
            '-y',
            '-i', resolvedInput,
            '-c:v', 'libx264',
            '-crf', String(crf),
            '-preset', preset,
            '-c:a', 'aac',
            '-b:a', '128k',
            resolvedOutput
        ];

        try {
            const originalSize = fs.statSync(resolvedInput).size;
            await execFileFn('ffmpeg', args, { env });
            const compressedSize = fs.statSync(resolvedOutput).size;

            const reductionPct = ((1 - compressedSize / originalSize) * 100).toFixed(1);

            return {
                status: 'Success',
                outputPath: resolvedOutput,
                originalSizeBytes: originalSize,
                compressedSizeBytes: compressedSize,
                reductionPercent: `${reductionPct}%`,
                summary: `Successfully compressed media from ${(originalSize / (1024 * 1024)).toFixed(2)} MB to ${(compressedSize / (1024 * 1024)).toFixed(2)} MB (${reductionPct}% reduction) at ${resolvedOutput}.`
            };
        } catch (err) {
            throw new Error(`compressMedia failed: ${err.message}`);
        }
    }

    async function videoToGif({
        inputPath,
        outputPath,
        fps = 15,
        width = 480,
        startTime,
        duration
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for videoToGif.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Video file not found at: ${inputPath}`);
        }

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'gif',
            targetExt: '.gif',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        const env = { ...process.env, PATH: SYSTEM_PATH };
        const args = ['-y'];

        if (startTime) {
            args.push('-ss', String(startTime));
        }

        args.push('-i', resolvedInput);

        if (duration) {
            args.push('-t', String(duration));
        }

        const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
        args.push('-vf', filter, resolvedOutput);

        try {
            await execFileFn('ffmpeg', args, { env });
            const stat = fs.statSync(resolvedOutput);

            return {
                status: 'Success',
                outputPath: resolvedOutput,
                width,
                fps,
                sizeBytes: stat.size,
                summary: `Successfully converted video clip to animated GIF at ${resolvedOutput} (${(stat.size / 1024).toFixed(1)} KB).`
            };
        } catch (err) {
            throw new Error(`videoToGif failed: ${err.message}`);
        }
    }

    return {
        getMediaInfo,
        convertVideoToAudio,
        convertMedia,
        trimMedia,
        compressMedia,
        videoToGif
    };
}
