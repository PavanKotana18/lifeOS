'use strict';
const assert = require('node:assert/strict');
const h = require('./tests/wp0/production-harness.cjs');
const { normalizeOnboardingJourney, INITIAL_ONBOARDING_JOURNEY } = require('./src/services/onboardingJourney.ts');
let passed=0;
async function test(name, run) { const f=await h.fixture({activate:false});try{await run(f);passed++;console.log('PASS:',name);}finally{await f.dispose();} }
const pristine = f => { f.native.getKeyState=async()=>({keyProvisioned:false,recoveryProvisioned:false,recoveryDeferred:false,recoveryNeedsRebind:false,metadataConsistent:true,keystoreAliasPresent:false,unlocked:false}); };
(async()=>{
 await test('Malformed/extra progress fields cannot become recovery material',async()=>{
  assert.deepEqual(normalizeOnboardingJourney(null),INITIAL_ONBOARDING_JOURNEY);
  assert.deepEqual(normalizeOnboardingJourney({version:999,stage:'recovery'}),INITIAL_ONBOARDING_JOURNEY);
  assert.deepEqual(normalizeOnboardingJourney({version:1,stage:'recovery',protection:'enabled',recovery:'named',recoveryName:'  My space  ',secret:'DO NOT PERSIST'}),{version:1,stage:'recovery',protection:'enabled',recovery:'named',recoveryName:'My space'});
 });
 await test('Non-secret onboarding choices persist while all private admission remains closed', async f=>{
  pristine(f);const before=await f.native.getKeyState();
  const progress={...INITIAL_ONBOARDING_JOURNEY,stage:'recovery',protection:'skipped',recovery:'named',recoveryName:'Synthetic label'};
  await f.StorageService.settings.set('onboardingJourney',progress);
  assert.deepEqual(await f.StorageService.settings.get('onboardingJourney',null),progress);
  await assert.rejects(f.StorageService.tasks.getAll(),/Encrypted storage is not ready/);
  await assert.rejects(f.StorageService.settings.set('recoverySecret','not allowed'),/Encrypted storage is not ready/);
  assert.equal(f.isEncryptedStorageActivated(),false);assert.equal(f.sessionManager.isUnlocked(),false);
  assert.deepEqual(await f.native.getKeyState(),before);assert.equal(f.native.calls.includes('setup'),false);
 });
 for(const protection of ['pending','skipped','enabled']) await test('Restart resumes saved initial stage: '+protection,async f=>{
  pristine(f);const progress={...INITIAL_ONBOARDING_JOURNEY,stage:protection==='pending'?'protection':'recovery',protection};
  await f.StorageService.settings.set('onboardingJourney',progress);
  let resumed,required;const init=h.appFunction('initApp');
  await h.bind(init,{...f.appDeps(),...h.noopSetters(init),setOnboardingJourney:p=>resumed=p,setOnboardingRequired:v=>required=v})();
  assert.deepEqual(resumed,progress);assert.equal(required,true);assert.equal(f.isEncryptedStorageActivated(),false);
 });
 await test('Existing completed profile is never re-onboarded by missing new metadata',async f=>{
  pristine(f);await f.StorageService.settings.set('onboardingCompleted',true);await f.StorageService.settings.set('displayName','Existing profile');
  let required;const init=h.appFunction('initApp');
  await h.bind(init,{...f.appDeps(),...h.noopSetters(init),setOnboardingRequired:v=>required=v})();
  assert.equal(required,false);assert.equal(await f.StorageService.settings.get('displayName',''),'Existing profile');
  assert.equal(await f.StorageService.settings.get('onboardingJourney',null),null);
 });
 await test('Optional fresh app lock never provisions encryption and cancellation keeps it locked',async f=>{
  pristine(f);const unlock=h.appFunction('triggerBiometricAuth');let locked=true,result={success:false,message:'Cancelled'};let opens=0;
  const deps={...f.appDeps(),...h.noopSetters(unlock),setSensitiveScreenshotState:async()=>{},safeFirstRunBrowse:{current:true},biometricAuthInFlight:{current:null},setIsLocked:v=>locked=v,BiometricService:{authenticate:async()=>result},encryptedSession:{open:async()=>{opens++;throw Error('Must not provision');}}};
  assert.equal(await h.bind(unlock,deps)(),false);assert.equal(locked,true);
  deps.biometricAuthInFlight.current=null;result={success:true};assert.equal(await h.bind(unlock,deps)(),true);assert.equal(locked,false);
  assert.equal(opens,0);assert.equal(f.isEncryptedStorageActivated(),false);assert.equal(f.native.calls.includes('setup'),false);
  await assert.rejects(f.StorageService.transactions.getAll(),/Encrypted storage is not ready/);
 });
 await test('Skipping optional setup does not silently enable biometric lock',async f=>{
  pristine(f);await f.StorageService.settings.set('onboardingJourney',{...INITIAL_ONBOARDING_JOURNEY,stage:'recovery',protection:'skipped',recovery:'skipped'});
  assert.equal(await f.StorageService.settings.get('biometricLockEnabled',false),false);
  assert.equal((await f.native.getKeyState()).keyProvisioned,false);
 });
 console.log('ONBOARDING JOURNEY:',passed,'behavioral admission/lifecycle tests passed (native auth simulated)');
})().catch(e=>{console.error(e);process.exitCode=1;});
