import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

export default function ScheduledDetailDialog({ title, eyebrow, onClose, children }: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} className="alive-detail-dialog lifeos-page" data-scheduled-details onClose={onClose}>
    <header className="alive-detail-header">
      <button type="button" onClick={() => dialog.current?.close()} aria-label="Back to Schedule" className="feather-icon-button">
        <ChevronLeft size={23} aria-hidden="true" />
      </button>
      <div><p className="text-xs text-secondary">{eyebrow}</p><h2 className="type-page-title" id={titleId}>{title}</h2></div>
    </header>
    {children}
  </dialog>;
}
