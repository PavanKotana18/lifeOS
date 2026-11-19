'use strict';
const assert = require('node:assert/strict');
const h = require('./wp0/production-harness.cjs');
require('../scripts/register-ts-test-loader.cjs');
const { isHabitEligible, calculateWeeklyHabitRate, getTodayOverview } = require('../src/services/domainUtils.ts');
const { budgetCarryoverMinor } = require('../src/services/budgetDisplay.ts');

const date = '2026-11-19';
const habit = { id: 'habit', frequency: 'daily', schedule: [{ from: '2026-11-01', weekdays: [1, 2, 4], sessionsPerWeek: 2 }], pauses: [{ from: '2026-11-17', through: '2026-11-17' }] };
assert.equal(isHabitEligible(habit, '2026-11-16'), true);
assert.equal(isHabitEligible(habit, '2026-11-17'), false);
assert.equal(isHabitEligible(habit, '2026-11-18'), false);
const log = { habitId: 'habit', date: '2026-11-16', completed: true };
assert.deepEqual(calculateWeeklyHabitRate([log, log], 'habit', new Date(2026, 10, 19, 12), 'daily', habit), { completed: 1, scheduled: 2, rate: 50 });
assert.equal(getTodayOverview([{ dueDate: '2026-11-18', completed: false }], [], [], date).tasksDue, 1);

const plan = { monthYear: '2026-11', carryover: true, categoryId: 'food' };
const prior = { monthYear: '2026-10', categoryId: 'food', currencyCode: 'INR', amountMinor: '10000' };
const expenses = [{ date: '2026-10-19', type: 'expense', category: 'Food', currencyCode: 'INR', amountMinor: '9801' }];
assert.equal(budgetCarryoverMinor(plan, [prior], expenses, [{ id: 'food', name: 'Food' }], 'INR'), 199n);
assert.equal(budgetCarryoverMinor({ ...plan, carryover: false }, [prior], expenses, [], 'INR'), 0n);

(async () => {
  const fixture = await h.fixture();
  try {
    const storage = fixture.StorageService;
    const goal = await storage.goals.add({ title: 'Reduce duration', mode: 'reduce', baselineValue: 30, category: 'Other', startDate: date, targetDate: '', currentValue: 30, targetValue: 15, unit: 'minute', priority: 'Medium', status: 'In Progress' });
    await storage.goals.update(goal.id, { currentValue: 15 });
    let stored = (await storage.goals.getAll()).find(item => item.id === goal.id);
    assert.equal(stored.status, 'Completed');
    assert.equal(stored.progressHistory[0].value, 15);
    await storage.goals.update(goal.id, { archived: true });
    stored = (await storage.goals.getAll()).find(item => item.id === goal.id);
    assert.equal(stored.archived, true);
    const milestones = await storage.goals.add({ ...goal, title: 'Milestones', mode: 'milestone', currentValue: 0, targetValue: 0, status: 'In Progress' });
    const step = await storage.goals.addMilestone({ goalId: milestones.id, title: 'First', completed: false });
    await storage.goals.toggleMilestone(step.id, true);
    assert.equal((await storage.goals.getAll()).find(item => item.id === milestones.id).status, 'Completed');
    await storage.goals.deleteMilestone(step.id);
    assert.equal((await storage.goals.getAll()).find(item => item.id === milestones.id).status, 'In Progress');
    const recurring = await storage.tasks.add({ title: 'Monthly checklist', dueDate: '2099-02-25', recurrenceScheduledDate: '2099-02-28', recurrenceAnchorDay: 31, recurring: 'Monthly', completed: false, priority: 'Medium', subtasks: [{ id: 'step', title: 'Prepare', completed: true, createdAt: '2026-11-19T12:00:00.000Z' }] });
    await storage.tasks.toggleCompleted(recurring.id, true);
    const next = (await storage.tasks.getAll()).find(item => item.recurrenceRootId === recurring.id);
    assert.equal(next.dueDate, '2099-03-31');
    assert.equal(next.subtasks[0].completed, false);
    await storage.tasks.toggleCompleted(recurring.id, false);
    assert.equal((await storage.tasks.getAll()).some(item => item.id === next.id), false);
    const raw = JSON.parse(await storage.backup.exportData());
    fixture.validateBackupTables(raw.tables);
    assert.equal(raw.tables.goals.find(item => item.id === goal.id).targetDate, '');
  } finally { await fixture.dispose(); }
  console.log('Maturity regressions passed for eligibility, task carryovers, exact budget carryover and encrypted goal modes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
