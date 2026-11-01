
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

  const loaded = new Module(path.join(__dirname, 'src/db.integration.cjs'), module);
  loaded.filename = path.join(__dirname, 'src/db.integration.cjs');
  loaded.paths = module.paths;
  loaded._compile(compiled, loaded.filename);

  const { db, StorageService } = loaded.exports;
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

  await db.delete();
  console.log('\nREAL DEXIE / INDEXEDDB ROLLBACK TESTS: 3/3 PASSED');
}

main().catch(error => {
  console.error('INDEXEDDB INTEGRATION TEST FAILED:', error);
  process.exitCode = 1;
});
