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

  const {
    db,
    StorageService: ProtectedStorageService,
    legacyStorageService: RawStorageService,
    sessionManager
  } = loaded.exports;
  await db.open();

  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };

  // This loader deliberately has no native key and no encrypted runtime. These
  // assertions verify that the production facade remains closed in that state.
  console.log('========== ENCRYPTED ADMISSION GUARD TESTS ==========');
  await assert.rejects(
    ProtectedStorageService.categories.getAll(),
    /Encrypted storage is not ready/
  );
  check(!sessionManager.isUnlocked(), 'Unprovisioned private read stays blocked and relocks the JS session');

  await assert.rejects(
    ProtectedStorageService.settings.set('currency', 'USD'),
    /Encrypted storage is not ready/
  );
  assert.strictEqual(await db.settings.get('currency'), undefined);
  check(!sessionManager.isUnlocked(), 'Unprovisioned private write is blocked without changing settings');

  await assert.rejects(
    ProtectedStorageService.backup.exportData(),
    /Encrypted storage is not ready/
  );
  check(!sessionManager.isUnlocked(), 'Unprovisioned backup export is blocked');

  await ProtectedStorageService.settings.set('theme', 'system');
  check(
    await ProtectedStorageService.settings.get('theme', 'dark') === 'system',
    'Allowlisted bootstrap theme remains available while private storage is closed'
  );

  sessionManager.unlock();
  await assert.rejects(
    ProtectedStorageService.categories.getAll(),
    /Encrypted storage is not ready/
  );
  check(!sessionManager.isUnlocked(), 'JS session unlock alone cannot bypass missing secure provisioning');

  // The remaining assertions intentionally test raw Dexie domain transactions.
  // Production-facade behavior under a valid synthetic encrypted session is
  // covered separately by test_encrypted_atomicity.js.
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
      await assert.rejects(RawStorageService.savings.addContribution({
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
      RawStorageService.savings.addContribution({
        goalId: 'sg-atomic', amount: 0, date: '2026-11-01'
      })
    );
    await assert.rejects(
      RawStorageService.savings.addContribution({
        goalId: 'missing-goal', amount: 100, date: '2026-11-01'
      })
    );

    check(
      (await db.savingsGoals.get('sg-atomic')).currentAmount === 1000 &&
      await db.savingsContributions.count() === 0,
      'Invalid amounts and missing goals create no financial records'
    );

    // 3. A linked savings transfer must create a cash-flow expense atomically.
    await db.categories.add({
      id: 'cat-savings-transfer-test',
      name: 'Savings Transfer Test',
      type: 'expense',
      color: '#10b981'
    });

    await RawStorageService.savings.addContribution(
      { goalId: 'sg-atomic', amount: 250, date: '2026-11-01', notes: 'Atomic linked transfer test' },
      {
        type: 'expense',
        amount: 250,
        category: 'Savings Transfer Test',
        description: 'Savings contribution: Emergency fund',
        date: '2026-11-01',
        paymentMethod: 'Savings transfer',
        notes: 'Atomic linked transfer test'
      }
    );

    const linkedTransaction = (await db.transactions.toArray())
      .find(tx => tx.description === 'Savings contribution: Emergency fund');

    check(
      (await db.savingsGoals.get('sg-atomic')).currentAmount === 1250 &&
      await db.savingsContributions.where('goalId').equals('sg-atomic').count() === 1 &&
      Boolean(linkedTransaction) &&
      linkedTransaction.type === 'expense' &&
      linkedTransaction.amount === 250,
      'Linked savings contribution updates the goal and creates a matching expense'
    );

    // A linked expense failure must roll back both savings records.
    const linkedExpenseFailure = () => { throw new Error('Injected linked transaction failure'); };
    db.transactions.hook('creating').subscribe(linkedExpenseFailure);

    try {
      await assert.rejects(RawStorageService.savings.addContribution(
        { goalId: 'sg-atomic', amount: 300, date: '2026-11-01' },
        {
          type: 'expense',
          amount: 300,
          category: 'Savings Transfer Test',
          description: 'Savings contribution: Emergency fund rollback',
          date: '2026-11-01',
          paymentMethod: 'Savings transfer'
        }
      ));
    } finally {
      db.transactions.hook('creating').unsubscribe(linkedExpenseFailure);
    }

    check(
      (await db.savingsGoals.get('sg-atomic')).currentAmount === 1250 &&
      await db.savingsContributions.where('goalId').equals('sg-atomic').count() === 1 &&
      !(await db.transactions.toArray()).some(tx => tx.description === 'Savings contribution: Emergency fund rollback'),
      'Linked expense failure rolls back the contribution and goal balance'
    );

    await RawStorageService.transactions.delete(linkedTransaction.id);
    await db.categories.delete('cat-savings-transfer-test');

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
      await assert.rejects(RawStorageService.habits.delete('habit-atomic'));
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
      await assert.rejects(RawStorageService.goals.delete('goal-atomic'));
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
      await assert.rejects(RawStorageService.savings.deleteGoal('sg-atomic'));
    } finally {
      db.savingsContributions.hook('deleting').unsubscribe(savingsDeleteFailure);
    }

    check(
      Boolean(await db.savingsGoals.get('sg-atomic')) &&
      Boolean(await db.savingsContributions.get('contribution-atomic')),
      'Savings-goal deletion rolls back when contribution deletion fails'
    );


    // Valid calendar dates must be accepted by the raw database service.
    await RawStorageService.habits.logCompletion('habit-atomic', '2026-11-02', true);
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
      RawStorageService.habits.logCompletion('habit-log-race', '2026-11-02', true),
      RawStorageService.habits.logCompletion('habit-log-race', '2026-11-02', true)
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
      RawStorageService.habits.logCompletion('habit-log-race', '2026-02-30', true)
    );
    await assert.rejects(
      RawStorageService.habits.logCompletion('missing-habit', '2026-11-02', true)
    );
    await assert.rejects(
      RawStorageService.habits.logCompletion('habit-log-race', '02-11-2026', true)
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
        RawStorageService.habits.logCompletion('habit-log-rollback', '2026-11-03', true)
      );
    } finally {
      db.habitLogs.hook('creating').unsubscribe(logInsertFailure);
    }

    check(
      await db.habitLogs.where('habitId').equals('habit-log-rollback').count() === 0,
      'Failed habit-log insertion leaves no partial record'
    );

    // 9. Repeated completion toggles update the same record.
    await RawStorageService.habits.logCompletion('habit-log-race', '2026-11-02', false);
    await RawStorageService.habits.logCompletion('habit-log-race', '2026-11-02', true);

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
        RawStorageService.habits.add({ name: 'Rapid habit A', frequency: 'daily', color: '#123456' }),
        RawStorageService.habits.add({ name: 'Rapid habit B', frequency: 'daily', color: '#654321' })
      ]);
      check(
        habits[0].id !== habits[1].id &&
        await db.habits.where('id').anyOf(habits.map(item => item.id)).count() === 2,
        'Rapid habit creation generates distinct IDs within one millisecond'
      );

      const savingsGoals = await Promise.all([
        RawStorageService.savings.addGoal({ title: 'Rapid savings A', targetAmount: 1000, currentAmount: 0, targetDate: '2027-01-01' }),
        RawStorageService.savings.addGoal({ title: 'Rapid savings B', targetAmount: 2000, currentAmount: 0, targetDate: '2027-02-01' })
      ]);
      check(
        savingsGoals[0].id !== savingsGoals[1].id &&
        await db.savingsGoals.where('id').anyOf(savingsGoals.map(item => item.id)).count() === 2,
        'Rapid savings-goal creation preserves both records'
      );

      const goals = await Promise.all([
        RawStorageService.goals.add({ title: 'Rapid goal A', category: 'Education', targetValue: 10, currentValue: 0, startDate: '2026-11-01', targetDate: '2027-01-01', priority: 'Medium', status: 'In Progress' }),
        RawStorageService.goals.add({ title: 'Rapid goal B', category: 'Education', targetValue: 20, currentValue: 0, startDate: '2026-11-01', targetDate: '2027-02-01', priority: 'Medium', status: 'In Progress' })
      ]);
      check(goals[0].id !== goals[1].id, 'Rapid goal creation generates distinct IDs');

      const milestones = await Promise.all([
        RawStorageService.goals.addMilestone({ goalId: goals[0].id, title: 'Rapid milestone A', completed: false }),
        RawStorageService.goals.addMilestone({ goalId: goals[0].id, title: 'Rapid milestone B', completed: false })
      ]);
      check(milestones[0].id !== milestones[1].id, 'Rapid milestone creation generates distinct IDs');

      // F12: Goal closure requires 100% numeric progress and all milestones.
      const closureGoal = await RawStorageService.goals.add({
        title: 'F12 all milestones', category: 'Education',
        targetValue: 10, currentValue: 10,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'In Progress'
      });
      const closureMilestones = await Promise.all([
        RawStorageService.goals.addMilestone({ goalId: closureGoal.id, title: 'Step A', completed: false }),
        RawStorageService.goals.addMilestone({ goalId: closureGoal.id, title: 'Step B', completed: false })
      ]);
      await RawStorageService.goals.toggleMilestone(closureMilestones[0].id, true);
      check(
        (await db.goals.get(closureGoal.id)).status === 'In Progress',
        'F12: one incomplete milestone prevents goal closure'
      );
      await RawStorageService.goals.toggleMilestone(closureMilestones[1].id, true);
      check(
        (await db.goals.get(closureGoal.id)).status === 'Completed',
        'F12 RUNTIME: final milestone closes a fully funded goal'
      );

      const numericGoal = await RawStorageService.goals.add({
        title: 'F12 numeric threshold', category: 'Education',
        targetValue: 10, currentValue: 9,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'In Progress'
      });
      const numericMilestone = await RawStorageService.goals.addMilestone({
        goalId: numericGoal.id, title: 'Complete step', completed: false
      });
      await RawStorageService.goals.toggleMilestone(numericMilestone.id, true);
      check(
        (await db.goals.get(numericGoal.id)).status === 'In Progress',
        'F12: completed milestones cannot compensate for numeric progress below 100%'
      );
      await RawStorageService.goals.update(numericGoal.id, { currentValue: 10 });
      check(
        (await db.goals.get(numericGoal.id)).status === 'Completed',
        'F12: reaching the numeric target closes a goal with all milestones complete'
      );

      const pausedGoal = await RawStorageService.goals.add({
        title: 'F12 paused goal', category: 'Education',
        targetValue: 10, currentValue: 10,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'Paused'
      });
      const pausedMilestone = await RawStorageService.goals.addMilestone({
        goalId: pausedGoal.id, title: 'Paused step', completed: false
      });
      await RawStorageService.goals.toggleMilestone(pausedMilestone.id, true);
      await RawStorageService.goals.update(pausedGoal.id, { currentValue: 10 });
      check(
        (await db.goals.get(pausedGoal.id)).status === 'Paused',
        'F12: progress and milestone updates preserve Paused status'
      );

      const reopenGoal = await RawStorageService.goals.add({
        title: 'F12 reopen goal', category: 'Education',
        targetValue: 10, currentValue: 10,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'In Progress'
      });
      const reopenMilestone = await RawStorageService.goals.addMilestone({
        goalId: reopenGoal.id, title: 'Reopen step', completed: true
      });
      await RawStorageService.goals.update(reopenGoal.id, { currentValue: 10 });
      await RawStorageService.goals.toggleMilestone(reopenMilestone.id, false);
      check(
        (await db.goals.get(reopenGoal.id)).status === 'In Progress',
        'F12: reopening a milestone reopens a completed goal'
      );

      const zeroTargetGoal = await RawStorageService.goals.add({
        title: 'F12 zero target', category: 'Education',
        targetValue: 0, currentValue: 0,
        startDate: '2026-11-01', targetDate: '2027-01-01',
        priority: 'High', status: 'In Progress'
      });
      await RawStorageService.goals.update(zeroTargetGoal.id, { currentValue: 0 });
      check(
        (await db.goals.get(zeroTargetGoal.id)).status === 'In Progress',
        'F12: zero target cannot qualify a goal for 100% closure'
      );


      const budgets = await Promise.all([
        RawStorageService.budgets.upsert({ monthYear: '2026-11', monthlyAmount: 100 }),
        RawStorageService.budgets.upsert({ monthYear: '2026-11', monthlyAmount: 200 })
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
    // Seed categories through the normal first-run path before referencing Food.
    // This test's category-table reset/seed concurrency check runs later below.
    const transactionCategories = await RawStorageService.categories.getAll();
    check(
      transactionCategories.some(category =>
        category.id === 'cat_food' && category.name === 'Food' && category.type === 'expense'
      ),
      'Transaction validation fixture initializes the normal Food category'
    );

    await assert.rejects(RawStorageService.transactions.add({
      amount: 0, date: '2026-11-01', category: 'Food',
      description: 'Invalid amount', paymentMethod: 'Cash', type: 'expense'
    }));
    await assert.rejects(RawStorageService.transactions.add({
      amount: 100, date: '2026-02-30', category: 'Food',
      description: 'Invalid date', paymentMethod: 'Cash', type: 'expense'
    }));
    const validTransaction = await RawStorageService.transactions.add({
      amount: 100, date: '2026-11-01', category: 'Food',
      description: 'Storage validation', paymentMethod: 'Cash', type: 'expense'
    });
    await assert.rejects(RawStorageService.transactions.update(validTransaction.id, { amount: -1 }));
    await assert.rejects(RawStorageService.transactions.update(validTransaction.id, { date: '2026-02-30' }));
    await RawStorageService.transactions.update(validTransaction.id, {
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
    await RawStorageService.habits.update('habit-identity', {
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
    await RawStorageService.goals.update('goal-identity', {
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
    await RawStorageService.tasks.update('task-identity', {
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
      RawStorageService.categories.getAll(),
      RawStorageService.categories.getAll(),
      RawStorageService.categories.getAll(),
      RawStorageService.categories.getAll()
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
    const protectedCategory = await RawStorageService.categories.add({
      name: 'Protected budget category',
      type: 'expense',
      color: '#123456'
    });

    await RawStorageService.budgets.upsert({
      monthYear: '2099-01',
      categoryId: protectedCategory.id,
      monthlyAmount: 500
    });

    const historicalTransaction = await RawStorageService.transactions.add({
      amount: 75,
      date: '2026-11-01',
      category: protectedCategory.name,
      description: 'Historical category reference',
      paymentMethod: 'Cash',
      type: 'expense'
    });

    await assert.rejects(
      RawStorageService.categories.delete(protectedCategory.id),
      /linked to one or more budgets/i
    );

    check(
      Boolean(await db.categories.get(protectedCategory.id)) &&
      await db.budgets.where('categoryId').equals(protectedCategory.id).count() === 1,
      'Category deletion is blocked while a budget references it'
    );

    await db.budgets.where('categoryId').equals(protectedCategory.id).delete();

    await assert.rejects(
      RawStorageService.categories.delete(protectedCategory.id),
      /used by existing transactions/i
    );

    check(
      Boolean(await db.categories.get(protectedCategory.id)) &&
      Boolean(await db.transactions.get(historicalTransaction.id)),
      'Category deletion is blocked while a transaction references it'
    );

    await RawStorageService.transactions.delete(historicalTransaction.id);
    await RawStorageService.categories.delete(protectedCategory.id);

    check(
      !(await db.categories.get(protectedCategory.id)) &&
      !(await db.transactions.get(historicalTransaction.id)),
      'Category can be deleted after its budget and transaction references are removed'
    );

    console.log(`\nDATABASE ATOMICITY TESTS: ${passed} assertions PASSED (raw database fixture; encrypted facade covered separately)`);
  } finally {
    await db.delete();
  }
}

main().catch(error => {
  console.error('DATABASE ATOMICITY TEST FAILED:', error);
  process.exitCode = 1;
});
