import { Capacitor, registerPlugin } from '@capacitor/core';

export interface CryptoOperationResult {
  success: boolean;
  keyVersion?: number;
  errorCode?: number;
  message?: string;
}

export interface EncryptedRecord {
  iv: string;
  ciphertext: string;
  keyVersion: number;
}

export interface RecoveryEnvelope {
  version: number;
  kdf: string;
  iterations: number;
  salt: string;
  iv: string;
  wrappedKey: string;
}

export interface PreparedRecovery {
  recoveryCode: string;
  envelope: RecoveryEnvelope;
}

export interface CryptoKeyState {
  keyProvisioned: boolean;
  recoveryProvisioned: boolean;
  recoveryNeedsRebind: boolean;
  metadataConsistent: boolean;
  keystoreAliasPresent: boolean;
  unlocked: boolean;
}

interface NativeCryptoPlugin {
  prepareRecovery(): Promise<{
    success: boolean;
    recoveryCode: string;
    envelope: RecoveryEnvelope;
  }>;
  confirmRecovery(): Promise<{ success: boolean }>;
  recoverWithSecret(options: {
    recoveryCode: string;
    envelope: RecoveryEnvelope;
  }): Promise<CryptoOperationResult>;
  rebindLocalKey(): Promise<CryptoOperationResult>;
  setup(): Promise<CryptoOperationResult>;
  unlock(): Promise<CryptoOperationResult>;
  lock(): Promise<{ success: boolean }>;
  getKeyState(): Promise<CryptoKeyState>;
  isUnlocked(): Promise<{ unlocked: boolean }>;
  encrypt(options: {
    plaintext: string;
    aad: string;
  }): Promise<EncryptedRecord>;
  decrypt(options: {
    iv: string;
    ciphertext: string;
    aad: string;
  }): Promise<{ plaintext: string }>;
}

const nativeCrypto = registerPlugin<NativeCryptoPlugin>('LifeOSCrypto');

const RECORD_TABLES = new Set([
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
]);

function assertNativeCryptoAvailable(): void {
  if (!Capacitor.isPluginAvailable('LifeOSCrypto')) {
    throw new Error('LifeOS native encryption is unavailable on this platform.');
  }
}

function buildRecordAad(
  table: string,
  recordId: string,
  schemaVersion: number
): string {
  if (!RECORD_TABLES.has(table)) {
    throw new Error('Unsupported encrypted record table.');
  }

  if (
    typeof recordId !== 'string' ||
    recordId.length === 0 ||
    recordId.length > 256
  ) {
    throw new Error('Invalid encrypted record identifier.');
  }

  if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
    throw new Error('Invalid encrypted record schema version.');
  }

  // Canonical, versioned binding prevents ciphertext being moved between
  // tables, records, or schema versions without authentication failure.
  return JSON.stringify([
    'lifeos-record',
    1,
    table,
    recordId,
    schemaVersion
  ]);
}

