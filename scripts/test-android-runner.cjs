'use strict';
// Shell/ADB contract simulation only. Never connects to Android or installs APKs.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const pathToAndroidTests = path.resolve(__dirname, '../android/app/src/androidTest/java/com/lifeos/personal');
const instrumentationWorkflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/android-emulator-qa.yml'), 'utf8');
assert.match(instrumentationWorkflow, /pull_request:\s*\n\s+branches:\s*\[[^\]]*\bmain\b/,
  'candidate PRs targeting main must run Android QA');
const declaredTests = fs.readdirSync(pathToAndroidTests)
  .filter(file => file.endsWith('.java'))
  .flatMap(file => {
    const source = fs.readFileSync(path.join(pathToAndroidTests, file), 'utf8');
    return [...source.matchAll(/@Test\s+(?:public\s+)?void\s+(\w+)\s*\(/g)]
      .map(match => `com.lifeos.personal.${file.slice(0, -5)}#${match[1]}`);
  });
assert.equal(declaredTests.length, 19, 'Android test inventory changed; update the hosted expected counts deliberately');
for (const [inventory, expectedCount, requiredTest] of [
  ['instrumentation-exclusions-api29.txt', 12, 'com.lifeos.personal.CryptoAcceptanceTest#newInstanceStartsLockedWithoutProvisioning'],
  ['instrumentation-exclusions-api34-35.txt', 17, 'com.lifeos.personal.LifeOSLaunchSmokeTest#activityCreatesLocalCapacitorWebView'],
]) {
  const exclusionPath = path.resolve(__dirname, `../android/qa/${inventory}`);
  const exclusions = fs.readFileSync(exclusionPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  assert.equal(new Set(exclusions).size, exclusions.length, `${inventory} contains duplicates`);
  assert.ok(exclusions.every(test => declaredTests.includes(test)), `${inventory} contains an unknown test`);
  assert.equal(declaredTests.length - exclusions.length, expectedCount, `${inventory} does not match its expected unattended count`);
  assert.ok(declaredTests.includes(requiredTest), `${inventory} required test is not declared`);
  assert.ok(!exclusions.includes(requiredTest), `${inventory} excludes its own required test`);
}
const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/workstream-integration.yml'), 'utf8');
assert.match(workflow, /test-filter:\s*\"com\.lifeos\.personal\.WebViewCompatibilityAcceptanceTest#unsupportedEngineShowsNativeUpdateMessage\"/,
  'API 29 filter must name the fully qualified instrumentation class');
assert.match(workflow, /required-test:\s*\"com\.lifeos\.personal\.WebViewCompatibilityAcceptanceTest#unsupportedEngineShowsNativeUpdateMessage\"/,
  'API 29 acceptance gate must require the fully qualified compatibility case');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-runner-contract-'));
try {
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  const excluded = path.join(root, 'excluded-tests.txt');
  fs.writeFileSync(excluded, 'com.lifeos.personal.BiometricDeviceAcceptanceTest#actualSetupCancelConcurrentResumeRecreateAndUnlock\n');
  fs.writeFileSync(path.join(bin, 'adb'), `#!/usr/bin/env node
const a=process.argv.slice(2).join(' '),mode=process.env.QA_STUB_MODE;
require('node:fs').appendFileSync(process.env.QA_COMMAND_LOG, a+'\\n');
if(a.includes('getprop ro.kernel.qemu')) console.log(mode==='physical'?'0':'1');
else if(a.includes('getprop ro.build.version.sdk')) console.log('34');
else if(a.includes('pm list packages')) { if(mode==='existing') console.log('package:com.lifeos.personal'); }
else if(a.includes('shell run-as com.lifeos.personal pwd')) console.log('/data/user/0/com.lifeos.personal');
else if(a.includes('dumpsys activity exit-info')) console.log('synthetic process exit information');
else if(a.includes('dumpsys meminfo')) console.log('synthetic process memory information');
else if(a.includes('logcat -b all -d')) console.log('synthetic crash log');
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
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, QA_STUB_MODE: mode, QA_COMMAND_LOG: path.join(out, 'adb-commands.txt'), ANDROID_SERIAL: 'emulator-5554', ANDROID_TEST_FILTER: '', ANDROID_REQUIRED_TEST: '', ANDROID_TEST_EXCLUSION_FILE: excluded, ANDROID_EXPECTED_TESTS: '1' },
    });
    assert.ifError(result.error);
    assert.equal(result.status === 0, mode === 'pass', `${mode}: ${result.stderr}`);
    const admitted = mode === 'pass' || mode === 'crash';
    assert.equal(fs.existsSync(path.join(out, 'webview-provider.txt')), admitted, `${mode}: provider capture boundary`);
    assert.equal(fs.existsSync(path.join(out, 'logcat-errors.txt')), admitted, `${mode}: log capture boundary`);
    assert.equal(fs.existsSync(path.join(out, 'failure.png')), mode === 'crash', `${mode}: screenshot capture boundary`);
    if (admitted) {
      assert.match(fs.readFileSync(path.join(out, 'test-inventory.txt'), 'utf8'), /expected_tests=1/);
      const commands = fs.readFileSync(path.join(out, 'adb-commands.txt'), 'utf8');
      assert.match(commands, /push .* \/data\/local\/tmp\/lifeos-test-exclusions\.txt/);
      assert.match(commands, /run-as com\.lifeos\.personal cp \/data\/local\/tmp\/lifeos-test-exclusions\.txt \/data\/user\/0\/com\.lifeos\.personal\/files\/lifeos-test-exclusions\.txt/);
      assert.match(commands, /-e notTestFile \/data\/user\/0\/com\.lifeos\.personal\/files\/lifeos-test-exclusions\.txt/);
    }
    if (mode === 'crash') {
      assert.match(fs.readFileSync(path.join(out, 'junit.xml'), 'utf8'), /errors="[1-9]/);
      assert.match(fs.readFileSync(path.join(out, 'logcat-errors.txt'), 'utf8'), /synthetic crash log/);
      assert.match(fs.readFileSync(path.join(out, 'app-exit-info.txt'), 'utf8'), /synthetic process exit information/);
      assert.match(fs.readFileSync(path.join(out, 'instrumentation-exit-info.txt'), 'utf8'), /synthetic process exit information/);
      assert.match(fs.readFileSync(path.join(out, 'google-play-services-exit-info.txt'), 'utf8'), /synthetic process exit information/);
      assert.match(fs.readFileSync(path.join(out, 'system-memory-info.txt'), 'utf8'), /synthetic process memory information/);
      assert.match(fs.readFileSync(path.join(out, 'app-memory-info.txt'), 'utf8'), /synthetic process memory information/);
    }
    console.log(`PASS: Android runner ${mode} contract (simulated ADB only)`);
  }
} finally {
  // Remove only the disposable directory this test created, never repository/device data.
  fs.rmSync(root, { recursive: true });
}
