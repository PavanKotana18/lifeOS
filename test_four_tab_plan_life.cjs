'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loaded, file) => loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { default: PlanHub, selectPlanTasks } = require('./src/components/PlanHub.tsx');
const { default: LifeHub, displayGoalProgress } = require('./src/components/LifeHub.tsx');
const noop = () => {};
const today = '2026-11-17', now = new Date('2026-11-17T12:00:00');
const task = (id, dueDate, extra = {}) => ({ id, title: id, dueDate, priority: 'Medium', recurring: 'None', completed: false, createdAt: '2026-11-01T00:00:00Z', ...extra });
const tasks = [task('late', today, { dueTime: '08:00' }), task('today', today, { dueTime: '15:00', recurring: 'Daily', reminderAt: '2026-11-17T14:00:00Z' }), task('future', '2026-11-19'), task('undated', undefined), task('done', today, { completed: true }), task('done-undated', undefined, { completed: true })];
const ids = (view, query = '', status = 'all') => selectPlanTasks(tasks, today, now, view, query, status).map(row => row.id);
assert.deepEqual(ids('today'), ['late', 'today', 'done']);
assert.deepEqual(ids('upcoming'), ['future']);
assert.deepEqual(ids('unscheduled'), ['done-undated', 'undated']);
assert.equal(ids('all').length, tasks.length);
assert.deepEqual(ids('all', '', 'overdue'), ['late']);
assert.deepEqual(ids('all', '  FUTURE '), ['future']);
assert.deepEqual(ids('all', '', 'completed'), ['done', 'done-undated']);
assert.equal(selectPlanTasks([task('notes', undefined, { notes: 'Keep receipt' })], today, now, 'all', 'receipt', 'all').length, 1);
assert.equal(tasks.length, 6, 'Filters do not mutate the source of truth');
function walk(node, predicate, found = []) {
  if (Array.isArray(node)) node.forEach(child => walk(child, predicate, found));
  else if (React.isValidElement(node)) { if (predicate(node)) found.push(node); walk(node.props.children, predicate, found); }
  return found;
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : '';
function button(tree, label) { const matches = walk(tree, n => n.type === 'button' && text(n) === label); assert.equal(matches.length, 1, label); return matches[0]; }
// Exercise actual component handlers and subsequent renders with a deterministic
// React hook host. This is not a mounted browser/native interaction test.
const state = []; let cursor = 0;
function renderPlan(props) {
  const originalState = React.useState, originalId = React.useRef;
  React.useState = initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; };
  React.useRef = value => ({ current: value }); cursor = 0;
  try { return PlanHub(props); } finally { React.useState = originalState; React.useRef = originalId; }
}
const calls = [];
const props = { tasks, today, now, onNavigatePlanner: () => calls.push('calendar'), onOpenTask: value => calls.push('open:' + value.id), onToggleTask: value => calls.push('toggle:' + value.id), onSelectRange: noop, onOpenGoals: () => calls.push('goals'), onQuickAdd: async () => {} };
let tree = renderPlan(props);
let markup = renderToStaticMarkup(tree);
assert.match(markup, /Task views/); assert.match(markup, /Search tasks/); assert.match(markup, /All statuses/); assert.match(markup, /Add task/);
assert.match(markup, /Repeats daily/); assert.match(markup, /Reminder set/); assert.match(markup, /No due date/);
assert.match(markup, /done-undated/);
const view = label => walk(tree, n => n.type === 'button' && text(n).startsWith(label) && n.props['aria-pressed'] !== undefined)[0];
view('Today').props.onClick(); tree = renderPlan(props); markup = renderToStaticMarkup(tree);
assert.match(markup, /late/); assert.doesNotMatch(markup, /class="plan-hub-row-title">future/); assert.doesNotMatch(markup, /class="plan-hub-row-title">undated/);
view('Unscheduled').props.onClick(); tree = renderPlan(props);
assert.deepEqual(walk(tree, n => n.type === 'input' && n.props.type === 'checkbox').map(n => n.props['aria-label']), ['Mark undated complete', 'Mark done-undated incomplete']);
walk(tree, n => n.type === 'select')[0].props.onChange({ target: { value: 'all' } }); tree = renderPlan(props);
assert.equal(walk(tree, n => n.type === 'input' && n.props.type === 'checkbox').length, 2, 'Completed undated tasks are accessible');
walk(tree, n => n.type === 'input' && n.props.type === 'search')[0].props.onChange({ target: { value: 'missing' } }); tree = renderPlan(props);
assert.match(renderToStaticMarkup(tree), /No tasks match this view/);
button(tree, 'Show every task').props.onClick(); tree = renderPlan(props);
assert.equal(walk(tree, n => n.type === 'input' && n.props.type === 'checkbox').length, tasks.length);
walk(tree, n => n.type === 'input' && n.props['aria-label'] === 'Mark done incomplete')[0].props.onChange();
walk(tree, n => n.type === 'button' && n.props.className === 'plan-hub-task-open' && text(n).startsWith('future'))[0].props.onClick({ currentTarget: {} });
assert.match(markup, /Add task/); assert.doesNotMatch(markup, /plan-compose/);
assert.deepEqual(calls, ['toggle:done', 'open:future']);
const many = renderToStaticMarkup(React.createElement(PlanHub, { ...props, tasks: Array.from({ length: 12 }, (_, i) => task('task' + i, today)) }));
assert.equal((many.match(/class="plan-hub-task ui-interactive-row/g) || []).length, 12, 'Workspace does not hide tasks behind a five-row preview');
assert.doesNotMatch(fs.readFileSync('src/components/PlanHub.tsx', 'utf8'), /onTouchStart|onTouchMove|onTouchEnd|onPointerMove/, 'Local filters do not install competing swipe handlers');
const lifeProps = { habits: [{ id: 'h1', name: 'Walk', currentStreak: 3, completedToday: false }], goals: [{ id: 'g1', title: 'Read', progress: 45, current: '9 pages', target: '20 pages', targetDate: 'Dec 20', completedMilestones: 1, milestoneCount: 3 }], routinesDue: 1, completedRoutines: 0, weeklyCompleted: 2, weeklyTotal: 7, onCheckIn: h => calls.push('check:' + h.id), onCreateHabit: noop, onCreateGoal: noop, onHabits: () => calls.push('habits'), onGoals: () => calls.push('all-goals'), onInsights: () => calls.push('insights'), onOpenHabit: id => calls.push('habit:' + id), onOpenGoal: id => calls.push('goal:' + id) };
let life = LifeHub(lifeProps); markup = renderToStaticMarkup(life);
assert.match(markup, /0 of 1 check-ins/); assert.match(markup, /2 of 7 routines/); assert.match(markup, /1 of 3 milestones/); assert.match(markup, /aria-valuenow="45"/);
walk(life, n => n.props.className === 'life-goal-card')[0].props.onClick(); walk(life, n => n.props.className === 'life-habit-copy life-habit-detail')[0].props.onClick();
walk(life, n => n.props['aria-label'] === 'Complete Walk for today')[0].props.onClick();
assert.deepEqual(calls.slice(-3), ['goal:g1', 'habit:h1', 'check:h1']);
life = LifeHub({ ...lifeProps, onOpenGoal: undefined, onOpenHabit: undefined });
walk(life, n => n.props.className === 'life-goal-card')[0].props.onClick(); walk(life, n => n.props.className === 'life-habit-copy life-habit-detail')[0].props.onClick();
assert.deepEqual(calls.slice(-2), ['all-goals', 'habits'], 'Existing consumers retain collection navigation');
assert.equal(displayGoalProgress(Infinity), 0); assert.equal(displayGoalProgress(125), 100); assert.equal(displayGoalProgress(-1), 0); assert.equal(displayGoalProgress(45.5), 45.5);
const empty = renderToStaticMarkup(React.createElement(LifeHub, { ...lifeProps, habits: [], goals: [], routinesDue: 0, weeklyTotal: 0 }));
assert.match(empty, /Start tracking/); assert.match(empty, /Add a habit/); assert.match(empty, /Add a goal/); assert.doesNotMatch(empty, /Routine progress|role="progressbar"/);
console.log('FOUR-TAB PLAN/LIFE: real local views/search/status, complete task access, direct callbacks, quick entry, focused habit/goal navigation, real progress and combined empty state PASS. Hook/SSR tests only.');
