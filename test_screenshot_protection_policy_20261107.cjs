'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { isSensitiveScreenshotState } = require('./src/services/screenshotProtection.ts');

const ordinary = {
  appReady: true,
  onboardingRequired: false,
  onboardingComplete: true,
  secureSetupOpen: false,
  recoveryOpen: false,
  backupPassphraseOpen: false,
  backupOperationInProgress: false,
  locked: false,
  biometricAuthenticationInProgress: false,
};
assert.equal(isSensitiveScreenshotState(ordinary), false, 'ordinary authenticated LifeOS screens may be captured in debug');
for (const [key, value, label, overrides] of [
  ['appReady', false, 'startup'],
  ['onboardingRequired', true, 'onboarding', { onboardingComplete: false }],
  ['secureSetupOpen', true, 'encryption setup/recovery secrets'],
  ['recoveryOpen', true, 'recovery credentials'],
  ['backupPassphraseOpen', true, 'backup passphrase'],
  ['backupOperationInProgress', true, 'backup data operation'],
  ['locked', true, 'locked/authentication screen'],
  ['biometricAuthenticationInProgress', true, 'biometric prompt'],
]) {
  assert.equal(isSensitiveScreenshotState({ ...ordinary, ...overrides, [key]: value }), true, `${label} must stay protected`);
}
assert.equal(isSensitiveScreenshotState({ ...ordinary, onboardingRequired: true, onboardingComplete: true }), false,
  'completed onboarding is not treated as an active secret screen');
console.log('SCREENSHOT POLICY: ordinary app state is capturable; startup, onboarding, secrets, recovery, backup, lock and biometric states are protected.');
