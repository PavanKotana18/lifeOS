'use strict';
const assert=require('node:assert/strict');
const h=require('./tests/wp0/production-harness.cjs');
require('./scripts/register-ts-test-loader.cjs');
const {buildTransactionUpdate}=require('./src/services/userPreferences.ts');
(async()=>{const f=await h.fixture();try {
 const save=h.appFunction('saveNewRecord'), operation={current:false}, messages=[];
 let setups=0, writes=0;
 await h.bind(save,{...h.noopSetters(save),createKind:'transaction',createOperation:operation,createDraft:{amount:'125.50',category:''},ensurePrivateStorageBeforeWrite:async()=>{setups++;},showToast:m=>messages.push(m),StorageService:{transactions:{add:async()=>{writes++;}}}})({preventDefault(){}});
 assert.equal(setups,1);assert.equal(writes,0);assert.equal(operation.current,false);assert.match(messages[0],/Choose a category/);
 await f.activate();
 for (const type of ['expense','income']) {
  const category=await f.StorageService.categories.add({name:'QA '+type,type,color:'#507060'});
  const entry=buildTransactionUpdate({type,amount:'125.50',currencyCode:'INR',category:category.name,description:'  ',dateTime:'2026-11-09T10:00',paymentMethod:''});
  assert.equal(entry.description,category.name);assert.equal(entry.amountMinor,'12550');
  const saved=await f.StorageService.transactions.add(entry);
  const read=await f.StorageService.transactions.getById(saved.id);assert.equal(read.description,category.name);
  const raw=await f.lifeOSDatabase.transactions.get(saved.id);assert.equal(raw.__lifeosEncrypted,1);assert.equal(raw.description,undefined);
 }
 const explicit=buildTransactionUpdate({type:'expense',amount:'1',currencyCode:'JPY',category:'Food',description:'User merchant',dateTime:'2026-11-09T10:00',paymentMethod:'Cash'});
 assert.equal(explicit.description,'User merchant');assert.equal(explicit.amountMinor,'1');
 await assert.rejects(f.StorageService.transactions.add({...explicit,category:'',description:''}),/required/);
 console.log('DIRECTED QUICK ENTRY: 17 assertions passed; optional descriptions persist as encrypted category labels, explicit text and financial precision preserved, invalid records still rejected.');
}finally{await f.dispose();}})().catch(e=>{console.error(e);process.exitCode=1});
