'use strict';
const assert = require('node:assert/strict');
const { fixture } = require('./tests/wp0/production-harness.cjs');

(async () => {
  const f = await fixture();
  try {
    await f.activate();
    const { buildTaskNotificationPlan } = f.load('src/services/domainUtils.ts');
    const prefs = { ...f.DEFAULT_NOTIFICATION_PREFERENCES, taskReminders: true };
    const task = { id: 'test-task', title: 'Synthetic task', dueDate: '2030-04-22', dueTime: '19:36', recurring: 'None', completed: false, priority: 'Medium' };
    const now = new Date(2030, 3, 21);
    const due = new Date(2030, 3, 22, 19, 36);
    const early = new Date(2030, 3, 22, 19, 21);
    assert.deepEqual(buildTaskNotificationPlan(task, prefs, now), [{ kind: 'dueTime', at: due }]);
    assert.deepEqual(buildTaskNotificationPlan({ ...task, reminderLeadMinutes: 15 }, prefs, now), [
      { kind: 'dueTime', at: due }, { kind: 'taskReminders', at: early },
    ]);
    assert.deepEqual(buildTaskNotificationPlan({ ...task, reminderAt: due.toISOString() }, prefs, now), [{ kind: 'dueTime', at: due }]);
    assert.deepEqual(buildTaskNotificationPlan({ ...task, dueAlertDisabled: true }, prefs, now), []);
    for (const variant of [{ completed: true }, { dueDate: undefined }, { dueTime: undefined }, { id: 'lifeos-demo-v2:task:1' }, { recurrenceRootId: 'lifeos-demo-v2:task:1' }]) {
      assert.deepEqual(buildTaskNotificationPlan({ ...task, ...variant }, prefs, now), []);
    }
    assert.deepEqual(buildTaskNotificationPlan(task, f.DEFAULT_NOTIFICATION_PREFERENCES, now), []);
    assert.deepEqual(buildTaskNotificationPlan(task, { ...prefs, overdueAlerts: true }, new Date(+due + 1000)), []);
    assert.deepEqual(buildTaskNotificationPlan({ ...task, dueTime: undefined }, prefs, now, '09:00'), [{ kind: 'dueTime', at: new Date(2030, 3, 22, 9) }]);
    const rows = f.StorageService.tasks;
    const saved = await rows.add({ ...task, recurring: 'Daily', reminderLeadMinutes: 15 });
    await f.NotificationService.syncTasks(await rows.getAll(), prefs);
    assert.equal(f.pending.size, 2);
    const before = new Map([...f.pending].map(([id, row]) => [id, +new Date(row.schedule.at)]));
    await f.NotificationService.syncTasks(await rows.getAll(), prefs);
    assert.deepEqual(new Map([...f.pending].map(([id, row]) => [id, +new Date(row.schedule.at)])), before);
    await rows.update(saved.id, { dueTime: '21:00', dueAlertDisabled: true });
    await f.NotificationService.syncTasks(await rows.getAll(), prefs);
    assert.equal(f.pending.size, 1);
    assert.equal(+new Date([...f.pending.values()][0].schedule.at), +new Date(2030, 3, 22, 20, 45));
    await rows.toggleCompleted(saved.id, true);
    const recurring = (await rows.getAll()).find(row => row.recurrenceRootId === saved.id);
    assert.equal(recurring.reminderLeadMinutes, 15);
    assert.equal(recurring.dueAlertDisabled, true);
    await f.NotificationService.syncTasks(await rows.getAll(), prefs);
    assert.equal(f.pending.size, 1);
    assert.equal([...f.pending.values()][0].extra.taskId, recurring.id);
    await rows.delete(recurring.id);
    await f.NotificationService.syncTasks(await rows.getAll(), prefs);
    assert.equal(f.pending.size, 0);
    console.log('PASS due-time and optional early reminders, opt-out, legacy dedupe, sample isolation, date-only policy, encrypted edit, recurrence and deletion. Native bridge simulated.');
  } finally { await f.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
