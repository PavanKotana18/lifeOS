import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function AliveReveal({ id, open, children }: { id?: string; open: boolean; children: ReactNode }) {
  return <div id={id} className="alive-disclosure-grid" data-open={open}
    ref={element => element?.toggleAttribute('inert', !open)} aria-hidden={!open || undefined}>
    <div className="alive-disclosure-body">{children}</div>
  </div>;
}

export function AliveDisclosure({ label, children, defaultOpen = false }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return <section className="alive-disclosure" data-open={open} onInvalidCapture={() => setOpen(true)}>
    <button type="button" aria-controls={id} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span>{label}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    <AliveReveal id={id} open={open}>{children}</AliveReveal>
  </section>;
}
