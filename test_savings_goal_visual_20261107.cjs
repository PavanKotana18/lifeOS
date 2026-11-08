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
const Progress = require('./src/components/SavingsGoalProgress.tsx').default;
const noop = () => {};
const render = (currentAmount, targetAmount) => renderToStaticMarkup(React.createElement(Progress, {
  goal: { id: 'synthetic', title: 'Emergency fund', category: 'Safety', targetAmount, currentAmount, targetDate: '2027-01-01', createdAt: '2026-11-01T00:00:00.000Z' },
  formatMoney: value => `$${value.toFixed(2)}`, formatDate: value => value, onContribute: noop, onDelete: noop,
}));

const empty = render(0, 1000);
assert.match(empty, /0% of \$1000\.00 saved/);
assert.match(empty, /\$0\.00 saved · \$1000\.00 to go/);
const quarter = render(250, 1000);
assert.match(quarter, /aria-valuenow="25"/);
assert.match(quarter, /stroke-dasharray="61\.26 245\.04"/);
const reached = render(1250, 1000);
assert.match(reached, /Target reached · \$1250\.00 saved/);
assert.match(reached, />125%<\/span>/, 'displayed total can exceed target while visual gauge remains capped');
assert.match(reached, /aria-valuenow="100" aria-valuetext="125% of \$1000\.00 saved"/);
const invalid = render(10, 0);
assert.match(invalid, /Savings progress unavailable/);
assert.match(invalid, /Target · Unavailable/);
assert.doesNotMatch(invalid, /NaN/);
const invalidSaved = render(-4, 1000);
assert.match(invalidSaved, /Review the saved target and amount/);
assert.doesNotMatch(invalidSaved, /\$0\.00 saved/);
const component = fs.readFileSync('src/components/SavingsGoalProgress.tsx', 'utf8');
const styles = fs.readFileSync('src/index.css', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.match(component, /aria-live="polite"/);
assert.match(component, /onDelete/);
assert.match(styles, /\.savings-goal-actions button \{[^}]*min-height: 44px/s);
assert.match(styles, /\.savings-goal-fill \{[^}]*var\(--accent\)/s);
assert.match(app, /window\.confirm\(`Delete savings goal[\s\S]*?and its contributions/);
assert.match(app, /LifeOS could not confirm the deletion\. Refresh Savings before retrying\./);
assert.match(app, /Goal deleted\. Reopen Savings to refresh the latest data\./, 'post-delete refresh failure is distinct from delete failure');
console.log('SAVINGS GOAL VISUAL: 19 rendered-state, data-state, deletion and accessibility contracts passed with synthetic amounts.');
