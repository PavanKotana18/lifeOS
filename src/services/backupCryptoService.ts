const FORMAT = 'LifeOS-Encrypted-Backup';
const VERSION = 1;
const KDF = 'PBKDF2-HMAC-SHA-256';
const ITERATIONS = 310000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MIN_PASSPHRASE_LENGTH = 12;
const MAX_BACKUP_CHARS = 100 * 1024 * 1024;

interface EncryptedBackupEnvelope {
  format: string;
  version: number;
  cipher: 'AES-256-GCM';
  kdf: typeof KDF;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function cryptoProvider(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Secure backup encryption is unavailable in this runtime.');
  }
  return globalThis.crypto;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: unknown, maxBytes: number): Uint8Array {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Invalid encrypted backup encoding.');
  }
  const binary = atob(value);
  if (!binary.length || binary.length > maxBytes) {
    throw new Error('Encrypted backup field has an invalid size.');
  }
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function assertPassphrase(passphrase: string, exporting: boolean): void {
  if (typeof passphrase !== 'string' ||
      passphrase.length < (exporting ? MIN_PASSPHRASE_LENGTH : 1) ||
      passphrase.length > 1024 ||
      passphrase.trim().length === 0) {
    throw new Error(exporting
      ? 'Use a backup passphrase with at least 12 characters.'
      : 'A valid backup passphrase is required.');
  }
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const crypto = cryptoProvider();
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: asArrayBuffer(salt), iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function additionalData(): Uint8Array {
  return new TextEncoder().encode(`${FORMAT}:v${VERSION}:AES-256-GCM`);
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer as ArrayBuffer;
}

export async function encryptBackup(
  plaintext: string,
  passphrase: string
): Promise<string> {
  assertPassphrase(passphrase, true);
  if (typeof plaintext !== 'string' || plaintext.length === 0 || plaintext.length > MAX_BACKUP_CHARS) {
    throw new Error('Backup content is empty or exceeds the supported size.');
  }

  const crypto = cryptoProvider();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(iv), additionalData: asArrayBuffer(additionalData()), tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  );

  const envelope: EncryptedBackupEnvelope = {
    format: FORMAT,
    version: VERSION,
    cipher: 'AES-256-GCM',
    kdf: KDF,
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted))
  };
  return JSON.stringify(envelope);
}

export async function decryptBackup(
  encryptedText: string,
  passphrase: string
): Promise<string> {
  assertPassphrase(passphrase, false);
  if (typeof encryptedText !== 'string' || encryptedText.length === 0 || encryptedText.length > MAX_BACKUP_CHARS) {
    throw new Error('Encrypted backup is empty or exceeds the supported size.');
  }

  let envelope: Partial<EncryptedBackupEnvelope>;
  try {
    envelope = JSON.parse(encryptedText);
  } catch {
    throw new Error('This is not a valid encrypted LifeOS backup. Plaintext backups are not accepted.');
  }

  if (!envelope || envelope.format !== FORMAT || envelope.version !== VERSION ||
      envelope.cipher !== 'AES-256-GCM' || envelope.kdf !== KDF ||
      envelope.iterations !== ITERATIONS) {
    throw new Error('Unsupported or invalid encrypted LifeOS backup format. Plaintext backups are not accepted.');
  }

  const salt = fromBase64(envelope.salt, SALT_BYTES);
  const iv = fromBase64(envelope.iv, IV_BYTES);
  const ciphertext = fromBase64(envelope.ciphertext, MAX_BACKUP_CHARS);
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || ciphertext.length < 17) {
    throw new Error('Encrypted backup envelope has invalid cryptographic parameters.');
  }

  try {
    const key = await deriveKey(passphrase, salt);
    const decrypted = await cryptoProvider().subtle.decrypt(
      { name: 'AES-GCM', iv: asArrayBuffer(iv), additionalData: asArrayBuffer(additionalData()), tagLength: 128 },
      key,
      asArrayBuffer(ciphertext)
    );
    const plaintext = new TextDecoder('utf-8', { fatal: true }).decode(decrypted);
    // Require a JSON object before the caller passes data to the database importer.
    const parsed = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        (!parsed.tables && !parsed.data)) {
      throw new Error('Decrypted content is not a valid LifeOS backup.');
    }
    return plaintext;
  } catch (error) {
    if (error instanceof Error && error.message === 'Decrypted content is not a valid LifeOS backup.') {
      throw error;
    }
    throw new Error('Backup decryption failed. Check the passphrase or file integrity.');
  }
}
