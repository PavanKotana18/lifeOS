import { CalendarDays, ChevronRight, CircleCheck, ListFilter, Search } from 'lucide-react';
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
  const openTasks = sortTasksBySchedule(tasks.filter(task => !task.completed)).slice(0, 5);
  const dueToday = tasks.filter(task => !task.completed && task.dueDate === today).length;
  const overdue = tasks.filter(task => !task.completed && getTaskStatus(task, now) === 'Overdue').length;

  return <section aria-labelledby="plan-title" className="plan-hub">
    <header className="plan-hub-heading"><p className="type-eyebrow">A CLEAR NEXT STEP</p><h2 id="plan-title" className="type-page-title">Plan</h2><p className="type-body text-secondary">Tasks, dates, and the space to adjust as life changes.</p></header>

    <section aria-labelledby="plan-tasks-title" className="plan-hub-section plan-task-focus">
      <div className="plan-hub-section-heading"><div><p className="type-eyebrow">YOUR NEXT STEPS</p><h3 id="plan-tasks-title" className="type-section-title">Tasks</h3><p className="type-caption text-secondary">{dueToday ? `${dueToday} due today` : 'What needs your attention' }{overdue ? ` · ${overdue} overdue` : ''}</p></div><button type="button" onClick={onCreateTask} className="lifeos-accent-button plan-hub-link">+ Add task</button></div>

      <div className="plan-date-nav" aria-label="Choose task dates" data-no-tab-swipe>
        <button type="button" onClick={() => onSelectRange('today')}><CalendarDays size={15} aria-hidden="true" />Today</button>
        <button type="button" onClick={() => onSelectRange('tomorrow')}>Tomorrow</button>
        <button type="button" onClick={() => onSelectRange('upcoming')}>Next 7 days</button>
      </div>

      {openTasks.length ? <ul className="plan-hub-list" aria-label="Open tasks">
        {openTasks.map(task => {
          const status = getTaskStatus(task, now);
          return <li key={task.id} className={`plan-hub-task${status === 'Overdue' ? ' is-overdue' : ''}`}>
            <label className="plan-hub-task-check"><input type="checkbox" checked={task.completed} onChange={() => onToggleTask(task)} aria-label={`Mark ${task.title} complete`} /></label>
            <button type="button" onClick={() => onOpenTask(task)} className="plan-hub-task-open">
              <span className="plan-hub-row-title">{task.title}</span>
              <span className="plan-hub-row-meta">{status === 'Overdue' ? 'Overdue · ' : ''}{task.dueDate ? task.dueDate === today ? 'Today' : task.dueDate : 'No date'}{task.dueTime ? ` · ${task.dueTime}` : task.dueDate && !task.dueTime ? ' · end of day' : ''}{task.recurring && task.recurring !== 'None' ? ` · ${task.recurring}` : ''}</span>
            </button>
            <button type="button" onClick={() => onOpenTask(task)} aria-label={`Open ${task.title} details`} className="plan-hub-task-detail"><ChevronRight size={17} aria-hidden="true" /></button>
          </li>;
        })}
      </ul> : <div className="plan-hub-empty"><CircleCheck size={19} aria-hidden="true" /><div><strong>No open tasks</strong><span>Add a task whenever you want to make room for something.</span></div></div>}

      <button type="button" onClick={onNavigatePlanner} className="plan-hub-all">Open planner <ChevronRight size={16} aria-hidden="true" /></button>
    </section>

    <button type="button" onClick={onOpenGoals} className="plan-hub-goals-link"><span><strong>Working toward a longer-term goal?</strong><small>Your goals and milestones are in Life.</small></span><ChevronRight size={17} aria-hidden="true" /></button>
    <button type="button" onClick={() => onSelectRange('upcoming')} className="plan-hub-routines type-body"><span className="flex items-center gap-2"><ListFilter size={16} aria-hidden="true" />Review the next week</span><span aria-hidden="true">→</span></button>
  </section>;
}
