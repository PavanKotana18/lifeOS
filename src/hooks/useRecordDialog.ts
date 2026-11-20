import { useEffect, useRef } from 'react';

/** Keeps composers inside the available viewport and returns focus to their opener. */
export function useRecordDialog(open: boolean, dismiss: () => void, dialogId: string) {
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
    const findDialog = () => { const element = document.getElementById(dialogId); return element?.getClientRects().length ? element : null; };
    const dialog = findDialog();
    if (!dialog) return;
    const background = Array.from(document.querySelectorAll<HTMLElement>('[data-profile-background], [data-record-background]'))
      .filter(element => !element.contains(dialog))
      .map(element => ({ element, inert: element.inert, hidden: element.getAttribute('aria-hidden') }));
    const viewport = window.visualViewport;
    const updateViewport = () => {
      document.documentElement.style.setProperty('--sheet-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty('--sheet-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      const focused = document.activeElement;
      const currentDialog = findDialog();
      const actions = currentDialog?.querySelector<HTMLElement>('.ui-form-actions');
      currentDialog?.style.setProperty('--sheet-actions-height', `${actions?.getBoundingClientRect().height ?? 0}px`);
      if (focused instanceof HTMLElement && currentDialog?.contains(focused)) focused.scrollIntoView({ block: 'nearest' });
    };
    const keydown = (event: KeyboardEvent) => {
      // Nested confirmations and native security dialogs own their own focus.
      const currentDialog = findDialog();
      if (!currentDialog?.contains(document.activeElement) || document.activeElement?.closest('dialog[data-preference-choice][open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); dismissRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...currentDialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(item => item.getClientRects().length && !item.closest('[inert]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    if (!dialog.contains(document.activeElement)) {
      dialog.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')?.focus({ preventScroll: true });
    }
    background.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    updateViewport();
    const actions = dialog.querySelector<HTMLElement>('.ui-form-actions');
    const actionsObserver = actions && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateViewport) : null;
    if (actions) actionsObserver?.observe(actions);
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    document.addEventListener('keydown', keydown);
    return () => {
      actionsObserver?.disconnect();
      dialog.style.removeProperty('--sheet-actions-height');
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      document.removeEventListener('keydown', keydown);
      document.documentElement.style.removeProperty('--sheet-viewport-height');
      document.documentElement.style.removeProperty('--sheet-viewport-top');
      background.forEach(({ element, inert, hidden }) => {
        element.inert = inert;
        if (hidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', hidden);
      });
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, dialogId]);
}
