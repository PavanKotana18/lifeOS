require('fake-indexeddb/auto');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const assert = require('assert');

async function main() {
  const RealDate = Date;
  const fixedNow = RealDate.parse('2024-01-01T12:00:00.000Z');
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(fixedNow);
    }
    static now() { return fixedNow; }
    static parse(value) { return RealDate.parse(value); }
    static UTC(...args) { return RealDate.UTC(...args); }
  };

  const source = fs.readFileSync(path.join(__dirname, 'src/db.ts'), 'utf8') + '\n\n// Test-only access to the raw Dexie instance.\nexport { db };\n';
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const loaded = new Module(path.join(__dirname, 'src/db.recurrence.cjs'), module);
  loaded.filename = path.join(__dirname, 'src/db.recurrence.cjs');
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
    parent.filename.endsWith('/src/db.recurrence.cjs')
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

  const { db, StorageService, sessionManager, getNextRecurringTaskDate, getRecurrenceRootId } = loaded.exports;
  sessionManager.unlock();
  await db.open();
  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };
  const add = (id, dueDate, recurring) => db.tasks.add({
    id, title: id, dueDate, priority: 'Medium',
    recurring, completed: false, createdAt: '2026-11-01T00:00:00.000Z'
  });

  try {
    await add('daily', '2026-11-01', 'Daily');
    await StorageService.tasks.toggleCompleted('daily', true);
    check(
      (await db.tasks.get('rec_daily_2026-11-02'))?.dueDate === '2026-11-02',
      'Daily recurrence creates the next day occurrence'
    );

    const reminderAt = '2026-11-02T08:00:00.000Z';
    await db.tasks.add({
      id: 'reminder-source',
      title: 'Reminder recurrence',
      dueDate: '2026-11-02',
      dueTime: '09:00',
      reminderAt,
      priority: 'Medium',
      recurring: 'Daily',
      completed: false,
      createdAt: '2026-11-01T00:00:00.000Z'
    });

    await StorageService.tasks.toggleCompleted('reminder-source', true);
    const firstReminderOccurrence =
      await db.tasks.get('rec_reminder-source_2026-11-03');

    check(
      firstReminderOccurrence?.reminderAt === reminderAt,
      'Recurring occurrence preserves the original reminder timestamp'
    );

    await StorageService.tasks.toggleCompleted(
      'rec_reminder-source_2026-11-03', true
    );

    const secondReminderOccurrence =
      await db.tasks.get('rec_reminder-source_2026-11-04');

    check(
      secondReminderOccurrence?.reminderAt === reminderAt &&
      secondReminderOccurrence?.recurrenceRootId === 'reminder-source',
      'Second recurrence keeps the stable root ID and reminder timestamp'
    );

    await add('parallel', '2026-11-03', 'Daily');
    await Promise.all([
      StorageService.tasks.toggleCompleted('parallel', true),
      StorageService.tasks.toggleCompleted('parallel', true),
      StorageService.tasks.toggleCompleted('parallel', true)
    ]);
    check(
      await db.tasks.where('id').equals('rec_parallel_2026-11-04').count() === 1,
      'Concurrent completion creates exactly one occurrence'
    );

    await StorageService.tasks.toggleCompleted('parallel', false);
    await StorageService.tasks.toggleCompleted('parallel', true);
    check(
      await db.tasks.where('id').equals('rec_parallel_2026-11-04').count() === 1,
      'Uncomplete and re-complete does not duplicate the occurrence'
    );

    await add('month-end', '2027-01-31', 'Monthly');
    await StorageService.tasks.toggleCompleted('month-end', true);
    check(
      (await db.tasks.get('rec_month-end_2027-02-28'))?.dueDate === '2027-02-28',
      'Monthly recurrence clamps January 31 to February 28'
    );

    await add('weekly', '2026-11-01', 'Weekly');
    await StorageService.tasks.toggleCompleted('weekly', true);
    check(
      Boolean(await db.tasks.get('rec_weekly_2026-11-08')),
      'Weekly recurrence advances seven calendar days'
    );

    await add('failure', '2026-11-10', 'Daily');
    const failCreate = (_key, obj) => {
      if (obj?.id === 'rec_failure_2026-11-11') throw new Error('Injected insert failure');
    };
    db.tasks.hook('creating').subscribe(failCreate);
    try {
      await assert.rejects(StorageService.tasks.toggleCompleted('failure', true));
    } finally {
      db.tasks.hook('creating').unsubscribe(failCreate);
    }
    check(
      (await db.tasks.get('failure')).completed === false &&
      !(await db.tasks.get('rec_failure_2026-11-11')),
      'Failed occurrence creation rolls back original completion'
    );

    await add('once', '2026-11-12', 'None');
    const count = await db.tasks.count();
    await StorageService.tasks.toggleCompleted('once', true);
    check(
      (await db.tasks.get('once')).completed &&
      await db.tasks.count() === count,
      'Non-recurring task completes without creating another task'
    );

    check(
      getNextRecurringTaskDate('2026-10-20', 'Daily', '2026-11-02') === '2026-11-03',
      'Overdue daily recurrence advances to the next future day'
    );
    check(
      getNextRecurringTaskDate('2026-10-20', 'Weekly', '2026-11-02') === '2026-11-03',
      'Overdue weekly recurrence preserves its weekly schedule'
    );
    check(
      getNextRecurringTaskDate('2026-10-20', 'Monthly', '2026-11-02') === '2026-11-20',
      'Overdue monthly recurrence advances to the next scheduled month date'
    );
    check(
      getRecurrenceRootId({ id: 'rec_rec_source_2026-11-03_2026-11-04' }) === 'source',
      'Legacy nested recurrence IDs resolve to their original root'
    );

    await add('undo-source', '2026-11-05', 'Daily');
    await StorageService.tasks.toggleCompleted('undo-source', true);
    const undoChildId = 'rec_undo-source_2026-11-06';
    await StorageService.tasks.toggleCompleted('undo-source', false);
    check(
      !(await db.tasks.get(undoChildId)) &&
      (await db.tasks.get('undo-source'))?.completed === false &&
      !(await db.tasks.get('undo-source'))?.spawnedTaskId,
      'Undo removes an untouched generated child and clears its parent reference'
    );

    console.log(`RECURRENCE TESTS: ${passed}/14 PASSED`);
  } finally {
    await db.delete();
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
