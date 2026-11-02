const fs = require('node:fs');
const assert = require('node:assert/strict');

const service = fs.readFileSync('src/services/backupExportService.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const native = fs.readFileSync(
  'android/app/src/main/java/com/lifeos/personal/LifeOSBackupPlugin.java',
  'utf8'
);
const activity = fs.readFileSync(
  'android/app/src/main/java/com/lifeos/personal/MainActivity.java',
  'utf8'
);

assert.match(service, /registerPlugin<NativeBackupPlugin>\('LifeOSBackup'\)/);
assert.match(service, /Capacitor\.getPlatform\(\)\s*===\s*'android'/);
assert.match(service, /Capacitor\.isPluginAvailable\('LifeOSBackup'\)/);
assert.match(service, /status: 'cancelled'/);
assert.match(service, /status: 'saved'/);
assert.match(service, /status: 'download_started'/);
assert.match(service, /result\.bytesWritten/);

assert.match(native, /Intent\.ACTION_CREATE_DOCUMENT/);
assert.match(native, /Intent\.CATEGORY_OPENABLE/);
assert.match(native, /@ActivityCallback/);
assert.match(native, /StandardCharsets\.UTF_8/);
assert.match(native, /output\.flush\(\)/);
assert.match(native, /call\.resolve\(response\)/);
assert.match(native, /call\.reject\(/);

assert.match(activity, /registerPlugin\(LifeOSBackupPlugin\.class\)/);

assert.match(app, /exportBackupFile/);
assert.match(app, /Backup export cancelled/);
assert.match(app, /Backup saved successfully/);
assert.match(app, /Transactions CSV saved/);

console.log('BACKUP EXPORT SERVICE TESTS: 18/18 PASSED');
