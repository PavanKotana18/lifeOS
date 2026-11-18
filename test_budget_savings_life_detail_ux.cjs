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
const SavingsGoalProgress = require('./src/components/SavingsGoalProgress.tsx').default;
const app = fs.readFileSync('src/App.tsx', 'utf8');

const html = renderToStaticMarkup(React.createElement(SavingsGoalProgress, {
  goal: { id: 'g1', title: 'Emergency fund', currencyCode: 'USD', targetAmount: 1, currentAmount: 0.1,
    targetAmountMinor: '100', currentAmountMinor: '10', targetDate: '2026-12-31', createdAt: '2026-01-01' },
  contributions: [{ id: 'c1', goalId: 'g1', amount: 0.1, amountMinor: '10', currencyCode: 'USD', date: '2026-11-18', createdAt: '2026-11-18' }],
  formatMoney: amount => `fallback ${amount}`, formatDate: value => value,
  onContribute() {}, onEditGoal() {}, onDelete() {}, onEditContribution() {}, onDeleteContribution() {},
}));
assert.match(html, /10%/);
assert.match(html, /\$0\.10 saved · \$0\.90 to go/);
assert.match(html, /Target · \$1\.00/);
assert.match(html, /aria-valuenow="10"/);
assert.doesNotMatch(html, /fallback/);
assert.match(html, /View 1 contribution/);
const fractionalHtml = renderToStaticMarkup(React.createElement(SavingsGoalProgress, {
  goal: { id: 'g2', title: 'Travel fund', currencyCode: 'INR', targetAmount: 400000, currentAmount: 30000,
    targetAmountMinor: '40000000', currentAmountMinor: '3000000', targetDate: '2027-12-31', createdAt: '2026-01-01' },
  formatMoney: amount => String(amount), formatDate: value => value,
  onContribute() {}, onEditGoal() {}, onDelete() {}, onEditContribution() {}, onDeleteContribution() {},
}));
assert.match(fractionalHtml, />7\.5%<\/span>/, 'savings progress retains a useful fractional percent');
assert.match(fractionalHtml, /aria-label="7\.5% of ₹4,00,000\.00 saved"/);
assert.match(app, /disabled=\{Boolean\(editingBudgetId\)\} value=\{createDraft\.categoryId/,
  'editing a budget cannot change its identity and create a second plan');
assert.match(app, /Editing keeps this plan’s category, month and currency/);
assert.match(app, /disabled=\{Boolean\(editingBudgetId\)\} required type="month"/);
assert.match(app, /aria-labelledby="habit-detail-title"/);
assert.match(app, /handleHabitCompletion\(habit\.id, habit\.name, habitsSelectedDate, stats\.completedToday\)/,
  'habit detail exposes actual completion action');
assert.match(app, /aria-labelledby="goal-detail-title"/);
assert.match(app, /StorageService\.goals\.toggleMilestone\(row\.id, !row\.completed\)/,
  'goal detail reads and updates persisted milestone records');
assert.match(app, /Net cash flow/);
assert.match(app, /formatMonthYear\(financeMonth\)/, 'analytics metrics name their selected reporting month');
const chart = fs.readFileSync('src/components/FinanceCharts.tsx', 'utf8');
assert.doesNotMatch(chart, /Posted monthly totals/);
assert.match(chart, /<InfoTip label="Posted and planned amounts">[^<]*Planned estimates stay separate/);
console.log('BUDGET/SAVINGS/LIFE DETAIL UX: exact minor-unit display and focused editor/detail contracts passed.');
