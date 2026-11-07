import type { NewUserRecoveryChoice } from '../services/cryptoSessionCoordinator';

/** Contextual gate shown only when the user first chooses to save a private record. */
export default function FirstRecordSecurityDialog({ onDecision }: {
  onDecision(choice: NewUserRecoveryChoice | null): void;
}) {
  return <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 overflow-y-auto p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:items-center" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="first-record-security-title" className="lifeos-panel my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border p-5 shadow-2xl">
      <p className="text-xs font-semibold uppercase tracking-[.14em] lifeos-accent-text">Before your first record</p>
      <h1 id="first-record-security-title" className="text-xl font-semibold">Protect your personal data</h1>
      <p className="text-sm leading-6 text-secondary">Android will authenticate you and LifeOS will encrypt records on this device. Cancelling or unavailable authentication leaves the record unsaved.</p>
      <p className="lifeos-warning rounded-xl p-3 text-xs leading-5">A recovery kit can restore access if this device key is lost. You can set one up now or later in Settings. Until then, losing the key may make the data unrecoverable.</p>
      <button type="button" onClick={() => onDecision('later')} className="lifeos-accent-button min-h-12 w-full rounded-xl px-4 text-sm font-semibold">Protect this device; recovery later</button>
      <button type="button" onClick={() => onDecision('setup')} className="lifeos-panel min-h-12 w-full rounded-xl border px-4 text-sm font-semibold">Set up recovery now</button>
      <button type="button" onClick={() => onDecision(null)} className="min-h-11 w-full rounded-xl px-4 text-sm text-secondary">Not now</button>
    </section>
  </div>;
}
