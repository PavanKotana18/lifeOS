'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};

const { sortTasksBySchedule } = require('./src/services/domainUtils.ts');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const PlanHub = require('./src/components/PlanHub.tsx').default;
const task = (id, dueDate, dueTime, createdAt = `2026-11-07T00:00:0${id.charCodeAt(0) % 10}.000Z`, completed = false) => ({
  id, title: id, dueDate, dueTime, createdAt, completed, priority: 'Medium', recurring: 'None',
});

const input = [
  task('late', '2026-11-07', '17:00'),
  task('date-only', '2026-11-07', undefined),
  task('early', '2026-11-07', '09:00'),
  task('tomorrow', '2026-11-08', '08:00'),
  task('completed', '2026-11-07', '08:00', undefined, true),
  task('tie-b', '2026-11-07', '09:00', '2026-11-01T00:00:00.000Z'),
  task('tie-a', '2026-11-07', '09:00', '2026-11-01T00:00:00.000Z'),
];
const sorted = sortTasksBySchedule(input);
assert.deepEqual(sorted.map(item => item.id), ['completed', 'tie-a', 'tie-b', 'early', 'late', 'date-only', 'tomorrow']);
assert.deepEqual(input.map(item => item.id), ['late', 'date-only', 'early', 'tomorrow', 'completed', 'tie-b', 'tie-a'], 'sorting does not mutate caller data');
assert.deepEqual(sortTasksBySchedule([task('unknown', '', undefined), task('dated', '2026-11-08', '23:00')]).map(item => item.id), ['dated', 'unknown']);

const markup = renderToStaticMarkup(React.createElement(PlanHub, {
  tasks: input, today: '2026-11-07', now: new Date('2026-11-07T08:00:00'), onNavigatePlanner: () => {}, onOpenTask: () => {}, onToggleTask: () => {}, onCreateTask: () => {}, onSelectRange: () => {}, onOpenGoals: () => {},
}));
assert.ok(markup.indexOf('>early</span>') < markup.indexOf('>late</span>'), 'the Plan screen renders same-day timed tasks chronologically');
assert.match(markup, /Today · 09:00/);
assert.match(markup, />Next up</, 'the task list has a clear task-first heading');
assert.match(markup, /6 open · 5 due today/, 'the summary counts only open tasks and explains what is due');
assert.equal((markup.match(/class="plan-hub-task ui-interactive-row(?: is-overdue)?"/g) || []).length, 5, 'the Plan screen keeps a concise five-task action list');
assert.match(markup, /aria-label="Mark early complete"/, 'each task has a directly accessible completion control');
assert.match(markup, /role="group" aria-label="Open tasks by date"/, 'date shortcuts are identified as planner navigation, not filters on the preview list');
assert.match(markup, /Next 7 days/);
assert.match(markup, /Working toward a longer-term goal\?/);
assert.match(markup, /See all tasks/, 'the planner entry point uses plain task language');
assert.doesNotMatch(markup, /Open planner/);
assert.doesNotMatch(markup, /Goals<\/h3>/, 'goal management stays in Life instead of being duplicated under Plan');
assert.doesNotMatch(markup, /truncate/, 'long task and goal titles are not clipped by the Plan summary');
const dateOnlyMarkup = renderToStaticMarkup(React.createElement(PlanHub, {
  tasks: [task('date-only-display', '2026-11-07', undefined)], today: '2026-11-07', now: new Date('2026-11-07T08:00:00'), onNavigatePlanner: () => {}, onOpenTask: () => {}, onToggleTask: () => {}, onCreateTask: () => {}, onSelectRange: () => {}, onOpenGoals: () => {},
}));
assert.match(dateOnlyMarkup, /Today · end of day/);
const overdueMarkup = renderToStaticMarkup(React.createElement(PlanHub, {
  tasks: [task('past-time', '2026-11-07', '07:00')], today: '2026-11-07', now: new Date('2026-11-07T08:00:00'), onNavigatePlanner: () => {}, onOpenTask: () => {}, onToggleTask: () => {}, onCreateTask: () => {}, onSelectRange: () => {}, onOpenGoals: () => {},
}));
assert.match(overdueMarkup, /1 open · 1 overdue/, 'a task past its due time is not double-counted as upcoming today');
assert.doesNotMatch(overdueMarkup, /due today/);
const completedMarkup = renderToStaticMarkup(React.createElement(PlanHub, {
  tasks: [task('done', '2026-11-07', undefined, undefined, true)], today: '2026-11-07', now: new Date('2026-11-07T08:00:00'), onNavigatePlanner: () => {}, onOpenTask: () => {}, onToggleTask: () => {}, onCreateTask: () => {}, onSelectRange: () => {}, onOpenGoals: () => {},
}));
assert.match(completedMarkup, /You’re all caught up/);
assert.doesNotMatch(completedMarkup, /No tasks yet/);
console.log('PLAN HUB UI 2.0: task-first hierarchy, truthful due counts, date routing, completion and empty states passed.');
