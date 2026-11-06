'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
require('./scripts/register-ts-test-loader.cjs');
const { buildFinanceAnalytics } = require('./src/services/financeAnalytics.ts');
const { canonicalUnit, convertMeasurement } = require('./src/services/userPreferences.ts');

test('Finance charts and category budgets retain arbitrary imported category names', () => {
  const labels = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'Food'];
  const rows = labels.flatMap(category => [
    { date: '2026-11-07', type: 'expense', amount: 0.1, category },
    { date: '2026-11-07', type: 'expense', amount: 0.2, category },
  ]);
  const categoryRecords = labels.map((name, index) => ({ id: `category-${index}`, name }));
  const budgets = categoryRecords.map(category => ({
    categoryId: category.id, monthlyAmount: 1, monthYear: '2026-11',
  }));
  const result = buildFinanceAnalytics(rows, budgets, '2026-11', 3, categoryRecords);
  assert.equal(result.totalExpenses, 1.5);
  assert.equal(result.categories.length, labels.length);
  for (const label of labels) {
    const category = result.categories.find(row => row.name === label);
    assert.ok(category, `Category ${label} must remain visible`);
    assert.equal(category.amount, 0.3);
    assert.equal(category.percentage, 20);
    const budget = result.budgetRows.find(row => row.category === label);
    assert.equal(budget.spent, 0.3);
    assert.equal(budget.remaining, 0.7);
  }
  assert.equal(Object.hasOwn(Object.prototype, 'amount'), false);
});

test('A category budget with no expenses reports zero even for inherited property names', () => {
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const result = buildFinanceAnalytics([], [{ categoryId: 'custom', monthlyAmount: 12 }],
      '2026-11', 3, [{ id: 'custom', name }]);
    assert.equal(result.budgetRows[0].spent, 0);
    assert.equal(result.budgetRows[0].remaining, 12);
  }
});

test('Custom goal units never resolve inherited JavaScript properties as conversions', () => {
  for (const unit of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'books']) {
    assert.equal(canonicalUnit(unit), unit);
    assert.equal(convertMeasurement(12, unit, unit), 12);
    assert.throws(() => convertMeasurement(12, unit, 'km'), /Cannot convert/);
    assert.throws(() => convertMeasurement(12, 'km', unit), /Cannot convert/);
  }
  assert.equal(canonicalUnit('mi'), 'km');
  assert.equal(convertMeasurement(1, 'mi', 'km'), 1.609344);
  assert.equal(convertMeasurement(500, 'mL', 'L'), 0.5);
  assert.throws(() => convertMeasurement(1, 'km', 'L'), /Cannot convert/);
  assert.throws(() => convertMeasurement(Infinity, 'books', 'books'), /finite/);
});
