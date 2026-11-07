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
  tasks: input, goals: [], today: '2026-11-07', onNavigate: () => {}, onCreateTask: () => {},
}));
assert.ok(markup.indexOf('>early</span>') < markup.indexOf('>late</span>'), 'the Plan screen renders same-day timed tasks chronologically');
assert.match(markup, /2026-11-07 · Today · 09:00/);
assert.equal((markup.match(/<li /g) || []).length, 4, 'the Plan screen keeps its four-task summary limit');
const dateOnlyMarkup = renderToStaticMarkup(React.createElement(PlanHub, {
  tasks: [task('date-only-display', '2026-11-07', undefined)], goals: [], today: '2026-11-07', onNavigate: () => {}, onCreateTask: () => {},
}));
assert.match(dateOnlyMarkup, /2026-11-07 · Today · end of day/);
console.log('PLAN HUB SCHEDULE: 7 deterministic sorting and production-render checks passed.');
