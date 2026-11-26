import '../styles/smart-import.css';
import { useEffect, useId, useRef, useState } from 'react';
import { alertFingerprint, historicalAlertFingerprints, pastedBankAlert, type SmartImportSuggestion } from '../services/smartImport';

export type SavableAlert = Extract<SmartImportSuggestion, { amount: string }>;

export default function SmartImportDialog({ initialText, onTextConsumed, onDismiss, onReview, onTransfer }: {
  initialText?: string;
  onTextConsumed: () => void;
  onDismiss: () => void;
  onReview: (suggestion: SavableAlert, fingerprint: string, historical: string[]) => void;
  onTransfer: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(initialText ?? '');
  const [suggestion, setSuggestion] = useState<SmartImportSuggestion | null>(null);
  const [identity, setIdentity] = useState<{ fingerprint: string; historical: string[] }>();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const inspect = async () => {
    const alert = text;
    setText('');
    onTextConsumed();
    setIdentity(undefined);
    setProcessing(true);
    try {
      const next = pastedBankAlert.parse(alert);
      if ('amount' in next) {
        const [fingerprint, historical] = await Promise.all([alertFingerprint(alert, next), historicalAlertFingerprints(alert, next)]);
        setIdentity({ fingerprint, historical });
      }
      setSuggestion(next);
    } catch { setSuggestion({ kind: 'unrecognized' }); }
    finally { setProcessing(false); }
  };

  return <dialog ref={dialog} className="lifeos-info-dialog lifeos-page" data-smart-import aria-labelledby={id}
    onClose={onDismiss} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <section className="lifeos-info-dialog-content smart-import-content">
      <header className="flex items-center justify-between gap-3"><h2 id={id} className="type-section-title">Smart Import</h2>
        <button type="button" className="feather-secondary" onClick={() => dialog.current?.close()}>Close</button></header>
      {!suggestion ? <>
        <label className="smart-import-field">Bank alert
          <textarea className="lifeos-input" rows={4} maxLength={2000} autoComplete="off" spellCheck={false} value={text}
            onChange={event => setText(event.target.value)} placeholder="Paste one transaction alert" />
        </label>
        <button type="button" className="feather-primary" disabled={!text.trim() || processing} onClick={() => void inspect()}>Detect transaction</button>
      </> : 'amount' in suggestion ? <>
        <dl className="transaction-summary-grid">
          <div><dt>{suggestion.kind === 'income' ? 'Money in' : 'Money out'}</dt><dd>{suggestion.currency} {suggestion.amount}</dd></div>
          <div><dt>Date</dt><dd>{suggestion.date || 'Choose a date'}</dd></div>
        </dl>
        {(suggestion.description || suggestion.accountHint || suggestion.reference || suggestion.time) && <p className="safe-wrap text-sm text-secondary">
          {[suggestion.description, suggestion.accountHint && 'Account ending ' + suggestion.accountHint, suggestion.reference && 'Reference ' + suggestion.reference, suggestion.time].filter(Boolean).join(' · ')}
        </p>}
        <button type="button" className="feather-primary" disabled={!identity} onClick={() => {
          if (identity) onReview(suggestion, identity.fingerprint, identity.historical);
        }}>Review transaction</button>
        <button type="button" className="feather-secondary" onClick={onTransfer}>Record as transfer</button>
      </> : <>
        <p role="status">{{ transfer: 'This looks like a transfer.', refund: 'Review this refund against the original expense. Smart Import cannot link the entries.', reversal: 'Review this reversal against the original entry. Smart Import cannot link the entries.', failed: 'This payment appears to have failed.', pending: 'This looks like a pending payment or authorization.', ambiguous: 'This alert may describe multiple transactions. Check the original and enter each confirmed transaction separately.', unrecognized: 'No supported transaction was found.' }[suggestion.kind]}</p>
        {suggestion.details && <p className="text-sm text-secondary">{suggestion.details.currency} {suggestion.details.amount}{suggestion.details.date && ' · ' + suggestion.details.date}</p>}
        {suggestion.kind === 'transfer' && <button type="button" className="feather-secondary" onClick={onTransfer}>Review transfer</button>}
        <button type="button" className="feather-primary" onClick={() => setSuggestion(null)}>Paste another alert</button>
      </>}
    </section>
  </dialog>;
}
