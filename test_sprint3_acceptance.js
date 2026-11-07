"use strict";
const assert=require('node:assert/strict');
const h=require('./tests/wp0/production-harness.cjs');
let passed=0;
async function test(name,run){await run();passed++;console.log('PASS: '+name);}
async function fixture(run){const f=await h.fixture();try{await run(f);}finally{await f.dispose();}}
(async()=>{
 await test('CSV cells protect formula and control prefixes while preserving literals',()=>fixture(async f=>{
  const {quoteCsvCell}=f.load('src/services/csvExportService.ts');const {parseCsv}=require('./tests/wp0/production-cases.cjs');
  for(const text of ['=1+1','+CMD','-1+1','@SUM(1)',' \t=1','\uFEFF=1','\u0000=1','\ntext','\rtext','\ttext'])assert.equal(parseCsv(quoteCsvCell(text))[0][0],"'"+text);
  for(const text of ['plain','commas, "quotes"\nline','user@example.com','safe =1'])assert.equal(parseCsv(quoteCsvCell(text))[0][0],text);
  assert.equal(quoteCsvCell(-1),'"-1"');assert.equal(quoteCsvCell(null),'""');
 }));
 await test('Actual create handler rejects concurrent submissions and closes after commit before failed refresh',()=>fixture(async f=>{
  f.sessionManager.unlock();const expression=h.appFunction('saveNewRecord');const operation={current:false};const messages=[];const closed=[];let release;const wait=new Promise(resolve=>release=resolve);const add=f.StorageService.habits.add;let writes=0;
  const storage={habits:{async add(record){writes++;await wait;return add(record);}}};
  const deps={...f.appDeps(),...h.noopSetters(expression),StorageService:storage,createOperation:operation,createKind:'habit',createDraft:{title:'Synthetic habit',frequency:'daily'},editingHabitId:null,editingTaskId:null,editingTransactionId:null,editingGoalId:null,habits:[],setCreateKind:value=>closed.push(value),showToast:(...args)=>messages.push(args),async reloadAllData(){assert.deepEqual(closed,[null]);throw Error('SIMULATED_REFRESH_FAILURE');}};
  const save=h.bind(expression,deps),event={preventDefault(){}};const first=save(event);await save(event);assert.equal(writes,1);release();await first;
  assert.equal(await f.lifeOSDatabase.habits.count(),1);assert.equal(operation.current,false);assert.match(messages.at(-1)[0],/^Saved, but/);assert.equal(messages.at(-1)[1],'danger');
 }));
 await test('Pre-commit validation failure retains form and releases submit ownership',()=>fixture(async f=>{
  const expression=h.appFunction('saveNewRecord');const operation={current:false};let closed=0;const messages=[];
  const save=h.bind(expression,{...f.appDeps(),...h.noopSetters(expression),createOperation:operation,createKind:'budget',createDraft:{amount:'-1'},setCreateKind(){closed++;},showToast:(...a)=>messages.push(a)});
  await save({preventDefault(){}});assert.equal(operation.current,false);assert.equal(closed,0);assert.equal(await f.lifeOSDatabase.budgets.count(),0);assert.doesNotMatch(messages.at(-1)[0],/^Saved, but/);
 }));
 await test('Actual write failure preserves form, and a later explicit retry commits once',()=>fixture(async f=>{
  f.sessionManager.unlock();const expression=h.appFunction('saveNewRecord');const operation={current:false};const closed=[];const messages=[];
  const fail=()=>{throw Error('SIMULATED_WRITE_FAILURE');};f.lifeOSDatabase.habits.hook('creating',fail);
  const save=h.bind(expression,{...f.appDeps(),...h.noopSetters(expression),createOperation:operation,createKind:'habit',createDraft:{title:'Synthetic retry',frequency:'daily'},editingHabitId:null,editingTaskId:null,editingTransactionId:null,editingGoalId:null,editingContributionId:null,habits:[],setCreateKind:v=>closed.push(v),showToast:(...a)=>messages.push(a),async reloadAllData(){return {tasks:[],habits:[],goals:[],milestones:[]};}});
  await save({preventDefault(){}});assert.equal(await f.lifeOSDatabase.habits.count(),0);assert.deepEqual(closed,[]);assert.equal(operation.current,false);assert.match(messages.at(-1)[0],/SIMULATED_WRITE_FAILURE/);
  f.lifeOSDatabase.habits.hook('creating').unsubscribe(fail);await save({preventDefault(){}});
  assert.equal(await f.lifeOSDatabase.habits.count(),1);assert.deepEqual(closed,[null]);assert.equal(operation.current,false);assert.equal(messages.at(-1)[1],'success',messages.at(-1)[0]);
 }));
 console.log(`SPRINT3 ACCEPTANCE: ${passed}/4 passed (no device execution)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
