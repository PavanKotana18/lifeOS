import { ChevronLeft } from 'lucide-react';

export type MoneyDetail = 'transactions' | 'accounts' | 'budgets' | 'savings' | 'planning' | 'analytics';
const descriptions: Record<MoneyDetail, [string, string]> = {
  transactions: ['Transactions', 'Your posted activity. Search, review or record something new.'],
  accounts: ['Accounts', 'Optional balances and transfers, kept in each account’s currency.'],
  budgets: ['Budgets', 'Set a spending intention. Compare it with posted expenses.'],
  savings: ['Savings', 'Build toward a goal, one recorded contribution at a time.'],
  planning: ['Financial Planning', 'Upcoming income and bills. Plans remain separate until recorded.'],
  analytics: ['Analytics', 'Patterns from posted transactions. Planned amounts are excluded.'],
};

export default function MoneyDetailHeader({ section, month, onMonthChange, onBack }: {
  section: MoneyDetail; month: string; onMonthChange: (month: string) => void; onBack: () => void;
}) {
  const [title, description] = descriptions[section];
  const monthDate = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? new Date(`${month}-01T12:00:00`) : new Date();
  const compactPeriod = monthDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const accessiblePeriod = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return <header className="money-detail-heading">
    <button type="button" className="money-back-button" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />Money overview</button>
    <div className="money-detail-title"><div><p className="type-eyebrow">YOUR MONEY</p><h2 tabIndex={-1}>{title}</h2><p>{description}</p></div>
      {['transactions', 'budgets', 'planning', 'analytics'].includes(section) && <label className="money-period-control"><span aria-hidden="true">Period</span><span className="money-period-value" aria-hidden="true">{compactPeriod}</span><input aria-label={`${title} period, ${accessiblePeriod}`} type="month" value={month} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) onMonthChange(event.target.value); }} /> <span className="sr-only">{accessiblePeriod}</span></label>}
    </div>
  </header>;
}
