import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isEncryptedStorageActivated, sessionManager } from '../db';
import { setSensitiveScreenshotState } from '../services/screenshotProtection';

type SharedAlert = { id: string; text: string };

const inbox = registerPlugin<{
  addListener(event: 'alertAvailable', callback: () => void): Promise<PluginListenerHandle>;
  status(): Promise<{ id?: string }>;
  peek(): Promise<Partial<SharedAlert>>;
  acknowledge(options: { id: string }): Promise<void>;
}>('SmartImportShare');

const hasPrivateSession = () => sessionManager.isUnlocked() && isEncryptedStorageActivated();

export function useSharedBankAlert({ available, busy, open }: {
  available: boolean;
  busy: boolean;
  open: () => void;
}) {
  const [draft, setDraft] = useState<SharedAlert | null>(null);
  const [waitingId, setWaitingId] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);
  const current = useRef({ available, busy, open });
  current.current = { available, busy, open };
  const privateSession = hasPrivateSession();
  const recheck = () => setRevision(value => value + 1);
  const android = Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!android) return;
    const listener = inbox.addListener('alertAvailable', recheck);
    void listener.then(recheck).catch(() => undefined);
    document.addEventListener('close', recheck, true);
    return () => {
      document.removeEventListener('close', recheck, true);
      void listener.then(handle => handle.remove()).catch(() => undefined);
    };
  }, [android]);

  useEffect(() => {
    if (!android || !available || busy || acknowledging) return;
    let disposed = false;
    const canInspect = () => !disposed && current.current.available && !current.current.busy;
    void (async () => {
      const { id } = await inbox.status();
      if (!canInspect()) return;
      setWaitingId(id);
      if (!id || !hasPrivateSession()) return;
      // Native dialogs should finish before a share takes over the review surface.
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
      await setSensitiveScreenshotState(true);
      if (!canInspect() || !hasPrivateSession()) return;
      const alert = await inbox.peek();
      if (!canInspect() || !hasPrivateSession() || !alert.id || !alert.text ||
          document.querySelector('dialog[open], [aria-modal="true"]')) return;
      setDraft({ id: alert.id, text: alert.text });
      current.current.open();
    })().catch(() => undefined);
    return () => { disposed = true; };
  }, [android, available, busy, privateSession, revision, acknowledging]);

  const acknowledge = (id: string | undefined) => {
    if (!id) return;
    setAcknowledging(true);
    setWaitingId(undefined);
    void inbox.acknowledge({ id }).catch(() => undefined).finally(() => setAcknowledging(false));
  };

  return {
    draft,
    needsStorage: Boolean(waitingId && !privateSession && !busy),
    recheck,
    releaseText: () => setDraft(current => current ? { ...current, text: '' } : null),
    hide: () => setDraft(null),
    finish: () => { acknowledge(draft?.id); setDraft(null); },
    discard: () => acknowledge(waitingId),
  };
}
