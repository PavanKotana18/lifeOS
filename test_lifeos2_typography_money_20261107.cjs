'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  loadedModule._compile(output, filename);
};
const { formatCurrency } = require('./src/services/userPreferences.ts');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const MoneyHome = require('./src/components/MoneyHome.tsx').default;

const font = fs.statSync('src/assets/fonts/InterVariable.woff2');
const license = fs.readFileSync('src/assets/fonts/OFL.txt', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const tailwind = fs.readFileSync('tailwind.config.cjs', 'utf8');
const viewport = fs.readFileSync('index.html', 'utf8');
const moneyHome = fs.readFileSync('src/components/MoneyHome.tsx', 'utf8');
const moneyAccounts = fs.readFileSync('src/components/MoneyAccounts.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.ok(font.size > 300_000, 'locally bundled variable Inter font is present');
assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
assert.match(css, /font-weight:\s*100 900/);
assert.match(css, /font-display:\s*swap/);
for (const token of ['--font-sans', '--type-display-amount', '--type-page-title', '--type-section-title', '--type-body', '--type-label', '--type-caption', '--type-button']) assert.ok(css.includes(token), `typography token ${token} exists`);
for (const script of ['Noto Sans Telugu', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'Noto Sans Kannada', 'Noto Sans Malayalam']) assert.ok(css.includes(script) && tailwind.includes(script), `${script} is in app and utility font fallback stacks`);
assert.match(css, /font-variant-numeric:\s*tabular-nums/);
assert.match(css, /\.money-action small \{ font-size: 0\.75rem; \}/, 'compact Money actions retain readable helper text');
const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
assert.match(manifest, /android:windowSoftInputMode="adjustResize"/, 'Android resizes the WebView viewport when the keyboard opens');
assert.match(manifest, /uiMode\|fontScale/, 'Android delivers appearance and font-scale changes to the Activity');
const mainActivity = fs.readFileSync('android/app/src/main/java/com/lifeos/personal/MainActivity.java', 'utf8');
assert.match(mainActivity, /getConfiguration\(\)\.fontScale/);
assert.match(mainActivity, /getSettings\(\)\.setTextZoom\(webTextZoomForFontScale\(fontScale\)\)/);
assert.match(fs.readFileSync('android/app/src/androidTest/java/com/lifeos/personal/SystemFontScaleAcceptanceTest.java', 'utf8'), /launchedWebViewUsesCurrentAndroidFontScale/);
assert.doesNotMatch(viewport, /user-scalable\s*=\s*no|max(?:imum)?-scale\s*=\s*1(?:\.0)?/i, 'viewport does not disable user zoom or system scaling');
for (const [code, locale, symbol] of [['INR', 'en-IN', '₹'], ['USD', 'en-US', '$'], ['EUR', 'de-DE', '€'], ['GBP', 'en-GB', '£'], ['JPY', 'en-US', '¥']]) assert.ok(formatCurrency(1234567.89, code, locale).includes(symbol), `${code} currency symbol is rendered`);
assert.ok(formatCurrency(1234567.89, 'INR', 'en-IN').includes('12,34,567.89'), 'Indian currency grouping and paise precision are retained');
assert.ok(!formatCurrency(1234567.89, 'JPY', 'en-US').includes('.'), 'zero-minor-unit currency omits decimals');
assert.match(moneyHome, /Income minus expenses/);
assert.match(moneyHome, /formatMoney\(netCashFlow\)/);
assert.match(app, /aria-label="Open profile and settings"/);
assert.match(app, /primaryDestinationForTab\(activeTab\)/);
assert.doesNotMatch(app, /overflow-x-auto[^\n]*financeSubtab|PRIMARY_NAVIGATION[\s\S]{0,500}explore/);
const markup = renderToStaticMarkup(React.createElement(MoneyHome, {
  month: '2026-11', income: 25000, expenses: 7800, netCashFlow: 17200,
  budgetRows: [{ category: 'Overall', allocated: 30000, spent: 7800, remaining: 22200 }],
  largestCategory: { name: 'Food', amount: 3500 }, expenseChange: 5, hasPreviousMonthRecords: true,
  transactions: [{ id: 'synthetic-1', type: 'expense', amount: 1250, date: '2026-11-07', occurredAt: '2026-11-07T08:30:00.000Z', category: 'Food', description: 'Lunch' }],
  formatMoney: amount => formatCurrency(amount, 'INR', 'en-IN'), formatDate: date => date, formatTime: date => date.toISOString().slice(11, 16),
  accountSummaries: [], savingsGoals: [], legacyCurrency: 'INR', onAccounts() {},
  onMonthChange() {}, onAddExpense() {}, onAddIncome() {}, onTransfer() {}, onMoveToSavings() {}, onTransactions() {}, onBudgets() {}, onSavings() {}, onAnalytics() {}, onPlanning() {}, onEditTransaction() {},
}));
assert.match(markup, /Income minus expenses/);
assert.match(markup, /₹17,200/);
assert.match(markup, /Lunch/);
assert.match(markup, /2026-11-07/);
assert.match(markup, /Add to savings/);
assert.match(markup, /Move between accounts/);
assert.match(markup, /<details class="money-tools">/);
const primaryActions = markup.match(/<section aria-label="Quick money actions"[\s\S]*?<\/section>/)?.[0] || '';
assert.ok(primaryActions.indexOf('Add expense') < primaryActions.indexOf('Add income') && primaryActions.indexOf('Add income') < primaryActions.indexOf('Transfer'), 'expense, income, and transfer remain equally visible primary actions');
assert.match(app, /onTransfer=\{\(\) => \{ setOpenMoneyTransferOnAccounts\(true\); navigateFinanceSubtab\('accounts'\); \}\}/, 'Money transfer quick action opens Accounts and requests the transfer form');
assert.match(app, /autoOpenTransfer=\{openMoneyTransferOnAccounts\}/);
assert.match(moneyAccounts, /if \(active\.length >= 2\) beginTransfer\(\)/, 'transfer form opens directly when two accounts are available');
assert.match(moneyAccounts, /Add at least two active accounts before making a transfer/);
assert.match(markup, /Overall plan/);
assert.match(markup, /22,200\.00 left/);
assert.match(markup, /largest recorded expense category is <strong>Food<\/strong>/);
assert.match(markup, /up 5\.0% from the previous month/);
console.log('LIFEOS 2 TYPOGRAPHY + MONEY: bundled Inter/OFL, five script fallbacks, zoom support, token scale, currency formatting and Money navigation checks passed.');
