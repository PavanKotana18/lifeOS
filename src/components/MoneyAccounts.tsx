import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Archive, Landmark, Plus, Wallet } from 'lucide-react';
import type { AccountTransfer, FinancialAccount, FinancialAccountType, Transaction } from '../types';
import { accountActivitySign, calculateAccountBalances } from '../services/financialAccounting';
import { decimalToMinorUnits, formatCurrencyChoice, formatMinorUnits, minorUnitsToDecimal } from '../services/financeCore';
import { CURRENCY_CODES } from '../services/userPreferences';
import { formatLocalDate } from '../services/domainUtils';

type AccountInput = Omit<FinancialAccount, 'id' | 'createdAt' | 'updatedAt'>;
type TransferInput = Omit<AccountTransfer, 'id' | 'createdAt' | 'updatedAt' | 'reversalOfId'>;
type Props = {
  accounts: FinancialAccount[];
  transactions: Transaction[];
  transfers: AccountTransfer[];
  currencyCode: string;
  locale?: string;
  onCreateAccount: (input: AccountInput) => Promise<void>;
  onUpdateAccount: (id: string, input: Partial<AccountInput>) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onCreateTransfer: (input: TransferInput) => Promise<void>;
  onUpdateTransfer: (id: string, input: Partial<TransferInput>) => Promise<void>;
  onReverseTransfer: (id: string, date: string) => Promise<void>;
  onDeleteTransfer: (id: string) => Promise<void>;
  autoOpenTransfer?: boolean;
  onTransferRequestHandled?: () => void;
};

const accountTypes: Array<[FinancialAccountType, string]> = [
  ['cash', 'Cash'], ['bank', 'Bank'], ['credit-card', 'Credit card'], ['wallet', 'Wallet'], ['savings', 'Savings'], ['other', 'Other'],
];
const inputClass = 'lifeos-input mt-1 min-h-11 w-full rounded-xl px-3 py-2 text-sm';
const today = () => formatLocalDate(new Date());

export function buildTransferReversalConfirmation(
  transfer: Pick<AccountTransfer, 'fromAmountMinor' | 'fromCurrencyCode' | 'toAmountMinor' | 'toCurrencyCode' | 'date'>,
  fromName: string,
  toName: string,
  locale?: string,
) {
  const fromAmount = formatMinorUnits(BigInt(transfer.fromAmountMinor), transfer.fromCurrencyCode, locale);
  const toAmount = formatMinorUnits(BigInt(transfer.toAmountMinor), transfer.toCurrencyCode, locale);
  const returned = transfer.fromCurrencyCode === transfer.toCurrencyCode
    ? `${fromAmount} from ${toName} back to ${fromName}`
    : `${toAmount} from ${toName} back to ${fromName}; the original ${fromAmount} value is restored`;
  return `Reverse the transfer from ${fromName} to ${toName} dated ${transfer.date}? This returns ${returned}. The original stays in your history, and you can undo this reversal later. Income and spending totals will not change.`;
}

