'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const { normalizeOnboardingJourney, INITIAL_ONBOARDING_JOURNEY, ONBOARDING_NOTIFICATIONS_STEP, resumeOnboardingStep } = require('./src/services/onboardingJourney.ts');
const { BOOTSTRAP_SETTING_KEYS } = require('./src/services/encryptedStorageIntegration.ts');
const app = fs.readFileSync('./src/App.tsx', 'utf8');
const onboarding = fs.readFileSync('./src/components/Onboarding.tsx', 'utf8');

assert.deepEqual(normalizeOnboardingJourney(null), INITIAL_ONBOARDING_JOURNEY);
assert.deepEqual(normalizeOnboardingJourney({ version: 1, stage: 'recovery', protection: 'enabled', recovery: 'named', recoveryName: 'Personal', secret: 'ignored' }), {
  version: 2, stage: 'recovery', protection: 'enabled', recovery: 'pending', recoveryName: 'Personal'
});
assert.deepEqual(normalizeOnboardingJourney({ version: 1, stage: 'recovery', protection: 'skipped', recovery: 'skipped', recoveryName: 'old label' }), {
  version: 2, stage: 'protection', protection: 'pending', recovery: 'pending', recoveryName: 'old label'
});
assert.equal(BOOTSTRAP_SETTING_KEYS.has('onboardingNameDraft'), true);
assert.equal(BOOTSTRAP_SETTING_KEYS.has('displayName'), false, 'authoritative profile name is encrypted');

assert.match(app, /encryptedSession\.open\(\{\s*recoveryChoice:\s*'later'\s*\}\)/, 'protection stage provisions the native key while keeping recovery pending');
assert.match(app, /CryptoService\.prepareRecovery\(\)[\s\S]*?requestSecureSetup\(prepared\)[\s\S]*?CryptoService\.confirmRecovery\(\)/, 'recovery stage uses the real native recovery kit and confirmation contract');
assert.match(app, /const safeToBrowse = !state\.keyProvisioned[\s\S]*?const secureWorkspaceOpen = state\.metadataConsistent/, 'first launch may finish into an empty workspace while protected writes remain gated');
const protectionSetup = app.slice(app.indexOf('const provisionOnboardingProtection'), app.indexOf('const confirmOnboardingRecovery'));
assert.doesNotMatch(protectionSetup, /setSensitiveScreenshotState\(false\)/, 'onboarding remains screenshot-protected through recovery until the workspace opens');
assert.match(app, /onboardingNameDraft[\s\S]*?settings\.set\('displayName'[\s\S]*?settings\.delete\('onboardingNameDraft'\)/, 'temporary name is promoted to encrypted profile storage and removed from bootstrap storage');
assert.match(app, /safeFirstRunState\)\s*\{[\s\S]*?safeFirstRunBrowse\.current = true/, 'an empty installation can browse before provisioning encrypted storage');
assert.match(app, /if \(isEncryptedStorageActivated\(\) && sessionManager\.isUnlocked\(\)\) return;/, 'protected writes reuse the verified encrypted workspace');
const finish = app.slice(app.indexOf('const finishOnboarding'), app.indexOf('const processPendingTaskNotification'));
assert.match(finish, /notificationDefaultsPending/);
assert.equal(resumeOnboardingStep(1, 1), ONBOARDING_NOTIFICATIONS_STEP);
assert.equal(resumeOnboardingStep(2, 1), 2);
assert.equal(resumeOnboardingStep(1, 2), 1);
assert.match(app, /onNotifications=\{acceptOnboardingNotifications\}/);
assert.match(onboarding, /onSaveIdentity[\s\S]*?onStep\(ONBOARDING_NOTIFICATIONS_STEP\)/);
assert.ok(onboarding.indexOf('<h1>Notifications</h1>') < onboarding.indexOf('<h1>Biometric setup</h1>'));
assert.match(onboarding, /Biometric setup[\s\S]*?onProtect\(\)[\s\S]*?onStep\(2\)[\s\S]*?Recovery setup[\s\S]*?onRecover\(\)/);
console.log('ONBOARDING: identity, protection, recovery and explicit notification opt-in contracts passed.');
