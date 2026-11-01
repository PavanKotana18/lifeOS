const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync(
  'android/app/src/main/java/com/lifeos/personal/LifeOSCryptoPlugin.java',
  'utf8'
);

function section(start, end) {
  const a = source.indexOf(start);
  assert.notStrictEqual(a, -1, `Missing method: ${start}`);

  const b = source.indexOf(end, a + start.length);
  assert.notStrictEqual(b, -1, `Missing section boundary: ${end}`);

  return source.slice(a, b);
}

const recovery = section(
  'public void recoverWithSecret(PluginCall call)',
  '@PluginMethod\n    public void rebindLocalKey'
);

const rebind = section(
  'public void rebindLocalKey(PluginCall call)',
  '@PluginMethod\n    public void setup'
);

const keyAccess = section(
  'private byte[] getDataKey()',
  'private void clearDataKey()'
);

const status = section(
  'public void isUnlocked(PluginCall call)',
  'private long getLockGeneration()'
);

const clearStart = source.indexOf('private void clearDataKey()');
assert.notStrictEqual(clearStart, -1, 'Missing clearDataKey method');

const clearEnd = source.indexOf('\n    }', clearStart);
assert.notStrictEqual(clearEnd, -1, 'Cannot locate clearDataKey method end');

const clear = source.slice(clearStart, clearEnd);

assert.match(
  recovery,
  /dataKey\s*=\s*recovered\.clone\(\)\s*;\s*recoveryNeedsRebind\s*=\s*true\s*;/,
  'Recovery must install the key in quarantine'
);
console.log('PASS: Recovered key enters quarantine');

assert.match(
  keyAccess,
  /dataKey\s*==\s*null\s*\|\|\s*recoveryNeedsRebind/,
  'Normal crypto key access must reject quarantined keys'
);
console.log('PASS: Normal crypto operations cannot access quarantined keys');

assert.match(
  status,
  /dataKey\s*!=\s*null\s*&&\s*!recoveryNeedsRebind/,
  'Quarantined key must not report unlocked'
);
console.log('PASS: Quarantined recovery does not report unlocked');

const persistedAt = rebind.indexOf('if (!persisted)');
const releaseAt = rebind.indexOf('recoveryNeedsRebind = false;');
assert(persistedAt !== -1, 'Rebind must check persistence result');
assert(releaseAt > persistedAt, 'Quarantine must release after persistence check');
console.log('PASS: Rebind releases quarantine only after persistence succeeds');

assert.match(
  rebind,
  /final byte\[\] keyCopy\s*=\s*key\.clone\(\)/,
  'Async rebind must own an independent key copy'
);
assert.match(
  rebind,
  /Arrays\.fill\(keyCopy,\s*\(byte\)\s*0\)/,
  'Async rebind must clear its key copy'
);
console.log('PASS: Async rebind clones and clears its key copy');

assert.match(
  clear,
  /dataKey\s*=\s*null\s*;[\s\S]*?recoveryNeedsRebind\s*=\s*false\s*;/,
  'Clearing key must also clear quarantine state'
);
console.log('PASS: Key clearing resets quarantine');

assert.match(source, /recoveryNeedsRebind\s*=\s*false\s*;/);
console.log('PASS: Native source contains normal-state reset paths');


const invalidation = section(
  'private boolean isPermanentlyInvalidated',
  'private void runFailure'
);

const recoveryKeyFactory = section(
  'private SecretKey getOrCreateMasterKeyForRecovery()',
  'private void runFailure'
);

assert.match(
  invalidation,
  /KeyPermanentlyInvalidatedException/,
  'Only permanent Android Keystore invalidation should qualify for alias deletion'
);
console.log('PASS: Keystore invalidation detection is specific');

assert.match(
  recoveryKeyFactory,
  /if\s*\(!isPermanentlyInvalidated\(e\)\)\s*\{\s*throw e;/,
  'Generic Keystore failures must not delete the alias'
);
assert.match(
  recoveryKeyFactory,
  /store\.deleteEntry\(KEY_ALIAS\)/,
  'Permanently invalidated aliases must be replaceable'
);
console.log('PASS: Only permanently invalidated aliases are deleted');

assert.match(
  recoveryKeyFactory,
  /healthy local wrapper already exists; refusing replacement/,
  'Healthy existing wrappers must not be overwritten'
);
console.log('PASS: Healthy local wrapper replacement is blocked');

assert.match(
  recoveryKeyFactory,
  /if\s*\(!cleared\)\s*\{\s*throw new IllegalStateException/,
  'Wrapper metadata cleanup must verify persistence'
);
console.log('PASS: Recovery metadata cleanup checks persistence');

console.log('\nNATIVE RECOVERY SOURCE TESTS: 11/11 PASSED');


const keyState = section(
  'public void getKeyState(PluginCall call)',
  'public void isUnlocked(PluginCall call)'
);

assert.match(keyState, /keyProvisioned/);
assert.match(keyState, /recoveryProvisioned/);
assert.match(keyState, /recoveryNeedsRebind/);
assert.match(keyState, /metadataConsistent/);
assert.match(keyState, /dataKey\s*!=\s*null\s*&&\s*!recoveryNeedsRebind/);
assert.match(keyState, /cryptoLock\.readLock\(\)\.lock\(\)/);
assert.match(keyState, /cryptoLock\.readLock\(\)\.unlock\(\)/);
console.log('PASS: Native key-state inspection is read-only and lock-protected');

assert.match(
  keyState,
  /RECOVERY_KDF_ITERATIONS/,
  'Recovery state must verify the supported KDF iteration count'
);
console.log('PASS: Recovery metadata checks the supported KDF version');
