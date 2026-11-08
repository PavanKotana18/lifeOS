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
assert.equal((markup.match(/class="plan-hub-task(?: is-overdue)?"/g) || []).length, 5, 'the Plan screen keeps a concise five-task action list');
assert.match(markup, /aria-label="Mark early complete"/, 'each task has a directly accessible completion control');
assert.match(markup, /Choose task dates/);
assert.match(markup, /Next 7 days/);
assert.match(markup, /Working toward a longer-term goal\?/);
assert.doesNotMatch(markup, /Goals<\/h3>/, 'goal management stays in Life instead of being duplicated under Plan');
assert.doesNotMatch(markup, /truncate/, 'long task and goal titles are not clipped by the Plan summary');
const dateOnlyMarkup = renderToStaticMarkup(React.createElement(PlanHub, {
  tasks: [task('date-only-display', '2026-11-07', undefined)], today: '2026-11-07', now: new Date('2026-11-07T08:00:00'), onNavigatePlanner: () => {}, onOpenTask: () => {}, onToggleTask: () => {}, onCreateTask: () => {}, onSelectRange: () => {}, onOpenGoals: () => {},
}));
assert.match(dateOnlyMarkup, /Today · end of day/);
console.log('PLAN HUB UI 2.0: chronological sorting, task completion, date navigation, goal placement, and accessible row rendering passed.');
