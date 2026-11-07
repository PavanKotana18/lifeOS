import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarClock, ChartNoAxesCombined, PiggyBank, Receipt, WalletCards } from 'lucide-react';
import type { Transaction } from '../types';

type Props = {
  month: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  budgetRows: Array<{ category: string; allocated: number; spent: number; remaining: number }>;
  largestCategory: { name: string; amount: number } | null;
  expenseChange: number | null;
  hasPreviousMonthRecords: boolean;
  excludedCurrencyCount?: number;
  transactions: Transaction[];
  formatMoney: (amount: number, currencyCode?: string) => string;
  formatDate: (date: string) => string;
  formatTime: (date: Date) => string;
  onMonthChange: (month: string) => void;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onMoveToSavings: () => void;
  onTransactions: () => void;
  onBudgets: () => void;
  onSavings: () => void;
  onAnalytics: () => void;
  onPlanning: () => void;
  onEditTransaction: (transaction: Transaction) => void;
};

const moneyDestinations = [
  { id: 'transactions', label: 'Transactions', note: 'Find and review activity', icon: Receipt },
  { id: 'budgets', label: 'Budgets', note: 'Plan monthly spending', icon: WalletCards },
  { id: 'savings', label: 'Savings', note: 'Goals and contributions', icon: PiggyBank },
  { id: 'analytics', label: 'Analytics', note: 'Understand your trends', icon: ChartNoAxesCombined },
  { id: 'planning', label: 'Planning', note: 'Explore transparent scenarios', icon: CalendarClock },
] as const;

