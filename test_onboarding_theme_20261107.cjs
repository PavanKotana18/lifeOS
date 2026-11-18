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
require('./scripts/register-ts-test-loader.cjs');
const Onboarding = require('./src/components/Onboarding.tsx').default;
const html = renderToStaticMarkup(React.createElement(Onboarding, {
  initialName: 'Synthetic User', onSaveIdentity: async () => {}, onFinish: async () => {},
}));
assert.match(html, /Welcome\. What should we call you\?/);
assert.match(html, /Open LifeOS/);
assert.match(html, /Synthetic User/);
assert.match(html, /LifeOS/);
assert.doesNotMatch(html, /Enable selected notifications|Follow system theme|role="progressbar"/i);
assert.match(html, /name="?[^\"]*|placeholder="Name"/);
assert.match(html, /Welcome/);
assert.match(html, /explore LifeOS before setting up reminders or device protection/);
assert.doesNotMatch(html, /recovery kit|biometric setup|secure unlock/i);
assert.doesNotMatch(html, /Step [123] of 3|Create and save recovery kit|Continue with secure unlock/);
console.log('ONBOARDING: themed welcome/name screen renders directly, with security and recovery deferred to their contexts.');
