import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAppleTools } from '../../src/tools/implementations/appleTools.js';

describe('appleTools', () => {
    it('returns error on non-macOS platforms', async () => {
        const tools = createAppleTools({ platform: 'linux' });
        const res = await tools.getCalendarEvents();
        assert.equal(res.status, 'Error');
        assert.match(res.message, /only supported on macOS/i);
    });

    describe('Calendar', () => {
        it('queries calendar events and parses output', async () => {
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                callback(null, 'Team Standup|2025-01-15T09:00:00.000Z|2025-01-15T09:30:00.000Z|Room 101|Work', '');
            };

            const tools = createAppleTools({ platform: 'darwin', execFileImpl: mockExec });
            const res = await tools.getCalendarEvents();

            assert.equal(res.status, 'Success');
            assert.equal(res.totalEvents, 1);
            assert.equal(res.events[0].title, 'Team Standup');
            assert.equal(res.events[0].calendar, 'Work');
            assert.equal(res.events[0].location, 'Room 101');
        });

        it('creates a calendar event', async () => {
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                callback(null, 'event-id-12345', '');
            };

            const tools = createAppleTools({ platform: 'darwin', execFileImpl: mockExec });
            const res = await tools.createCalendarEvent({
                title: 'Dentist Appointment',
                startDate: '2025-05-10T14:00:00.000Z'
            });

            assert.equal(res.status, 'Success');
            assert.equal(res.eventId, 'event-id-12345');
            assert.equal(res.title, 'Dentist Appointment');
        });
    });

    describe('Reminders', () => {
        it('creates an Apple reminder', async () => {
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                callback(null, 'reminder-id-789', '');
            };

            const tools = createAppleTools({ platform: 'darwin', execFileImpl: mockExec });
            const res = await tools.createAppleReminder({
                title: 'Buy Groceries',
                dueDate: '2025-05-10T18:00:00.000Z'
            });

            assert.equal(res.status, 'Success');
            assert.equal(res.reminderId, 'reminder-id-789');
            assert.equal(res.title, 'Buy Groceries');
        });
    });

    describe('Notes', () => {
        it('searches and reads Apple Notes', async () => {
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                const script = args[1] || '';
                if (script.includes('matchedNotes')) {
                    callback(null, 'note-id-1|Project Roadmap|2025-01-10', '');
                } else if (script.includes('---NOTE_SPLIT---')) {
                    callback(null, 'Project Roadmap---NOTE_SPLIT---Here are the Q3 goals.', '');
                } else {
                    callback(null, 'note-id-1', '');
                }
            };

            const tools = createAppleTools({ platform: 'darwin', execFileImpl: mockExec });
            const searchRes = await tools.searchAppleNotes({ query: 'Roadmap' });
            assert.equal(searchRes.status, 'Success');
            assert.equal(searchRes.totalFound, 1);
            assert.equal(searchRes.notes[0].name, 'Project Roadmap');

            const readRes = await tools.readAppleNote({ id: 'note-id-1' });
            assert.equal(readRes.status, 'Success');
            assert.equal(readRes.name, 'Project Roadmap');
            assert.equal(readRes.body, 'Here are the Q3 goals.');
        });
    });

    describe('Shortcuts', () => {
        it('lists and runs shortcuts', async () => {
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                if (args[0] === 'list') {
                    callback(null, 'Morning Routine\nFocus Mode\nEvening Chill', '');
                } else {
                    callback(null, 'Shortcut finished', '');
                }
            };

            const tools = createAppleTools({ platform: 'darwin', execFileImpl: mockExec });
            const listRes = await tools.listAppleShortcuts();
            assert.equal(listRes.status, 'Success');
            assert.equal(listRes.totalShortcuts, 3);
            assert.ok(listRes.shortcuts.includes('Focus Mode'));

            const runRes = await tools.runAppleShortcut({ name: 'Focus Mode' });
            assert.equal(runRes.status, 'Success');
            assert.equal(runRes.shortcutName, 'Focus Mode');
        });
    });
});
