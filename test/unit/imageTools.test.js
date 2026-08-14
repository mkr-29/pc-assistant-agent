import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createImageTools } from '../../src/tools/implementations/imageTools.js';

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'image-tools-test-'));
}

async function createSampleImage(filePath, { width = 200, height = 150, color = 'blue' } = {}) {
    const svg = `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="yellow"/></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(filePath);
    return filePath;
}

test('getImageInfo returns metadata for a valid image', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        await createSampleImage(imgPath, { width: 300, height: 200 });

        const tools = createImageTools({ resolveToolPath: p => p });
        const info = await tools.getImageInfo({ inputPath: imgPath });

        assert.equal(info.status, 'Success');
        assert.equal(info.width, 300);
        assert.equal(info.height, 200);
        assert.equal(info.format, 'png');
        assert.equal(info.aspectRatio, 1.5);
        assert.ok(info.sizeBytes > 0);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('getImageInfo throws error if file does not exist', async () => {
    const tools = createImageTools({ resolveToolPath: p => p });
    await assert.rejects(
        () => tools.getImageInfo({ inputPath: '/tmp/nonexistent_image_12345.png' }),
        /Image file not found/
    );
});

test('cropImage extracts the specified region accurately', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        const outPath = path.join(tempDir, 'cropped.png');
        await createSampleImage(imgPath, { width: 400, height: 300 });

        const tools = createImageTools({ resolveToolPath: p => p });
        const result = await tools.cropImage({
            inputPath: imgPath,
            outputPath: outPath,
            left: 50,
            top: 40,
            width: 120,
            height: 100
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.width, 120);
        assert.equal(result.height, 100);
        assert.ok(fs.existsSync(outPath));

        const info = await sharp(outPath).metadata();
        assert.equal(info.width, 120);
        assert.equal(info.height, 100);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('cropImage rejects out-of-bounds crop parameters', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        await createSampleImage(imgPath, { width: 100, height: 100 });

        const tools = createImageTools({ resolveToolPath: p => p });
        await assert.rejects(
            () => tools.cropImage({
                inputPath: imgPath,
                left: 80,
                top: 80,
                width: 50,
                height: 50
            }),
            /exceeds image bounds/
        );
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('resizeImage resizes with width and height', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        const outPath = path.join(tempDir, 'resized.png');
        await createSampleImage(imgPath, { width: 400, height: 200 });

        const tools = createImageTools({ resolveToolPath: p => p });
        const result = await tools.resizeImage({
            inputPath: imgPath,
            outputPath: outPath,
            width: 150,
            height: 100,
            fit: 'fill'
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.width, 150);
        assert.equal(result.height, 100);
        assert.ok(fs.existsSync(outPath));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('rotateImage rotates and flips image', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        const outPath = path.join(tempDir, 'rotated.png');
        await createSampleImage(imgPath, { width: 200, height: 100 });

        const tools = createImageTools({ resolveToolPath: p => p });
        const result = await tools.rotateImage({
            inputPath: imgPath,
            outputPath: outPath,
            angle: 90,
            flip: true
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.width, 100);
        assert.equal(result.height, 200);
        assert.ok(fs.existsSync(outPath));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('adjustImage applies brightness, contrast, and grayscale', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        const outPath = path.join(tempDir, 'adjusted.png');
        await createSampleImage(imgPath, { width: 100, height: 100 });

        const tools = createImageTools({ resolveToolPath: p => p });
        const result = await tools.adjustImage({
            inputPath: imgPath,
            outputPath: outPath,
            brightness: 1.2,
            contrast: 1.1,
            grayscale: true,
            blur: 1
        });

        assert.equal(result.status, 'Success');
        assert.ok(fs.existsSync(outPath));

        const info = await sharp(outPath).metadata();
        assert.equal(info.width, 100);
        assert.equal(info.height, 100);
        assert.equal(info.format, 'png');
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('convertImage converts image format to jpeg and webp', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        const jpegOut = path.join(tempDir, 'converted.jpg');
        const webpOut = path.join(tempDir, 'converted.webp');
        await createSampleImage(imgPath, { width: 100, height: 100 });

        const tools = createImageTools({ resolveToolPath: p => p });

        const jpegResult = await tools.convertImage({
            inputPath: imgPath,
            outputPath: jpegOut,
            format: 'jpeg',
            quality: 85
        });
        assert.equal(jpegResult.format, 'jpeg');
        assert.ok(fs.existsSync(jpegOut));

        const webpResult = await tools.convertImage({
            inputPath: imgPath,
            outputPath: webpOut,
            format: 'webp'
        });
        assert.equal(webpResult.format, 'webp');
        assert.ok(fs.existsSync(webpOut));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('removeImageBackground removes background with mock or transparent fallback', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        const outPath = path.join(tempDir, 'nobg.png');
        await createSampleImage(imgPath, { width: 100, height: 100 });

        // Mock background removal function for lightning-fast deterministic unit test
        const mockRemoveBg = async (input) => {
            const buf = await sharp(input).ensureAlpha().toBuffer();
            return new Blob([buf], { type: 'image/png' });
        };

        const tools = createImageTools({
            resolveToolPath: p => p,
            removeBackgroundFn: mockRemoveBg
        });

        const result = await tools.removeImageBackground({
            inputPath: imgPath,
            outputPath: outPath
        });

        assert.equal(result.status, 'Success');
        assert.ok(fs.existsSync(outPath));
        const meta = await sharp(outPath).metadata();
        assert.equal(meta.format, 'png');
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('removeImageBackground flattens onto backgroundColor if provided', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        const outPath = path.join(tempDir, 'whitebg.png');
        await createSampleImage(imgPath, { width: 100, height: 100 });

        const mockRemoveBg = async (input) => {
            const buf = await sharp(input).ensureAlpha().toBuffer();
            return new Blob([buf], { type: 'image/png' });
        };

        const tools = createImageTools({
            resolveToolPath: p => p,
            removeBackgroundFn: mockRemoveBg
        });

        const result = await tools.removeImageBackground({
            inputPath: imgPath,
            outputPath: outPath,
            backgroundColor: '#ffffff'
        });

        assert.equal(result.status, 'Success');
        assert.ok(fs.existsSync(outPath));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('compositeImages overlays secondary image onto base image', async () => {
    const tempDir = createTempDir();
    try {
        const basePath = path.join(tempDir, 'base.png');
        const overlayPath = path.join(tempDir, 'overlay.png');
        const outPath = path.join(tempDir, 'composited.png');

        await createSampleImage(basePath, { width: 300, height: 200, color: 'blue' });
        await createSampleImage(overlayPath, { width: 50, height: 50, color: 'red' });

        const tools = createImageTools({ resolveToolPath: p => p });
        const result = await tools.compositeImages({
            baseImagePath: basePath,
            overlays: [{ imagePath: overlayPath, left: 20, top: 20 }],
            outputPath: outPath
        });

        assert.equal(result.status, 'Success');
        assert.ok(fs.existsSync(outPath));
        const meta = await sharp(outPath).metadata();
        assert.equal(meta.width, 300);
        assert.equal(meta.height, 200);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('manipulateImage chains crop, resize, adjust, and format conversion', async () => {
    const tempDir = createTempDir();
    try {
        const imgPath = path.join(tempDir, 'sample.png');
        const outPath = path.join(tempDir, 'pipeline_out.webp');
        await createSampleImage(imgPath, { width: 400, height: 400 });

        const tools = createImageTools({ resolveToolPath: p => p });
        const result = await tools.manipulateImage({
            inputPath: imgPath,
            outputPath: outPath,
            crop: { left: 50, top: 50, width: 300, height: 300 },
            resize: { width: 150, height: 150 },
            rotate: { angle: 90 },
            adjust: { brightness: 1.1, contrast: 1.2 },
            format: 'webp',
            quality: 80
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.width, 150);
        assert.equal(result.height, 150);
        assert.equal(result.format, 'webp');
        assert.ok(fs.existsSync(outPath));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('generateImage generates image via Google Imagen SDK when ai is configured', async () => {
    const tempDir = createTempDir();
    try {
        const outPath = path.join(tempDir, 'generated_imagen.png');
        const svg = '<svg width="256" height="256"><circle cx="128" cy="128" r="100" fill="purple"/></svg>';
        const imgBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
        const base64Bytes = imgBuffer.toString('base64');

        let generateImagesCalled = false;
        const mockAi = {
            models: {
                generateImages: async ({ model, prompt, config }) => {
                    generateImagesCalled = true;
                    assert.equal(prompt, 'A cute purple robot');
                    return {
                        generatedImages: [
                            { image: { imageBytes: base64Bytes } }
                        ]
                    };
                }
            }
        };

        const tools = createImageTools({
            resolveToolPath: p => p,
            ai: mockAi
        });

        const result = await tools.generateImage({
            prompt: 'A cute purple robot',
            outputPath: outPath,
            aspectRatio: '1:1',
            width: 256,
            height: 256
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.source, 'Imagen 3');
        assert.equal(generateImagesCalled, true);
        assert.ok(fs.existsSync(outPath));

        const meta = await sharp(outPath).metadata();
        assert.equal(meta.width, 256);
        assert.equal(meta.height, 256);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('generateImage falls back to fetch generator when ai is unavailable', async () => {
    const tempDir = createTempDir();
    try {
        const outPath = path.join(tempDir, 'fallback_gen.jpg');
        const svg = '<svg width="300" height="200"><rect width="100%" height="100%" fill="green"/></svg>';
        const imgBuffer = await sharp(Buffer.from(svg)).jpeg().toBuffer();

        let fetchUrlCalled = null;
        const mockFetch = async (url) => {
            fetchUrlCalled = url;
            return {
                ok: true,
                status: 200,
                arrayBuffer: async () => imgBuffer.buffer
            };
        };

        const tools = createImageTools({
            resolveToolPath: p => p,
            ai: null,
            fetchFn: mockFetch
        });

        const result = await tools.generateImage({
            prompt: 'A serene green forest landscape',
            outputPath: outPath,
            format: 'jpeg'
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.source, 'Pollinations AI Fallback');
        assert.ok(fetchUrlCalled.includes('forest'));
        assert.ok(fs.existsSync(outPath));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('generateImage rejects empty prompt', async () => {
    const tools = createImageTools({ resolveToolPath: p => p });
    await assert.rejects(
        () => tools.generateImage({ prompt: '   ' }),
        /prompt is required/
    );
});

