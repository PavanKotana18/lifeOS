'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { getTodayOverview } = require('./src/services/domainUtils.ts');

const overview = getTodayOverview(
  [
    { dueDate: '2026-10-31', completed: true },
    { dueDate: '2026-10-31', completed: false },
    { dueDate: '2026-11-01', completed: false },
  ],
  [
    { id: 'daily', frequency: 'daily' },
    { id: 'weekday', frequency: 'weekdays' },
    { id: 'weekly', frequency: 'weekly' },
  ],
  [
    { habitId: 'daily', date: '2026-10-31', completed: true },
    { habitId: 'weekly', date: '2026-10-29', completed: true },
  ],
  '2026-10-31'
);
assert.deepEqual(overview, {
  tasksCompleted: 1, tasksDue: 2,
  routinesCompleted: 1, routinesDue: 1,
  weeklyRoutinesCompleted: 1, weeklyRoutinesTotal: 1,
});
assert.throws(() => getTodayOverview([], [], [], '2026-02-30'), /valid local calendar date/);
assert.throws(() => getTodayOverview([], [], [], '2026-1-01'), /valid local calendar date/);
console.log('TODAY OVERVIEW: 3 checks passed; tasks, daily routines and weekly routines remain separate.');
