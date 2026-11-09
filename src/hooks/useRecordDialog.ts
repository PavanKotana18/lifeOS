import { useEffect, useRef } from 'react';

/** Keeps the record sheet inside the available viewport and returns focus to its opener. */
export function useRecordDialog(open: boolean, dismiss: () => void) {
  const dismissRef = useRef(dismiss);
  const openerRef = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  dismissRef.current = dismiss;
  useEffect(() => {
    if (open) return;
    const rememberFocus = () => {
      const target = document.activeElement;
      if (target instanceof HTMLElement && !target.closest('[role="dialog"],[role="alertdialog"]')) openerRef.current = target;
    };
    document.addEventListener('focusin', rememberFocus);
    return () => document.removeEventListener('focusin', rememberFocus);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const findDialog = () => [...document.querySelectorAll<HTMLElement>('form[role="dialog"]')].find(element => element.getClientRects().length > 0);
    const dialog = findDialog();
    if (!dialog) return;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      document.documentElement.style.setProperty('--sheet-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty('--sheet-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      const focused = document.activeElement;
      const currentDialog = findDialog();
      if (focused instanceof HTMLElement && currentDialog?.contains(focused)) focused.scrollIntoView({ block: 'nearest' });
    };
    const keydown = (event: KeyboardEvent) => {
      // Nested confirmations and native security dialogs own their own focus.
      const currentDialog = findDialog();
      if (!currentDialog?.contains(document.activeElement)) return;
      if (event.key === 'Escape') { event.preventDefault(); dismissRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...currentDialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(item => item.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    document.addEventListener('keydown', keydown);
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      document.removeEventListener('keydown', keydown);
      document.documentElement.style.removeProperty('--sheet-viewport-height');
      document.documentElement.style.removeProperty('--sheet-viewport-top');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
}
