import { useEffect, useId, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

/** A short, on-demand explanation. The native dialog supplies keyboard focus handling. */
export default function InfoTip({ label, children }: { label: string; children: string }) {
  const titleId = useId();
  const dialogId = `${titleId}-dialog`;
  const descriptionId = `${titleId}-description`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return <>
    <button ref={triggerRef} type="button" className="lifeos-info-trigger" aria-label={`About ${label}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} onClick={() => setOpen(true)}>
      <Info size={17} aria-hidden="true" />
    </button>
    <dialog ref={dialogRef} id={dialogId} className="lifeos-info-dialog" data-contextual-info="true" aria-labelledby={titleId}
      aria-describedby={descriptionId} onClose={() => { setOpen(false); }} onCancel={event => { event.preventDefault(); dismiss(); }}
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <div className="lifeos-info-dialog-content">
        <div className="flex items-start justify-between gap-3"><h2 id={titleId} className="text-base font-semibold">{label}</h2>
          <button type="button" className="lifeos-info-close" aria-label={`Close ${label} explanation`} onClick={dismiss}><X size={18} aria-hidden="true" /></button></div>
        <p id={descriptionId} className="mt-3 text-sm leading-6 text-secondary">{children}</p>
      </div>
    </dialog>
  </>;
}
