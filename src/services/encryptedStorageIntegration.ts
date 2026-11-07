import {
  ENCRYPTABLE_TABLES,
  type EncryptedTable,
  createEncryptedRecordCodec
} from './encryptedRecordCodec';
import {
  createEncryptedDexieStore,
  withEncryptedStorageWrite,
  type DexieTableLike
} from './encryptedDexieStore';
import { CryptoService } from './cryptoService.ts';
import {
  createEncryptedTransactionCoordinator,
  type EncryptedRepositories,
  type PreparedMutation
} from './encryptedTransactionCoordinator';

export const BOOTSTRAP_SETTING_KEYS = new Set([
  'theme',
  'visualTheme',
  'biometricLockEnabled',
  'onboardingCompleted',
  'onboardingStarted',
  'onboardingStep',
  // Notification controls are non-content preferences needed before first unlock.
  'notificationPreferences',
  'notificationsEnabled',
  'notificationPermissionRequested',
  'notificationDefaultsPending'
]);

export type LifeOSRawDatabase = Record<EncryptedTable, DexieTableLike>;

export function createLifeOSEncryptedRepositories(
  database: LifeOSRawDatabase
) {
  const codec = createEncryptedRecordCodec(CryptoService);
  return Object.freeze(Object.fromEntries(
    ENCRYPTABLE_TABLES.map(tableName => [
      tableName,
      createEncryptedDexieStore({
        tableName,
        table: database[tableName],
        codec,
        bootstrapKeys: tableName === 'settings' ? BOOTSTRAP_SETTING_KEYS : undefined
      })
    ])
  ) as Record<EncryptedTable, ReturnType<typeof createEncryptedDexieStore>>);
}

export interface MigrationResult {
  migrated: Record<EncryptedTable, number>;
  skippedEncrypted: Record<EncryptedTable, number>;
  skippedBootstrap: number;
}

/**
 * Resumable, idempotent plaintext-to-ciphertext migration.
 *
 * Call only after native CryptoService setup/unlock has completed and while
 * application data access is quiesced. Each row is sealed before its IndexedDB
 * put. A crash can leave a mixture of plaintext and encrypted rows; rerunning
 * safely continues because already-encrypted rows are skipped.
 *
 * This function never clears a table and never overwrites an encrypted row.
 */
export async function migrateLifeOSRecords(
  database: LifeOSDatabaseWithTransactions,
  repositories: ReturnType<typeof createLifeOSEncryptedRepositories>
): Promise<MigrationResult> {
  return withEncryptedStorageWrite(async () => {
  const migrated = {} as Record<EncryptedTable, number>;
  const skippedEncrypted = {} as Record<EncryptedTable, number>;
  let skippedBootstrap = 0;

  for (const tableName of ENCRYPTABLE_TABLES) {
    migrated[tableName] = 0;
    skippedEncrypted[tableName] = 0;

    const table = database[tableName];
    const rows = await table.toArray();

    for (const row of rows) {
      if (!row || typeof row !== 'object') {
        throw new Error(`Migration stopped: invalid ${tableName} row.`);
      }

      const hasMarker = Object.prototype.hasOwnProperty.call(row, '__lifeosEncrypted');
      const hasEnvelope = Object.prototype.hasOwnProperty.call(row, 'encrypted');

      if (hasMarker || hasEnvelope) {
        if (row.__lifeosEncrypted !== 1 || !row.encrypted ||
            typeof row.encrypted !== 'object') {
          throw new Error(`Migration stopped: malformed encrypted ${tableName} row.`);
        }
        await repositories[tableName].open(row);
        skippedEncrypted[tableName] += 1;
        continue;
      }

      if (
        tableName === 'settings' &&
        typeof row.key === 'string' &&
        BOOTSTRAP_SETTING_KEYS.has(row.key)
      ) {
        skippedBootstrap += 1;
        continue;
      }

      const identity = tableName === 'settings' ? row.key : row.id;
      if (typeof identity !== 'string' || !identity.trim()) {
        throw new Error(`Migration stopped: ${tableName} row has no stable primary key.`);
      }

      // Prepare ciphertext before the IndexedDB write. No native crypto call
      // is made inside a Dexie transaction.
      const encryptedRow = await repositories[tableName].prepare(row);
      const verifiedCopy = await repositories[tableName].open(encryptedRow);
      if (JSON.stringify(verifiedCopy) !== JSON.stringify(row)) {
        throw new Error(`Migration stopped: encrypted ${tableName} copy did not verify.`);
      }

      // Compare and replace in one IndexedDB transaction. Native encryption
      // and verification above must never run inside this transaction.
      await database.transaction('rw', table, async () => {
        const latest = await table.get(identity);
        if (!latest) throw new Error(`Migration stopped: ${tableName}/${identity} disappeared.`);
        if (JSON.stringify(latest) !== JSON.stringify(row)) {
          throw new Error(`Migration stopped: ${tableName}/${identity} changed during migration; retry safely.`);
        }
        await table.put(encryptedRow);
      });
      migrated[tableName] += 1;
    }
  }

  return { migrated, skippedEncrypted, skippedBootstrap };
  });
}

export interface LifeOSDatabaseWithTransactions extends LifeOSRawDatabase {
  transaction(mode: 'rw', ...tablesAndScope: any[]): Promise<any>;
}

/**
 * Creates the production Dexie commit adapter.
 *
 * All ciphertext must already be prepared by the coordinator. This adapter
 * performs only IndexedDB operations inside one Dexie read-write transaction.
 */
export function createLifeOSEncryptedTransactionCoordinator(
  database: LifeOSDatabaseWithTransactions,
  repositories: EncryptedRepositories =
    createLifeOSEncryptedRepositories(database)
) {
  return createEncryptedTransactionCoordinator({
    repositories,
    async commit(mutations: PreparedMutation[]) {
      const affectedTables = [
        ...new Set(mutations.map(mutation => mutation.table))
      ];
      const dexieTables = affectedTables.map(
        tableName => database[tableName]
      );

      await database.transaction('rw', ...dexieTables, async () => {
        for (const mutation of mutations) {
          const table = database[mutation.table];

          switch (mutation.kind) {
            case 'add':
              await table.add(mutation.row);
              break;
            case 'put':
              await table.put(mutation.row);
              break;
            case 'delete':
              await table.delete(mutation.id);
              break;
            case 'clear':
              await table.clear();
              break;
          }
        }
      });
    }
  });
}
