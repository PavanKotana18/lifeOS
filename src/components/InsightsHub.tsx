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

function formatMonthLabel(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.getMonth() === Number(match[2]) - 1
    ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
    : month;
}

export default function InsightsHub(props: Props) {
  const { month, income, expenses, balance, transactionCount, completedRoutines, routinesDue, weeklyCompleted, weeklyTotal, goals, hasHistory, formatMoney, onFinance, onHabits, onGoals } = props;
  const hasMoneyRecords = transactionCount > 0;
  const hasRoutineRecords = routinesDue > 0 || weeklyTotal > 0;
  const hasGoalRecords = goals.length > 0;
  const hasInsightData = hasMoneyRecords || hasRoutineRecords || hasGoalRecords;
  return <section aria-labelledby="insights-title" className="insights-hub">
    <header className="insights-heading"><p className="type-eyebrow">FROM YOUR SAVED RECORDS</p><h2 id="insights-title" className="type-page-title">Insights</h2><p className="type-body text-secondary">See money, routines, and goals separately, using only information you’ve saved.</p></header>
    {!hasHistory || !hasInsightData ? <section className="insights-empty lifeos-panel" aria-labelledby="insights-empty-title">
      <p className="type-eyebrow">REAL RECORDS ONLY</p>
      <h3 id="insights-empty-title" className="type-section-title">{hasHistory ? 'No patterns to show yet' : 'Your insights start here'}</h3>
      <p className="mt-1 text-sm text-secondary">{hasHistory ? 'Insights currently summarize transactions, routine check-ins, and goal progress. Your other records stay saved and available in their usual screens.' : 'Add a transaction, check in to a habit, or set a goal. Summaries appear here as you build a history.'}</p>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Choose a record to add">
        <button type="button" onClick={onFinance} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-sm font-semibold">Money</button>
        <button type="button" onClick={onHabits} className="lifeos-panel min-h-11 rounded-xl border px-4 text-sm font-semibold">Habits</button>
        <button type="button" onClick={onGoals} className="lifeos-panel min-h-11 rounded-xl border px-4 text-sm font-semibold">Goals</button>
      </div>
    </section> : <>
      {hasMoneyRecords && <section className="insights-section insight-money lifeos-panel" aria-labelledby="insights-money-title">
        <div className="flex items-center justify-between gap-2"><div><p className="type-eyebrow">MONEY</p><h3 id="insights-money-title" className="font-semibold">{formatMonthLabel(month)}</h3><p className="text-xs text-secondary">Based on {transactionCount} saved transactions</p></div><button type="button" onClick={onFinance} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">View money</button></div>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-secondary">Income</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(income)}</dd></div><div><dt className="text-xs text-secondary">Expenses</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(expenses)}</dd></div><div><dt className="text-xs text-secondary">Income after expenses</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(balance)}</dd></div></dl>
      </section>}
      {hasRoutineRecords && <section className="insights-section insight-routines lifeos-panel" aria-labelledby="insights-routine-title"><div className="flex items-center justify-between gap-2"><div><p className="type-eyebrow">DAILY PRACTICE</p><h3 id="insights-routine-title" className="font-semibold">Habit check-ins</h3><p className="text-xs text-secondary">From your saved routine schedule</p></div><button type="button" onClick={onHabits} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">View habits</button></div>{routinesDue > 0 && <p className="mt-3 text-sm">Today · {completedRoutines} of {routinesDue} checked</p>}{weeklyTotal > 0 && <p className="mt-1 text-sm">This week · {weeklyCompleted} of {weeklyTotal} routines checked</p>}</section>}
      {hasGoalRecords && <section className="insights-section insight-goals lifeos-panel" aria-labelledby="insights-goal-title">
        <div className="flex items-center justify-between gap-2"><div><p className="type-eyebrow">LONGER-TERM</p><h3 id="insights-goal-title" className="font-semibold">Goal progress</h3><p className="text-xs text-secondary">Current progress against each saved target</p></div><button type="button" onClick={onGoals} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">View goals</button></div>
        <ul className="mt-3 space-y-4">{goals.slice(0, 3).map(goal => {
          const progress = getGoalProgress(goal.currentValue, goal.targetValue);
          return <li key={goal.id}>
            <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{goal.title}</span><span className="shrink-0 tabular-nums text-secondary">{progress}%</span></div>
            <div className="lifeos-progress-track mt-2 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} /></div>
            <p className="mt-1 text-xs text-secondary">{goal.currentValue.toLocaleString()} of {goal.targetValue.toLocaleString()}{goal.unit ? ` ${goal.unit}` : ''}</p>
          </li>;
        })}</ul>
      </section>}
    </>}
  </section>;
}