export default function MoneyAccounts(props: Props) {
  const { accounts, transactions, transfers, currencyCode, locale, onCreateAccount, onUpdateAccount, onDeleteAccount, onCreateTransfer, onUpdateTransfer, onReverseTransfer, onDeleteTransfer, autoOpenTransfer = false, onTransferRequestHandled } = props;
  const [accountDraft, setAccountDraft] = useState<{ id?: string; name: string; type: FinancialAccountType; currencyCode: string; opening: string; description: string; isActive: boolean } | null>(null);
  const [transferDraft, setTransferDraft] = useState<{ id?: string; from: string; to: string; fromAmount: string; toAmount: string; rate: string; date: string; notes: string } | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [error, setError] = useState('');
  const balances = useMemo(() => calculateAccountBalances(accounts, transactions, transfers), [accounts, transactions, transfers]);
  const active = accounts.filter(account => account.isActive);
  const beginAccount = (account?: FinancialAccount) => {
    setError('');
    setAccountDraft(account ? { id: account.id, name: account.name, type: account.type, currencyCode: account.currencyCode, opening: minorUnitsToDecimal(BigInt(account.openingBalanceMinor), account.currencyCode), description: account.description || '', isActive: account.isActive }
      : { name: '', type: 'cash', currencyCode, opening: '0', description: '', isActive: true });
  };
  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault(); if (!accountDraft) return;
    try {
      const openingBalanceMinor = decimalToMinorUnits(accountDraft.opening || '0', accountDraft.currencyCode).toString();
      const input: AccountInput = { name: accountDraft.name.trim(), type: accountDraft.type, currencyCode: accountDraft.currencyCode, openingBalanceMinor, description: accountDraft.description.trim() || undefined, isActive: accountDraft.isActive };
      if (accountDraft.id) await onUpdateAccount(accountDraft.id, input); else await onCreateAccount(input);
      setAccountDraft(null); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Account could not be saved.'); }
  };
  const beginTransfer = (transfer?: AccountTransfer) => {
    setError('');
    setTransferDraft(transfer ? { id: transfer.id, from: transfer.fromAccountId, to: transfer.toAccountId,
      fromAmount: minorUnitsToDecimal(BigInt(transfer.fromAmountMinor), transfer.fromCurrencyCode),
      toAmount: minorUnitsToDecimal(BigInt(transfer.toAmountMinor), transfer.toCurrencyCode), rate: transfer.exchangeRate || '', date: transfer.date, notes: transfer.notes || '' }
      : { from: active[0]?.id || '', to: active[1]?.id || '', fromAmount: '', toAmount: '', rate: '', date: today(), notes: '' });
  };
  useEffect(() => {
    if (!autoOpenTransfer) return;
    if (active.length >= 2) beginTransfer();
    else setError('Add at least two active accounts before making a transfer.');
    onTransferRequestHandled?.();
  }, [autoOpenTransfer]);
  const submitTransfer = async (event: React.FormEvent) => {
    event.preventDefault(); if (!transferDraft) return;
    try {
      const source = accounts.find(row => row.id === transferDraft.from), destination = accounts.find(row => row.id === transferDraft.to);
      if (!source || !destination) throw new Error('Choose both accounts.');
      const fromAmountMinor = decimalToMinorUnits(transferDraft.fromAmount, source.currencyCode).toString();
      const toAmountMinor = decimalToMinorUnits(source.currencyCode === destination.currencyCode ? transferDraft.fromAmount : transferDraft.toAmount, destination.currencyCode).toString();
      const input: TransferInput = { fromAccountId: source.id, toAccountId: destination.id, fromAmountMinor, toAmountMinor,
        fromCurrencyCode: source.currencyCode, toCurrencyCode: destination.currencyCode,
        ...(source.currencyCode !== destination.currencyCode ? { exchangeRate: transferDraft.rate.trim() } : {}), date: transferDraft.date, notes: transferDraft.notes.trim() || undefined };
      if (transferDraft.id) await onUpdateTransfer(transferDraft.id, input); else await onCreateTransfer(input);
      setTransferDraft(null); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Transfer could not be saved.'); }
  };
  const balance = (account: FinancialAccount) => formatMinorUnits(balances.get(account.id) || 0n, account.currencyCode, locale);
  const openingBalanceLocked = Boolean(accountDraft?.id && (
    transactions.some(row => row.accountId === accountDraft.id) ||
    transfers.some(row => row.fromAccountId === accountDraft.id || row.toAccountId === accountDraft.id)
  ));

  return <main className="space-y-5" data-testid="money-accounts">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="type-eyebrow">YOUR ACCOUNTS</p><h2 className="type-page-title">Accounts</h2><p className="type-body text-secondary">Optional places to track money. Opening amounts are not income.</p></div><div className="flex gap-2"><button type="button" onClick={() => beginAccount()} className="lifeos-accent-button min-h-11 rounded-xl px-3 text-sm font-semibold"><Plus size={16} className="mr-1 inline" />Account</button><button type="button" disabled={active.length < 2} onClick={() => beginTransfer()} className="lifeos-raised lifeos-border min-h-11 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50"><ArrowLeftRight size={16} className="mr-1 inline" />Transfer</button></div></header>
    {error && !accountDraft && !transferDraft && <p role="alert" className="lifeos-danger rounded-xl border p-3 text-sm">{error}</p>}
    {!accounts.length ? <section className="lifeos-panel rounded-2xl border p-6 text-center"><Wallet size={25} className="mx-auto text-secondary" /><h3 className="mt-3 font-semibold">No accounts yet</h3><p className="mt-1 text-sm text-secondary">You can keep tracking transactions without adding an account.</p><button type="button" onClick={() => beginAccount()} className="lifeos-accent-button mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold">Add an account</button></section> : <section className="grid gap-3 sm:grid-cols-2">{accounts.map(account => {
      const history = transactions.filter(row => row.accountId === account.id).map(row => ({ id: row.id, date: row.date, label: row.description || row.category, amount: row.amountMinor ? BigInt(row.amountMinor) : decimalToMinorUnits(row.amount, row.currencyCode || account.currencyCode), currency: row.currencyCode || account.currencyCode, sign: accountActivitySign(account, row.type === 'income' ? 'income' : 'expense'), tx: row }));
      const transferHistory = transfers.filter(row => row.fromAccountId === account.id || row.toAccountId === account.id).map(row => {
        const transferOut = row.fromAccountId === account.id;
        return { id: row.id, date: row.date, label: transferOut ? `Transfer to ${accounts.find(x => x.id === row.toAccountId)?.name || 'account'}` : `Transfer from ${accounts.find(x => x.id === row.fromAccountId)?.name || 'account'}`, amount: BigInt(transferOut ? row.fromAmountMinor : row.toAmountMinor), currency: transferOut ? row.fromCurrencyCode : row.toCurrencyCode, sign: accountActivitySign(account, transferOut ? 'transfer-out' : 'transfer-in'), transfer: row };
      });
      const rows = [...history, ...transferHistory].sort((a, b) => b.date.localeCompare(a.date));
      return <article key={account.id} className="lifeos-panel rounded-2xl border p-4"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 gap-3"><span className="lifeos-tint flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><Landmark size={19} /></span><div className="min-w-0"><h3 className="truncate font-semibold">{account.name}</h3><p className="text-xs text-secondary">{accountTypes.find(([type]) => type === account.type)?.[1]} · {account.currencyCode}{!account.isActive && ' · Archived'}</p></div></div><button type="button" aria-label={`Edit ${account.name}`} onClick={() => beginAccount(account)} className="min-h-10 rounded-lg px-2 text-xs lifeos-accent-text">Edit</button></div><p className="mt-4 text-xs text-secondary">{account.type === 'credit-card' ? 'Amount owed' : 'Current balance'}</p><p className="type-display-amount tabular-nums">{balance(account)}</p><p className="mt-1 text-[11px] text-secondary">Includes opening amount and posted activity; transfers are excluded from income and expenses.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)} className="lifeos-raised min-h-10 rounded-lg px-3 text-xs">{expandedAccount === account.id ? 'Hide history' : `History (${rows.length})`}</button>{account.isActive ? <button type="button" onClick={async () => { try { await onUpdateAccount(account.id, { isActive: false }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not archive account.'); } }} className="lifeos-raised min-h-10 rounded-lg px-3 text-xs"><Archive size={14} className="mr-1 inline" />Archive</button> : <button type="button" onClick={async () => { try { await onUpdateAccount(account.id, { isActive: true }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore account.'); } }} className="lifeos-raised min-h-10 rounded-lg px-3 text-xs">Restore</button>}<button type="button" onClick={async () => { try { await onDeleteAccount(account.id); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Account cannot be deleted.'); } }} className="min-h-10 rounded-lg px-2 text-xs text-secondary">Delete empty account</button></div>{expandedAccount === account.id && <div className="mt-4 space-y-2 border-t border-[var(--stroke)] pt-3">{rows.length ? rows.map(row => <div key={row.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0"><strong className="block truncate">{row.label}</strong><span className="text-secondary">{row.date}</span></span><span className="shrink-0 tabular-nums">{row.sign}{formatMinorUnits(row.amount, row.currency, locale)}</span>{'transfer' in row && !row.transfer.reversalOfId && !transfers.some(item => item.reversalOfId === row.transfer.id) && <button type="button" onClick={() => beginTransfer(row.transfer)} className="text-[11px] lifeos-accent-text">Edit</button>}</div>) : <p className="text-xs text-secondary">No posted history.</p>}</div>}</article>;
    })}</section>}
    {transfers.length > 0 && <section className="lifeos-panel rounded-2xl border p-4"><h3 className="font-semibold">Transfers</h3><p className="mt-1 text-xs text-secondary">Transfers move value between accounts. They are not income or spending.</p><div className="mt-3 space-y-2">{transfers.map(transfer => { const fromName = accounts.find(row => row.id === transfer.fromAccountId)?.name || 'Account'; const toName = accounts.find(row => row.id === transfer.toAccountId)?.name || 'Account'; const hasReversal = transfers.some(row => row.reversalOfId === transfer.id); return <div key={transfer.id} className="flex items-center justify-between gap-2 rounded-xl lifeos-raised p-3 text-sm"><span className="min-w-0"><strong className="block truncate">{fromName} → {toName}</strong><span className="text-xs text-secondary">{transfer.date}{transfer.notes ? ` · ${transfer.notes}` : ''}</span></span><span className="shrink-0 tabular-nums">{formatMinorUnits(BigInt(transfer.fromAmountMinor), transfer.fromCurrencyCode, locale)}</span>{transfer.reversalOfId ? <span className="text-xs text-secondary">Reversed transfer</span> : hasReversal ? <span className="text-xs text-secondary">Reversed</span> : <><button type="button" onClick={() => beginTransfer(transfer)} className="min-h-10 px-2 text-xs lifeos-accent-text">Edit</button><button type="button" onClick={async () => { if (!window.confirm(buildTransferReversalConfirmation(transfer, fromName, toName, locale))) return; try { await onReverseTransfer(transfer.id, today()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reverse transfer.'); } }} className="min-h-10 px-2 text-xs text-secondary">Reverse</button></>}<button type="button" onClick={async () => { if (!window.confirm(transfer.reversalOfId ? 'Undo this reversal? The original transfer will become active again and account balances will update.' : 'Delete this transfer? This removes it from account history and updates the affected balances.')) return; try { await onDeleteTransfer(transfer.id); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove transfer.'); } }} aria-label={transfer.reversalOfId ? 'Undo transfer reversal' : 'Delete transfer'} className="min-h-10 px-2 text-xs text-secondary">{transfer.reversalOfId ? 'Undo reversal' : 'Delete'}</button></div>; })}</div></section>}
    {accountDraft && <div className="ui-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAccountDraft(null); }}><form role="dialog" aria-modal="true" aria-label={accountDraft.id ? 'Edit account' : 'Create account'} onSubmit={submitAccount} className="ui-sheet-motion ui-bottom-sheet lifeos-panel max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border p-5"><h3 className="text-lg font-semibold">{accountDraft.id ? 'Edit account' : 'Add account'}</h3><label className="block text-xs text-secondary">Account name<input autoFocus required maxLength={60} className={inputClass} value={accountDraft.name} onChange={event => setAccountDraft({ ...accountDraft, name: event.target.value })} /></label><div className="grid grid-cols-2 gap-3"><label className="block text-xs text-secondary">Type<select className={inputClass} value={accountDraft.type} onChange={event => setAccountDraft({ ...accountDraft, type: event.target.value as FinancialAccountType })}>{accountTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-xs text-secondary">Currency<select disabled={openingBalanceLocked} className={inputClass} value={accountDraft.currencyCode} onChange={event => setAccountDraft({ ...accountDraft, currencyCode: event.target.value })}>{CURRENCY_CODES.map(code => <option key={code} value={code}>{formatCurrencyChoice(code, locale)}</option>)}</select></label></div><label className="block text-xs text-secondary">Opening balance<input disabled={openingBalanceLocked} required type="number" inputMode="decimal" min="0" step="any" className={inputClass} value={accountDraft.opening} onChange={event => setAccountDraft({ ...accountDraft, opening: event.target.value })} /><span className="mt-1 block">{openingBalanceLocked ? 'Locked because account activity exists; changing it would rewrite historical balances.' : 'For a credit card, enter the amount already owed.'}</span></label><label className="block text-xs text-secondary">Description (optional)<input maxLength={160} className={inputClass} value={accountDraft.description} onChange={event => setAccountDraft({ ...accountDraft, description: event.target.value })} /></label>{error && <p role="alert" className="lifeos-danger rounded-lg p-2 text-xs">{error}</p>}<div className="flex gap-2"><button type="button" onClick={() => { setAccountDraft(null); setError(''); }} className="lifeos-raised min-h-11 flex-1 rounded-xl">Cancel</button><button type="submit" className="lifeos-accent-button min-h-11 flex-1 rounded-xl font-semibold">Save account</button></div></form></div>}
    {transferDraft && <div className="ui-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setTransferDraft(null); }}><form role="dialog" aria-modal="true" aria-label={transferDraft.id ? 'Edit transfer' : 'Record transfer'} onSubmit={submitTransfer} className="ui-sheet-motion ui-bottom-sheet lifeos-panel max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border p-5"><h3 className="text-lg font-semibold">{transferDraft.id ? 'Edit transfer' : 'Move between accounts'}</h3><label className="block text-xs text-secondary">From<select required className={inputClass} value={transferDraft.from} onChange={event => setTransferDraft({ ...transferDraft, from: event.target.value })}>{active.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currencyCode}</option>)}</select></label><label className="block text-xs text-secondary">To<select required className={inputClass} value={transferDraft.to} onChange={event => setTransferDraft({ ...transferDraft, to: event.target.value })}>{active.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currencyCode}</option>)}</select></label><label className="block text-xs text-secondary">Amount sent<input required type="number" min="0.01" step="any" inputMode="decimal" className={inputClass} value={transferDraft.fromAmount} onChange={event => setTransferDraft({ ...transferDraft, fromAmount: event.target.value, ...(accounts.find(row => row.id === transferDraft.from)?.currencyCode === accounts.find(row => row.id === transferDraft.to)?.currencyCode ? { toAmount: event.target.value } : {}) })} /></label>{accounts.find(row => row.id === transferDraft.from)?.currencyCode !== accounts.find(row => row.id === transferDraft.to)?.currencyCode && <><label className="block text-xs text-secondary">Amount received<input required type="number" min="0.01" step="any" inputMode="decimal" className={inputClass} value={transferDraft.toAmount} onChange={event => setTransferDraft({ ...transferDraft, toAmount: event.target.value })} /></label><label className="block text-xs text-secondary">Manual rate (received currency per 1 sent currency)<input required inputMode="decimal" className={inputClass} value={transferDraft.rate} onChange={event => setTransferDraft({ ...transferDraft, rate: event.target.value })} /><span className="mt-1 block">The entered amounts must agree with this rate after currency rounding.</span></label></>}<div className="grid grid-cols-2 gap-3"><label className="block text-xs text-secondary">Date<input required type="date" className={inputClass} value={transferDraft.date} onChange={event => setTransferDraft({ ...transferDraft, date: event.target.value })} /></label><label className="block text-xs text-secondary">Note<input maxLength={120} className={inputClass} value={transferDraft.notes} onChange={event => setTransferDraft({ ...transferDraft, notes: event.target.value })} /></label></div>{error && <p role="alert" className="lifeos-danger rounded-lg p-2 text-xs">{error}</p>}<div className="flex gap-2"><button type="button" onClick={() => { setTransferDraft(null); setError(''); }} className="lifeos-raised min-h-11 flex-1 rounded-xl">Cancel</button><button type="submit" className="lifeos-accent-button min-h-11 flex-1 rounded-xl font-semibold">Save transfer</button></div></form></div>}
  </main>;
}
