'use strict';
// Shell/ADB contract simulation only. Never connects to Android or installs APKs.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-runner-contract-'));
try {
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'adb'), `#!/usr/bin/env node
const a=process.argv.slice(2).join(' '),mode=process.env.QA_STUB_MODE;
if(a.includes('getprop ro.kernel.qemu')) console.log(mode==='physical'?'0':'1');
else if(a.includes('pm list packages')) { if(mode==='existing') console.log('package:com.lifeos.personal'); }
else if(a.includes('shell am instrument')) {
 console.log('INSTRUMENTATION_STATUS: numtests=1\\nINSTRUMENTATION_STATUS: class=com.lifeos.personal.LifeOSLaunchSmokeTest\\nINSTRUMENTATION_STATUS: test=activityCreatesLocalCapacitorWebView\\nINSTRUMENTATION_STATUS_CODE: 1');
 if(mode==='crash') console.log('INSTRUMENTATION_RESULT: shortMsg=Process crashed.\\nINSTRUMENTATION_CODE: 0');
 else console.log('INSTRUMENTATION_STATUS: numtests=1\\nINSTRUMENTATION_STATUS: class=com.lifeos.personal.LifeOSLaunchSmokeTest\\nINSTRUMENTATION_STATUS: test=activityCreatesLocalCapacitorWebView\\nINSTRUMENTATION_STATUS_CODE: 0\\nINSTRUMENTATION_CODE: -1');
} else console.log('synthetic adb response');
`, { mode: 0o755 });
  for (const mode of ['pass', 'crash', 'existing', 'physical']) {
    const out = path.join(root, mode);
    const result = spawnSync('bash', ['scripts/run-android-instrumentation.sh', 'synthetic-app.apk', 'synthetic-test.apk', out], {
      cwd: path.resolve(__dirname, '..'), timeout: 30000, encoding: 'utf8',
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, QA_STUB_MODE: mode, ANDROID_SERIAL: 'emulator-5554', ANDROID_TEST_FILTER: '', ANDROID_REQUIRED_TEST: '' },
    });
    assert.ifError(result.error);
    assert.equal(result.status === 0, mode === 'pass', `${mode}: ${result.stderr}`);
    assert.ok(fs.existsSync(path.join(out, 'webview-provider.txt')), `${mode}: provider diagnostic missing`);
    assert.ok(fs.existsSync(path.join(out, 'logcat-errors.txt')), `${mode}: on-device log capture missing`);
    if (mode !== 'pass') assert.ok(fs.existsSync(path.join(out, 'failure.png')), `${mode}: failure screenshot missing`);
    if (mode === 'crash') assert.match(fs.readFileSync(path.join(out, 'junit.xml'), 'utf8'), /errors="[1-9]/);
    console.log(`PASS: Android runner ${mode} contract (simulated ADB only)`);
  }
} finally {
  // Remove only the disposable directory this test created, never repository/device data.
  fs.rmSync(root, { recursive: true });
}
