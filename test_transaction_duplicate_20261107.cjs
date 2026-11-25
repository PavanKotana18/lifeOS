'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const { buildDuplicateTransactionDraft } = require('./src/services/transactionDraft.ts');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const defaults = { title: '', amount: '', category: 'Food', type: 'expense', date: '2026-11-07', dateTime: '2026-11-07T13:45', paymentMethod: 'Other', notes: '', isRecurring: '' };
const original = { id: 'synthetic-old-id', createdAt: '2020-01-01T00:00:00.000Z', type: 'income', amount: 1250.5,
  category: 'Salary', description: 'Contract work', date: '2024-04-03', occurredAt: '2024-04-03T08:15:00.000Z',
  paymentMethod: 'Bank transfer', notes: 'Quarterly invoice', isRecurring: true };
const draft = buildDuplicateTransactionDraft(defaults, original);
assert.equal(draft.title, 'Contract work');
assert.equal(draft.amount, '1250.5');
assert.equal(draft.category, 'Salary');
assert.equal(draft.type, 'income');
assert.equal(draft.paymentMethod, 'Bank transfer');
assert.equal(draft.notes, 'Quarterly invoice');
assert.equal(draft.isRecurring, 'yes');
assert.equal(draft.date, defaults.date, 'duplicate gets the current new-entry date');
assert.equal(draft.dateTime, defaults.dateTime, 'duplicate gets the current new-entry time, not source history');
assert.equal(Object.hasOwn(draft, 'id'), false);
assert.equal(Object.hasOwn(draft, 'createdAt'), false);

const legacy = { id: 'legacy-id', createdAt: '2010-01-01T00:00:00.000Z', type: 'expense', amount: 20, category: 'Food', description: '', date: '2012-03-04' };
const legacyDraft = buildDuplicateTransactionDraft(defaults, legacy);
assert.equal(legacyDraft.dateTime, defaults.dateTime, 'date-only legacy transaction does not synthesize its historic time');
assert.equal(legacyDraft.title, '', 'blank description remains blank');
assert.match(app, /openDuplicateTransaction/);
assert.match(app, /onDuplicate=\{\(\) => openDuplicateTransaction\(transactionDetail\)\}/);
const detail = fs.readFileSync('src/components/TransactionDetail.tsx', 'utf8');
assert.match(detail, /exit\(onDuplicate\)[\s\S]*?>Duplicate<\/button>/);
assert.match(app, /Delete transaction/);
assert.match(app, /if \(!await confirmAction\(\{ title: 'Delete this transaction\?'/,
  'transaction deletion uses the shared accessible confirmation before mutating storage');
assert.match(app, /StorageService\.transactions\.delete\(transactionDetail\.id\)/,
  'the existing transaction delete action remains connected after confirmation');
assert.doesNotMatch(app, /window\.confirm\(/,
  'native browser confirmations are not used for app-level transaction actions');
console.log('TRANSACTION DUPLICATE: 17 service and UI contracts passed with synthetic records.');

// Currency/account regression cases use exact stored minor units as authority.
const { buildTransactionUpdate } = require('./src/services/userPreferences.ts');
const { buildFinanceAnalytics } = require('./src/services/financeAnalytics.ts');
const h = require('./tests/wp0/production-harness.cjs');
const account = { id:'qa-usd', name:'QA wallet', type:'cash', currencyCode:'USD', openingBalanceMinor:'0', isActive:true };
const source = {...original, currencyCode:'USD', amount:0.1 + 0.2, amountMinor:'30', accountId:account.id};
const before = JSON.stringify(source);
const exact = buildDuplicateTransactionDraft({...defaults,currencyCode:'INR'}, source, [account]);
assert.equal(exact.amount,'0.30'); assert.equal(exact.currencyCode,'USD'); assert.equal(exact.accountId,account.id);
assert.equal(JSON.stringify(source),before);
for (const [currencyCode, amountMinor, expected] of [['JPY','123','123'],['KWD','1234','1.234'],['USD','9007199254740993','90071992547409.93']]) {
 const result=buildDuplicateTransactionDraft(defaults,{...source,currencyCode,amountMinor},[]);
 assert.equal(result.amount,expected); assert.equal(result.currencyCode,currencyCode); assert.equal(result.accountId,'');
}
for (const accounts of [[],[{...account,isActive:false}],[{...account,currencyCode:'INR'}]]) {
 assert.equal(buildDuplicateTransactionDraft(defaults,source,accounts).accountId,'');
}
assert.equal(buildDuplicateTransactionDraft({...defaults,accountId:'default-account'}, {...source,accountId:undefined}, [account]).accountId,'');
assert.equal(buildDuplicateTransactionDraft({...defaults,currencyCode:'INR'},legacy,[]).currencyCode,'INR');
for(const field of ['id','createdAt','updatedAt','occurredAt','amountMinor']) assert.equal(Object.hasOwn(exact,field),false);
const duplicateHandler=h.appFunction('openDuplicateTransaction');
assert.doesNotMatch(duplicateHandler,/StorageService|transactions\.add/,'opening Duplicate never writes storage');
(async()=>{const f=await h.fixture();try {
 await f.activate();
 const category=await f.StorageService.categories.add({name:'Synthetic duplicate expense',type:'expense',color:'#507060'});
 const savedAccount=await f.StorageService.accounts.add({...account,id:undefined});
 const originalSaved=await f.StorageService.transactions.add(buildTransactionUpdate({type:'expense',amount:'0.30',currencyCode:'USD',category:category.name,description:'QA',dateTime:'2026-11-01T10:00',paymentMethod:'Cash'}));
 const draft=buildDuplicateTransactionDraft({...defaults,currencyCode:'INR'},{...originalSaved,accountId:savedAccount.id},[savedAccount]);
 assert.equal((await f.StorageService.transactions.getAll()).length,1,'draft creation writes nothing');
 const newInput={...buildTransactionUpdate({type:draft.type,amount:draft.amount,currencyCode:draft.currencyCode,category:draft.category,description:draft.title,dateTime:draft.dateTime,paymentMethod:draft.paymentMethod,notes:draft.notes,isRecurring:draft.isRecurring==='yes'}),accountId:draft.accountId};
 const saved=await f.StorageService.transactions.add(newInput);
 assert.notEqual(saved.id,originalSaved.id); assert.equal(saved.amountMinor,'30');assert.equal(saved.accountId,savedAccount.id);
 const raw=await f.lifeOSDatabase.transactions.get(saved.id);assert.equal(raw.__lifeosEncrypted,1);assert.equal(raw.amount,undefined);
 const rows=await f.StorageService.transactions.getAll();assert.equal(rows.length,2);
 const usd=buildFinanceAnalytics(rows,[],'2026-11',6,[],'USD');assert.equal(usd.totalExpenses,0.6);
 assert.equal(buildFinanceAnalytics(rows,[],'2026-11',6,[],'INR').totalExpenses,0);
 f.sessionManager.lock();await f.sessionManager.waitForIdle();
 await assert.rejects(f.StorageService.transactions.add(newInput));
 console.log('RELIABLE DUPLICATE: exact currency, optional accounts, draft-only opening, encrypted persistence and cash flow passed.');
}finally{await f.dispose();}})().catch(error=>{console.error(error);process.exitCode=1;});
