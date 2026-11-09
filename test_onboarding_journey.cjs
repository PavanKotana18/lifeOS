'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const { normalizeOnboardingJourney, INITIAL_ONBOARDING_JOURNEY } = require('./src/services/onboardingJourney.ts');
const { BOOTSTRAP_SETTING_KEYS } = require('./src/services/encryptedStorageIntegration.ts');
const app = fs.readFileSync('./src/App.tsx', 'utf8');
const onboarding = fs.readFileSync('./src/components/Onboarding.tsx', 'utf8');

assert.deepEqual(normalizeOnboardingJourney(null), INITIAL_ONBOARDING_JOURNEY);
assert.deepEqual(normalizeOnboardingJourney({ version: 1, stage: 'recovery', protection: 'enabled', recovery: 'named', recoveryName: 'Personal', secret: 'ignored' }), {
  version: 1, stage: 'recovery', protection: 'enabled', recovery: 'pending', recoveryName: 'Personal'
});
assert.deepEqual(normalizeOnboardingJourney({ version: 1, stage: 'recovery', protection: 'skipped', recovery: 'skipped', recoveryName: 'old label' }), {
  version: 1, stage: 'protection', protection: 'pending', recovery: 'pending', recoveryName: 'old label'
});
assert.equal(BOOTSTRAP_SETTING_KEYS.has('onboardingNameDraft'), true);
assert.equal(BOOTSTRAP_SETTING_KEYS.has('displayName'), false, 'authoritative profile name is encrypted');

assert.match(app, /encryptedSession\.open\(\{\s*recoveryChoice:\s*'later'\s*\}\)/, 'protection stage provisions the native key while keeping recovery pending');
assert.match(app, /CryptoService\.prepareRecovery\(\)[\s\S]*?requestSecureSetup\(prepared\)[\s\S]*?CryptoService\.confirmRecovery\(\)/, 'recovery stage uses the real native recovery kit and confirmation contract');
assert.match(app, /state\.recoveryProvisioned[\s\S]*?isEncryptedStorageActivated\(\)/, 'Today remains gated until native recovery and encrypted storage verify');
const protectionSetup = app.slice(app.indexOf('const provisionOnboardingProtection'), app.indexOf('const confirmOnboardingRecovery'));
assert.doesNotMatch(protectionSetup, /setSensitiveScreenshotState\(false\)/, 'onboarding remains screenshot-protected through recovery until the workspace opens');
assert.match(app, /onboardingNameDraft[\s\S]*?settings\.set\('displayName'[\s\S]*?settings\.delete\('onboardingNameDraft'\)/, 'temporary name is promoted to encrypted profile storage and removed from bootstrap storage');
assert.match(app, /safeFirstRunState\)\s*\{[\s\S]*?settings\.set\('onboardingJourney', normalizedJourney\)/, 'an incomplete empty installation persists normalized mandatory progress before restart');
assert.match(app, /if \(isEncryptedStorageActivated\(\) && sessionManager\.isUnlocked\(\)\) return;/, 'a successfully protected new user bypasses the legacy first-record prompt');
assert.doesNotMatch(onboarding, /Not now|Set this up later/);
assert.match(onboarding, /Your space\. Just yours\./);
assert.match(onboarding, /Keep a way back\./);
assert.match(onboarding, /Create and save recovery kit/);

console.log('ONBOARDING JOURNEY: required steps, legacy optional-state normalization, encrypted profile promotion, real recovery verification, and private workspace gating passed.');
