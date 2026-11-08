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
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Summary = require('./src/components/FinanceSavingsSummary.tsx').default;
const noop = () => {};
const render = goals => renderToStaticMarkup(React.createElement(Summary, { goals, formatMoney: value => `$${value.toFixed(2)}`, onViewAll: noop, onCreate: noop }));

const empty = render([]);
assert.match(empty, /Start a goal/);
assert.match(empty, /Create savings goal/);
assert.doesNotMatch(empty, /role="progressbar"/, 'empty state does not invent a savings result');
const goal = { id: 'goal-1', title: 'Emergency fund', targetAmount: 1000, currentAmount: 250, targetDate: '2027-01-01', createdAt: '2026-11-01T00:00:00.000Z' };
const populated = render([goal]);
assert.match(populated, /Emergency fund/);
assert.match(populated, /aria-valuenow="25"/);
assert.match(populated, /\$250\.00 of \$1000\.00/);
console.log('FINANCE SAVINGS SUMMARY: 6 rendered-state checks passed with synthetic data.');
