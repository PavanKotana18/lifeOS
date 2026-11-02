require('fake-indexeddb/auto');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const Dexie = require('dexie');

async function loadStore() {
  const source = fs.readFileSync(
    path.join(__dirname, 'src/services/encryptedDexieStore.ts'),
    'utf8'
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const loaded = new Module(
    path.join(__dirname, 'src/services/encryptedDexieStore.cjs'),
    module
  );
  loaded.filename = path.join(__dirname, 'src/services/encryptedDexieStore.cjs');
  loaded.paths = module.paths;
  loaded._compile(compiled, loaded.filename);
  return loaded.exports.createEncryptedDexieStore;
}

async function main() {
  const createStore = await loadStore();
  const storeModuleSource = fs.readFileSync(
    path.join(__dirname, 'src/services/encryptedDexieStore.ts'),
    'utf8'
  );
  const compiledStore = ts.transpileModule(storeModuleSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;
  const storeModule = new Module(
    path.join(__dirname, 'src/services/encryptedDexieStore.transaction-test.cjs'),
    module
  );
  storeModule.filename = path.join(__dirname, 'src/services/encryptedDexieStore.transaction-test.cjs');
  storeModule.paths = module.paths;
  storeModule._compile(compiledStore, storeModule.filename);
  const { withEncryptedStorageWrite } = storeModule.exports;

  const db = new Dexie('LifeOS_EncryptedStore_Test');
  db.version(1).stores({
    transactions: 'id',
    settings: 'key'
  });
  await db.open();

  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };

  const crypto = {
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

  const codec = {
    async seal(table, id, record) {
      return {
        ...(table === 'settings' ? { key: id } : { id }),
        __lifeosEncrypted: 1,
        encrypted: await crypto.encryptRecord(
          table, id, 1, JSON.stringify(record)
        )
      };
    },
    async open(table, row) {
      const id = table === 'settings' ? row.key : row.id;
      const plaintext = await crypto.decryptRecord(
        table, id, 1, row.encrypted
      );
      const record = JSON.parse(plaintext);
      assert.strictEqual(
        table === 'settings' ? record.key : record.id,
        id
      );
      return record;
    }
  };

  try {
    const transactions = createStore({
      tableName: 'transactions',
      table: db.transactions,
      codec
    });

    const transaction = {
      id: 'tx-1',
      amount: 1250,
      description: 'Private purchase',
      category: 'Shopping',
      date: '2026-11-01'
    };

    const preparedOnly = await transactions.prepare({
      id: 'prepared-only',
      amount: 1,
      description: 'Not persisted yet',
      category: 'Test',
      date: '2026-11-01'
    });
    check(
      await db.transactions.get('prepared-only') === undefined &&
      preparedOnly.__lifeosEncrypted === 1,
      'Prepare creates ciphertext without writing to IndexedDB'
    );

    const openedPrepared = await transactions.open(preparedOnly);
    check(
      openedPrepared.id === 'prepared-only',
      'Prepared ciphertext can be opened before a transaction'
    );

    await transactions.add(transaction);
    const raw = await db.transactions.get('tx-1');

    check(raw.__lifeosEncrypted === 1, 'New transaction rows carry encrypted marker');
    check(raw.amount === undefined && raw.description === undefined, 'Sensitive transaction fields are absent from IndexedDB row');
    check(raw.encrypted.ciphertext !== undefined, 'Ciphertext is persisted');
    check((await transactions.get('tx-1')).description === 'Private purchase', 'Encrypted transaction decrypts by primary key');

    await db.transactions.add({
      id: 'legacy-1',
      amount: 50,
      description: 'Legacy plaintext row',
      category: 'Food',
      date: '2026-10-31'
    });

    const mixed = await transactions.getAll();
    check(mixed.length === 2, 'Mixed legacy and encrypted rows remain readable');
    check(mixed.some(item => item.id === 'legacy-1'), 'Legacy plaintext row is readable during transition');

    const filtered = await transactions.filter(item => item.amount > 100);
    check(filtered.length === 1 && filtered[0].id === 'tx-1', 'Filtering runs against decrypted records');

    await transactions.update('tx-1', current => ({
      ...current,
      amount: 1500
    }));
    const updatedRaw = await db.transactions.get('tx-1');
    check(updatedRaw.amount === undefined, 'Updated row remains ciphertext-only');
    check((await transactions.get('tx-1')).amount === 1500, 'Read-modify-write preserves updated values');

    await assert.rejects(
      transactions.update('tx-1', current => ({ ...current, id: 'tx-changed' })),
      /cannot change the storage identity/
    );
    check(true, 'Updates cannot change the primary-key identity');

    await transactions.bulkPut([
      { id: 'tx-2', amount: 20, description: 'Second', category: 'Food', date: '2026-11-02' },
      { id: 'tx-3', amount: 30, description: 'Third', category: 'Travel', date: '2026-11-03' }
    ]);
    const bulkRows = await db.transactions.bulkGet(['tx-2', 'tx-3']);
    check(bulkRows.every(row => row.__lifeosEncrypted === 1), 'Bulk writes encrypt every row before persistence');

    const settings = createStore({
      tableName: 'settings',
      table: db.settings,
      codec,
      bootstrapKeys: new Set(['theme', 'biometricLockEnabled'])
    });

    await settings.put({ key: 'theme', value: 'dark' });
    await settings.put({ key: 'currency', value: 'INR' });

    const rawTheme = await db.settings.get('theme');
    const rawCurrency = await db.settings.get('currency');

    check(rawTheme.value === 'dark' && rawTheme.__lifeosEncrypted === undefined, 'Allowlisted bootstrap setting remains plaintext');
    check(rawCurrency.value === undefined && rawCurrency.__lifeosEncrypted === 1, 'Non-bootstrap setting is encrypted');
    check((await settings.get('currency')).value === 'INR', 'Encrypted settings decrypt correctly');

    await db.transactions.put({
      id: 'tampered',
      __lifeosEncrypted: 1,
      encrypted: { broken: true }
    });
    await assert.rejects(transactions.get('tampered'));
    check(true, 'Malformed encrypted rows fail closed without plaintext fallback');

    await db.transactions.put({
      id: 'missing-marker',
      encrypted: { ciphertext: 'not-a-legacy-field' }
    });
    await assert.rejects(transactions.get('missing-marker'));
    check(true, 'Encryption metadata without its marker fails closed');

    await transactions.delete('tx-2');
    check(await db.transactions.get('tx-2') === undefined, 'Delete uses the stable primary key');

    await transactions.clear();
    check((await db.transactions.count()) === 0, 'Clear removes rows through the repository');

    const order = [];
    let releaseFirst;
    const firstGate = new Promise(resolve => { releaseFirst = resolve; });
    const firstWrite = withEncryptedStorageWrite(async () => {
      order.push('first-start');
      await firstGate;
      order.push('first-end');
    });
    const secondWrite = withEncryptedStorageWrite(async () => {
      order.push('second-start');
      order.push('second-end');
    });
    await Promise.resolve();
    check(
      order.join(',') === 'first-start',
      'Shared write boundary prevents a second multi-table mutation from interleaving'
    );
    releaseFirst();
    await Promise.all([firstWrite, secondWrite]);
    check(
      order.join(',') === 'first-start,first-end,second-start,second-end',
      'Shared write boundary preserves complete mutation ordering'
    );

    console.log(`\nEncrypted Dexie store: ${passed}/${passed} passed`);
  } finally {
    db.close();
    await Dexie.delete('LifeOS_EncryptedStore_Test');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
