/**
 * Coordinate encrypted facade read/prepare/commit operations across contexts.
 * The encrypted repository queue only serializes writes inside one JS realm.
 * Call this outside coordinator.run(), and hold it until that run completes.
 */
export async function withCommitmentWriteLock<T>(
  operation: () => Promise<T>,
  requireCrossContext = false,
): Promise<T> {
  const manager = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (manager && typeof manager.request === 'function') {
    // A failed request or operation propagates. It must never trigger an
    // unlocked retry, including for legacy plan CRUD operations.
    return manager.request('lifeos-encrypted-storage-writes', async () => operation());
  }
  if (requireCrossContext) {
    throw new Error('This browser does not support safe recurring posting. Use a supported secure browser or app.');
  }
  // Preserve existing planning CRUD on older engines. Posting stays disabled
  // there because a realm-local Promise queue cannot protect another tab.
  return operation();
}
