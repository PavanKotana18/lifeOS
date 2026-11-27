import { FeatherHeader } from './FeatherHeader';
import MoneyPeriod from './MoneyPeriod';

export type MoneyDetail = 'monthly' | 'transactions' | 'accounts' | 'budgets' | 'savings' | 'planning' | 'analytics' | 'projection';
const titles: Record<MoneyDetail, string> = {
  monthly: 'Monthly summary', transactions: 'Transactions', accounts: 'Accounts', budgets: 'Budgets',
  savings: 'Savings', planning: 'Schedule', analytics: 'Insights', projection: 'Savings projection',
};

export default function MoneyDetailHeader({ section, month, onMonthChange, onBack, fromToday = false }: {
  section: MoneyDetail; month: string; onMonthChange: (month: string) => void; onBack: () => void; fromToday?: boolean;
}) {
  const title = titles[section];
  const hasPeriod = ['monthly', 'transactions', 'budgets', 'planning', 'analytics'].includes(section);
  return <div className="money-detail-heading"><FeatherHeader title={title} focusable
    back={{ label: fromToday ? 'Back to Today' : section === 'projection' ? 'Savings' : 'Money overview', onClick: onBack }}
    action={hasPeriod && <MoneyPeriod label={section === 'analytics' ? 'Trends through' : title} month={month} onChange={onMonthChange} />} />
  </div>;
}
