'use strict';
const assert = require('node:assert/strict');
const h = require('./tests/wp0/production-harness.cjs');
let passed = 0;
async function test(name, run) {
  const f = await h.fixture({ activate: false });
  try { await run(f); passed++; console.log('PASS: ' + name); }
  finally { await f.dispose(); }
}
(async () => {
  await test('Inactive facade rejects private access without changing secure key state', async f => {
    const nativeState = await f.native.getKeyState();
    for (const operation of [() => f.StorageService.transactions.getAll(),
      () => f.StorageService.transactions.add({description:'synthetic'}),
      () => f.StorageService.settings.set('displayName','synthetic'),
      () => f.StorageService.settings.get('displayName',''),
      () => f.StorageService.backup.exportData(), () => f.StorageService.backup.clearAll()]) {
      f.sessionManager.unlock();
      await assert.rejects(operation, /Encrypted storage is not ready/);
      assert.equal(f.sessionManager.isUnlocked(),false);
    }
    assert.equal(await f.lifeOSDatabase.transactions.count(),0);
    const finalState = await f.native.getKeyState();
    assert.deepEqual(finalState, nativeState);
    assert.equal(f.native.calls.includes('setup'), false);
    await f.StorageService.settings.set('theme','light');
    assert.equal(await f.StorageService.settings.get('theme','system'),'light');
    await f.StorageService.settings.set('visualTheme','soft-ivory-sage');
    assert.equal(await f.StorageService.settings.get('visualTheme',''),'soft-ivory-sage');
  });
  await test('Actual startup activates encrypted storage before private hydration',async f=>{
    const init=h.appFunction('initApp');
    await h.bind(init,{...f.appDeps(),...h.noopSetters(init)})();
    assert.equal(f.isEncryptedStorageActivated(),true);
    assert.equal(f.sessionManager.isUnlocked(),true);
    await f.StorageService.settings.set('displayName','synthetic');
    const row=await f.lifeOSDatabase.settings.get('displayName');
    assert.equal(row.__lifeosEncrypted,1);assert.equal(row.value,undefined);
  });
  await test('Missing recovery protection blocks migration without changing legacy records',async f=>{
    const row={id:'synthetic-category',name:'Synthetic',type:'expense'};
    await f.lifeOSDatabase.categories.put(row);
    const get=f.native.getKeyState;
    f.native.getKeyState=async()=>({...await get(),recoveryProvisioned:false});
    f.sessionManager.unlock();
    await assert.rejects(f.activateEncryptedStorage(),/Recovery protection/);
    assert.deepEqual(await f.lifeOSDatabase.categories.get(row.id),row);
    await assert.rejects(f.StorageService.categories.getAll(),/Encrypted storage is not ready/);
  });
  await test('Legacy record verified and preserved through encrypted activation',async f=>{
    const row={id:'synthetic-category',name:'Synthetic',type:'expense'};
    await f.lifeOSDatabase.categories.put(row);
    await f.activate();
    const raw=await f.lifeOSDatabase.categories.get(row.id);
    assert.equal(raw.__lifeosEncrypted,1);assert.equal(raw.name,undefined);
    assert.deepEqual((await f.StorageService.categories.getAll())[0],row);
  });
  await test('Corrupt encrypted copy never replaces legacy plaintext during migration',async f=>{
    const row={id:'synthetic-category',name:'Synthetic',type:'expense'};
    await f.lifeOSDatabase.categories.put(row);
    const decrypt=f.native.decrypt;
    f.native.decrypt=async()=>({plaintext:JSON.stringify({...row,name:'corrupt'})});
    f.sessionManager.unlock();
    await assert.rejects(f.activateEncryptedStorage(),/did not verify/);
    assert.deepEqual(await f.lifeOSDatabase.categories.get(row.id),row);
    assert.equal(f.isEncryptedStorageActivated(),false);
    f.native.decrypt=decrypt;
    await f.native.unlock();await f.activate();
    assert.deepEqual((await f.StorageService.categories.getAll())[0],row);
  });
  await test('Cancellation and missing alias never fall back to raw reads',async f=>{
    await f.native.lock();f.sessionManager.unlock();
    await assert.rejects(f.activateEncryptedStorage(),/locked/);
    await assert.rejects(f.StorageService.categories.getAll(),/Encrypted storage is not ready/);
    const get=f.native.getKeyState;
    f.native.getKeyState=async()=>({...await get(),keystoreAliasPresent:false});
    f.sessionManager.unlock();await assert.rejects(f.activateEncryptedStorage(),/Keystore/);
    await assert.rejects(f.StorageService.categories.getAll(),/Encrypted storage is not ready/);
  });
  console.log(`ENCRYPTION ADMISSION: ${passed}/6 passed; native interface simulated, real production facade/Dexie/migration.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
