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
    for (const variant of [{ completed: true }, { dueDate: undefined }, { id: 'lifeos-demo-v2:task:1' }, { recurrenceRootId: 'lifeos-demo-v2:task:1' }]) {
      assert.deepEqual(buildTaskNotificationPlan({ ...task, ...variant }, prefs, now), []);
    }
    assert.deepEqual(buildTaskNotificationPlan(task, f.DEFAULT_NOTIFICATION_PREFERENCES, now), []);
    assert.deepEqual(buildTaskNotificationPlan(task, { ...prefs, overdueAlerts: true }, new Date(+due + 1000)), []);
    const dateOnly = { ...task, dueTime: undefined };
    const atNine = [{ kind: 'dueTime', at: new Date(2030, 3, 22, 9) }];
    assert.deepEqual(buildTaskNotificationPlan(dateOnly, prefs, now), atNine);
    assert.deepEqual(buildTaskNotificationPlan(dateOnly, prefs, now, '09:00'), atNine);
    assert.deepEqual(buildTaskNotificationPlan(dateOnly, { ...prefs, upcomingDeadlines: true }, now), atNine);
    assert.deepEqual(buildTaskNotificationPlan(dateOnly, prefs, now, ''), []);
    const savedAfterNine = new Date(2030, 3, 22, 10);
    const savedDateOnly = { ...dateOnly, dateOnlyAlertAnchorAt: savedAfterNine.toISOString() };
    const fallback = [{ kind: 'dueTime', at: new Date(2030, 3, 22, 10, 1) }];
    assert.deepEqual(buildTaskNotificationPlan(savedDateOnly, prefs, savedAfterNine), fallback);
    assert.deepEqual(buildTaskNotificationPlan(savedDateOnly, prefs, new Date(+savedAfterNine + 30_000)), fallback);
    assert.deepEqual(buildTaskNotificationPlan(savedDateOnly, prefs, new Date(+savedAfterNine + 60_000)), []);
    const rows = f.StorageService.tasks;
    const saved = await rows.add({ ...task, recurring: 'Daily', reminderLeadMinutes: 15 });
    await f.NotificationService.syncTasks(await rows.getAll(), prefs);
    assert.equal(f.pending.size, 2);
    const copy = f.load('src/services/notificationCopy.ts');
    assert.equal(copy.normalizeNotificationTone(null), 'warm');
    assert.deepEqual(copy.reminderCopy('overdueAlerts', 'playful', 2), copy.reminderCopy('overdueAlerts', 'clear', 2));
    const warm = [...f.pending.values()].map(row => row.body);
    await f.NotificationService.syncTasks(await rows.getAll(), prefs, undefined, 'playful');
    assert.notDeepEqual([...f.pending.values()].map(row => row.body), warm);
    assert.ok([...f.pending.values()].every(row => !row.body.includes(task.title)));
    assert.equal(await f.NotificationService.snoozeTask(saved), true);
    const snooze = [...f.pending.values()].find(row => row.extra.kind === 'taskSnooze');
    assert.ok(+new Date(snooze.schedule.at) - Date.now() > 595_000);
    assert.equal(await f.NotificationService.snoozeTask(saved), true);
    assert.equal([...f.pending.values()].filter(row => row.extra.kind === 'taskSnooze').length, 1);
    await f.NotificationService.cancelTask(saved);
    await f.NotificationService.syncTasks(await rows.getAll(), prefs);
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
    const simultaneousA = await rows.add({ ...task, title: 'Simultaneous A' });
    const simultaneousB = await rows.add({ ...task, title: 'Simultaneous B' });
    await f.NotificationService.syncTasks(await rows.getAll(), prefs);
    assert.equal(f.pending.size, 2);
    assert.deepEqual(new Set([...f.pending.values()].map(row => row.extra.taskId)), new Set([simultaneousA.id, simultaneousB.id]));
    await f.NotificationService.syncTasks(await rows.getAll(), f.DEFAULT_NOTIFICATION_PREFERENCES);
    assert.equal(f.pending.size, 0);
    console.log('PASS due-time and optional early reminders, opt-out, legacy dedupe, sample isolation, date-only policy, encrypted edit, recurrence and deletion. Native bridge simulated.');
  } finally { await f.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
