import { ChevronLeft } from 'lucide-react';
import MoneyPeriod from './MoneyPeriod';

export type MoneyDetail = 'monthly' | 'transactions' | 'accounts' | 'budgets' | 'savings' | 'planning' | 'analytics' | 'projection';
const titles: Record<MoneyDetail, string> = {
  monthly: 'This month', transactions: 'Transactions', accounts: 'Accounts', budgets: 'Budgets',
  savings: 'Savings', planning: 'Scheduled', analytics: 'Insights', projection: 'Savings projection',
};

export default function MoneyDetailHeader({ section, month, onMonthChange, onBack }: {
  section: MoneyDetail; month: string; onMonthChange: (month: string) => void; onBack: () => void;
}) {
  const title = titles[section];
  return <header className="money-detail-heading">
    <button type="button" className="money-back-button" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />{section === 'projection' ? 'Scheduled' : 'Money overview'}</button>
    <div className="money-detail-title"><h2 tabIndex={-1}>{title}</h2>
      {['monthly', 'transactions', 'budgets', 'planning', 'analytics'].includes(section) && <MoneyPeriod label={section === 'analytics' ? 'Trends through' : title} month={month} onChange={onMonthChange} />}
    </div>
  </header>;
}
