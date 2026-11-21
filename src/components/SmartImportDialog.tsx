import { useEffect, useId, useRef, useState } from 'react';
import { alertFingerprint, pastedBankAlert, type SmartImportSuggestion } from '../services/smartImport';

export type SavableAlert = Extract<SmartImportSuggestion, { amount: string }>;

export default function SmartImportDialog({ onDismiss, onReview, onTransfer }: {
  onDismiss: () => void;
  onReview: (suggestion: SavableAlert, fingerprint: string) => void;
  onTransfer: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [suggestion, setSuggestion] = useState<SmartImportSuggestion | null>(null);
  const [fingerprint, setFingerprint] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const inspect = async () => {
    const alert = text;
    setText('');
    setFingerprint('');
    setProcessing(true);
    try {
      const next = pastedBankAlert.parse(alert);
      const fingerprint = 'amount' in next ? await alertFingerprint(alert, next) : '';
      setSuggestion(next);
      setFingerprint(fingerprint);
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
        <button type="button" className="feather-primary" disabled={!fingerprint} onClick={() => onReview(suggestion, fingerprint)}>Review transaction</button>
        <button type="button" className="feather-secondary" onClick={onTransfer}>Record as transfer</button>
      </> : <>
        <p role="status">{{ transfer: 'This looks like a transfer.', refund: 'This looks like a refund. Review it against the original expense.', reversal: 'This looks like a reversal. Review it against the original entry.', failed: 'This payment appears to have failed.', pending: 'This payment appears to be pending.', unrecognized: 'No supported transaction was found.' }[suggestion.kind]}</p>
        {suggestion.kind === 'transfer' && <button type="button" className="feather-secondary" onClick={onTransfer}>Review transfer</button>}
        <button type="button" className="feather-primary" onClick={() => setSuggestion(null)}>Paste another alert</button>
      </>}
    </section>
  </dialog>;
}
