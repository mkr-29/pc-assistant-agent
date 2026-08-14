import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';

function resolveOutputPath({ inputPath, outputPath, suffix = 'edited', defaultExt, resolveToolPath }) {
    const resolvedInput = resolveToolPath(inputPath);
    if (outputPath) {
        return resolveToolPath(outputPath);
    }

    const parsed = path.parse(resolvedInput);
    const ext = defaultExt || parsed.ext || '.png';
    const filename = `${parsed.name}-${suffix}-${Date.now()}${ext}`;
    const outputDir = path.dirname(resolvedInput);
    return path.join(outputDir, filename);
}

function ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function createImageTools({
    resolveToolPath = p => p,
    ai = null,
    config = {},
    sharpInstance = sharp,
    removeBackgroundFn = removeBackground,
    fetchFn = globalThis.fetch
} = {}) {
    async function generateImage({
        prompt,
        outputPath,
        aspectRatio = '1:1',
        width,
        height,
        format = 'png',
        model = 'imagen-3.0-generate-002'
    }) {
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            throw new Error('prompt is required for generateImage.');
        }

        const normalizedFormat = String(format).toLowerCase().replace(/^\./, '');
        const targetExt = `.${normalizedFormat === 'jpeg' ? 'jpg' : normalizedFormat}`;

        let resolvedOutput;
        if (outputPath) {
            resolvedOutput = resolveToolPath(outputPath);
        } else {
            const baseDir = resolveToolPath('.data/generated_images');
            const filename = `generated-${Date.now()}${targetExt}`;
            resolvedOutput = path.join(baseDir, filename);
        }

        ensureDirectoryExists(resolvedOutput);

        let imageBuffer = null;
        let generationSource = 'Imagen 3';

        if (ai?.models?.generateImages) {
            try {
                const mimeType = normalizedFormat === 'jpg' || normalizedFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
                const response = await ai.models.generateImages({
                    model,
                    prompt: prompt.trim(),
                    config: {
                        numberOfImages: 1,
                        outputMimeType: mimeType,
                        aspectRatio
                    }
                });

                const base64Bytes = response?.generatedImages?.[0]?.image?.imageBytes;
                if (base64Bytes) {
                    imageBuffer = Buffer.from(base64Bytes, 'base64');
                }
            } catch (err) {
                console.warn(`[Image Generation] Google Imagen generation failed: ${err.message}. Trying fallback generator...`);
            }
        }

        if (!imageBuffer) {
            generationSource = 'Pollinations AI Fallback';
            const [aspectW, aspectH] = aspectRatio === '16:9' ? [1280, 720]
                : aspectRatio === '9:16' ? [720, 1280]
                : aspectRatio === '4:3' ? [1024, 768]
                : aspectRatio === '3:4' ? [768, 1024]
                : [1024, 1024];

            const targetW = width ? Math.round(Number(width)) : aspectW;
            const targetH = height ? Math.round(Number(height)) : aspectH;
            const seed = Math.floor(Math.random() * 1000000);
            const encodedPrompt = encodeURIComponent(prompt.trim());
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${targetW}&height=${targetH}&seed=${seed}&nologo=true`;

            const res = await fetchFn(url);
            if (!res.ok) {
                throw new Error(`Image generation failed with HTTP status ${res.status}: ${res.statusText}`);
            }
            const arrayBuf = await res.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuf);
        }

        let pipeline = sharpInstance(imageBuffer);

        if (width || height) {
            pipeline = pipeline.resize({
                width: width ? Math.round(Number(width)) : undefined,
                height: height ? Math.round(Number(height)) : undefined,
                fit: 'cover'
            });
        }

        switch (normalizedFormat) {
            case 'jpg':
            case 'jpeg':
                pipeline = pipeline.jpeg({ quality: 90 });
                break;
            case 'png':
                pipeline = pipeline.png();
                break;
            case 'webp':
                pipeline = pipeline.webp({ quality: 90 });
                break;
            default:
                break;
        }

        await pipeline.toFile(resolvedOutput);

        const meta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: meta.width,
            height: meta.height,
            format: meta.format,
            sizeBytes: stat.size,
            prompt: prompt.trim(),
            source: generationSource,
            summary: `Successfully generated image for prompt "${prompt.trim()}" and saved to ${resolvedOutput} (${meta.width}x${meta.height}, ${meta.format.toUpperCase()}, ${generationSource}).`
        };
    }

    async function getImageInfo({ inputPath }) {
        if (!inputPath) {
            throw new Error('inputPath is required for getImageInfo.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Image file not found at: ${inputPath}`);
        }

        const metadata = await sharpInstance(resolvedInput).metadata();
        const stat = fs.statSync(resolvedInput);

        return {
            status: 'Success',
            filePath: resolvedInput,
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            space: metadata.space,
            channels: metadata.channels,
            depth: metadata.depth,
            density: metadata.density,
            hasAlpha: Boolean(metadata.hasAlpha),
            orientation: metadata.orientation,
            sizeBytes: stat.size,
            aspectRatio: metadata.width && metadata.height
                ? Number((metadata.width / metadata.height).toFixed(3))
                : undefined
        };
    }

    async function cropImage({ inputPath, outputPath, left, top, width, height }) {
        if (!inputPath) {
            throw new Error('inputPath is required for cropImage.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Image file not found at: ${inputPath}`);
        }

        if (width === undefined || height === undefined) {
            throw new Error('width and height are required for cropImage.');
        }

        const cropLeft = Math.max(0, Math.round(Number(left) || 0));
        const cropTop = Math.max(0, Math.round(Number(top) || 0));
        const cropWidth = Math.round(Number(width));
        const cropHeight = Math.round(Number(height));

        if (cropWidth <= 0 || cropHeight <= 0) {
            throw new Error(`Invalid crop dimensions: width (${cropWidth}) and height (${cropHeight}) must be positive integers.`);
        }

        const metadata = await sharpInstance(resolvedInput).metadata();
        if (cropLeft + cropWidth > metadata.width || cropTop + cropHeight > metadata.height) {
            throw new Error(
                `Crop rectangle [left: ${cropLeft}, top: ${cropTop}, width: ${cropWidth}, height: ${cropHeight}] ` +
                `exceeds image bounds [width: ${metadata.width}, height: ${metadata.height}].`
            );
        }

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'cropped',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        await sharpInstance(resolvedInput)
            .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
            .toFile(resolvedOutput);

        const outMeta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: outMeta.width,
            height: outMeta.height,
            format: outMeta.format,
            sizeBytes: stat.size,
            summary: `Successfully cropped image to ${outMeta.width}x${outMeta.height} at ${resolvedOutput}.`
        };
    }

    async function resizeImage({
        inputPath,
        outputPath,
        width,
        height,
        fit = 'cover',
        position = 'center',
        background,
        withoutEnlargement = false
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for resizeImage.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Image file not found at: ${inputPath}`);
        }

        if (!width && !height) {
            throw new Error('At least one of width or height must be provided for resizeImage.');
        }

        const targetWidth = width ? Math.round(Number(width)) : null;
        const targetHeight = height ? Math.round(Number(height)) : null;

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'resized',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        const resizeOptions = {
            width: targetWidth || undefined,
            height: targetHeight || undefined,
            fit,
            position,
            withoutEnlargement: Boolean(withoutEnlargement)
        };

        if (background) {
            resizeOptions.background = background;
        }

        await sharpInstance(resolvedInput)
            .resize(resizeOptions)
            .toFile(resolvedOutput);

        const outMeta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: outMeta.width,
            height: outMeta.height,
            format: outMeta.format,
            sizeBytes: stat.size,
            summary: `Successfully resized image to ${outMeta.width}x${outMeta.height} at ${resolvedOutput}.`
        };
    }

    async function rotateImage({
        inputPath,
        outputPath,
        angle = 0,
        flip = false,
        flop = false,
        background = '#00000000'
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for rotateImage.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Image file not found at: ${inputPath}`);
        }

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'rotated',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        let pipeline = sharpInstance(resolvedInput).rotate(Number(angle) || 0, { background });

        if (flip) {
            pipeline = pipeline.flip();
        }
        if (flop) {
            pipeline = pipeline.flop();
        }

        await pipeline.toFile(resolvedOutput);

        const outMeta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: outMeta.width,
            height: outMeta.height,
            format: outMeta.format,
            sizeBytes: stat.size,
            summary: `Successfully rotated/flipped image (angle: ${angle}, flip: ${flip}, flop: ${flop}) to ${resolvedOutput}.`
        };
    }

    async function adjustImage({
        inputPath,
        outputPath,
        brightness,
        saturation,
        hue,
        contrast,
        gamma,
        grayscale = false,
        invert = false,
        blur,
        sharpen,
        tint
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for adjustImage.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Image file not found at: ${inputPath}`);
        }

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'adjusted',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        let pipeline = sharpInstance(resolvedInput);

        const modulateOptions = {};
        if (brightness !== undefined) modulateOptions.brightness = Number(brightness);
        if (saturation !== undefined) modulateOptions.saturation = Number(saturation);
        if (hue !== undefined) modulateOptions.hue = Number(hue);

        if (Object.keys(modulateOptions).length > 0) {
            pipeline = pipeline.modulate(modulateOptions);
        }

        if (contrast !== undefined) {
            const factor = Number(contrast);
            pipeline = pipeline.linear(factor, -(128 * factor) + 128);
        }

        if (gamma !== undefined) {
            pipeline = pipeline.gamma(Number(gamma));
        }

        if (grayscale) {
            pipeline = pipeline.grayscale();
        }

        if (invert) {
            pipeline = pipeline.negate();
        }

        if (blur !== undefined && blur !== false) {
            const sigma = blur === true ? 2 : Number(blur);
            pipeline = pipeline.blur(sigma);
        }

        if (sharpen !== undefined && sharpen !== false) {
            const sigma = sharpen === true ? 1 : Number(sharpen);
            pipeline = pipeline.sharpen(sigma);
        }

        if (tint) {
            pipeline = pipeline.tint(tint);
        }

        await pipeline.toFile(resolvedOutput);

        const outMeta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: outMeta.width,
            height: outMeta.height,
            format: outMeta.format,
            sizeBytes: stat.size,
            summary: `Successfully applied image adjustments and saved to ${resolvedOutput}.`
        };
    }

    async function convertImage({
        inputPath,
        outputPath,
        format = 'png',
        quality = 90,
        lossless = false
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for convertImage.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Image file not found at: ${inputPath}`);
        }

        const normalizedFormat = String(format).toLowerCase().replace(/^\./, '');
        const targetExt = `.${normalizedFormat === 'jpeg' ? 'jpg' : normalizedFormat}`;

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'converted',
            defaultExt: targetExt,
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        let pipeline = sharpInstance(resolvedInput);

        const q = Math.max(1, Math.min(100, Math.round(Number(quality) || 90)));

        switch (normalizedFormat) {
            case 'jpg':
            case 'jpeg':
                pipeline = pipeline.jpeg({ quality: q });
                break;
            case 'png':
                pipeline = pipeline.png({ quality: q, compressionLevel: 9 });
                break;
            case 'webp':
                pipeline = pipeline.webp({ quality: q, lossless: Boolean(lossless) });
                break;
            case 'avif':
                pipeline = pipeline.avif({ quality: q, lossless: Boolean(lossless) });
                break;
            case 'tiff':
                pipeline = pipeline.tiff({ quality: q });
                break;
            case 'gif':
                pipeline = pipeline.gif();
                break;
            default:
                throw new Error(`Unsupported output format: ${format}. Supported formats: png, jpeg, webp, avif, tiff, gif.`);
        }

        await pipeline.toFile(resolvedOutput);

        const outMeta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: outMeta.width,
            height: outMeta.height,
            format: outMeta.format,
            sizeBytes: stat.size,
            summary: `Successfully converted image to ${normalizedFormat.toUpperCase()} at ${resolvedOutput}.`
        };
    }

    async function removeImageBackground({
        inputPath,
        outputPath,
        backgroundColor
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for removeImageBackground.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Image file not found at: ${inputPath}`);
        }

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'nobg',
            defaultExt: '.png',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        const blob = await removeBackgroundFn(resolvedInput);
        const arrayBuffer = await blob.arrayBuffer();
        const rawBuffer = Buffer.from(arrayBuffer);

        if (backgroundColor) {
            await sharpInstance(rawBuffer)
                .flatten({ background: backgroundColor })
                .png()
                .toFile(resolvedOutput);
        } else {
            await sharpInstance(rawBuffer)
                .png()
                .toFile(resolvedOutput);
        }

        const outMeta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: outMeta.width,
            height: outMeta.height,
            format: outMeta.format,
            sizeBytes: stat.size,
            summary: `Successfully removed background and saved transparent PNG to ${resolvedOutput}.`
        };
    }

    async function compositeImages({
        baseImagePath,
        overlays = [],
        outputPath
    }) {
        if (!baseImagePath) {
            throw new Error('baseImagePath is required for compositeImages.');
        }

        const resolvedBase = resolveToolPath(baseImagePath);
        if (!fs.existsSync(resolvedBase)) {
            throw new Error(`Base image file not found at: ${baseImagePath}`);
        }

        if (!Array.isArray(overlays) || overlays.length === 0) {
            throw new Error('overlays array must contain at least one overlay object with imagePath.');
        }

        const resolvedOutput = resolveOutputPath({
            inputPath: baseImagePath,
            outputPath,
            suffix: 'composited',
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        const processedOverlays = [];
        for (const item of overlays) {
            if (!item.imagePath) {
                throw new Error('Each overlay must specify imagePath.');
            }
            const overlayPath = resolveToolPath(item.imagePath);
            if (!fs.existsSync(overlayPath)) {
                throw new Error(`Overlay image file not found at: ${item.imagePath}`);
            }

            const overlayConfig = {
                input: overlayPath
            };

            if (item.left !== undefined) overlayConfig.left = Math.round(Number(item.left));
            if (item.top !== undefined) overlayConfig.top = Math.round(Number(item.top));
            if (item.gravity) overlayConfig.gravity = item.gravity;
            if (item.blend) overlayConfig.blend = item.blend;

            processedOverlays.push(overlayConfig);
        }

        await sharpInstance(resolvedBase)
            .composite(processedOverlays)
            .toFile(resolvedOutput);

        const outMeta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: outMeta.width,
            height: outMeta.height,
            format: outMeta.format,
            sizeBytes: stat.size,
            summary: `Successfully composited ${overlays.length} layer(s) onto ${resolvedOutput}.`
        };
    }

    async function manipulateImage({
        inputPath,
        outputPath,
        removeBackground: doRemoveBackground = false,
        backgroundColor,
        crop,
        resize,
        rotate,
        adjust,
        format,
        quality = 90,
        trim = false
    }) {
        if (!inputPath) {
            throw new Error('inputPath is required for manipulateImage.');
        }

        const resolvedInput = resolveToolPath(inputPath);
        if (!fs.existsSync(resolvedInput)) {
            throw new Error(`Image file not found at: ${inputPath}`);
        }

        let currentBuffer;

        if (doRemoveBackground) {
            const blob = await removeBackgroundFn(resolvedInput);
            currentBuffer = Buffer.from(await blob.arrayBuffer());
        } else {
            currentBuffer = fs.readFileSync(resolvedInput);
        }

        let pipeline = sharpInstance(currentBuffer);

        if (crop && typeof crop === 'object') {
            const { left = 0, top = 0, width, height } = crop;
            if (width && height) {
                pipeline = pipeline.extract({
                    left: Math.max(0, Math.round(Number(left) || 0)),
                    top: Math.max(0, Math.round(Number(top) || 0)),
                    width: Math.round(Number(width)),
                    height: Math.round(Number(height))
                });
            }
        }

        if (resize && typeof resize === 'object') {
            const { width, height, fit = 'cover', position = 'center', background, withoutEnlargement } = resize;
            if (width || height) {
                const resizeOpts = {
                    width: width ? Math.round(Number(width)) : undefined,
                    height: height ? Math.round(Number(height)) : undefined,
                    fit,
                    position,
                    withoutEnlargement: Boolean(withoutEnlargement)
                };
                if (background) resizeOpts.background = background;
                pipeline = pipeline.resize(resizeOpts);
            }
        }

        if (rotate) {
            const angle = typeof rotate === 'number' ? rotate : (Number(rotate?.angle) || 0);
            pipeline = pipeline.rotate(angle);
            if (rotate?.flip) pipeline = pipeline.flip();
            if (rotate?.flop) pipeline = pipeline.flop();
        }

        if (trim) {
            pipeline = pipeline.trim();
        }

        if (adjust && typeof adjust === 'object') {
            const modulateOpts = {};
            if (adjust.brightness !== undefined) modulateOpts.brightness = Number(adjust.brightness);
            if (adjust.saturation !== undefined) modulateOpts.saturation = Number(adjust.saturation);
            if (adjust.hue !== undefined) modulateOpts.hue = Number(adjust.hue);

            if (Object.keys(modulateOpts).length > 0) {
                pipeline = pipeline.modulate(modulateOpts);
            }

            if (adjust.contrast !== undefined) {
                const factor = Number(adjust.contrast);
                pipeline = pipeline.linear(factor, -(128 * factor) + 128);
            }

            if (adjust.grayscale) {
                pipeline = pipeline.grayscale();
            }

            if (adjust.invert) {
                pipeline = pipeline.negate();
            }

            if (adjust.blur) {
                pipeline = pipeline.blur(adjust.blur === true ? 2 : Number(adjust.blur));
            }

            if (adjust.sharpen) {
                pipeline = pipeline.sharpen(adjust.sharpen === true ? 1 : Number(adjust.sharpen));
            }
        }

        if (backgroundColor) {
            pipeline = pipeline.flatten({ background: backgroundColor });
        }

        const normalizedFormat = format ? String(format).toLowerCase().replace(/^\./, '') : null;
        const targetExt = normalizedFormat ? `.${normalizedFormat === 'jpeg' ? 'jpg' : normalizedFormat}` : undefined;

        const resolvedOutput = resolveOutputPath({
            inputPath,
            outputPath,
            suffix: 'manipulated',
            defaultExt: targetExt || (doRemoveBackground ? '.png' : undefined),
            resolveToolPath
        });

        ensureDirectoryExists(resolvedOutput);

        if (normalizedFormat) {
            const q = Math.max(1, Math.min(100, Math.round(Number(quality) || 90)));
            switch (normalizedFormat) {
                case 'jpg':
                case 'jpeg':
                    pipeline = pipeline.jpeg({ quality: q });
                    break;
                case 'png':
                    pipeline = pipeline.png({ quality: q });
                    break;
                case 'webp':
                    pipeline = pipeline.webp({ quality: q });
                    break;
                case 'avif':
                    pipeline = pipeline.avif({ quality: q });
                    break;
                case 'tiff':
                    pipeline = pipeline.tiff({ quality: q });
                    break;
                case 'gif':
                    pipeline = pipeline.gif();
                    break;
                default:
                    break;
            }
        }

        await pipeline.toFile(resolvedOutput);

        const outMeta = await sharpInstance(resolvedOutput).metadata();
        const stat = fs.statSync(resolvedOutput);

        return {
            status: 'Success',
            outputPath: resolvedOutput,
            width: outMeta.width,
            height: outMeta.height,
            format: outMeta.format,
            sizeBytes: stat.size,
            summary: `Successfully manipulated image and saved to ${resolvedOutput}.`
        };
    }

    return {
        generateImage,
        getImageInfo,
        removeImageBackground,
        cropImage,
        resizeImage,
        rotateImage,
        adjustImage,
        convertImage,
        compositeImages,
        manipulateImage
    };
}
