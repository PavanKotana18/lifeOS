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
const { taskScheduleError } = require('./src/services/domainUtils.ts');
const QuickTaskEntry = require('./src/components/QuickTaskEntry.tsx').default;
const source = ts.createSourceFile('QuickTaskEntry.tsx', fs.readFileSync('src/components/QuickTaskEntry.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'submitQuickTask') initializer = node.initializer.getText(source);
  ts.forEachChild(node, find);
}
find(source);
assert.ok(initializer, 'Exercise the production quick-task handler');
const code = ts.transpileModule(`const handler = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const bind = values => new Function(...Object.keys(values), `${code}; return handler;`)(...Object.values(values));
let writesDuringRender = 0;
const markup = renderToStaticMarkup(React.createElement(QuickTaskEntry, { onAdd: async () => { writesDuringRender++; } }));
assert.equal(writesDuringRender, 0, 'Rendering never saves a task');
assert.match(markup, /aria-label="Quick task creation"/);
assert.match(markup, /aria-busy="false"/);
assert.match(markup, /<label for="[^"]+"/);
assert.match(markup, /aria-describedby="[^"]+-hint"/);
assert.match(markup, /maxLength="200"/);
assert.match(markup, /disabled=""[^>]*>Add task/);
assert.match(markup, /Choose a due date/);
assert.match(markup, /aria-label="About Task reminders"/);
assert.match(markup, /Schedule, priority and reminder/);
assert.match(markup, /type="date"/);
assert.match(markup, /Priority/);
const event = { preventDefault() {} };
const futureDate = '2099-12-31';
function harness(title, onAdd, dueDate = futureDate) {
  const operation = { current: false }, titles = [], busy = [], errors = [];
  const details = { dueDate, dueTime: '', reminderAt: '', priority: 'Medium' };
  const handler = bind({ taskScheduleError, title, operation, onAdd, dueDate: details.dueDate, dueTime: details.dueTime, reminderAt: details.reminderAt, priority: details.priority,
    setDueDate: value => { details.dueDate = value; }, setDueTime: value => { details.dueTime = value; }, setReminderAt: value => { details.reminderAt = value; }, setPriority: value => { details.priority = value; },
    setTitle: value => titles.push(value), setSaving: value => busy.push(value), setError: value => errors.push(value) });
  return { handler, operation, titles, busy, errors, details };
}
(async () => {
  let calls = 0;
  for (const title of ['   ', 'x'.repeat(201)]) {
    const fixture = harness(title, async () => { calls++; });
    await fixture.handler(event);
    assert.equal(calls, 0); assert.deepEqual(fixture.titles, []); assert.equal(fixture.operation.current, false);
    assert.ok(fixture.errors[0]); assert.deepEqual(fixture.busy, []);
  }
  const missingDate = harness('No date', async () => { calls++; }, '');
  await missingDate.handler(event);
  assert.equal(calls, 0);
  assert.match(missingDate.errors.at(-1), /due date/);
  const posted = [];
  const success = harness('  Synthetic scheduled task  ', async (...args) => posted.push(args));
  await success.handler(event);
  assert.deepEqual(posted, [['Synthetic scheduled task', { dueDate: futureDate, dueTime: undefined, reminderAt: undefined, priority: 'Medium' }]]); assert.deepEqual(success.titles, ['']);
  assert.deepEqual(success.busy, [true, false]); assert.equal(success.operation.current, false);

  let attempts = 0;
  const retry = harness('Synthetic retained draft', async () => { if (++attempts === 1) throw new Error('Protected storage is locked.'); });
  await retry.handler(event);
  assert.deepEqual(retry.titles, [], 'A rejected private save preserves the title');
  assert.match(retry.errors.at(-1), /locked/); assert.equal(retry.operation.current, false);
  assert.deepEqual(retry.busy, [true, false]);
  await retry.handler(event);
  assert.equal(attempts, 2); assert.deepEqual(retry.titles, [''], 'A later successful retry clears the retained draft');
  const emptyError = harness('Synthetic draft', async () => { throw new Error(''); });
  await emptyError.handler(event);
  assert.match(emptyError.errors.at(-1), /draft is still here/);
  assert.deepEqual(emptyError.titles, []);

  let finish, pendingWrites = 0;
  const pending = new Promise(resolve => { finish = resolve; });
  const concurrent = harness('Synthetic concurrent task', async () => { pendingWrites++; await pending; });
  const first = concurrent.handler(event);
  const second = concurrent.handler(event);
  await second;
  assert.equal(pendingWrites, 1); assert.equal(concurrent.operation.current, true);
  assert.deepEqual(concurrent.titles, [], 'Draft remains until the actual write resolves');
  finish(); await first;
  assert.equal(pendingWrites, 1); assert.deepEqual(concurrent.titles, ['']); assert.equal(concurrent.operation.current, false);
  console.log('QUICK TASK ENTRY: required date rendering, validation, guarded double submit, failure preservation and successful retry passed; no mounted/native rendering claimed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
