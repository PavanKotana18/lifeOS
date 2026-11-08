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
    <header className="plan-hub-heading"><p className="type-eyebrow">WHAT NEEDS DOING NEXT?</p><h2 id="plan-title" className="type-page-title">Plan</h2><p className="type-body text-secondary">Your tasks, arranged by when they’re due.</p></header>

    <section aria-labelledby="plan-tasks-title" className="plan-hub-section plan-task-focus">
      <div className="plan-hub-section-heading"><div><p className="type-eyebrow">START HERE</p><h3 id="plan-tasks-title" className="type-section-title">Next up</h3>{taskSummary && <p className="type-caption text-secondary" aria-live="polite">{taskSummary}</p>}</div><button type="button" onClick={onCreateTask} className="lifeos-accent-button plan-hub-link"><span aria-hidden="true">+</span> Add task</button></div>

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
              <span className="plan-hub-row-meta">{status === 'Overdue' ? 'Overdue · ' : ''}{task.dueDate ? task.dueDate === today ? 'Today' : task.dueDate : 'No date'}{task.dueTime ? ` · ${task.dueTime}` : task.dueDate && !task.dueTime ? ' · end of day' : ''}{task.recurring && task.recurring !== 'None' ? ` · ${task.recurring}` : ''}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </li>;
        })}
      </ul> : <div className="plan-hub-empty"><CircleCheck size={19} aria-hidden="true" /><div><strong>{emptyTitle}</strong><span>{emptyMessage}</span></div></div>}

      <button type="button" onClick={onNavigatePlanner} className="plan-hub-all">See all tasks <ChevronRight size={16} aria-hidden="true" /></button>
    </section>

    <button type="button" onClick={onOpenGoals} className="plan-hub-goals-link"><span><strong>Working toward a longer-term goal?</strong><small>Your goals and milestones are in Life.</small></span><ChevronRight size={17} aria-hidden="true" /></button>
  </section>;
}
