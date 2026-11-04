import type { CryptoKeyState, PreparedRecovery } from './cryptoService.ts';

export interface EncryptedLifecycleCrypto {
  getKeyState(): Promise<CryptoKeyState>;
  setup(): Promise<{ success: boolean; message?: string }>;
  unlock(): Promise<{ success: boolean; message?: string }>;
  lock(): Promise<void>;
  isUnlocked(): Promise<boolean>;
  prepareRecovery(): Promise<PreparedRecovery>;
  confirmRecovery(): Promise<void>;
}

export interface EncryptedLifecycleSession {
  lock(): number;
  unlock(): number;
  isUnlocked(): boolean;
  waitForIdle(): Promise<void>;
}

export interface EncryptedLifecycleOptions {
  crypto: EncryptedLifecycleCrypto;
  session: EncryptedLifecycleSession;
  activateStorage: () => Promise<void>;
  confirmRecoveryCode: (recoveryCode: string) => Promise<boolean>;
}

/**
 * Opens encrypted LifeOS storage only after native key authentication and
 * confirmed recovery protection. Initial setup is never silently accepted.
 */
export async function openEncryptedStorageLifecycle(
  options: EncryptedLifecycleOptions
): Promise<void> {
  const { crypto, session, activateStorage, confirmRecoveryCode } = options;

  session.lock();
  await session.waitForIdle();

  try {
    let state = await crypto.getKeyState();

    if (!state.metadataConsistent || state.recoveryNeedsRebind) {
      throw new Error('Encryption metadata is inconsistent. Recovery or key rebind is required.');
    }

    if (state.keyProvisioned) {
      if (!state.keystoreAliasPresent) {
        throw new Error('The LifeOS encryption key is unavailable in Android Keystore.');
      }

      const result = await crypto.unlock();
      if (!result || result.success !== true) {
        throw new Error(result?.message || 'Native encryption authentication failed.');
      }
    } else {
      const pristine =
        !state.recoveryProvisioned &&
        !state.keystoreAliasPresent &&
        !state.unlocked;

      if (!pristine) {
        throw new Error('Encryption state is not pristine. Automatic key setup is blocked.');
      }

      const result = await crypto.setup();
      if (!result || result.success !== true) {
        throw new Error(result?.message || 'Initial native encryption setup failed.');
      }
    }

    if (!(await crypto.isUnlocked())) {
      throw new Error('Native encryption key is not unlocked.');
    }

    state = await crypto.getKeyState();

    if (!state.metadataConsistent || state.recoveryNeedsRebind) {
      throw new Error('Encryption metadata changed during authentication. Storage remains locked.');
    }

    if (!state.recoveryProvisioned) {
      const prepared = await crypto.prepareRecovery();

      // The code is passed only to the UI callback. It is never logged or persisted here.
      const confirmed = await confirmRecoveryCode(prepared.recoveryCode);
      if (confirmed !== true) {
        throw new Error('Recovery setup was not confirmed. LifeOS data remains locked.');
      }

      await crypto.confirmRecovery();

      state = await crypto.getKeyState();
      if (
        !state.keyProvisioned ||
        !state.recoveryProvisioned ||
        !state.keystoreAliasPresent ||
        !state.metadataConsistent ||
        state.recoveryNeedsRebind ||
        !state.unlocked ||
        !(await crypto.isUnlocked())
      ) {
        throw new Error('Recovery protection could not be verified. Storage activation was blocked.');
      }
    } else if (
      !state.keyProvisioned ||
      !state.keystoreAliasPresent ||
      !state.recoveryProvisioned
    ) {
      throw new Error('Native encryption key or recovery protection is incomplete.');
    }

    // Activation performs the resumable migration and opens the session only
    // after every record has been migrated successfully.
    session.unlock();
    await activateStorage();

    if (!session.isUnlocked() || !(await crypto.isUnlocked())) {
      throw new Error('Encrypted storage did not remain unlocked after activation.');
    }
  } catch (error) {
    session.lock();
    try {
      await session.waitForIdle();
    } catch {
      // Preserve the original lifecycle error.
    }
    try {
      await crypto.lock();
    } catch {
      // Preserve the original lifecycle error.
    }
    throw error;
  }
}
