import { ArrowRight, Check, Trash2 } from 'lucide-react';
import type { SavingsGoal } from '../types';

type Props = {
  goal: SavingsGoal;
  formatMoney: (amount: number) => string;
  formatDate: (date: string) => string;
  onContribute: () => void;
  onDelete: () => void;
};

const circumference = 2 * Math.PI * 39;

export default function SavingsGoalProgress({ goal, formatMoney, formatDate, onContribute, onDelete }: Props) {
  const targetValid = Number.isFinite(goal.targetAmount) && goal.targetAmount > 0;
  const savedValid = Number.isFinite(goal.currentAmount) && goal.currentAmount >= 0;
  const target = targetValid ? goal.targetAmount : 0;
  const saved = savedValid ? goal.currentAmount : 0;
  const ratio = target > 0 ? saved / target : 0;
  const visualProgress = Math.min(1, ratio);
  const percent = targetValid && savedValid ? Math.round(ratio * 100) : null;
  const gaugeLabel = percent === null ? 'Savings progress unavailable' : `${percent}% of ${formatMoney(target)} saved`;
  const status = percent === null ? 'Review the saved target and amount.'
    : saved >= target ? `Target reached · ${formatMoney(saved)} saved`
      : `${formatMoney(saved)} saved · ${formatMoney(target - saved)} to go`;

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
      <p className="savings-goal-target">Target · {targetValid ? formatMoney(target) : 'Unavailable'}</p>
      <div className="savings-goal-actions">
        <button type="button" onClick={onContribute} className="savings-goal-contribute">Add contribution <ArrowRight size={15} aria-hidden="true" /></button>
        <button type="button" onClick={onDelete} className="savings-goal-delete" aria-label={`Delete ${goal.title}`}><Trash2 size={16} aria-hidden="true" /><span>Delete</span></button>
      </div>
    </div>
    <span className="sr-only" role="progressbar" aria-label={`${goal.title} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(visualProgress * 100)} aria-valuetext={gaugeLabel} />
    {percent !== null && saved >= target && <span className="sr-only"><Check aria-hidden="true" /> Goal target reached.</span>}
  </article>;
}