export default function MoneyHome({ month, income, expenses, netCashFlow, budgetRows, largestCategory, expenseChange, hasPreviousMonthRecords, excludedCurrencyCount = 0, transactions, formatMoney, formatDate, formatTime, onMonthChange,
  onAddExpense, onAddIncome, onMoveToSavings, onTransactions, onBudgets, onSavings, onAnalytics, onPlanning, onEditTransaction }: Props) {
  const destinationActions = { transactions: onTransactions, budgets: onBudgets, savings: onSavings, analytics: onAnalytics, planning: onPlanning };
  const monthDate = /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T12:00:00`) : new Date();
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return <div className="money-home" data-testid="money-home">
    <header className="money-home-heading">
      <div><p className="type-eyebrow">MONEY</p><h2 className="type-page-title">Your money</h2><p className="type-body text-secondary">A clear view of what you’ve recorded.</p></div>
      <label className="money-period type-caption">Period<input type="month" aria-label="Money home month" value={month} onChange={event => onMonthChange(event.target.value)} /></label>
    </header>

    <section className="money-cashflow" aria-labelledby="money-cashflow-title">
      <div className="money-cashflow-top"><div><p className="type-eyebrow">{monthLabel.toUpperCase()}</p><h3 id="money-cashflow-title" className="type-section-title">Recorded cash flow</h3></div><span className="money-cashflow-mark" aria-hidden="true"><BarChart3 size={20} strokeWidth={1.8} /></span></div>
      <p className="type-display-amount" data-testid="money-net-cashflow">{formatMoney(netCashFlow)}</p>
      <p className="money-cashflow-caption">Income less expenses saved for this month</p>
      <div className="money-flow-split" aria-label={`Income ${formatMoney(income)}; expenses ${formatMoney(expenses)}`}>
        <div><span>Income</span><strong>{formatMoney(income)}</strong></div>
        <div><span>Expenses</span><strong>{formatMoney(expenses)}</strong></div>
      </div>
      {!transactions.length && <p className="money-empty-note">Nothing recorded for this month yet. Your totals will appear here after you add an entry.</p>}
      {excludedCurrencyCount > 0 && <p className="money-empty-note" role="status">{excludedCurrencyCount} financial item{excludedCurrencyCount === 1 ? '' : 's'} in another currency are left out of these totals. Comparing them requires a dated exchange rate.</p>}
    </section>

    <section aria-label="Quick money actions" className="money-quick-actions">
      <button type="button" onClick={onAddExpense} className="money-action money-action-expense"><span className="money-action-icon"><ArrowUpRight size={19} /></span><span><strong>Add expense</strong><small>Record money spent</small></span></button>
      <button type="button" onClick={onAddIncome} className="money-action money-action-income"><span className="money-action-icon"><ArrowDownLeft size={19} /></span><span><strong>Add income</strong><small>Record money received</small></span></button>
      <button type="button" onClick={onMoveToSavings} className="money-action money-action-savings"><span className="money-action-icon"><PiggyBank size={19} /></span><span><strong>Add to savings</strong><small>Contribute to a goal</small></span></button>
    </section>

    <section className="money-context" aria-label="Budget context and recorded insights">
      <div className="money-context-heading"><div><p className="type-eyebrow">THIS MONTH</p><h3 className="type-section-title">Plan and patterns</h3></div><button type="button" onClick={onBudgets} className="money-text-action">Budgets <ArrowRight size={15} aria-hidden="true" /></button></div>
      {budgetRows.length ? <ul className="money-budget-list">{budgetRows.slice(0, 2).map((row, index) => <li key={`${row.category}-${index}`}><div><strong>{row.category === 'Overall' ? 'Overall plan' : `${row.category} plan`}</strong><span>{formatMoney(row.spent)} recorded of {formatMoney(row.allocated)}</span></div><span className={row.remaining < 0 ? 'money-budget-over' : 'money-budget-remaining'}>{row.remaining < 0 ? `${formatMoney(Math.abs(row.remaining))} over` : `${formatMoney(row.remaining)} left`}</span></li>)}</ul> : <button type="button" className="money-context-empty" onClick={onBudgets}>No budget added for this month <span>Create a plan <ArrowRight size={14} aria-hidden="true" /></span></button>}
      <div className="money-insight" role="note"><span className="money-insight-mark" aria-hidden="true"><ChartNoAxesCombined size={17} /></span><p>{largestCategory ? <>Your largest recorded expense category is <strong>{largestCategory.name}</strong> at {formatMoney(largestCategory.amount)}.</> : expenses > 0 ? 'Category comparisons will appear as your recorded expenses build.' : 'Insights will appear when you have recorded activity to compare.'}{expenseChange !== null ? <> Expenses are {expenseChange > 0 ? 'up' : expenseChange < 0 ? 'down' : 'unchanged'} {Math.abs(expenseChange).toFixed(1)}% from the previous month.</> : hasPreviousMonthRecords ? ' A percentage comparison is unavailable because the previous month has no expense baseline.' : ''}</p></div>
    </section>

    <section className="money-activity" aria-labelledby="money-activity-title">
      <div className="money-section-heading"><div><p className="type-eyebrow">RECENT</p><h3 id="money-activity-title" className="type-section-title">Activity</h3></div><button type="button" onClick={onTransactions} className="money-text-action">All transactions <ArrowRight size={15} aria-hidden="true" /></button></div>
      {!transactions.length ? <button type="button" onClick={onAddExpense} className="money-empty-action"><span>No activity for this month</span><span>Add your first entry <ArrowRight size={15} aria-hidden="true" /></span></button> : <ul className="money-transaction-list">{transactions.slice(0, 4).map(transaction => <li key={transaction.id}>
        <button type="button" onClick={() => onEditTransaction(transaction)} className="money-transaction-row">
          <span className={`money-transaction-sign ${transaction.type === 'income' ? 'is-income' : 'is-expense'}`} aria-hidden="true">{transaction.type === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
          <span className="money-transaction-copy"><strong>{transaction.description || transaction.category || (transaction.type === 'income' ? 'Income' : 'Expense')}</strong><small>{formatDate(transaction.date)}{transaction.occurredAt ? ` · ${formatTime(new Date(transaction.occurredAt))}` : ''} · {transaction.category}</small></span>
          <span className={`money-transaction-amount ${transaction.type === 'income' ? 'is-income' : 'is-expense'}`}>{transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amount, transaction.currencyCode)}</span>
        </button>
      </li>)}</ul>}
    </section>

    <section className="money-tools" aria-labelledby="money-tools-title">
      <div className="money-section-heading"><div><p className="type-eyebrow">YOUR MONEY</p><h3 id="money-tools-title" className="type-section-title">Explore</h3></div></div>
      <div className="money-tool-list">{moneyDestinations.filter(item => item.id !== 'transactions').map(item => {
        const Icon = item.icon;
        return <button type="button" key={item.id} onClick={destinationActions[item.id]} className="money-tool-row">
          <span className="money-tool-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span><span className="money-tool-copy"><strong>{item.label}</strong><small>{item.note}</small></span><ArrowRight size={17} aria-hidden="true" />
        </button>;
      })}</div>
    </section>
  </div>;
}
