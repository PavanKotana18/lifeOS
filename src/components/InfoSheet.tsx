import { useId, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

export type InfoContent = { definition: string; example: string; use: string; details?: string; learnMore?: string };

export default function InfoSheet({ label, content }: { label: string; content: InfoContent }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const sections = [['Simple example', content.example], ['How LifeOS uses it', content.use], ['Important details', content.details], ['Learn more', content.learnMore]];

  return <>
    <button ref={trigger} type="button" className="lifeos-info-trigger" aria-label={'About ' + label}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}><Info size={17} aria-hidden="true" /></button>
    <dialog ref={dialog} id={id} className="lifeos-info-dialog lifeos-info-sheet" data-contextual-info="true"
      aria-labelledby={id + '-title'} aria-describedby={id + '-definition'}
      onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="lifeos-info-dialog-content">
        <header className="flex items-center justify-between gap-3">
          <h2 id={id + '-title'} className="type-section-title">{label}</h2>
          <button type="button" className="lifeos-info-close" aria-label={'Close ' + label + ' explanation'} onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
        </header>
        <p id={id + '-definition'} className="info-definition">{content.definition}</p>
        {sections.filter(([, body]) => body).map(([title, body]) => <section key={title} className="info-sheet-section"><h3>{title}</h3><p>{body}</p></section>)}
      </div>
    </dialog>
  </>;
}
