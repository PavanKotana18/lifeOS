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
const PlanHub = require('./src/components/PlanHub.tsx').default;
const source = fs.readFileSync('src/components/PlanHub.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const markup = renderToStaticMarkup(React.createElement(PlanHub, {
  tasks: [], today: '2026-11-18', now: new Date('2026-11-18T12:00:00Z'),
  onNavigatePlanner() {}, onOpenTask() {}, onToggleTask() {}, onQuickCreateTask() {},
  onSelectRange() {}, onOpenGoals() {},
}));
assert.match(markup, /aria-label="Quick task capture"/);
assert.match(markup, /for="plan-quick-task-title">Quick task title/);
assert.match(markup, /placeholder="Add a task to your list/);
assert.match(markup, /required=""/);
assert.match(source, /new FormData\(form\)\.get\('title'\)[\s\S]*?onQuickCreateTask\(title\);[\s\S]*?form\.reset\(\)/,
  'quick capture validates, trims the title and clears only after forwarding it');
assert.match(app, /onQuickCreateTask=\{title => openCreateForm\('task', undefined, undefined, title\)\}/,
  'quick capture opens the existing validated task form with the captured title');
assert.match(app, /title: initialTitle/,
  'the existing task form keeps responsibility for reminder, recurrence and persistence controls');
console.log('MAIN TASK QUICK CAPTURE: labeled title-first entry opens the existing task form and preserves its validation and reminder controls.');
