import { useEffect, useRef } from 'react';

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type Props = ConfirmationOptions & {
  onConfirm: () => void;
  onCancel: () => void;
};

/** Shared in-app confirmation. Security prompts continue to use their native flows. */
export default function ConfirmationDialog({ title, message, confirmLabel = 'Continue', cancelLabel = 'Cancel', destructive = false, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelAction = useRef(onCancel);
  cancelAction.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelAction.current();
        return;
      }
      if (event.key === 'Tab') {
        const dialog = cancelRef.current?.closest('[role="alertdialog"]');
        const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')) : [];
        if (focusable.length < 2) { event.preventDefault(); cancelRef.current?.focus(); return; }
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return <div className="ui-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="ui-confirmation-dialog lifeos-panel" role="alertdialog" aria-modal="true" aria-labelledby="lifeos-confirmation-title" aria-describedby="lifeos-confirmation-message">
      <h2 id="lifeos-confirmation-title">{title}</h2>
      <p id="lifeos-confirmation-message">{message}</p>
      <div className="ui-confirmation-actions">
        <button ref={cancelRef} type="button" className="lifeos-raised" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={destructive ? 'ui-confirmation-destructive' : 'lifeos-accent-button'} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </section>
  </div>;
}
