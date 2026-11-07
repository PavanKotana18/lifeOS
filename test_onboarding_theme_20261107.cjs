'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Onboarding = require('./src/components/Onboarding.tsx').default;
const preferences = { taskReminders: true, upcomingDeadlines: true, overdueAlerts: true, habitReminders: true, milestoneReminders: true };
const noop = async () => {};

for (let step = 0; step < 5; step += 1) {
  const markup = renderToStaticMarkup(React.createElement(Onboarding, {
    initialName: 'Synthetic User', preferences, appearance: 'system', initialStep: step,
    onStepChange: noop, onSaveIdentity: noop, onEnableBiometric: async () => ({ success: true }),
    onSkipBiometric: () => {}, onAppearance: noop, onEnableNotifications: async () => ({ granted: true, status: 'granted' }),
    onSkipNotifications: noop, onOpenNotificationSettings: noop, onFinish: noop,
  }));
  assert.match(markup, /role="dialog" aria-modal="true" aria-label="LifeOS onboarding"/);
  assert.match(markup, new RegExp(`aria-valuenow="${step + 1}"`));
  assert.ok(!/\b(?:text|bg|border)-(?:slate|indigo|emerald|amber|sky)-\d{2,3}\b/.test(markup), `step ${step + 1} uses semantic theme colors`);
  if (step === 0) assert.match(markup, /class="lifeos-input[^\"]*min-h-12/);
  if (step === 1) assert.match(markup, /Enable Biometric/);
  if (step === 2) assert.match(markup, /Follow system theme/);
  if (step === 3) { assert.match(markup, /aria-label="Task reminders"/); assert.match(markup, /Enable selected notifications/); }
  if (step === 4) assert.ok(/You(?:'|&#x27;)re all set, Synthetic User!/.test(markup), 'completion state greets the synthetic profile name');
}
console.log('ONBOARDING THEME: 21 production-render checks passed across all five steps with synthetic preferences.');
