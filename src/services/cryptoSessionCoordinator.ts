export interface CryptoLifecycleAdapter {
  getKeyState(): Promise<{
    keyProvisioned: boolean;
    recoveryProvisioned: boolean;
    recoveryNeedsRebind: boolean;
    metadataConsistent: boolean;
    keystoreAliasPresent: boolean;
    unlocked: boolean;
  }>;
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

/** One owner for protected startup/resume/retry; never provisions a replacement key. */
export function createProtectedSessionController(
  crypto: CryptoLifecycleAdapter,
  session: SessionLifecycleAdapter
) {
  let epoch = 0;
  let pending: Promise<void> | null = null;
  let closing: Promise<void> = Promise.resolve();
  return Object.freeze({
    open(): Promise<void> {
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
          const state = await crypto.getKeyState();
          current();
          if (!state.metadataConsistent || state.recoveryNeedsRebind ||
              !state.keyProvisioned || !state.recoveryProvisioned || !state.keystoreAliasPresent) {
            throw new Error('The existing encryption key needs recovery. No replacement key was created.');
          }
          const result = await crypto.unlock();
          current();
          if (!result?.success) throw new Error(result?.message || 'Authentication was cancelled or failed.');
          const verified = await crypto.getKeyState();
          if (!verified.metadataConsistent || verified.recoveryNeedsRebind ||
              !verified.keyProvisioned || !verified.recoveryProvisioned ||
              !verified.keystoreAliasPresent || !verified.unlocked || !(await crypto.isUnlocked())) {
            throw new Error('The native encryption key is unavailable. Data remains locked.');
          }
          current();
          session.unlock();
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
