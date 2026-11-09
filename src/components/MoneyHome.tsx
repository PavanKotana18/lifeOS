import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, BarChart3, CalendarClock, ChartNoAxesCombined, PiggyBank, Receipt, WalletCards } from 'lucide-react';
import type { SavingsGoal, Transaction } from '../types';
import { decimalToMinorUnits, formatMinorUnits } from '../services/financeCore';

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
  onTransfer: () => void;
  onMoveToSavings: () => void;
  onTransactions: () => void;
  onBudgets: () => void;
  onSavings: () => void;
  onAnalytics: () => void;
  onPlanning: () => void;
  onAccounts: () => void;
  accountSummaries: Array<{ id: string; name: string; type: string; currencyCode: string; balanceMinor: string }>;
  savingsGoals: SavingsGoal[];
  legacyCurrency: string;
  onEditTransaction: (transaction: Transaction) => void;
};

const moneyDestinations = [
  { id: 'transactions', label: 'Transactions', note: 'Find and review activity', icon: Receipt },
  { id: 'accounts', label: 'Accounts', note: 'Optional balances and transfers', icon: WalletCards },
  { id: 'budgets', label: 'Budgets', note: 'Plan monthly spending', icon: WalletCards },
  { id: 'savings', label: 'Savings', note: 'Goals and contributions', icon: PiggyBank },
  { id: 'analytics', label: 'Reports', note: 'Review spending over time', icon: ChartNoAxesCombined },
  { id: 'planning', label: 'Planned bills', note: 'Future bills and saved exchange rates', icon: CalendarClock },
] as const;

