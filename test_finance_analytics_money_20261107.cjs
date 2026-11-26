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
  [{ date: '2026-11-07', amount: 1.005, currencyCode: 'USD', type: 'expense', category: 'Food' }],
  [{ monthYear: '2026-11', categoryId: 'food', monthlyAmount: 1.005, currencyCode: 'USD' }],
  '2026-11', 2, [{ id: 'food', name: 'Food' }], 'USD'
);
assert.equal(fractional.totalExpenses, 1.01, 'finance analytics must use the same decimal-safe half-away rounding as the Finance formatter');
assert.equal(fractional.budgetRows[0].spent, 1.01);
assert.equal(fractional.budgetRows[0].allocated, 1.01);
assert.equal(fractional.budgetRows[0].remaining, 0);
assert.equal(fractional.totalExpensesMinor, '101', 'posted analytics totals retain exact minor units');
assert.equal(fractional.categories[0].amountMinor, '101', 'category chart values retain exact minor units');
assert.equal(fractional.budgetRows[0].allocatedMinor, '101');
assert.equal(fractional.budgetRows[0].spentMinor, '101');
assert.equal(fractional.budgetRows[0].remainingMinor, '0');

const zeroDecimal = buildFinanceAnalytics(
  [{ date: '2026-11-07', amount: 123.5, currencyCode: 'JPY', type: 'expense' }],
  [{ monthYear: '2026-11', monthlyAmount: 125, currencyCode: 'JPY' }],
  '2026-11', 2, [], 'JPY'
);
assert.equal(zeroDecimal.totalExpenses, 124, 'zero-decimal currencies round transaction totals to whole units');
assert.equal(zeroDecimal.budgetRows[0].remaining, 1, 'budget remainder uses the selected currency minor unit');

const threeDecimal = buildFinanceAnalytics(
  [{ date: '2026-11-07', amount: 1.2345, currencyCode: 'KWD', type: 'expense' }],
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
assert.equal(mixed.totalExpenses, 25, 'analytics total only records with matching saved currency');
assert.equal(mixed.excludedCurrencyCount, 4, 'analytics reports incompatible transaction and budget currencies instead of adding them');
assert.equal(mixed.categories.find(row => row.name === 'Travel').amount, 25, 'exact per-record minor units drive category totals');
assert.equal(mixed.categories.find(row => row.name === 'Travel').amountMinor, '2500');
assert.equal(mixed.currencyCode, 'INR');
assert.equal(mixed.periodRows.at(-1).expensesMinor, '2500');
const exactLarge = buildFinanceAnalytics([
  { date: '2026-11-05', amount: 90071992547409.9, amountMinor: '900719925474099001', currencyCode: 'USD', type: 'expense', category: 'Large' },
], [], '2026-11', 2, [], 'USD');
assert.equal(exactLarge.totalExpensesMinor, '900719925474099001', 'large exact ledger values do not depend on floating point aggregation');
assert.equal(exactLarge.categories[0].amountMinor, '900719925474099001');
const carryBudget = [
  { monthYear: '2026-10', monthlyAmount: 10, amountMinor: '1000', currencyCode: 'USD' },
  { monthYear: '2026-11', monthlyAmount: 20, amountMinor: '2000', currencyCode: 'USD', carryover: true },
];
const prior = { date: '2026-10-10', amount: 2.53, amountMinor: '253', currencyCode: 'USD', type: 'expense' };
assert.equal(buildFinanceAnalytics([prior], carryBudget, '2026-11', 2, [], 'USD').budgetRows[0].allocatedMinor, '2747');
const uncertain = buildFinanceAnalytics([{ ...prior, currencyCode: undefined }], carryBudget, '2026-11', 2, [], 'USD').budgetRows[0];
assert.equal(uncertain.allocatedMinor, '2000');
assert.equal(uncertain.carryoverUnavailable, true);
console.log('FINANCE ANALYTICS MONEY: 13 currency-precision, explicit-identity, and mixed-currency assertions passed.');
