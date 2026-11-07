import { useState } from 'react';
import { ArrowRight, Check, Pencil, Trash2 } from 'lucide-react';
import type { SavingsContribution, SavingsGoal } from '../types';

type Props = {
  goal: SavingsGoal;
  formatMoney: (amount: number, currencyCode?: string) => string;
  formatDate: (date: string) => string;
  contributions?: SavingsContribution[];
  onContribute: () => void;
  onEditGoal: () => void;
  onDelete: () => void;
  onEditContribution: (contribution: SavingsContribution) => void;
  onDeleteContribution: (contribution: SavingsContribution) => void;
};

const circumference = 2 * Math.PI * 39;

export default function SavingsGoalProgress({ goal, formatMoney, formatDate, contributions = [], onContribute, onDelete, onEditGoal, onEditContribution, onDeleteContribution }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const targetValid = Number.isFinite(goal.targetAmount) && goal.targetAmount > 0;
  const savedValid = Number.isFinite(goal.currentAmount) && goal.currentAmount >= 0;
  const target = targetValid ? goal.targetAmount : 0;
  const saved = savedValid ? goal.currentAmount : 0;
  const ratio = target > 0 ? saved / target : 0;
  const visualProgress = Math.min(1, ratio);
  const percent = targetValid && savedValid ? Math.round(ratio * 100) : null;
  const gaugeLabel = percent === null ? 'Savings progress unavailable' : `${percent}% of ${formatMoney(target, goal.currencyCode)} saved`;
  const status = percent === null ? 'Review the saved target and amount.'
    : saved >= target ? `Target reached · ${formatMoney(saved, goal.currencyCode)} saved`
      : `${formatMoney(saved, goal.currencyCode)} saved · ${formatMoney(target - saved, goal.currencyCode)} to go`;

  return <article className="savings-goal-row" aria-labelledby={`savings-title-${goal.id}`}>
    <div className="savings-goal-gauge" role="img" aria-label={gaugeLabel}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="savings-goal-track" cx="50" cy="50" r="39" />
        <circle className="savings-goal-fill" cx="50" cy="50" r="39"
          strokeDasharray={`${(circumference * visualProgress).toFixed(2)} ${circumference.toFixed(2)}`} transform="rotate(-90 50 50)" />
      </svg>
      <span className="savings-goal-percent tabular-nums">{percent === null ? '—' : `${percent}%`}</span>
    </div>
    <div className="savings-goal-content">
      <div className="savings-goal-heading"><div className="min-w-0"><p className="type-eyebrow">{goal.category || 'PERSONAL GOAL'}</p><h4 id={`savings-title-${goal.id}`} className="type-section-title truncate">{goal.title}</h4></div><span className="savings-goal-target-date">By {formatDate(goal.targetDate)}</span></div>
      <p className="savings-goal-status" aria-live="polite">{status}</p>
      <p className="savings-goal-target">Target · {targetValid ? formatMoney(target, goal.currencyCode) : 'Unavailable'}</p>
      <div className="savings-goal-actions">
        <button type="button" onClick={onEditGoal} className="savings-goal-delete" aria-label={`Edit ${goal.title}`}><Pencil size={16} aria-hidden="true" /><span>Edit</span></button>
        <button type="button" onClick={onContribute} className="savings-goal-contribute">Add contribution <ArrowRight size={15} aria-hidden="true" /></button>
        <button type="button" onClick={onDelete} className="savings-goal-delete" aria-label={`Delete ${goal.title}`}><Trash2 size={16} aria-hidden="true" /><span>Delete</span></button>
      </div>
      {contributions.length > 0 && <div className="mt-3 border-t border-[var(--stroke)] pt-2">
        <button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen(open => !open)} className="min-h-11 text-left text-xs font-semibold text-secondary">{historyOpen ? 'Hide' : 'View'} {contributions.length} contribution{contributions.length === 1 ? '' : 's'}</button>
        {historyOpen && <ul className="space-y-1 pb-2">{contributions.map(contribution => <li key={contribution.id} className="flex min-h-11 items-center gap-2 text-xs">
          <span className="min-w-0 flex-1"><strong className="tabular-nums">{formatMoney(contribution.amount, contribution.currencyCode || goal.currencyCode)}</strong><span className="ml-2 text-secondary">{formatDate(contribution.date)}</span></span>
          <button type="button" onClick={() => onEditContribution(contribution)} className="min-h-11 min-w-11 rounded-lg text-secondary" aria-label="Edit contribution"><Pencil size={15} className="mx-auto" /></button>
          <button type="button" onClick={() => onDeleteContribution(contribution)} className="min-h-11 min-w-11 rounded-lg text-[var(--danger)]" aria-label="Delete contribution"><Trash2 size={15} className="mx-auto" /></button>
        </li>)}</ul>}
      </div>}
    </div>
    <span className="sr-only" role="progressbar" aria-label={`${goal.title} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(visualProgress * 100)} aria-valuetext={gaugeLabel} />
    {percent !== null && saved >= target && <span className="sr-only"><Check aria-hidden="true" /> Goal target reached.</span>}
  </article>;
}
