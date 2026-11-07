'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.tsx'] = (loadedModule, filename) => loadedModule._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Dialog = require('./src/components/FirstRecordSecurityDialog.tsx').default;
const html = renderToStaticMarkup(React.createElement(Dialog, { onDecision() {} }));
assert.match(html, /Before your first record/);
assert.match(html, /Protect this device; recovery later/);
assert.match(html, /Set up recovery now/);
assert.match(html, /Not now/);
assert.match(html, /Android will authenticate/);
assert.match(html, /losing the key may make the data unrecoverable/i);
console.log('FIRST RECORD SECURITY: contextual choices explain native authentication, recovery risk and cancellation.');
