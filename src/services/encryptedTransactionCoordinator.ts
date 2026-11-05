import type { EncryptedTable } from './encryptedRecordCodec';
import {
  withEncryptedStorageWrite
} from './encryptedDexieStore';

export interface EncryptedRepositoryLike {
  get<T>(id: string): Promise<T | undefined>;
  getAll<T>(): Promise<T[]>;
  prepare<T>(record: T): Promise<unknown>;
}

export type EncryptedRepositories = Record<
  EncryptedTable,
  EncryptedRepositoryLike
>;

export type PreparedMutation =
  | { kind: 'put' | 'add'; table: EncryptedTable; row: unknown }
  | { kind: 'delete'; table: EncryptedTable; id: string }
  | { kind: 'clear'; table: EncryptedTable };

export interface EncryptedWriteContext {
  get<T>(table: EncryptedTable, id: string): Promise<T | undefined>;
  getAll<T>(table: EncryptedTable): Promise<T[]>;
  put<T>(table: EncryptedTable, record: T): void;
  add<T>(table: EncryptedTable, record: T): void;
  delete(table: EncryptedTable, id: string): void;
  clear(table: EncryptedTable): void;
}

export interface EncryptedTransactionCoordinatorOptions {
  repositories: EncryptedRepositories;

  /**
   * Must commit the complete mutation list in ONE Dexie read-write
   * transaction spanning every affected table.
   *
   * This callback receives prepared ciphertext only. It must not invoke
   * native crypto, repository methods, or this coordinator.
   */
  commit(mutations: PreparedMutation[]): Promise<void>;
}

function recordIdentity(table: EncryptedTable, record: any): string {
  const id = table === 'settings' ? record?.key : record?.id;

  if (typeof id !== 'string' || !id.trim() || id.length > 256) {
    throw new Error(`Invalid ${table} record identity.`);
  }

  return id;
}

export function createEncryptedTransactionCoordinator(
  options: EncryptedTransactionCoordinatorOptions
) {
  const { repositories, commit } = options;

  return Object.freeze({
    async run<T>(
      operation: (context: EncryptedWriteContext) => Promise<T>
    ): Promise<T> {
      return withEncryptedStorageWrite(async () => {
        const staged: Array<
          | { kind: 'put' | 'add'; table: EncryptedTable; record: any; id: string }
          | { kind: 'delete'; table: EncryptedTable; id: string }
          | { kind: 'clear'; table: EncryptedTable }
        > = [];

        const context: EncryptedWriteContext = {
          async get<TRecord>(table: EncryptedTable, id: string) {
            for (let index = staged.length - 1; index >= 0; index -= 1) {
              const item = staged[index];
              if (item.table !== table) continue;
              if (item.kind === 'clear') return undefined;
              if (item.kind === 'delete' && item.id === id) return undefined;
              if (
                (item.kind === 'put' || item.kind === 'add') &&
                item.id === id
              ) {
                return item.record as TRecord;
              }
            }
            return repositories[table].get<TRecord>(id);
          },

          async getAll<TRecord>(table: EncryptedTable) {
            const records = await repositories[table].getAll<TRecord>();
            const byId = new Map<string, TRecord>(
              records.map(record => [
                recordIdentity(table, record),
                record
              ])
            );

            for (const item of staged) {
              if (item.table !== table) continue;

              if (item.kind === 'clear') {
                byId.clear();
              } else if (item.kind === 'delete') {
                byId.delete(item.id);
              } else {
                byId.set(item.id, item.record as TRecord);
              }
            }

            return [...byId.values()];
          },

          put<TRecord>(table: EncryptedTable, record: TRecord) {
            staged.push({
              kind: 'put',
              table,
              record,
              id: recordIdentity(table, record)
            });
          },

          add<TRecord>(table: EncryptedTable, record: TRecord) {
            staged.push({
              kind: 'add',
              table,
              record,
              id: recordIdentity(table, record)
            });
          },

          delete(table: EncryptedTable, id: string) {
            if (typeof id !== 'string' || !id.trim()) {
              throw new Error(`Invalid ${table} delete identity.`);
            }
            staged.push({ kind: 'delete', table, id });
          },

          clear(table: EncryptedTable) {
            staged.push({ kind: 'clear', table });
          }
        };

        // Business logic and logical reads happen while holding the shared
        // queue, preventing another encrypted write from interleaving.
        const result = await operation(context);

        // Complete all encryption before the database transaction begins.
        const prepared: PreparedMutation[] = [];
        for (const item of staged) {
          if (item.kind === 'put' || item.kind === 'add') {
            const row = await repositories[item.table].prepare(item.record);
            prepared.push({
              kind: item.kind,
              table: item.table,
              row
            });
            } else if (item.kind === 'delete') {
              prepared.push({
                kind: 'delete',
                table: item.table,
                id: item.id
              });
            } else {
              prepared.push({
                kind: 'clear',
                table: item.table
              });
            }
        }

        if (prepared.length > 0) {
          await commit(prepared);
        }

        return result;
      });
    }
  });
}
