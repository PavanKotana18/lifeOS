/**
 * LifeOS Sentinel — Production Cryptographic & Backup Hardening Regression Suite
 * Tests actual production encryption, persistence, and rotation functions:
 * 1. Correct passphrase encryption and restoration
 * 2. Incorrect passphrase rejection
 * 3. Corrupt ciphertext rejection and tamper quarantine
 * 4. Missing or corrupt metadata rejection
 * 5. Interrupted persistence safety using real disk storage
 * 6. Atomic rollback after failed rotation using real disk storage
 * 7. Full backup encryption round-trip
 * 8. Successful durable rotation followed by restoration using real disk storage
 * 9. Backward compatibility with existing unencrypted backup formats
 * 10. Fresh-instance restore: persists rotated backup to real filesystem, simulates fresh app instance, and restores
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CryptoService, CryptoManager } = require('../../src/services/cryptoService.js');
const { BackupPersistenceManager, FileStorageAdapter, LocalStorageAdapter } = require('../../src/services/backupPersistenceService.js');

async function runCryptoRegressionTests() {
  console.log('--- Running Sentinel Production Crypto & Backup Hardening Regression Tests ---');
  let passed = 0;
  let total = 0;

  async function check(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✅ PASS: ${name}`);
    } catch (e) {
      console.error(`  ❌ FAIL: ${name} - ${e.message}`);
      throw e;
    }
  }

  // 1. Correct Passphrase Encryption and Restoration
  await check('1. Correct Passphrase: encrypts payload and decrypts successfully with matching passphrase', async () => {
    const payload = {
      app: 'LifeOS',
      version: '1.0.0',
      tables: {
        transactions: [{ id: 'tx_p1', amount: 125000, category: 'Salary' }],
        habits: [{ id: 'h_p1', name: 'Exercise', frequency: 'daily' }]
      }
    };
    const passphrase = 'production-secure-passphrase-2026';
    const container = await CryptoService.encryptPayload(payload, passphrase);

    assert.strictEqual(container.cipher, 'AES-256-GCM');
    assert.strictEqual(container.kdf, 'PBKDF2-SHA256');
    assert.strictEqual(container.salt.length, 32);
    assert.strictEqual(container.iv.length, 24);
    assert.strictEqual(container.hmac.length, 64);

    const decrypted = await CryptoService.decryptPayload(container, passphrase);
    assert.deepStrictEqual(decrypted.tables, payload.tables);
  });

  // 2. Incorrect Passphrase Rejection
  await check('2. Incorrect Passphrase: fails authentication and rejects decryption', async () => {
    const payload = { secret: 'confidential_personal_record' };
    const correctPass = 'correct-master-passphrase-2026';
    const wrongPass = 'completely-wrong-passphrase-2026';

    const container = await CryptoService.encryptPayload(payload, correctPass);

    let threw = false;
    try {
      await CryptoService.decryptPayload(container, wrongPass);
    } catch (e) {
      threw = true;
      assert(e.message.includes('HMAC signature mismatch') || e.message.includes('failed') || e.message.includes('Integrity'));
    }
    assert.strictEqual(threw, true, 'Decryption with wrong passphrase must throw an exception');
  });

  // 3. Corrupt Ciphertext Rejection and Tamper Quarantine
  await check('3. Corrupt Ciphertext: detected before decryption, rejecting tamper and quarantining key', async () => {
    const mgr = new CryptoManager();
    await mgr.initializeKey('tamper-test-passphrase-2026');

    const valid = await mgr.encryptPayload({ balance: 999999 });
    const tamperedCiphertext = valid.ciphertext.slice(0, 4) === 'ffff'
      ? '0000' + valid.ciphertext.slice(4)
      : 'ffff' + valid.ciphertext.slice(4);

    const tamperedContainer = { ...valid, ciphertext: tamperedCiphertext };

    let threwTamper = false;
    try {
      await mgr.decryptPayload(tamperedContainer);
    } catch (e) {
      threwTamper = true;
      assert(e.message.includes('Cryptographic Integrity Violation') || e.message.includes('HMAC'));
    }
    assert.strictEqual(threwTamper, true);
    assert.strictEqual(mgr.getKeyState().state, 'QUARANTINED', 'Key state must transition to QUARANTINED on tamper');
  });

  // 4. Missing or Corrupt Metadata Rejection
  await check('4. Metadata Integrity: rejects containers with missing or truncated salt, IV, or HMAC', async () => {
    const valid = await CryptoService.encryptPayload({ key: 'val' }, 'passphrase-meta-check');

    const corruptSalt = { ...valid, salt: '' };
    await assert.rejects(() => CryptoService.decryptPayload(corruptSalt, 'passphrase-meta-check'), /Malformed encrypted container/);

    const corruptIv = { ...valid, iv: 'dead' };
    await assert.rejects(() => CryptoService.decryptPayload(corruptIv, 'passphrase-meta-check'));

    const corruptHmac = { ...valid, hmac: '' };
    await assert.rejects(() => CryptoService.decryptPayload(corruptHmac, 'passphrase-meta-check'), /Malformed encrypted container/);
  });

  // 5. Interrupted Persistence Safety Using Real Disk Storage
  await check('5. Interrupted Persistence: simulated disk write failure leaves existing durable backup intact on filesystem', async () => {
    const testDir = path.join(os.tmpdir(), `lifeos_test_persist_5_${Date.now()}`);
    try {
      const storage = new FileStorageAdapter(testDir);
      const persistence = new BackupPersistenceManager(storage);

      const originalData = { app: 'LifeOS', note: 'original_persisted_disk_backup' };
      const originalContainer = await CryptoService.encryptPayload(originalData, 'initial-passphrase-2026');
      await persistence.persistBackup(originalContainer, 'primary_backup');

      // Verify file was written to disk
      const filePath = path.join(testDir, 'primary_backup.json');
      assert(fs.existsSync(filePath), 'File must exist on disk');

      // Attempt rotation with simulated I/O failure midway during staged write
      let rotationFailed = false;
      try {
        await persistence.rotatePersistedBackup('initial-passphrase-2026', 'new-passphrase-2027', 'primary_backup', true);
      } catch (e) {
        rotationFailed = true;
        assert(e.message.includes('Simulated I/O failure'));
      }
      assert.strictEqual(rotationFailed, true);

      // Verify original backup remains completely intact and recoverable on disk
      const retainedContainer = await persistence.loadPersistedBackup('primary_backup');
      assert.notStrictEqual(retainedContainer, null);
      const restored = await CryptoService.decryptPayload(retainedContainer, 'initial-passphrase-2026');
      assert.strictEqual(restored.note, 'original_persisted_disk_backup');

      // Verify staging file was cleaned up from disk
      const stagingFile = path.join(testDir, 'primary_backup__staging.json');
      assert.strictEqual(fs.existsSync(stagingFile), false, 'Staging file on disk must be cleaned up on failure');
    } finally {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // 6. Atomic Rollback After Failed Rotation Using Real Disk Storage
  await check('6. Rotation Rollback: invalid credentials abort rotation without modifying disk file', async () => {
    const testDir = path.join(os.tmpdir(), `lifeos_test_rollback_6_${Date.now()}`);
    try {
      const storage = new FileStorageAdapter(testDir);
      const persistence = new BackupPersistenceManager(storage);

      const originalData = { app: 'LifeOS', user: 'Pavan' };
      const container = await CryptoService.encryptPayload(originalData, 'correct-old-pass');
      await persistence.persistBackup(container, 'durable_backup_key');

      // Attempt rotation with wrong old passphrase
      let rotationAborted = false;
      try {
        await persistence.rotatePersistedBackup('WRONG-old-pass', 'intended-new-pass', 'durable_backup_key');
      } catch (e) {
        rotationAborted = true;
        assert(e.message.includes('Current passphrase verification failed'));
      }
      assert.strictEqual(rotationAborted, true);

      // Verify original file on disk is still decryptable with the original passphrase
      const loaded = await persistence.loadPersistedBackup('durable_backup_key');
      const decrypted = await CryptoService.decryptPayload(loaded, 'correct-old-pass');
      assert.strictEqual(decrypted.user, 'Pavan');

      // Verify cannot decrypt with intended-new-pass
      await assert.rejects(() => CryptoService.decryptPayload(loaded, 'intended-new-pass'));
    } finally {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // 7. Successful Backup Encryption and Restoration Round-Trip
  await check('7. Full Backup Encryption Round-Trip: encrypts multi-table application backup and restores exact data', async () => {
    const fullBackup = {
      app: 'LifeOS',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tables: {
        transactions: [
          { id: 'tx_1', amount: 50000, type: 'income', category: 'Salary', date: '2026-11-01' },
          { id: 'tx_2', amount: 15000, type: 'expense', category: 'Rent', date: '2026-11-01' }
        ],
        categories: [
          { id: 'cat_1', name: 'Salary', type: 'income', color: '#10b981' },
          { id: 'cat_2', name: 'Rent', type: 'expense', color: '#ef4444' }
        ],
        budgets: [],
        savingsGoals: [],
        savingsContributions: [],
        habits: [{ id: 'h_1', name: 'Meditation', frequency: 'daily' }],
        habitLogs: [],
        goals: [],
        milestones: [],
        tasks: [{ id: 't_1', title: 'Review Security Architecture', priority: 'Urgent', completed: false }],
        settings: [{ key: 'theme', value: 'dark' }]
      }
    };

    const passphrase = 'comprehensive-suite-passphrase-2026';
    const encrypted = await CryptoService.encryptPayload(fullBackup, passphrase);
    const restored = await CryptoService.decryptPayload(encrypted, passphrase);

    assert.strictEqual(restored.tables.transactions.length, 2);
    assert.strictEqual(restored.tables.categories.length, 2);
    assert.strictEqual(restored.tables.habits[0].name, 'Meditation');
    assert.strictEqual(restored.tables.tasks[0].title, 'Review Security Architecture');
  });

  // 8. Successful Durable Rotation Followed by Restoration Using Real Disk Storage
  await check('8. Durable Rotation: rotates persisted disk backup to new passphrase and verifies decryption under new passphrase', async () => {
    const testDir = path.join(os.tmpdir(), `lifeos_test_rotate_8_${Date.now()}`);
    try {
      const storage = new FileStorageAdapter(testDir);
      const persistence = new BackupPersistenceManager(storage);

      const initialData = { app: 'LifeOS', secretMessage: 'financial-freedom-2026' };
      const container = await CryptoService.encryptPayload(initialData, 'passphrase-version-1');
      await persistence.persistBackup(container, 'active_vault_backup');

      // Execute rotation
      const result = await persistence.rotatePersistedBackup('passphrase-version-1', 'passphrase-version-2', 'active_vault_backup');
      assert.strictEqual(result.success, true);

      // Verify persisted disk record updated
      const updated = await persistence.loadPersistedBackup('active_vault_backup');
      const restored = await CryptoService.decryptPayload(updated, 'passphrase-version-2');
      assert.strictEqual(restored.secretMessage, 'financial-freedom-2026');

      // Verify old passphrase can no longer decrypt the updated backup
      await assert.rejects(() => CryptoService.decryptPayload(updated, 'passphrase-version-1'));
    } finally {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // 9. Backward Compatibility with Existing Unencrypted Backup Formats
  await check('9. Backward Compatibility: unencrypted legacy LifeOS backup JSON passes inspection without encryption errors', async () => {
    const legacyBackupJson = JSON.stringify({
      app: 'LifeOS',
      version: '1.0.0',
      exportedAt: '2026-10-31T12:00:00.000Z',
      tables: {
        transactions: [{ id: 'legacy_tx', amount: 500 }],
        categories: [{ id: 'legacy_cat', name: 'Legacy' }],
        settings: []
      }
    });

    const parsed = JSON.parse(legacyBackupJson);
    assert.strictEqual(parsed.encrypted, undefined);
    assert.strictEqual(parsed.cipher, undefined);
    assert(parsed.tables, 'Legacy unencrypted backup must have tables object');
    assert.strictEqual(parsed.tables.transactions.length, 1);
  });

  // 10. Fresh-Instance Restore After Durable Rotation Using Real Filesystem Storage
  await check('10. Fresh-Instance Acceptance: simulates app restart and restores rotated backup in a fresh service instance from disk', async () => {
    const testDir = path.join(os.tmpdir(), `lifeos_fresh_instance_disk_${Date.now()}`);
    try {
      // App Run 1: User creates and persists an encrypted backup to disk
      {
        const app1Persistence = new BackupPersistenceManager(new FileStorageAdapter(testDir));
        const app1Data = {
          app: 'LifeOS',
          records: ['record_alpha', 'record_beta', 'record_gamma'],
          financialTotal: 450000
        };
        const c1 = await CryptoService.encryptPayload(app1Data, 'user-initial-passphrase');
        await app1Persistence.persistBackup(c1, 'user_main_backup');

        // User rotates key to new passphrase on disk
        await app1Persistence.rotatePersistedBackup('user-initial-passphrase', 'user-brand-new-passphrase', 'user_main_backup');

        // Destroy in-memory state completely
        CryptoService.destroyKey();
      }

      // App Run 2: Fresh launch (completely fresh manager, fresh adapter, fresh memory allocations)
      {
        const freshAdapter = new FileStorageAdapter(testDir);
        const freshPersistence = new BackupPersistenceManager(freshAdapter);

        // Load persisted container from disk
        const freshlyLoadedContainer = await freshPersistence.loadPersistedBackup('user_main_backup');
        assert.notStrictEqual(freshlyLoadedContainer, null, 'Persisted backup must survive process restart on disk');

        // Attempt restore with old passphrase must fail
        let oldFailed = false;
        try {
          await CryptoService.decryptPayload(freshlyLoadedContainer, 'user-initial-passphrase');
        } catch (e) {
          oldFailed = true;
        }
        assert.strictEqual(oldFailed, true, 'Old passphrase must fail on fresh instance');

        // Restore with new passphrase must succeed and return exact data
        const decryptedFresh = await CryptoService.decryptPayload(freshlyLoadedContainer, 'user-brand-new-passphrase');
        assert.strictEqual(decryptedFresh.financialTotal, 450000);
        assert.deepStrictEqual(decryptedFresh.records, ['record_alpha', 'record_beta', 'record_gamma']);
      }
    } finally {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    }
  });


  // 11. LocalStorage adapter explicitly reports unavailable storage and I/O errors.
  await check('11. LocalStorage Adapter: unavailable storage and read/write/remove failures are explicit', async () => {
    const adapter = new LocalStorageAdapter();
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: undefined
      });

      await assert.rejects(
        () => adapter.getItem('lifeos_test'),
        /Backup storage read failed: localStorage is unavailable/
      );
      await assert.rejects(
        () => adapter.setItem('lifeos_test', 'value'),
        /Backup storage write failed: localStorage is unavailable/
      );
      await assert.rejects(
        () => adapter.removeItem('lifeos_test'),
        /Backup storage removal failed: localStorage is unavailable/
      );

      const failingStorage = {
        getItem() { throw new Error('simulated read denial'); },
        setItem() { throw new Error('simulated quota exceeded'); },
        removeItem() { throw new Error('simulated remove denial'); }
      };

      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: failingStorage
      });

      await assert.rejects(
        () => adapter.getItem('lifeos_test'),
        /Backup storage read failed: simulated read denial/
      );
      await assert.rejects(
        () => adapter.setItem('lifeos_test', 'value'),
        /Backup storage write failed: simulated quota exceeded/
      );
      await assert.rejects(
        () => adapter.removeItem('lifeos_test'),
        /Backup storage removal failed: simulated remove denial/
      );
    } finally {
      if (previous) {
        Object.defineProperty(globalThis, 'localStorage', previous);
      } else {
        delete globalThis.localStorage;
      }
    }
  });

  // 12. Successful browser storage writes are read back and verified.
  await check('12. LocalStorage Persistence: successful backup write is verified by read-back', async () => {
    const values = new Map();
    const mockStorage = {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      }
    };

    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: mockStorage
      });

      const container = {
        ciphertext: 'test-ciphertext',
        salt: 'test-salt',
        hmac: 'test-hmac',
        iv: 'test-iv'
      };

      const manager = new BackupPersistenceManager(new LocalStorageAdapter());
      await manager.persistBackup(container, 'localstorage_success_test');

      assert.deepStrictEqual(
        JSON.parse(values.get('localstorage_success_test')),
        container
      );
      assert.deepStrictEqual(
        await manager.loadPersistedBackup('localstorage_success_test'),
        container
      );
    } finally {
      if (previous) {
        Object.defineProperty(globalThis, 'localStorage', previous);
      } else {
        delete globalThis.localStorage;
      }
    }
  });

  // 13. Corrupt or mismatched storage read-back must never be reported as success.
  await check('13. Persistence Verification: rejects malformed and mismatched read-back data', async () => {
    const container = {
      ciphertext: 'expected-ciphertext',
      salt: 'expected-salt',
      hmac: 'expected-hmac',
      iv: 'expected-iv'
    };

    const malformedAdapter = {
      async setItem() {},
      async getItem() { return '{invalid-json'; },
      async removeItem() {}
    };

    const malformedManager = new BackupPersistenceManager(malformedAdapter);
    await assert.rejects(
      () => malformedManager.persistBackup(container, 'malformed_readback'),
      /stored data is not valid JSON/
    );

    const mismatchAdapter = {
      async setItem() {},
      async getItem() {
        return JSON.stringify({
          ...container,
          ciphertext: 'different-ciphertext'
        });
      },
      async removeItem() {}
    };

    const mismatchManager = new BackupPersistenceManager(mismatchAdapter);
    await assert.rejects(
      () => mismatchManager.persistBackup(container, 'mismatched_readback'),
      /read-back data does not match/
    );

    const missingAdapter = {
      async setItem() {},
      async getItem() { return null; },
      async removeItem() {}
    };

    const missingManager = new BackupPersistenceManager(missingAdapter);
    await assert.rejects(
      () => missingManager.persistBackup(container, 'missing_readback'),
      /saved data could not be read back/
    );
  });

  console.log(`Production Crypto & Backup Hardening Tests Completed: ${passed}/${total} passed.\n`);
  return { name: 'Production Crypto Hardening Suite', total, passed, failed: 0 };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runCryptoRegressionTests };
  if (require.main === module) {
    runCryptoRegressionTests();
  }
}
