import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createMediaTools } from '../../src/tools/implementations/mediaTools.js';

const execFileAsync = promisify(execFile);
const SYSTEM_PATH = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/Library/Frameworks/Python.framework/Versions/3.14/bin',
    process.env.PATH || ''
].join(':');

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'media-tools-test-'));
}

async function createSyntheticVideo(filePath, durationSec = 2) {
    const env = { ...process.env, PATH: SYSTEM_PATH };
    // Create a simple test video with testsrc and sine audio
    const args = [
        '-y',
        '-f', 'lavfi', '-i', `testsrc=duration=${durationSec}:size=320x240:rate=15`,
        '-f', 'lavfi', '-i', `sine=frequency=1000:duration=${durationSec}`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        filePath
    ];
    await execFileAsync('ffmpeg', args, { env });
    return filePath;
}

test('getMediaInfo inspects media format, streams, duration, and resolution', async () => {
    const tempDir = createTempDir();
    try {
        const videoPath = path.join(tempDir, 'test_video.mp4');
        await createSyntheticVideo(videoPath, 2);

        const tools = createMediaTools({ resolveToolPath: p => p });
        const info = await tools.getMediaInfo({ inputPath: videoPath });

        assert.equal(info.status, 'Success');
        assert.ok(info.durationSeconds >= 1.9 && info.durationSeconds <= 2.2);
        assert.ok(info.video);
        assert.equal(info.video.width, 320);
        assert.equal(info.video.height, 240);
        assert.ok(info.audio);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('convertVideoToAudio extracts MP3 and WAV from video', async () => {
    const tempDir = createTempDir();
    try {
        const videoPath = path.join(tempDir, 'sample.mp4');
        const mp3Out = path.join(tempDir, 'extracted.mp3');
        const wavOut = path.join(tempDir, 'extracted.wav');

        await createSyntheticVideo(videoPath, 2);

        const tools = createMediaTools({ resolveToolPath: p => p });

        const mp3Result = await tools.convertVideoToAudio({
            inputPath: videoPath,
            outputPath: mp3Out,
            format: 'mp3'
        });

        assert.equal(mp3Result.status, 'Success');
        assert.equal(mp3Result.format, 'MP3');
        assert.ok(fs.existsSync(mp3Out));
        assert.ok(fs.statSync(mp3Out).size > 0);

        const wavResult = await tools.convertVideoToAudio({
            inputPath: videoPath,
            outputPath: wavOut,
            format: 'wav'
        });

        assert.equal(wavResult.status, 'Success');
        assert.equal(wavResult.format, 'WAV');
        assert.ok(fs.existsSync(wavOut));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('convertMedia transcodes container, rescales resolution and limits duration', async () => {
    const tempDir = createTempDir();
    try {
        const videoPath = path.join(tempDir, 'sample.mp4');
        const outPath = path.join(tempDir, 'scaled.mkv');
        await createSyntheticVideo(videoPath, 3);

        const tools = createMediaTools({ resolveToolPath: p => p });
        const result = await tools.convertMedia({
            inputPath: videoPath,
            outputPath: outPath,
            resolution: '160x120',
            duration: '1'
        });

        assert.equal(result.status, 'Success');
        assert.ok(fs.existsSync(outPath));

        const info = await tools.getMediaInfo({ inputPath: outPath });
        assert.equal(info.video.width, 160);
        assert.equal(info.video.height, 120);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('trimMedia trims a section of media', async () => {
    const tempDir = createTempDir();
    try {
        const videoPath = path.join(tempDir, 'sample.mp4');
        const outPath = path.join(tempDir, 'trimmed.mp4');
        await createSyntheticVideo(videoPath, 3);

        const tools = createMediaTools({ resolveToolPath: p => p });
        const result = await tools.trimMedia({
            inputPath: videoPath,
            outputPath: outPath,
            startTime: '1',
            duration: '1'
        });

        assert.equal(result.status, 'Success');
        assert.ok(fs.existsSync(outPath));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('compressMedia compresses video file', async () => {
    const tempDir = createTempDir();
    try {
        const videoPath = path.join(tempDir, 'sample.mp4');
        const outPath = path.join(tempDir, 'compressed.mp4');
        await createSyntheticVideo(videoPath, 2);

        const tools = createMediaTools({ resolveToolPath: p => p });
        const result = await tools.compressMedia({
            inputPath: videoPath,
            outputPath: outPath,
            crf: 32,
            preset: 'ultrafast'
        });

        assert.equal(result.status, 'Success');
        assert.ok(fs.existsSync(outPath));
        assert.ok(result.reductionPercent);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('videoToGif converts video snippet to animated GIF', async () => {
    const tempDir = createTempDir();
    try {
        const videoPath = path.join(tempDir, 'sample.mp4');
        const outPath = path.join(tempDir, 'sample.gif');
        await createSyntheticVideo(videoPath, 2);

        const tools = createMediaTools({ resolveToolPath: p => p });
        const result = await tools.videoToGif({
            inputPath: videoPath,
            outputPath: outPath,
            width: 160,
            fps: 10
        });

        assert.equal(result.status, 'Success');
        assert.ok(fs.existsSync(outPath));
        assert.equal(path.extname(outPath), '.gif');
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
