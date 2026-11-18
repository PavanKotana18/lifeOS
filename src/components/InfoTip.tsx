import { Info } from 'lucide-react';

/** Keyboard friendly, inline explanation for a metric or section. */
export default function InfoTip({ label, children }: { label: string; children: string }) {
  return <details className="lifeos-info-tip">
    <summary aria-label={label} title={label}><Info size={17} aria-hidden="true" /><span className="sr-only">{label}</span></summary>
    <p>{children}</p>
  </details>;
}
