import type { EncryptedRecordRow, EncryptedTable } from './encryptedRecordCodec';

export interface EncryptedRecordCodec {
  seal(table: string, recordId: string, record: unknown): Promise<EncryptedRecordRow>;
  open<T>(table: string, row: unknown): Promise<T>;
}

export interface DexieTableLike {
  get(key: string): Promise<any>;
  toArray(): Promise<any[]>;
  add(row: any): Promise<any>;
  put(row: any): Promise<any>;
  bulkPut(rows: any[]): Promise<any>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface EncryptedDexieStoreOptions {
  tableName: EncryptedTable;
  table: DexieTableLike;
  codec: EncryptedRecordCodec;
  bootstrapKeys?: ReadonlySet<string>;
}

function identityOf(tableName: string, record: any): string {
  const identity = tableName === 'settings' ? record?.key : record?.id;
  if (typeof identity !== 'string' || !identity.trim() || identity.length > 256) {
    throw new Error('Invalid encrypted storage record identity.');
  }
  return identity;
}

function isEncryptedRow(row: any): boolean {
  return Boolean(
    row &&
    typeof row === 'object' &&
    row.__lifeosEncrypted === 1 &&
    row.encrypted &&
    typeof row.encrypted === 'object'
  );
}

// All repository instances share one mutation queue. This prevents concurrent
// read-modify-write operations on related tables from interleaving.
let repositoryWriteQueue: Promise<unknown> = Promise.resolve();

function serializeRepositoryWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = repositoryWriteQueue.then(operation);
  repositoryWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

/**
 * Serializes a complete multi-table mutation.
 *
 * The callback must prepare ciphertext before opening a Dexie transaction.
 * Inside the Dexie transaction, perform only IndexedDB operations using
 * already-prepared rows. Do not call repository write methods from inside it.
 */
export function withEncryptedStorageWrite<T>(
  operation: () => Promise<T>
): Promise<T> {
  return serializeRepositoryWrite(operation);
}

export function createEncryptedDexieStore(options: EncryptedDexieStoreOptions) {
  const { tableName, table, codec } = options;
  const bootstrapKeys = new Set(options.bootstrapKeys ?? []);

  async function openRow<T>(row: any): Promise<T> {
    if (!row || typeof row !== 'object') {
      throw new Error('Invalid record returned by encrypted storage.');
    }

    const hasEncryptionMetadata =
      Object.prototype.hasOwnProperty.call(row, '__lifeosEncrypted') ||
      Object.prototype.hasOwnProperty.call(row, 'encrypted');

    if (hasEncryptionMetadata) {
      if (!isEncryptedRow(row)) {
        throw new Error('Malformed encrypted storage row; refusing plaintext fallback.');
      }
      return codec.open<T>(tableName, row);
    }

    // Legacy plaintext compatibility is read-only during the transition.
    return row as T;
  }

  async function sealRow<T>(record: T): Promise<any> {
    const recordId = identityOf(tableName, record);

    if (tableName === 'settings' && bootstrapKeys.has(recordId)) {
      return record;
    }

    return codec.seal(tableName, recordId, record);
  }

  return Object.freeze({
    // Prepare/open primitives are intentionally not queued. They allow the
    // caller to encrypt/decrypt before a single multi-table Dexie transaction.
    async prepare<T>(record: T): Promise<any> {
      return sealRow(record);
    },

    async open<T>(row: unknown): Promise<T> {
      return openRow<T>(row);
    },

    async get<T>(recordId: string): Promise<T | undefined> {
      const row = await table.get(recordId);
      if (row === undefined) return undefined;
      return openRow<T>(row);
    },

    async getAll<T>(): Promise<T[]> {
      const rows = await table.toArray();
      const records: T[] = [];
      for (const row of rows) records.push(await openRow<T>(row));
      return records;
    },

    async filter<T>(predicate: (record: T) => boolean): Promise<T[]> {
      const rows = await table.toArray();
      const records: T[] = [];
      for (const row of rows) {
        records.push(await openRow<T>(row));
      }
      return records.filter(predicate);
    },

    async add<T>(record: T): Promise<void> {
      await serializeRepositoryWrite(async () => {
        const row = await sealRow(record);
        await table.add(row);
      });
    },

    async put<T>(record: T): Promise<void> {
      await serializeRepositoryWrite(async () => {
        const row = await sealRow(record);
        await table.put(row);
      });
    },

    async update<T>(
      recordId: string,
      updater: (record: T) => T | undefined | Promise<T | undefined>
    ): Promise<void> {
      await serializeRepositoryWrite(async () => {
        const stored = await table.get(recordId);
        if (stored === undefined) return;

        const current = await openRow<T>(stored);
        const updated = await updater(current);
        if (updated === undefined) return;

        if (identityOf(tableName, updated) !== recordId) {
          throw new Error('Record updates cannot change the storage identity.');
        }

        const row = await sealRow(updated);
        await table.put(row);
      });
    },

    async bulkPut<T>(records: T[]): Promise<void> {
      await serializeRepositoryWrite(async () => {
        // Do not await native crypto inside an IndexedDB transaction.
        const rows = await Promise.all(records.map(sealRow));
        if (rows.length) await table.bulkPut(rows);
      });
    },

    async delete(recordId: string): Promise<void> {
      await serializeRepositoryWrite(() => table.delete(recordId));
    },

    async clear(): Promise<void> {
      await serializeRepositoryWrite(() => table.clear());
    },

    async getStorageKeys(): Promise<string[]> {
      const rows = await table.toArray();
      return rows.map(row => identityOf(tableName, row));
    }
  });
}
