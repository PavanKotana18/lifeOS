'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = __dirname;
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const moneyHome = fs.readFileSync(path.join(root, 'src/components/MoneyHome.tsx'), 'utf8');
const charts = fs.readFileSync(path.join(root, 'src/components/FinanceCharts.tsx'), 'utf8');
const accounts = fs.readFileSync(path.join(root, 'src/components/MoneyAccounts.tsx'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'src/components/MoneyPlanning.tsx'), 'utf8');

assert.doesNotMatch(app + accounts + planning, /window\.confirm\s*\(/, 'user confirmations stay in the themed app surface');
assert.match(app, /if \(!createFormDirty\) \{ close\(\); return; \}/, 'clean forms close without asking an unnecessary question');
assert.match(app, /Discard unsaved changes\?/, 'edited forms clearly explain the discard decision');
assert.match(app, /onChange=\{\(\) => setCreateFormDirty\(true\)\}/, 'form changes mark the draft dirty through normal input events');
assert.match(app, /if \(isLocked && confirmation\) settleConfirmation\(false\)/, 'a pending generic confirmation is dismissed when the session locks');

const actionIndex = moneyHome.indexOf('data-testid="money-quick-actions"');
const balanceIndex = moneyHome.indexOf('aria-labelledby="money-cashflow-title"');
assert.ok(actionIndex >= 0 && actionIndex < balanceIndex, 'Expense, Income and Transfer are available before the overview detail');
assert.equal((moneyHome.match(/className="money-action money-action-/g) || []).length, 3, 'Money has three equally presented primary actions');
assert.match(accounts, /record income and spending without an account/, 'account tracking remains optional in the first-use state');
assert.doesNotMatch(moneyHome, /money-account-nudge/, 'the overview does not repeat an account-creation prompt');
assert.match(app, /money-destination-control[^]*<select id="money-destination"/, 'nested Money selection is themeable while retaining native select accessibility');
assert.match(accounts, /confirmAction\(\{ title: 'Reverse this transfer\?'/, 'transfer reversal remains explicitly confirmed');
assert.match(accounts, /closeAccountDraft/, 'account edits have a shared dirty-form close path');
assert.match(planning, /closeCommitment[\s\S]*closeRate/, 'planned commitment and manual-rate drafts protect unsaved edits');

assert.match(charts, /analytics\.periodRows\.some\(row => row\.hasRecords\) \? \(/, 'chart mounts only when the selected range has recorded activity');
assert.match(charts, /finance-chart-empty/, 'empty analytics use a compact explanation');
assert.match(charts, /finance-category-track/, 'expense category share has a readable per-category visual cue');
assert.match(app, /hasFinanceChartData \? <Suspense[\s\S]*No recorded patterns yet/, 'the large chart module is not loaded for an empty financial history');
assert.match(app, /row => row\.hasRecords\) \|\| financeAnalytics\.categories\.length > 0/, 'chart loading depends on actual recorded data');
assert.match(app, /data-testid="today-dashboard"/, 'the focused Today experience remains directly addressable in QA');
const plannerStart = app.indexOf('id="screen-planner"');
const plannerEnd = app.indexOf('id="screen-settings"', plannerStart);
const planner = app.slice(plannerStart, plannerEnd > plannerStart ? plannerEnd : plannerStart + 40000);
assert.match(planner, /Tasks by date/, 'the nested planner leads with tasks rather than its calendar');
assert.match(planner, /Choose task range[\s\S]*\['today', 'tomorrow', 'upcoming'\][\s\S]*Next 7 days/, 'Today, Tomorrow and the next seven days are one tap away');
assert.ok(planner.indexOf('Choose task range') < planner.indexOf('Monthly task calendar'), 'task ranges precede the supporting calendar');
assert.match(planner, /<details className="planner-calendar-disclosure"/, 'the month grid is disclosed on demand');
assert.doesNotMatch(planner, />Quick add</, 'the planner no longer repeats its header Add task action');
assert.match(styles, /\.today-sections \{ display: flex; flex-direction: column; gap: 0\.85rem; \}/, 'Today no longer uses the former oversized section gap');
assert.match(styles, /\.planner-calendar-disclosure > summary/, 'the calendar disclosure has shared theme styling');
assert.match(styles, /\.ui-form-actions \{ position: sticky;/, 'save and cancel actions remain reachable while the sheet scrolls');
assert.match(styles, /\.ui-dialog-backdrop/, 'in-app confirmations have a shared visual layer');
assert.match(styles, /prefers-reduced-motion: reduce/, 'the existing reduced-motion policy remains in place');

const componentPath = path.join(root, 'src/components/ConfirmationDialog.tsx');
const transformed = esbuild.transformSync(fs.readFileSync(componentPath, 'utf8'), { loader: 'tsx', format: 'cjs', jsx: 'automatic', target: 'es2020' }).code;
const componentModule = new Module(componentPath, module);
componentModule.filename = componentPath;
componentModule.paths = Module._nodeModulePaths(path.dirname(componentPath));
componentModule._compile(transformed, componentPath);
const ConfirmationDialog = componentModule.exports.default;
const rendered = renderToStaticMarkup(React.createElement(ConfirmationDialog, {
  title: 'Discard unsaved changes?', message: 'Your edits have not been saved.',
  confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true,
  onConfirm() {}, onCancel() {},
}));
assert.match(rendered, /role="alertdialog" aria-modal="true"/, 'confirmation is announced as a modal alert dialog');
assert.match(rendered, /Keep editing[\s\S]*Discard changes/, 'both safe choices are visible and named');

console.log('UI 2.0 product refinement: confirmation, first-use Money, task-first planner, analytics empty state, Today hierarchy, and keyboard-safe form contracts passed.');
