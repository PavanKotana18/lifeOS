'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const localAppData = process.env.LOCALAPPDATA || path.join(require('node:os').homedir(), 'AppData', 'Local');
const toolsDir = path.join(localAppData, 'Programs', 'LifeOS-Tools');
const defaultSdk = path.join(localAppData, 'Android', 'Sdk');
const defaultAvdHome = 'D:\\LifeOS-Android-QA\\avd';
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).formatToParts(new Date()).reduce((result, part) => (result[part.type] = part.value, result), {});
const runId = `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
let branch = 'unknown';
try { branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* report unknown */ }
const out = path.join(localAppData, 'LifeOS', 'qa-reports', runId);
fs.mkdirSync(out, { recursive: true });
const checks = [];

function add(label, status, detail, evidence) {
  checks.push({ label, status, detail, evidence: evidence || '' });
}

function environmentWithoutSigning() {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith('LIFEOS_DEBUG_KEY') || name.startsWith('ANDROID_KEY')) delete env[name];
  }
  return env;
}

function run(label, command, args, logName, timeoutMs = 30 * 60 * 1000, options = {}) {
  const logPath = path.join(out, logName);
  const log = fs.createWriteStream(logPath, { flags: 'w' });
  return new Promise(resolve => {
    let settled = false;
    const child = spawn(command, args, {
      cwd: root, windowsHide: true,
      shell: options.shell ?? (process.platform === 'win32' && (command === 'npm' || command === 'npx' || /\.(?:bat|cmd)$/i.test(command))),
      env: options.env || environmentWithoutSigning(), stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      log.end();
      resolve({ ...result, logPath });
    };
    const timer = setTimeout(() => {
      child.kill();
      log.write('\nQA timeout reached.\n');
      finish({ status: 'FAIL', detail: `Timed out after ${Math.round(timeoutMs / 60000)} minutes.` });
    }, timeoutMs);
    const save = chunk => log.write(chunk);
    child.stdout.on('data', save);
    child.stderr.on('data', save);
    child.on('error', error => {
      clearTimeout(timer);
      log.write(`${error.name}: ${error.message}\n`);
      finish({ status: 'FAIL', detail: error.message });
    });
    child.on('close', code => {
      clearTimeout(timer);
      finish({ status: code === 0 ? 'PASS' : 'FAIL', detail: `Exit code ${code}.` });
    });
  });
}

async function commandCheck(label, command, args, file, timeoutMs) {
  const result = await run(label, command, args, file, timeoutMs);
  add(label, result.status, result.detail, path.basename(result.logPath));
  console.log(`${result.status}: ${label} (${result.detail})`);
  return result;
}

function findOnPath(names) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const name of names) {
    for (const dir of dirs) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function findJava() {
  const candidates = [];
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'));
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (dir) candidates.push(path.join(dir, process.platform === 'win32' ? 'java.exe' : 'java'));
  }
  if (process.platform === 'win32') {
    for (const base of ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java']) {
      if (!fs.existsSync(base)) continue;
      for (const name of fs.readdirSync(base).sort().reverse()) candidates.push(path.join(base, name, 'bin', 'java.exe'));
    }
  }
  const java = candidates.find(candidate => fs.existsSync(candidate));
  return java ? { executable: java, home: path.dirname(path.dirname(java)) } : null;
}

function findGradle() {
  if (process.platform === 'win32') {
    const local = path.join(toolsDir, 'gradle-8.2.1', 'bin', 'gradle.bat');
    if (fs.existsSync(local)) return local;
  }
  const pathGradle = findOnPath(process.platform === 'win32' ? ['gradle.bat', 'gradle.exe', 'gradle'] : ['gradle']);
  return pathGradle;
}

function environmentForAndroid(sdk, java, gradle, buildTools, avdHome) {
  const env = environmentWithoutSigning();
  env.ANDROID_HOME = sdk;
  env.ANDROID_SDK_ROOT = sdk;
  env.ANDROID_AVD_HOME = avdHome;
  env.JAVA_HOME = java.home;
  env.PATH = [
    java.home && path.join(java.home, 'bin'),
    path.join(sdk, 'platform-tools'),
    path.join(sdk, 'emulator'),
    path.join(sdk, 'cmdline-tools', 'latest', 'bin'),
    buildTools,
    gradle && path.dirname(gradle),
    process.env.PATH || '',
  ].filter(Boolean).join(path.delimiter);
  return env;
}

function findBash() {
  const onPath = findOnPath(process.platform === 'win32' ? ['bash.exe', 'bash'] : ['bash']);
  if (onPath) return onPath;
  if (process.platform === 'win32') {
    for (const candidate of ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files\\Git\\usr\\bin\\bash.exe']) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function runCaptured(executable, args, logName = 'android-instrumentation.log', env = environmentWithoutSigning()) {
  return new Promise(resolve => {
    const log = path.join(out, logName);
    const stream = fs.createWriteStream(log, { flags: 'a' });
    const child = spawn(executable, args, { cwd: root, windowsHide: true, shell: process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(executable), env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(stream);
    child.stderr.pipe(stream);
    child.on('error', error => { stream.end(`${error.message}\n`); resolve({ code: 127, log }); });
    child.on('close', code => { stream.end(); resolve({ code, log }); });
  });
}

async function main() {
  console.log(`LifeOS local QA report: ${out}`);
  await commandCheck('Automated JavaScript suite', 'npm', ['test'], 'npm-test.log');
  await commandCheck('Sentinel security and resilience suite', 'npm', ['run', 'test:sentinel'], 'sentinel.log');
  await commandCheck('TypeScript', 'npx', ['--no-install', 'tsc', '--noEmit'], 'typescript.log');
  const webBuild = await commandCheck('Vite web build', 'npm', ['run', 'build'], 'web-build.log');
  const capacitorSync = webBuild.status === 'PASS'
    ? await commandCheck('Capacitor Android sync', 'npx', ['--no-install', 'cap', 'sync', 'android'], 'cap-sync.log')
    : null;
  await commandCheck('Android instrumentation parser self-test', 'node', ['scripts/android-instrumentation-to-junit.cjs', '--self-test'], 'android-parser.log');

  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || defaultSdk;
  const gradle = findGradle();
  const java = findJava();
  const buildTools = path.join(sdk, 'build-tools');
  const versions = fs.existsSync(buildTools)
    ? fs.readdirSync(buildTools).filter(name => fs.existsSync(path.join(buildTools, name, 'aapt' + (process.platform === 'win32' ? '.exe' : '')))).sort().reverse()
    : [];
  const aapt = versions[0] && path.join(buildTools, versions[0], 'aapt' + (process.platform === 'win32' ? '.exe' : ''));
  const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  const emulator = path.join(sdk, 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator');
  const androidImage = path.join(sdk, 'system-images', 'android-34', 'google_apis', 'x86_64', 'package.xml');
  const androidPlatform = path.join(sdk, 'platforms', 'android-34');
  const avdHome = process.env.ANDROID_AVD_HOME || defaultAvdHome;
  const androidToolsEnv = environmentForAndroid(sdk, java || { home: '' }, gradle, aapt ? path.dirname(aapt) : '', avdHome);

  let gradleReady = false;
  if (gradle) {
    const result = await run('Gradle version probe', gradle, ['--version'], 'gradle-version.log', 60000, { env: androidToolsEnv });
    const output = fs.readFileSync(result.logPath, 'utf8');
    gradleReady = result.status === 'PASS' && /Gradle 8\.2\.1\b/.test(output);
    add('Gradle 8.2.1 discovery', gradleReady ? 'PASS' : 'FAIL', gradleReady ? 'Found the installed Gradle 8.2.1 distribution; no global PATH change used.' : 'Gradle executable ran but did not report the required 8.2.1 version.', path.basename(result.logPath));
  } else {
    add('Gradle 8.2.1 discovery', 'BLOCKED', `Not found at ${path.join(toolsDir, 'gradle-8.2.1', 'bin', 'gradle.bat')} or on PATH.`, '');
  }

  let javaReady = false;
  if (java) {
    const result = await run('Java version probe', java.executable, ['-version'], 'java-version.log', 30000, { env: androidToolsEnv });
    const output = fs.readFileSync(result.logPath, 'utf8');
    javaReady = result.status === 'PASS' && /version "17(?:\.|\s)|openjdk 17\b/i.test(output);
    add('Java 17 discovery', javaReady ? 'PASS' : 'FAIL', javaReady ? 'Found Java 17 and selected it for Gradle through child-process JAVA_HOME.' : 'Java executable ran but did not report Java 17.', path.basename(result.logPath));
  } else {
    add('Java 17 discovery', 'BLOCKED', 'Java 17 was not found from JAVA_HOME, PATH, or the installed Windows JDK locations.', '');
  }

  const sdkReady = fs.existsSync(adb) && Boolean(aapt) && fs.existsSync(androidPlatform) && fs.existsSync(emulator) && fs.existsSync(androidImage);
  add('Android SDK 34 readiness', sdkReady ? 'PASS' : 'BLOCKED', sdkReady ? 'Platform-tools, build-tools/aapt, platform 34, Emulator, and API 34 Google APIs x86_64 image are present.' : 'A required platform-tools, build-tools/aapt, platform 34, Emulator, or API 34 Google APIs x86_64 image component is missing.', '');

  const deviceMode = process.env.LIFEOS_QA_DEVICE_MODE || 'emulator';
  const requestedSerial = process.env.ANDROID_SERIAL?.trim() || '';
  let selectedDeviceReady = false;
  if (deviceMode !== 'emulator') {
    add('Explicit Android emulator selection', 'FAIL', 'This QA runner supports emulator targets only; physical device mode is prohibited.', '');
  } else if (!sdkReady) {
    add('Explicit Android emulator selection', 'BLOCKED', 'Cannot validate a running emulator because the Android SDK is incomplete.', '');
  } else if (!requestedSerial) {
    add('Explicit Android emulator selection', 'BLOCKED', 'No explicit emulator serial supplied. Start the disposable LifeOS-QA AVD and set ANDROID_SERIAL to its emulator-NNNN serial; no devices are enumerated.', '');
  } else if (!/^emulator-\d+$/.test(requestedSerial)) {
    add('Explicit Android emulator selection', 'FAIL', `Refused serial ${requestedSerial}: physical Android serials are prohibited.`, '');
  } else {
    const state = await runCaptured(adb, ['-s', requestedSerial, 'get-state'], 'selected-emulator-state.txt', androidToolsEnv);
    const stateValue = fs.readFileSync(state.log, 'utf8').trim();
    if (state.code !== 0 || stateValue !== 'device') {
      add('Explicit Android emulator selection', 'BLOCKED', `Selected emulator serial ${requestedSerial} is not online; no other target was queried.`, path.basename(state.log));
    } else {
      const qemu = await runCaptured(adb, ['-s', requestedSerial, 'shell', 'getprop', 'ro.kernel.qemu'], 'selected-emulator-qemu.txt', androidToolsEnv);
      const qemuValue = fs.readFileSync(qemu.log, 'utf8').trim();
      const avd = await runCaptured(adb, ['-s', requestedSerial, 'emu', 'avd', 'name'], 'selected-emulator-avd.txt', androidToolsEnv);
      const avdValue = fs.readFileSync(avd.log, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && line !== 'OK')[0] || '';
      const avdList = await runCaptured(path.join(sdk, 'emulator', 'emulator.exe'), ['-list-avds'], 'available-avds.txt', androidToolsEnv);
      const knownAvd = fs.readFileSync(avdList.log, 'utf8').split(/\r?\n/).map(line => line.trim()).includes(avdValue);
      fs.writeFileSync(path.join(out, 'selected-emulator.txt'), `serial=${requestedSerial}\navd=${avdValue}\nqemu=${qemuValue}\n`);
      if (qemu.code !== 0 || avd.code !== 0 || avdList.code !== 0 || qemuValue !== '1' || !avdValue || !knownAvd) {
        add('Explicit Android emulator selection', 'FAIL', 'Selected serial did not validate as a running AVD known to this SDK; no install was attempted.', 'selected-emulator.txt');
      } else {
        selectedDeviceReady = true;
        add('Explicit Android emulator selection', 'PASS', `ADB serial ${requestedSerial} maps to running AVD ${avdValue}; no global device list was queried.`, 'selected-emulator.txt');
      }
    }
  }

  const preBuildBlockers = [];
  if (capacitorSync?.status !== 'PASS') preBuildBlockers.push('fresh Capacitor Android assets unavailable');
  if (!gradleReady) preBuildBlockers.push('Gradle 8.2.1 unavailable or failed version validation');
  if (!javaReady) preBuildBlockers.push('Java 17 unavailable or failed version validation');
  if (!sdkReady) preBuildBlockers.push('Android SDK 34 incomplete');
  if (preBuildBlockers.length) {
    const reason = preBuildBlockers.join('; ');
    add('Android Debug APK build', 'BLOCKED', reason, '');
    add('Android instrumentation', 'BLOCKED', 'No freshly built Debug app and instrumentation APKs; no install was attempted.', '');
    add('Native notification OS post and tap', 'BLOCKED', 'Instrumentation did not run; permission-dependent checks remain unexecuted.', '');
    console.log(`BLOCKED: Android build/instrumentation (${reason})`);
  } else {
    const gradleCommand = gradle;
    const gradleArgs = ['-p', path.join(root, 'android'), '--no-daemon', ':app:assembleDebug', ':app:assembleDebugAndroidTest'];
    const build = await run('Android Debug APK build', gradleCommand, gradleArgs, 'android-build.log', 45 * 60 * 1000, {
      env: androidToolsEnv,
    });
    if (build.status !== 'PASS') {
      add('Android Debug APK build', 'FAIL', build.detail, path.basename(build.logPath));
      add('Android instrumentation', 'BLOCKED', 'APK build did not complete.', '');
      add('Native notification OS post and tap', 'BLOCKED', 'Instrumentation did not run.', '');
      console.log(`FAIL: Android Debug APK build (${build.detail})`);
    } else {
      const appApk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
      const testApk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'androidTest', 'debug', 'app-debug-androidTest.apk');
      const appInfo = await runCaptured(aapt, ['dump', 'badging', appApk], 'app-apk-badging.txt', androidToolsEnv);
      const testInfo = await runCaptured(aapt, ['dump', 'badging', testApk], 'test-apk-badging.txt', androidToolsEnv);
      const targetInfo = await runCaptured(aapt, ['dump', 'xmltree', testApk, 'AndroidManifest.xml'], 'test-apk-manifest.txt', androidToolsEnv);
      const appText = appInfo ? fs.readFileSync(appInfo.log, 'utf8') : '';
      const testText = testInfo ? fs.readFileSync(testInfo.log, 'utf8') : '';
      const targetText = targetInfo ? fs.readFileSync(targetInfo.log, 'utf8') : '';
      const appId = (appText.match(/^package: name='([^']+)'/m) || [])[1] || '';
      const testId = (testText.match(/^package: name='([^']+)'/m) || [])[1] || '';
      const testTarget = (targetText.match(/android:targetPackage[^=]*="([^"]+)"/) || [])[1] || '';
      fs.writeFileSync(path.join(out, 'apk-package.txt'), `app=${appId}\ninstrumentation_apk=${testId}\ninstrumentation_target=${testTarget}\n`);
      if (appId !== 'com.lifeos.personal.debug' || testId !== 'com.lifeos.personal.debug.test' || testTarget !== 'com.lifeos.personal.debug') {
        add('Android Debug APK identity', 'FAIL', `Expected app ID and instrumentation target com.lifeos.personal.debug; found app=${appId || 'unknown'}, test APK=${testId || 'unknown'}, target=${testTarget || 'unknown'}. No APK was installed.`, 'apk-package.txt');
        add('Android instrumentation', 'BLOCKED', 'APK package identity verification failed; no install was attempted.', '');
        add('Native notification OS post and tap', 'BLOCKED', 'Instrumentation did not run.', '');
        console.log(`FAIL: APK identity check (app=${appId || 'unknown'}, test=${testId || 'unknown'}); no install attempted.`);
      } else if (!selectedDeviceReady) {
        add('Android instrumentation', 'BLOCKED', 'No explicitly selected and validated device is available; no device install was attempted.', '');
        add('Native notification OS post and tap', 'BLOCKED', 'Instrumentation did not run.', '');
        console.log('BLOCKED: Android instrumentation (no validated explicit device selection).');
      } else {
        const serial = requestedSerial;
        const state = await runCaptured(adb, ['-s', serial, 'get-state'], 'emulator-state-before-install.txt', androidToolsEnv);
        if (state.code !== 0 || fs.readFileSync(state.log, 'utf8').trim() !== 'device') {
          add('Android instrumentation', 'BLOCKED', 'Selected emulator disconnected after preflight; no install was attempted.', path.basename(state.log));
          add('Native notification OS post and tap', 'BLOCKED', 'Instrumentation did not run.', '');
          console.log('BLOCKED: Android instrumentation (selected serial is no longer connected).');
        } else {
          const env = {
            ...androidToolsEnv, ANDROID_SERIAL: serial, LIFEOS_QA_DEVICE_MODE: deviceMode,
            ANDROID_TEST_FILTER: [
              'com.lifeos.personal.LocalNotificationBridgeAcceptanceTest#registeredPluginCanScheduleAndReadBackSyntheticTaskReminder',
              'com.lifeos.personal.LocalNotificationBridgeAcceptanceTest#backgroundedSyntheticTaskReminderIsActuallyPosted',
              'com.lifeos.personal.NotificationTapLaunchAcceptanceTest#coldStartTaskActionIsAvailableUntilJavascriptAcknowledgesIt',
            ].join(','),
            ANDROID_REQUIRED_TEST: 'NotificationTapLaunchAcceptanceTest#coldStartTaskActionIsAvailableUntilJavascriptAcknowledgesIt',
            ANDROID_EXPECTED_TESTS: '3',
          };
          const shell = findBash();
          if (!shell) {
            add('Android instrumentation', 'BLOCKED', 'Bash is unavailable to invoke the guarded instrumentation runner.', '');
            add('Native notification OS post and tap', 'BLOCKED', 'Instrumentation did not run.', '');
            console.log('BLOCKED: Android instrumentation (Bash unavailable).');
          } else {
            const instrument = await new Promise(resolve => {
              const stream = fs.createWriteStream(path.join(out, 'android-instrumentation.log'));
              const child = spawn(shell, ['scripts/run-android-instrumentation.sh', appApk, testApk, out], { cwd: root, windowsHide: true, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
              child.stdout.pipe(stream); child.stderr.pipe(stream);
              child.on('error', error => { stream.end(`${error.message}\n`); resolve({ code: 127 }); });
              child.on('close', code => { stream.end(); resolve({ code }); });
            });
            const junit = path.join(out, 'junit.xml');
            const junitText = fs.existsSync(junit) ? fs.readFileSync(junit, 'utf8') : '';
            const skips = Number((junitText.match(/skipped="(\d+)"/) || [])[1] || 0);
            add('Android instrumentation', instrument.code === 0 ? 'PASS' : 'FAIL', `Exit code ${instrument.code}; JUnit evidence ${fs.existsSync(junit) ? 'written' : 'missing'}.`, 'junit.xml');
            add('Native notification OS post and tap', instrument.code !== 0 ? 'FAIL' : skips ? 'BLOCKED' : 'PASS', skips ? 'Permission-dependent scheduling/post/tap instrumentation was skipped; notification permission was not granted automatically.' : 'Synthetic reminder was scheduled, posted by Android, and its content tap reached the app action listener.', 'junit.xml');
            console.log(`${instrument.code === 0 ? 'PASS' : 'FAIL'}: Android instrumentation (exit ${instrument.code}, skipped ${skips}).`);
          }
        }
      }
    }
  }

  const failures = checks.filter(check => check.status === 'FAIL');
  const blocked = checks.filter(check => check.status === 'BLOCKED');
  const summary = {
    runId, branch, workspace: root,
    summary: { pass: checks.filter(check => check.status === 'PASS').length, fail: failures.length, blocked: blocked.length },
    checks,
  };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(summary, null, 2) + '\n');
  const lines = [
    '# LifeOS local QA report', '', `Run: ${runId}`, `Branch: ${branch}`, `Workspace: ${root}`, '',
    '| Check | Status | Detail | Evidence |', '|---|---|---|---|',
    ...checks.map(check => `| ${check.label} | ${check.status} | ${check.detail.replaceAll('|', '\\|')} | ${check.evidence || '—'} |`),
    '', `Summary: ${summary.summary.pass} PASS, ${summary.summary.fail} FAIL, ${summary.summary.blocked} BLOCKED.`,
    '', 'BLOCKED checks are incomplete and are never counted as PASS.',
  ];
  fs.writeFileSync(path.join(out, 'report.md'), lines.join('\n') + '\n');
  console.log(`Report: ${path.join(out, 'report.md')}`);
  if (failures.length) process.exitCode = 1;
  else if (blocked.length) process.exitCode = 2;
}

main().catch(error => {
  fs.writeFileSync(path.join(out, 'fatal-error.txt'), `${error.stack || error}\n`);
  console.error(`QA runner failed unexpectedly: ${error.message}`);
  process.exitCode = 1;
});
