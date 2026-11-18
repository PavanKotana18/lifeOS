import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, ChartNoAxesCombined, PiggyBank, Receipt, WalletCards } from 'lucide-react';
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
  onAddTransaction: () => void;
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
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'budgets', label: 'Budgets', icon: WalletCards },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
] as const;

export default function MoneyHome({ month, income, expenses, netCashFlow, budgetRows, largestCategory, expenseChange, hasPreviousMonthRecords, excludedCurrencyCount = 0, transactions, formatMoney, formatDate, formatTime, onMonthChange,
  onAddTransaction, onMoveToSavings, onTransactions, onBudgets, onSavings, onAnalytics, onPlanning, onAccounts, accountSummaries = [], savingsGoals = [], legacyCurrency, onEditTransaction }: Props) {
  const destinationActions = { transactions: onTransactions, accounts: onAccounts, budgets: onBudgets, savings: onSavings, analytics: onAnalytics, planning: onPlanning };
  const monthDate = /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T12:00:00`) : new Date();
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const flowMaximum = Math.max(Math.abs(income), Math.abs(expenses));
  const flowWidth = (value: number) => flowMaximum > 0 && Number.isFinite(flowMaximum) ? `${Math.max(0, Math.min(100, Math.abs(value) / flowMaximum * 100))}%` : '0%';

  return <div className="money-home" data-testid="money-home">
    <header className="money-home-heading">
      <div><p className="type-eyebrow">MONEY</p><h2 className="type-page-title">Your money</h2><p className="type-body text-secondary">A clear view of what you’ve recorded.</p></div>
      <label className="money-period type-caption">Period<input type="month" aria-label="Money home month" value={month} onChange={event => onMonthChange(event.target.value)} /></label>
    </header>

    <button type="button" onClick={onAddTransaction} className="money-add-transaction" data-testid="money-add-transaction"><span aria-hidden="true">+</span><span><strong>Add transaction</strong><small>Choose income or expense</small></span><ArrowRight size={18} aria-hidden="true" /></button>

    <section className="money-cashflow" aria-labelledby="money-cashflow-title">
      <div className="money-cashflow-top"><div><p className="type-eyebrow">{monthLabel.toUpperCase()} · RECORDED CASH FLOW</p><h3 id="money-cashflow-title" className="type-section-title">Income minus expenses</h3></div><span className="money-cashflow-mark" aria-hidden="true"><BarChart3 size={20} strokeWidth={1.8} /></span></div>
      <p className="type-display-amount" data-testid="money-net-cashflow">{formatMoney(netCashFlow)}</p>
      <p className="money-cashflow-caption">Saved activity for this month.</p>
      <div className="money-flow-split" role="group" aria-label={`Recorded cash flow: income ${formatMoney(income)}; expenses ${formatMoney(expenses)}`}>
        <div><span>Income</span><strong>{formatMoney(income)}</strong></div>
        <div><span>Expenses</span><strong>{formatMoney(expenses)}</strong></div>
      </div>
      <div className="money-posted-bars" aria-hidden="true"><div className="money-posted-track"><span className="money-posted-income" style={{ width: flowWidth(income) }} /></div><div className="money-posted-track"><span className="money-posted-expense" style={{ width: flowWidth(expenses) }} /></div></div>
      <p className="money-empty-note">Posted activity only. Planned bills and savings targets are separate; this is not an account balance.</p>
      {excludedCurrencyCount > 0 && <p className="money-empty-note" role="status">{excludedCurrencyCount} financial item{excludedCurrencyCount === 1 ? '' : 's'} in another currency are left out of these totals. Comparing them requires a dated exchange rate.</p>}
    </section>

    <nav className="money-destinations" aria-label="Money destinations">{moneyDestinations.map(item => {
      const Icon = item.icon;
      return <button type="button" key={item.id} onClick={destinationActions[item.id]} className={`money-destination-card money-destination-${item.id}`}><span className="money-destination-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span><strong>{item.label}</strong><ArrowRight size={16} aria-hidden="true" /></button>;
    })}</nav>

    <details className="money-secondary-summary"><summary>Monthly details <span>Accounts, savings and spending patterns</span></summary><div className="money-secondary-content">
    {accountSummaries.length > 0 && <section className="money-context" aria-labelledby="money-account-summary-title"><div className="money-context-heading"><div><p className="type-eyebrow">OPTIONAL TRACKING</p><h3 id="money-account-summary-title" className="type-section-title">Account balances</h3></div><button type="button" onClick={onAccounts} className="money-text-action">Manage <ArrowRight size={15} aria-hidden="true" /></button></div><p className="mb-3 text-xs text-secondary">Each account is shown in its own currency; balances are not combined.</p>{accountSummaries.length > 3 && <p className="mb-2 text-xs text-secondary">Showing 3 of {accountSummaries.length} accounts.</p>}<ul className="money-budget-list">{accountSummaries.slice(0, 3).map(account => <li key={account.id}><div><strong>{account.name}</strong><span>{account.type.replace('-', ' ')} · {account.currencyCode}</span></div><strong className="tabular-nums" aria-label={`${account.name}: ${formatMinorUnits(BigInt(account.balanceMinor), account.currencyCode)}`}>{formatMinorUnits(BigInt(account.balanceMinor), account.currencyCode)}</strong></li>)}</ul></section>}

    {savingsGoals.length > 0 && <section className="money-context" aria-labelledby="money-savings-summary-title"><div className="money-context-heading"><div><p className="type-eyebrow">SAVINGS</p><h3 id="money-savings-summary-title" className="type-section-title">Progress toward goals</h3></div><div className="money-context-actions"><button type="button" onClick={onMoveToSavings} className="money-text-action">Add money <ArrowRight size={15} aria-hidden="true" /></button><button type="button" onClick={onSavings} className="money-text-action">All goals <ArrowRight size={15} aria-hidden="true" /></button></div></div><div className="mt-3 space-y-3">{savingsGoals.slice(0, 2).map(goal => { const code = goal.currencyCode || legacyCurrency; const current = goal.currentAmountMinor ? BigInt(goal.currentAmountMinor) : decimalToMinorUnits(goal.currentAmount, code); const target = goal.targetAmountMinor ? BigInt(goal.targetAmountMinor) : decimalToMinorUnits(goal.targetAmount, code); const percent = target > 0n ? Number(current * 10000n / target) / 100 : 0; const displayedPercent = Math.min(100, Math.max(0, percent)); return <div key={goal.id}><div className="flex justify-between gap-3 text-sm"><strong className="truncate">{goal.title}</strong><span className="shrink-0 tabular-nums">{formatMinorUnits(current, code)} / {formatMinorUnits(target, code)}</span></div><div className="lifeos-progress-track mt-2 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayedPercent}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${displayedPercent}%` }} /></div><p className="mt-1 text-xs text-secondary">{displayedPercent.toFixed(0)}% of target{goal.targetDate ? ` · ${goal.targetDate}` : ''}</p></div>; })}</div></section>}

    <section className="money-context" aria-label="Budget context and recorded insights">
      <div className="money-context-heading"><div><p className="type-eyebrow">THIS MONTH</p><h3 className="type-section-title">Spending plan and patterns</h3></div><button type="button" onClick={onBudgets} className="money-text-action">Budgets <ArrowRight size={15} aria-hidden="true" /></button></div>
      {budgetRows.length ? <ul className="money-budget-list">{budgetRows.slice(0, 2).map((row, index) => <li key={`${row.category}-${index}`}><div><strong>{row.category === 'Overall' ? 'Overall plan' : `${row.category} plan`}</strong><span>{formatMoney(row.spent)} recorded of {formatMoney(row.allocated)}</span></div><span className={row.remaining < 0 ? 'money-budget-over' : 'money-budget-remaining'}>{row.remaining < 0 ? `${formatMoney(Math.abs(row.remaining))} over` : `${formatMoney(row.remaining)} left`}</span></li>)}</ul> : <button type="button" className="money-context-empty" onClick={onBudgets}>No budget added for this month <span>Create a plan <ArrowRight size={14} aria-hidden="true" /></span></button>}
      <div className="money-insight" role="note"><span className="money-insight-mark" aria-hidden="true"><ChartNoAxesCombined size={17} /></span><p>{largestCategory ? <>Your largest recorded expense category is <strong>{largestCategory.name}</strong> at {formatMoney(largestCategory.amount)}.</> : expenses > 0 ? 'Category comparisons will appear as your recorded expenses build.' : 'Insights will appear when you have recorded activity to compare.'}{expenseChange !== null ? <> Expenses are {expenseChange > 0 ? 'up' : expenseChange < 0 ? 'down' : 'unchanged'} {Math.abs(expenseChange).toFixed(1)}% from the previous month.</> : hasPreviousMonthRecords ? ' A percentage comparison is unavailable because the previous month has no expense baseline.' : ''}</p></div>
    </section>

    <button type="button" onClick={onPlanning} className="money-text-action">Financial Planning <ArrowRight size={15} aria-hidden="true" /></button>

    </div></details>

    <section className="money-activity" aria-labelledby="money-activity-title">
      <div className="money-section-heading"><div><p className="type-eyebrow">RECENT</p><h3 id="money-activity-title" className="type-section-title">Activity</h3></div><button type="button" onClick={onTransactions} className="money-text-action">All transactions <ArrowRight size={15} aria-hidden="true" /></button></div>
      {!transactions.length ? <p className="money-empty-action" role="status">No activity for this period yet. Add an expense or income to start tracking.</p> : <ul className="money-transaction-list">{transactions.slice(0, 4).map(transaction => {
        const title = transaction.description?.trim() || transaction.category || (transaction.type === 'income' ? 'Income' : 'Expense');
        const amount = transaction.amountMinor !== undefined && transaction.amountMinor !== null
          ? formatMinorUnits(BigInt(transaction.amountMinor), transaction.currencyCode || legacyCurrency)
          : formatMoney(transaction.amount, transaction.currencyCode);
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

    {accountSummaries.length === 0 && <div className="money-optional-accounts"><span>Track income and spending without accounts.</span><button type="button" onClick={onAccounts} className="money-text-action">Optional accounts <ArrowRight size={15} aria-hidden="true" /></button></div>}
  </div>;
}
