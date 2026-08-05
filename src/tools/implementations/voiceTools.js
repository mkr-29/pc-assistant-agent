import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Simple voice generation tool using macOS `say` command.
 * Generates a WAV file from the provided text and returns the absolute path.
 * The caller can then send the file via Telegram using the existing `sendTelegramFile` tool.
 */
export function createVoiceGenerationTools({ resolveToolPath }) {
  return {
    /**
     * Generate a voice note audio file from text.
     * @param {string} text - The text to speak.
     * @param {string} [fileName] - Optional base name for the output file (without extension).
     * @returns {string} Absolute path to the generated audio file.
     */
    async generateVoiceNote({ text, fileName }) {
      if (!text) {
        throw new Error('generateVoiceNote requires a non‑empty text string.');
      }
      // Determine output directory – use a temporary folder inside the project.
      const outDir = resolveToolPath('tmp/voice');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const baseName = fileName ? fileName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'voice_note';
      const wavPath = path.join(outDir, `${baseName}.wav`);

      // Build the `say` command. Use a default voice; user can customize via env if needed.
      // `-o` writes an AIFF file; we ask for WAV via `-f` format flag.
      const cmd = `say -v Alex -o "${wavPath}" --data-format=LEF32@22050 "${text.replace(/"/g, '\\"')}"`;
      try {
        execSync(cmd, { stdio: 'ignore' });
      } catch (err) {
        throw new Error(`Failed to generate voice note with 'say': ${err.message}`);
      }

      // Verify the file exists.
      if (!fs.existsSync(wavPath)) {
        throw new Error('Voice generation succeeded but output file not found.');
      }
      return wavPath;
    }
  };
}
