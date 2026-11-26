import type { Habit, HabitLog } from '../types';
import { formatLocalDate, isHabitEligible } from '../services/domainUtils';

export default function HabitHistory({ habit, logs, date, today, onSelect, formatDate }: {
  habit: Habit; logs: HabitLog[]; date: string; today: string; onSelect: (date: string) => void; formatDate: (date: string) => string;
}) {
  const [year, month] = (date || today).split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const completed = new Set(logs.filter(log => log.habitId === habit.id && log.completed).map(log => log.date));
  const checkedIn = [...completed].filter(key => key.startsWith((date || today).slice(0, 7))).length;
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return <section className="life-history" aria-label="Habit history">
    <div className="life-section-heading"><h4 className="font-semibold">{label}</h4><span className="text-sm text-secondary">{checkedIn} check-in {checkedIn === 1 ? 'day' : 'days'}</span></div>
    <div className="habit-history-calendar">
      {Array.from({ length: (first.getDay() + 6) % 7 }, (_, i) => <span key={'blank-' + i} aria-hidden="true" />)}
      {Array.from({ length: days }, (_, i) => {
        const key = formatLocalDate(new Date(year, month - 1, i + 1));
        const status = completed.has(key) ? 'checked in' : isHabitEligible(habit, key) ? 'no check-in' : 'not scheduled';
        return <button key={key} type="button" disabled={key > today} aria-pressed={key === date} data-completed={completed.has(key)}
          aria-label={formatDate(key) + ', ' + status} onClick={() => onSelect(key)}>{i + 1}</button>;
      })}
    </div>
  </section>;
}
