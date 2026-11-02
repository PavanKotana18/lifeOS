const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');

const initStart = app.indexOf('const initApp = async () => {');
const initEnd = app.indexOf(
  'const effectiveNotificationPreferences',
  initStart
);

assert.ok(initStart >= 0 && initEnd > initStart, 'Startup block must exist');

const init = app.slice(initStart, initEnd);

const resumeStart = app.indexOf(
  "CapacitorApp.addListener('appStateChange'"
);
const resumeEnd = app.indexOf('}).then(async listener', resumeStart);

assert.ok(resumeStart >= 0 && resumeEnd > resumeStart, 'Resume block must exist');

const resume = app.slice(resumeStart, resumeEnd);

let passed = 0;

function check(name, condition) {
  assert.ok(condition, name);
  passed++;
  console.log(`PASS: ${name}`);
}

const startupAuth = init.indexOf(
  'const authenticated = await triggerBiometricAuth();'
);
const startupReload = init.indexOf('await reloadAllData()');
const startupSchedule = init.indexOf('await syncNotificationSchedules(');

check(
  'Startup awaits biometric authentication before loading records',
  startupAuth >= 0 && startupAuth < startupReload
);

check(
  'Startup authentication failure returns before loading records',
  /if\s*\(!authenticated\s*\|\|\s*!biometricAuthenticated\.current\s*\|\|\s*!sessionManager\.isUnlocked\(\)\)\s*\{[\s\S]*?setAppReady\(true\);[\s\S]*?return;[\s\S]*?\}/.test(init) &&
  startupAuth < startupReload
);

check(
  'Startup schedules notifications only after protected records load',
  startupReload >= 0 && startupSchedule > startupReload
);

check(
  'Startup rechecks authentication state before loading records',
  /if\s*\(!sessionManager\.isUnlocked\(\)\)\s*\{[\s\S]*?return;[\s\S]*?\}/.test(init)
);

const resumeAuth = resume.indexOf(
  'const authenticated = await triggerBiometricAuth();'
);
const resumeReload = resume.indexOf('await reloadAllData()');
const resumeSchedule = resume.indexOf('await syncNotificationSchedules(');

check(
  'Resume awaits authentication before loading records',
  resumeAuth >= 0 && resumeAuth < resumeReload
);

check(
  'Failed or stale resume authentication stops protected data loading',
  /if\s*\(!authenticated\s*\|\|\s*!biometricAuthenticated\.current\s*\|\|\s*disposed\)\s*return;/.test(resume)
);

check(
  'Resume unlocks the session when biometric protection is disabled',
  /if\s*\(!isBio\)\s*sessionManager\.unlock\(\);/.test(resume) &&
  resume.indexOf('sessionManager.unlock()') < resume.indexOf('sessionManager.isUnlocked()') &&
  resume.indexOf('sessionManager.isUnlocked()') < resumeReload
);

check(
  'Resume independently rejects a locked session before data loading',
  /if\s*\(!sessionManager\.isUnlocked\(\)\)\s*return;/.test(resume) &&
  resumeReload > resumeAuth
);

check(
  'Resume schedules notifications only after successful data loading',
  resumeReload >= 0 && resumeSchedule > resumeReload
);

check(
  'Resume lifecycle continues to reject disposed callbacks',
  resume.includes('if (disposed) return;')
);

console.log(`AUTHENTICATION LIFECYCLE TESTS: ${passed}/10 PASSED`);
