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

  const loaded = new Module(path.join(__dirname, 'src/db.recurrence-edges.cjs'), module);
  loaded.filename = path.join(__dirname, 'src/db.recurrence-edges.cjs');
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
    parent.filename.endsWith('/src/db.recurrence-edges.cjs')
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

  const { db, StorageService, sessionManager } = loaded.exports;
  sessionManager.unlock();
  await db.open();

  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };

  const add = (id, dueDate, recurring = 'Monthly') =>
    db.tasks.add({
      id, title: id, dueDate, priority: 'Medium',
      recurring, completed: false,
      createdAt: '2026-11-01T00:00:00.000Z'
    });

  try {
    await add('leap-jan31', '2024-01-31');
    await StorageService.tasks.toggleCompleted('leap-jan31', true);
    check(
      (await db.tasks.get('rec_leap-jan31_2024-02-29'))?.dueDate === '2024-02-29',
      'January 31 advances to February 29 in a leap year'
    );

    await add('leap-feb29', '2024-02-29');
    await StorageService.tasks.toggleCompleted('leap-feb29', true);
    check(
      (await db.tasks.get('rec_leap-feb29_2024-03-29'))?.dueDate === '2024-03-29',
      'February 29 advances to March 29 without date overflow'
    );

    await add('year-rollover', '2026-12-31');
    await StorageService.tasks.toggleCompleted('year-rollover', true);
    check(
      (await db.tasks.get('rec_year-rollover_2027-01-31'))?.dueDate === '2027-01-31',
      'December 31 advances correctly across the year boundary'
    );

    await add('day-30', '2027-04-30');
    await StorageService.tasks.toggleCompleted('day-30', true);
    check(
      (await db.tasks.get('rec_day-30_2027-05-30'))?.dueDate === '2027-05-30',
      'A 30th-of-month recurrence remains on the 30th when possible'
    );

    await add('day-31', '2027-05-31');
    await StorageService.tasks.toggleCompleted('day-31', true);
    check(
      (await db.tasks.get('rec_day-31_2027-06-30'))?.dueDate === '2027-06-30',
      'May 31 clamps to June 30'
    );

    await add('edit-source', '2027-01-15');
    await StorageService.tasks.toggleCompleted('edit-source', true);
    const generatedId = 'rec_edit-source_2027-02-15';
    await StorageService.tasks.update(generatedId, {
      title: 'Edited generated occurrence',
      dueDate: '2027-02-16'
    });
    const edited = await db.tasks.get(generatedId);
    const original = await db.tasks.get('edit-source');
    check(
      edited?.title === 'Edited generated occurrence' &&
      edited?.dueDate === '2027-02-16' &&
      original?.title === 'edit-source' &&
      original?.dueDate === '2027-01-15',
      'Editing a generated occurrence does not modify its source task'
    );

    await add('delete-source', '2027-03-10');
    await StorageService.tasks.toggleCompleted('delete-source', true);
    const deleteId = 'rec_delete-source_2027-04-10';
    await StorageService.tasks.delete(deleteId);
    check(
      !(await db.tasks.get(deleteId)) &&
      (await db.tasks.get('delete-source'))?.completed === true,
      'Deleting a generated occurrence preserves its completed source task'
    );

    await add('restart-source', '2027-06-01', 'Daily');
    await StorageService.tasks.toggleCompleted('restart-source', true);
    const restartOccurrence = 'rec_restart-source_2027-06-02';
    db.close();
    await db.open();
    await StorageService.tasks.toggleCompleted('restart-source', true);
    check(
      (await db.tasks.get('restart-source'))?.completed === true &&
      await db.tasks.where('id').equals(restartOccurrence).count() === 1,
      'Repeated completion after database reopen does not duplicate the occurrence'
    );

    await add('undo-edited-source', '2027-07-01', 'Daily');
    await StorageService.tasks.toggleCompleted('undo-edited-source', true);
    const editedChildId = 'rec_undo-edited-source_2027-07-02';
    await StorageService.tasks.update(editedChildId, {
      title: 'Keep this edited occurrence'
    });
    await StorageService.tasks.toggleCompleted('undo-edited-source', false);
    const retainedChild = await db.tasks.get(editedChildId);
    check(
      retainedChild?.title === 'Keep this edited occurrence' &&
      Boolean(retainedChild?.updatedAt) &&
      (await db.tasks.get('undo-edited-source'))?.completed === false,
      'Undo preserves an edited generated child'
    );

    console.log(`RECURRENCE EDGE TESTS: ${passed}/9 PASSED`);
  } finally {
    db.close();
    await db.delete();
  }
}

main().catch(error => {
  console.error('RECURRENCE EDGE TESTS FAILED:', error);
  process.exitCode = 1;
});
