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

const { presentReminderStatus } = require('./src/services/reminderStatusPresentation.ts');
assert.deepEqual(presentReminderStatus({ visibleInNotificationShade: true }), {
  title: 'Reminder delivered', message: 'Android currently shows this reminder in your notifications.', tone: 'positive',
});
assert.equal(presentReminderStatus({ schedulingState: 'scheduled-for-future', androidPermission: 'granted', categoryEnabled: true }).title, 'Reminder scheduled');
assert.match(presentReminderStatus({ schedulingState: 'scheduled-for-future', androidPermission: 'granted', categoryEnabled: true, deliveryTiming: 'inexact-idle' }).message, /may delay it/);
assert.equal(presentReminderStatus({ cancellationReason: 'task-completed' }).title, 'No reminder needed');
assert.equal(presentReminderStatus({ cancellationReason: 'reminder-not-configured' }).title, 'No reminder set');
assert.match(presentReminderStatus({ androidPermission: 'denied' }).message, /Android settings/);

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ReminderStatusSummary = require('./src/components/ReminderStatusSummary.tsx').default;
const report = { visibleInNotificationShade: false, schedulingState: 'scheduled-for-future', androidPermission: 'granted', categoryEnabled: true, taskReference: 'synthetic-private-task-id', pendingNotificationId: 99127 };
const markup = renderToStaticMarkup(React.createElement(ReminderStatusSummary, { report }));
assert.match(markup, /Reminder scheduled/);
assert.match(markup, /asked Android to show this reminder/);
assert.doesNotMatch(markup, /synthetic-private-task-id|99127|pendingNotificationId|taskReference/,
  'user-facing reminder help omits internal task and notification identifiers');

const app = fs.readFileSync('./src/App.tsx', 'utf8');
const detailStart = app.indexOf('aria-label="Task details"');
const detailEnd = app.indexOf('</article>}', detailStart);
assert.ok(detailStart >= 0 && detailEnd > detailStart, 'task details are present');
const taskDetails = app.slice(detailStart, detailEnd);
for (const field of ['Task details', 'plannerDetailTask.title', 'Due', 'Status', 'Priority', 'Reminder', 'Edit task', 'Complete task']) {
  assert.ok(taskDetails.includes(field), `task details contain the human-facing ${field} field/action`);
}
assert.doesNotMatch(taskDetails, /<dl|pendingNotificationId|JSON\.stringify/,
  'task details do not render a developer diagnostic record');
assert.match(app, /check reminder status/, 'save feedback uses the same plain-language action as task details');
assert.match(markup, /aria-live="polite" aria-label="Reminder status"/);

console.log('UX3 INTERACTIONS: reminder states, private identifier redaction, task details, and save feedback passed.');
