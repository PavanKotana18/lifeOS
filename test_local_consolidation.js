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
 await test('Selected task reminder, upcoming deadline, overdue alert and date-only policy stay distinct', async () => fixture(async f => {
  const domain=f.load('src/services/domainUtils.ts');
  const due=new Date(2030,0,2,12,0,0,0), reminder=new Date(2030,0,2,10,30,0,0);
  const task={id:'task-distinct',dueDate:'2030-01-02',dueTime:'12:00',reminderAt:reminder.toISOString(),completed:false};
  const prefs={...f.DEFAULT_NOTIFICATION_PREFERENCES,taskReminders:true,upcomingDeadlines:true,overdueAlerts:true};
  const plan=domain.buildTaskNotificationPlan(task,prefs,new Date(2030,0,2,8,0,0,0));
  assert.deepEqual(plan.map(x=>x.kind),['taskReminders','upcomingDeadlines','overdueAlerts']);
  assert.equal(plan[0].at.getTime(),reminder.getTime(),'reminder fires at user-selected instant');
  assert.equal(plan[1].at.getTime(),due.getTime()-60*60_000,'deadline alert policy stays separate');
  assert.equal(plan[2].at.getTime(),due.getTime()+60_000,'overdue alert follows due time');
  assert.ok(Number.isInteger(domain.stableNotificationId('task:task-distinct:taskReminders')));
  assert.ok(domain.stableNotificationId('task:task-distinct:taskReminders') > 0 && domain.stableNotificationId('task:task-distinct:taskReminders') <= 2147483646);
  const dateOnly={id:'date-only',dueDate:'2030-01-02',completed:false};
  const datePlan=domain.buildTaskNotificationPlan(dateOnly,{...prefs,taskReminders:false},new Date(2030,0,2,8,0,0,0));
  assert.equal(datePlan.find(x=>x.kind==='upcomingDeadlines').at.getHours(),9,'date-only deadline keeps its existing 09:00 alert policy');
  assert.equal(domain.getTaskStatus({...dateOnly,dueTime:'12:00',completed:false},new Date(2030,0,2,12,0,0,0)),'Pending','equal-to-deadline minute is not overdue');
  assert.equal(domain.getTaskStatus({...dateOnly,dueTime:'12:00',completed:false},new Date(2030,0,2,12,0,0,1)),'Overdue','overdue begins after the actual deadline instant');
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
 await test('Only user-selected task reminders use Android idle-aware alarm quota', async () => fixture(async f => {
  const ns=f.NotificationService;
  ns.checkExactAlarmPermission=async()=> 'denied';
  const prefs={...f.DEFAULT_NOTIFICATION_PREFERENCES,taskReminders:true,upcomingDeadlines:true,overdueAlerts:true};
  const task={id:'idle-quota-task',title:'Synthetic',dueDate:'2030-01-02',dueTime:'12:00',reminderAt:new Date(Date.now()+60*60_000).toISOString(),completed:false};
  await ns.syncTasks([task],prefs);
  const taskEntries=[...f.pending.values()].filter(item=>item.extra?.taskId===task.id);
  assert.equal(taskEntries.length,3,'reminder, deadline and overdue alert remain distinct schedules');
  assert.equal(taskEntries.find(item=>item.extra.kind==='taskReminders').schedule.allowWhileIdle,true);
  assert.equal(taskEntries.find(item=>item.extra.kind==='upcomingDeadlines').schedule.allowWhileIdle,false);
  assert.equal(taskEntries.find(item=>item.extra.kind==='overdueAlerts').schedule.allowWhileIdle,false);
  await ns.syncHabits([{id:'idle-quota-habit',frequency:'daily',reminderTime:'09:00'}],{...prefs,taskReminders:false,habitReminders:true});
  assert.ok([...f.pending.values()].filter(item=>item.extra?.kind==='habitReminder').every(item=>item.schedule.allowWhileIdle===false));
 }));
 await test('Android capability diagnostics distinguish an available bridge from delivery evidence', async () => fixture(async f => {
  const report=await f.NotificationService.getDiagnostics();
  assert.equal(report.capability,'available'); assert.equal(report.supported,true);
  assert.equal(report.androidApi,35); assert.equal(report.packageName,'com.lifeos.personal');
  assert.equal(report.appNotifications,'enabled'); assert.equal(report.permission,'granted');
  assert.equal(report.pendingCount,0,'an empty pending queue says nothing about past delivery');
  assert.equal(report.visibleNotificationCount,0,'active shade notifications are queried separately from pending schedules');
  assert.equal(report.batteryOptimizationExempt,false,'runtime facts report OS power allowlisting without requesting exemption');
  assert.equal(report.build.capacitor.localNotifications,'6.1.3');
  const raw=global.localStorage.getItem('lifeos.notificationDiagnostics') || '';
  assert.equal(raw.includes('Private'),false,'diagnostics do not serialize task content');
 }));
 await test('A genuinely missing Android notification plugin is explicit and scheduling cannot silently succeed', async () => fixture(async f => {
  f.setPluginAvailable('LocalNotifications',false);
  const report=await f.NotificationService.getDiagnostics();
  assert.equal(report.capability,'unavailable'); assert.equal(report.permission,'unknown');
  await assert.rejects(f.NotificationService.syncTasks([],f.DEFAULT_NOTIFICATION_PREFERENCES),/native plugin is not registered/i);
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
  assert.equal(report.plannedNotifications.length,1);
  assert.equal(report.plannedNotifications[0].kind,'taskReminders');
  assert.equal(report.plannedNotifications[0].inAndroidPendingQueue,true);
  assert.equal(JSON.stringify(report).includes(task.title), false);
 }));
 await test('Persisted task reminder is queued at its saved local-time instant and survives failed reschedule', async () => fixture(async f => {
  const stableId = f.load('src/services/domainUtils.ts').stableNotificationId;
  const prefs = { ...f.DEFAULT_NOTIFICATION_PREFERENCES, taskReminders: true };
  const firstAt = new Date(Date.now() + 90 * 60_000);
  const nextAt = new Date(Date.now() + 150 * 60_000);
  const task = await f.StorageService.tasks.add({ title: 'Synthetic reminder', dueDate: '2030-01-01', priority: 'Medium', recurring: 'None', completed: false, reminderAt: firstAt.toISOString() });
  const stored = await f.StorageService.tasks.getAll();
  assert.equal(stored[0].reminderAt, firstAt.toISOString(), 'database persists reminder as the selected absolute instant');
  await f.NotificationService.syncTasks(stored, prefs);
  let report = await f.NotificationService.diagnoseTaskReminder(stored[0], prefs);
  assert.equal(report.schedulingResult, 'pending');
  assert.equal(report.pendingTimestampMatches, true);
  assert.equal(new Date(f.pending.get(report.pendingNotificationId).schedule.at).getTime(), firstAt.getTime());
  f.notifications.schedule = async () => { throw new Error('SIMULATED_SCHEDULE_REJECTION'); };
  const edited = { ...stored[0], reminderAt: nextAt.toISOString() };
  const originalError = console.error;
  console.error = () => {};
  try { await assert.rejects(f.NotificationService.syncTasks([edited], prefs), /SIMULATED_SCHEDULE_REJECTION/); }
  finally { console.error = originalError; }
  report = await f.NotificationService.diagnoseTaskReminder(edited, prefs);
  assert.equal(report.schedulingResult, 'schedule-failed');
  assert.equal(report.cancellationReason, 'pending-time-mismatch');
  assert.equal(report.pendingTimestampMatches, false);
  assert.equal(new Date(f.pending.get(stableId(`task:${task.id}:taskReminders`)).schedule.at).getTime(), firstAt.getTime(), 'failed replacement leaves the previously valid alarm intact');
 }));
 await test('Reminder lifecycle evidence distinguishes native acceptance, queue observation, posting and taps without record content', async () => fixture(async f => {
  const ns=f.NotificationService;
  ns.checkExactAlarmPermission=async()=> 'denied';
  const prefs={...f.DEFAULT_NOTIFICATION_PREFERENCES,taskReminders:true};
  const reminderAt=new Date(Date.now()+90*60_000);
  const task=await f.StorageService.tasks.add({title:'PRIVATE TASK TITLE',dueDate:'2030-01-01',priority:'Medium',recurring:'None',completed:false,reminderAt:reminderAt.toISOString()});
  const id=f.load('src/services/domainUtils.ts').stableNotificationId(`task:${task.id}:taskReminders`);
  await ns.syncTasks([task],prefs);
  let lifecycle=JSON.parse(global.localStorage.getItem('lifeos.notificationLifecycle.v1'))[String(id)];
  assert.equal(lifecycle.scheduleMode,'inexact-allowWhileIdle');
  assert.ok(lifecycle.scheduleRequestedAt); assert.ok(lifecycle.nativeAcceptedAt); assert.ok(lifecycle.pendingObservedAt);
  assert.equal(lifecycle.deliveryState,'pending-observed');
  assert.equal(JSON.stringify(lifecycle).includes('PRIVATE TASK TITLE'),false);
  assert.equal(JSON.stringify(lifecycle).includes(task.id),false,'the persisted lifecycle uses the numeric notification key, not task identifiers');
  f.pending.delete(id);
  const RealDate=global.Date, fakeNow=RealDate.now()+120*60_000;
  global.Date=class extends RealDate { constructor(...args){ super(...(args.length?args:[fakeNow])); } static now(){ return fakeNow; } };
  try {
   const report=await ns.diagnoseTaskReminder(task,prefs);
   assert.equal(report.lifecycleEvidence.deliveryUnconfirmed,true,'a past reminder absent from active and pending state remains explicitly unconfirmed');
   assert.equal(report.lifecycleEvidence.nativeAcceptedAt,lifecycle.nativeAcceptedAt,'the original schedule acceptance remains available after its pending row disappears');
   assert.equal(report.deliveryEvidence,'unknown-no-active-or-pending-record');
  } finally { global.Date=RealDate; }
  await ns.addReceivedListener(()=>{});
  f.emitNotification('localNotificationReceived',{id,extra:{kind:'taskReminders',originalReminderAt:task.reminderAt}});
  lifecycle=JSON.parse(global.localStorage.getItem('lifeos.notificationLifecycle.v1'))[String(id)];
  assert.equal(lifecycle.deliveryState,'native-receiver-event-observed'); assert.ok(lifecycle.receiverEventAt);
  assert.equal(lifecycle.deliveryObservedAt,undefined,'the receiver callback alone is not reported as proof that Android displayed the notification');
  await ns.addActionListener(()=>{});
  f.emitNotification('localNotificationActionPerformed',{notification:{id,extra:{kind:'taskReminders',originalReminderAt:task.reminderAt}}});
  lifecycle=JSON.parse(global.localStorage.getItem('lifeos.notificationLifecycle.v1'))[String(id)];
  assert.ok(lifecycle.tappedAt,'tap evidence persists separately from delivery evidence');
  assert.equal(lifecycle.deliveryState,'tapped','tap evidence is not mislabeled as a current active-notification observation');
 }));
 await test('Revoked Android notification permission cancels native alarms but preserves task reminder definition', async () => fixture(async f => {
  const ns=f.NotificationService;
  const prefs={...f.DEFAULT_NOTIFICATION_PREFERENCES,taskReminders:true};
  const reminderAt=new Date(Date.now()+60*60_000).toISOString();
  const task=await f.StorageService.tasks.add({title:'Synthetic permission fixture',dueDate:'2030-01-01',priority:'Medium',recurring:'None',completed:false,reminderAt});
  const id=f.load('src/services/domainUtils.ts').stableNotificationId(`task:${task.id}:taskReminders`);
  await ns.syncTasks([task],prefs);
  assert.ok(f.pending.has(id));
  f.notifications.checkPermissions=async()=>({display:'denied'});
  await ns.syncTasks([task],prefs);
  assert.equal(f.pending.has(id),false,'permission revocation removes the unusable native alarm');
  assert.equal((await f.StorageService.tasks.getAll()).find(row=>row.id===task.id).reminderAt,reminderAt,'reminder definition remains saved');
  const lifecycle=JSON.parse(global.localStorage.getItem('lifeos.notificationLifecycle.v1'))[String(id)];
  assert.equal(lifecycle.deliveryState,'cancelled');
  assert.equal(lifecycle.cancellationReason,'android-notification-permission-unavailable');
 }));
 await test('Resume catches up a still-persisted past inexact reminder without claiming delivery', async () => fixture(async f => {
  const ns=f.NotificationService;
  ns.checkExactAlarmPermission=async()=> 'denied';
  const stableId=f.load('src/services/domainUtils.ts').stableNotificationId;
  const prefs={...f.DEFAULT_NOTIFICATION_PREFERENCES,taskReminders:true};
  const selectedAt=new Date(Date.now()-5*60_000);
  const task=await f.StorageService.tasks.add({title:'Synthetic late reminder',dueDate:'2030-01-01',priority:'Medium',recurring:'None',completed:false,reminderAt:selectedAt.toISOString()});
  const id=stableId(`task:${task.id}:taskReminders`);
  f.pending.set(id,{id,title:'Task reminder',schedule:{at:selectedAt},extra:{kind:'taskReminders',taskId:task.id}});
  await ns.syncTasks([task],prefs);
  let queued=f.pending.get(id);
  assert.ok(queued,'task resynchronization preserves and replaces the still-persisted past reminder');
  assert.equal(queued.extra.lateCatchUp,true);
  assert.equal(queued.extra.originalReminderAt,selectedAt.toISOString());
  const firstCatchUpAt=new Date(queued.schedule.at).getTime();
  assert.ok(firstCatchUpAt>Date.now(),'catch-up is scheduled immediately in the foreground');
  await ns.syncTasks([task],prefs);
  queued=f.pending.get(id);
  assert.equal(new Date(queued.schedule.at).getTime(),firstCatchUpAt,'repeat sync does not postpone or duplicate the catch-up alarm');
  let report=await ns.diagnoseTaskReminder(task,prefs);
  assert.equal(report.schedulingResult,'late-delivery-pending');
  assert.equal(report.deliveryEvidence,'pending-store-only');
  assert.equal(report.pendingNotificationId,id);
  assert.equal(report.visibleInNotificationShade,false);
  assert.match(report.deliveryTiming,/inexact-approximate/);
  assert.notEqual(report.schedulingResult,'delivered');
  f.pending.delete(id);
  f.delivered.set(id,{id});
  report=await ns.diagnoseTaskReminder(task,prefs);
  assert.equal(report.schedulingResult,'currently-visible-in-android-shade');
  assert.equal(report.deliveryEvidence,'currently-visible');
  assert.equal(report.visibleInNotificationShade,true,'active Android shade state is reported separately from pending schedule state');
 }));
 await test('Capacitor reboot-restored reminder is recognized and retained instead of cancelled', async () => fixture(async f => {
  const ns=f.NotificationService;
  const stableId=f.load('src/services/domainUtils.ts').stableNotificationId;
  const prefs={...f.DEFAULT_NOTIFICATION_PREFERENCES,taskReminders:true};
  const selectedAt=new Date(Date.now()-2*60_000);
  const task=await f.StorageService.tasks.add({title:'Synthetic reboot reminder',dueDate:'2030-01-01',priority:'Medium',recurring:'None',completed:false,reminderAt:selectedAt.toISOString()});
  const id=stableId(`task:${task.id}:taskReminders`);
  // Capacitor Local Notifications 6.1.3 rewrites an elapsed trigger to now+15s
  // in its BOOT_COMPLETED receiver while preserving legacy extra metadata.
  f.pending.set(id,{id,title:'Task reminder',schedule:{at:new Date(Date.now()+15_000)},extra:{kind:'taskReminders',taskId:task.id}});
  await ns.syncTasks([task],prefs);
  const queued=f.pending.get(id);
  assert.ok(queued,'boot-restored alarm is not treated as an unrelated future reminder');
  assert.equal(queued.extra.lateCatchUp,true,'stale restore trigger is normalized to one immediate catch-up');
  assert.equal(queued.extra.originalReminderAt,selectedAt.toISOString());
  assert.ok(new Date(queued.schedule.at).getTime()>Date.now());
  await ns.syncTasks([task],prefs);
  assert.equal(new Date(f.pending.get(id).schedule.at).getTime(),new Date(queued.schedule.at).getTime(),'repeated resume synchronization is idempotent');
 }));
 await test('Task sync removes completed or deleted task schedules without affecting unrelated reminders', async () => fixture(async f => {
  const prefs = { ...f.DEFAULT_NOTIFICATION_PREFERENCES, taskReminders: true };
  const stableId = f.load('src/services/domainUtils.ts').stableNotificationId;
  const at = new Date(Date.now() + 120 * 60_000).toISOString();
  const first = await f.StorageService.tasks.add({ title: 'Synthetic one', dueDate: '2030-01-01', priority: 'Medium', recurring: 'None', completed: false, reminderAt: at });
  const second = await f.StorageService.tasks.add({ title: 'Synthetic two', dueDate: '2030-01-01', priority: 'Medium', recurring: 'None', completed: false, reminderAt: at });
  const rows = await f.StorageService.tasks.getAll();
  await f.NotificationService.syncTasks(rows, prefs);
  const firstId = stableId(`task:${first.id}:taskReminders`), secondId = stableId(`task:${second.id}:taskReminders`);
  await f.NotificationService.syncTasks([{ ...rows[0], completed: true }, rows[1]], prefs);
  assert.equal(f.pending.has(firstId), false, 'completed reminder is cancelled');
  assert.equal(f.pending.has(secondId), true, 'unrelated active reminder remains queued');
  await f.NotificationService.syncTasks([rows[1]], prefs);
  assert.equal(f.pending.has(secondId), true, 'task deletion synchronization preserves other task reminder');
  await f.NotificationService.syncTasks([], prefs);
  assert.equal(f.pending.has(secondId), false, 'deleted task reminder is removed after deletion sync');
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
 console.log(`LOCAL CONSOLIDATION: ${passed}/16 passed (native simulated)`);
})().catch(e=>{console.error(e);process.exitCode=1;});
