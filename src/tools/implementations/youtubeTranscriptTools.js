import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function extractYoutubeVideoId(urlOrId = '') {
    if (!urlOrId || typeof urlOrId !== 'string') return null;
    const str = urlOrId.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
        return str;
    }
    const match = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    return match ? match[1] : null;
}

function parseTimedTextXml(xmlText = '') {
    const lines = [];
    const regex = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/gi;
    let match;

    while ((match = regex.exec(xmlText)) !== null) {
        const start = parseFloat(match[1]);
        const dur = parseFloat(match[2]);
        const text = match[3]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, ' ')
            .replace(/<[^>]+>/g, '')
            .trim();

        if (text) {
            lines.push({ start, duration: dur, text });
        }
    }

    return lines;
}

export function createYoutubeTranscriptTools() {
    return {
        getYoutubeTranscript: async ({ videoUrl, lang = 'en', includeChapters = true } = {}) => {
            if (!videoUrl || typeof videoUrl !== 'string') {
                return { status: 'Error', message: 'A YouTube video URL or ID is required.' };
            }

            const videoId = extractYoutubeVideoId(videoUrl);
            if (!videoId) {
                return { status: 'Error', message: `Could not extract a valid YouTube video ID from '${videoUrl}'.` };
            }

            // Strategy 1: Fast direct YouTube timedtext fetch via watch page
            try {
                const watchResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9'
                    }
                });

                if (watchResponse.ok) {
                    const html = await watchResponse.text();
                    const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/i) || html.match(/<title>(.*?)<\/title>/i);
                    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&') : '';

                    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
                    if (playerResponseMatch) {
                        try {
                            const playerResponse = JSON.parse(playerResponseMatch[1]);
                            const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

                            if (captionTracks.length > 0) {
                                // Find desired language or fallback to first track
                                const track = captionTracks.find(t => t.languageCode === lang || t.vssId?.includes(lang)) || captionTracks[0];
                                const timedTextUrl = track.baseUrl;

                                const transcriptRes = await fetch(timedTextUrl);
                                if (transcriptRes.ok) {
                                    const transcriptXml = await transcriptRes.text();
                                    const items = parseTimedTextXml(transcriptXml);

                                    if (items.length > 0) {
                                        const fullText = items.map(i => i.text).join(' ');
                                        return {
                                            status: 'Success',
                                            videoId,
                                            title: title || playerResponse.videoDetails?.title || '',
                                            channel: playerResponse.videoDetails?.author || '',
                                            durationSeconds: Number(playerResponse.videoDetails?.lengthSeconds) || null,
                                            language: track.languageCode,
                                            itemCount: items.length,
                                            transcript: items,
                                            fullText
                                        };
                                    }
                                }
                            }
                        } catch (e) {
                            // Proceed to Strategy 2 (yt-dlp)
                        }
                    }
                }
            } catch {
                // Fallback to yt-dlp
            }

            // Strategy 2: yt-dlp CLI dump
            try {
                const { stdout } = await execFileAsync('yt-dlp', [
                    '--dump-single-json',
                    '--skip-download',
                    `https://www.youtube.com/watch?v=${videoId}`
                ], { timeout: 25000 });

                const info = JSON.parse(stdout);
                const title = info.title || '';
                const duration = info.duration || null;
                const chapters = info.chapters || [];

                // Check automatic captions or subtitles
                const subtitles = info.subtitles || info.automatic_captions || {};
                const enSubs = subtitles[lang] || subtitles['en'] || Object.values(subtitles)[0];

                let transcriptItems = [];
                let fullText = '';

                if (enSubs && enSubs.length > 0) {
                    const jsonFormat = enSubs.find(s => s.ext === 'json3') || enSubs[0];
                    if (jsonFormat && jsonFormat.url) {
                        const subRes = await fetch(jsonFormat.url);
                        if (subRes.ok) {
                            const subData = await subRes.json();
                            if (Array.isArray(subData.events)) {
                                transcriptItems = subData.events
                                    .filter(ev => Array.isArray(ev.segs))
                                    .map(ev => ({
                                        start: (ev.tStartMs || 0) / 1000,
                                        duration: (ev.dDurationMs || 0) / 1000,
                                        text: ev.segs.map(s => s.utf8).join('').trim()
                                    }))
                                    .filter(item => item.text);

                                fullText = transcriptItems.map(i => i.text).join(' ');
                            }
                        }
                    }
                }

                return {
                    status: 'Success',
                    videoId,
                    title,
                    channel: info.uploader || '',
                    durationSeconds: duration,
                    chapters: includeChapters ? chapters : [],
                    itemCount: transcriptItems.length,
                    transcript: transcriptItems,
                    fullText: fullText || info.description || ''
                };
            } catch (ytError) {
                return {
                    status: 'Error',
                    message: `Could not retrieve transcript for YouTube video '${videoId}': ${ytError.message}. The video may have captions disabled or be restricted.`
                };
            }
        }
    };
}
