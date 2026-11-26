import { useRef, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import ComposerShell from './ComposerShell';
import { AliveDisclosure } from './AliveDisclosure';
import { PreferenceChoice } from './PreferenceChoice';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarClock, Plus, RefreshCw } from 'lucide-react';
import type { Category, FinancialAccount, ManualExchangeRate, PlannedCommitment, Transaction } from '../types';
import { CURRENCY_CODES } from '../services/userPreferences';
import { decimalToMinorUnits, formatCurrencyChoice, formatMinorUnits, minorUnitsToDecimal } from '../services/financeCore';
import { formatLocalDate } from '../services/domainUtils';
import type { ConfirmationOptions } from './ConfirmationDialog';
import InfoTip from './InfoTip';
import LifeDoodle from './LifeDoodle';
import AliveDetailDialog from './AliveDetailDialog';

type CommitmentInput = Omit<PlannedCommitment, 'id' | 'createdAt' | 'updatedAt'>;
type RateInput = Omit<ManualExchangeRate, 'id' | 'createdAt' | 'updatedAt'>;
type CommitmentDraft = { type?: 'income' | 'expense'; id?: string; title: string; amount: string; currency: string; frequency: PlannedCommitment['frequency']; date: string; categoryId: string; accountId: string; notes: string };
type RateDraft = { id?: string; base: string; quote: string; value: string; date: string; source: string };
export type MoneyPlanningDraftState = { commitment: CommitmentDraft | null; rate: RateDraft | null; commitmentDirty: boolean; rateDirty: boolean };
type Props = {
  commitments: PlannedCommitment[];
  transactions?: Transaction[];
  rates: ManualExchangeRate[];
  accounts: FinancialAccount[];
  categories: Category[];
  confirmAction: (options: ConfirmationOptions) => Promise<boolean>;
  onAddCommitment: (input: CommitmentInput) => Promise<void>;
  onUpdateCommitment: (id: string, input: Partial<CommitmentInput>) => Promise<void>;
  onDeleteCommitment: (id: string) => Promise<void>;
  onRecordOccurrence?: (row: PlannedCommitment) => Promise<void>;
  onAddRate: (input: RateInput) => Promise<void>;
  onUpdateRate: (id: string, input: Partial<RateInput>) => Promise<void>;
  onDeleteRate: (id: string) => Promise<void>;
  draftState?: MoneyPlanningDraftState;
  onDraftStateChange?: Dispatch<SetStateAction<MoneyPlanningDraftState>>;
  saving?: boolean;
};
const inputClass = 'lifeos-input mt-1 min-h-11 w-full rounded-xl px-3 py-2 text-sm';
const scheduleFrequency = (frequency: PlannedCommitment['frequency']) => frequency === 'once'
  ? 'One time' : frequency[0].toUpperCase() + frequency.slice(1);
const codeOptions = [...new Set(CURRENCY_CODES)].sort();

