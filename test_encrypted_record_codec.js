const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');

const source = fs.readFileSync(
  'src/services/encryptedRecordCodec.ts',
  'utf8'
);

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} }
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox);

const { createEncryptedRecordCodec } = sandbox.module.exports;

let assertions = 0;
function pass(message) {
  assertions++;
  console.log(`PASS: ${message}`);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
  pass(message);
}
async function rejects(action, message) {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
  assert(rejected, message);
}

(async () => {
  const calls = [];

  const crypto = {
    async encryptRecord(table, id, version, plaintext) {
      calls.push({ operation: 'encrypt', table, id, version });
      return {
        iv: 'AAAAAAAAAAAAAAAA',
        ciphertext: Buffer.from(plaintext, 'utf8').toString('base64'),
        keyVersion: 1
      };
    },
    async decryptRecord(table, id, version, encrypted) {
      calls.push({ operation: 'decrypt', table, id, version });
      return Buffer.from(encrypted.ciphertext, 'base64').toString('utf8');
    }
  };

  const codec = createEncryptedRecordCodec(crypto);

  const transaction = {
    id: 'tx-001',
    description: 'Private salary information',
    amount: 50000,
    date: '2026-11-01'
  };

  const sealed = await codec.seal('transactions', transaction.id, transaction);

  assert(sealed.id === transaction.id, 'Storage row retains the record lookup ID');
  assert(sealed.__lifeosEncrypted === 1, 'Storage row carries an explicit encrypted marker');
  assert(!Object.prototype.hasOwnProperty.call(sealed, 'description'), 'Sensitive fields are absent from the storage row');
  assert(!JSON.stringify(sealed).includes('Private salary information'), 'Plaintext is not present in the encrypted row');

  const opened = await codec.open('transactions', sealed);
  assert(opened.description === transaction.description, 'Encrypted record round-trips to the original payload');
  assert(opened.amount === transaction.amount, 'Numeric fields survive encryption and decryption');

  const setting = { key: 'displayName', value: 'Private Profile' };
  const sealedSetting = await codec.seal('settings', setting.key, setting);
  assert(sealedSetting.key === setting.key && sealedSetting.id === undefined, 'Settings retain Dexie key as their primary key');
  const openedSetting = await codec.open('settings', sealedSetting);
  assert(openedSetting.value === setting.value, 'Settings decrypt using their Dexie primary key');

  await rejects(
    () => codec.seal('transactions', 'different-id', transaction),
    'Seal rejects a record whose identity differs from its storage key'
  );

  await rejects(
    () => codec.seal('unknown-table', 'x', { id: 'x' }),
    'Seal rejects unknown tables'
  );

  await rejects(
    () => codec.open('unknown-table', sealed),
    'Open rejects unknown tables'
  );

  await rejects(
    () => codec.open('transactions', { ...sealed, id: 'tampered-id' }),
    'Open rejects storage-key tampering'
  );

  await rejects(
    () => codec.open('transactions', { id: 'tx-001', encrypted: sealed.encrypted }),
    'Open rejects rows without the encrypted marker'
  );

  await rejects(
    () => codec.open('transactions', {
      ...sealed,
      encrypted: { ...sealed.encrypted, keyVersion: 99 }
    }),
    'Open rejects unsupported encryption key versions'
  );

  assert(
    calls.some(call => call.operation === 'encrypt' && call.table === 'transactions' && call.id === 'tx-001' && call.version === 1),
    'Encryption binds table, record ID and schema version'
  );

  console.log(`\nENCRYPTED RECORD CODEC TESTS: ${assertions}/${assertions} PASSED`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
