import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, ChevronRight, Landmark, PiggyBank, Receipt, WalletCards } from 'lucide-react';
import type { Transaction } from '../types';
import { formatMinorUnits } from '../services/financeCore';
import MoneyPeriod from './MoneyPeriod';
import InfoTip from './InfoTip';

type Props = {
  month: string;
  monthly?: boolean;
  onMonthly?: () => void;
  monthSavings?: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  budgetRows: Array<{ category: string; allocated: number; spent: number; remaining: number }>;
  expenseChange: number | null;
  excludedCurrencyCount?: number;
  transactions: Transaction[];
  formatMoney: (amount: number, currencyCode?: string) => string;
  formatDate: (date: string) => string;
  formatTime: (date: Date) => string;
  onMonthChange: (month: string) => void;
  onAddTransaction: () => void;
  onTransactions: () => void;
  onBudgets: () => void;
  onSavings: () => void;
  onAnalytics: () => void;
  onPlanning: () => void;
  onAccounts: () => void;
  legacyCurrency: string;
  locale?: string;
  onEditTransaction: (transaction: Transaction) => void;
};

const moneyDestinations = [
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'budgets', label: 'Budgets', icon: WalletCards },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'analytics', label: 'Insights', icon: ChartNoAxesCombined },
  { id: 'planning', label: 'Plans', icon: CalendarDays },
] as const;

