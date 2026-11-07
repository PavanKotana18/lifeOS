'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { buildFinanceAnalytics } = require('./src/services/financeAnalytics.ts');

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
console.log('FINANCE ANALYTICS MONEY: 7 currency-precision and rounding assertions passed.');
