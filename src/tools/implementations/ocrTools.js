import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SWIFT_OCR_SCRIPT = `
import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: ocr <image_path> [recognition_level]\\n", stderr)
    exit(1)
}

let imagePath = CommandLine.arguments[1]
let level = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "accurate"

guard let image = NSImage(contentsOfFile: imagePath) else {
    fputs("Error: Unable to load image at \\(imagePath)\\n", stderr)
    exit(2)
}

guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fputs("Error: Unable to get CGImage from NSImage\\n", stderr)
    exit(3)
}

var lines: [String] = []

let request = VNRecognizeTextRequest { request, error in
    if let error = error {
        fputs("Vision error: \\(error.localizedDescription)\\n", stderr)
        return
    }
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    for obs in observations {
        if let candidate = obs.topCandidates(1).first {
            lines.append(candidate.string)
        }
    }
}

request.recognitionLevel = (level.lowercased() == "fast") ? .fast : .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
    print(lines.joined(separator: "\\n"))
} catch {
    fputs("Handler error: \\(error.localizedDescription)\\n", stderr)
    exit(4)
}
`;

export function createOcrTools({ resolveToolPath = p => p, ai = null, config = {}, execFileImpl = execFile } = {}) {
    const runExecFile = promisify(execFileImpl);
    return {
        performVisionOcr: async ({ imagePath, recognitionLevel = 'accurate', languages = [] } = {}) => {
            if (!imagePath || typeof imagePath !== 'string') {
                return { status: 'Error', message: 'An imagePath is required to perform OCR.' };
            }

            const targetPath = resolveToolPath(imagePath);
            if (!fs.existsSync(targetPath)) {
                return { status: 'Error', message: `Image file not found at path: ${imagePath}` };
            }

            // Method 1: Try Native macOS Vision Framework via Swift
            if (process.platform === 'darwin') {
                try {
                    const tempScriptPath = path.join(os.tmpdir(), `vision-ocr-${Date.now()}.swift`);
                    fs.writeFileSync(tempScriptPath, SWIFT_OCR_SCRIPT, 'utf8');

                    try {
                        const execResult = await runExecFile('swift', [tempScriptPath, targetPath, recognitionLevel], {
                            timeout: 25000
                        });

                        const stdoutText = typeof execResult === 'string'
                            ? execResult
                            : (execResult?.stdout || '');

                        const recognizedText = stdoutText.trim();
                        const lines = recognizedText ? recognizedText.split('\n').map(l => l.trim()).filter(Boolean) : [];

                        return {
                            status: 'Success',
                            engine: 'macOS-Vision',
                            imagePath: targetPath,
                            lineCount: lines.length,
                            lines,
                            text: recognizedText
                        };
                    } finally {
                        if (fs.existsSync(tempScriptPath)) {
                            fs.unlinkSync(tempScriptPath);
                        }
                    }
                } catch (swiftError) {
                    // Fall back to Gemini Multimodal if Swift fails
                    console.warn(`[OCR] Native Vision OCR failed (${swiftError.message}). Attempting Gemini fallback...`);
                }
            }

            // Method 2: Gemini Multimodal Vision Fallback
            if (ai && typeof ai.models?.generateContent === 'function') {
                try {
                    const imageBytes = fs.readFileSync(targetPath);
                    const mimeType = targetPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
                    const base64Data = imageBytes.toString('base64');

                    const response = await ai.models.generateContent({
                        model: config.screenAnalysisModel || 'gemini-2.5-flash',
                        contents: [
                            {
                                role: 'user',
                                parts: [
                                    {
                                        inlineData: {
                                            mimeType,
                                            data: base64Data
                                        }
                                    },
                                    {
                                        text: 'Extract and transcribe all text from this image verbatim. Do not add conversational commentary; output only the exact transcribed text line by line.'
                                    }
                                ]
                            }
                        ]
                    });

                    const text = response.text ? response.text.trim() : '';
                    const lines = text ? text.split('\n').map(l => l.trim()).filter(Boolean) : [];

                    return {
                        status: 'Success',
                        engine: 'gemini-multimodal',
                        imagePath: targetPath,
                        lineCount: lines.length,
                        lines,
                        text
                    };
                } catch (geminiError) {
                    return {
                        status: 'Error',
                        message: `OCR failed on both native Vision and Gemini: ${geminiError.message}`
                    };
                }
            }

            return {
                status: 'Error',
                message: 'OCR requires macOS with Swift or a valid GEMINI_API_KEY for multimodal processing.'
            };
        }
    };
}
