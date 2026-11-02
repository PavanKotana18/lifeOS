/**
 * LifeOS Sentinel — Domain & Unit Verification Suite
 */

const assert = require('assert');
const { calculateStreaks, calculateFinanceMetrics } = require('../../src_core_logic.js');
const { CsvExportService, sanitizeCsvCell } = require('../../src/services/csvExportService.js');

function runDomainTests() {
  const results = { name: 'Unit & Domain Suite', total: 0, passed: 0, failed: 0, errors: [] };

  function test(description, fn) {
    results.total++;
    try {
      fn();
      results.passed++;
    } catch (e) {
      results.failed++;
      results.errors.push({ test: description, error: e.message, stack: e.stack });
      console.error(`  ❌ FAIL: ${description} - ${e.message}`);
    }
  }

  console.log('--- Running Sentinel Unit & Domain Tests ---');

  // Habit Streaks Engine
  test('Streak Engine: empty logs returns 0 current and longest streak', () => {
    const res = calculateStreaks([], 'h1', '2026-11-01');
    assert.strictEqual(res.currentStreak, 0);
    assert.strictEqual(res.longestStreak, 0);
    assert.strictEqual(res.completedToday, false);
  });

  test('Streak Engine: single completion today returns current=1, longest=1', () => {
    const logs = [{ habitId: 'h1', date: '2026-11-01', completed: true }];
    const res = calculateStreaks(logs, 'h1', '2026-11-01');
    assert.strictEqual(res.currentStreak, 1);
    assert.strictEqual(res.longestStreak, 1);
    assert.strictEqual(res.completedToday, true);
  });

  test('Streak Engine: continuous 5-day streak ending today', () => {
    const logs = [
      { habitId: 'h1', date: '2026-10-28', completed: true },
      { habitId: 'h1', date: '2026-10-29', completed: true },
      { habitId: 'h1', date: '2026-10-30', completed: true },
      { habitId: 'h1', date: '2026-10-31', completed: true },
      { habitId: 'h1', date: '2026-11-01', completed: true }
    ];
    const res = calculateStreaks(logs, 'h1', '2026-11-01');
    assert.strictEqual(res.currentStreak, 5);
    assert.strictEqual(res.longestStreak, 5);
    assert.strictEqual(res.completedToday, true);
  });

  test('Streak Engine: continuous streak completed yesterday preserves active streak', () => {
    const logs = [
      { habitId: 'h1', date: '2026-10-30', completed: true },
      { habitId: 'h1', date: '2026-10-31', completed: true }
    ];
    const res = calculateStreaks(logs, 'h1', '2026-11-01');
    assert.strictEqual(res.currentStreak, 2);
    assert.strictEqual(res.completedToday, false);
  });

  test('Streak Engine: broken streak recalculates longest vs current', () => {
    const logs = [
      { habitId: 'h1', date: '2026-10-20', completed: true },
      { habitId: 'h1', date: '2026-10-21', completed: true },
      { habitId: 'h1', date: '2026-10-22', completed: true }, // 3-day streak
      { habitId: 'h1', date: '2026-11-01', completed: true }  // 1-day streak
    ];
    const res = calculateStreaks(logs, 'h1', '2026-11-01');
    assert.strictEqual(res.currentStreak, 1);
    assert.strictEqual(res.longestStreak, 3);
  });

  // Finance Metrics Engine
  test('Finance Engine: zero income returns 0 savings rate without NaN or division by zero', () => {
    const txs = [{ type: 'expense', amount: 500, category: 'Food', date: '2026-11-01' }];
    const res = calculateFinanceMetrics(txs, [], '2026-11');
    assert.strictEqual(res.totalIncome, 0);
    assert.strictEqual(res.totalExpenses, 500);
    assert.strictEqual(res.savingsRate, 0);
    assert.strictEqual(res.remainingBalance, -500);
  });

  test('Finance Engine: budget utilisation calculation', () => {
    const txs = [
      { type: 'income', amount: 100000, category: 'Salary', date: '2026-11-01' },
      { type: 'expense', amount: 40000, category: 'Rent', date: '2026-11-02' }
    ];
    const budgets = [{ monthYear: '2026-11', monthlyAmount: 50000 }];
    const res = calculateFinanceMetrics(txs, budgets, '2026-11');
    assert.strictEqual(res.totalBudget, 50000);
    assert.strictEqual(res.budgetUtilisation, 80.0);
    assert.strictEqual(res.remainingBudget, 10000);
    assert.strictEqual(res.savingsRate, 60.0);
  });

  test('Finance Engine: transactions outside requested month are strictly excluded', () => {
    const txs = [
      { type: 'expense', amount: 1000, category: 'Food', date: '2026-10-31' },
      { type: 'expense', amount: 2000, category: 'Food', date: '2026-11-01' },
      { type: 'expense', amount: 3000, category: 'Food', date: '2026-12-01' }
    ];
    const res = calculateFinanceMetrics(txs, [], '2026-11');
    assert.strictEqual(res.totalExpenses, 2000);
    assert.strictEqual(res.categoryExpenses['Food'], 2000);
  });

  // CSV Security & Escaping Engine
  test('CSV Sanitizer: neutralizes formula injection (=, +, -, @)', () => {
    assert.strictEqual(sanitizeCsvCell('=1+1'), "'=1+1");
    assert.strictEqual(sanitizeCsvCell('+cmd|/c calc'), "'+cmd|/c calc");
    assert.strictEqual(sanitizeCsvCell('-5'), "'-5");
    assert.strictEqual(sanitizeCsvCell('@SUM(A1:A5)'), "'@SUM(A1:A5)");
  });

  test('CSV Sanitizer: escapes embedded double quotes and commas correctly', () => {
    const escaped = sanitizeCsvCell('He said "Hello, world!"');
    assert.strictEqual(escaped, '"He said ""Hello, world!"""');
  });

  console.log(`Unit & Domain Tests Completed: ${results.passed}/${results.total} passed.`);
  return results;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runDomainTests };
  if (require.main === module) {
    runDomainTests();
  }
}
