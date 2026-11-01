const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/services/cryptoService.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

let available = true;
const calls = [];
const encryptedAad = new Map();
let malformedRecoveryResponse = false;

const native = {
  async prepareRecovery() {
    calls.push(['prepareRecovery']);
    if (malformedRecoveryResponse) {
      return {
        success: true,
        recoveryCode: 'invalid',
        envelope: {}
      };
    }
    return {
      success: true,
      recoveryCode: 'A'.repeat(43),
      envelope: {
        version: 1,
        kdf: 'PBKDF2-HMAC-SHA-256',
        iterations: 600000,
        salt: 'A'.repeat(22) + '==',
        iv: 'A'.repeat(16),
        wrappedKey: 'A'.repeat(64)
      }
    };
  },
  async confirmRecovery() {
    calls.push(['confirmRecovery']);
    return { success: true };
  },
  async recoverWithSecret(options) {
    calls.push(['recoverWithSecret', options]);
    return { success: true, keyVersion: 1 };
  },
  async rebindLocalKey() {
    calls.push(['rebindLocalKey']);
    return { success: true, keyVersion: 1 };
  },
  async setup() {
    calls.push(['setup']);
    return { success: true, keyVersion: 1 };
  },
  async unlock() {
    calls.push(['unlock']);
    return { success: true, keyVersion: 1 };
  },
  async lock() {
    calls.push(['lock']);
    return { success: true };
  },
  async isUnlocked() {
    return { unlocked: true };
  },
  async encrypt(options) {
    calls.push(['encrypt', options]);
    encryptedAad.set('encrypted', options.aad);
    return { iv: 'abcdefghijklmnop', ciphertext: 'encrypted', keyVersion: 1 };
  },
  async decrypt(options) {
    calls.push(['decrypt', options]);
    if (encryptedAad.get(options.ciphertext) !== options.aad) {
      throw new Error('Authenticated data mismatch');
    }
    return { plaintext: 'restored' };
  }
};

const capacitor = {
  Capacitor: {
    isPluginAvailable: () => available
  },
  registerPlugin: name => {
    assert.equal(name, 'LifeOSCrypto');
    return native;
  }
};

const loaded = { exports: {} };
vm.runInNewContext(compiled, {
  module: loaded,
  exports: loaded.exports,
  require: name => {
    assert.equal(name, '@capacitor/core');
    return capacitor;
  },
  Set,
  JSON,
  Number,
  Error,
  Object
});

const { CryptoService, buildRecordAad } = loaded.exports;

async function run() {
  let passed = 0;

  function check(condition, message) {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  }

  const aad = buildRecordAad('transactions', 'txn-123', 1);
  assert.deepEqual(JSON.parse(aad), [
    'lifeos-record', 1, 'transactions', 'txn-123', 1
  ]);
  check(true, 'AAD is canonical and binds table, record and schema version');

  assert.throws(
    () => buildRecordAad('unknown-table', 'id-1', 1),
    /Unsupported/
  );
  check(true, 'Unknown tables are rejected');

  assert.throws(
    () => buildRecordAad('transactions', '', 1),
    /identifier/
  );
  check(true, 'Empty record identifiers are rejected');

  assert.throws(
    () => buildRecordAad('transactions', 'id-1', 0),
    /schema version/
  );
  check(true, 'Invalid schema versions are rejected');

  check(CryptoService.isAvailable(), 'Native plugin availability is exposed');

  const recovery = await CryptoService.prepareRecovery();
  check(
    recovery.recoveryCode.length === 43,
    'Recovery preparation returns a validated one-time code'
  );
  check(
    recovery.envelope.version === 1 &&
    recovery.envelope.iterations === 600000,
    'Recovery envelope version and KDF parameters are validated'
  );

  await CryptoService.confirmRecovery();
  check(
    calls.some(call => call[0] === 'confirmRecovery'),
    'Recovery confirmation delegates to native persistence'
  );

  malformedRecoveryResponse = true;
  await assert.rejects(
    CryptoService.prepareRecovery(),
    /invalid code/
  );
  check(
    true,
    'Malformed native recovery responses are rejected'
  );
  malformedRecoveryResponse = false;

  const recovered = await CryptoService.recoverWithSecret(
    'A'.repeat(43),
    recovery.envelope
  );
  check(
    recovered.success === true &&
    calls.some(call => call[0] === 'recoverWithSecret'),
    'Recovery delegates the validated code and envelope to native'
  );

  await assert.rejects(
    CryptoService.recoverWithSecret('bad-code', recovery.envelope),
    /recovery code/
  );
  check(true, 'Invalid recovery codes are rejected before native execution');

  const rebound = await CryptoService.rebindLocalKey();
  check(
    rebound.success === true &&
    calls.some(call => call[0] === 'rebindLocalKey'),
    'Local Keystore re-binding delegates to native biometric protection'
  );

  const setup = await CryptoService.setup();
  check(setup.success, 'Setup delegates to the native plugin');

  const unlock = await CryptoService.unlock();
  check(unlock.success, 'Unlock delegates to the native plugin');

  check(await CryptoService.isUnlocked(), 'Native unlocked state is queried');

  const encrypted = await CryptoService.encryptRecord(
    'transactions', 'txn-123', 1, '{"amount":100}'
  );
  check(encrypted.keyVersion === 1, 'Record encryption returns a versioned envelope');

  const encryptCall = calls.find(call => call[0] === 'encrypt')[1];
  check(
    encryptCall.aad === aad,
    'Callers cannot supply arbitrary AAD to record encryption'
  );

  const plaintext = await CryptoService.decryptRecord(
    'transactions', 'txn-123', 1, encrypted
  );
  check(plaintext === 'restored', 'Record decryption returns plaintext');

  const decryptCall = calls.find(call => call[0] === 'decrypt')[1];
  check(
    decryptCall.aad === aad,
    'Record decryption reconstructs the same canonical AAD'
  );

  await assert.rejects(
    CryptoService.decryptRecord('goals', 'txn-123', 1, encrypted),
    /Authenticated data mismatch/
  );
  check(
    true,
    'Ciphertext cannot be decrypted under a different record identity'
  );

  check(
    buildRecordAad('goals', 'txn-123', 1) !== aad,
    'AAD differs across record tables'
  );

  await CryptoService.lock();
  check(calls.some(call => call[0] === 'lock'), 'Lock delegates to native key clearing');

  available = false;
  check(!CryptoService.isAvailable(), 'Unavailable native plugin is reported');
  await assert.rejects(CryptoService.unlock(), /unavailable/);
  check(true, 'Web or unsupported platforms fail closed');

  console.log(`CRYPTO SERVICE TESTS: ${passed}/24 PASSED`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
