'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const ts = require('typescript');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const MoneyHome = require('./src/components/MoneyHome.tsx').default;
const MoneyAccounts = require('./src/components/MoneyAccounts.tsx').default;
const homeSource = fs.readFileSync('src/components/MoneyHome.tsx', 'utf8');
const accountsSource = fs.readFileSync('src/components/MoneyAccounts.tsx', 'utf8');
const noop = () => {};
const asyncNoop = async () => {};
const formatMoney = amount => `$${Number(amount).toFixed(2)}`;
const homeProps = {
  month: '2026-11', income: 500, expenses: 120, netCashFlow: 380,
  budgetRows: [], largestCategory: null, expenseChange: null, hasPreviousMonthRecords: false,
  transactions: [{ id: 'synthetic-1', type: 'expense', amount: 12, amountMinor: '1200', currencyCode: 'USD', category: 'Food', description: 'Food', date: '2026-11-05', paymentMethod: 'Cash' }],
  formatMoney, formatDate: date => date, formatTime: date => date.toISOString().slice(11, 16),
  onMonthChange: noop, onAddExpense: noop, onAddIncome: noop, onTransfer: noop,
  onMoveToSavings: noop, onTransactions: noop, onBudgets: noop, onSavings: noop,
  onAnalytics: noop, onPlanning: noop, onAccounts: noop,
  accountSummaries: [
    { id: 'a', name: 'Wallet', type: 'cash', currencyCode: 'USD', balanceMinor: '8000' },
    { id: 'b', name: 'Travel', type: 'savings', currencyCode: 'EUR', balanceMinor: '2500' },
    { id: 'c', name: 'Card', type: 'credit-card', currencyCode: 'USD', balanceMinor: '4200' },
    { id: 'd', name: 'Reserve', type: 'bank', currencyCode: 'INR', balanceMinor: '300000' },
  ],
  savingsGoals: [], legacyCurrency: 'USD', onEditTransaction: noop,
};
const home = renderToStaticMarkup(React.createElement(MoneyHome, homeProps));
const actions = home.match(/<section aria-label="Quick money actions"[\s\S]*?<\/section>/)?.[0] || '';
assert.ok(actions.includes('Add expense') && actions.includes('Add income') && actions.includes('Transfer'), 'expense, income and transfer remain equally discoverable');
assert.match(home, /Income minus expenses/);
assert.match(home, /Recorded income minus recorded spending\. Transfers do not change this amount\./);
assert.match(home, /Recorded cash flow: income \$500\.00; expenses \$120\.00/);
assert.match(home, /Showing 3 of 4 accounts\./, 'the summary makes omitted accounts discoverable');
assert.match(home, /Wallet: \$80\.00/, 'account amount is accessible with its account name');
assert.match(home, /Food<\/strong><small>2026-11-05<\/small>/, 'a transaction category is not repeated when it is already the title');
assert.match(home, /aria-label="Edit Food, expense \$12\.00, 2026-11-05"/, 'transaction action and amount have a complete spoken label');
assert.match(home, /Future bills and saved exchange rates/);
assert.match(home, /planned bills<\/span>/);

const emptyHome = renderToStaticMarkup(React.createElement(MoneyHome, {
  ...homeProps, income: 0, expenses: 0, netCashFlow: 0, transactions: [], accountSummaries: [],
}));
assert.match(emptyHome, /No activity for this period yet\. Choose Expense, Income or Transfer above\./);
assert.doesNotMatch(emptyHome, /money-account-nudge/, 'optional accounts do not look required before a first transaction');

const accounts = [
  { id: 'acct-cash', name: 'Everyday cash', type: 'cash', currencyCode: 'USD', openingBalanceMinor: '10000', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'acct-card', name: 'Credit card', type: 'credit-card', currencyCode: 'USD', openingBalanceMinor: '25000', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
];
const accountMarkup = renderToStaticMarkup(React.createElement(MoneyAccounts, {
  accounts, transactions: [], transfers: [], currencyCode: 'USD', confirmAction: async () => false,
  onCreateAccount: asyncNoop, onUpdateAccount: asyncNoop, onDeleteAccount: asyncNoop,
  onCreateTransfer: asyncNoop, onUpdateTransfer: asyncNoop, onReverseTransfer: asyncNoop, onDeleteTransfer: asyncNoop,
}));
assert.match(accountMarkup, /Everyday cash current balance: \$100\.00/);
assert.match(accountMarkup, /Credit card amount owed: \$250\.00/);
assert.match(accountMarkup, /Opening amount plus posted activity, including transfers\. Transfers are not income or spending\./);
assert.doesNotMatch(accountMarkup, /acct-cash|acct-card/, 'internal account identifiers are not shown');
const emptyAccounts = renderToStaticMarkup(React.createElement(MoneyAccounts, {
  accounts: [], transactions: [], transfers: [], currencyCode: 'USD', confirmAction: async () => false,
  onCreateAccount: asyncNoop, onUpdateAccount: asyncNoop, onDeleteAccount: asyncNoop,
  onCreateTransfer: asyncNoop, onUpdateTransfer: asyncNoop, onReverseTransfer: asyncNoop, onDeleteTransfer: asyncNoop,
}));
assert.match(emptyAccounts, /Account tracking is optional[\s\S]*record income and spending without an account/);
assert.equal((emptyAccounts.match(/>Add account<\/button>/g) || []).length, 1, 'account creation has one clear first-use action');
assert.match(emptyAccounts, /aria-describedby="account-transfer-help"[\s\S]*Add two active accounts to move money between them/);

assert.match(accountsSource, /A transfer moves money between accounts\. It does not count as income or spending\./);
assert.match(accountsSource, /Amount sent \([\s\S]*?\)\s*<input[^>]*inputMode="decimal"/);
assert.match(accountsSource, /Exchange rate \(received for 1 sent\)/);
assert.match(accountsSource, /rate of 2 means 10 sent equals 20 received/);
assert.match(accountsSource, /openingBalanceMinor = decimalToMinorUnits\(accountDraft\.opening/);
assert.match(accountsSource, /fromAmountMinor = decimalToMinorUnits\(transferDraft\.fromAmount/);
assert.match(homeSource, /formatMinorUnits\(BigInt\(account\.balanceMinor\), account\.currencyCode\)/);
console.log('DIRECTED MONEY: dashboard hierarchy, account clarity, readable amounts, optional accounts, transfer guidance and unchanged accounting callback paths passed.');
