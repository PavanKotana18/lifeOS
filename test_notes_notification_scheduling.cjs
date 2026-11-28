
'use strict';
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { buildSync } = require('esbuild');

async function main() {
  let permission = 'granted';
  let scheduleCount = 0;
  let channelCount = 0;
  const pending = new Map([[1001, { id: 1001, extra: { kind: 'habitReminder' } }]]);
  const delivered = new Map();
  const local = {
    async checkPermissions() { return { display: permission }; },
    async getPending() { return { notifications: Array.from(pending.values()) }; },
    async schedule({ notifications }) {
      scheduleCount++;
      notifications.forEach(item => pending.set(item.id, item));
    },
    async cancel({ notifications }) { notifications.forEach(item => pending.delete(item.id)); },
    async createChannel() { channelCount++; },
    async getDeliveredNotifications() { return { notifications: Array.from(delivered.values()) }; },
    async removeDeliveredNotifications({ notifications }) {
      notifications.forEach(item => delivered.delete(item.id));
    }
  };
  const filename = path.resolve('src/services/notificationService.ts');
  const built = buildSync({
    entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external',
  });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normal = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === '@capacitor/core') return {
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => true },
      registerPlugin: () => ({}),
    };
    if (name === '@capacitor/local-notifications') return { LocalNotifications: local };
    return normal(name);
  };
  loaded._compile(built.outputFiles[0].text, filename);
  const { NotificationService } = loaded.exports;
  const upcoming = { noteId: 'note-1', reminderId: 'schedule-1', occurrenceAt: new Date(Date.now() + 60000).toISOString() };
  const old = { noteId: 'note-2', reminderId: 'schedule-2', occurrenceAt: new Date(Date.now() - 60000).toISOString() };
  const sync = (alarms, enabled = true, current = true) => NotificationService.syncNotes(alarms, enabled, 'warm', () => current);
  await sync([upcoming, old]);
  assert.equal(scheduleCount, 1);
  assert.equal(channelCount, 1);
  assert.equal(pending.size, 2);
  const first = Array.from(pending.values()).find(row => row.extra.kind === 'notesReminder');
  assert.deepEqual(first.extra, { kind: 'notesReminder', ...upcoming });
  assert.equal(first.schedule.at.toISOString(), upcoming.occurrenceAt);
  assert.equal(first.title, 'Note reminder');
  assert.equal(first.body, 'It is time to check a saved note in BusyDoo.');
  await sync([upcoming, old]);
  assert.equal(scheduleCount, 1);
  const moved = { ...upcoming, reminderId: 'schedule-3', occurrenceAt: new Date(Date.now() + 120000).toISOString() };
  await sync([moved]);
  assert.equal(scheduleCount, 2);
  assert.equal(pending.has(first.id), false);
  assert.equal(pending.size, 2);
  await sync([], true, false);
  assert.equal(pending.size, 2);
  permission = 'denied';
  await sync([moved]);
  assert.equal(pending.size, 1);
  assert.ok(pending.has(1001));
  permission = 'granted';
  await sync([moved]);
  assert.equal(pending.size, 2);
  await sync([]);
  assert.equal(pending.size, 1);
  assert.ok(pending.has(1001));
  await sync([moved], false);
  assert.equal(pending.size, 1);
  await sync([moved]);
  const scheduled = Array.from(pending.values()).find(row => row.extra.kind === 'notesReminder');
  delivered.set(scheduled.id, scheduled);
  delivered.set(9000, { id: 9000, extra: { kind: 'other' } });
  await NotificationService.cancelAllRecordReminders();
  assert.equal(pending.size, 0);
  assert.deepEqual(Array.from(delivered.keys()), [9000]);
  console.log('Notes scheduler passed with a synthetic Android bridge: registration, idempotence, extension, stale sessions, permission loss, archive/deletion and reset.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
