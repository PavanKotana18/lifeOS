/**
 * LifeOS in-memory authorization session.
 *
 * Sessions start locked. Authentication integrations must explicitly unlock.
 * Locking closes admission immediately; admitted operations may finish, and
 * waitForIdle() resolves when all such operations have drained.
 */
export class SessionLockedError extends Error {
  readonly code = 'LIFEOS_SESSION_LOCKED';

  constructor() {
    super('LifeOS session is locked. Authenticate before accessing private data.');
    this.name = 'SessionLockedError';
  }
}

export function createSessionManager() {
  let unlocked = false;
  let generation = 0;
  let activeOperations = 0;
  const idleWaiters: Array<() => void> = [];

  const assertUnlocked = (): void => {
    if (!unlocked) throw new SessionLockedError();
  };

  const isCurrent = (token: number): boolean =>
    unlocked && token === generation;

  const assertCurrent = (token: number): void => {
    if (!isCurrent(token)) throw new SessionLockedError();
  };

  const resolveIdleWaiters = (): void => {
    if (activeOperations !== 0) return;
    const waiters = idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  };

  return Object.freeze({
    unlock(): number {
      generation += 1;
      unlocked = true;
      return generation;
    },

    lock(): number {
      generation += 1;
      unlocked = false;
      return generation;
    },

    isUnlocked(): boolean {
      return unlocked;
    },

    getGeneration(): number {
      return generation;
    },

    assertUnlocked,

    capture(): number {
      assertUnlocked();
      return generation;
    },

    isCurrent,

    assertCurrent,

    beginOperation(): number {
      assertUnlocked();
      activeOperations += 1;
      return generation;
    },

    endOperation(): void {
      if (activeOperations <= 0) {
        throw new Error('Session operation lease underflow');
      }
      activeOperations -= 1;
      resolveIdleWaiters();
    },

    waitForIdle(): Promise<void> {
      if (activeOperations === 0) return Promise.resolve();
      return new Promise(resolve => idleWaiters.push(resolve));
    },

    getActiveOperationCount(): number {
      return activeOperations;
    }
  });
}
