
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, 'src/db.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true
  }
}).outputText;

const loaded = new Module(path.join(__dirname, 'src/db.validation.test.cjs'), module);
loaded.filename = path.join(__dirname, 'src/db.validation.test.cjs');
loaded.paths = module.paths;
loaded._compile(compiled, loaded.filename);

const validate = loaded.exports.validateBackupTables;
assert.strictEqual(typeof validate, 'function');

const sample = () => ({
  transactions: [{
    id: 'tx1', type: 'expense', amount: 100, category: 'Food',
    description: 'Lunch', date: '2026-10-31',
    paymentMethod: 'UPI', createdAt: '2026-10-31T10:00:00.000Z'
  }],
  categories: [{
    id: 'cat1', name: 'Food', type: 'expense', color: '#fff'
  }],
  budgets: [{
    id: 'bud1', categoryId: 'cat1', monthlyAmount: 1000,
    monthYear: '2026-10', createdAt: '2026-10-01T00:00:00.000Z'
  }],
  savingsGoals: [{
    id: 'sg1', title: 'Emergency Fund', targetAmount: 10000,
    currentAmount: 1000, targetDate: '2027-10-31',
    createdAt: '2026-10-01T00:00:00.000Z'
  }],
  savingsContributions: [{
    id: 'sc1', goalId: 'sg1', amount: 500, date: '2026-10-31',
    createdAt: '2026-10-31T10:00:00.000Z'
  }],
  habits: [{
    id: 'h1', name: 'Exercise', frequency: 'daily',
    color: '#fff', createdAt: '2026-10-01T00:00:00.000Z'
  }],
  habitLogs: [{
    id: 'hl1', habitId: 'h1', date: '2026-10-31', completed: true
  }],
  goals: [{
    id: 'g1', title: 'Career', category: 'Career',
    targetValue: 10, currentValue: 2,
    startDate: '2026-10-01', targetDate: '2027-10-01',
    priority: 'High', status: 'In Progress',
    createdAt: '2026-10-01T00:00:00.000Z'
  }],
  milestones: [{
    id: 'm1', goalId: 'g1', title: 'First milestone',
    completed: false
  }],
  tasks: [{
    id: 't1', title: 'Review', dueDate: '2026-11-01',
    priority: 'Medium', recurring: 'None',
    completed: false, createdAt: '2026-10-31T10:00:00.000Z'
  }],
  settings: [{ key: 'theme', value: 'dark' }]
});

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS:', name);
  } catch (error) {
    console.error('FAIL:', name, '-', error.message);
    process.exitCode = 1;
  }
}
function rejects(data, expected) {
  assert.throws(() => validate(data), expected);
}

test('Accepts a valid backup containing all 11 tables', () => {
  assert.strictEqual(validate(sample()).length, 11);
});

test('Rejects missing table arrays', () => {
  const d = sample(); delete d.habits;
  rejects(d, /habits must be an array/);
});

test('Rejects duplicate record IDs', () => {
  const d = sample(); d.tasks.push({ ...d.tasks[0] });
  rejects(d, /duplicate id/);
});

test('Rejects invalid transaction amount', () => {
  const d = sample(); d.transactions[0].amount = '100';
  rejects(d, /transactions.*amount/);
});

test('Rejects impossible calendar dates', () => {
  const d = sample(); d.transactions[0].date = '2026-02-30';
  rejects(d, /transactions.*date/);
});

test('Rejects invalid category type', () => {
  const d = sample(); d.categories[0].type = 'transfer';
  rejects(d, /categories.*type/);
});

test('Rejects broken budget category reference', () => {
  const d = sample(); d.budgets[0].categoryId = 'missing';
  rejects(d, /categoryId reference/);
});

test('Rejects broken savings contribution reference', () => {
  const d = sample(); d.savingsContributions[0].goalId = 'missing';
  rejects(d, /goalId reference/);
});

test('Rejects broken habit log reference', () => {
  const d = sample(); d.habitLogs[0].habitId = 'missing';
  rejects(d, /habitId reference/);
});

test('Rejects duplicate habit/date combinations', () => {
  const d = sample(); d.habitLogs.push({ ...d.habitLogs[0], id: 'hl2' });
  rejects(d, /duplicate habitId\/date/);
});

test('Rejects invalid habit frequency', () => {
  const d = sample(); d.habits[0].frequency = 'monthly';
  rejects(d, /habits.*frequency/);
});

test('Rejects broken milestone goal reference', () => {
  const d = sample(); d.milestones[0].goalId = 'missing';
  rejects(d, /goalId reference/);
});

test('Rejects invalid goal status', () => {
  const d = sample(); d.goals[0].status = 'Unknown';
  rejects(d, /goals.*status/);
});

test('Rejects invalid task recurrence', () => {
  const d = sample(); d.tasks[0].recurring = 'Yearly';
  rejects(d, /tasks.*recurring/);
});

test('Rejects invalid task time', () => {
  const d = sample(); d.tasks[0].dueTime = '25:90';
  rejects(d, /tasks.*dueTime/);
});

test('Rejects duplicate settings keys', () => {
  const d = sample(); d.settings.push({ ...d.settings[0] });
  rejects(d, /duplicate key/);
});

console.log(`\nBackup validation tests: ${passed}/16 passed`);
