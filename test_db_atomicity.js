require('fake-indexeddb/auto');

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const assert = require('assert');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, 'src/db.ts'), 'utf8');
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
  loaded._compile(compiled, loaded.filename);

  const { db, StorageService } = loaded.exports;
  await db.open();

  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };

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

    // 3. Habit deletion must roll back if dependent-log deletion fails.
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

    console.log(`\nDATABASE ATOMICITY TESTS: ${passed}/10 PASSED`);
  } finally {
    await db.delete();
  }
}

main().catch(error => {
  console.error('DATABASE ATOMICITY TEST FAILED:', error);
  process.exitCode = 1;
});