export const CryptoService = Object.freeze({
  isAvailable(): boolean {
    return Capacitor.isPluginAvailable('LifeOSCrypto');
  },

  async prepareRecovery(): Promise<PreparedRecovery> {
    assertNativeCryptoAvailable();

    const result = await nativeCrypto.prepareRecovery();

    if (
      !result ||
      result.success !== true ||
      typeof result.recoveryCode !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(result.recoveryCode)
    ) {
      throw new Error('Native recovery preparation returned an invalid code.');
    }

    const envelope = result.envelope;

    if (
      !envelope ||
      envelope.version !== 1 ||
      envelope.kdf !== 'PBKDF2-HMAC-SHA-256' ||
      envelope.iterations !== 600000 ||
      typeof envelope.salt !== 'string' ||
      !/^[A-Za-z0-9+/]{22}==$/.test(envelope.salt) ||
      typeof envelope.iv !== 'string' ||
      !/^[A-Za-z0-9+/]{16}$/.test(envelope.iv) ||
      typeof envelope.wrappedKey !== 'string' ||
      !/^[A-Za-z0-9+/]{64}$/.test(envelope.wrappedKey)
    ) {
      throw new Error('Native recovery preparation returned an invalid envelope.');
    }

    return {
      recoveryCode: result.recoveryCode,
      envelope
    };
  },

  async confirmRecovery(): Promise<void> {
    assertNativeCryptoAvailable();

    const result = await nativeCrypto.confirmRecovery();
    if (!result || result.success !== true) {
      throw new Error('Native recovery confirmation failed.');
    }
  },

  async recoverWithSecret(
    recoveryCode: string,
    envelope: RecoveryEnvelope
  ): Promise<CryptoOperationResult> {
    assertNativeCryptoAvailable();

    if (
      typeof recoveryCode !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(recoveryCode)
    ) {
      throw new Error('Invalid recovery code format.');
    }

    if (
      !envelope ||
      envelope.version !== 1 ||
      envelope.kdf !== 'PBKDF2-HMAC-SHA-256' ||
      envelope.iterations !== 600000 ||
      !/^[A-Za-z0-9+/]{22}==$/.test(envelope.salt) ||
      !/^[A-Za-z0-9+/]{16}$/.test(envelope.iv) ||
      !/^[A-Za-z0-9+/]{64}$/.test(envelope.wrappedKey)
    ) {
      throw new Error('Invalid or unsupported recovery envelope.');
    }

    return nativeCrypto.recoverWithSecret({ recoveryCode, envelope });
  },

  async rebindLocalKey(): Promise<CryptoOperationResult> {
    assertNativeCryptoAvailable();
    return nativeCrypto.rebindLocalKey();
  },

  async setup(): Promise<CryptoOperationResult> {
    assertNativeCryptoAvailable();
    return nativeCrypto.setup();
  },

  async unlock(): Promise<CryptoOperationResult> {
    assertNativeCryptoAvailable();
    return nativeCrypto.unlock();
  },

  async lock(): Promise<void> {
    assertNativeCryptoAvailable();
    const result = await nativeCrypto.lock();
    if (!result.success) throw new Error('Native encryption lock failed.');
  },

  async getKeyState(): Promise<CryptoKeyState> {
    assertNativeCryptoAvailable();

    const state = await nativeCrypto.getKeyState();

    if (
      !state ||
      typeof state.keyProvisioned !== 'boolean' ||
      typeof state.recoveryProvisioned !== 'boolean' ||
      typeof state.recoveryNeedsRebind !== 'boolean' ||
      typeof state.metadataConsistent !== 'boolean' ||
      typeof state.keystoreAliasPresent !== 'boolean' ||
      typeof state.unlocked !== 'boolean'
    ) {
      throw new Error('Native encryption returned an invalid key state.');
    }

    return state;
  },

  async isUnlocked(): Promise<boolean> {
    assertNativeCryptoAvailable();
    const result = await nativeCrypto.isUnlocked();
    return result.unlocked === true;
  },
  async encryptRecord(
    table: string,
    recordId: string,
    schemaVersion: number,
    plaintext: string
  ): Promise<EncryptedRecord> {
    assertNativeCryptoAvailable();

    if (typeof plaintext !== 'string') {
      throw new Error('Encrypted record plaintext must be a string.');
    }

    return nativeCrypto.encrypt({
      plaintext,
      aad: buildRecordAad(table, recordId, schemaVersion)
    });
  },

  async decryptRecord(
    table: string,
    recordId: string,
    schemaVersion: number,
    encrypted: EncryptedRecord
  ): Promise<string> {
    assertNativeCryptoAvailable();

    if (
      !encrypted ||
      typeof encrypted.iv !== 'string' ||
      typeof encrypted.ciphertext !== 'string' ||
      encrypted.keyVersion !== 1
    ) {
      throw new Error('Invalid or unsupported encrypted record envelope.');
    }

    const result = await nativeCrypto.decrypt({
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      aad: buildRecordAad(table, recordId, schemaVersion)
    });

    if (typeof result.plaintext !== 'string') {
      throw new Error('Native decryption returned an invalid result.');
    }

    return result.plaintext;
  }
});

export { buildRecordAad };
