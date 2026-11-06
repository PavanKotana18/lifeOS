'use strict';
// Actual TS services, admission proxy, Dexie migration and AST-extracted App.
// Android cryptography/biometrics are SIMULATED; this is not device evidence.
const assert = require('node:assert/strict');
const h = require('./tests/wp0/production-harness.cjs');
let passed = 0;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function test(name, run) {
  const f = await h.fixture({ activate: false });
  try { await run(f); passed++; console.log('PASS:', name); }
  finally { await f.dispose(); }
}
function owner(f, overrides = {}) {
  return f.load('src/services/cryptoSessionCoordinator.ts').createProtectedSessionController(
    f.load('src/services/cryptoService.ts').CryptoService, f.sessionManager, {
      hasEncryptedRecords: f.hasEncryptedRecords, requestInitialSetup: async () => true,
      confirmRecovery: async () => true, activateStorage: f.activateEncryptedStorage,
      isStorageActive: f.isEncryptedStorageActivated, ...overrides,
    });
}
function unprovisioned(f) {
  let provisioned = false, recovery = false, setups = 0, preparations = 0;
  const read = f.native.getKeyState;
  f.native.getKeyState = async () => ({ ...await read(), keyProvisioned: provisioned,
    recoveryProvisioned: recovery, keystoreAliasPresent: provisioned,
    unlocked: provisioned && (await f.native.isUnlocked()).unlocked });
  f.native.setup = async () => { setups++; provisioned = true; return f.native.unlock(); };
  f.native.prepareRecovery = async () => { preparations++; return { success: true,
    recoveryCode: 'A'.repeat(43), envelope: { version: 1, kdf: 'PBKDF2-HMAC-SHA-256', iterations: 600000,
      salt: Buffer.alloc(16).toString('base64'), iv: Buffer.alloc(12).toString('base64'), wrappedKey: Buffer.alloc(48).toString('base64') } }; };
  f.native.confirmRecovery = async () => { recovery = true; return { success: true }; };
  return { get setups() { return setups; }, get preparations() { return preparations; } };
}
(async () => {
  await test('Actual App fresh setup waits for explicit consent and complete-kit confirmation', async f => {
    const state = unprovisioned(f), consent = deferred(), kit = deferred(), shown = deferred();
    const c = owner(f, { requestInitialSetup: () => consent.promise,
      confirmRecovery: prepared => { assert.equal(prepared.recoveryCode.length, 43); shown.resolve(); return kit.promise; } });
    const init = h.appFunction('initApp');
    const start = h.bind(init, { ...f.appDeps(), ...h.noopSetters(init), encryptedSession: c })();
    await new Promise(r => setImmediate(r)); assert.equal(state.setups, 0);
    await assert.rejects(f.StorageService.transactions.getAll(), /Encrypted storage is not ready/);
    // Boundary rejection invalidates admission as designed: begin a fresh explicit attempt.
    consent.resolve(false); await assert.rejects(start, /cancelled|expired/);
    const c2 = owner(f, { confirmRecovery: prepared => { shown.resolve(prepared); return kit.promise; } });
    const opening = h.bind(init, { ...f.appDeps(), ...h.noopSetters(init), encryptedSession: c2 })();
    await shown.promise;
    assert.equal(f.isEncryptedStorageActivated(), false);
    assert.equal(f.sessionManager.isUnlocked(), false);
    assert.equal(await f.lifeOSDatabase.categories.count(), 0);
    kit.resolve(true); await opening;
    assert.equal(state.setups, 1); assert.equal(f.isEncryptedStorageActivated(), true);
    const tx = await f.StorageService.transactions.add({ type: 'expense', amount: 12.34,
      category: 'Food', description: 'Synthetic startup fixture', date: '2026-11-06', paymentMethod: 'Cash' });
    const raw = await f.lifeOSDatabase.transactions.get(tx.id);
    assert.equal(raw.__lifeosEncrypted, 1); assert.equal(raw.description, undefined);
    assert.equal((await f.StorageService.transactions.getAll())[0].description, 'Synthetic startup fixture');
  });
  await test('Fresh consent cancellation leaves key and private records unchanged', async f => {
    const state = unprovisioned(f);
    await assert.rejects(owner(f, { requestInitialSetup: async () => false }).open(), /cancelled/);
    assert.equal(state.setups, 0); assert.equal(f.sessionManager.isUnlocked(), false);
    assert.equal(await f.lifeOSDatabase.transactions.count(), 0);
  });
  await test('Cancelled kit confirmation resumes existing provisioned key without replacement', async f => {
    const state = unprovisioned(f);
    await assert.rejects(owner(f, { confirmRecovery: async () => false }).open(), /cancelled/);
    assert.equal(state.setups, 1); assert.equal(f.isEncryptedStorageActivated(), false);
    await owner(f).open(); assert.equal(state.setups, 1); assert.equal(state.preparations, 2);
    assert.equal(f.isEncryptedStorageActivated(), true);
  });
  await test('Ciphertext with missing native metadata never enters initial setup', async f => {
    const state = unprovisioned(f);
    await f.lifeOSDatabase.tasks.put({ id: 'synthetic-ciphertext', __lifeosEncrypted: 1, encrypted: {} });
    let offered = false;
    await assert.rejects(owner(f, { requestInitialSetup: async () => { offered = true; return true; } }).open(), /recovery/);
    assert.equal(offered, false); assert.equal(state.setups, 0);
    assert.equal(await f.lifeOSDatabase.tasks.count(), 1);
  });
  await test('Ciphertext appearing while user confirms setup prevents replacement key', async f => {
    const state = unprovisioned(f);
    await assert.rejects(owner(f, { requestInitialSetup: async () => {
      await f.lifeOSDatabase.tasks.put({ id: 'synthetic-race', encrypted: {} }); return true;
    } }).open(), /changed/);
    assert.equal(state.setups, 0); assert.equal(f.sessionManager.isUnlocked(), false);
  });
  await test('Legacy records migrate only after recovery confirmation and decrypt-verify', async f => {
    unprovisioned(f);
    await f.lifeOSDatabase.categories.put({ id: 'legacy', name: 'Synthetic legacy', type: 'expense' });
    await owner(f, { confirmRecovery: async () => {
      assert.equal((await f.lifeOSDatabase.categories.get('legacy')).name, 'Synthetic legacy'); return true;
    } }).open();
    assert.equal((await f.lifeOSDatabase.categories.get('legacy')).name, undefined);
    assert.equal((await f.StorageService.categories.getAll())[0].name, 'Synthetic legacy');
  });
  await test('Interrupted migration preserves failed row and retry reuses native key', async f => {
    const state = unprovisioned(f);
    const row = { id: 'legacy', name: 'Synthetic legacy', type: 'expense' };
    await f.lifeOSDatabase.categories.put(row);
    const fail = () => { throw new Error('SYNTHETIC_STORAGE_FAILURE'); };
    f.lifeOSDatabase.categories.hook('updating', fail);
    await assert.rejects(owner(f).open(), /SYNTHETIC_STORAGE_FAILURE/);
    assert.deepEqual(await f.lifeOSDatabase.categories.get('legacy'), row);
    assert.equal(f.isEncryptedStorageActivated(), false); assert.equal(f.sessionManager.isUnlocked(), false);
    f.lifeOSDatabase.categories.hook('updating').unsubscribe(fail);
    await owner(f).open(); assert.equal(state.setups, 1);
  });
  await test('Process restart reactivates durable encrypted rows with original native key', async f => {
    await owner(f).open();
    await f.StorageService.settings.set('displayName', 'Synthetic restart');
    const before = await f.lifeOSDatabase.settings.get('displayName');
    const fresh = await f.restart();
    try {
      assert.equal(fresh.isEncryptedStorageActivated(), false);
      const c = fresh.load('src/services/cryptoSessionCoordinator.ts').createProtectedSessionController(
        fresh.load('src/services/cryptoService.ts').CryptoService, fresh.sessionManager, {
          hasEncryptedRecords: fresh.hasEncryptedRecords,
          requestInitialSetup: async () => { throw new Error('Replacement setup forbidden'); },
          confirmRecovery: async () => { throw new Error('Existing recovery must persist'); },
          activateStorage: fresh.activateEncryptedStorage, isStorageActive: fresh.isEncryptedStorageActivated,
        });
      await c.open();
      assert.equal(await fresh.StorageService.settings.get('displayName', ''), 'Synthetic restart');
      assert.deepEqual(await fresh.lifeOSDatabase.settings.get('displayName'), before);
    } finally { fresh.lifeOSDatabase.close(); }
  });
  await test('Lock while recovery kit is pending expires attempt and keeps facade inactive', async f => {
    unprovisioned(f); const pending = deferred(), shown = deferred();
    const c = owner(f, { confirmRecovery: () => { shown.resolve(); return pending.promise; } });
    const opening = c.open(); const rejected = assert.rejects(opening, /expired/);
    await shown.promise; await c.lock(); pending.resolve(true); await rejected;
    assert.equal(f.sessionManager.isUnlocked(), false); assert.equal(f.isEncryptedStorageActivated(), false);
    assert.equal((await f.native.getKeyState()).recoveryProvisioned, false);
  });
  await test('Lock during migration cannot reopen admission from stale completion', async f => {
    await f.lifeOSDatabase.categories.put({ id: 'legacy', name: 'Synthetic lock', type: 'expense' });
    const decrypt = f.native.decrypt; let invalidated = false;
    f.native.decrypt = async options => { const result = await decrypt(options);
      if (!invalidated) { invalidated = true; f.sessionManager.lock(); } return result; };
    await assert.rejects(owner(f).open(), /expired/);
    assert.equal(f.isEncryptedStorageActivated(), false); assert.equal(f.sessionManager.isUnlocked(), false);
    assert.equal((await f.native.isUnlocked()).unlocked, false);
  });
  await test('Actual encrypted facade owns a lease and drain waits for admitted commit', async f => {
    await owner(f).open(); await f.StorageService.categories.getAll();
    const original = f.lifeOSDatabase.transactions.add, gate = deferred(), started = deferred();
    f.lifeOSDatabase.transactions.add = async function(...args) { started.resolve(); await gate.promise; return original.apply(this, args); };
    const write = f.StorageService.transactions.add({ type: 'expense', amount: 1, category: 'Food',
      description: 'Synthetic leased write', date: '2026-11-06', paymentMethod: 'Cash' });
    await started.promise; assert.equal(f.sessionManager.getActiveOperationCount(), 1);
    f.sessionManager.lock(); let idle = false; const drain = f.sessionManager.waitForIdle().then(() => { idle = true; });
    await assert.rejects(f.StorageService.transactions.getAll(), /locked/);
    assert.equal(idle, false); gate.resolve(); await write; await drain;
    assert.equal(idle, true); assert.equal(await f.lifeOSDatabase.transactions.count(), 1);
  });
  await test('Orphaned native alias never offers provisioning or creates a replacement key', async f => {
    const state = unprovisioned(f), read = f.native.getKeyState;
    f.native.getKeyState = async () => ({ ...await read(), keystoreAliasPresent: true });
    let offered = false;
    await assert.rejects(owner(f, { requestInitialSetup: async () => { offered = true; return true; } }).open(), /recovery/);
    assert.equal(offered, false); assert.equal(state.setups, 0);
  });
  await test('Alias appearing during explicit setup confirmation blocks native setup', async f => {
    const state = unprovisioned(f), read = f.native.getKeyState;
    await assert.rejects(owner(f, { requestInitialSetup: async () => {
      f.native.getKeyState = async () => ({ ...await read(), keystoreAliasPresent: true }); return true;
    } }).open(), /changed/);
    assert.equal(state.setups, 0);
  });
  await test('Migration compare-and-replace preserves a concurrent raw edit', async f => {
    await f.lifeOSDatabase.categories.put({ id: 'legacy', name: 'Before', type: 'expense' });
    const decrypt = f.native.decrypt; let edited = false;
    f.native.decrypt = async options => { const result = await decrypt(options);
      if (!edited) { edited = true; await f.lifeOSDatabase.categories.update('legacy', { name: 'Concurrent synthetic edit' }); }
      return result; };
    await assert.rejects(owner(f).open(), /changed during migration/);
    assert.equal((await f.lifeOSDatabase.categories.get('legacy')).name, 'Concurrent synthetic edit');
    assert.equal(f.isEncryptedStorageActivated(), false);
  });
  await test('A lock during final native availability await rejects stale open success', async f => {
    const available = f.native.isUnlocked, gate = deferred(), started = deferred(); let final = false;
    f.native.isUnlocked = async () => {
      const captured = await available();
      if (final) { final = false; started.resolve(); await gate.promise; }
      return captured;
    };
    const c = owner(f, { activateStorage: async () => { await f.activateEncryptedStorage(); final = true; } });
    const opening = c.open(), rejection = assert.rejects(opening, /changed|expired/);
    await started.promise; await c.lock(); gate.resolve(); await rejection;
    assert.equal(f.sessionManager.isUnlocked(), false); assert.equal((await available()).unlocked, false);
  });
  console.log(`SECURE STARTUP: ${passed} tests passed (production services/Dexie; native SIMULATED)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
