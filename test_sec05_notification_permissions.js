
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = fs.readFileSync(
  path.join(__dirname, 'android/app/src/main/AndroidManifest.xml'), 'utf8'
);
const pluginManifestPath = path.join(
  __dirname,
  'node_modules/@capacitor/local-notifications/android/src/main/AndroidManifest.xml'
);
const pluginManifest = fs.existsSync(pluginManifestPath)
  ? fs.readFileSync(pluginManifestPath, 'utf8')
  : '';

const notificationService = fs.readFileSync(
  path.join(__dirname, 'src/services/notificationService.ts'), 'utf8'
);

for (const permission of [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED'
]) {
  assert.ok(manifest.includes(permission), `App manifest declares ${permission}`);
}

assert.match(notificationService, /LocalNotifications\.requestPermissions/);
assert.match(notificationService, /LocalNotifications\.checkPermissions/);
assert.match(notificationService, /await this\.checkPermission\(\) !== 'granted'/);

assert.ok(
  pluginManifest.includes('LocalNotificationRestoreReceiver'),
  'Capacitor plugin provides reboot restoration receiver'
);
assert.ok(
  pluginManifest.includes('android.intent.action.BOOT_COMPLETED'),
  'Capacitor plugin receiver handles BOOT_COMPLETED'
);
assert.ok(
  pluginManifest.includes('android.permission.RECEIVE_BOOT_COMPLETED'),
  'Capacitor plugin declares RECEIVE_BOOT_COMPLETED'
);

console.log('SEC-05 notification permission tests: all passed');
