import type { PreparedRecovery } from './cryptoService.ts';

export interface CryptoLifecycleAdapter {
  getKeyState(): Promise<{
    keyProvisioned: boolean;
    recoveryProvisioned: boolean;
    recoveryDeferred?: boolean;
    initialSetupPending?: boolean;
    recoveryNeedsRebind: boolean;
    metadataConsistent: boolean;
    keystoreAliasPresent: boolean;
    unlocked: boolean;
  }>;
  prepareRecovery?(): Promise<PreparedRecovery>;
  confirmRecovery?(): Promise<void>;
  deferRecovery?(): Promise<void>;
  setup(): Promise<{ success: boolean; message?: string }>;
  unlock(): Promise<{ success: boolean; message?: string }>;
  lock(): Promise<void>;
  isUnlocked(): Promise<boolean>;
}

export interface SessionLifecycleAdapter {
  unlock(): number;
  lock(): number;
  isUnlocked(): boolean;
  waitForIdle(): Promise<void>;
  getGeneration?(): number;
}

export interface ProtectedStorageOptions {
  hasEncryptedRecords(): Promise<boolean>;
  requestInitialSetup(): Promise<boolean>;
  confirmRecovery(prepared: PreparedRecovery): Promise<boolean>;
  activateStorage(): Promise<void>;
  isStorageActive(): boolean;
}

export type NewUserRecoveryChoice = 'setup' | 'later';

/** One owner for startup/resume/retry; replacement keys are never provisioned. */
export function createProtectedSessionController(
  crypto: CryptoLifecycleAdapter,
  session: SessionLifecycleAdapter,
  storage?: ProtectedStorageOptions
) {
  let epoch = 0;
  let pending: Promise<void> | null = null;
  let closing: Promise<void> = Promise.resolve();
  return Object.freeze({
    open(openOptions: { recoveryChoice?: NewUserRecoveryChoice } = {}): Promise<void> {
      if (pending) return pending;
      const attempt = ++epoch;
      session.lock();
      const generation = session.getGeneration?.();
      const current = () => {
        if (attempt !== epoch || (generation !== undefined && session.getGeneration?.() !== generation)) {
          throw new Error('Authentication expired after app lock. Retry in the foreground.');
        }
      };
      const operation = (async () => {
        try {
          // A previous lock failure is retried before authentication, never
          // bypassed and never allowed to poison every later retry forever.
          await closing.catch(() => crypto.lock());
          await session.waitForIdle();
          current();
          let state = await crypto.getKeyState();
          let keyCreatedThisAttempt = false;
          current();
          if (!state.metadataConsistent || state.recoveryNeedsRebind) {
            throw new Error('The existing encryption key needs recovery. No replacement key was created.');
          }
          if (!state.keyProvisioned) {
            // Inspect durable rows, not just volatile JS activation flags. Even
            // partial/malformed ciphertext prevents provisioning another key.
            const resumableSetupAlias = state.initialSetupPending === true;
            if (!storage || state.recoveryProvisioned || (state.keystoreAliasPresent && !resumableSetupAlias) || state.unlocked ||
                storage.isStorageActive() || await storage.hasEncryptedRecords()) {
              throw new Error('The existing encryption key needs recovery. No replacement key was created.');
            }
            current();
            if (!(await storage.requestInitialSetup())) throw new Error('Secure setup was cancelled. Data remains locked.');
            current();
            // Confirmation can take minutes. Recheck native metadata and rows
            // before creating a key; never act on the earlier snapshot.
            state = await crypto.getKeyState();
            current();
            if (!state.metadataConsistent || state.keyProvisioned || state.recoveryProvisioned ||
                (state.keystoreAliasPresent && !state.initialSetupPending) || state.recoveryNeedsRebind || state.unlocked || await storage.hasEncryptedRecords()) {
              throw new Error('Encryption state changed during setup. Retry or recover the existing key.');
            }
            current();
            const result = await crypto.setup();
            current();
            if (!result?.success) throw new Error(result?.message || 'Secure setup was cancelled or failed.');
            keyCreatedThisAttempt = true;
          } else {
            if (!state.keystoreAliasPresent) throw new Error('The existing encryption key needs recovery.');
            if (!storage || !state.unlocked) {
              const result = await crypto.unlock();
              current();
              if (!result?.success) throw new Error(result?.message || 'Authentication was cancelled or failed.');
            }
          }
          state = await crypto.getKeyState();
          current();
          if (!state.metadataConsistent || !state.keyProvisioned || !state.keystoreAliasPresent ||
              state.recoveryNeedsRebind || !state.unlocked || !(await crypto.isUnlocked())) {
            throw new Error('Native encryption setup could not be verified. Data remains locked.');
          }
          if (!state.recoveryProvisioned) {
            if (state.recoveryDeferred) {
              // This persisted flag is written by native code only after the
              // user explicitly chooses device-only recovery on first setup.
            } else if (keyCreatedThisAttempt && openOptions.recoveryChoice === 'later') {
              if (!crypto.deferRecovery) throw new Error('This Android build cannot defer recovery safely.');
              await crypto.deferRecovery();
              current();
              state = await crypto.getKeyState();
              if (!state.metadataConsistent || !state.recoveryDeferred || state.recoveryProvisioned ||
                  !state.keyProvisioned || !state.keystoreAliasPresent || !state.unlocked ||
                  !(await crypto.isUnlocked())) {
                throw new Error('Recovery preference could not be verified. Data remains locked.');
              }
            } else if (!storage || !crypto.prepareRecovery || !crypto.confirmRecovery) {
              throw new Error('The existing encryption key needs recovery protection.');
            } else {
              const prepared = await crypto.prepareRecovery();
              current();
              if (!(await storage.confirmRecovery(prepared))) throw new Error('Recovery setup was cancelled. Data remains locked.');
              current();
              await crypto.confirmRecovery();
              current();
            }
          }
          const verified = await crypto.getKeyState();
          if (!verified.metadataConsistent || verified.recoveryNeedsRebind ||
              !verified.keyProvisioned || (!verified.recoveryProvisioned && !verified.recoveryDeferred) ||
              !verified.keystoreAliasPresent || !verified.unlocked || !(await crypto.isUnlocked())) {
            throw new Error('The native encryption key is unavailable. Data remains locked.');
          }
          current();
          session.unlock();
          if (storage) {
            await storage.activateStorage();
            // Migration intentionally changes the JS generation. Epoch still
            // detects a concurrent lifecycle lock; never reopen a stale attempt.
            if (attempt !== epoch || !session.isUnlocked() || !storage.isStorageActive()) {
              throw new Error('Encrypted activation expired after app lock. Retry in the foreground.');
            }
            const activationGeneration = session.getGeneration?.();
            const activated = await crypto.getKeyState();
            const nativeUnlocked = await crypto.isUnlocked();
            if (attempt !== epoch || !session.isUnlocked() ||
                (activationGeneration !== undefined && session.getGeneration?.() !== activationGeneration) || !activated.metadataConsistent ||
                !activated.keyProvisioned || !activated.keystoreAliasPresent ||
                (!activated.recoveryProvisioned && !activated.recoveryDeferred) ||
                activated.recoveryNeedsRebind || !activated.unlocked || !nativeUnlocked) {
              throw new Error('Native encryption changed during activation. Data remains locked.');
            }
          }
        } catch (error) {
          session.lock();
          await session.waitForIdle();
          try { await crypto.lock(); } catch { /* Keep admission closed and preserve original failure. */ }
          throw error;
        }
      })();
      pending = operation;
      const clear = () => { if (pending === operation) pending = null; };
      void operation.then(clear, clear);
      return operation;
    },
    lock(): Promise<void> {
      epoch++;
      session.lock();
      // Serialize native lock completion before a later open can begin.
      closing = closing.catch(() => {}).then(async () => {
        await session.waitForIdle();
        await crypto.lock();
      });
      return closing;
    },
  });
}

