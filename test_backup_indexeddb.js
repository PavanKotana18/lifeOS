
// This fixture covers legacy raw-database restore atomicity only. Production
// access admission is tested separately and must remain fail-closed.
require('fake-indexeddb/auto');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const assert = require('assert');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, 'src/db.ts'), 'utf8') + '\n\n// Test-only access to raw legacy storage internals.\nexport { db, rawStorageService as legacyStorageService };\n';
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
  const financeSource = fs.readFileSync(path.join(__dirname, 'src/services/financeCore.ts'), 'utf8');
  const financeCompiled = ts.transpileModule(financeSource, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true
  } }).outputText;
  const financeLoaded = new Module(path.join(__dirname, 'src/services/financeCore.integration.cjs'), module);
  financeLoaded.filename = path.join(__dirname, 'src/services/financeCore.integration.cjs');
  financeLoaded.paths = module.paths;
  financeLoaded._compile(financeCompiled, financeLoaded.filename);
  const accountingSource = fs.readFileSync(path.join(__dirname, 'src/services/financialAccounting.ts'), 'utf8');
  const accountingCompiled = ts.transpileModule(accountingSource, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true
  } }).outputText;
  const accountingLoaded = new Module(path.join(__dirname, 'src/services/financialAccounting.integration.cjs'), module);
  accountingLoaded.filename = path.join(__dirname, 'src/services/financialAccounting.integration.cjs');
  accountingLoaded.paths = module.paths;
  const accountingRequire = accountingLoaded.require.bind(accountingLoaded);
  accountingLoaded.require = request => request === './financeCore' ? financeLoaded.exports : accountingRequire(request);
  accountingLoaded._compile(accountingCompiled, accountingLoaded.filename);
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
    parent.filename.endsWith('/src/db.integration.cjs')
  ) {
    if (request === './services/financeCore') return financeLoaded.exports;
    if (request === './services/financialAccounting') return accountingLoaded.exports;
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
    recurring: 'None', completed: false, createdAt: stamp
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

  // New encrypted-domain data must travel through the existing backup envelope.
  await db.financialAccounts.put({ id: 'backup-cash', name: 'Cash', type: 'cash', currencyCode: 'USD', openingBalanceMinor: '25000', isActive: true, createdAt: stamp });
  await db.accountTransfers.put({ id: 'backup-transfer', fromAccountId: 'backup-cash', toAccountId: 'backup-bank', fromAmountMinor: '1000', toAmountMinor: '1000', fromCurrencyCode: 'USD', toCurrencyCode: 'USD', date: '2026-10-31', createdAt: stamp });
  await db.accountTransfers.put({ id: 'backup-reversal', fromAccountId: 'backup-bank', toAccountId: 'backup-cash', fromAmountMinor: '1000', toAmountMinor: '1000', fromCurrencyCode: 'USD', toCurrencyCode: 'USD', reversalOfId: 'backup-transfer', date: '2026-11-01', createdAt: stamp });
  await db.financialAccounts.put({ id: 'backup-bank', name: 'Bank', type: 'bank', currencyCode: 'USD', openingBalanceMinor: '0', isActive: true, createdAt: stamp });
  await db.manualExchangeRates.put({ id: 'backup-rate', baseCurrencyCode: 'USD', quoteCurrencyCode: 'INR', rate: '83.25', effectiveDate: '2026-10-31', createdAt: stamp });
  await db.plannedCommitments.put({ id: 'backup-rent', title: 'Rent', amount: 20, amountMinor: '2000', currencyCode: 'USD', frequency: 'monthly', nextDueDate: '2026-11-01', status: 'active', createdAt: stamp });
  const financeBackup = await StorageService.backup.exportData();
  await StorageService.backup.clearAll();
  await StorageService.backup.importData(financeBackup, { replaceExisting: true });
  assert.strictEqual((await db.accountTransfers.get('backup-transfer')).toAccountId, 'backup-bank');
  assert.strictEqual((await db.accountTransfers.get('backup-reversal')).reversalOfId, 'backup-transfer');
  assert.strictEqual((await db.financialAccounts.get('backup-cash')).openingBalanceMinor, '25000');
  assert.strictEqual((await db.manualExchangeRates.get('backup-rate')).rate, '83.25');
  assert.strictEqual((await db.plannedCommitments.get('backup-rent')).status, 'active');
  console.log('PASS: Account, transfer, manual-rate and commitment records survive backup restore with links intact');

  await db.delete();
  console.log('\nREAL DEXIE / INDEXEDDB BACKUP TESTS: 6/6 PASSED');
}

main().catch(error => {
  console.error('INDEXEDDB INTEGRATION TEST FAILED:', error);
  process.exitCode = 1;
});
