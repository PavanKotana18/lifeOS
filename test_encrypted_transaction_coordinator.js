require('fake-indexeddb/auto');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const Dexie = require('dexie');
const ts = require('typescript');

const ROOT = path.join(__dirname, 'src/services');

function loadTs(file, overrides = {}, cache = new Map()) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename);

  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const loaded = new Module(filename + '.test.cjs', module);
  loaded.filename = filename + '.test.cjs';
  loaded.paths = module.paths;
  cache.set(filename, loaded.exports);

  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (Object.prototype.hasOwnProperty.call(overrides, id)) {
      return overrides[id];
    }
    if (id.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), id) + '.ts';
      if (fs.existsSync(target)) return loadTs(target, overrides, cache);
    }
    return originalRequire(id);
  };

  loaded._compile(compiled, loaded.filename);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}

const cryptoMock = {
  async encryptRecord(table, id, version, plaintext) {
    return {
      iv: Buffer.from('0123456789ab').toString('base64'),
      ciphertext: Buffer.from(plaintext, 'utf8').toString('base64'),
      keyVersion: 1
    };
  },
  async decryptRecord(table, id, version, encrypted) {
    return Buffer.from(encrypted.ciphertext, 'base64').toString('utf8');
  }
};

const tables = [
  'transactions', 'categories', 'budgets', 'savingsGoals',
  'savingsContributions', 'habits', 'habitLogs', 'goals',
  'milestones', 'tasks', 'settings'
];

async function fixture() {
  const db = new Dexie(`LifeOS_Atomic_Test_${Date.now()}_${Math.random()}`);
  const schema = {};
  for (const name of tables) {
    schema[name] = name === 'settings' ? 'key' : 'id';
  }
  db.version(1).stores(schema);
  await db.open();

  const integration = loadTs(
    path.join(ROOT, 'encryptedStorageIntegration.ts'),
    { './cryptoService.ts': { CryptoService: cryptoMock } }
  );

  const repositories = integration.createLifeOSEncryptedRepositories(db);
  const coordinator =
    integration.createLifeOSEncryptedTransactionCoordinator(db, repositories);

  return { db, repositories, coordinator };
}

async function main() {
  let passed = 0;

  function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log('PASS:', message);
  }

  const f = await fixture();

  // 1. Commit writes across two tables and verify ciphertext storage.
  await f.coordinator.run(async tx => {
    tx.put('transactions', {
      id: 'tx-1',
      description: 'initial',
      amount: 100
    });
    tx.add('categories', {
      id: 'cat-1',
      name: 'Food',
      type: 'Expense'
    });
  });

  const rawTransaction = await f.db.table('transactions').get('tx-1');
  const rawCategory = await f.db.table('categories').get('cat-1');

  check(rawTransaction.__lifeosEncrypted === 1,
    'Transaction persisted as ciphertext');
  check(rawCategory.__lifeosEncrypted === 1,
    'Category persisted as ciphertext');

  const logicalTransaction =
    await f.repositories.transactions.get('tx-1');
  check(logicalTransaction.description === 'initial',
    'Encrypted transaction decrypts correctly');

  // 2. Force the second table operation to fail. The first must roll back.
  let rollbackRejected = false;
  try {
    await f.coordinator.run(async tx => {
      tx.put('transactions', {
        id: 'tx-1',
        description: 'must-rollback',
        amount: 999
      });
      // Existing primary key forces Dexie add() to fail.
      tx.add('categories', {
        id: 'cat-1',
        name: 'Duplicate',
        type: 'Expense'
      });
    });
  } catch (error) {
    rollbackRejected = true;
  }

  check(rollbackRejected, 'Duplicate second-table add rejects the batch');

  const afterRollback =
    await f.repositories.transactions.get('tx-1');
  check(afterRollback.description === 'initial',
    'First-table write rolled back after second-table failure');

  const categoryAfterRollback =
    await f.repositories.categories.get('cat-1');
  check(categoryAfterRollback.name === 'Food',
    'Second-table record remains unchanged after rollback');

  // 3. Read-your-own-staged-write.
  await f.coordinator.run(async tx => {
    tx.put('transactions', {
      id: 'tx-2',
      description: 'staged',
      amount: 200
    });

    const staged = await tx.get('transactions', 'tx-2');
    assert.equal(staged.description, 'staged');

    const all = await tx.getAll('transactions');
    assert.ok(all.some(row => row.id === 'tx-2'));
  });

  check(
    (await f.repositories.transactions.get('tx-2')).description === 'staged',
    'Staged write is visible to reads before commit'
  );

  // 4. Delete and clear operations.
  await f.coordinator.run(async tx => {
    tx.delete('transactions', 'tx-2');
  });

  check(
    (await f.repositories.transactions.get('tx-2')) === undefined,
    'Delete mutation committed'
  );

  await f.coordinator.run(async tx => {
    tx.clear('categories');
  });

  check(
    (await f.repositories.categories.getAll()).length === 0,
    'Clear mutation committed'
  );

  // 5. Concurrent read-modify-write operations are serialized.
  let firstStarted;
  const started = new Promise(resolve => {
    firstStarted = resolve;
  });

  const first = f.coordinator.run(async tx => {
    const current = await tx.get('transactions', 'tx-1');
    firstStarted();
    await new Promise(resolve => setTimeout(resolve, 40));
    tx.put('transactions', {
      ...current,
      description: 'first'
    });
  });

  await started;

  const second = f.coordinator.run(async tx => {
    const current = await tx.get('transactions', 'tx-1');
    tx.put('transactions', {
      ...current,
      description: `${current.description}-second`
    });
  });

  await Promise.all([first, second]);

  const concurrentResult =
    await f.repositories.transactions.get('tx-1');

  check(
    concurrentResult.description === 'first-second',
    'Concurrent transactions serialize without lost updates'
  );

  await f.db.delete();

  console.log(`\nENCRYPTED TRANSACTION COORDINATOR: ${passed} PASSED`);
}

main().catch(error => {
  console.error('FAIL:', error);
  process.exitCode = 1;
});
