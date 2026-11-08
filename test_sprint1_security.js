'use strict';
// Production services, real JS session generations; native interfaces SIMULATED.
require('./scripts/register-ts-test-loader.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createSessionManager } = require('./src/services/sessionManager.ts');
const { createProtectedSessionController } = require('./src/services/cryptoSessionCoordinator.ts');
const { createRecoveryController } = require('./src/services/recoveryService.ts');
const backup = require('./src/services/backupCryptoService.ts');
const { decodeBackupForRestore } = require('./src/services/backupImportService.ts');
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function cryptoFixture() {
  const calls = []; let unlocked = false;
  const state = { keyProvisioned: true, recoveryProvisioned: true, recoveryNeedsRebind: false,
    metadataConsistent: true, keystoreAliasPresent: true };
  const crypto = {
    async getKeyState() { calls.push('state'); return { ...state, unlocked }; },
    async isUnlocked() { return unlocked; },
    async unlock() { calls.push('unlock'); unlocked = true; return { success: true }; },
    async setup() { throw new Error('Unexpected key regeneration'); },
    async lock() { calls.push('lock'); unlocked = false; },
  };
  return { crypto, calls, state };
}
const kit = JSON.stringify({ product: 'LifeOS', format: 'lifeos-recovery-kit', version: 1,
  recoveryCode: 'A'.repeat(43), envelope: { version: 1, kdf: 'PBKDF2-HMAC-SHA-256', iterations: 600000,
    salt: Buffer.alloc(16).toString('base64'), iv: Buffer.alloc(12).toString('base64'), wrappedKey: Buffer.alloc(48).toString('base64') } });
const challenge = { table: 'tasks', recordId: 'synthetic', schemaVersion: 1,
  encrypted: { iv: 'synthetic', ciphertext: 'synthetic', keyVersion: 1 } };
function recoveryFixture(overrides = {}) {
  const session = createSessionManager(), calls = [];
  let quarantined = false, proof = false;
  const crypto = {
    async lock() { calls.push('lock'); quarantined = false; proof = false; },
    async recoverWithSecret() { calls.push('recover'); quarantined = true; return { success: true }; },
    async verifyRecoveryRecord() { assert.ok(quarantined); calls.push('proof'); proof = true; },
    async rebindLocalKey() { assert.ok(proof, 'Cannot rebind before proof'); calls.push('rebind'); quarantined = false; return { success: true }; },
    async getKeyState() { calls.push('state'); return { keyProvisioned: true, recoveryProvisioned: true,
      recoveryNeedsRebind: false, metadataConsistent: true, keystoreAliasPresent: true, unlocked: true }; },
    ...overrides,
  };
  return { session, calls, crypto, controller: createRecoveryController(crypto, session, async () => challenge) };
}
(async () => {
  let passed = 0;
  const test = async (name, fn) => { await fn(); passed++; console.log('PASS:', name); };
  await test('protected open is single-flight and waits for admitted operations', async () => {
    const s = createSessionManager(), f = cryptoFixture(); s.unlock(); s.beginOperation();
    const c = createProtectedSessionController(f.crypto, s), a = c.open(), b = c.open();
    assert.equal(a, b); await Promise.resolve(); assert.equal(f.calls.length, 0);
    s.endOperation(); await a; assert.equal(s.isUnlocked(), true);
    assert.equal(f.calls.filter(x => x === 'unlock').length, 1);
  });
  await test('background invalidates an outstanding native success, then retry can authenticate', async () => {
    const s = createSessionManager(), f = cryptoFixture(), started = defer(), release = defer();
    const original = f.crypto.unlock;
    f.crypto.unlock = async () => { started.resolve(); await release.promise; return original(); };
    const c = createProtectedSessionController(f.crypto, s), attempt = c.open();
    const rejected = assert.rejects(attempt, /expired/);
    await started.promise; await c.lock(); release.resolve(); await rejected;
    assert.equal(s.isUnlocked(), false); assert.equal(await f.crypto.isUnlocked(), false);
    f.crypto.unlock = original; await c.open(); assert.equal(s.isUnlocked(), true);
  });
  await test('direct session invalidation and native cancellation fail closed', async () => {
    const s = createSessionManager(), f = cryptoFixture(), c = createProtectedSessionController(f.crypto, s);
    f.crypto.unlock = async () => { s.lock(); return { success: true }; };
    await assert.rejects(c.open(), /expired/); assert.equal(s.isUnlocked(), false);
    f.crypto.unlock = async () => ({ success: false });
    await assert.rejects(c.open(), /cancelled|failed/); assert.equal(s.isUnlocked(), false);
  });
  await test('failed native lock is retried before later authentication', async () => {
    const s = createSessionManager(), f = cryptoFixture(); let first = true;
    const lock = f.crypto.lock;
    f.crypto.lock = async () => { if (first) { first = false; throw new Error('Transient native lock failure'); } return lock(); };
    const c = createProtectedSessionController(f.crypto, s);
    await assert.rejects(c.lock(), /Transient/); assert.equal(s.isUnlocked(), false);
    await c.open(); assert.equal(f.calls[0], 'lock'); assert.equal(s.isUnlocked(), true);
  });
  await test('missing/inconsistent key state never calls setup or admits access', async () => {
    for (const invalid of [{ keyProvisioned: false }, { metadataConsistent: false }, { recoveryNeedsRebind: true }, { keystoreAliasPresent: false }]) {
      const s = createSessionManager(), f = cryptoFixture(); Object.assign(f.state, invalid);
      await assert.rejects(createProtectedSessionController(f.crypto, s).open(), /recovery/);
      assert.equal(f.calls.includes('unlock'), false); assert.equal(s.isUnlocked(), false);
    }
  });
  await test('recovery proof precedes biometric rebind and successful recovery stays locked', async () => {
    const f = recoveryFixture(); await f.controller.recover(kit);
    assert.deepEqual(f.calls, ['lock', 'recover', 'proof', 'rebind', 'state', 'lock']);
    assert.equal(f.session.isUnlocked(), false);
  });
  await test('wrong database proof cannot reach rebind', async () => {
    const f = recoveryFixture({ async verifyRecoveryRecord() { throw new Error('Wrong database'); } });
    await assert.rejects(f.controller.recover(kit), /Wrong database/);
    assert.equal(f.calls.includes('rebind'), false); assert.equal(f.calls.at(-1), 'lock');
    assert.equal(f.session.isUnlocked(), false);
  });
  await test('cancelled and failed persistence rebind remain closed', async () => {
    for (const action of [async () => ({ success: false }), async () => { throw new Error('Persistence failed'); }]) {
      const f = recoveryFixture({ rebindLocalKey: action });
      await assert.rejects(f.controller.recover(kit), /cancelled|Persistence/);
      assert.equal(f.session.isUnlocked(), false); assert.equal(f.calls.at(-1), 'lock');
    }
  });
  await test('background during proof invalidates recovery before rebind', async () => {
    const f = recoveryFixture(); f.crypto.verifyRecoveryRecord = async () => { f.session.lock(); };
    await assert.rejects(f.controller.recover(kit), /expired/); assert.equal(f.calls.includes('rebind'), false);
  });
  await test('concurrent recoveries rejected; invalid/no-record kits never mutate native state', async () => {
    const gate = defer(), f = recoveryFixture();
    const c = createRecoveryController(f.crypto, f.session, () => gate.promise);
    const first = c.recover(kit); await assert.rejects(c.recover(kit), /already/);
    gate.resolve(challenge); await first;
    const empty = recoveryFixture();
    await assert.rejects(empty.controller.recover('x'.repeat(9000)), /large/);
    await assert.rejects(createRecoveryController(empty.crypto, empty.session, async () => null).recover(kit), /No encrypted/);
    assert.equal(empty.calls.length, 0);
  });
  await test('UTF-8 byte budgets include envelope expansion; numeric boundaries require no large fixture', async () => {
    backup.assertBackupByteLength(backup.MAX_BACKUP_BYTES);
    assert.throws(() => backup.assertBackupByteLength(backup.MAX_BACKUP_BYTES + 1));
    assert.throws(() => backup.assertBackupByteLength(NaN));
    assert.ok(backup.MAX_BACKUP_FILE_BYTES > 4 * Math.ceil(backup.MAX_BACKUP_BYTES / 3));
    const data = JSON.stringify({ tables: {}, label: 'नमस्ते 日本語' }), pass = 'synthetic-passphrase-123';
    const encrypted = await backup.encryptBackup(data, pass);
    assert.equal(await backup.decryptBackup(encrypted, pass), data);
  });
  await test('malformed encrypted envelope never downgrades to legacy', async () => {
    let accepted = 0;
    const options = { requestPassphrase: async () => 'synthetic-passphrase',
      confirmLegacy: () => { accepted++; return true; }, validateTables() { throw new Error('Unexpected validator call'); } };
    await assert.rejects(decodeBackupForRestore(JSON.stringify({ format: 'unknown', tables: {} }), options), /Unsupported/);
    await assert.rejects(decodeBackupForRestore(JSON.stringify({ format: 'LifeOS-Encrypted-Backup', tables: {} }), options), /invalid|Unsupported/);
    assert.equal(accepted, 0);
  });
  await test('STATIC ONLY: native proof, UI-thread and log policy guards are present', async () => {
    const source = fs.readFileSync('android/app/src/main/java/com/lifeos/personal/LifeOSCryptoPlugin.java', 'utf8');
    const auth = source.slice(source.indexOf('private void authenticate('), source.indexOf('private static final int RECOVERY_KDF_ITERATIONS'));
    assert.ok(auth.indexOf('ContextCompat.getMainExecutor(activity).execute') < auth.indexOf('new BiometricPrompt('));
    assert.match(auth, /Lifecycle\.State\.RESUMED/); assert.match(auth, /ON_STOP/);
    assert.match(auth, /terminal\.compareAndSet\(false, true\)/);
    const rebind = source.slice(source.indexOf('public void rebindLocalKey'), source.indexOf('public void setup'));
    assert.ok(rebind.indexOf('!recoveryKeyVerified') < rebind.indexOf('getOrCreateMasterKeyForRecovery'));
    assert.match(rebind, /\.putString\("recovery_wrapped", recoveredWrapped\)/);
    assert.match(fs.readFileSync('capacitor.config.ts', 'utf8'), /loggingBehavior: 'none'/);
  });
  console.log(`SPRINT1 SECURITY SERVICES: ${passed} tests passed; native interfaces simulated, Java checks STATIC ONLY`);
})().catch(error => { console.error(error); process.exitCode = 1; });
