import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function escapeAppleScriptString(str = '') {
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

export function createAppleTools({
    platform = process.platform,
    execFileImpl = execFile
} = {}) {
    const runExec = promisify(execFileImpl);

    async function runOsaScript(script) {
        if (platform !== 'darwin') {
            return {
                status: 'Error',
                message: `Apple tools are only supported on macOS. Current platform: ${platform}.`
            };
        }
        try {
            const res = await runExec('osascript', ['-e', script], { timeout: 15000 });
            const stdout = typeof res === 'string' ? res : (res?.stdout || '');
            return { status: 'Success', output: stdout.trim() };
        } catch (error) {
            return {
                status: 'Error',
                message: `AppleScript execution failed: ${error.message}`
            };
        }
    }

    return {
        getCalendarEvents: async ({ startDate, endDate, calendarName } = {}) => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Apple Calendar is only supported on macOS.' };
            }

            const startStr = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
            const endStr = endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const calFilter = calendarName ? `whose name is "${escapeAppleScriptString(calendarName)}"` : '';

            const script = `
                set eventList to {}
                tell application "Calendar"
                    set targetCals to calendars ${calFilter}
                    set startDate to date "${new Date(startStr).toLocaleString('en-US')}"
                    set endDate to date "${new Date(endStr).toLocaleString('en-US')}"
                    repeat with cal in targetCals
                        set calEvents to (events of cal whose start date >= startDate and start date <= endDate)
                        repeat with ev in calEvents
                            set end of eventList to (summary of ev & "|" & (start date of ev as string) & "|" & (end date of ev as string) & "|" & (location of ev as string) & "|" & (name of cal))
                        end repeat
                    end repeat
                end tell
                set AppleScript's text item delimiters to linefeed
                return eventList as string
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') {
                return res;
            }

            const lines = res.output ? res.output.split('\n').filter(Boolean) : [];
            const events = lines.map(line => {
                const parts = line.split('|');
                return {
                    title: parts[0] || 'Untitled Event',
                    startDate: parts[1] || null,
                    endDate: parts[2] || null,
                    location: parts[3] && parts[3] !== 'missing value' ? parts[3] : undefined,
                    calendar: parts[4] || 'Default'
                };
            });

            return {
                status: 'Success',
                startDate: startStr,
                endDate: endStr,
                totalEvents: events.length,
                events
            };
        },

        createCalendarEvent: async ({ title, startDate, endDate, location = '', notes = '', calendarName = '' } = {}) => {
            if (!title || typeof title !== 'string') {
                return { status: 'Error', message: 'title is required for creating a calendar event.' };
            }
            if (!startDate) {
                return { status: 'Error', message: 'startDate is required for creating a calendar event.' };
            }

            const startObj = new Date(startDate);
            const endObj = endDate ? new Date(endDate) : new Date(startObj.getTime() + 60 * 60 * 1000);

            const calTarget = calendarName
                ? `calendar "${escapeAppleScriptString(calendarName)}"`
                : 'first calendar';

            const script = `
                tell application "Calendar"
                    tell ${calTarget}
                        set newEvent to make new event with properties {summary:"${escapeAppleScriptString(title)}", start date:(date "${startObj.toLocaleString('en-US')}"), end date:(date "${endObj.toLocaleString('en-US')}"), location:"${escapeAppleScriptString(location)}", description:"${escapeAppleScriptString(notes)}"}
                        return id of newEvent
                    end tell
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') {
                return res;
            }

            return {
                status: 'Success',
                eventId: res.output,
                title,
                startDate: startObj.toISOString(),
                endDate: endObj.toISOString(),
                location: location || undefined,
                message: `Event "${title}" created successfully in Apple Calendar.`
            };
        },

        createAppleReminder: async ({ title, dueDate = null, listName = '', notes = '', priority = 0 } = {}) => {
            if (!title || typeof title !== 'string') {
                return { status: 'Error', message: 'title is required for creating an Apple Reminder.' };
            }

            const listTarget = listName
                ? `list "${escapeAppleScriptString(listName)}"`
                : 'default list';

            const dueDateProp = dueDate
                ? `, due date:(date "${new Date(dueDate).toLocaleString('en-US')}")`
                : '';

            const script = `
                tell application "Reminders"
                    tell ${listTarget}
                        set newRem to make new reminder with properties {name:"${escapeAppleScriptString(title)}", body:"${escapeAppleScriptString(notes)}", priority:${Number(priority) || 0}${dueDateProp}}
                        return id of newRem
                    end tell
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') {
                return res;
            }

            return {
                status: 'Success',
                reminderId: res.output,
                title,
                dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
                listName: listName || 'Default',
                message: `Reminder "${title}" created in Apple Reminders.`
            };
        },

        searchAppleNotes: async ({ query, limit = 10 } = {}) => {
            if (!query || typeof query !== 'string') {
                return { status: 'Error', message: 'query is required for searching Apple Notes.' };
            }

            const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
            const escapedQuery = escapeAppleScriptString(query);

            const script = `
                set noteResults to {}
                tell application "Notes"
                    set matchedNotes to (notes whose name contains "${escapedQuery}" or plaintext contains "${escapedQuery}")
                    set resultCount to 0
                    repeat with n in matchedNotes
                        if resultCount < ${safeLimit} then
                            set noteInfo to (id of n) & "|" & (name of n) & "|" & (modification date of n as string)
                            set end of noteResults to noteInfo
                            set resultCount to resultCount + 1
                        end if
                    end repeat
                end tell
                set AppleScript's text item delimiters to linefeed
                return noteResults as string
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') {
                return res;
            }

            const lines = res.output ? res.output.split('\n').filter(Boolean) : [];
            const notes = lines.map(line => {
                const parts = line.split('|');
                return {
                    id: parts[0],
                    name: parts[1],
                    modificationDate: parts[2]
                };
            });

            return {
                status: 'Success',
                query,
                totalFound: notes.length,
                notes
            };
        },

        readAppleNote: async ({ name, id } = {}) => {
            if (!name && !id) {
                return { status: 'Error', message: 'Either note name or id is required.' };
            }

            const targetClause = id
                ? `note id "${escapeAppleScriptString(id)}"`
                : `first note whose name is "${escapeAppleScriptString(name)}"`;

            const script = `
                tell application "Notes"
                    set targetNote to ${targetClause}
                    return (name of targetNote) & "---NOTE_SPLIT---" & (plaintext of targetNote)
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') {
                return res;
            }

            const [title, ...bodyParts] = res.output.split('---NOTE_SPLIT---');
            const body = bodyParts.join('---NOTE_SPLIT---').trim();

            return {
                status: 'Success',
                name: title.trim(),
                body
            };
        },

        createAppleNote: async ({ title, body = '', folderName = '' } = {}) => {
            if (!title || typeof title !== 'string') {
                return { status: 'Error', message: 'title is required for creating an Apple Note.' };
            }

            const folderTarget = folderName
                ? `folder "${escapeAppleScriptString(folderName)}"`
                : 'default folder';

            const fullContent = `<h1>${escapeAppleScriptString(title)}</h1><p>${escapeAppleScriptString(body).replace(/\n/g, '<br>')}</p>`;

            const script = `
                tell application "Notes"
                    tell ${folderTarget}
                        set newNote to make new note with properties {body:"${fullContent}"}
                        return id of newNote
                    end tell
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') {
                return res;
            }

            return {
                status: 'Success',
                noteId: res.output,
                title,
                folder: folderName || 'Default',
                message: `Note "${title}" created successfully in Apple Notes.`
            };
        },

        appendAppleNote: async ({ name, id, textToAppend } = {}) => {
            if ((!name && !id) || !textToAppend) {
                return { status: 'Error', message: 'Note name or id and textToAppend are required.' };
            }

            const targetClause = id
                ? `note id "${escapeAppleScriptString(id)}"`
                : `first note whose name is "${escapeAppleScriptString(name)}"`;

            const formattedAppend = `<br><p>${escapeAppleScriptString(textToAppend).replace(/\n/g, '<br>')}</p>`;

            const script = `
                tell application "Notes"
                    set targetNote to ${targetClause}
                    set oldBody to body of targetNote
                    set body of targetNote to (oldBody & "${formattedAppend}")
                    return name of targetNote
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') {
                return res;
            }

            return {
                status: 'Success',
                noteName: res.output,
                message: `Appended text to Apple Note "${res.output}".`
            };
        },

        listAppleShortcuts: async () => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Apple Shortcuts are only supported on macOS.' };
            }

            try {
                const res = await runExec('shortcuts', ['list'], { timeout: 10000 });
                const stdout = typeof res === 'string' ? res : (res?.stdout || '');
                const shortcuts = stdout.split('\n').map(s => s.trim()).filter(Boolean);

                return {
                    status: 'Success',
                    totalShortcuts: shortcuts.length,
                    shortcuts
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to list shortcuts: ${error.message}`
                };
            }
        },

        runAppleShortcut: async ({ name, input = '' } = {}) => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Apple Shortcuts are only supported on macOS.' };
            }
            if (!name || typeof name !== 'string') {
                return { status: 'Error', message: 'Shortcut name is required.' };
            }

            const args = ['run', name.trim()];
            if (input) {
                args.push('-i', String(input));
            }

            try {
                const res = await runExec('shortcuts', args, { timeout: 30000 });
                const stdout = typeof res === 'string' ? res : (res?.stdout || '');

                return {
                    status: 'Success',
                    shortcutName: name,
                    output: stdout.trim(),
                    message: `Shortcut "${name}" executed successfully.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to run shortcut "${name}": ${error.message}`
                };
            }
        }
    };
}
