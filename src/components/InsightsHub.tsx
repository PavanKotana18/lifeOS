import type { Goal } from '../types';
import { getGoalProgress } from '../services/domainUtils';

type Props = {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
  completedRoutines: number;
  routinesDue: number;
  weeklyCompleted: number;
  weeklyTotal: number;
  goals: Goal[];
  hasHistory: boolean;
  formatMoney: (amount: number) => string;
  onFinance: () => void;
  onHabits: () => void;
  onGoals: () => void;
};

export default function InsightsHub(props: Props) {
  const { month, income, expenses, balance, transactionCount, completedRoutines, routinesDue, weeklyCompleted, weeklyTotal, goals, hasHistory, formatMoney, onFinance, onHabits, onGoals } = props;
  return <section aria-labelledby="insights-title" className="insights-hub">
    <header className="insights-heading"><p className="type-eyebrow">FROM YOUR SAVED RECORDS</p><h2 id="insights-title" className="type-page-title">Insights</h2><p className="type-body text-secondary">A few clear patterns, without combining unrelated parts of your life into one score.</p></header>
    {!hasHistory ? <section className="insights-empty lifeos-panel" aria-labelledby="insights-empty-title"><h3 id="insights-empty-title" className="type-section-title">Nothing to compare yet</h3><p className="mt-1 text-sm text-secondary">Save transactions, routines, or goals to see summaries here. LifeOS does not fill this space with sample numbers.</p><button onClick={onFinance} className="lifeos-accent-button mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold">Open Money</button></section> : <>
      {transactionCount > 0 && <section className="insights-section insight-money lifeos-panel" aria-labelledby="insights-money-title">
        <div className="flex items-center justify-between gap-2"><div><h3 id="insights-money-title" className="font-semibold">Money · {month}</h3><p className="text-xs text-secondary">From {transactionCount} saved transactions</p></div><button onClick={onFinance} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">Details</button></div>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-secondary">Income</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(income)}</dd></div><div><dt className="text-xs text-secondary">Expenses</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(expenses)}</dd></div><div><dt className="text-xs text-secondary">Net for this month</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(balance)}</dd></div></dl>
      </section>}
      {routinesDue + weeklyTotal > 0 && <section className="insights-section insight-routines lifeos-panel" aria-labelledby="insights-routine-title"><div className="flex items-center justify-between gap-2"><div><h3 id="insights-routine-title" className="font-semibold">Routines</h3><p className="text-xs text-secondary">Today’s scheduled check-ins and this week’s weekly routines</p></div><button onClick={onHabits} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">Details</button></div><p className="mt-3 text-sm">Today · {completedRoutines} of {routinesDue} checked</p>{weeklyTotal > 0 && <p className="mt-1 text-sm">This week · {weeklyCompleted} of {weeklyTotal} weekly routines checked</p>}</section>}
      {goals.length > 0 && <section className="insights-section insight-goals lifeos-panel" aria-labelledby="insights-goal-title">
        <div className="flex items-center justify-between gap-2"><div><h3 id="insights-goal-title" className="font-semibold">Goal progress</h3><p className="text-xs text-secondary">Based on your saved targets</p></div><button onClick={onGoals} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">All goals</button></div>
        <ul className="mt-3 space-y-4">{goals.slice(0, 3).map(goal => {
          const progress = getGoalProgress(goal.currentValue, goal.targetValue);
          return <li key={goal.id}>
            <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{goal.title}</span><span className="shrink-0 tabular-nums text-secondary">{progress}%</span></div>
            <div className="lifeos-progress-track mt-2 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} /></div>
            <p className="mt-1 text-xs text-secondary">{goal.currentValue.toLocaleString()} of {goal.targetValue.toLocaleString()}{goal.unit ? ` ${goal.unit}` : ''}</p>
          </li>;
        })}</ul>
      </section>}
      <button onClick={onGoals} className="lifeos-panel min-h-12 w-full rounded-xl border px-4 text-left text-sm font-medium">Review goal progress <span className="float-right text-secondary">→</span></button>
    </>}
  </section>;
}
