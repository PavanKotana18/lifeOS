"use strict";
const assert = require('node:assert/strict');
const h = require('./tests/wp0/production-harness.cjs');
let passed = 0;
async function test(name, action) { await action(); passed++; console.log(`PASS: ${name}`); }
async function fixture(action) { const f = await h.fixture(); try { await action(f); } finally { await f.dispose(); } }
(async () => {
 await test('Cents-based category, month, savings and budget parity', async () => fixture(async f => {
  const { buildFinanceAnalytics } = f.load('src/services/financeAnalytics.ts');
  const rows = [0.1, 0.2].map(amount => ({ date:'2026-11-01', amount, type:'expense', category:'Food' }));
  rows.push({date:'2026-11-02',amount:0.4,type:'income'});
  const a = buildFinanceAnalytics(rows,[{categoryId:'food',monthlyAmount:0.4}], '2026-11', 2, [{id:'food',name:'Food'}]);
  assert.equal(a.totalExpenses,0.3); assert.equal(a.categories[0].amount,0.3);
  assert.equal(a.netSavings,0.1); assert.equal(a.budgetRows[0].remaining,0.1);
  assert.equal(a.periodRows.at(-1).expenses,0.3); assert.equal(a.periodRows[0].expenses,null);
 }));
 await test('Exact-alarm denial schedules approximate reminders and is diagnosed', async () => fixture(async f => {
  const ns=f.NotificationService;
  ns.checkExactAlarmPermission=async()=> 'denied';
  await ns.syncTasks([{id:'task',title:'Private fixture',dueDate:'2026-12-01',completed:false}], {...f.DEFAULT_NOTIFICATION_PREFERENCES,upcomingDeadlines:true});
  await ns.syncHabits([{id:'habit',name:'Private fixture',frequency:'daily',reminderTime:'09:00'}], {...f.DEFAULT_NOTIFICATION_PREFERENCES,habitReminders:true});
  await ns.syncMilestones([{id:'goal',status:'In Progress'}],[{id:'mile',goalId:'goal',title:'Fixture',targetDate:'2026-12-01'}], {...f.DEFAULT_NOTIFICATION_PREFERENCES,milestoneReminders:true});
  assert.equal(f.pending.size,9, 'task, weekly habit and milestone reminders use the supported inexact fallback'); assert.equal((await ns.getDiagnostics()).exactAlarm,'denied');
  const testAt = await ns.testNotification(1_000); assert.ok(testAt instanceof Date); assert.equal(f.pending.size,10, 'test notification is queued even without exact-alarm access');
 }));
 await test('Task reminder diagnostic reports eligibility and pending ID without task content', async () => fixture(async f => {
  const task = { id: 'safe-task-ref', title: 'SECRET TITLE MUST NOT APPEAR', dueDate: '2026-12-01', reminderAt: '2026-12-01T09:00:00.000Z', completed: false };
  const prefs = { ...f.DEFAULT_NOTIFICATION_PREFERENCES, taskReminders: true };
  await f.NotificationService.syncTasks([task], prefs);
  const report = await f.NotificationService.diagnoseTaskReminder(task, prefs);
  assert.equal(report.taskReference, task.id);
  assert.equal(report.categoryEnabled, true);
  assert.equal(report.androidPermission, 'granted');
  assert.equal(report.schedulingResult, 'pending');
  assert.ok(report.pendingNotificationId);
  assert.equal(JSON.stringify(report).includes(task.title), false);
 }));
 await test('Permission UI permits approximate reminders without exact-alarm settings detour', async () => fixture(async f => {
  const ns=f.NotificationService;let requested=0;
  ns.checkExactAlarmPermission=async()=> 'denied'; ns.requestExactAlarmPermission=async()=>{ requested++;return 'denied'; };
  const fn=h.appFunction('askNotificationPermission');
  const ask=h.bind(fn,{...f.appDeps(),notificationPermissionRequested:false,setNotificationPermissionRequested(){},
   StorageService:{settings:{async set(){}}}});
  const approximate = await ask(); assert.equal(approximate.granted,true); assert.equal(approximate.status,'approximate'); assert.equal(requested,0);
  ns.checkExactAlarmPermission=async()=> 'granted'; assert.equal((await ask()).status,'granted');
 }));
 await test('Empty reschedule removes stale kinds and preserves unrelated alarms', async () => fixture(async f => {
  f.pending.set(1,{id:1,extra:{kind:'habitReminder'}}); f.pending.set(2,{id:2,extra:{kind:'milestoneReminder'}});
  f.pending.set(3,{id:3,extra:{kind:'unrelated'}});
  await f.NotificationService.syncHabits([],f.DEFAULT_NOTIFICATION_PREFERENCES);
  await f.NotificationService.syncMilestones([],[],f.DEFAULT_NOTIFICATION_PREFERENCES);
  assert.deepEqual([...f.pending.keys()],[3]);
 }));
 await test('Reset cancellation failure preserves database records and reports failure', async () => fixture(async f => {
  await f.lifeOSDatabase.tasks.add({id:'keep',title:'Synthetic fixture',completed:false,createdAt:'2026-11-06T00:00:00Z'});
  f.NotificationService.cancelAllRecordReminders=async()=>{throw Error('SIMULATED_NATIVE_CANCEL_FAILURE');};
  const messages=[];const reset=h.bind(h.buttonHandler('Clear All Application Data'),{...f.appDeps(),showToast:(...args)=>messages.push(args)});
  await reset();assert.equal(await f.lifeOSDatabase.tasks.count(),1);assert.equal(messages.at(-1)[1],'danger');
 }));
 console.log(`LOCAL CONSOLIDATION: ${passed}/6 passed (native simulated)`);
})().catch(e=>{console.error(e);process.exitCode=1;});
