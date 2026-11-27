import { useCallback, useEffect, useRef, useState } from 'react';
import { StorageService, isEncryptedStorageActivated, sessionManager } from '../db';
import { inboxEventKey, inboxSourceKey, nativeInboxEvent, type InboxChange, type InboxEvent, type InboxEvidence, type InboxInput } from '../services/notificationInbox';
import { NotificationService } from '../services/notificationService';

type Snapshot = Required<Pick<InboxChange, 'events' | 'sources'>> & Pick<InboxChange, 'notesPending'> & { acceptsObservation: (event: InboxInput) => boolean };
const PENDING_LIMIT = 128;

export function useNotificationInbox(available: boolean, snapshot: Snapshot, onError: () => void) {
  const [result, setResult] = useState<{ rows: InboxEvent[]; generation: number }>();
  const [failed, setFailed] = useState(false);
  const pending = useRef(new Map<string, InboxInput>());
  const current = useRef({ available, snapshot, onError });
  current.current = { available, snapshot, onError };

  const apply = useCallback(async (action?: InboxChange['action'], reportError = false) => {
    if (!current.current.available || !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) return false;
    const generation = sessionManager.capture();
    const { events, sources, acceptsObservation, notesPending } = current.current.snapshot;
    const drain = [...pending.current.entries()].filter(([, event]) => !notesPending || event.source !== 'note');
    const native = drain.map(([, input]) => input);
    const activeNative = native.filter(acceptsObservation);
    try {
      const rows = await StorageService.settings.updateNotificationInbox({
        sources, notesPending, action, events: [...activeNative, ...events].slice(0, 250),
      });
      if (!sessionManager.isCurrent(generation) || !current.current.available) return false;
      for (const [key, input] of drain) if (pending.current.get(key) === input) pending.current.delete(key);
      setFailed(false);
      setResult({ rows, generation });
      return true;
    } catch {
      if (sessionManager.isCurrent(generation) && current.current.available) {
        setFailed(true);
        if (reportError) current.current.onError();
      }
      return false;
    }
  }, []);

  const [receipt, wake] = useState(0);
  const observe = useCallback((extra: Record<string, unknown> | undefined, evidence: Exclude<InboxEvidence, 'in-app'>, postedAt?: number) => {
    const event = nativeInboxEvent(extra, evidence, Number.isFinite(postedAt) ? postedAt : undefined);
    if (!event) return;
    if (!current.current.available && !sessionManager.isUnlocked() && evidence === 'delivered') return;
    const key = inboxEventKey(event) + ':' + evidence;
    pending.current.set(key, event);
    if (pending.current.size > PENDING_LIMIT) {
      const oldest = pending.current.keys().next().value;
      if (oldest !== undefined) pending.current.delete(oldest);
    }
    wake(value => value + 1);
  }, []);

  const inspectDelivery = useCallback(async () => {
    if (!current.current.available) return;
    try {
      const notifications = await NotificationService.getDeliveredInboxData();
      if (!current.current.available) return;
      for (const row of notifications.slice(0, PENDING_LIMIT)) observe(row.extra, 'delivered', row.postedAt);
    } catch { /* Absence of a device observation proves neither delivery nor failure. */ }
  }, [observe]);

  const forget = useCallback(() => {
    pending.current.clear();
    setResult(undefined);
  }, []);

  useEffect(() => {
    if (available) void apply();
    else setResult(undefined);
  }, [available, snapshot, receipt, apply]);
  useEffect(() => { if (available) void inspectDelivery(); }, [available, inspectDelivery]);

  const rows = available && result && sessionManager.isCurrent(result.generation) ? result.rows.filter(row => !row.dismissedAt) : [];
  return { rows, unread: rows.filter(row => !row.readAt && !row.resolvedAt).length, loading: available && !result && !failed, failed,
    apply, observe, inspectDelivery, forget, sourceActive: (source: InboxInput['source'], id: string) =>
      Boolean(snapshot.sources[inboxSourceKey(source, id)]) };
}
