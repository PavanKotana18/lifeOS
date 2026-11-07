"use strict";
const assert = require('node:assert/strict');
const h = require('./tests/wp0/production-harness.cjs');
(async () => {
  const f = await h.fixture({ activate: false });
  let checks = 0;
  try {
    const init = h.appFunction('initApp'), deps = f.appDeps();
    await h.bind(init, { ...deps, ...h.noopSetters(init) })();
    assert.equal(f.isEncryptedStorageActivated(), true); checks++;
    assert.equal(f.sessionManager.isUnlocked(), true); checks++;
    const cbSource = h.lifecycleCallback(); let reloads = 0;
    const cb = h.bind(cbSource, { ...deps, ...h.noopSetters(cbSource),
      reloadAllData: async () => { reloads++; return deps.reloadAllData(); } },
      'let disposed = false; let resumeInProgress = false;');
    await cb({ isActive: false });
    assert.equal(f.sessionManager.isUnlocked(), false); checks++;
    f.native.onStop();
    assert.equal((await f.native.isUnlocked()).unlocked, false); checks++;
    await cb({ isActive: true });
    assert.equal(f.sessionManager.isUnlocked(), true); checks++;
    assert.equal((await f.native.isUnlocked()).unlocked, true); checks++;
    assert.equal(reloads, 1); checks++;
    await cb({ isActive: false });
    f.native.unlock = async () => ({ success: false });
    await cb({ isActive: true });
    assert.equal(f.sessionManager.isUnlocked(), false); checks++;
    assert.equal((await f.native.isUnlocked()).unlocked, false); checks++;
    assert.equal(reloads, 1); checks++;
    console.log(`AUTHENTICATION LIFECYCLE TESTS: ${checks}/10 PASSED (actual App/Dexie; native SIMULATED)`);
  } finally { await f.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
