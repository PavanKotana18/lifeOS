'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const ts = require('typescript');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  loadedModule._compile(output, filename);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const MoneyAccounts = require('./src/components/MoneyAccounts.tsx').default;
const MoneyPlanning = require('./src/components/MoneyPlanning.tsx').default;
const { accountActivitySign, calculateAccountBalances } = require('./src/services/financialAccounting.ts');
const accounts = [
  { id: 'cash', name: 'Wallet', type: 'cash', currencyCode: 'USD', openingBalanceMinor: '10000', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'card', name: 'Card', type: 'credit-card', currencyCode: 'USD', openingBalanceMinor: '0', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
];
const transactions = [
  { id: 'income', type: 'income', amount: 10, amountMinor: '1000', currencyCode: 'USD', accountId: 'cash', category: 'Pay', description: 'Pay', date: '2026-11-01', paymentMethod: 'Other', createdAt: '2026-11-01T00:00:00Z' },
  { id: 'purchase', type: 'expense', amount: 4, amountMinor: '400', currencyCode: 'USD', accountId: 'card', category: 'Food', description: 'Food', date: '2026-11-01', paymentMethod: 'Card', createdAt: '2026-11-01T00:00:00Z' },
];
const transfers = [{ id: 'pay-card', fromAccountId: 'cash', toAccountId: 'card', fromAmountMinor: '200', toAmountMinor: '200', fromCurrencyCode: 'USD', toCurrencyCode: 'USD', date: '2026-11-02', createdAt: '2026-11-02T00:00:00Z' }];
const balances = calculateAccountBalances(accounts, transactions, transfers);
assert.equal(balances.get('cash'), 10800n);
assert.equal(balances.get('card'), 200n, 'a card purchase increases liability and payment reduces it');
assert.equal(accountActivitySign(accounts[1], 'expense'), '+', 'a card purchase increases the amount owed');
assert.equal(accountActivitySign(accounts[1], 'transfer-in'), '−', 'a card payment reduces the amount owed');
const noop = async () => {};
const accountsMarkup = renderToStaticMarkup(React.createElement(MoneyAccounts, { accounts, transactions, transfers, currencyCode: 'USD', onCreateAccount: noop, onUpdateAccount: noop, onDeleteAccount: noop, onCreateTransfer: noop, onUpdateTransfer: noop, onReverseTransfer: noop, onDeleteTransfer: noop }));
assert.match(accountsMarkup, /Accounts/);
assert.match(accountsMarkup, /Current balance/);
assert.match(accountsMarkup, /Opening amounts are not income/);
assert.match(accountsMarkup, /Move between accounts|Transfer/);
const planningMarkup = renderToStaticMarkup(React.createElement(MoneyPlanning, { commitments: [], rates: [], accounts, categories: [], onAddCommitment: noop, onUpdateCommitment: noop, onDeleteCommitment: noop, onAddRate: noop, onUpdateRate: noop, onDeleteRate: noop }));
assert.match(planningMarkup, /Planned commitments/);
assert.match(planningMarkup, /never changes your recorded income or expenses/);
assert.match(planningMarkup, /Manual exchange rates/);
assert.match(planningMarkup, /does not download rates/);
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.match(app, /financeSubtab === 'accounts' && <MoneyAccounts/);
assert.match(app, /financeSubtab === 'planning'.*<MoneyPlanning/s);
assert.match(app, /StorageService\.accounts\.addTransfer/);
assert.match(app, /StorageService\.exchangeRates\.add/);
assert.match(app, /StorageService\.commitments\.add/);
console.log('MONEY 2 WORKFLOWS: 17 calculations, rendered-screen and application-wiring assertions passed.');
