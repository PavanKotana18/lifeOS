'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { RecoveryExportLifecycle } = require('./src/services/recoveryExportLifecycle.ts');
const { matchesRecoveryCode, normalizeRecoveryCodeInput } = require('./src/services/recoveryCodeConfirmation.ts');

const secret = 'A'.repeat(43); // Synthetic code only.
assert.equal(normalizeRecoveryCodeInput(secret), secret);
assert.equal(normalizeRecoveryCodeInput(` \n${secret.slice(0, 13)}\t${secret.slice(13)}\r `), secret, 'harmless pasted whitespace is normalized');
assert.equal(matchesRecoveryCode(` ${secret}\n`, secret), true);
assert.equal(matchesRecoveryCode('B'.repeat(43), secret), false);
assert.equal(matchesRecoveryCode(`${secret.slice(0, 20)}!${secret.slice(21)}`, secret), false, 'non-format characters are never stripped');
assert.equal(matchesRecoveryCode('A'.repeat(42), secret), false);

const lifecycle = new RecoveryExportLifecycle();
const save = lifecycle.begin(10_000);
assert.equal(lifecycle.isActive(10_001), true);
assert.equal(lifecycle.markInactive(10_002), save.id, 'file picker inactive transition is attached to the active export');
save.release();
assert.equal(lifecycle.pendingResume(10_003), save.id, 'save completion cannot erase the return-authentication marker');
lifecycle.completeResume(save.id);
assert.equal(lifecycle.pendingResume(10_004), null, 'successful authenticated resume consumes the marker');

const cancelled = lifecycle.begin(20_000);
cancelled.release();
assert.equal(lifecycle.isActive(20_001), false, 'a foreground cancellation/failure releases the marker');

const pickerCancelled = lifecycle.begin(30_000);
lifecycle.markInactive(30_001);
pickerCancelled.release();
assert.equal(lifecycle.pendingResume(30_002), pickerCancelled.id, 'native picker cancellation keeps the same screen until return authentication');
lifecycle.completeResume(pickerCancelled.id);

const first = lifecycle.begin(40_000);
lifecycle.markInactive(40_001);
const repeated = lifecycle.begin(40_002);
first.release();
assert.equal(lifecycle.pendingResume(40_003), null, 'a delayed callback from an older operation cannot retain a newer flow');
assert.equal(lifecycle.isActive(40_004), true, 'rapid/repeated saves retain only the newest operation');
repeated.release();

const expired = lifecycle.begin(50_000);
lifecycle.markInactive(50_001);
assert.equal(lifecycle.pendingResume(350_000), null, 'an abandoned picker marker expires within its bounded window');
expired.release();

console.log('Recovery export lifecycle and code confirmation: 15 assertions passed with synthetic recovery material.');
