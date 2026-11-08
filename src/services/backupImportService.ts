import { decryptBackup, MAX_BACKUP_FILE_BYTES, assertBackupByteLength } from './backupCryptoService';

/** Explicit legacy conversion; an invalid encrypted envelope never falls back to plaintext. */
export async function decodeBackupForRestore(text: string, options: {
  requestPassphrase(): Promise<string | null>;
  confirmLegacy(): boolean | Promise<boolean>;
  validateTables(tables: unknown): string[];
}): Promise<string | null> {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_FILE_BYTES) throw new Error('Backup file is too large.');
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { throw new Error('Invalid backup JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid backup object.');
  let plaintext = text;
  if (Object.prototype.hasOwnProperty.call(parsed, 'format')) {
    if (parsed.format !== 'LifeOS-Encrypted-Backup') throw new Error('Unsupported backup format.');
    const passphrase = await options.requestPassphrase();
    if (passphrase === null) return null;
    plaintext = await decryptBackup(text, passphrase);
    parsed = JSON.parse(plaintext);
  } else {
    assertBackupByteLength(new TextEncoder().encode(text).byteLength);
    options.validateTables(parsed.tables ?? parsed.data);
    if (!(await options.confirmLegacy())) return null;
  }
  options.validateTables(parsed.tables ?? parsed.data);
  return plaintext;
}
