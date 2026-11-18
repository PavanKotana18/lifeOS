import { ChevronLeft } from 'lucide-react';
import MoneyPeriod from './MoneyPeriod';

export type MoneyDetail = 'transactions' | 'accounts' | 'budgets' | 'savings' | 'planning' | 'analytics';
const titles: Record<MoneyDetail, string> = {
  transactions: 'Transactions', accounts: 'Accounts', budgets: 'Budgets',
  savings: 'Savings', planning: 'Upcoming bills', analytics: 'Insights',
};

export default function MoneyDetailHeader({ section, month, onMonthChange, onBack }: {
  section: MoneyDetail; month: string; onMonthChange: (month: string) => void; onBack: () => void;
}) {
  const title = titles[section];
  return <header className="money-detail-heading">
    <button type="button" className="money-back-button" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />Money overview</button>
    <div className="money-detail-title"><h2 tabIndex={-1}>{title}</h2>
      {['transactions', 'budgets', 'planning', 'analytics'].includes(section) && <MoneyPeriod label={title} month={month} onChange={onMonthChange} />}
    </div>
  </header>;
}
