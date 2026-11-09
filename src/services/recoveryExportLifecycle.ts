const MAX_RECOVERY_EXPORT_WINDOW_MS = 5 * 60 * 1000;

interface RecoveryExportWindow {
  id: number;
  expiresAt: number;
  inactiveObserved: boolean;
  operationFinished: boolean;
}

/** Short-lived in-memory coordination for the Android recovery-kit save picker. */
export class RecoveryExportLifecycle {
  private sequence = 0;
  private current: RecoveryExportWindow | null = null;

  begin(now = Date.now()): { id: number; release: () => void } {
    const id = ++this.sequence;
    this.current = { id, expiresAt: now + MAX_RECOVERY_EXPORT_WINDOW_MS, inactiveObserved: false, operationFinished: false };
    return {
      id,
      release: () => {
        if (this.current?.id !== id) return;
        this.current.operationFinished = true;
        if (!this.current.inactiveObserved) this.current = null;
      }
    };
  }

  markInactive(now = Date.now()): number | null {
    this.expire(now);
    if (!this.current) return null;
    this.current.inactiveObserved = true;
    return this.current.id;
  }

  pendingResume(now = Date.now()): number | null {
    this.expire(now);
    return this.current?.inactiveObserved ? this.current.id : null;
  }

  completeResume(id: number): void {
    if (this.current?.id === id) this.current = null;
  }

  isActive(now = Date.now()): boolean {
    this.expire(now);
    return this.current !== null;
  }

  private expire(now: number): void {
    if (this.current && now >= this.current.expiresAt) this.current = null;
  }
}
