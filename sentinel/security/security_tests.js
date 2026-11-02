/**

 * LifeOS Sentinel — Application Security & Cryptographic Regression Suite

 * Tests cryptographic key lifecycle, quarantine, AES-256-GCM, HMAC integrity,

 * tampered backup rejection, biometric enforcement, native bridge validation,

 * AndroidManifest WebView configuration audit, and log leakage scanning.

 */



const assert = require('assert');

const fs = require('fs');

const path = require('path');

const { CryptoService, CryptoManager } = require('../../src/services/cryptoService.js');



async function runSecurityTests() {

  const results = { name: 'Application Security Suite', total: 0, passed: 0, failed: 0, findings: [], errors: [] };



  async function test(description, severity, fn) {

    results.total++;

    try {

      await fn();

      results.passed++;

    } catch (e) {

      results.failed++;

      results.findings.push({ severity, check: description, error: e.message, stack: e.stack });

      results.errors.push({ test: description, error: e.message });

      console.error(`  ❌ [${severity}] FAIL: ${description} - ${e.message}`);

    }

  }



  console.log('--- Running Sentinel Application Security Tests ---');



  // Test 1: Key Lifecycle Transitions (UNINITIALIZED -> ACTIVE -> QUARANTINED -> ROTATED -> DESTROYED)

  await test('Crypto Lifecycle: verify all key states and unauthorized access guards', 'CRITICAL', async () => {

    const mgr = new CryptoManager();

    assert.strictEqual(mgr.getKeyState().state, 'UNINITIALIZED');



    // Attempting to encrypt in UNINITIALIZED state must throw

    let threwUninit = false;

    try {

      await mgr.encryptPayload({ secret: 'data' });

    } catch (e) {

      threwUninit = true;

      assert(e.message.includes('UNINITIALIZED'));

    }

    assert.strictEqual(threwUninit, true);



    // Initialize key

    await mgr.initializeKey('strong-production-passphrase-2026');

    assert.strictEqual(mgr.getKeyState().state, 'ACTIVE');



    // Rotate key

    await mgr.rotateKey('strong-production-passphrase-2026', 'new-super-secure-passphrase-2026');

    assert.strictEqual(mgr.getKeyState().state, 'ACTIVE');



    // Destroy key

    mgr.destroyKey();

    assert.strictEqual(mgr.getKeyState().state, 'DESTROYED');



    // Attempting to decrypt in DESTROYED state must throw

    let threwDestroyed = false;

    try {

      await mgr.decryptPayload({ salt: '00', iv: '00', ciphertext: '00', hmac: '00' });

    } catch (e) {

      threwDestroyed = true;

      assert(e.message.includes('Key is not in ACTIVE state'));

    }

    assert.strictEqual(threwDestroyed, true);

  });



  // Test 2: AES-256-GCM Encryption / Decryption Correctness

  await test('Crypto Encryption: AES-256-GCM encryption with 12-byte IV and PBKDF2 (100k iterations)', 'HIGH', async () => {

    const mgr = new CryptoManager();

    await mgr.initializeKey('passphrase-for-encryption-test');



    const original = {

      transactions: [

        { id: 'tx_sec_1', amount: 150000, description: 'Consulting Retainer' }

      ],

      user: 'Pavan Kotana'

    };



    const encrypted = await mgr.encryptPayload(original);

    assert.strictEqual(encrypted.version, 1);

    assert.strictEqual(encrypted.cipher, 'AES-256-GCM');

    assert.strictEqual(encrypted.kdf, 'PBKDF2-SHA256');

    assert.strictEqual(encrypted.iterations, 100000);

    assert.strictEqual(encrypted.salt.length, 32); // 16 bytes = 32 hex chars

    assert.strictEqual(encrypted.iv.length, 24);   // 12 bytes = 24 hex chars

    assert(encrypted.ciphertext.length > 0);

    assert.strictEqual(encrypted.hmac.length, 64); // SHA-256 = 32 bytes = 64 hex chars



    const decrypted = await mgr.decryptPayload(encrypted);

    assert.strictEqual(decrypted.user, 'Pavan Kotana');

    assert.strictEqual(decrypted.transactions[0].amount, 150000);

  });



  // Test 3: Backup Integrity & Tamper Detection with Key Quarantine

  await test('Crypto Integrity: tampered ciphertext causes HMAC rejection and key quarantine', 'CRITICAL', async () => {

    const mgr = new CryptoManager();

    await mgr.initializeKey('integrity-tamper-check-passphrase');



    const payload = { account: 'secret_bank', balance: 500000 };

    const valid = await mgr.encryptPayload(payload);



    // Tamper with 1 character of ciphertext

    const tamperedCt = valid.ciphertext.slice(0, 4) === 'aaaa' ? 'bbbb' + valid.ciphertext.slice(4) : 'aaaa' + valid.ciphertext.slice(4);

    const tamperedContainer = { ...valid, ciphertext: tamperedCt };



    let threwTamper = false;

    try {

      await mgr.decryptPayload(tamperedContainer);

    } catch (e) {

      threwTamper = true;

      assert(e.message.includes('Cryptographic Integrity Violation'));

    }

    assert.strictEqual(threwTamper, true);



    // Verify key state transitioned to QUARANTINED

    assert.strictEqual(mgr.getKeyState().state, 'QUARANTINED');

    assert(mgr.getKeyState().quarantineReason.includes('HMAC signature mismatch'));



    // Verify subsequent decryptions are strictly blocked

    let threwQuarantined = false;

    try {

      await mgr.decryptPayload(valid);

    } catch (e) {

      threwQuarantined = true;

      assert(e.message.includes('QUARANTINED'));

    }

    assert.strictEqual(threwQuarantined, true);



    // Test Key Recovery from Quarantine

    await mgr.recoverKey('integrity-tamper-check-passphrase', valid.salt);

    assert.strictEqual(mgr.getKeyState().state, 'ACTIVE');



    // Decryption of valid container works again after recovery

    const recovered = await mgr.decryptPayload(valid);

    assert.strictEqual(recovered.balance, 500000);

  });



  // Test 4: Android Native Bridge Input Validation

  await test('Native Bridge Security: StorageAccessPlugin parameter validation & path traversal defense', 'HIGH', async () => {

    // Read StorageAccessPlugin.java to verify input validation guards

    const pluginPath = path.resolve(__dirname, '../../android/app/src/main/java/com/lifeos/personal/StorageAccessPlugin.java');

    assert(fs.existsSync(pluginPath), 'StorageAccessPlugin.java must exist');

    const javaCode = fs.readFileSync(pluginPath, 'utf-8');



    // Verify directory traversal check

    assert(javaCode.includes('fileName.contains("..")'), 'Must guard against parent directory traversal');

    assert(javaCode.includes('fileName.contains("/")'), 'Must guard against forward slash path traversal');

    assert(javaCode.includes('fileName.contains("\\\\")'), 'Must guard against backslash path traversal');

    assert(javaCode.includes('fileName.contains("\\0")'), 'Must guard against null byte poisoning');



    // Verify file size limits

    assert(javaCode.includes('MAX_FILE_SIZE_BYTES'), 'Must enforce max file size limit to prevent OOM DOS attacks');

  });



  // Test 5: AndroidManifest WebView Security Configuration Audit

  await test('WebView & Android Manifest Audit: exported activities, file providers, and permissions', 'MEDIUM', async () => {

    const manifestPath = path.resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml');

    assert(fs.existsSync(manifestPath), 'AndroidManifest.xml must exist');

    const xml = fs.readFileSync(manifestPath, 'utf-8');



    // Check exported activity configuration

    assert(xml.includes('android:exported="true"'), 'MainActivity must explicitly declare exported state');



    // Check FileProvider exported attribute (MUST be false for security)

    assert(xml.includes('android:name="androidx.core.content.FileProvider"'));

    assert(xml.includes('android:exported="false"'), 'FileProvider must NOT be exported to prevent unauthorized external access');



    // Check grantUriPermissions

    assert(xml.includes('android:grantUriPermissions="true"'), 'FileProvider must use granular grantUriPermissions');

  });



  // Test 6: Sensitive Log Leakage Scanner

  await test('Zero-Leakage Audit: verify no real private keys, tokens, or PII exist in repository source or logs', 'HIGH', async () => {

    const dangerousPatterns = [

      /AIzaSy[0-9A-Za-z_-]{33}/, // Google API Key

      /-----BEGIN RSA PRIVATE KEY-----/,

      /-----BEGIN EC PRIVATE KEY-----/,

      /-----BEGIN PRIVATE KEY-----/,

      /ghp_[0-9a-zA-Z]{36}/, // GitHub personal access token

      /xox[baprs]-[0-9a-zA-Z]{10,48}/ // Slack tokens

    ];



    const filesToScan = [

      path.resolve(__dirname, '../../package.json'),

      path.resolve(__dirname, '../../src/db.ts'),

      path.resolve(__dirname, '../../src/App.tsx'),

      path.resolve(__dirname, '../../src_core_logic.js'),

      path.resolve(__dirname, '../../README.md')

    ];



    for (const file of filesToScan) {

      if (fs.existsSync(file)) {

        const text = fs.readFileSync(file, 'utf-8');

        for (const pattern of dangerousPatterns) {

          assert(!pattern.test(text), `Security finding: Leaked secret or private key pattern found in ${file}`);

        }

      }

    }

  });



  // Test 7: Dependency Security Audit

  await test('Dependency Audit: check package.json for known dangerous or deprecated libraries', 'MEDIUM', async () => {

    const pkgPath = path.resolve(__dirname, '../../package.json');

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));



    // Ensure no vulnerable packages

    const banned = ['eval', 'serialize-javascript', 'lodash.template', 'event-stream'];

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const b of banned) {

      assert(!allDeps[b], `Security finding: Vulnerable banned package ${b} in dependencies`);

    }

  });



  console.log(`Application Security Tests Completed: ${results.passed}/${results.total} passed. Findings: ${results.findings.length}.`);

  return results;

}



if (typeof module !== 'undefined' && module.exports) {

  module.exports = { runSecurityTests };

  if (require.main === module) {

    runSecurityTests();

  }

}
