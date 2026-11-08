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
const html = renderToStaticMarkup(React.createElement(Onboarding, {
  initialName: 'Synthetic User', onSaveIdentity: async () => {}, onFinish: async () => {},
}));
assert.match(html, /Welcome\. What should we call you\?/);
assert.match(html, /Open LifeOS/);
assert.match(html, /Synthetic User/);
assert.match(html, /LifeOS/);
assert.doesNotMatch(html, /Enable Biometric|Enable selected notifications|Follow system theme|recovery kit|role="progressbar"/i);
assert.match(html, /name="?[^\"]*|placeholder="Name"/);
assert.match(html, /min-h-12/);
console.log('ONBOARDING: fresh install renders a single name-entry step without biometric, recovery or notification setup; LifeOS identity retained.');
