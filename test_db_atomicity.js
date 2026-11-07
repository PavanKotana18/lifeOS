require('fake-indexeddb/auto');

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const assert = require('assert');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, 'src/db.ts'), 'utf8') + '\n\n// Test-only access to the raw Dexie instance.\nexport { db, rawStorageService as legacyStorageService };\n';
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const loaded = new Module(path.join(__dirname, 'src/db.atomicity.cjs'), module);
  loaded.filename = path.join(__dirname, 'src/db.atomicity.cjs');
  loaded.paths = module.paths;
  const financeSource = fs.readFileSync(path.join(__dirname, 'src/services/financeCore.ts'), 'utf8');
  const financeCompiled = ts.transpileModule(financeSource, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true
  } }).outputText;
  const financeLoaded = new Module(path.join(__dirname, 'src/services/financeCore.atomicity.cjs'), module);
  financeLoaded.filename = path.join(__dirname, 'src/services/financeCore.atomicity.cjs');
  financeLoaded.paths = module.paths;
  financeLoaded._compile(financeCompiled, financeLoaded.filename);
  const sessionSource = fs.readFileSync(
    path.join(__dirname, 'src/services/sessionManager.ts'),
    'utf8'
  );
  const sessionCompiled = ts.transpileModule(sessionSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const sessionLoaded = new Module(
    path.join(__dirname, 'src/services/sessionManager.cjs'),
    module
  );
  sessionLoaded.filename = path.join(__dirname, 'src/services/sessionManager.cjs');
  sessionLoaded.paths = module.paths;
  sessionLoaded._compile(sessionCompiled, sessionLoaded.filename);

  const originalModuleLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (
      request === './services/sessionManager' &&
      parent &&
      parent.filename === loaded.filename
    ) {
      return sessionLoaded.exports;
    }
    if (
    parent &&
    parent.filename &&
    parent.filename.endsWith('/src/db.atomicity.cjs')
  ) {
    if (request === './services/financeCore') return financeLoaded.exports;
    if (request === './services/encryptedStorageIntegration') {
      return { BOOTSTRAP_SETTING_KEYS: new Set([
        'theme', 'visualTheme', 'biometricLockEnabled',
        'onboardingCompleted', 'onboardingStarted', 'onboardingStep'
      ]) };
    }

    if (request === './services/encryptedStorageRuntime') {
      return {
        createLifeOSEncryptedRuntime: () => ({
          repositories: {},
          transactionCoordinator: {},
          storage: {},
          migrateExistingRecords: async () => ({ migrated: 0, skipped: 0 })
        })
      };
    }

    if (request === './services/cryptoService.ts') {
      return {
        CryptoService: {
          getKeyState: async () => ({
            keyProvisioned: false,
            recoveryProvisioned: false,
            recoveryNeedsRebind: false,
            metadataConsistent: true,
            keystoreAliasPresent: false,
            unlocked: false
          }),
          isUnlocked: async () => false,
          lock: async () => {}
        }
      };
    }
  }

  return originalModuleLoad.apply(this, arguments);
  };

  try {
    loaded._compile(compiled, loaded.filename);
  } finally {
    Module._load = originalModuleLoad;
  }

  const { db, legacyStorageService: StorageService, sessionManager } = loaded.exports;
  await db.open();

  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };


  // This fixture intentionally tests raw migration-era algorithm atomicity.
  // Actual protected admission/lease behavior is tested against the encrypted
  // facade in test_secure_startup.js and test_encryption_admission.js.
  sessionManager.unlock();
  await StorageService.categories.getAll();
  const stamp = '2026-11-01T10:00:00.000Z';

  try {
    // 1. Contribution insert failure must roll back the goal balance update.
    await db.savingsGoals.add({
      id: 'sg-atomic', title: 'Emergency fund',
      targetAmount: 10000, currentAmount: 1000,
      targetDate: '2027-12-31', createdAt: stamp
    });

    const contributionFailure = () => { throw new Error('Injected contribution failure'); };
    db.savingsContributions.hook('creating').subscribe(contributionFailure);

    try {
      await assert.rejects(StorageService.savings.addContribution({
        goalId: 'sg-atomic', amount: 500, date: '2026-11-01'
      }));
    } finally {
      db.savingsContributions.hook('creating').unsubscribe(contributionFailure);
    }

    check(
      (await db.savingsGoals.get('sg-atomic')).currentAmount === 1000 &&
      await db.savingsContributions.where('goalId').equals('sg-atomic').count() === 0,
      'Contribution failure rolls back the goal balance and contribution record'
    );

    // 2. Invalid amounts and missing goals must be rejected.
    await assert.rejects(
      StorageService.savings.addContribution({
        goalId: 'sg-atomic', amount: 0, date: '2026-11-01'
      })
    );
    await assert.rejects(
      StorageService.savings.addContribution({
        goalId: 'missing-goal', amount: 100, date: '2026-11-01'
      })
    );

    check(
      (await db.savingsGoals.get('sg-atomic')).currentAmount === 1000 &&
      await db.savingsContributions.count() === 0,
      'Invalid amounts and missing goals create no financial records'
    );

    // 3. Savings progress must not create or mutate a spending transaction.
    const historicalSavingsExpense = {
      id: 'legacy-savings-expense', type: 'expense', amount: 250,
      category: 'Investments', description: 'Savings contribution: Older fund',
      date: '2026-10-01', paymentMethod: 'Savings transfer',
      createdAt: '2026-10-01T10:00:00.000Z'
    };
    await db.transactions.add(historicalSavingsExpense);
    const transactionsBeforeContribution = await db.transactions.count();
    await StorageService.savings.addContribution({
      goalId: 'sg-atomic', amount: 250, date: '2026-11-01', notes: 'Goal progress only'
    });
    check(
      (await db.savingsGoals.get('sg-atomic')).currentAmount === 1250 &&
      await db.savingsContributions.where('goalId').equals('sg-atomic').count() === 1 &&
      await db.transactions.count() === transactionsBeforeContribution &&
      JSON.stringify(await db.transactions.get(historicalSavingsExpense.id)) === JSON.stringify(historicalSavingsExpense),
      'Savings contribution adds no expense and leaves historical savings expense unchanged'
    );

    // A transaction-table failure cannot turn goal progress into spending.
    const unrelatedTransactionFailure = () => { throw new Error('Injected unrelated transaction failure'); };
    db.transactions.hook('creating').subscribe(unrelatedTransactionFailure);

    try {
      await StorageService.savings.addContribution({
        goalId: 'sg-atomic', amount: 50, date: '2026-11-01'
      });
    } finally {
      db.transactions.hook('creating').unsubscribe(unrelatedTransactionFailure);
    }

    check(
      (await db.savingsGoals.get('sg-atomic')).currentAmount === 1300 &&
      await db.savingsContributions.where('goalId').equals('sg-atomic').count() === 2 &&
      await db.transactions.count() === transactionsBeforeContribution &&
      JSON.stringify(await db.transactions.get(historicalSavingsExpense.id)) === JSON.stringify(historicalSavingsExpense),
      'Contribution commit is independent of transaction creation and preserves historical rows'
    );

    // 4. Habit deletion must roll back if dependent-log deletion fails.
    await db.habits.add({
      id: 'habit-atomic', name: 'Read',
      frequency: 'daily', color: '#123456', createdAt: stamp
    });
    await db.habitLogs.add({
      id: 'log-atomic', habitId: 'habit-atomic',
      date: '2026-11-01', completed: true
    });

    const habitDeleteFailure = () => { throw new Error('Injected habit-log deletion failure'); };
    db.habitLogs.hook('deleting').subscribe(habitDeleteFailure);

    try {
      await assert.rejects(StorageService.habits.delete('habit-atomic'));
    } finally {
      db.habitLogs.hook('deleting').unsubscribe(habitDeleteFailure);
    }

    check(
      Boolean(await db.habits.get('habit-atomic')) &&
      Boolean(await db.habitLogs.get('log-atomic')),
      'Habit deletion rolls back when dependent-log deletion fails'
    );

    // 4. Goal deletion must roll back if milestone deletion fails.
    await db.goals.add({
      id: 'goal-atomic', title: 'Learn security',
      category: 'Education', targetValue: 10, currentValue: 2,
      startDate: '2026-11-01', targetDate: '2027-01-01',
      priority: 'High', status: 'In Progress', createdAt: stamp
    });
    await db.milestones.add({
      id: 'milestone-atomic', goalId: 'goal-atomic',
      title: 'Complete module one', completed: false
    });

    const milestoneDeleteFailure = () => { throw new Error('Injected milestone deletion failure'); };
    db.milestones.hook('deleting').subscribe(milestoneDeleteFailure);

    try {
      await assert.rejects(StorageService.goals.delete('goal-atomic'));
    } finally {
      db.milestones.hook('deleting').unsubscribe(milestoneDeleteFailure);
    }

    check(
      Boolean(await db.goals.get('goal-atomic')) &&
      Boolean(await db.milestones.get('milestone-atomic')),
      'Goal deletion rolls back when milestone deletion fails'
    );

    // 5. Savings-goal deletion must roll back if contribution deletion fails.
    await db.savingsContributions.add({
      id: 'contribution-atomic', goalId: 'sg-atomic',
      amount: 100, date: '2026-11-01', createdAt: stamp
    });

    const savingsDeleteFailure = () => { throw new Error('Injected savings deletion failure'); };
    db.savingsContributions.hook('deleting').subscribe(savingsDeleteFailure);

    try {
      await assert.rejects(StorageService.savings.deleteGoal('sg-atomic'));
    } finally {
      db.savingsContributions.hook('deleting').unsubscribe(savingsDeleteFailure);
    }

    check(
      Boolean(await db.savingsGoals.get('sg-atomic')) &&
      Boolean(await db.savingsContributions.get('contribution-atomic')),
      'Savings-goal deletion rolls back when contribution deletion fails'
    );


    // Valid calendar dates must be accepted by the production write path.
    await StorageService.habits.logCompletion('habit-atomic', '2026-11-02', true);
    const validDateLog = await db.habitLogs
      .where('[habitId+date]')
      .equals(['habit-atomic', '2026-11-02'])
      .first();

    check(
      Boolean(validDateLog) && validDateLog.completed === true,
      'Valid YYYY-MM-DD date is accepted and persisted'
    );

    // 6. Concurrent completion requests must resolve to one habit/date row.
    await db.habits.add({
      id: 'habit-log-race', name: 'Concurrent habit',
      frequency: 'daily', color: '#123456', createdAt: stamp
    });

    await Promise.all([
      StorageService.habits.logCompletion('habit-log-race', '2026-11-02', true),
      StorageService.habits.logCompletion('habit-log-race', '2026-11-02', true)
    ]);

    const raceLogs = await db.habitLogs
      .where('[habitId+date]')
      .equals(['habit-log-race', '2026-11-02'])
      .toArray();

    check(
      raceLogs.length === 1 &&
      raceLogs[0].completed === true &&
      typeof raceLogs[0].completedAt === 'string',
      'Concurrent habit completion creates exactly one completed log'
    );

    // 7. Invalid dates and missing habits must not create records.
    await assert.rejects(
      StorageService.habits.logCompletion('habit-log-race', '2026-02-30', true)
    );
    await assert.rejects(
      StorageService.habits.logCompletion('missing-habit', '2026-11-02', true)
    );
    await assert.rejects(
      StorageService.habits.logCompletion('habit-log-race', '02-11-2026', true)
    );

    check(
      await db.habitLogs.where('habitId').equals('habit-log-race').count() === 1,
      'Invalid dates and missing habits create no additional logs'
    );

    // 8. A failed insert must leave no partial habit log.
    await db.habits.add({
      id: 'habit-log-rollback', name: 'Rollback habit',
      frequency: 'daily', color: '#123456', createdAt: stamp
    });

    const logInsertFailure = () => { throw new Error('Injected habit-log insert failure'); };
    db.habitLogs.hook('creating').subscribe(logInsertFailure);

    try {
      await assert.rejects(
        StorageService.habits.logCompletion('habit-log-rollback', '2026-11-03', true)
      );
    } finally {
      db.habitLogs.hook('creating').unsubscribe(logInsertFailure);
    }

    check(
      await db.habitLogs.where('habitId').equals('habit-log-rollback').count() === 0,
      'Failed habit-log insertion leaves no partial record'
    );

    // 9. Repeated completion toggles update the same record.
    await StorageService.habits.logCompletion('habit-log-race', '2026-11-02', false);
    await StorageService.habits.logCompletion('habit-log-race', '2026-11-02', true);

    const toggledLogs = await db.habitLogs
      .where('[habitId+date]')
      .equals(['habit-log-race', '2026-11-02'])
      .toArray();

    check(
      toggledLogs.length === 1 && toggledLogs[0].completed === true,
      'Repeated completion toggles update one existing log'
    );


    // 10. Same-millisecond record creation must not collide.
    const originalNow = Date.now;
    Date.now = () => 1793530000000;
    try {
      const habits = await Promise.all([
        StorageService.habits.add({ name: 'Rapid habit A', frequency: 'daily', color: '#123456' }),
        StorageService.habits.add({ name: 'Rapid habit B', frequency: 'daily', color: '#654321' })
      ]);
      check(
        habits[0].id !== habits[1].id &&
        await db.habits.where('id').anyOf(habits.map(item => item.id)).count() === 2,
        'Rapid habit creation generates distinct IDs within one millisecond'
      );

      const savingsGoals = await Promise.all([
        StorageService.savings.addGoal({ title: 'Rapid savings A', targetAmount: 1000, currentAmount: 0, targetDate: '2027-01-01' }),
        StorageService.savings.addGoal({ title: 'Rapid savings B', targetAmount: 2000, currentAmount: 0, targetDate: '2027-02-01' })
      ]);
      check(
        savingsGoals[0].id !== savingsGoals[1].id &&
        await db.savingsGoals.where('id').anyOf(savingsGoals.map(item => item.id)).count() === 2,
        'Rapid savings-goal creation preserves both records'
      );

      const goals = await Promise.all([
        StorageService.goals.add({ title: 'Rapid goal A', category: 'Education', targetValue: 10, currentValue: 0, startDate: '2026-11-01', targetDate: '2027-01-01', priority: 'Medium', status: 'In Progress' }),
        StorageService.goals.add({ title: 'Rapid goal B', category: 'Education', targetValue: 20, currentValue: 0, startDate: '2026-11-01', targetDate: '2027-02-01', priority: 'Medium', status: 'In Progress' })
      ]);
      check(goals[0].id !== goals[1].id, 'Rapid goal creation generates distinct IDs');

      const milestones = await Promise.all([
        StorageService.goals.addMilestone({ goalId: goals[0].id, title: 'Rapid milestone A', completed: false }),
        StorageService.goals.addMilestone({ goalId: goals[0].id, title: 'Rapid milestone B', completed: false })
      ]);
      check(milestones[0].id !== milestones[1].id, 'Rapid milestone creation generates distinct IDs');

      // F12: Goal closure requires 100% numeric progress and all milestones.
      const closureGoal = await StorageService.goals.add({
        title: 'F12 all milestones', category: 'Education',
        targetValue: 10, currentValue: 10,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'In Progress'
      });
      const closureMilestones = await Promise.all([
        StorageService.goals.addMilestone({ goalId: closureGoal.id, title: 'Step A', completed: false }),
        StorageService.goals.addMilestone({ goalId: closureGoal.id, title: 'Step B', completed: false })
      ]);
      await StorageService.goals.toggleMilestone(closureMilestones[0].id, true);
      check(
        (await db.goals.get(closureGoal.id)).status === 'In Progress',
        'F12: one incomplete milestone prevents goal closure'
      );
      await StorageService.goals.toggleMilestone(closureMilestones[1].id, true);
      check(
        (await db.goals.get(closureGoal.id)).status === 'Completed',
        'F12 RUNTIME: final milestone closes a fully funded goal'
      );

      const numericGoal = await StorageService.goals.add({
        title: 'F12 numeric threshold', category: 'Education',
        targetValue: 10, currentValue: 9,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'In Progress'
      });
      const numericMilestone = await StorageService.goals.addMilestone({
        goalId: numericGoal.id, title: 'Complete step', completed: false
      });
      await StorageService.goals.toggleMilestone(numericMilestone.id, true);
      check(
        (await db.goals.get(numericGoal.id)).status === 'In Progress',
        'F12: completed milestones cannot compensate for numeric progress below 100%'
      );
      await StorageService.goals.update(numericGoal.id, { currentValue: 10 });
      check(
        (await db.goals.get(numericGoal.id)).status === 'Completed',
        'F12: reaching the numeric target closes a goal with all milestones complete'
      );

      const pausedGoal = await StorageService.goals.add({
        title: 'F12 paused goal', category: 'Education',
        targetValue: 10, currentValue: 10,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'Paused'
      });
      const pausedMilestone = await StorageService.goals.addMilestone({
        goalId: pausedGoal.id, title: 'Paused step', completed: false
      });
      await StorageService.goals.toggleMilestone(pausedMilestone.id, true);
      await StorageService.goals.update(pausedGoal.id, { currentValue: 10 });
      check(
        (await db.goals.get(pausedGoal.id)).status === 'Paused',
        'F12: progress and milestone updates preserve Paused status'
      );

      const reopenGoal = await StorageService.goals.add({
        title: 'F12 reopen goal', category: 'Education',
        targetValue: 10, currentValue: 10,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'In Progress'
      });
      const reopenMilestone = await StorageService.goals.addMilestone({
        goalId: reopenGoal.id, title: 'Reopen step', completed: true
      });
      await StorageService.goals.update(reopenGoal.id, { currentValue: 10 });
      await StorageService.goals.toggleMilestone(reopenMilestone.id, false);
      check(
        (await db.goals.get(reopenGoal.id)).status === 'In Progress',
        'F12: reopening a milestone reopens a completed goal'
      );

      const zeroTargetGoal = await StorageService.goals.add({
        title: 'F12 zero target', category: 'Education',
        targetValue: 0, currentValue: 0,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'In Progress'
      });
      await StorageService.goals.update(zeroTargetGoal.id, { currentValue: 0 });
      check(
        (await db.goals.get(zeroTargetGoal.id)).status === 'In Progress',
        'F12: zero target cannot qualify a goal for 100% closure'
      );


      const budgets = await Promise.all([
        StorageService.budgets.upsert({ monthYear: '2026-11', monthlyAmount: 100 }),
        StorageService.budgets.upsert({ monthYear: '2026-11', monthlyAmount: 200 })
      ]);
      const monthlyBudgets = await db.budgets.where('monthYear').equals('2026-11').toArray();
      check(
        budgets[0].id === budgets[1].id && monthlyBudgets.length === 1,
        'Concurrent monthly budget upserts serialize into one budget record'
      );
    } finally {
      Date.now = originalNow;
    }

    // 16. Transaction storage rejects invalid records and preserves identity fields.
    await assert.rejects(StorageService.transactions.add({
      amount: 0, date: '2026-11-01', category: 'Food',
      description: 'Invalid amount', paymentMethod: 'Cash', type: 'expense'
    }));
    await assert.rejects(StorageService.transactions.add({
      amount: 100, date: '2026-02-30', category: 'Food',
      description: 'Invalid date', paymentMethod: 'Cash', type: 'expense'
    }));
    const validTransaction = await StorageService.transactions.add({
      amount: 100, date: '2026-11-01', category: 'Food',
      description: 'Storage validation', paymentMethod: 'Cash', type: 'expense'
    });
    await assert.rejects(StorageService.transactions.update(validTransaction.id, { amount: -1 }));
    await assert.rejects(StorageService.transactions.update(validTransaction.id, { date: '2026-02-30' }));
    await StorageService.transactions.update(validTransaction.id, {
      amount: 125,
      id: 'attempted-id-overwrite',
      createdAt: '1999-01-01T00:00:00.000Z'
    });
    const persistedTransaction = await db.transactions.get(validTransaction.id);
    check(
      persistedTransaction.amount === 125 &&
      persistedTransaction.id === validTransaction.id &&
      persistedTransaction.createdAt === validTransaction.createdAt &&
      !(await db.transactions.get('attempted-id-overwrite')),
      'Transaction storage enforces amount/date invariants and protects record identity'
    );

    // 17. Habit, Goal and Task updates must preserve record identity.
    const identityStamp = new Date().toISOString();

    await db.habits.add({
      id: 'habit-identity', name: 'Original habit',
      frequency: 'daily', color: '#123456', createdAt: identityStamp
    });
    await StorageService.habits.update('habit-identity', {
      id: 'overwritten-habit', createdAt: 'tampered', name: 'Updated habit'
    });
    const updatedHabit = await db.habits.get('habit-identity');

    check(
      updatedHabit?.id === 'habit-identity' &&
      updatedHabit?.createdAt === identityStamp &&
      updatedHabit?.name === 'Updated habit' &&
      !(await db.habits.get('overwritten-habit')),
      'Habit update preserves id and createdAt while applying mutable fields'
    );

    await db.goals.add({
      id: 'goal-identity', title: 'Original goal',
      category: 'Education', targetValue: 10, currentValue: 2,
      startDate: '2026-11-01', targetDate: '2027-01-01',
      priority: 'High', status: 'In Progress', createdAt: identityStamp
    });
    await StorageService.goals.update('goal-identity', {
      id: 'overwritten-goal', createdAt: 'tampered', title: 'Updated goal'
    });
    const updatedGoal = await db.goals.get('goal-identity');

    check(
      updatedGoal?.id === 'goal-identity' &&
      updatedGoal?.createdAt === identityStamp &&
      updatedGoal?.title === 'Updated goal' &&
      !(await db.goals.get('overwritten-goal')),
      'Goal update preserves id and createdAt while applying mutable fields'
    );

    await db.tasks.add({
      id: 'task-identity', title: 'Original task',
      createdAt: identityStamp, completed: false
    });
    await StorageService.tasks.update('task-identity', {
      id: 'overwritten-task', createdAt: 'tampered', title: 'Updated task'
    });
    const updatedTask = await db.tasks.get('task-identity');

    check(
      updatedTask?.id === 'task-identity' &&
      updatedTask?.createdAt === identityStamp &&
      updatedTask?.title === 'Updated task' &&
      !(await db.tasks.get('overwritten-task')),
      'Task update preserves id and createdAt while applying mutable fields'
    );

    // 18. Concurrent first-run category initialization is atomic.
    await db.categories.clear();
    const categoryLoads = await Promise.all([
      StorageService.categories.getAll(),
      StorageService.categories.getAll(),
      StorageService.categories.getAll(),
      StorageService.categories.getAll()
    ]);
    const persistedCategories = await db.categories.toArray();
    const categoryIds = persistedCategories.map(category => category.id);
    check(
      categoryLoads.every(rows => rows.length === categoryLoads[0].length) &&
      persistedCategories.length === categoryLoads[0].length &&
      new Set(categoryIds).size === categoryIds.length &&
      persistedCategories.length > 0,
      'Concurrent first-run category initialization seeds one complete, duplicate-free category set'
    );

    // 18. Category deletion must preserve budget references and transaction history.
    const protectedCategory = await StorageService.categories.add({
      name: 'Protected budget category',
      type: 'expense',
      color: '#123456'
    });

    await StorageService.budgets.upsert({
      monthYear: '2099-01',
      categoryId: protectedCategory.id,
      monthlyAmount: 500
    });

    const historicalTransaction = await StorageService.transactions.add({
      amount: 75,
      date: '2026-11-01',
      category: protectedCategory.name,
      description: 'Historical category reference',
      paymentMethod: 'Cash',
      type: 'expense'
    });

    await assert.rejects(
      StorageService.categories.delete(protectedCategory.id),
      /linked to one or more budgets/i
    );

    check(
      Boolean(await db.categories.get(protectedCategory.id)) &&
      await db.budgets.where('categoryId').equals(protectedCategory.id).count() === 1,
      'Category deletion is blocked while a budget references it'
    );

    await db.budgets.where('categoryId').equals(protectedCategory.id).delete();

    await assert.rejects(
      StorageService.categories.delete(protectedCategory.id),
      /used by existing transactions/i
    );

    check(
      Boolean(await db.categories.get(protectedCategory.id)) &&
      Boolean(await db.transactions.get(historicalTransaction.id)),
      'Category deletion is blocked while a transaction references it'
    );

    await StorageService.transactions.delete(historicalTransaction.id);
    await StorageService.categories.delete(protectedCategory.id);

    check(
      !(await db.categories.get(protectedCategory.id)) &&
      !(await db.transactions.get(historicalTransaction.id)),
      'Category can be deleted after its budget and transaction references are removed'
    );

    await db.savingsGoals.add({
      id: 'sg-exact', title: 'Exact savings', targetAmount: 10, targetAmountMinor: '1000',
      currentAmount: 0.1, currentAmountMinor: '10', currencyCode: 'USD',
      targetDate: '2027-01-01', createdAt: stamp,
    });
    await StorageService.savings.addContribution({
      goalId: 'sg-exact', amount: 0.2, amountMinor: '20', currencyCode: 'USD', date: '2026-11-01',
    });
    await assert.rejects(StorageService.savings.addContribution({
      goalId: 'sg-exact', amount: 0.01, amountMinor: '1', currencyCode: 'EUR', date: '2026-11-01',
    }), /currency/i);
    check(
      (await db.savingsGoals.get('sg-exact')).currentAmountMinor === '30' &&
      await db.savingsContributions.where('goalId').equals('sg-exact').count() === 1,
      'Exact savings contributions reconcile minor units and reject mixed currencies atomically'
    );
    const exactContribution = await db.savingsContributions.where('goalId').equals('sg-exact').first();
    await StorageService.savings.updateContribution(exactContribution.id, { amount: 0.3, amountMinor: '30', currencyCode: 'USD' });
    check((await db.savingsGoals.get('sg-exact')).currentAmountMinor === '40',
      'Editing a contribution atomically applies the exact minor-unit difference to its goal');
    await StorageService.savings.deleteContribution(exactContribution.id);
    check((await db.savingsGoals.get('sg-exact')).currentAmountMinor === '10' && await db.savingsContributions.where('goalId').equals('sg-exact').count() === 0,
      'Deleting a contribution atomically reconciles goal progress without changing transactions');

    console.log(`\nDATABASE ATOMICITY TESTS: ${passed} legacy-internal assertions PASSED`);
  } finally {
    await db.delete();
  }
}

main().catch(error => {
  console.error('DATABASE ATOMICITY TEST FAILED:', error);
  process.exitCode = 1;
});
