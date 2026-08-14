import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const execFileAsync = promisify(execFile);

export function createDocumentTools({ resolveToolPath = p => p } = {}) {
    return {
        extractPdfText: async ({ filePath, pageStart, pageEnd, maxPages } = {}) => {
            if (!filePath || typeof filePath !== 'string') {
                return { status: 'Error', message: 'A filePath is required to extract PDF text.' };
            }

            const targetPath = resolveToolPath(filePath);
            if (!fs.existsSync(targetPath)) {
                return { status: 'Error', message: `PDF file not found at path: ${filePath}` };
            }

            try {
                const dataBuffer = fs.readFileSync(targetPath);
                const options = {};
                if (maxPages && Number(maxPages) > 0) {
                    options.max = Number(maxPages);
                }

                const data = await pdfParse(dataBuffer, options);

                let extractedText = data.text || '';
                // Handle page ranges if pageStart or pageEnd specified
                const pages = extractedText.split(/\n\s*\n\s*--\s*\d+\s*--\s*\n/); // some pdfs, or fallback to text

                return {
                    status: 'Success',
                    filePath: targetPath,
                    pageCount: data.numpages || 1,
                    textLength: extractedText.length,
                    text: extractedText.trim(),
                    info: data.info || null,
                    metadata: data.metadata || null
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to parse PDF '${filePath}': ${error.message}`
                };
            }
        },

        extractPdfMetadata: async ({ filePath } = {}) => {
            if (!filePath || typeof filePath !== 'string') {
                return { status: 'Error', message: 'A filePath is required to extract PDF metadata.' };
            }

            const targetPath = resolveToolPath(filePath);
            if (!fs.existsSync(targetPath)) {
                return { status: 'Error', message: `PDF file not found at path: ${filePath}` };
            }

            try {
                const dataBuffer = fs.readFileSync(targetPath);
                const data = await pdfParse(dataBuffer, { max: 1 });

                const stats = fs.statSync(targetPath);

                return {
                    status: 'Success',
                    filePath: targetPath,
                    fileSizeBytes: stats.size,
                    pageCount: data.numpages || 1,
                    version: data.version || null,
                    info: data.info || {},
                    metadata: data.metadata || {}
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to extract metadata for '${filePath}': ${error.message}`
                };
            }
        },

        convertDocumentWithPandoc: async ({ inputPath, outputPath, fromFormat, toFormat, extraArgs = [] } = {}) => {
            if (!inputPath || typeof inputPath !== 'string') {
                return { status: 'Error', message: 'An inputPath is required for document conversion.' };
            }
            if (!toFormat || typeof toFormat !== 'string') {
                return { status: 'Error', message: 'A target toFormat (e.g. "markdown", "html", "pdf", "docx") is required.' };
            }

            const targetInputPath = resolveToolPath(inputPath);
            if (!fs.existsSync(targetInputPath)) {
                return { status: 'Error', message: `Input file not found at path: ${inputPath}` };
            }

            const targetOutputPath = outputPath
                ? resolveToolPath(outputPath)
                : path.join(
                    path.dirname(targetInputPath),
                    `${path.basename(targetInputPath, path.extname(targetInputPath))}.${toFormat}`
                );

            // Check if pandoc CLI is available
            let pandocAvailable = false;
            try {
                await execFileAsync('which', ['pandoc']);
                pandocAvailable = true;
            } catch {
                pandocAvailable = false;
            }

            if (pandocAvailable) {
                const args = [targetInputPath, '-o', targetOutputPath];
                if (fromFormat) {
                    args.unshift('-f', fromFormat);
                }
                args.push('-t', toFormat);

                if (Array.isArray(extraArgs) && extraArgs.length > 0) {
                    args.push(...extraArgs.map(String));
                }

                try {
                    fs.mkdirSync(path.dirname(targetOutputPath), { recursive: true });
                    const { stdout, stderr } = await execFileAsync('pandoc', args);
                    return {
                        status: 'Success',
                        engine: 'pandoc',
                        inputPath: targetInputPath,
                        outputPath: targetOutputPath,
                        fromFormat: fromFormat || path.extname(targetInputPath).replace('.', ''),
                        toFormat,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    };
                } catch (error) {
                    return {
                        status: 'Error',
                        message: `Pandoc execution failed: ${error.message}`
                    };
                }
            }

            // Fallback for Markdown <-> HTML <-> Plain Text without Pandoc
            try {
                const content = fs.readFileSync(targetInputPath, 'utf8');
                let converted = '';

                const inputExt = (fromFormat || path.extname(targetInputPath).replace('.', '')).toLowerCase();
                const outputExt = toFormat.toLowerCase();

                if ((inputExt === 'md' || inputExt === 'markdown') && outputExt === 'html') {
                    // Simple MD to HTML conversion
                    converted = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${path.basename(targetInputPath)}</title></head><body>\n` +
                        content
                            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                            .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
                            .replace(/\*(.*)\*/gim, '<i>$1</i>')
                            .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
                            .replace(/\n\n/gim, '<p></p>') +
                        '\n</body></html>';
                } else if (inputExt === 'html' && (outputExt === 'md' || outputExt === 'markdown')) {
                    // HTML to Markdown
                    converted = content
                        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
                        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
                        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
                        .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**')
                        .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*')
                        .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
                        .replace(/<[^>]+>/g, '')
                        .trim();
                } else if (outputExt === 'txt') {
                    converted = content.replace(/<[^>]+>/g, '').trim();
                } else {
                    return {
                        status: 'Error',
                        message: `Pandoc CLI is not installed on this system. Built-in converter only supports Markdown <-> HTML <-> TXT. Install pandoc using 'brew install pandoc' for full PDF/DOCX/LaTeX conversions.`
                    };
                }

                fs.mkdirSync(path.dirname(targetOutputPath), { recursive: true });
                fs.writeFileSync(targetOutputPath, converted, 'utf8');

                return {
                    status: 'Success',
                    engine: 'builtin',
                    inputPath: targetInputPath,
                    outputPath: targetOutputPath,
                    fromFormat: inputExt,
                    toFormat: outputExt,
                    note: 'Converted using built-in converter (install pandoc for advanced formats like DOCX/PDF/LaTeX).'
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Conversion failed: ${error.message}`
                };
            }
        }
    };
}
