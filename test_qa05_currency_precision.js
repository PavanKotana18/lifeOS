const assert = require('assert');
const { calculateFinanceMetrics } = require('./src_core_logic');

const transactions = [
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `expense-${i}`, date: '2026-11-05', type: 'expense', amount: 0.1, category: 'Food'
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `income-${i}`, date: '2026-11-05', type: 'income', amount: 0.1, category: 'Salary'
  })),
  { id: 'other-month', date: '2026-10-31', type: 'expense', amount: 99.99, category: 'Food' }
];

const result = calculateFinanceMetrics(
  transactions,
  [{ id: 'budget-1', monthYear: '2026-11', monthlyAmount: 2 }],
  '2026-11'
);

assert.strictEqual(result.totalIncome, 1);
assert.strictEqual(result.totalExpenses, 1);
assert.strictEqual(result.remainingBalance, 0);
assert.strictEqual(result.totalBudget, 2);
assert.strictEqual(result.remainingBudget, 1);
assert.strictEqual(result.categoryExpenses.Food, 1);

const mixed = calculateFinanceMetrics([
  { date: '2026-11-01', type: 'income', amount: 100.10, category: 'Salary' },
  { date: '2026-11-02', type: 'expense', amount: 0.10, category: 'Food' },
  { date: '2026-11-03', type: 'expense', amount: 0.20, category: 'Food' },
  { date: '2026-11-04', type: 'expense', amount: 0.30, category: 'Travel' }
], [], '2026-11');

assert.strictEqual(mixed.totalIncome, 100.10);
assert.strictEqual(mixed.totalExpenses, 0.60);
assert.strictEqual(mixed.remainingBalance, 99.50);
assert.strictEqual(mixed.categoryExpenses.Food, 0.30);
assert.strictEqual(mixed.categoryExpenses.Travel, 0.30);

console.log('QA-05 currency precision tests: all passed');
