'use strict';
const assert=require('node:assert/strict');
const h=require('./tests/wp0/production-harness.cjs');
(async()=>{const f=await h.fixture();try {
 await f.activate();
 const category=await f.StorageService.categories.add({name:'Synthetic editing',type:'expense',color:'#507060'});
 const account=await f.StorageService.accounts.add({name:'Synthetic wallet',type:'cash',currencyCode:'USD',openingBalanceMinor:'0',isActive:true});
 const source=await f.StorageService.transactions.add({...f.load('src/services/userPreferences.ts').buildTransactionUpdate({type:'expense',amount:'0.30',currencyCode:'USD',category:category.name,dateTime:'2026-11-17T12:00',description:'Synthetic',paymentMethod:'Other'}),accountId:account.id});
 let draft;
 const open=h.appFunction('openEditTransaction');
 h.bind(open,{...f.appDeps(),...h.noopSetters(open),minorUnitsToDecimal:f.load('src/services/financeCore.ts').minorUnitsToDecimal,setCreateDraft:value=>draft=value})({...source,amount:0.1+0.2});
 assert.equal(draft.amount,'0.30','edit starts from authoritative minor units');
 assert.equal(draft.accountId,account.id);
 const save=h.appFunction('saveNewRecord');
 const toasts=[];
 async function persist(input){await h.bind(save,{...f.appDeps(),...h.noopSetters(save),financialAccounts:[account],createKind:'transaction',createDraft:input,createOperation:{current:false},editingTransactionId:source.id,editingTaskId:null,editingHabitId:null,editingGoalId:null,editingContributionId:null,editingSavingsGoalId:null,transactions:await f.StorageService.transactions.getAll(),reloadAllData:async()=>({tasks:[],habits:[],goals:[],milestones:[]}),syncNotificationSchedules:async()=>true,showToast:(message)=>toasts.push(message)})({preventDefault(){}});}
 await persist({...draft,accountId:''});
 let saved=(await f.StorageService.transactions.getAll()).find(row=>row.id===source.id);
 assert.equal(saved.accountId,undefined,'explicit blank removes account association');assert.equal(saved.amountMinor,'30');assert.equal(saved.currencyCode,'USD');
 await persist({...draft,accountId:account.id});
 saved=(await f.StorageService.transactions.getAll()).find(row=>row.id===source.id);assert.equal(saved.accountId,account.id,'account can be restored explicitly');
 const omitted={...draft};delete omitted.accountId;await persist(omitted);
 saved=(await f.StorageService.transactions.getAll()).find(row=>row.id===source.id);assert.equal(saved.accountId,account.id,'legacy partial draft preserves existing association');
 assert.ok(toasts.every(message=>message==='Transaction updated'),JSON.stringify(toasts));
 console.log('PASS transaction edit: exact draft, explicit account clear/reselect and partial draft encrypted writes.');
}finally{await f.dispose();}})().catch(error=>{console.error(error);process.exitCode=1;});
