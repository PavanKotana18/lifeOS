import { cancelSheet, closeSheet, showSheet } from './sheetMotion';
import { useId, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { APP_NAME } from '../config/appBrand';

export type InfoContent = { definition: string; example: string; use: string; details?: string; learnMore?: string };

export default function InfoSheet({ label, content, triggerText, variant }: { label: string; content: InfoContent; triggerText?: string; variant?: 'profile' }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const sections = [['Simple example', content.example], [`How ${APP_NAME} uses it`, content.use], ['Important details', content.details], ['Learn more', content.learnMore]];

  return <>
    <button ref={trigger} type="button" className={variant === 'profile' ? 'profile-info-trigger' : triggerText ? 'money-text-action' : 'lifeos-info-trigger'} aria-label={triggerText || 'About ' + label}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      onClick={() => {
        const sheet = dialog.current;
        if (sheet && !sheet.open) { showSheet(sheet); setOpen(true); }
      }}>{triggerText || <Info size={17} aria-hidden="true" />}</button>
    <dialog data-polish-sheet onCancel={cancelSheet} ref={dialog} id={id} className={'lifeos-info-dialog lifeos-info-sheet' + (variant === 'profile' ? ' profile-design profile-info-sheet' : '')} data-contextual-info="true"
      aria-labelledby={id + '-title'} aria-describedby={id + '-definition'}
      onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}
      onClick={event => { if (event.target === event.currentTarget) closeSheet(dialog.current); }}>
      <div className="lifeos-info-dialog-content">
        <header className="flex items-center justify-between gap-3">
          <h2 id={id + '-title'} className="type-section-title">{label}</h2>
          <button type="button" className="lifeos-info-close" aria-label={'Close ' + label + ' explanation'} onClick={() => closeSheet(dialog.current)}><X size={18} aria-hidden="true" /></button>
        </header>
        <p id={id + '-definition'} className="info-definition">{content.definition}</p>
        {sections.filter(([, body]) => body).map(([title, body]) => <section key={title} className="info-sheet-section"><h3>{title}</h3><p>{body}</p></section>)}
      </div>
    </dialog>
  </>;
}