export default function MoneyHome({ month, income, expenses, netCashFlow, budgetRows, largestCategory, expenseChange, hasPreviousMonthRecords, excludedCurrencyCount = 0, transactions, formatMoney, formatDate, formatTime, onMonthChange,
  onAddExpense, onAddIncome, onTransfer, onMoveToSavings, onTransactions, onBudgets, onSavings, onAnalytics, onPlanning, onAccounts, accountSummaries = [], savingsGoals = [], legacyCurrency, onEditTransaction }: Props) {
  const destinationActions = { transactions: onTransactions, accounts: onAccounts, budgets: onBudgets, savings: onSavings, analytics: onAnalytics, planning: onPlanning };
  const monthDate = /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T12:00:00`) : new Date();
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return <div className="money-home" data-testid="money-home">
    <header className="money-home-heading">
      <div><p className="type-eyebrow">MONEY</p><h2 className="type-page-title">Your money</h2><p className="type-body text-secondary">A clear view of what you’ve recorded.</p></div>
      <label className="money-period type-caption">Period<input type="month" aria-label="Money home month" value={month} onChange={event => onMonthChange(event.target.value)} /></label>
    </header>

    <section aria-label="Quick money actions" className="money-quick-actions" data-testid="money-quick-actions">
      <button type="button" onClick={onAddExpense} className="money-action money-action-expense"><span className="money-action-icon"><ArrowUpRight size={19} /></span><span><strong>Add expense</strong><small>Money spent</small></span></button>
      <button type="button" onClick={onAddIncome} className="money-action money-action-income"><span className="money-action-icon"><ArrowDownLeft size={19} /></span><span><strong>Add income</strong><small>Money received</small></span></button>
      <button type="button" onClick={onTransfer} className="money-action money-action-transfer"><span className="money-action-icon"><ArrowLeftRight size={19} /></span><span><strong>Transfer</strong><small>Move between accounts</small></span></button>
    </section>

    <section className="money-cashflow" aria-labelledby="money-cashflow-title">
      <div className="money-cashflow-top"><div><p className="type-eyebrow">{monthLabel.toUpperCase()} · RECORDED CASH FLOW</p><h3 id="money-cashflow-title" className="type-section-title">Income minus expenses</h3></div><span className="money-cashflow-mark" aria-hidden="true"><BarChart3 size={20} strokeWidth={1.8} /></span></div>
      <p className="type-display-amount" data-testid="money-net-cashflow">{formatMoney(netCashFlow)}</p>
      <p className="money-cashflow-caption">Recorded income minus recorded spending. Transfers do not change this amount.</p>
      <div className="money-flow-split" role="group" aria-label={`Recorded cash flow: income ${formatMoney(income)}; expenses ${formatMoney(expenses)}`}>
        <div><span>Income</span><strong>{formatMoney(income)}</strong></div>
        <div><span>Expenses</span><strong>{formatMoney(expenses)}</strong></div>
      </div>
      {excludedCurrencyCount > 0 && <p className="money-empty-note" role="status">{excludedCurrencyCount} financial item{excludedCurrencyCount === 1 ? '' : 's'} in another currency are left out of these totals. Comparing them requires a dated exchange rate.</p>}
    </section>

    {accountSummaries.length > 0 && <section className="money-context" aria-labelledby="money-account-summary-title"><div className="money-context-heading"><div><p className="type-eyebrow">OPTIONAL TRACKING</p><h3 id="money-account-summary-title" className="type-section-title">Account balances</h3></div><button type="button" onClick={onAccounts} className="money-text-action">Manage <ArrowRight size={15} aria-hidden="true" /></button></div><p className="mb-3 text-xs text-secondary">Each account is shown in its own currency; balances are not combined.</p>{accountSummaries.length > 3 && <p className="mb-2 text-xs text-secondary">Showing 3 of {accountSummaries.length} accounts.</p>}<ul className="money-budget-list">{accountSummaries.slice(0, 3).map(account => <li key={account.id}><div><strong>{account.name}</strong><span>{account.type.replace('-', ' ')} · {account.currencyCode}</span></div><strong className="tabular-nums" aria-label={`${account.name}: ${formatMinorUnits(BigInt(account.balanceMinor), account.currencyCode)}`}>{formatMinorUnits(BigInt(account.balanceMinor), account.currencyCode)}</strong></li>)}</ul></section>}

    {savingsGoals.length > 0 && <section className="money-context" aria-labelledby="money-savings-summary-title"><div className="money-context-heading"><div><p className="type-eyebrow">SAVINGS</p><h3 id="money-savings-summary-title" className="type-section-title">Progress toward goals</h3></div><div className="money-context-actions"><button type="button" onClick={onMoveToSavings} className="money-text-action">Add money <ArrowRight size={15} aria-hidden="true" /></button><button type="button" onClick={onSavings} className="money-text-action">All goals <ArrowRight size={15} aria-hidden="true" /></button></div></div><div className="mt-3 space-y-3">{savingsGoals.slice(0, 2).map(goal => { const code = goal.currencyCode || legacyCurrency; const current = goal.currentAmountMinor ? BigInt(goal.currentAmountMinor) : decimalToMinorUnits(goal.currentAmount, code); const target = goal.targetAmountMinor ? BigInt(goal.targetAmountMinor) : decimalToMinorUnits(goal.targetAmount, code); const percent = target > 0n ? Number(current * 10000n / target) / 100 : 0; const displayedPercent = Math.min(100, Math.max(0, percent)); return <div key={goal.id}><div className="flex justify-between gap-3 text-sm"><strong className="truncate">{goal.title}</strong><span className="shrink-0 tabular-nums">{formatMinorUnits(current, code)} / {formatMinorUnits(target, code)}</span></div><div className="lifeos-progress-track mt-2 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayedPercent}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${displayedPercent}%` }} /></div><p className="mt-1 text-xs text-secondary">{displayedPercent.toFixed(0)}% of target{goal.targetDate ? ` · ${goal.targetDate}` : ''}</p></div>; })}</div></section>}

    <section className="money-context" aria-label="Budget context and recorded insights">
      <div className="money-context-heading"><div><p className="type-eyebrow">THIS MONTH</p><h3 className="type-section-title">Spending plan and patterns</h3></div><button type="button" onClick={onBudgets} className="money-text-action">Budgets <ArrowRight size={15} aria-hidden="true" /></button></div>
      {budgetRows.length ? <ul className="money-budget-list">{budgetRows.slice(0, 2).map((row, index) => <li key={`${row.category}-${index}`}><div><strong>{row.category === 'Overall' ? 'Overall plan' : `${row.category} plan`}</strong><span>{formatMoney(row.spent)} recorded of {formatMoney(row.allocated)}</span></div><span className={row.remaining < 0 ? 'money-budget-over' : 'money-budget-remaining'}>{row.remaining < 0 ? `${formatMoney(Math.abs(row.remaining))} over` : `${formatMoney(row.remaining)} left`}</span></li>)}</ul> : <button type="button" className="money-context-empty" onClick={onBudgets}>No budget added for this month <span>Create a plan <ArrowRight size={14} aria-hidden="true" /></span></button>}
      <div className="money-insight" role="note"><span className="money-insight-mark" aria-hidden="true"><ChartNoAxesCombined size={17} /></span><p>{largestCategory ? <>Your largest recorded expense category is <strong>{largestCategory.name}</strong> at {formatMoney(largestCategory.amount)}.</> : expenses > 0 ? 'Category comparisons will appear as your recorded expenses build.' : 'Insights will appear when you have recorded activity to compare.'}{expenseChange !== null ? <> Expenses are {expenseChange > 0 ? 'up' : expenseChange < 0 ? 'down' : 'unchanged'} {Math.abs(expenseChange).toFixed(1)}% from the previous month.</> : hasPreviousMonthRecords ? ' A percentage comparison is unavailable because the previous month has no expense baseline.' : ''}</p></div>
    </section>

    <section className="money-activity" aria-labelledby="money-activity-title">
      <div className="money-section-heading"><div><p className="type-eyebrow">RECENT</p><h3 id="money-activity-title" className="type-section-title">Activity</h3></div><button type="button" onClick={onTransactions} className="money-text-action">All transactions <ArrowRight size={15} aria-hidden="true" /></button></div>
      {!transactions.length ? <p className="money-empty-action" role="status">No activity for this period yet. Choose Expense, Income or Transfer above.</p> : <ul className="money-transaction-list">{transactions.slice(0, 4).map(transaction => {
        const title = transaction.description?.trim() || transaction.category || (transaction.type === 'income' ? 'Income' : 'Expense');
        const amount = formatMoney(transaction.amount, transaction.currencyCode);
        const details = [formatDate(transaction.date), transaction.occurredAt ? formatTime(new Date(transaction.occurredAt)) : '', transaction.category && transaction.category !== title ? transaction.category : ''].filter(Boolean).join(' · ');
        return <li key={transaction.id}>
          <button type="button" aria-label={`Edit ${title}, ${transaction.type === 'income' ? 'income' : 'expense'} ${amount}${details ? `, ${details}` : ''}`} onClick={() => onEditTransaction(transaction)} className="money-transaction-row ui-interactive-row">
            <span className={`money-transaction-sign ${transaction.type === 'income' ? 'is-income' : 'is-expense'}`} aria-hidden="true">{transaction.type === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
            <span className="money-transaction-copy"><strong>{title}</strong><small>{details}</small></span>
            <span className={`money-transaction-amount ${transaction.type === 'income' ? 'is-income' : 'is-expense'}`} aria-hidden="true">{transaction.type === 'income' ? '+' : '−'}{amount}</span>
          </button>
        </li>;
      })}</ul>}
    </section>

    <details className="money-tools">
      <summary className="money-section-heading"><div><p className="type-eyebrow">YOUR MONEY</p><h3 className="type-section-title">More tools</h3></div><span className="money-tools-hint">Accounts, budgets, savings, reports and planned bills</span></summary>
      <div className="money-tool-list">{moneyDestinations.filter(item => item.id !== 'transactions').map(item => {
        const Icon = item.icon;
        return <button type="button" key={item.id} onClick={destinationActions[item.id]} className="money-tool-row">
          <span className="money-tool-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span><span className="money-tool-copy"><strong>{item.label}</strong><small>{item.note}</small></span><ArrowRight size={17} aria-hidden="true" />
        </button>;
      })}</div>
    </details>
  </div>;
}
