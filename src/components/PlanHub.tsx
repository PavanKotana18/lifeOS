import { CalendarDays, ChevronRight, CircleCheck } from 'lucide-react';
import type { Task } from '../types';
import { getTaskStatus, sortTasksBySchedule } from '../services/domainUtils';

type TaskRange = 'today' | 'tomorrow' | 'upcoming';
type Props = {
  tasks: Task[];
  today: string;
  now: Date;
  onNavigatePlanner: () => void;
  onOpenTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  onCreateTask: () => void;
  onSelectRange: (range: TaskRange) => void;
  onOpenGoals: () => void;
};

function formatTaskDate(value: string, today: string) {
  if (value === today) return 'Today';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

export default function PlanHub({ tasks, today, now, onNavigatePlanner, onOpenTask, onToggleTask, onCreateTask, onSelectRange, onOpenGoals }: Props) {
  const allOpenTasks = sortTasksBySchedule(tasks.filter(task => !task.completed));
  const openTasks = allOpenTasks.slice(0, 5);
  const dueToday = allOpenTasks.filter(task => task.dueDate === today && getTaskStatus(task, now) !== 'Overdue').length;
  const overdue = allOpenTasks.filter(task => getTaskStatus(task, now) === 'Overdue').length;
  const taskSummary = allOpenTasks.length ? [
    `${allOpenTasks.length} open`,
    ...(dueToday ? [`${dueToday} due today`] : []),
    ...(overdue ? [`${overdue} overdue`] : []),
  ].join(' · ') : '';
  const emptyTitle = tasks.length ? 'You’re all caught up' : 'No tasks yet';
  const emptyMessage = tasks.length ? 'Everything on your list is complete. Add another whenever you need it.' : 'Start with one thing you want to remember.';

  return <section aria-labelledby="plan-title" className="plan-hub">
    <header className="plan-hub-heading"><p className="type-eyebrow">YOUR TASKS</p><h2 id="plan-title" className="type-page-title">Plan</h2><p className="type-body text-secondary">See what’s next, then choose one thing to do.</p></header>

    <section aria-labelledby="plan-tasks-title" className="plan-hub-section plan-task-focus">
      <div className="plan-hub-section-heading"><div><p className="type-eyebrow">START HERE</p><h3 id="plan-tasks-title" className="type-section-title">Next up</h3>{taskSummary && <p className="type-caption text-secondary" aria-live="polite">{taskSummary}</p>}</div><button type="button" onClick={onCreateTask} className="lifeos-accent-button plan-hub-link"><span aria-hidden="true">+</span> Add task</button></div>

      <div className="plan-date-nav-intro"><span className="type-caption">Go to a date in your planner</span></div>
      <div className="plan-date-nav" role="group" aria-label="Open tasks by date" data-no-tab-swipe>
        <button type="button" onClick={() => onSelectRange('today')}><CalendarDays size={15} aria-hidden="true" />Today</button>
        <button type="button" onClick={() => onSelectRange('tomorrow')}>Tomorrow</button>
        <button type="button" onClick={() => onSelectRange('upcoming')}>Next 7 days</button>
      </div>

      {openTasks.length ? <ul className="plan-hub-list" aria-label="Open tasks">
        {openTasks.map(task => {
          const status = getTaskStatus(task, now);
          return <li key={task.id} className={`plan-hub-task ui-interactive-row${status === 'Overdue' ? ' is-overdue' : ''}`}>
            <label className="plan-hub-task-check"><input type="checkbox" checked={task.completed} onChange={() => onToggleTask(task)} aria-label={`Mark ${task.title} complete`} /></label>
            <button type="button" onClick={() => onOpenTask(task)} className="plan-hub-task-open">
              <span className="plan-hub-row-title">{task.title}</span>
              <span className="plan-hub-row-meta">{status === 'Overdue' ? `Overdue · ${formatTaskDate(task.dueDate, today)}` : task.dueDate ? formatTaskDate(task.dueDate, today) : 'No due date'}{task.dueTime ? ` · ${task.dueTime}` : task.dueDate && !task.dueTime ? ' · end of day' : ''}{task.recurring && task.recurring !== 'None' ? ` · Repeats ${task.recurring.toLocaleLowerCase()}` : ''}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </li>;
        })}
      </ul> : <div className="plan-hub-empty"><CircleCheck size={19} aria-hidden="true" /><div><strong>{emptyTitle}</strong><span>{emptyMessage}</span></div></div>}

      <button type="button" onClick={onNavigatePlanner} className="plan-hub-all">See all tasks in planner <ChevronRight size={16} aria-hidden="true" /></button>
    </section>

    <button type="button" onClick={onOpenGoals} className="plan-hub-goals-link"><span><strong>Working toward a longer-term goal?</strong><small>Your goals and milestones are in Life.</small></span><ChevronRight size={17} aria-hidden="true" /></button>
  </section>;
}