export default function MoneyHome({ month, monthly = false, onMonthly, monthSavings, expenseChange, income, expenses, netCashFlow, budgetRows, excludedCurrencyCount = 0, transactions, formatMoney, formatDate, formatTime, onMonthChange,
  onAddTransaction, onTransactions, onBudgets, onSavings, onAnalytics, onPlanning, onAccounts, legacyCurrency, locale, onEditTransaction }: Props) {
  const destinationActions = { transactions: onTransactions, accounts: onAccounts, budgets: onBudgets, savings: onSavings, analytics: onAnalytics, planning: onPlanning };

  return <div className="money-home" data-testid="money-home">
    {!monthly && <header className="money-home-heading">
      <h2 className="type-page-title">Money</h2>
      <MoneyPeriod label="Money" month={month} onChange={onMonthChange} />
    </header>}

    {!monthly && <button type="button" onClick={onAddTransaction} className="money-add-transaction" data-testid="money-add-transaction"><span aria-hidden="true">+</span><span><strong>Add transaction</strong></span></button>}

    <section className="money-cashflow" aria-labelledby="money-cashflow-title">
      <div className="money-cashflow-top justify-start"><h3 id="money-cashflow-title" className="type-section-title">Net cash flow</h3><InfoTip label="Net cash flow">Income received minus spending recorded in this period. Planned bills, transfers and savings contributions are separate.</InfoTip></div>
      <p className="type-display-amount" data-testid="money-net-cashflow">{formatMoney(netCashFlow)}</p>
      <div className="money-flow-split" role="group" aria-label={`Recorded cash flow: income ${formatMoney(income)}; expenses ${formatMoney(expenses)}`}>
        <div><span>Income</span><strong>{formatMoney(income)}</strong></div>
        <div><span>Spent</span><strong>{formatMoney(expenses)}</strong></div>
      </div>
      {excludedCurrencyCount > 0 && <p className="money-empty-note" role="status">{excludedCurrencyCount} financial item{excludedCurrencyCount === 1 ? '' : 's'} in another currency are left out of these totals. Comparing them requires a dated exchange rate.</p>}
    </section>

    {!monthly && <nav className="money-destinations" aria-label="Money destinations">{moneyDestinations.map(item => {
      const Icon = item.icon;
      return <button type="button" key={item.id} onClick={destinationActions[item.id]} className={`money-destination-card money-destination-${item.id}`}><span className="money-destination-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span><strong>{item.label}</strong></button>;
    })}</nav>}

    {!monthly && <button type="button" onClick={onMonthly} className="money-month-link lifeos-panel">This month <ChevronRight size={16} aria-hidden="true" /></button>}
    {monthly && <div className="space-y-4">
    {monthSavings && <section className="money-context"><h3 className="type-section-title">Savings contributions</h3><p className="mt-2 text-lg font-semibold tabular-nums">{monthSavings}</p></section>}
    {expenseChange != null && <section className="money-context"><h3 className="type-section-title">Spending trend</h3><p className="mt-2 text-sm">{expenseChange === 0 ? 'Unchanged from the previous month' : Math.abs(expenseChange).toFixed(1) + '% ' + (expenseChange > 0 ? 'higher' : 'lower') + ' than the previous month'}</p></section>}
    <section className="money-context" aria-label="Budget progress">
      <div className="money-context-heading"><div><h3 className="type-section-title">Budget progress</h3></div><div className="flex items-center gap-2"><InfoTip label="Budget remaining">Remaining is the plan limit minus posted spending in that category for this month. A negative amount means spending is above the limit.</InfoTip><button type="button" onClick={onBudgets} className="money-text-action">Budgets <ArrowRight size={15} aria-hidden="true" /></button></div></div>
      {budgetRows.length ? <ul className="money-budget-list">{budgetRows.slice(0, 2).map((row, index) => <li key={`${row.category}-${index}`}><div><strong>{row.category === 'Overall' ? 'Overall plan' : `${row.category} plan`}</strong><span>{formatMoney(row.spent)} recorded of {formatMoney(row.allocated)}</span></div><span className={row.remaining < 0 ? 'money-budget-over' : 'money-budget-remaining'}>{row.remaining < 0 ? `${formatMoney(Math.abs(row.remaining))} over` : `${formatMoney(row.remaining)} left`}</span></li>)}</ul> : <button type="button" className="money-context-empty" onClick={onBudgets}>No budget added for this month <span>Create a plan <ArrowRight size={14} aria-hidden="true" /></span></button>}
    </section>


    </div>}

    <section className="money-activity" aria-labelledby="money-activity-title">
      <div className="money-section-heading"><div><h3 id="money-activity-title" className="type-section-title">Activity</h3></div><button type="button" onClick={onTransactions} className="money-text-action">All transactions <ArrowRight size={15} aria-hidden="true" /></button></div>
      {!transactions.length ? <p className="money-empty-action" role="status">No transactions this month.</p> : <ul className="money-transaction-list">{transactions.slice(0, 4).map(transaction => {
        const title = transaction.description?.trim() || transaction.category || (transaction.type === 'income' ? 'Income' : 'Expense');
        const amount = transaction.amountMinor !== undefined && transaction.amountMinor !== null
          ? formatMinorUnits(BigInt(transaction.amountMinor), transaction.currencyCode || legacyCurrency, locale)
          : formatMoney(transaction.amount, transaction.currencyCode);
        const details = [formatDate(transaction.date), transaction.occurredAt ? formatTime(new Date(transaction.occurredAt)) : '', transaction.category && transaction.category !== title ? transaction.category : ''].filter(Boolean).join(' · ');
        return <li key={transaction.id}>
          <button type="button" aria-label={`View ${title}, ${transaction.type === 'income' ? 'income' : 'expense'} ${amount}${details ? `, ${details}` : ''}`} onClick={() => onEditTransaction(transaction)} className="money-transaction-row ui-interactive-row">
            <span className={`money-transaction-sign ${transaction.type === 'income' ? 'is-income' : 'is-expense'}`} aria-hidden="true">{transaction.type === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
            <span className="money-transaction-copy"><strong>{title}</strong><small>{details}</small></span>
            <span className={`money-transaction-amount ${transaction.type === 'income' ? 'is-income' : 'is-expense'}`} aria-hidden="true">{transaction.type === 'income' ? '+' : '−'}{amount}</span>
          </button>
        </li>;
      })}</ul>}
    </section>

  </div>;
}
