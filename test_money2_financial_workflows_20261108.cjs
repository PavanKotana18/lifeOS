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
const MoneyAccountsModule = require('./src/components/MoneyAccounts.tsx');
const MoneyAccounts = MoneyAccountsModule.default;
const { buildTransferReversalConfirmation } = MoneyAccountsModule;
const MoneyPlanning = require('./src/components/MoneyPlanning.tsx').default;
const { accountActivitySign, calculateAccountBalances } = require('./src/services/financialAccounting.ts');
const accounts = [
  { id: 'account_internal_9f13', name: 'Wallet', type: 'cash', currencyCode: 'USD', openingBalanceMinor: '10000', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'account_internal_4d22', name: 'Card', type: 'credit-card', currencyCode: 'USD', openingBalanceMinor: '0', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
];
const transactions = [
  { id: 'transaction_internal_1a11', type: 'income', amount: 10, amountMinor: '1000', currencyCode: 'USD', accountId: 'account_internal_9f13', category: 'Pay', description: 'Pay', date: '2026-11-01', paymentMethod: 'Other', createdAt: '2026-11-01T00:00:00Z' },
  { id: 'transaction_internal_2b22', type: 'expense', amount: 4, amountMinor: '400', currencyCode: 'USD', accountId: 'account_internal_4d22', category: 'Food', description: 'Food', date: '2026-11-01', paymentMethod: 'Card', createdAt: '2026-11-01T00:00:00Z' },
];
const transfers = [{ id: 'transfer_internal_3c33', fromAccountId: 'account_internal_9f13', toAccountId: 'account_internal_4d22', fromAmountMinor: '200', toAmountMinor: '200', fromCurrencyCode: 'USD', toCurrencyCode: 'USD', date: '2026-11-02', createdAt: '2026-11-02T00:00:00Z' }];
const balances = calculateAccountBalances(accounts, transactions, transfers);
assert.equal(balances.get('account_internal_9f13'), 10800n);
assert.equal(balances.get('account_internal_4d22'), 200n, 'a card purchase increases liability and payment reduces it');
assert.equal(accountActivitySign(accounts[1], 'expense'), '+', 'a card purchase increases the amount owed');
assert.equal(accountActivitySign(accounts[1], 'transfer-in'), '−', 'a card payment reduces the amount owed');
const noop = async () => {};
const accountsMarkup = renderToStaticMarkup(React.createElement(MoneyAccounts, { accounts, transactions, transfers, currencyCode: 'USD', onCreateAccount: noop, onUpdateAccount: noop, onDeleteAccount: noop, onCreateTransfer: noop, onUpdateTransfer: noop, onReverseTransfer: noop, onDeleteTransfer: noop }));
assert.match(accountsMarkup, /Accounts/);
assert.match(accountsMarkup, /Current balance/);
assert.match(accountsMarkup, /Opening amounts are not income/);
assert.match(accountsMarkup, /Move between accounts|Transfer/);
assert.match(accountsMarkup, /Opening amount plus posted activity, including transfers\. Transfers are not income or spending\./, 'account balances explain that transfers affect balances without becoming cash flow');
assert.ok(!accountsMarkup.includes('account_internal_') && !accountsMarkup.includes('transaction_internal_') && !accountsMarkup.includes('transfer_internal_'), 'Rendered account and transfer labels never expose internal IDs');
const emptyAccountsMarkup = renderToStaticMarkup(React.createElement(MoneyAccounts, {
  accounts: [], transactions: [], transfers: [], currencyCode: 'USD', confirmAction: async () => false,
  onCreateAccount: noop, onUpdateAccount: noop, onDeleteAccount: noop, onCreateTransfer: noop,
  onUpdateTransfer: noop, onReverseTransfer: noop, onDeleteTransfer: noop,
}));
assert.match(emptyAccountsMarkup, /Account tracking is optional[\s\S]*record income and spending without an account/, 'first-use copy explains that accounts are optional and what they enable');
assert.equal((emptyAccountsMarkup.match(/>Add account<\/button>/g) || []).length, 1, 'the empty state has one account creation action instead of duplicating the header action');
assert.match(emptyAccountsMarkup, /disabled="" aria-describedby="account-transfer-help"[\s\S]*Add two active accounts to move money between them/, 'a disabled transfer action explains how to enable it');
const reversalCopy = buildTransferReversalConfirmation(transfers[0], 'Wallet', 'Card', 'en-US');
assert.match(reversalCopy, /Reverse the transfer from Wallet to Card dated 2026-11-02/);
assert.match(reversalCopy, /\$2\.00 from Card back to Wallet/);
assert.match(reversalCopy, /original stays in your history.*undo this reversal later.*Income and spending totals will not change/);
assert.ok(!reversalCopy.includes('transfer_internal_3c33'));
const crossCurrencyCopy = buildTransferReversalConfirmation({ fromAmountMinor: '300000', fromCurrencyCode: 'USD', toAmountMinor: '24900000', toCurrencyCode: 'INR', date: '2026-11-03' }, 'Travel fund', 'Rupee account', 'en-IN');
assert.match(crossCurrencyCopy, /₹2,49,000\.00 from Rupee account back to Travel fund; the original \$3,000\.00 value is restored/);
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
console.log('MONEY 2 WORKFLOWS: 27 accounting, rendered-screen, confirmation-copy and application-wiring assertions passed.');
