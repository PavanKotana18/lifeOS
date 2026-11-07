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
  let provisioned = false, recovery = false, recoveryDeferred = false, setups = 0, preparations = 0, setupOptions;
  const read = f.native.getKeyState;
  f.native.getKeyState = async () => ({ ...await read(), keyProvisioned: provisioned,
    recoveryProvisioned: recovery, recoveryDeferred, keystoreAliasPresent: provisioned,
    unlocked: provisioned && (await f.native.isUnlocked()).unlocked });
  f.native.setup = async options => { setups++; setupOptions = options; provisioned = true; recoveryDeferred = options?.deferRecovery === true; return f.native.unlock(); };
  f.native.prepareRecovery = async () => { preparations++; return { success: true,
    recoveryCode: 'A'.repeat(43), envelope: { version: 1, kdf: 'PBKDF2-HMAC-SHA-256', iterations: 600000,
      salt: Buffer.alloc(16).toString('base64'), iv: Buffer.alloc(12).toString('base64'), wrappedKey: Buffer.alloc(48).toString('base64') } }; };
  f.native.confirmRecovery = async () => { recovery = true; recoveryDeferred = false; return { success: true }; };
  f.native.deferRecovery = async () => { recoveryDeferred = true; return { success: true }; };
  return { get setups() { return setups; }, get preparations() { return preparations; }, get setupOptions() { return setupOptions; } };
}
(async () => {
  await test('A pristine first install reaches welcome without native authentication or private hydration', async f => {
    f.native.getKeyState = async () => ({ keyProvisioned: false, recoveryProvisioned: false,
      recoveryDeferred: false, recoveryNeedsRebind: false, metadataConsistent: true,
      keystoreAliasPresent: false, unlocked: false });
    let openCalls = 0, privateReads = 0;
    const init = h.appFunction('initApp');
    const deps = { ...f.appDeps(), ...h.noopSetters(init), safeFirstRunBrowse: { current: false }, encryptedSession: {
      open: async () => { openCalls++; throw new Error('Fresh onboarding must not auto-authenticate'); },
      lock: async () => {},
    } };
    const original = f.StorageService.transactions.getAll;
    f.StorageService.transactions.getAll = async () => { privateReads++; throw new Error('Private read before setup'); };
    try {
      await h.bind(init, deps)();
      assert.equal(openCalls, 0);
      assert.equal(privateReads, 0);
      assert.equal(f.sessionManager.isUnlocked(), false);
      assert.equal(f.isEncryptedStorageActivated(), false);
      assert.equal(deps.startupComplete.current, true);
      assert.equal(await f.StorageService.settings.get('onboardingStarted', false), true);
      f.native.getKeyState = async () => ({ keyProvisioned: false, recoveryProvisioned: false,
        recoveryDeferred: false, initialSetupPending: true, recoveryNeedsRebind: false,
        metadataConsistent: true, keystoreAliasPresent: true, unlocked: false });
      const retryDeps = { ...f.appDeps(), ...h.noopSetters(init), safeFirstRunBrowse: { current: false }, encryptedSession: {
        open: async () => { openCalls++; throw new Error('Interrupted setup should wait for the first private write'); }, lock: async () => {},
      } };
      await h.bind(init, retryDeps)();
      assert.equal(openCalls, 0);
      assert.equal(retryDeps.safeFirstRunBrowse.current, true);
      assert.equal(f.isEncryptedStorageActivated(), false);
    } finally { f.StorageService.transactions.getAll = original; }
  });
  await test('Onboarding display name persists through the bootstrap profile setting before secure setup', async f => {
    const update = h.appFunction('updateDisplayName');
    let renderedName = '';
    const updateName = h.bind(update, { StorageService: f.StorageService,
      isEncryptedStorageActivated: f.isEncryptedStorageActivated, setDisplayName: name => { renderedName = name; } });
    await updateName('  Synthetic Profile  ');
    assert.equal(renderedName, '  Synthetic Profile  ');
    assert.equal(await f.StorageService.settings.get('displayName'), 'Synthetic Profile');
    const fresh = await f.restart();
    assert.equal(await fresh.StorageService.settings.get('displayName'), 'Synthetic Profile');
    await fresh.lifeOSDatabase.close();
    await fresh.lifeOSDatabase.delete();
  });
  await test('An interrupted native setup may retry only its marked orphan alias', async f => {
    let state = { keyProvisioned: false, recoveryProvisioned: false, recoveryDeferred: false,
      initialSetupPending: true, recoveryNeedsRebind: false, metadataConsistent: true,
      keystoreAliasPresent: true, unlocked: false };
    f.native.getKeyState = async () => ({ ...state });
    let setups = 0;
    f.native.setup = async () => { setups++; state = { ...state, keyProvisioned: true,
      initialSetupPending: false, unlocked: true }; return { success: true }; };
    f.native.deferRecovery = async () => { state = { ...state, recoveryDeferred: true }; return { success: true }; };
    const c = owner(f);
    await c.open({ recoveryChoice: 'later' });
    assert.equal(setups, 1);
    assert.equal((await f.native.getKeyState()).initialSetupPending, false);
    assert.equal((await f.native.getKeyState()).recoveryDeferred, true);
    assert.equal(f.isEncryptedStorageActivated(), true);
  });
  await test('First-record gate defers optional recovery and encrypts private records before writing', async f => {
    const state = unprovisioned(f);
    const expression = h.appFunction('ensurePrivateStorageBeforeWrite');
    const c = owner(f);
    const deps = { ...f.appDeps(), encryptedSession: c, requestFirstRecordSecurity: async () => 'later',
      firstRecordSetupAuthorized: { current: false }, safeFirstRunBrowse: { current: true },
      biometricAuthenticated: { current: false },
      setIsLocked() {}, setBiometricEnabled() {}, setBiometricVerified() {},
      setRecoveryProvisioned() {}, setRecoveryDeferred() {}, async reloadAllData() {} };
    await h.bind(expression, deps)();
    assert.equal(state.setups, 1);
    assert.equal(state.preparations, 0);
    assert.equal(state.setupOptions.deferRecovery, true, 'recovery deferral accompanies first Keystore key creation');
    assert.equal(deps.safeFirstRunBrowse.current, false);
    assert.equal(f.isEncryptedStorageActivated(), true);
    assert.equal((await f.native.getKeyState()).recoveryDeferred, true);
    await f.StorageService.categories.add({ id: 'synthetic-food', name: 'Food', type: 'expense' });
    const tx = await f.StorageService.transactions.add({ type: 'expense', amount: 2.5, category: 'Food', description: 'Synthetic record', date: '2026-11-07', paymentMethod: 'Cash' });
    assert.equal((await f.lifeOSDatabase.transactions.get(tx.id)).__lifeosEncrypted, 1);
  });
  await test('Cancelling contextual first-record security does not provision or write private data', async f => {
    const state = unprovisioned(f), expression = h.appFunction('ensurePrivateStorageBeforeWrite');
    const ensure = h.bind(expression, { ...f.appDeps(), encryptedSession: owner(f), requestFirstRecordSecurity: async () => null,
      firstRecordSetupAuthorized: { current: false }, safeFirstRunBrowse: { current: true },
      biometricAuthenticated: { current: false },
      setIsLocked() {}, setBiometricEnabled() {}, setBiometricVerified() {}, setRecoveryProvisioned() {},
      setRecoveryDeferred() {}, async reloadAllData() {} });
    await assert.rejects(ensure(), /cancelled/);
    assert.equal(state.setups, 0);
    assert.equal(f.isEncryptedStorageActivated(), false);
    assert.equal(await f.lifeOSDatabase.transactions.count(), 0);
    await f.StorageService.settings.set('displayName', 'Synthetic User');
    assert.equal(await f.StorageService.settings.get('displayName'), 'Synthetic User');
  });
  await test('Legacy-data startup waits for explicit consent and complete-kit confirmation', async f => {
    const state = unprovisioned(f), consent = deferred(), kit = deferred(), shown = deferred();
    await f.lifeOSDatabase.categories.put({ id: 'synthetic-legacy', name: 'Synthetic legacy', type: 'expense' });
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
    assert.equal(await f.lifeOSDatabase.categories.count(), 1);
    kit.resolve(true); await opening;
    assert.equal(state.setups, 1); assert.equal(f.isEncryptedStorageActivated(), true);
    await f.StorageService.categories.add({ id: 'synthetic-food', name: 'Food', type: 'expense' });
    const tx = await f.StorageService.transactions.add({ type: 'expense', amount: 12.34,
      category: 'Food', description: 'Synthetic startup fixture', date: '2026-11-06', paymentMethod: 'Cash' });
    const raw = await f.lifeOSDatabase.transactions.get(tx.id);
    assert.equal(raw.__lifeosEncrypted, 1); assert.equal(raw.description, undefined);
    assert.equal((await f.StorageService.transactions.getAll())[0].description, 'Synthetic startup fixture');
  });
  await test('New user may explicitly defer recovery after native setup and activate encrypted storage', async f => {
    const state = unprovisioned(f);
    await owner(f).open({ recoveryChoice: 'later' });
    const keyState = await f.native.getKeyState();
    assert.equal(state.setups, 1);
    assert.equal(state.preparations, 0);
    assert.equal(keyState.recoveryDeferred, true);
    assert.equal(keyState.recoveryProvisioned, false);
    assert.equal(f.isEncryptedStorageActivated(), true);
    await f.StorageService.categories.add({ id: 'synthetic-food', name: 'Food', type: 'expense' });
    const id = await f.StorageService.transactions.add({ type: 'expense', amount: 9.5, category: 'Food', description: 'Synthetic deferred recovery', date: '2026-11-07', paymentMethod: 'Cash' });
    const raw = await f.lifeOSDatabase.transactions.get(id.id);
    assert.equal(raw.__lifeosEncrypted, 1);
    assert.equal(raw.description, undefined);
    const reopen = owner(f, { confirmRecovery: async () => { throw new Error('Deferred existing key must not demand a recovery kit'); } });
    await owner(f).lock();
    await reopen.open();
    assert.equal((await f.native.getKeyState()).recoveryDeferred, true);
    assert.equal((await f.StorageService.transactions.getAll())[0].description, 'Synthetic deferred recovery');
  });
  await test('First-record gate provisions once and later writes do not repeat the recovery-choice prompt', async f => {
    const state = unprovisioned(f), authorization = { current: false };
    let dialogs = 0;
    const encryptedSession = f.load('src/services/cryptoSessionCoordinator.ts').createProtectedSessionController(
      f.load('src/services/cryptoService.ts').CryptoService, f.sessionManager, {
        hasEncryptedRecords: f.hasEncryptedRecords,
        requestInitialSetup: async () => { if (!authorization.current) return false; authorization.current = false; return true; },
        confirmRecovery: async () => true, activateStorage: f.activateEncryptedStorage,
        isStorageActive: f.isEncryptedStorageActivated,
      });
    const ensure = h.appFunction('ensurePrivateStorageBeforeWrite');
    const deps = { ...f.appDeps(), encryptedSession, firstRecordSetupAuthorized: authorization,
      requestFirstRecordSecurity: async () => { dialogs++; return 'later'; },
      setSensitiveScreenshotState: async () => {}, setIsLocked() {}, setBiometricEnabled() {},
      setBiometricVerified() {}, setRecoveryProvisioned() {}, setRecoveryDeferred() {},
      biometricAuthenticated: { current: false }, safeFirstRunBrowse: { current: true } };
    const run = h.bind(ensure, deps);
    await run(); await run();
    assert.equal(dialogs, 1); assert.equal(state.setups, 1);
    assert.equal(f.isEncryptedStorageActivated(), true); assert.equal(f.sessionManager.isUnlocked(), true);
    assert.equal((await f.native.getKeyState()).recoveryDeferred, true);
  });
  await test('A provisioned key from an interrupted attempt cannot be reclassified as recovery-deferred', async f => {
    const state = unprovisioned(f);
    await assert.rejects(owner(f, { confirmRecovery: async () => false }).open(), /cancelled/);
    await owner(f).open({ recoveryChoice: 'later' });
    const keyState = await f.native.getKeyState();
    assert.equal(state.setups, 1);
    assert.equal(state.preparations, 2);
    assert.equal(keyState.recoveryDeferred, false);
    assert.equal(keyState.recoveryProvisioned, true);
    assert.equal(f.isEncryptedStorageActivated(), true);
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
  await test('Revoked encrypted read cannot return delayed plaintext; bootstrap remains available', async f => {
    await f.activate();
    await f.StorageService.categories.getAll();
    await f.StorageService.transactions.add({ type: 'expense', amount: 1, category: 'Food',
      description: 'Synthetic stale read', date: '2026-11-06', paymentMethod: 'Cash' });
    const decrypt = f.native.decrypt, started = deferred(), release = deferred();
    let delayed = false;
    f.native.decrypt = async args => {
      const result = await decrypt(args);
      if (!delayed) { delayed = true; started.resolve(); await release.promise; }
      return result;
    };
    const read = f.StorageService.transactions.getAll();
    const rejected = assert.rejects(read, /locked/);
    await started.promise;
    f.sessionManager.lock();
    await f.StorageService.settings.set('theme', 'light');
    assert.equal(await f.StorageService.settings.get('theme', 'system'), 'light');
    release.resolve(); await rejected;
    await assert.rejects(f.StorageService.transactions.getAll(), /locked/);
    assert.equal(f.sessionManager.isUnlocked(), false);
  });
  console.log(`SECURE STARTUP: ${passed} tests passed (production services/Dexie; native SIMULATED)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
