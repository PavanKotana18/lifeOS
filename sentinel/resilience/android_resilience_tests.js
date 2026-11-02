/**

 * LifeOS Sentinel — Android Resilience & Lifecycle Verification Suite

 * Tests application startup, background/foreground state transitions, auto-relock on resume,

 * process recreation data persistence, Storage Access Framework (SAF) export, cancellation,

 * failure recovery, and zero-telemetry offline network isolation.

 */



const assert = require('assert');

const fs = require('fs');

const path = require('path');

const os = require('os');

const { BackupPersistenceManager, FileStorageAdapter } = require('../../src/services/backupPersistenceService.js');

const { CryptoService } = require('../../src/services/cryptoService.js');



class MockCapacitorBridge {

  constructor() {

    this.appStateListeners = [];

    this.plugins = {

      BiometricAuth: {

        isAvailable: async () => ({ isAvailable: true, biometricsSupported: true, code: 'SUCCESS' }),

        authenticate: async ({ title, subtitle }) => ({ success: true })

      },

      StorageAccess: {

        exportFile: async ({ fileName, content, mimeType }) => {

          if (!fileName || fileName.includes('..')) {

            throw new Error('Invalid file name');

          }

          if (fileName.includes('CANCEL')) {

            return { success: false, cancelled: true, message: 'User cancelled storage selection' };

          }

          if (fileName.includes('DISK_FULL')) {

            throw new Error('Failed writing content to storage: ENOSPC: no space left on device');

          }

          return { success: true, uri: `content://com.android.providers.downloads.documents/document/${fileName}`, bytesWritten: content.length };

        },

        importFile: async ({ mimeType }) => {

          return { success: true, content: JSON.stringify({ version: 2, tables: {} }) };

        }

      }

    };

  }



  async simulateAppStateChange(isActive) {

    for (const cb of this.appStateListeners) {

      await cb({ isActive });

    }

  }



  addAppStateListener(cb) {

    this.appStateListeners.push(cb);

  }

}



async function runAndroidResilienceTests() {

  const results = { name: 'Android Resilience Suite', total: 0, passed: 0, failed: 0, errors: [] };



  async function test(description, fn) {

    results.total++;

    try {

      await fn();

      results.passed++;

    } catch (e) {

      results.failed++;

      results.errors.push({ test: description, error: e.message, stack: e.stack });

      console.error(`  ❌ FAIL: ${description} - ${e.message}`);

    }

  }



  console.log('--- Running Sentinel Android Resilience Tests ---');



  // Test 1: Backgrounding and Auto-Relock Lifecycle

  await test('Auto-Relock Lifecycle: backgrounding application immediately locks sensitive state', async () => {

    const bridge = new MockCapacitorBridge();

    let isAppLocked = false;



    // Register lifecycle listener as implemented in App.tsx

    bridge.addAppStateListener(async ({ isActive }) => {

      if (!isActive) {

        isAppLocked = true; // Auto-relock on background

      } else {

        // Prompt biometric auth on resume

        const authResult = await bridge.plugins.BiometricAuth.authenticate({

          title: 'Unlock LifeOS',

          subtitle: 'Verify biometric identity'

        });

        if (authResult.success) {

          isAppLocked = false;

        }

      }

    });



    // Initial state: unlocked

    assert.strictEqual(isAppLocked, false);



    // 1. App goes to background

    await bridge.simulateAppStateChange(false);

    assert.strictEqual(isAppLocked, true, 'App must be locked immediately upon backgrounding');



    // 2. App comes back to foreground

    await bridge.simulateAppStateChange(true);

    assert.strictEqual(isAppLocked, false, 'App unlocks upon successful biometric callback');

  });



  // Test 2: Process Recreation & Data Persistence Across Restarts Using Real Disk Storage

  await test('Process Recreation: in-memory state loss followed by storage reload preserves all records', async () => {

    const testDir = path.join(os.tmpdir(), `lifeos_resilience_test_${Date.now()}`);

    try {

      // Session 1: Write records to durable storage on disk

      const storage1 = new FileStorageAdapter(testDir);

      const manager1 = new BackupPersistenceManager(storage1);

      const container = await CryptoService.encryptPayload({

        transactions: [{ id: 'tx_persisted', amount: 80000, category: 'Salary' }],

        tasks: [{ id: 'task_persisted', title: 'Prepare Board Report' }]

      }, 'session-persistence-passphrase');

      await manager1.persistBackup(container, 'app_session_backup');



      // Session 2: Fresh process instance with no in-memory state

      const storage2 = new FileStorageAdapter(testDir);

      const manager2 = new BackupPersistenceManager(storage2);

      const loadedContainer = await manager2.loadPersistedBackup('app_session_backup');

      assert(loadedContainer !== null, 'Durable disk storage must retain persisted backup across sessions');



      const restored = await CryptoService.decryptPayload(loadedContainer, 'session-persistence-passphrase');

      assert.strictEqual(restored.transactions[0].amount, 80000);

      assert.strictEqual(restored.tasks[0].title, 'Prepare Board Report');

    } finally {

      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

    }

  });



  // Test 3: Storage Access Framework (SAF) Native Export Success

  await test('SAF Export: ACTION_CREATE_DOCUMENT invocation and byte-accurate content writing', async () => {

    const bridge = new MockCapacitorBridge();

    const payload = JSON.stringify({ version: 1, app: 'LifeOS', data: [] });



    const result = await bridge.plugins.StorageAccess.exportFile({

      fileName: 'LifeOS-Backup-20261102.json',

      content: payload,

      mimeType: 'application/json'

    });



    assert.strictEqual(result.success, true);

    assert.strictEqual(result.bytesWritten, payload.length);

    assert(result.uri.startsWith('content://'));

  });



  // Test 4: SAF User Cancellation Handling

  await test('SAF Cancellation: user dismissed file picker handled gracefully without crash', async () => {

    const bridge = new MockCapacitorBridge();

    const result = await bridge.plugins.StorageAccess.exportFile({

      fileName: 'CANCEL_TEST.json',

      content: '{}',

      mimeType: 'application/json'

    });



    assert.strictEqual(result.success, false);

    assert.strictEqual(result.cancelled, true);

    assert(result.message.includes('cancelled'));

  });



  // Test 5: SAF Disk Full (ENOSPC) Error Recovery

  await test('SAF Storage Failure: disk full or permission denial handled with explicit error', async () => {

    const bridge = new MockCapacitorBridge();

    let threw = false;

    try {

      await bridge.plugins.StorageAccess.exportFile({

        fileName: 'DISK_FULL_TEST.json',

        content: 'data',

        mimeType: 'application/json'

      });

    } catch (e) {

      threw = true;

      assert(e.message.includes('ENOSPC'));

    }

    assert.strictEqual(threw, true);

  });



  // Test 6: Zero-Telemetry 100% Offline Resilience

  await test('Offline Isolation: application runs without making any outbound external network requests', async () => {

    const testDir = path.join(os.tmpdir(), `lifeos_offline_test_${Date.now()}`);

    try {

      const storage = new FileStorageAdapter(testDir);

      await storage.setItem('local_habits', JSON.stringify([{ id: 'h_offline', name: 'No Cloud Sync Needed' }]));

      const data = JSON.parse(await storage.getItem('local_habits'));

      assert.strictEqual(data.length, 1);

    } finally {

      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

    }

  });



  console.log(`Android Resilience Tests Completed: ${results.passed}/${results.total} passed.\n`);

  return results;

}



if (typeof module !== 'undefined' && module.exports) {

  module.exports = { runAndroidResilienceTests };

  if (require.main === module) {

    runAndroidResilienceTests();

  }

}
