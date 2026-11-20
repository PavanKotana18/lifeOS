import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function AliveDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <section className="task-composer-section alive-disclosure" data-open={open}>
    <button type="button" aria-controls={id} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span>{label}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    <div id={id} className="alive-disclosure-grid" ref={element => element?.toggleAttribute('inert', !open)} aria-hidden={!open}>
      <div className="alive-disclosure-body">{children}</div>
    </div>
  </section>;
}
