import { FeatherHeader } from './FeatherHeader';
import MoneyPeriod from './MoneyPeriod';

export type MoneyDetail = 'monthly' | 'transactions' | 'accounts' | 'budgets' | 'savings' | 'planning' | 'analytics' | 'projection';
const titles: Record<MoneyDetail, string> = {
  monthly: 'This month', transactions: 'Activity', accounts: 'Accounts', budgets: 'Budgets',
  savings: 'Savings', planning: 'Scheduled', analytics: 'Insights', projection: 'Savings projection',
};

export default function MoneyDetailHeader({ section, month, onMonthChange, onBack }: {
  section: MoneyDetail; month: string; onMonthChange: (month: string) => void; onBack: () => void;
}) {
  const title = titles[section];
  const hasPeriod = ['monthly', 'transactions', 'budgets', 'planning', 'analytics'].includes(section);
  return <div className="money-detail-heading"><FeatherHeader title={title} focusable
    back={{ label: section === 'projection' ? 'Savings' : 'Money overview', onClick: onBack }}
    action={hasPeriod && <MoneyPeriod label={section === 'analytics' ? 'Trends through' : title} month={month} onChange={onMonthChange} />} />
  </div>;
}
