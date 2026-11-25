import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Ellipsis, Copy, Pencil, Trash2, X } from 'lucide-react';

type Props = {
  kind: 'income' | 'expense' | 'transfer';
  title: string;
  amount: string;
  currency: string;
  context: [string, ReactNode][];
  notes?: string;
  onClose: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

export default function TransactionDetail({ kind, title, amount, currency, context, notes, onClose, onPrimary, primaryLabel, onDuplicate, onDelete }: Props) {
  const detail = useRef<HTMLDialogElement>(null);
  const actions = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const Icon = kind === 'transfer' ? ArrowLeftRight : kind === 'income' ? ArrowDownLeft : ArrowUpRight;
  useEffect(() => { detail.current?.showModal(); }, []);
  const exit = (action?: () => void) => {
    actions.current?.close();
    detail.current?.close();
    action?.();
  };
  return <dialog ref={detail} data-transaction-details={kind !== 'transfer' || undefined} data-transfer-details={kind === 'transfer' || undefined}
    className="transaction-detail-sheet transaction-detail-screen lifeos-page" aria-labelledby={titleId} onClose={onClose}>
    <div className="transaction-detail-layout">
      <div className="transaction-detail-top">
        <span className={'transaction-icon is-' + kind}><Icon size={22} aria-hidden="true" /></span>
        <button type="button" className="feather-icon-button" aria-label="Close" onClick={() => exit()}><X size={20} aria-hidden="true" /></button>
      </div>
      <header className="transaction-detail-identity">
        <strong className="transaction-detail-amount tabular-nums">{amount}</strong>
        <span className="transaction-detail-currency">{currency} <span aria-hidden="true">·</span> {kind === 'expense' ? 'Expense' : kind === 'income' ? 'Income' : 'Transfer'}</span>
        <h2 id={titleId}>{title}</h2>
      </header>
      <dl className="transaction-detail-context">
        {context.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {notes && <section className="transaction-detail-notes"><h3>Notes</h3><p>{notes}</p></section>}
      <footer className="transaction-detail-actions">
        <button type="button" className="feather-primary" onClick={() => exit(onPrimary)}>
          {kind !== 'transfer' && <Pencil size={16} aria-hidden="true" />}{primaryLabel}
        </button>
        {(onDuplicate || onDelete) && <button type="button" className="feather-icon-button" aria-label="More options" aria-haspopup="dialog" onClick={() => actions.current?.showModal()}>
          <Ellipsis size={22} aria-hidden="true" />
        </button>}
      </footer>
    </div>
    {(onDuplicate || onDelete) && <dialog ref={actions} data-transaction-actions className="lifeos-info-dialog lifeos-page transaction-options-sheet" aria-label="More options">
      <div className="lifeos-info-dialog-content">
        {onDuplicate && <button type="button" className="transaction-option" onClick={() => exit(onDuplicate)}><Copy size={18} aria-hidden="true" />Duplicate</button>}
        {onDelete && <button type="button" className="transaction-option text-[var(--danger)]" onClick={() => exit(onDelete)}><Trash2 size={18} aria-hidden="true" />Delete transaction</button>}
        <button type="button" className="feather-secondary" onClick={() => actions.current?.close()}>Cancel</button>
      </div>
    </dialog>}
  </dialog>;
}
