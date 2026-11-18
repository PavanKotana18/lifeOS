'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const h = require('./tests/wp0/production-harness.cjs');
const { getTaskDeadline, getTaskStatus, sortTasksByDeadline, sortTasksBySchedule, getTasksForDate, buildTaskNotificationPlan } = require('./src/services/domainUtils.ts');
const { groupUpcomingTasks } = require('./src/services/taskViews.ts');

(async () => {
  const f = await h.fixture();
  let restarted;
  try {
    await f.activate();
    const base = { title: 'Synthetic inbox task', priority: 'Medium', recurring: 'None', completed: false };
    const task = await f.StorageService.tasks.add({ ...base, dueDate: '' });
    assert.equal(task.dueDate, undefined, 'Blank entry dates normalize to an unscheduled record');
    const read = (await f.StorageService.tasks.getAll()).find(row => row.id === task.id);
    assert.equal(read.dueDate, undefined);
    assert.equal(getTaskDeadline(read), null);
    assert.equal(getTaskStatus(read, new Date('2099-01-01T12:00:00Z')), 'Pending');
    assert.equal(getTasksForDate([read], '2026-11-17').length, 0);
    assert.equal(groupUpcomingTasks([read], '2026-11-17').length, 0);
    const preferences = { taskReminders: true, upcomingDeadlines: true, overdueAlerts: true };
    assert.deepEqual(buildTaskNotificationPlan({ ...read, reminderAt: '2099-02-01T09:00:00Z' }, preferences, new Date('2026-01-01T00:00:00Z')), [], 'Even a malformed undated reminder cannot schedule an alarm');
    const raw = await f.lifeOSDatabase.tasks.get(task.id);
    assert.equal(raw.__lifeosEncrypted, 1); assert.equal(raw.title, undefined); assert.equal(raw.dueDate, undefined);

    await f.StorageService.tasks.toggleCompleted(task.id, true);
    let records = await f.StorageService.tasks.getAll();
    assert.equal(records.length, 1, 'Completing an undated task does not create an occurrence');
    assert.equal(records[0].completed, true);
    await f.StorageService.tasks.toggleCompleted(task.id, false);
    assert.equal((await f.StorageService.tasks.getAll())[0].completed, false);

    const dated = await f.StorageService.tasks.add({ ...base, title: 'Synthetic dated task', dueDate: '2099-02-01', dueTime: '09:00', reminderAt: '2099-02-01T08:30:00Z' });
    await f.NotificationService.syncTasks([dated], preferences);
    assert.ok(f.pending.size > 0, 'A dated fixture has simulated queued alarms before unscheduling');
    records = await f.StorageService.tasks.getAll();
    assert.equal(sortTasksByDeadline(records, new Date('2026-01-01T00:00:00Z'))[0].id, dated.id);
    assert.equal(sortTasksBySchedule(records)[0].id, dated.id);
    assert.equal(groupUpcomingTasks(records, '2026-11-17')[0].tasks[0].id, dated.id);
    const before = await f.lifeOSDatabase.tasks.toArray();
    await assert.rejects(f.StorageService.tasks.update(dated.id, { dueDate: undefined }), /date/i);
    assert.deepEqual(await f.lifeOSDatabase.tasks.toArray(), before, 'Invalid unscheduling writes no partial data');
    for (const schedule of [{ dueTime: '10:00' }, { reminderAt: '2099-01-01T10:00:00Z' }, { recurring: 'Daily' }]) {
      await assert.rejects(f.StorageService.tasks.add({ ...base, ...schedule }), /date/i);
    }
    await assert.rejects(f.StorageService.tasks.add({ ...base, dueDate: '2026-02-30' }), /valid task date/);
    await f.StorageService.tasks.update(dated.id, { dueDate: undefined, dueTime: undefined, reminderAt: undefined, recurring: 'None' });
    const cleared = (await f.StorageService.tasks.getAll()).find(row => row.id === dated.id);
    assert.equal(cleared.dueDate, undefined); assert.equal(cleared.reminderAt, undefined);
    assert.deepEqual(buildTaskNotificationPlan(cleared, preferences), []);
    await f.NotificationService.syncTasks(await f.StorageService.tasks.getAll(), preferences);
    assert.equal(f.pending.size, 0, 'Unscheduling cancels the former simulated alarms instead of retaining catch-up work');

    const backup = await f.StorageService.backup.exportData();
    const parsed = JSON.parse(backup);
    assert.equal(parsed.tables.tasks[0].dueDate, undefined);
    const invalidBackup = JSON.parse(backup);
    invalidBackup.tables.tasks[0].recurring = 'Weekly';
    const beforeInvalidImport = await f.lifeOSDatabase.tasks.toArray();
    await assert.rejects(f.StorageService.backup.importData(JSON.stringify(invalidBackup), { replaceExisting: true }), /tasks.*schedule/);
    assert.deepEqual(await f.lifeOSDatabase.tasks.toArray(), beforeInvalidImport);
    await f.StorageService.backup.importData(backup, { replaceExisting: true });
    assert.equal((await f.StorageService.tasks.getAll()).filter(row => !row.dueDate).length, 2);
    restarted = await f.restart();
    await f.native.unlock(); restarted.sessionManager.unlock(); await restarted.activateEncryptedStorage();
    assert.equal((await restarted.StorageService.tasks.getAll()).filter(row => !row.dueDate).length, 2, 'Unscheduled tasks survive encrypted-runtime restart');
    restarted.sessionManager.lock(); await restarted.sessionManager.waitForIdle();
    await assert.rejects(restarted.StorageService.tasks.add(base), error => error?.code === 'LIFEOS_SESSION_LOCKED');
    console.log('UNSCHEDULED TASKS: encrypted persistence/restart, backup validation, schedule clearing, recurrence and notification exclusion passed with synthetic data; native interfaces simulated.');
  } finally {
    if (restarted) { restarted.sessionManager.lock(); await restarted.sessionManager.waitForIdle(); restarted.lifeOSDatabase.close(); }
    await f.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
