import type { EncryptedRecord } from './cryptoService';

export const ENCRYPTED_RECORD_SCHEMA_VERSION = 1;

export const ENCRYPTABLE_TABLES = [
  'transactions',
  'categories',
  'budgets',
  'savingsGoals',
  'savingsContributions',
  'habits',
  'habitLogs',
  'goals',
  'milestones',
  'tasks',
  'settings'
] as const;

export type EncryptedTable = typeof ENCRYPTABLE_TABLES[number];

export interface RecordCryptoAdapter {
  encryptRecord(
    table: string,
    recordId: string,
    schemaVersion: number,
    plaintext: string
  ): Promise<EncryptedRecord>;

  decryptRecord(
    table: string,
    recordId: string,
    schemaVersion: number,
    encrypted: EncryptedRecord
  ): Promise<string>;
}

export interface EncryptedRecordRow {
  id?: string;
  key?: string;
  __lifeosEncrypted: 1;
  encrypted: EncryptedRecord;
}

function assertTable(table: string): asserts table is EncryptedTable {
  if (!ENCRYPTABLE_TABLES.includes(table as EncryptedTable)) {
    throw new Error('Unsupported encrypted record table.');
  }
}

function assertRecordId(id: string): void {
  if (typeof id !== 'string' || !id.trim() || id.length > 256) {
    throw new Error('Invalid encrypted record identifier.');
  }
}

function getRecordIdentity(table: EncryptedTable, record: unknown): string {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Record payload must be an object.');
  }

  const value = record as Record<string, unknown>;
  const identity = table === 'settings' ? value.key : value.id;

  if (typeof identity !== 'string') {
    throw new Error('Record payload is missing its identity.');
  }

  return identity;
}

function isEncryptedRecord(value: unknown): value is EncryptedRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.iv === 'string' &&
    typeof item.ciphertext === 'string' &&
    item.keyVersion === 1
  );
}

export function createEncryptedRecordCodec(crypto: RecordCryptoAdapter) {
  return Object.freeze({
    async seal(
      table: string,
      recordId: string,
      record: unknown
    ): Promise<EncryptedRecordRow> {
      assertTable(table);
      assertRecordId(recordId);

      if (getRecordIdentity(table, record) !== recordId) {
        throw new Error('Record identity does not match its storage key.');
      }

      const plaintext = JSON.stringify(record);
      if (typeof plaintext !== 'string') {
        throw new Error('Record could not be serialized.');
      }

      const encrypted = await crypto.encryptRecord(
        table,
        recordId,
        ENCRYPTED_RECORD_SCHEMA_VERSION,
        plaintext
      );

      if (!isEncryptedRecord(encrypted)) {
        throw new Error('Encryption returned an invalid record envelope.');
      }

      return {
        ...(table === 'settings' ? { key: recordId } : { id: recordId }),
        __lifeosEncrypted: 1,
        encrypted
      };
    },

    async open<T>(
      table: string,
      row: unknown
    ): Promise<T> {
      assertTable(table);

      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error('Invalid encrypted storage row.');
      }

      const stored = row as Record<string, unknown>;
      const recordId = table === 'settings' ? stored.key : stored.id;
      assertRecordId(typeof recordId === 'string' ? recordId : '');

      if (stored.__lifeosEncrypted !== 1 || !isEncryptedRecord(stored.encrypted)) {
        throw new Error('Unsupported or malformed encrypted storage row.');
      }

      if (
        (table === 'settings' && stored.id !== undefined) ||
        (table !== 'settings' && stored.key !== undefined)
      ) {
        throw new Error('Encrypted storage row uses the wrong primary-key field.');
      }

      const plaintext = await crypto.decryptRecord(
        table,
        recordId as string,
        ENCRYPTED_RECORD_SCHEMA_VERSION,
        stored.encrypted
      );

      if (typeof plaintext !== 'string') {
        throw new Error('Decryption returned invalid plaintext.');
      }

      let record: unknown;
      try {
        record = JSON.parse(plaintext);
      } catch {
        throw new Error('Decrypted record is not valid JSON.');
      }

      if (getRecordIdentity(table, record) !== recordId) {
        throw new Error('Decrypted record identity does not match its storage key.');
      }

      return record as T;
    }
  });
}
