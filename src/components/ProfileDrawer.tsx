import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function ProfileDrawer({ section, scrollPositions, onBack, onClose, swipeEnabled, children }: {
  section: string;
  scrollPositions: Record<string, number>;
  onBack: () => void;
  onClose: () => void;
  swipeEnabled: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const background = Array.from(document.querySelectorAll<HTMLElement>('[data-profile-background]'), element => ({ element, hidden: element.getAttribute('aria-hidden'), inert: element.inert }));
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    panel.current?.focus({ preventScroll: true });
    background.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = overflow;
      background.forEach(({ element, hidden, inert }) => {
        element.inert = inert;
        if (hidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', hidden);
      });
      (opener?.isConnected ? opener : document.getElementById('profile-opener'))?.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const saveScroll = () => { scrollPositions[section] = element.scrollTop; };
    element.scrollTop = scrollPositions[section] ?? 0;
    const heading = element.querySelector<HTMLElement>('.profile-settings h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    element.addEventListener('scroll', saveScroll, { passive: true });
    return () => element.removeEventListener('scroll', saveScroll);
  }, [section, scrollPositions]);

  useLayoutEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const element = panel.current;
      if (!element || event.defaultPrevented || document.querySelector('dialog[open], [role="alertdialog"][aria-modal="true"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); onBack(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary, [tabindex="0"]')).filter(control => control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      const focused = document.activeElement;
      if (!element.contains(focused)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && (focused === first || focused?.getAttribute('tabindex') === '-1')) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && focused === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onBack]);

  return <div className="profile-drawer-backdrop" onClick={event => {
    if (event.currentTarget === event.target) onClose();
  }}>
    <aside ref={panel} id="screen-settings" tabIndex={-1} className="profile-drawer lifeos-panel" role="dialog" aria-modal="true" aria-label="Profile and settings"
      onPointerDown={event => {
        const target = event.target;
        pointer.current = null;
        if (!swipeEnabled || event.pointerType !== 'touch' || !event.isPrimary || !(target instanceof Element) ||
          target.closest('button, input, select, textarea, a, summary, label, dialog, [contenteditable]')) return;
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerCancel={() => { pointer.current = null; }}
      onPointerUp={event => {
        const start = pointer.current;
        pointer.current = null;
        if (start?.id !== event.pointerId || window.getSelection()?.isCollapsed === false) return;
        const travel = start.x - event.clientX;
        if (travel >= 64 && travel > Math.abs(start.y - event.clientY) * 1.5) onBack();
      }}>
      <button type="button" aria-label="Close profile" className="profile-drawer-close lifeos-raised" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      {children}
    </aside>
  </div>;
}
