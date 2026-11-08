import type { SavingsGoal } from '../types';
import { getGoalProgress } from '../services/domainUtils';

type Props = {
  goals: SavingsGoal[];
  formatMoney: (amount: number) => string;
  onViewAll: () => void;
  onCreate: () => void;
};

export default function FinanceSavingsSummary({ goals, formatMoney, onViewAll, onCreate }: Props) {
  return <section className="lifeos-panel rounded-2xl border p-4" aria-labelledby="overview-savings-title">
    <div className="flex items-center justify-between gap-2">
      <div><h4 id="overview-savings-title" className="text-sm font-semibold">Savings goals</h4><p className="text-[10px] text-secondary">Saved progress, not projected returns</p></div>
      <button type="button" onClick={onViewAll} className="min-h-11 rounded-xl px-3 text-xs font-semibold lifeos-accent-text">All goals</button>
    </div>
    {goals.length === 0 ? <div className="mt-2">
      <p className="text-xs text-secondary">Start a goal for something you want to save toward.</p>
      <button type="button" onClick={onCreate} className="lifeos-accent-button mt-3 min-h-11 rounded-xl px-4 text-xs font-semibold">Create savings goal</button>
    </div> : <ul className="mt-3 space-y-3">{goals.slice(0, 2).map(goal => {
      const percent = getGoalProgress(goal.currentAmount, goal.targetAmount);
      return <li key={goal.id}>
        <div className="flex justify-between gap-2 text-xs"><span className="truncate font-medium">{goal.title}</span><span className="shrink-0 tabular-nums">{percent}%</span></div>
        <div className="lifeos-progress-track mt-1.5 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${percent}%` }} /></div>
        <p className="mt-1 text-[10px] text-secondary">{formatMoney(goal.currentAmount)} of {formatMoney(goal.targetAmount)}</p>
      </li>;
    })}</ul>}
  </section>;
}
