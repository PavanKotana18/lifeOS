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
assert.match(html, /What should we call you\?/);
assert.match(html, /Continue/);
assert.match(html, /Synthetic User/);
assert.match(html, /BusyDoo/);
assert.doesNotMatch(html, /recovery kit|biometric setup|Enable notifications/i);
console.log('ONBOARDING: welcome renders only the name field and Continue.');
