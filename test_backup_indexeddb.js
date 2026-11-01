
require('fake-indexeddb/auto');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const assert = require('assert');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, 'src/db.ts'), 'utf8') + '\n\n// Test-only access to the raw Dexie instance.\nexport { db };\n';
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const loaded = new Module(path.join(__dirname, 'src/db.integration.cjs'), module);
  loaded.filename = path.join(__dirname, 'src/db.integration.cjs');
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

  const stamp = '2026-10-31T10:00:00.000Z';

  await db.transactions.add({
    id: 'keep-tx', type: 'expense', amount: 250,
    category: 'Food', description: 'Existing record',
    date: '2026-10-31', paymentMethod: 'UPI', createdAt: stamp
  });
  await db.categories.add({
    id: 'keep-cat', name: 'Existing category',
    type: 'expense', color: '#fff'
  });
  await db.tasks.add({
    id: 'keep-task', title: 'Existing task', dueDate: '2026-11-01',
    priority: 'Medium', recurring: 'None',
    completed: false, createdAt: stamp
  });

  const before = {
    transactions: await db.transactions.toArray(),
    categories: await db.categories.toArray(),
    tasks: await db.tasks.toArray()
  };

  // Invalid backup must be rejected before any live table is changed.
  const invalid = JSON.parse(await StorageService.backup.exportData());
  invalid.tables.habits = 'not-an-array';

  await assert.rejects(
    StorageService.backup.importData(JSON.stringify(invalid), { replaceExisting: true }),
    /habits must be an array/
  );

  assert.deepStrictEqual(await db.transactions.toArray(), before.transactions);
  assert.deepStrictEqual(await db.categories.toArray(), before.categories);
  assert.deepStrictEqual(await db.tasks.toArray(), before.tasks);
  console.log('PASS: Invalid backup leaves existing IndexedDB records unchanged');

  // Force a failure late in the restore, after earlier tables have been cleared/written.
  const validBackup = await StorageService.backup.exportData();
  const originalBulkPut = db.tasks.bulkPut;

  db.tasks.bulkPut = async function () {
    throw new Error('Intentional rollback test failure');
  };

  try {
    await assert.rejects(
      StorageService.backup.importData(validBackup, { replaceExisting: true }),
      /Intentional rollback test failure/
    );
  } finally {
    db.tasks.bulkPut = originalBulkPut;
  }

  assert.deepStrictEqual(await db.transactions.toArray(), before.transactions);
  assert.deepStrictEqual(await db.categories.toArray(), before.categories);
  assert.deepStrictEqual(await db.tasks.toArray(), before.tasks);

  console.log('PASS: Failed restore rolls back earlier table changes');
  console.log('PASS: Existing transaction, category and task records preserved');


  // Export must execute inside a single readonly Dexie transaction.
  const originalTransaction = db.transaction.bind(db);
  let exportUsedReadonlyTransaction = false;
  db.transaction = function (mode, ...args) {
    if (mode === 'r') exportUsedReadonlyTransaction = true;
    return originalTransaction(mode, ...args);
  };
  const exported = JSON.parse(await StorageService.backup.exportData());
  db.transaction = originalTransaction;
  assert.strictEqual(exportUsedReadonlyTransaction, true);
  assert.strictEqual(exported.app, 'LifeOS');
  assert.strictEqual(exported.tables.transactions.length, await db.transactions.count());
  assert.strictEqual(exported.tables.settings.length, await db.settings.count());
  console.log('PASS: Backup export reads all tables inside a readonly transaction');

  // A failure during clearAll must roll back earlier table clears.
  await db.transactions.put({
    id: 'clear-rollback-tx', type: 'expense', amount: 99,
    category: 'Food', description: 'Must survive failed clear',
    date: '2026-10-31', paymentMethod: 'UPI', createdAt: stamp
  });
  await db.tasks.put({
    id: 'clear-rollback-task', title: 'Must survive failed clear',
    dueDate: '2026-10-31', priority: 'Medium', category: 'Test',
    recurring: 'None', completed: false
  });
  const originalTasksClear = db.tasks.clear;
  db.tasks.clear = async function () {
    throw new Error('Intentional clearAll rollback test failure');
  };
  await assert.rejects(
    StorageService.backup.clearAll(),
    /Intentional clearAll rollback test failure/
  );
  db.tasks.clear = originalTasksClear;
  assert.ok(await db.transactions.get('clear-rollback-tx'));
  assert.ok(await db.tasks.get('clear-rollback-task'));
  console.log('PASS: Failed clearAll rolls back earlier table clears');

  await db.delete();
  console.log('\nREAL DEXIE / INDEXEDDB BACKUP TESTS: 5/5 PASSED');
}

main().catch(error => {
  console.error('INDEXEDDB INTEGRATION TEST FAILED:', error);
  process.exitCode = 1;
});
