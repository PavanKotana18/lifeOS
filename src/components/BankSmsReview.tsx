import { useEffect, useRef, useState } from 'react';
import { bankSms } from '../services/bankSms';
import { alertFingerprint, historicalAlertFingerprints, pastedBankAlert, type SmartImportSuggestion } from '../services/smartImport';
import type { SavableAlert } from './SmartImportDialog';
import type { Category, Transaction } from '../types';

type Entry =
  | { id: string; suggestion: SavableAlert; fingerprint: string; historical: string[] }
  | { id: string; suggestion: Exclude<SmartImportSuggestion, SavableAlert> };

const statuses = {
  transfer: 'Review as transfer', refund: 'Refund · check the original expense',
  reversal: 'Reversal · check the original transaction', failed: 'Payment failed',
  pending: 'Payment pending or authorization only', ambiguous: 'Ambiguous alert', unrecognized: 'Unsupported alert',
};

export function BankSmsReview({ onDismiss, onReview, onTransfer, transactions, categories }: {
  onDismiss: () => void;
  onReview: (id: string, suggestion: SavableAlert, fingerprint: string, historical: string[]) => void;
  onTransfer: () => void;
  transactions: Transaction[];
  categories: Category[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<Entry[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    let cancelled = false;
    void bankSms.list().then(async ({ rows }) => {
      const results = await Promise.all(rows.map(async ({ id, text }): Promise<Entry> => {
        const suggestion = pastedBankAlert.parse(text);
        if (!('amount' in suggestion)) return { id, suggestion };
        const [fingerprint, historical] = await Promise.all([
          alertFingerprint(text, suggestion), historicalAlertFingerprints(text, suggestion),
        ]);
        return { id, suggestion, fingerprint, historical };
      }));
      if (!cancelled) setEntries(results);
    }).catch(() => { if (!cancelled) setError('Could not read the queue securely. Unlock LifeOS and try again.'); });
    return () => { cancelled = true; };
  }, []);
  const dismiss = async (id: string) => {
    try {
      await bankSms.remove({ id });
      setEntries(current => current?.filter(entry => entry.id !== id));
    } catch { setError('Could not dismiss the suggestion.'); }
  };
  return <dialog className="lifeos-info-dialog lifeos-page bank-sms-review" data-bank-sms-review ref={dialog}
    aria-labelledby="bank-sms-review-title" onClose={onDismiss}>
    <section className="lifeos-info-dialog-content">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bank-sms-review-title" className="type-section-title">Bank SMS review</h2>
        <button type="button" className="feather-secondary" onClick={() => dialog.current?.close()}>Close</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {!error && !entries && <p role="status">Opening the protected queue…</p>}
      {entries?.length === 0 && <p role="status">No suggestions waiting for review.</p>}
      {entries?.map(entry => {
        const suggestion = entry.suggestion;
        const details = 'amount' in suggestion ? suggestion : suggestion.details;
        const recorded = 'fingerprint' in entry && transactions.some(row => !!row.importFingerprint &&
          (row.importFingerprint === entry.fingerprint || entry.historical.includes(row.importFingerprint)));
        const matchingText = details?.description?.trim().toLowerCase();
        const possible = !recorded && matchingText && 'amount' in suggestion && transactions.some(row =>
          row.type === suggestion.kind && row.currencyCode === suggestion.currency && row.date === suggestion.date &&
          row.amount === Number(suggestion.amount) && row.description.trim().toLowerCase() === matchingText);
        const category = 'amount' in suggestion && matchingText ? categories.find(item => item.type === suggestion.kind &&
          matchingText === item.name.trim().toLowerCase())?.name : undefined;
        return <article className="bank-sms-suggestion" key={entry.id}>
          <strong>{details ? details.currency + ' ' + details.amount : 'Bank alert'}</strong>
          <p>{recorded ? 'Already recorded' : possible ? 'Possible duplicate' : 'amount' in suggestion ? suggestion.kind === 'income' ? 'Income · needs review' : 'Expense · needs review' : statuses[suggestion.kind]}</p>
          {details && <p className="text-secondary">{[details.description, details.date, details.time, details.accountHint && 'Account ending ' + details.accountHint, details.bankHint].filter(Boolean).join(' · ')}</p>}
          {category && <p className="text-secondary">Suggested category · {category}</p>}
          <p className="text-secondary">Bank SMS</p>
          <div className="bank-sms-controls">
            {'fingerprint' in entry && !recorded && <button type="button" className="feather-primary" onClick={() =>
              onReview(entry.id, entry.suggestion, entry.fingerprint, entry.historical)}>{entry.suggestion.date ? 'Review & save' : 'Edit details'}</button>}
            {suggestion.kind === 'transfer' && <button type="button" className="feather-secondary" onClick={onTransfer}>Open transfers</button>}
            <button type="button" className="feather-secondary" onClick={() => void dismiss(entry.id)}>Dismiss</button>
          </div>
        </article>;
      })}
    </section>
  </dialog>;
}
