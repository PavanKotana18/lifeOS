'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/components/FirstRecordSecurityDialog.tsx', 'utf8');
require.extensions['.tsx'] = (loadedModule, filename) => loadedModule._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Dialog = require('./src/components/FirstRecordSecurityDialog.tsx').default;
const html = renderToStaticMarkup(React.createElement(Dialog, { onDecision() {} }));
assert.match(html, /Before your first record/);
assert.match(html, /Protect this device and save/);
assert.doesNotMatch(html, /Set up recovery now/);
assert.match(html, /Cancel saving · keep draft/);
assert.match(html, /Android will ask you to authenticate once/);
assert.match(html, /losing this device key may make your records unrecoverable/i);
assert.match(source, /onDecision\('later'\)[\s\S]*?Protect this device and save/, 'the primary action states that device encryption continues while recovery is optional');
console.log('FIRST RECORD SECURITY: contextual choices explain native authentication, recovery risk and cancellation.');
