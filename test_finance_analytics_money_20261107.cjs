'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { buildFinanceAnalytics } = require('./src/services/financeAnalytics.ts');
const { createMoneyRecordAmount } = require('./src/services/financeCore.ts');

assert.deepEqual(createMoneyRecordAmount('12.34', 'INR'), { amount: 12.34, amountMinor: '1234', currencyCode: 'INR' });
assert.deepEqual(createMoneyRecordAmount('123.5', 'JPY'), { amount: 124, amountMinor: '124', currencyCode: 'JPY' });
assert.deepEqual(createMoneyRecordAmount('1.2345', 'KWD'), { amount: 1.235, amountMinor: '1235', currencyCode: 'KWD' });
assert.throws(() => createMoneyRecordAmount('9007199254740992.01', 'USD'), /too large/i,
  'major-unit compatibility value cannot silently lose precision beyond JavaScript safe range');

const fractional = buildFinanceAnalytics(
  [{ date: '2026-11-07', amount: 1.005, type: 'expense', category: 'Food' }],
  [{ monthYear: '2026-11', categoryId: 'food', monthlyAmount: 1.005 }],
  '2026-11', 2, [{ id: 'food', name: 'Food' }], 'USD'
);
assert.equal(fractional.totalExpenses, 1.01, 'finance analytics must use the same decimal-safe half-away rounding as the Finance formatter');
assert.equal(fractional.budgetRows[0].spent, 1.01);
assert.equal(fractional.budgetRows[0].allocated, 1.01);
assert.equal(fractional.budgetRows[0].remaining, 0);

const zeroDecimal = buildFinanceAnalytics(
  [{ date: '2026-11-07', amount: 123.5, type: 'expense' }],
  [{ monthYear: '2026-11', monthlyAmount: 125 }],
  '2026-11', 2, [], 'JPY'
);
assert.equal(zeroDecimal.totalExpenses, 124, 'zero-decimal currencies round transaction totals to whole units');
assert.equal(zeroDecimal.budgetRows[0].remaining, 1, 'budget remainder uses the selected currency minor unit');

const threeDecimal = buildFinanceAnalytics(
  [{ date: '2026-11-07', amount: 1.2345, type: 'expense' }],
  [], '2026-11', 2, [], 'KWD'
);
assert.equal(threeDecimal.totalExpenses, 1.235, 'three-decimal currencies retain their minor-unit precision');

const mixed = buildFinanceAnalytics([
  { date: '2026-11-02', amount: 10, type: 'expense', category: 'Food' }, // pre-currency legacy row
  { date: '2026-11-03', amount: 0.1, amountMinor: '11', currencyCode: 'USD', type: 'expense', category: 'Food' },
  { date: '2026-11-04', amount: 25, amountMinor: '2500', currencyCode: 'INR', type: 'expense', category: 'Travel' },
], [
  { monthYear: '2026-11', monthlyAmount: 50 },
  { monthYear: '2026-11', monthlyAmount: 20, amountMinor: '2000', currencyCode: 'USD' },
], '2026-11', 2, [], 'INR');
assert.equal(mixed.totalExpenses, 35, 'analytics sum legacy reporting-context rows and matching explicit currency only');
assert.equal(mixed.excludedCurrencyCount, 2, 'analytics reports incompatible transaction and budget currencies instead of adding them');
assert.equal(mixed.categories.find(row => row.name === 'Travel').amount, 25, 'exact per-record minor units drive category totals');
console.log('FINANCE ANALYTICS MONEY: 13 currency-precision, explicit-identity, and mixed-currency assertions passed.');
