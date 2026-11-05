require('./scripts/register-ts-test-loader.cjs');
const assert = require('node:assert/strict');
const { unlockEncryptedSession, lockEncryptedSession } =
  require('./src/services/cryptoSessionCoordinator.ts');

const fresh = {
  keyProvisioned:false, recoveryProvisioned:false,
  recoveryNeedsRebind:false, metadataConsistent:true,
  keystoreAliasPresent:false, unlocked:false
};
const existing = {
  ...fresh, keyProvisioned:true, recoveryProvisioned:true,
  keystoreAliasPresent:true
};
function session() {
  let open=false;
  return {
    unlock(){open=true}, lock(){open=false},
    isUnlocked(){return open},
    async waitForIdle(){}
  };
}
function crypto(state, overrides={}) {
  const calls=[];
  return {calls, api:{
    async getKeyState(){calls.push('state');return state},
    async setup(){calls.push('setup');return {success:true}},
    async unlock(){calls.push('unlock');return {success:true}},
    async lock(){calls.push('lock')},
    async isUnlocked(){calls.push('isUnlocked');return true},
    ...overrides
  }};
}
(async()=>{
  let n=0;
  async function test(name,fn){await fn();n++;console.log('PASS:',name)}
  await test('existing key unlocks before session',async()=>{
    const s=session(),c=crypto(existing);
    await unlockEncryptedSession(c.api,s);
    assert.deepEqual(c.calls,['state','unlock','isUnlocked']);
    assert.equal(s.isUnlocked(),true);
  });
  await test('first setup is never automatic',async()=>{
    const s=session(),c=crypto(fresh);
    await assert.rejects(unlockEncryptedSession(c.api,s),/completed explicitly/);
    assert.deepEqual(c.calls,['state','lock']);
    assert.equal(s.isUnlocked(),false);
  });
  await test('explicit setup verifies native key',async()=>{
    const s=session(),c=crypto(fresh);
    await unlockEncryptedSession(c.api,s,{allowInitialSetup:true});
    assert.deepEqual(c.calls,['state','setup','isUnlocked']);
    assert.equal(s.isUnlocked(),true);
  });
  await test('inconsistent metadata fails closed',async()=>{
    const s=session(),c=crypto({...fresh,metadataConsistent:false});
    await assert.rejects(unlockEncryptedSession(c.api,s),/metadata is inconsistent/);
    assert.deepEqual(c.calls,['state','lock']);
  });
  await test('missing Keystore alias fails closed',async()=>{
    const s=session(),c=crypto({...existing,keystoreAliasPresent:false});
    await assert.rejects(unlockEncryptedSession(c.api,s),/unavailable in Android Keystore/);
    assert.deepEqual(c.calls,['state','lock']);
  });
  await test('native unlock failure keeps session locked',async()=>{
    const s=session(),c=crypto(existing,{
      async unlock(){c.calls.push('unlock');return {success:false}}
    });
    await assert.rejects(unlockEncryptedSession(c.api,s),/unlock failed/);
    assert.deepEqual(c.calls,['state','unlock','lock']);
    assert.equal(s.isUnlocked(),false);
  });
  await test('background locks session, drains, then locks key',async()=>{
    const s=session(),calls=[];
    await lockEncryptedSession({async lock(){calls.push('native-lock')}},{
      ...s,
      lock(){calls.push('session-lock');s.lock()},
      async waitForIdle(){calls.push('drain');await s.waitForIdle()}
    });
    assert.deepEqual(calls,['session-lock','drain','native-lock']);
    assert.equal(s.isUnlocked(),false);
  });
  console.log(`CRYPTO SESSION COORDINATOR TESTS: ${n}/7 PASSED`);
})().catch(e=>{console.error(e);process.exitCode=1});
