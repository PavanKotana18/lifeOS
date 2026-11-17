'use strict';
// Shell/ADB contract simulation only. Never connects to Android or installs APKs.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
function bashExecutable() {
  const candidates = [process.env.BASH, 'bash', 'C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files\\Git\\usr\\bin\\bash.exe'].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error('Android runner contract requires Bash. Install Git for Windows or set BASH to bash.exe.');
}
const BASH = bashExecutable();
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
assert.equal(declaredTests.length, 25, 'Android test inventory changed; update the hosted expected counts deliberately');
for (const [inventory, expectedCount, requiredTest] of [
  ['instrumentation-exclusions-api29.txt', 17, 'com.lifeos.personal.CryptoAcceptanceTest#newInstanceStartsLockedWithoutProvisioning'],
  ['instrumentation-exclusions-api34-35.txt', 22, 'com.lifeos.personal.LifeOSLaunchSmokeTest#activityCreatesLocalCapacitorWebView'],
]) {
  const exclusionPath = path.resolve(__dirname, `../android/qa/${inventory}`);
  const exclusions = fs.readFileSync(exclusionPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  assert.equal(new Set(exclusions).size, exclusions.length, `${inventory} contains duplicates`);
  assert.ok(exclusions.every(test => declaredTests.includes(test)), `${inventory} contains an unknown test`);
  assert.equal(declaredTests.length - exclusions.length, expectedCount, `${inventory} does not match its expected unattended count`);
  assert.ok(declaredTests.includes(requiredTest), `${inventory} required test is not declared`);
  assert.ok(!exclusions.includes(requiredTest), `${inventory} excludes its own required test`);
}
assert.match(instrumentationWorkflow, /android-visual:[\s\S]*script: bash scripts\/run-directed-android-visual\.sh/, 'visual job executes one shell so failure evidence is preserved');
const visualRunner = fs.readFileSync(path.resolve(__dirname, 'run-directed-android-visual.sh'), 'utf8');
assert.match(visualRunner, /ANDROID_EXPECTED_TESTS=1/, 'the excluded visual case has its own mandatory one-test count');
assert.match(visualRunner, /DirectedVisualAcceptanceTest#packagedMandatoryOnboardingScreensAndRestart/, 'the visual runner selects the mandatory onboarding visual case');
const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/workstream-integration.yml'), 'utf8');
assert.match(workflow, /test-filter:\s*\"com\.lifeos\.personal\.WebViewCompatibilityAcceptanceTest#unsupportedEngineShowsNativeUpdateMessage\"/,
  'API 29 filter must name the fully qualified instrumentation class');
assert.match(workflow, /required-test:\s*\"com\.lifeos\.personal\.WebViewCompatibilityAcceptanceTest#unsupportedEngineShowsNativeUpdateMessage\"/,
  'API 29 acceptance gate must require the fully qualified compatibility case');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-runner-contract-'));
try {
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
const sdk = path.join(root, 'sdk'); fs.mkdirSync(path.join(sdk, 'emulator'), { recursive: true });
fs.writeFileSync(path.join(sdk, 'emulator', 'emulator'), `#!/usr/bin/env node\nif(process.argv.includes('-list-avds'))console.log('LifeOS-QA');\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'aapt'), `#!/usr/bin/env node\nif(process.argv.includes('xmltree'))console.log('A: android:targetPackage(0x01010021)="com.lifeos.personal.dev"');else console.log("package: name='"+(process.argv.at(-1).includes('test')?'com.lifeos.personal.dev.test':'com.lifeos.personal.dev')+"'");\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'apksigner'), `#!/usr/bin/env node\nconsole.log('Signer #1 certificate SHA-256 digest: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');\n`, { mode: 0o755 });
  const excluded = path.join(root, 'excluded-tests.txt');
  fs.writeFileSync(excluded, 'com.lifeos.personal.BiometricDeviceAcceptanceTest#actualSetupCancelConcurrentResumeRecreateAndUnlock\n');
  fs.writeFileSync(path.join(bin, 'adb'), `#!/usr/bin/env node
const a=process.argv.slice(2).join(' '),mode=process.env.QA_STUB_MODE;
require('node:fs').appendFileSync(process.env.QA_COMMAND_LOG, a+'\\n');
if(a.includes('get-state')) console.log('device');
else if(a.includes('emu avd name')) console.log('OK\\nLifeOS-QA\\nOK');
else if(a.includes('getprop ro.kernel.qemu')) console.log('1');
else if(a.includes('getprop ro.product.model')) console.log('I2304');
else if(a.includes('getprop ro.product.name')) console.log('I2304T');
else if(a.includes('getprop ro.build.version.release')) console.log('14');
else if(a.includes('getprop ro.build.version.sdk')) console.log('34');
else if(a.includes('shell pm path com.lifeos.personal.dev')) console.log('package:/data/app/~~synthetic/com.lifeos.personal.dev/base.apk');
else if(a.includes('pm list packages')) { if(mode==='existing') console.log('package:com.lifeos.personal.dev'); }
else if(a.includes('shell run-as com.lifeos.personal.dev pwd')) console.log('/data/user/0/com.lifeos.personal.dev');
else if(a.includes('dumpsys activity exit-info')) console.log('synthetic process exit information');
else if(a.includes('dumpsys meminfo')) console.log('synthetic process memory information');
else if(a.includes('logcat -b all -d')) console.log('E/AndroidRuntime: synthetic crash log contact=qa@example.com token=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
else if(a.includes('shell am instrument')) {
 console.log('INSTRUMENTATION_STATUS: numtests=1\\nINSTRUMENTATION_STATUS: class=com.lifeos.personal.LifeOSLaunchSmokeTest\\nINSTRUMENTATION_STATUS: test=activityCreatesLocalCapacitorWebView\\nINSTRUMENTATION_STATUS_CODE: 1');
 if(mode==='crash') console.log('INSTRUMENTATION_RESULT: shortMsg=Process crashed.\\nINSTRUMENTATION_CODE: 0');
 else console.log('INSTRUMENTATION_STATUS: numtests=1\\nINSTRUMENTATION_STATUS: class=com.lifeos.personal.LifeOSLaunchSmokeTest\\nINSTRUMENTATION_STATUS: test=activityCreatesLocalCapacitorWebView\\nINSTRUMENTATION_STATUS_CODE: 0\\nINSTRUMENTATION_CODE: -1');
} else console.log('synthetic adb response');
`, { mode: 0o755 });
  for (const mode of ['pass', 'crash', 'existing']) {
    const out = path.join(root, mode);
    const result = spawnSync(BASH, ['scripts/run-android-instrumentation.sh', 'synthetic-app.apk', 'synthetic-test.apk', out], {
      cwd: path.resolve(__dirname, '..'), timeout: 30000, encoding: 'utf8',
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, ANDROID_HOME: sdk, QA_STUB_MODE: mode, QA_COMMAND_LOG: path.join(out, 'adb-commands.txt'), LIFEOS_QA_DEVICE_MODE: 'emulator', ANDROID_SERIAL: 'emulator-5554', ANDROID_TEST_FILTER: '', ANDROID_REQUIRED_TEST: '', ANDROID_TEST_EXCLUSION_FILE: excluded, ANDROID_EXPECTED_TESTS: '1' },
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
      assert.match(commands, /shell pm grant com\.lifeos\.personal\.dev android\.permission\.POST_NOTIFICATIONS/,
        'the disposable API 34 emulator grants notification permission to the isolated Dev package');
      assert.doesNotMatch(commands, /adb devices(?:\s|-l)|com\.lifeos\.personal(?:\s|$)/,
        'the runner does not enumerate devices or target the protected production package');
      assert.match(commands, /push .* \/data\/local\/tmp\/lifeos-test-exclusions\.txt/);
      assert.match(commands, /run-as com\.lifeos\.personal\.dev cp \/data\/local\/tmp\/lifeos-test-exclusions\.txt \/data\/user\/0\/com\.lifeos\.personal\.dev\/files\/lifeos-test-exclusions\.txt/);
      assert.match(commands, /-e notTestFile \/data\/user\/0\/com\.lifeos\.personal\.dev\/files\/lifeos-test-exclusions\.txt/);
    }
    if (mode === 'crash') {
      assert.match(fs.readFileSync(path.join(out, 'junit.xml'), 'utf8'), /errors="[1-9]/);
      assert.match(fs.readFileSync(path.join(out, 'logcat-errors.txt'), 'utf8'), /synthetic crash log/);
      assert.match(fs.readFileSync(path.join(out, 'logcat-errors.txt'), 'utf8'), /\[redacted-email\]/);
      assert.match(fs.readFileSync(path.join(out, 'logcat-errors.txt'), 'utf8'), /\[redacted-token\]/);
      assert.ok(fs.statSync(path.join(out, 'logcat-errors.txt')).size <= 262144, 'logcat evidence stays within the 256 KiB cap');
      assert.match(fs.readFileSync(path.join(out, 'app-exit-info.txt'), 'utf8'), /synthetic process exit information/);
      assert.match(fs.readFileSync(path.join(out, 'instrumentation-exit-info.txt'), 'utf8'), /synthetic process exit information/);
      assert.match(fs.readFileSync(path.join(out, 'google-play-services-exit-info.txt'), 'utf8'), /synthetic process exit information/);
      assert.match(fs.readFileSync(path.join(out, 'system-memory-info.txt'), 'utf8'), /synthetic process memory information/);
      assert.match(fs.readFileSync(path.join(out, 'app-memory-info.txt'), 'utf8'), /synthetic process memory information/);
    }
    console.log(`PASS: Android runner ${mode} contract (simulated ADB only)`);
  }
  {
    const out = path.join(root, 'physical-refused');
    const commands = path.join(root, 'physical-refused-commands.txt');
    const result = spawnSync(BASH, ['scripts/run-android-instrumentation.sh', 'synthetic-app.apk', 'synthetic-test.apk', out], {
      cwd: path.resolve(__dirname, '..'), timeout: 30000, encoding: 'utf8',
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, QA_STUB_MODE: 'selected-physical', QA_COMMAND_LOG: commands, ANDROID_SERIAL: 'physical-qa', LIFEOS_QA_DEVICE_MODE: 'physical' },
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, 'physical mode must be rejected');
    assert.match(result.stderr, /emulator targets only/);
    assert.ok(!fs.existsSync(commands) || fs.readFileSync(commands, 'utf8') === '', 'physical serial is rejected before any ADB call');
    console.log('PASS: Android runner refuses physical mode before any ADB call');
  }
  for (const mode of ['pass','crash','physical']) {
    const directory=path.join(root,'visual-'+mode);fs.mkdirSync(path.join(directory,'scripts'),{recursive:true});
    fs.writeFileSync(path.join(directory,'scripts/run-android-instrumentation.sh'), `#!/usr/bin/env bash
mkdir -p qa-visual-evidence
if [[ "$QA_STUB_MODE" != physical ]]; then echo synthetic > qa-visual-evidence/device-profile.txt; fi
if [[ "$QA_STUB_MODE" == crash ]]; then exit 17; fi
exit 0
`);
    const commands=path.join(directory,'commands.txt');
    const result=spawnSync(BASH,[path.resolve(__dirname,'run-directed-android-visual.sh')],{cwd:directory,encoding:'utf8',timeout:30000,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,QA_STUB_MODE:mode,QA_COMMAND_LOG:commands}});
    assert.ifError(result.error);assert.equal(result.status,mode==='pass'?0:mode==='crash'?17:1);
    const log=fs.existsSync(commands)?fs.readFileSync(commands,'utf8'):'';
    assert.equal(log.includes(' pull '),mode!=='physical','only a freshly admitted emulator may export visual captures, including failed assertions');
    console.log(`PASS: Visual runner ${mode} evidence and exit status (simulated ADB only)`);
  }
} finally {
  // Remove only the disposable directory this test created, never repository/device data.
  fs.rmSync(root, { recursive: true });
}
