import type { CryptoKeyState, RecoveryEnvelope, EncryptedRecord } from './cryptoService.ts';

export interface RecoveryChallenge {
  table: string; recordId: string; schemaVersion: number; encrypted: EncryptedRecord;
}
interface RecoveryCrypto {
  lock(): Promise<void>;
  recoverWithSecret(code: string, envelope: RecoveryEnvelope): Promise<{ success: boolean }>;
  verifyRecoveryRecord(table: string, id: string, version: number, encrypted: EncryptedRecord): Promise<void>;
  rebindLocalKey(): Promise<{ success: boolean }>;
  getKeyState(): Promise<CryptoKeyState>;
}

/** Recovery changes the native wrapper only. It never migrates or writes database rows. */
export function createRecoveryController(crypto: RecoveryCrypto, session: {
  lock(): number; getGeneration(): number; waitForIdle(): Promise<void>;
}, readChallenge: () => Promise<RecoveryChallenge | null>) {
  let pending: Promise<void> | null = null;
  return Object.freeze({
    recover(kitText: string): Promise<void> {
      if (pending) return Promise.reject(new Error('A recovery attempt is already in progress.'));
      const operation = (async () => {
        if (typeof kitText !== 'string' || kitText.length > 8192) throw new Error('Recovery kit is too large.');
        let kit: any;
        try { kit = JSON.parse(kitText); } catch { throw new Error('Invalid recovery kit JSON.'); }
        if (kitText.length > 8192 || kit?.product !== 'LifeOS' || kit?.format !== 'lifeos-recovery-kit' ||
            kit.version !== 1 || typeof kit.recoveryCode !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(kit.recoveryCode) || !kit.envelope) {
          throw new Error('Select the complete supported LifeOS recovery kit.');
        }
        const generation = session.lock();
        const current = () => {
          if (session.getGeneration() !== generation) throw new Error('Recovery expired after app lock. Retry in the foreground.');
        };
        await session.waitForIdle(); current();
        // No native state changes if there are no encrypted rows to prove ownership.
        const challenge = await readChallenge(); current();
        if (!challenge) throw new Error('No encrypted record is available to verify this recovery kit. Nothing was changed.');
        try {
          await session.waitForIdle(); current();
          await crypto.lock(); current();
          if (!(await crypto.recoverWithSecret(kit.recoveryCode, kit.envelope))?.success) throw new Error('Recovery failed.');
          current();
          // Normal decrypt stays quarantined. Proof returns only a verified boolean.
          await crypto.verifyRecoveryRecord(challenge.table, challenge.recordId, challenge.schemaVersion, challenge.encrypted);
          current();
          if (!(await crypto.rebindLocalKey())?.success) throw new Error('Biometric re-binding was cancelled or failed.');
          current();
          const state = await crypto.getKeyState(); current();
          if (!state.metadataConsistent || !state.keyProvisioned || !state.recoveryProvisioned || !state.keystoreAliasPresent ||
              state.recoveryNeedsRebind || !state.unlocked) throw new Error('The local key could not be verified.');
        } finally {
          session.lock();
          await crypto.lock(); // Keep admission closed even after successful recovery.
          kit = null;
        }
      })();
      pending = operation;
      const clear = () => { if (pending === operation) pending = null; };
      void operation.then(clear, clear);
      return operation;
    },
  });
}
