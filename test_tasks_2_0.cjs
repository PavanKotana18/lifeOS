const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');

const { groupUpcomingTasks, getSubtaskProgress } = require('./src/services/taskViews.ts');
const task = (id, dueDate, overrides = {}) => ({ id, title: id, dueDate, priority: 'Medium', recurring: 'None', completed: false, createdAt: '2026-11-01T00:00:00.000Z', ...overrides });

const groups = groupUpcomingTasks([
  task('tomorrow-late', '2026-11-14', { dueTime: '17:00' }),
  task('tomorrow-early', '2026-11-14', { dueTime: '08:30' }),
  task('next-day', '2026-11-15'), task('today', '2026-11-13'), task('past', '2026-11-12'),
  task('invalid', '2026-02-30'), task('completed-future', '2026-11-16', { completed: true }),
], '2026-11-13');
assert.deepEqual(groups.map(group => group.key), ['2026-11-14', '2026-11-15', '2026-11-16']);
assert.deepEqual(groups[0].tasks.map(item => item.id), ['tomorrow-early', 'tomorrow-late']);
assert.match(groups[0].label, /^Tomorrow/);
assert.equal(groups[2].tasks[0].completed, true, 'completed tasks remain represented in their date group');
assert.throws(() => groupUpcomingTasks([], '2026-02-30'), /valid local calendar date/);
assert.deepEqual(getSubtaskProgress(), { completed: 0, total: 0, percent: 0 });
assert.deepEqual(getSubtaskProgress([{ completed: true }, { completed: false }, { completed: true }]), { completed: 2, total: 3, percent: 67 });

const app = fs.readFileSync('src/App.tsx', 'utf8');
const types = fs.readFileSync('src/types.ts', 'utf8');
const component = fs.readFileSync('src/components/TaskSubtasks.tsx', 'utf8');
const detail = fs.readFileSync('src/components/TaskDetailScreen.tsx', 'utf8');
assert.match(types, /subtasks\?: TaskSubtask\[\]/, 'subtasks remain optional for older task records');
assert.match(detail, /role="dialog" aria-modal="true" aria-labelledby="task-detail-title"/, 'detail is presented as a focused screen');
assert.match(detail, /screenRef\.current\?\.focus\(\)/, 'opening detail moves keyboard focus into the screen');
assert.match(app, /taskDetailReturnFocusRef\.current\.focus\(\)/, 'closing detail returns keyboard focus');
assert.match(app, /StorageService\.tasks\.update\(plannerDetailTask\.id, \{ subtasks \}\)/, 'subtask changes use the existing protected storage facade');
assert.match(app, /upcomingTaskGroups\.find\(group => group\.tasks\[0\]\?\.id === t\.id\)/, 'upcoming tasks render grouped date headers');
for (const behavior of ['Complete', 'Edit subtask', 'Delete subtask', 'Add a step']) assert.ok(component.includes(behavior), `subtask UI exposes ${behavior}`);
console.log('Tasks 2.0 view, subtask, persistence, and navigation checks passed.');
