require('fake-indexeddb/auto');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const Dexie = require('dexie');
const ts = require('typescript');

const ROOT = path.join(__dirname, 'src/services');

function loadTs(file, overrides = {}) {
  const filename = path.resolve(file);
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

  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (Object.prototype.hasOwnProperty.call(overrides, id)) {
      return overrides[id];
    }
    if (id.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), id) + '.ts';
      if (fs.existsSync(target)) return loadTs(target);
    }
    return originalRequire(id);
  };

  loaded._compile(compiled, loaded.filename);
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
  'savingsContributions', 'financialAccounts', 'accountTransfers', 'manualExchangeRates', 'plannedCommitments', 'habits', 'habitLogs', 'goals',
  'milestones', 'tasks', 'settings'
];

const bootstrapKeys = [
  'theme', 'biometricLockEnabled', 'onboardingCompleted',
  'onboardingStarted', 'onboardingStep', 'displayName'
];

async function createFixture(options = {}) {
  const name = `LifeOS_Migration_Test_${Date.now()}_${Math.random()}`;
  const db = new Dexie(name);
  const schema = {};
  for (const table of tables) {
    schema[table] = table === 'settings' ? 'key' : 'id';
  }
  db.version(1).stores(schema);
  await db.open();

  const database = { transaction: db.transaction.bind(db) };
  for (const table of tables) database[table] = db.table(table);

  for (const table of tables) {
    if (table === 'settings') {
      for (const key of bootstrapKeys) {
        await database.settings.put({ key, value: `bootstrap-${key}` });
      }
      await database.settings.put({
        key: 'privateSetting',
        value: 'private-value'
      });
    } else {
      await database[table].put({
        id: `${table}-001`,
        privateValue: `secret-${table}`,
        amount: 123
      });
    }
  }

  if (options.failCategoriesOnce) {
    const original = database.categories;
    let shouldFail = true;
    database.categories = new Proxy(original, {
      get(target, property) {
        if (property === 'put') {
          return async (...args) => {
            if (shouldFail) {
              shouldFail = false;
              throw new Error('simulated interrupted write');
            }
            return target.put(...args);
          };
        }
        const value = target[property];
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  }

  const integration = loadTs(
    path.join(ROOT, 'encryptedStorageIntegration.ts'),
    { './cryptoService.ts': { CryptoService: cryptoMock } }
  );

  const repositories = integration.createLifeOSEncryptedRepositories(database);

  return { db, database, repositories, integration };
}

async function main() {
  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };

  const fixture = await createFixture();

  const result = await fixture.integration.migrateLifeOSRecords(
    fixture.database,
    fixture.repositories
  );

  for (const table of tables.filter(t => t !== 'settings')) {
    const row = await fixture.database[table].get(`${table}-001`);
    check(row.__lifeosEncrypted === 1, `${table} row migrated to ciphertext`);
    check(row.privateValue === undefined, `${table} plaintext fields absent`);
    const opened = await fixture.repositories[table].open(row);
    check(opened.privateValue === `secret-${table}`, `${table} decrypts correctly`);
  }

  const privateSetting = await fixture.database.settings.get('privateSetting');
  check(privateSetting.__lifeosEncrypted === 1, 'Non-bootstrap setting encrypted');
  check(privateSetting.value === undefined, 'Non-bootstrap setting plaintext absent');

  for (const key of bootstrapKeys) {
    const row = await fixture.database.settings.get(key);
    check(row.__lifeosEncrypted === undefined, `Bootstrap setting ${key} remains readable`);
  }

  check(result.skippedBootstrap === bootstrapKeys.length, 'All bootstrap settings skipped');
  check(result.migrated.transactions === 1, 'Transaction migration count correct');

  const second = await fixture.integration.migrateLifeOSRecords(
    fixture.database,
    fixture.repositories
  );
  check(second.migrated.transactions === 0, 'Second migration does not re-encrypt rows');
  check(second.skippedEncrypted.transactions === 1, 'Second migration skips encrypted rows');

  await fixture.db.delete();

  const interrupted = await createFixture({ failCategoriesOnce: true });
  let rejected = false;
  try {
    await interrupted.integration.migrateLifeOSRecords(
      interrupted.database,
      interrupted.repositories
    );
  } catch (error) {
    rejected = /simulated interrupted write/.test(String(error));
  }
  check(rejected, 'Interrupted migration reports write failure');

  const resumed = await interrupted.integration.migrateLifeOSRecords(
    interrupted.database,
    interrupted.repositories
  );
  check(resumed.skippedEncrypted.transactions === 1, 'Resume skips previously migrated transactions');
  check(resumed.migrated.categories === 1, 'Resume migrates remaining categories');

  await interrupted.db.delete();

  const malformed = await createFixture();
  await malformed.database.transactions.put({
    id: 'bad-row',
    __lifeosEncrypted: 1,
    encrypted: null
  });

  let malformedRejected = false;
  try {
    await malformed.integration.migrateLifeOSRecords(
      malformed.database,
      malformed.repositories
    );
  } catch (error) {
    malformedRejected = /malformed encrypted/.test(String(error));
  }
  check(malformedRejected, 'Malformed encryption metadata fails closed');

  await malformed.db.delete();

  console.log(`\nMIGRATION BEHAVIOR TESTS: ${passed} PASSED`);
}

main().catch(error => {
  console.error('FAIL:', error);
  process.exitCode = 1;
});
