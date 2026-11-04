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
