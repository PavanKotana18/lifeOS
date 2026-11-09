const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

const TABLES = [
  'transactions', 'categories', 'budgets', 'savingsGoals',
  'savingsContributions', 'financialAccounts', 'accountTransfers', 'manualExchangeRates', 'plannedCommitments', 'habits', 'habitLogs', 'goals',
  'milestones', 'tasks', 'settings'
];

const filename = path.resolve('src/services/encryptedStorageFacade.ts');
const built = esbuild.buildSync({
  entryPoints: [filename],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  packages: 'external',
});

const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(process.cwd());
loaded._compile(built.outputFiles[0].text, filename);

const { createEncryptedStorageFacade } = loaded.exports;
assert.equal(typeof createEncryptedStorageFacade, 'function');

let state;
let idCounter;
let failIdAt = 0;

function makeEnvironment() {
  state = Object.fromEntries(TABLES.map(table => [table, new Map()]));
  idCounter = 0;

  const repositories = Object.fromEntries(TABLES.map(table => [
    table,
    {
      async get(id) {
        return state[table].get(id);
      },
      async getAll() {
        return [...state[table].values()];
      },
      async prepare(record) {
        return record;
      },
    },
  ]));

  const coordinator = {
    async run(operation) {
      const draft = Object.fromEntries(
        TABLES.map(table => [table, new Map(state[table])])
      );

      const identity = (table, record) =>
        table === 'settings' ? record.key : record.id;

      const context = {
        async get(table, id) {
          return draft[table].get(id);
        },
        async getAll(table) {
          return [...draft[table].values()];
        },
        put(table, record) {
          draft[table].set(identity(table, record), record);
        },
        add(table, record) {
          const id = identity(table, record);
          if (draft[table].has(id)) {
            throw new Error(`Duplicate record: ${table}/${id}`);
          }
          draft[table].set(id, record);
        },
        delete(table, id) {
          draft[table].delete(id);
        },
        clear(table) {
          draft[table].clear();
        },
      };

      const result = await operation(context);
      state = draft;
      return result;
    },
  };

  const helpers = {
    createRecordId(prefix) {
      idCounter += 1;
      if (failIdAt && idCounter === failIdAt) {
        throw new Error('Injected test failure during demo seed');
      }
      return `${prefix}_test_${idCounter}`;
    },
    validateTransactionRecord(record, requireComplete) {
      if (requireComplete && (
        typeof record.amount !== 'number' ||
        !Number.isFinite(record.amount) ||
        record.amount <= 0 ||
        !record.category ||
        !record.date
      )) {
        throw new Error('Invalid transaction record');
      }
    },
    validateBackupTables(tables) {
      if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
        throw new Error('Invalid table payload');
      }
      return TABLES;
    },
    getNextRecurringTaskDate(task) {
      const date = new Date(`${task.dueDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toISOString().slice(0, 10);
    },
    getRecurrenceRootId(task) {
      return task.recurrenceRootId || task.id;
    },
  };

  return createEncryptedStorageFacade(repositories, coordinator, helpers);
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(error?.stack || error);
  }
}

async function rejects(fn, pattern) {
  let caught;
  try {
    await fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, 'Expected operation to reject');
  if (pattern) assert.match(String(caught.message), pattern);
}

(async () => {
  let storage;

  await test('factory exposes all expected storage domains', async () => {
    storage = makeEnvironment();
    for (const key of [
      'transactions', 'categories', 'budgets', 'savings',
      'accounts', 'exchangeRates', 'commitments', 'habits', 'goals', 'tasks', 'settings', 'backup'
    ]) {
      assert.ok(storage[key], `Missing facade domain: ${key}`);
    }
  });

  await test('empty category store seeds exact default categories', async () => {
    const categories = await storage.categories.getAll();
    assert.equal(categories.length, 15);
    assert.deepEqual(
      categories.find(row => row.id === 'cat_free'),
      {
        id: 'cat_free', name: 'Freelance', type: 'income',
        color: '#3b82f6', isDefault: true
      }
    );
    assert.equal(categories.find(row => row.id === 'cat_food').color, '#f59e0b');
  });

  await test('transaction rejects a category with the wrong type', async () => {
    await rejects(
      () => storage.transactions.add({
        type: 'income',
        amount: 1000,
        category: 'Food',
        description: 'Invalid category type',
        date: '2026-11-04',
        paymentMethod: 'UPI',
      }),
      /category|selected/i
    );
    assert.equal((await storage.transactions.getAll()).length, 0);
  });

  await test('valid transaction is persisted and retrievable', async () => {
    const created = await storage.transactions.add({
      type: 'expense',
      amount: 250,
      category: 'Food',
      description: 'Test transaction',
      date: '2026-11-04',
      paymentMethod: 'UPI',
    });

    assert.ok(created.id);
    assert.ok(created.createdAt);
    assert.equal((await storage.transactions.getById(created.id)).amount, 250);
  });

  await test('transaction update preserves ID and createdAt', async () => {
    const tx = (await storage.transactions.getAll())[0];
    const originalCreatedAt = tx.createdAt;

    await storage.transactions.update(tx.id, {
      id: 'attempted-id-change',
      createdAt: '1999-01-01',
      description: 'Updated description',
    });

    const updated = await storage.transactions.getById(tx.id);
    assert.equal(updated.id, tx.id);
    assert.equal(updated.createdAt, originalCreatedAt);
    assert.equal(updated.description, 'Updated description');
    assert.ok(updated.updatedAt);
  });

  await test('budget upsert updates instead of duplicating', async () => {
    await storage.budgets.upsert({
      monthlyAmount: 10000,
      monthYear: '2026-11',
    });
    await storage.budgets.upsert({
      monthlyAmount: 15000,
      monthYear: '2026-11',
    });

    const budgets = await storage.budgets.getByMonth('2026-11');
    assert.equal(budgets.length, 1);
    assert.equal(budgets[0].monthlyAmount, 15000);
  });

  await test('category deletion is blocked when referenced by a budget', async () => {
    await storage.budgets.upsert({
      categoryId: 'cat_food',
      monthlyAmount: 5000,
      monthYear: '2026-11',
    });

    await rejects(
      () => storage.categories.delete('cat_food'),
      /budget|transaction|linked/i
    );

    assert.ok((await storage.categories.getAll()).some(row => row.id === 'cat_food'));
  });

  await test('savings goal deletion removes its contributions', async () => {
    const goal = await storage.savings.addGoal({
      title: 'Test savings',
      targetAmount: 10000,
      currentAmount: 0,
      targetDate: '2027-01-01',
      category: 'Financial',
    });
    const transactionsBefore = (await storage.transactions.getAll()).length;

    await storage.savings.addContribution({
      goalId: goal.id,
      amount: 500,
      date: '2026-11-04',
      notes: 'Test contribution',
    });

    assert.equal((await storage.savings.getContributions(goal.id)).length, 1);
    assert.equal((await storage.transactions.getAll()).length, transactionsBefore,
      'Savings contributions never create an expense transaction');
    assert.equal((await storage.savings.getGoals()).find(row => row.id === goal.id).currentAmount, 500);
    await storage.savings.deleteGoal(goal.id);
    assert.equal((await storage.savings.getContributions(goal.id)).length, 0);
  });

  await test('exact savings contributions reconcile with their explicit goal currency', async () => {
    const goal = await storage.savings.addGoal({
      title: 'Precise reserve', targetAmount: 2, currentAmount: 0.1,
      targetAmountMinor: '200', currentAmountMinor: '10', currencyCode: 'USD',
      targetDate: '2027-01-01',
    });
    await storage.savings.addContribution({
      goalId: goal.id, amount: 0.2, amountMinor: '20', currencyCode: 'USD', date: '2026-11-04',
    });
    const saved = (await storage.savings.getGoals()).find(row => row.id === goal.id);
    assert.equal(saved.currentAmountMinor, '30');
    assert.equal(saved.currentAmount, 0.3);
    await rejects(() => storage.savings.addContribution({
      goalId: goal.id, amount: 0.01, amountMinor: '1', currencyCode: 'EUR', date: '2026-11-05',
    }), /currency/i);
    assert.equal((await storage.savings.getContributions(goal.id)).length, 1,
      'A cross-currency contribution is rejected without a conversion contract');
    const contribution = (await storage.savings.getContributions(goal.id))[0];
    await storage.savings.updateContribution(contribution.id, { amount: 0.3, amountMinor: '30', currencyCode: 'USD' });
    assert.equal((await storage.savings.getGoals()).find(row => row.id === goal.id).currentAmountMinor, '40');
    await storage.savings.deleteContribution(contribution.id);
    assert.equal((await storage.savings.getGoals()).find(row => row.id === goal.id).currentAmountMinor, '10');
    assert.equal((await storage.savings.getContributions(goal.id)).length, 0);
  });

  await test('encrypted account, transfer, rate and commitment records enforce links and duplicate safety', async () => {
    storage = makeEnvironment();
    const cash = await storage.accounts.add({ name: 'Cash', type: 'cash', currencyCode: 'USD', openingBalanceMinor: '10000', isActive: true });
    const bank = await storage.accounts.add({ name: 'Bank', type: 'bank', currencyCode: 'USD', openingBalanceMinor: '0', isActive: true });
    assert.equal((await storage.accounts.getAll()).length, 2);
    const fundedUnused = await storage.accounts.add({ name: 'Funded unused', type: 'cash', currencyCode: 'USD', openingBalanceMinor: '100', isActive: true });
    await rejects(() => storage.accounts.delete(fundedUnused.id), /non-zero opening balance/i);
    assert.ok((await storage.accounts.getAll()).some(row => row.id === fundedUnused.id));
    await storage.accounts.archive(fundedUnused.id);
    const emptyUnused = await storage.accounts.add({ name: 'Empty unused', type: 'cash', currencyCode: 'USD', openingBalanceMinor: '0', isActive: true });
    await storage.accounts.delete(emptyUnused.id);
    assert.ok(!(await storage.accounts.getAll()).some(row => row.id === emptyUnused.id));
    const first = await storage.accounts.addTransfer({ id: 'stable-transfer', fromAccountId: cash.id, toAccountId: bank.id, fromAmountMinor: '500', toAmountMinor: '500', fromCurrencyCode: 'USD', toCurrencyCode: 'USD', date: '2026-11-08' });
    await rejects(() => storage.accounts.addTransfer({ id: 'stable-transfer', fromAccountId: cash.id, toAccountId: bank.id, fromAmountMinor: '500', toAmountMinor: '500', fromCurrencyCode: 'USD', toCurrencyCode: 'USD', date: '2026-11-08' }));
    assert.equal((await storage.accounts.getTransfers(cash.id)).length, 1);
    await rejects(() => storage.accounts.update(cash.id, { currencyCode: 'EUR' }), /cannot change/i);
    await rejects(() => storage.accounts.update(cash.id, { openingBalanceMinor: '1' }), /opening balance cannot change/i);
    await rejects(() => storage.accounts.delete(cash.id), /archive/i);
    await storage.accounts.archive(cash.id);
    assert.equal((await storage.accounts.getAll()).find(row => row.id === cash.id).isActive, false);
    const rate = await storage.exchangeRates.add({ baseCurrencyCode: 'USD', quoteCurrencyCode: 'INR', rate: '83.25', effectiveDate: '2026-11-08', sourceLabel: 'Manual' });
    await rejects(() => storage.exchangeRates.add({ baseCurrencyCode: 'USD', quoteCurrencyCode: 'INR', rate: '84', effectiveDate: '2026-11-08' }), /already exists/i);
    assert.equal((await storage.exchangeRates.getAll())[0].id, rate.id);
    const commitment = await storage.commitments.add({ title: 'Rent', amount: 500, amountMinor: '50000', currencyCode: 'USD', frequency: 'monthly', nextDueDate: '2026-12-01', status: 'active' });
    assert.equal((await storage.commitments.getAll())[0].id, commitment.id);
    await rejects(() => storage.commitments.add({ title: 'Bad account link', amount: 10, amountMinor: '1000', currencyCode: 'USD', frequency: 'monthly', nextDueDate: '2026-12-01', accountId: 'missing', status: 'active' }), /account/i);
    const reversal = await storage.accounts.reverseTransfer(first.id, '2026-11-09');
    assert.equal(reversal.reversalOfId, first.id);
    assert.equal(reversal.fromAmountMinor, first.toAmountMinor);
    await rejects(() => storage.accounts.reverseTransfer(first.id, '2026-11-09'), /already been reversed/i);
    await rejects(() => storage.accounts.updateTransfer(first.id, { notes: 'change original' }), /reversed/i);
    await rejects(() => storage.accounts.deleteTransfer(first.id), /Remove the reversal/i);
    await storage.accounts.deleteTransfer(reversal.id);
    await storage.accounts.updateTransfer(first.id, { notes: 'Edited safely' });
    await storage.accounts.deleteTransfer(first.id);
    await storage.exchangeRates.delete(rate.id);
    await storage.commitments.delete(commitment.id);
    assert.equal(state.accountTransfers.size, 0);
  });

  await test('invalid calendar date rejects without RangeError', async () => {
    const habit = await storage.habits.add({
      name: 'Test habit',
      frequency: 'daily',
      color: '#3b82f6',
    });

    await rejects(
      () => storage.habits.logCompletion(habit.id, '2026-99-99', true),
      /Invalid habit completion date/
    );
    await rejects(
      () => storage.habits.logCompletion(habit.id, '2026-02-30', true),
      /Invalid habit completion date/
    );
  });

  await test('habit deletion removes associated logs', async () => {
    const habit = await storage.habits.add({
      name: 'Delete test',
      frequency: 'daily',
      color: '#3b82f6',
    });

    await storage.habits.logCompletion(habit.id, '2026-11-04', true);
    assert.equal((await storage.habits.getLogs(habit.id)).length, 1);

    await storage.habits.delete(habit.id);
    assert.equal((await storage.habits.getLogs(habit.id)).length, 0);
  });

  await test('goal deletion removes associated milestones', async () => {
    const goal = await storage.goals.add({
      title: 'Test goal',
      category: 'Fitness',
      targetValue: 10,
      currentValue: 0,
      unit: 'km',
      startDate: '2026-11-01',
      targetDate: '2027-01-01',
      priority: 'High',
      status: 'In Progress',
    });

    const milestone = await storage.goals.addMilestone({
      goalId: goal.id,
      title: 'First milestone',
      completed: false,
    });

    assert.ok(milestone.id);
    await storage.goals.delete(goal.id);
    assert.equal((await storage.goals.getMilestones(goal.id)).length, 0);
  });

  await test('missing milestone update rejects', async () => {
    await rejects(
      () => storage.goals.toggleMilestone('missing-milestone', true),
      /Milestone not found/
    );
  });

  await test('settings round-trip', async () => {
    await storage.settings.set('testSetting', { enabled: true, count: 3 });
    assert.deepEqual(
      await storage.settings.get('testSetting', null),
      { enabled: true, count: 3 }
    );
    assert.equal(await storage.settings.get('missingSetting', 'fallback'), 'fallback');
    await storage.settings.delete('testSetting');
    assert.equal(await storage.settings.get('testSetting', null), null,
      'Encrypted profile settings support deletion through an authenticated transaction');
  });

  await test('backup import refuses existing data without replaceExisting', async () => {
    const json = JSON.stringify({
      version: 1,
      timestamp: new Date().toISOString(),
      tables: Object.fromEntries(TABLES.map(table => [table, []])),
    });

    await rejects(
      () => storage.backup.importData(json),
      /Existing data found/
    );
  });

  await test('backup clearAll clears data and restores defaults', async () => {
    await storage.backup.clearAll();

    assert.equal((await storage.transactions.getAll()).length, 0);
    assert.equal((await storage.categories.getAll()).length, 15);
    assert.equal((await storage.budgets.getAll()).length, 0);
  });

  await test('failed demo seed rolls back all staged writes', async () => {
    // Use a pristine store and inject a deterministic mid-seed failure.
    storage = makeEnvironment();

    const before = {};
    for (const table of TABLES) {
      before[table] = state[table].size;
    }

    failIdAt = 4;
    try {
      await rejects(
        () => storage.backup.seedDemoData(),
        /Injected test failure during demo seed/
      );
    } finally {
      failIdAt = 0;
    }

    assert.ok(idCounter >= 4, 'Failure was not injected during the seed operation');

    for (const table of TABLES) {
      assert.equal(
        state[table].size,
        before[table],
        `${table} changed after failed seed`
      );
    }
  });

  console.log('\n========================================');
  console.log(`ENCRYPTED STORAGE FACADE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================');

  if (failed) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