export default function MoneyPlanning({ commitments, transactions = [], rates, accounts, categories, confirmAction, onAddCommitment, onUpdateCommitment, onDeleteCommitment, onRecordOccurrence, onAddRate, onUpdateRate, onDeleteRate, draftState, onDraftStateChange, saving = false }: Props) {
  const reducedMotion = useReducedMotion() ?? false;
  const submittingCommitment = useRef(false);
  const [planningPanel, setPlanningPanel] = useState<'upcoming' | 'recurring' | 'history' | 'rates'>('upcoming');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [localDraftState, setLocalDraftState] = useState<MoneyPlanningDraftState>({ commitment: null, rate: null, commitmentDirty: false, rateDirty: false });
  const controlledDrafts = draftState !== undefined && onDraftStateChange !== undefined;
  const activeDraftState: MoneyPlanningDraftState = controlledDrafts ? draftState! : localDraftState;
  const { commitment, rate, commitmentDirty, rateDirty } = activeDraftState;
  const updateDraftState = (update: (state: MoneyPlanningDraftState) => MoneyPlanningDraftState) => {
    if (controlledDrafts) onDraftStateChange(state => update(state));
    else setLocalDraftState(state => update(state));
  };
  const setCommitment = (value: SetStateAction<CommitmentDraft | null>) => updateDraftState(state => ({ ...state, commitment: typeof value === 'function' ? value(state.commitment) : value }));
  const setRate = (value: SetStateAction<RateDraft | null>) => updateDraftState(state => ({ ...state, rate: typeof value === 'function' ? value(state.rate) : value }));
  const setCommitmentDirty = (value: SetStateAction<boolean>) => updateDraftState(state => ({ ...state, commitmentDirty: typeof value === 'function' ? value(state.commitmentDirty) : value }));
  const setRateDirty = (value: SetStateAction<boolean>) => updateDraftState(state => ({ ...state, rateDirty: typeof value === 'function' ? value(state.rateDirty) : value }));
  const [error, setError] = useState('');
  const [postingId, setPostingId] = useState<string | null>(null);
  const recordOccurrence = async (row: PlannedCommitment) => {
    if (saving || postingId || !onRecordOccurrence) return;
    setPostingId(row.id);
    try {
      const category = categories.find(item => item.id === row.categoryId);
      const account = accounts.find(item => item.id === row.accountId);
      if (!category) throw new Error('Edit this plan and choose a category before recording it.');
      const next = row.frequency === 'once' ? 'This one-time plan will be marked recorded.' : 'The next due date advances once.';
      if (await confirmAction({ title: 'Record this occurrence?', message: `Record ${formatMinorUnits(BigInt(row.amountMinor), row.currencyCode)} as ${row.type || 'expense'} for "${row.title}" on ${row.nextDueDate}, in ${category.name}, ${account ? 'assigned to ' + account.name : 'without an account'}? ${next} This does not confirm a bank payment.`, confirmLabel: 'Record occurrence' })) {
        await onRecordOccurrence(row);
        setError('');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Occurrence could not be recorded.'); }
    finally { setPostingId(null); }
  };
  const runAction = async (action: () => Promise<void>) => { try { await action(); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'This change could not be saved.'); } };
  const addCommitment = () => { setError(''); setCommitmentDirty(false); setCommitment({ type: 'expense', title: '', amount: '', currency: 'INR', frequency: 'monthly', date: formatLocalDate(new Date()), categoryId: '', accountId: '', notes: '' }); };
  const editCommitment = (row: PlannedCommitment) => { setError(''); setCommitmentDirty(false); setCommitment({ type: row.type || 'expense', id: row.id, title: row.title, amount: row.amountMinor ? minorUnitsToDecimal(BigInt(row.amountMinor), row.currencyCode) : String(row.amount), currency: row.currencyCode, frequency: row.frequency, date: row.nextDueDate, categoryId: row.categoryId || '', accountId: row.accountId || '', notes: row.notes || '' }); };
  const closeCommitment = async () => { if (saving || submittingCommitment.current) return; if (commitmentDirty && !(await confirmAction({ title: 'Discard commitment changes?', message: 'Your planned bill details have not been saved.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true }))) return; setCommitment(null); setCommitmentDirty(false); setError(''); };
  const saveCommitment = async (event: FormEvent) => { event.preventDefault(); if (saving || submittingCommitment.current || !commitment) return; submittingCommitment.current = true; try { const amountMinor = decimalToMinorUnits(commitment.amount, commitment.currency).toString(); const input: Omit<CommitmentInput, 'status'> = { type: commitment.type || 'expense', title: commitment.title.trim(), amount: Number(commitment.amount), amountMinor, currencyCode: commitment.currency, frequency: commitment.frequency, nextDueDate: commitment.date, categoryId: commitment.categoryId || undefined, accountId: commitment.accountId || undefined, notes: commitment.notes.trim() || undefined }; if (commitment.id) await onUpdateCommitment(commitment.id, input); else await onAddCommitment({ ...input, status: 'active' }); setCommitment(null); setCommitmentDirty(false); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Planned commitment could not be saved.'); } finally { submittingCommitment.current = false; } };
  const addRate = () => { setError(''); setRateDirty(false); setRate({ base: 'USD', quote: 'INR', value: '', date: formatLocalDate(new Date()), source: '' }); };
  const editRate = (row: ManualExchangeRate) => { setError(''); setRateDirty(false); setRate({ id: row.id, base: row.baseCurrencyCode, quote: row.quoteCurrencyCode, value: row.rate, date: row.effectiveDate, source: row.sourceLabel || '' }); };
  const closeRate = async () => { if (saving) return; if (rateDirty && !(await confirmAction({ title: 'Discard rate changes?', message: 'Your manual exchange rate has not been saved.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true }))) return; setRate(null); setRateDirty(false); setError(''); };
  const saveRate = async (event: FormEvent) => { event.preventDefault(); if (saving || !rate) return; try { const input: RateInput = { baseCurrencyCode: rate.base, quoteCurrencyCode: rate.quote, rate: rate.value.trim(), effectiveDate: rate.date, sourceLabel: rate.source.trim() || undefined }; if (rate.id) await onUpdateRate(rate.id, input); else await onAddRate(input); setRate(null); setRateDirty(false); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Rate could not be saved.'); } };
  const deletePlan = async (row: PlannedCommitment) => {
    if (!await confirmAction({ title: 'Delete this planned bill?', message: row.title + ' will be removed from your planning list. No posted transaction is affected.', confirmLabel: 'Delete plan', destructive: true })) return;
    await runAction(() => onDeleteCommitment(row.id));
  };
  const today = formatLocalDate(new Date());
  const plans = commitments.filter(row => row.status !== 'recorded')
    .sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate));
  const visiblePlans = plans.filter(row => planningPanel !== 'recurring' || row.frequency !== 'once');
  const nextPlan = planningPanel === 'upcoming' ? visiblePlans.find(row => row.status === 'active') : undefined;
  const detail = commitments.find(row => row.id === detailId);
  const statusLabel = (row: PlannedCommitment) => row.status === 'recorded' ? 'Recorded' : row.status === 'paused'
    ? 'Paused' : row.nextDueDate < today ? 'Past due' : row.nextDueDate === today ? 'Due today' : 'Upcoming';
  const canRecord = (row: PlannedCommitment) => Boolean(!saving && postingId === null && row.status === 'active'
    && row.nextDueDate <= today && onRecordOccurrence);
  const showAmount = (row: PlannedCommitment) => formatMinorUnits(BigInt(row.amountMinor), row.currencyCode);
  const posted = planningPanel === 'history' ? transactions.filter(row => row.commitmentId && row.commitmentOccurrenceDate)
    .sort((a, b) => (b.commitmentOccurrenceDate || '').localeCompare(a.commitmentOccurrenceDate || '')) : [];
  const recordedKeys = new Set(posted.map(row => `${row.commitmentId}:${row.commitmentOccurrenceDate}`));
  const missingRecordedPlans = planningPanel === 'history' ? commitments.filter(plan => plan.lastPostedDate &&
    !recordedKeys.has(`${plan.id}:${plan.lastPostedDate}`)) : [];

  const renderPlan = (row: PlannedCommitment, featured: boolean) => {
    const Direction = row.type === 'income' ? ArrowDownLeft : ArrowUpRight;
    return <article key={row.id} className="scheduled-plan-row" data-next={featured}>
      <button type="button" className="scheduled-row-open" aria-label={`View ${row.title}`} onClick={() => {
        setError(''); setDetailId(row.id);
      }}>
        <span className="scheduled-row-icon"><Direction size={20} aria-hidden="true" /></span>
        <span className="scheduled-row-identity">
          <strong>{row.title}</strong>
          <small>{row.type === 'income' ? 'Incoming' : 'Outgoing'} · {scheduleFrequency(row.frequency)}</small>
          <small>Due {row.nextDueDate} · {statusLabel(row)}</small>
        </span>
        <span className="scheduled-row-amount tabular-nums">{showAmount(row)}<small>{row.currencyCode}</small></span>
      </button>
      <div className="scheduled-row-actions">
        <button type="button" disabled={!canRecord(row)} onClick={() => void recordOccurrence(row)}
          aria-label={`Record occurrence for ${row.title}`}>{postingId === row.id ? 'Recording…' : 'Record occurrence'}</button>
        <button type="button" onClick={() => void runAction(() => onUpdateCommitment(row.id, { status: row.status === 'active' ? 'paused' : 'active' }))}>
          {row.status === 'active' ? 'Pause' : 'Resume'}
        </button>
        <button type="button" onClick={() => editCommitment(row)}>Edit</button>
        <button type="button" onClick={() => void deletePlan(row)}>Delete</button>
      </div>
    </article>;
  };

  return <main className="space-y-4" data-testid="money-planning">
    <div className="scheduled-tabs" role="group" aria-label="Schedule views">
      {([['upcoming', 'Upcoming'], ['recurring', 'Recurring'], ['history', 'History'], ['rates', 'Exchange rates']] as const).map(([id, label]) =>
        <button key={id} type="button" className="lifeos-input" aria-pressed={planningPanel === id} onClick={() => setPlanningPanel(id)}>{label}</button>)}
    </div>
    {error && !commitment && !rate && <p role="alert" className="lifeos-danger rounded-xl border p-3 text-sm">{error}</p>}
    {planningPanel === 'history' ? <section aria-label="Recorded occurrences" className="lifeos-panel rounded-2xl border p-4">
      <h3 className="type-section-title">Recorded occurrences</h3>
      {!posted.length && !missingRecordedPlans.length && <p className="text-sm text-secondary">No recorded occurrences yet.</p>}
      {posted.map(row => <article className="scheduled-history-row" key={row.id}>
        <div><strong>{row.description || row.category}</strong><p className="text-sm text-secondary">Recorded &middot; {row.commitmentOccurrenceDate}</p></div>
        {row.amountMinor && row.currencyCode && <span>{formatMinorUnits(BigInt(row.amountMinor), row.currencyCode)}</span>}
      </article>)}
      {missingRecordedPlans.map(row => <article className="scheduled-history-row" key={row.id}>
        <div><strong>{row.title}</strong><p className="text-sm text-secondary">Recorded &middot; {row.lastPostedDate} &middot; Transaction removed</p></div>
      </article>)}
      {commitments.filter(row => row.status === 'recorded').map(row => <button type="button" key={row.id}
        className="min-h-11 px-3 text-sm text-secondary" onClick={() => void deletePlan(row)}>Delete recorded plan {row.title}</button>)}
    </section> : planningPanel !== 'rates' ? <section className="scheduled-workspace">
      <header className="scheduled-workspace-header">
        <div className="flex items-center gap-2">
          <h3 className="type-section-title">{planningPanel === 'recurring' ? 'Recurring commitments' : 'Upcoming items'}</h3>
          <InfoTip label="Recurring Money confirmation">A plan creates no transaction automatically. When due, review and confirm one occurrence to record it and advance the plan.</InfoTip>
        </div>
        <button type="button" onClick={addCommitment} className="feather-primary shrink-0">
          <Plus size={15} className="mr-1 inline" aria-hidden="true" />Add scheduled item
        </button>
      </header>
      {nextPlan && <section className="scheduled-next" aria-label="Next commitment">
        <p><CalendarClock size={17} aria-hidden="true" />Next commitment</p>
        {renderPlan(nextPlan, true)}
      </section>}
      {!visiblePlans.length
        ? <div className="scheduled-empty lifeos-panel flex items-center gap-2"><LifeDoodle kind="empty-scheduled" /><p>No upcoming commitments.</p></div>
        : visiblePlans.some(row => row !== nextPlan) && <div className="scheduled-timeline" aria-label="Commitment timeline">
          {visiblePlans.filter(row => row !== nextPlan).map(row => renderPlan(row, false))}
        </div>}
    </section> :     <section className="lifeos-panel rounded-2xl border p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="lifeos-tint flex h-11 w-11 items-center justify-center rounded-xl"><RefreshCw size={19} /></span><div><h3 className="font-semibold">Manual exchange rates</h3><p className="mt-1 text-xs text-secondary">Offline rates you enter yourself. They are not live market quotes.</p></div></div><button type="button" onClick={addRate} className="lifeos-accent-button min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold"><Plus size={15} className="mr-1 inline" />Add rate</button></div>
      {!rates.length ? <p className="mt-5 rounded-xl lifeos-raised p-4 text-sm text-secondary">No manual rates saved. Mixed currencies will remain separate until a dated rate is available.</p> : <div className="mt-4 divide-y divide-[var(--stroke)]">{rates.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm"><strong>{row.baseCurrencyCode} → {row.quoteCurrencyCode}</strong><small className="ml-2 text-secondary">{row.effectiveDate}{row.sourceLabel ? ` · ${row.sourceLabel}` : ''}</small></span><span className="font-semibold tabular-nums">1 {row.baseCurrencyCode} = {row.rate} {row.quoteCurrencyCode}</span><span className="flex gap-1"><button type="button" onClick={() => editRate(row)} className="min-h-10 rounded-lg px-2 text-xs lifeos-accent-text">Edit</button><button type="button" onClick={async () => { if (!(await confirmAction({ title: 'Delete this manual rate?', message: `${row.baseCurrencyCode} to ${row.quoteCurrencyCode} at ${row.rate} for ${row.effectiveDate} will be removed.`, confirmLabel: 'Delete rate', destructive: true }))) return; await runAction(() => onDeleteRate(row.id)); }} className="min-h-10 rounded-lg px-2 text-xs text-secondary">Delete</button></span></div>)}</div>}
      <p className="mt-3 rounded-xl lifeos-raised p-3 text-xs leading-relaxed text-secondary">Each rate includes its effective date and optional source label. BusyDoo does not download rates or imply a conversion is current.</p>
    </section>}
    {detail && <AliveDetailDialog key={detail.id} title={detail.title} eyebrow="Scheduled commitment" onClose={() => setDetailId(null)}>
      <div className="scheduled-detail-amount">
        <p className="text-secondary">{detail.type === 'income' ? 'Incoming' : 'Outgoing'} · {detail.currencyCode}</p>
        <strong className="type-display-amount tabular-nums">{showAmount(detail)}</strong>
      </div>
      <dl className="scheduled-detail-metadata">
        <div><dt>Next due</dt><dd>{detail.nextDueDate}</dd></div>
        <div><dt>Status</dt><dd>{statusLabel(detail)}</dd></div>
        <div><dt>Repeats</dt><dd>{scheduleFrequency(detail.frequency)}</dd></div>
        <div><dt>Category</dt><dd>{categories.find(row => row.id === detail.categoryId)?.name ?? 'Unassigned'}</dd></div>
        <div><dt>Account</dt><dd>{accounts.find(row => row.id === detail.accountId)?.name ?? 'Unassigned'}</dd></div>
      </dl>
      {detail.notes && <p className="whitespace-pre-wrap break-words text-sm">{detail.notes}</p>}
      <button type="button" className="lifeos-accent-button min-h-11 rounded-xl px-4 font-semibold"
        disabled={!canRecord(detail)} onClick={() => {
          setDetailId(null);
          void recordOccurrence(detail);
        }}>Record occurrence</button>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="lifeos-raised min-h-11 rounded-xl px-4" onClick={() => { setDetailId(null); editCommitment(detail); }}>Edit</button>
        {detail.status !== 'recorded' && <button type="button" className="lifeos-raised min-h-11 rounded-xl px-4"
          disabled={saving} onClick={() => void runAction(() => onUpdateCommitment(detail.id, { status: detail.status === 'active' ? 'paused' : 'active' }))}>
          {detail.status === 'active' ? 'Pause' : 'Resume'}
        </button>}
        <button type="button" className="lifeos-raised min-h-11 rounded-xl px-4" onClick={() => {
          setDetailId(null); setPlanningPanel('history');
        }}>History</button>
      </div>
    </AliveDetailDialog>}
    <AnimatePresence>
      {commitment && <ComposerShell key="commitment" id="money-commitment-dialog" mode="page" portal
        title={commitment.id ? 'Edit planned commitment' : 'Plan recurring income or expense'}
        accessibleName="Planned commitment" submitLabel="Save plan" reduced={reducedMotion} saving={saving}
        dismiss={() => { void closeCommitment(); }} onSubmit={saveCommitment}
        onChange={() => setCommitmentDirty(true)} onChoiceChange={() => setCommitmentDirty(true)}>
        <label className="feather-composer-lead">Name
          <input required maxLength={80} className={inputClass} value={commitment.title}
            onChange={event => setCommitment(current => current && { ...current, title: event.target.value })} />
        </label>
        <PreferenceChoice variant="quick" label="Type" icon={<ArrowLeftRight size={18} aria-hidden="true" />} value={commitment.type || 'expense'}
          options={[['expense', 'Expense'], ['income', 'Income']]}
          onSelect={type => setCommitment(current => current && { ...current, type: type as 'income' | 'expense', categoryId: '' })} />
        <label className="block text-xs text-secondary">Amount
          <input required type="number" min={minorUnitsToDecimal(1n, commitment.currency)} step="any" inputMode="decimal"
            className={inputClass} value={commitment.amount}
            onChange={event => setCommitment(current => current && { ...current, amount: event.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <PreferenceChoice variant="quick" icon={<CalendarClock size={18} aria-hidden="true" />} label="Frequency" value={commitment.frequency}
            options={[['once', 'One time'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']]}
            onSelect={frequency => setCommitment(current => current && { ...current, frequency: frequency as PlannedCommitment['frequency'] })} />
          <label className="block text-xs text-secondary">Next due date
            <input required type="date" className={inputClass} value={commitment.date}
              onChange={event => setCommitment(current => current && { ...current, date: event.target.value })} />
          </label>
        </div>
        <AliveDisclosure label="Currency, account and category" defaultOpen={Boolean(commitment.categoryId || commitment.accountId || commitment.notes || commitment.currency !== 'INR')}>
          <PreferenceChoice variant="field" label="Currency" value={commitment.currency}
            options={codeOptions.map(code => [code, formatCurrencyChoice(code)])}
            onSelect={currency => setCommitment(current => current && { ...current, currency, accountId: '' })} />
          <PreferenceChoice variant="field" label="Category (optional)" value={commitment.categoryId}
            options={[[ '', 'No category'], ...categories.filter(row => row.type === (commitment.type || 'expense')).map(row => [row.id, row.name] as const)]}
            onSelect={categoryId => setCommitment(current => current && { ...current, categoryId })} />
          <PreferenceChoice variant="field" label="Account (optional)" value={commitment.accountId}
            options={[[ '', 'Unassigned'], ...accounts.filter(row => row.isActive && row.currencyCode === commitment.currency).map(row => [row.id, row.name] as const)]}
            onSelect={accountId => setCommitment(current => current && { ...current, accountId })} />
          <label className="block text-xs text-secondary">Note (optional)
            <input maxLength={120} className={inputClass} value={commitment.notes}
              onChange={event => setCommitment(current => current && { ...current, notes: event.target.value })} />
          </label>
        </AliveDisclosure>
        {error && <p role="alert" className="lifeos-danger rounded-lg p-2 text-xs">{error}</p>}
      </ComposerShell>}
    </AnimatePresence>
    {rate && <div className="ui-sheet-backdrop" onMouseDown={event => { if (!saving && event.target === event.currentTarget) void closeRate(); }}><form id="money-rate-dialog" role="dialog" aria-modal="true" aria-busy={saving} aria-label="Manual exchange rate" onSubmit={saveRate} onChange={() => setRateDirty(true)} className="ui-sheet-motion ui-bottom-sheet lifeos-panel record-composer record-composer--page space-y-3"><h3 className="text-lg font-semibold">{rate.id ? 'Edit manual rate' : 'Add manual rate'}</h3><div className="grid grid-cols-2 gap-3"><label className="block text-xs text-secondary">From currency<select className={inputClass} value={rate.base} onChange={e => setRate(current => current ? { ...current, base: e.target.value } : current)}>{codeOptions.map(code => <option key={code} value={code}>{code}</option>)}</select></label><label className="block text-xs text-secondary">To currency<select className={inputClass} value={rate.quote} onChange={e => setRate(current => current ? { ...current, quote: e.target.value } : current)}>{codeOptions.map(code => <option key={code} value={code}>{code}</option>)}</select></label></div><label className="block text-xs text-secondary">Quote units per 1 base unit<input required inputMode="decimal" maxLength={24} placeholder="e.g. 83.25" className={inputClass} value={rate.value} onChange={e => setRate(current => current ? { ...current, value: e.target.value } : current)} /></label><label className="block text-xs text-secondary">Effective date<input required type="date" className={inputClass} value={rate.date} onChange={e => setRate(current => current ? { ...current, date: e.target.value } : current)} /></label><label className="block text-xs text-secondary">Source label (optional)<input maxLength={80} placeholder="e.g. Bank statement" className={inputClass} value={rate.source} onChange={e => setRate(current => current ? { ...current, source: e.target.value } : current)} /></label>{error && <p role="alert" className="lifeos-danger rounded-lg p-2 text-xs">{error}</p>}<div className="ui-form-actions"><button type="button" disabled={saving} onClick={() => { void closeRate(); }} className="lifeos-raised min-h-11 flex-1 rounded-xl">Cancel</button><button type="submit" disabled={saving} className="lifeos-accent-button min-h-11 flex-1 rounded-xl font-semibold">{saving ? 'Saving…' : 'Save rate'}</button></div></form></div>}
  </main>;
}