export async function unlockEncryptedSession(
  crypto: CryptoLifecycleAdapter,
  session: SessionLifecycleAdapter,
  options: { allowInitialSetup?: boolean } = {}
): Promise<void> {
  session.lock();

  try {
    const state = await crypto.getKeyState();

    if (!state.metadataConsistent || state.recoveryNeedsRebind) {
      throw new Error('Encryption metadata is inconsistent. Recovery is required.');
    }

    if (state.keyProvisioned) {
      if (!state.keystoreAliasPresent) {
        throw new Error('Encryption key is unavailable in Android Keystore.');
      }
      const result = await crypto.unlock();
      if (!result?.success) throw new Error(result?.message || 'Native encryption unlock failed.');
    } else {
      const pristine =
        !state.recoveryProvisioned &&
        !state.keystoreAliasPresent &&
        !state.unlocked;

      if (!pristine || options.allowInitialSetup !== true) {
        throw new Error('Encryption is not provisioned. Initial setup must be completed explicitly.');
      }

      const result = await crypto.setup();
      if (!result?.success) throw new Error(result?.message || 'Native encryption setup failed.');
    }

    if (!(await crypto.isUnlocked())) {
      throw new Error('Native encryption did not confirm an unlocked key.');
    }

    session.unlock();
  } catch (error) {
    session.lock();
    try { await crypto.lock(); } catch {}
    throw error;
  }
}

export async function lockEncryptedSession(
  crypto: Pick<CryptoLifecycleAdapter, 'lock'>,
  session: SessionLifecycleAdapter
): Promise<void> {
  session.lock();
  await session.waitForIdle();
  await crypto.lock();
}
