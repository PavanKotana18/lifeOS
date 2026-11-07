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
  hasHistory: boolean;
  formatMoney: (amount: number) => string;
  onFinance: () => void;
  onHabits: () => void;
  onGoals: () => void;
};

export default function InsightsHub(props: Props) {
  const { month, income, expenses, balance, transactionCount, completedRoutines, routinesDue, weeklyCompleted, weeklyTotal, hasHistory, formatMoney, onFinance, onHabits, onGoals } = props;
  return <section aria-labelledby="insights-title" className="space-y-4">
    <header><p className="text-sm text-secondary">A view of what your records show</p><h2 id="insights-title" className="text-xl font-semibold">Insights</h2></header>
    {!hasHistory ? <section className="lifeos-panel rounded-2xl border p-5"><h3 className="font-semibold">Your insights start with your records</h3><p className="mt-1 text-sm text-secondary">Add transactions, routines or goals to see progress summaries here. LifeOS won’t fill this space with sample numbers.</p><button onClick={onFinance} className="lifeos-accent-button mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold">Open Money</button></section> : <>
      {transactionCount > 0 && <section className="lifeos-panel rounded-2xl border p-4" aria-labelledby="insights-money-title">
        <div className="flex items-center justify-between gap-2"><div><h3 id="insights-money-title" className="font-semibold">Money · {month}</h3><p className="text-xs text-secondary">From {transactionCount} saved transactions</p></div><button onClick={onFinance} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">Details</button></div>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-secondary">Income</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(income)}</dd></div><div><dt className="text-xs text-secondary">Expenses</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(expenses)}</dd></div><div><dt className="text-xs text-secondary">Net for this month</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(balance)}</dd></div></dl>
      </section>}
      {routinesDue + weeklyTotal > 0 && <section className="lifeos-panel rounded-2xl border p-4" aria-labelledby="insights-routine-title"><div className="flex items-center justify-between gap-2"><div><h3 id="insights-routine-title" className="font-semibold">Routines</h3><p className="text-xs text-secondary">Today’s scheduled check-ins and this week’s weekly routines</p></div><button onClick={onHabits} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">Details</button></div><p className="mt-3 text-sm">Today · {completedRoutines} of {routinesDue} checked</p>{weeklyTotal > 0 && <p className="mt-1 text-sm">This week · {weeklyCompleted} of {weeklyTotal} weekly routines checked</p>}</section>}
      <button onClick={onGoals} className="lifeos-panel min-h-12 w-full rounded-xl border px-4 text-left text-sm font-medium">Review goal progress <span className="float-right text-secondary">→</span></button>
    </>}
  </section>;
}
