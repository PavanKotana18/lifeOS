import { useId, useState } from 'react';
import { Bell, CalendarDays, ChevronRight, CircleCheck, Repeat2 } from 'lucide-react';
import type { Task } from '../types';
import { getTaskStatus, sortTasksBySchedule } from '../services/domainUtils';
import QuickTaskEntry from './QuickTaskEntry';

export type PlanView = 'today' | 'upcoming' | 'all' | 'unscheduled';
export type PlanStatus = 'all' | 'open' | 'completed' | 'overdue';
type TaskRange = 'today' | 'tomorrow' | 'upcoming';
type Props = {
  tasks: Task[]; today: string; now: Date;
  onNavigatePlanner: () => void; onOpenTask: (task: Task) => void;
  onToggleTask: (task: Task) => void; onCreateTask: () => void;
  onSelectRange: (range: TaskRange) => void; onOpenGoals: () => void;
  onQuickAdd?: (title: string) => Promise<void>;
};

/** Local presentation only: records and writes remain owned by the caller. */
export function selectPlanTasks(tasks: Task[], today: string, now: Date, view: PlanView, query: string, status: PlanStatus): Task[] {
  const needle = query.trim().toLocaleLowerCase();
  return sortTasksBySchedule(tasks.filter(task => {
    if (view === 'today' && task.dueDate !== today) return false;
    if (view === 'upcoming' && (!task.dueDate || task.dueDate <= today)) return false;
    if (view === 'unscheduled' && task.dueDate) return false;
    if (status === 'open' && task.completed) return false;
    if (status === 'completed' && !task.completed) return false;
    if (status === 'overdue' && getTaskStatus(task, now) !== 'Overdue') return false;
    return !needle || [task.title, task.description, task.notes, task.category].some(value => value?.toLocaleLowerCase().includes(needle));
  }));
}

function formatTaskDate(value: string | undefined, today: string) {
  if (!value) return 'No due date';
  if (value === today) return 'Today';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

export default function PlanHub({ tasks, today, now, onNavigatePlanner, onOpenTask, onToggleTask, onCreateTask, onOpenGoals, onQuickAdd }: Props) {
  const [view, setView] = useState<PlanView>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PlanStatus>('open');
  const filterId = useId();
  const visible = selectPlanTasks(tasks, today, now, view, query, status);
  const open = tasks.filter(task => !task.completed);
  const overdue = open.filter(task => getTaskStatus(task, now) === 'Overdue').length;
  const dueToday = open.filter(task => task.dueDate === today && getTaskStatus(task, now) !== 'Overdue').length;
  const summary = [`${open.length} open`, ...(dueToday ? [`${dueToday} due today`] : []), ...(overdue ? [`${overdue} overdue`] : [])].join(' \u00b7 ');
  const views: { id: PlanView; label: string }[] = [{ id: 'today', label: 'Today' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'all', label: 'All' }, { id: 'unscheduled', label: 'Unscheduled' }];
  const narrowed = Boolean(query.trim()) || status !== 'open' || view !== 'all';
  return <section aria-labelledby="plan-title" className="plan-hub plan-workspace">
    <header className="plan-workspace-heading"><div><p className="type-eyebrow">YOUR TASKS</p><h2 id="plan-title" className="type-page-title">Plan</h2><p className="type-caption text-secondary">{summary}</p></div><button type="button" onClick={onCreateTask} className="lifeos-accent-button plan-compose">+ Add task</button></header>
    {onQuickAdd && <div className="plan-quick-entry"><QuickTaskEntry onAdd={onQuickAdd} label="Quick task" /></div>}
    <div className="plan-view-controls" data-no-tab-swipe>
      <div className="plan-view-switch" role="group" aria-label="Task views">{views.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}<span>{selectPlanTasks(tasks, today, now, item.id, '', status).length}</span></button>)}</div>
      <div className="plan-search-controls"><label htmlFor={`${filterId}-search`} className="plan-search-label"><span>Search tasks</span><input id={`${filterId}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, notes or category" className="lifeos-input" /></label><label htmlFor={`${filterId}-status`}><span>Status</span><select id={`${filterId}-status`} value={status} onChange={event => setStatus(event.target.value as PlanStatus)} className="lifeos-input"><option value="open">Open</option><option value="all">All statuses</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select></label></div>
    </div>
    <section className="plan-task-workspace" aria-labelledby="plan-tasks-title">
      <div className="plan-list-heading"><h3 id="plan-tasks-title">{views.find(item => item.id === view)?.label} tasks</h3><span role="status" className="type-caption text-secondary">{visible.length} shown</span></div>
      {visible.length ? <ul className="plan-hub-list" aria-label="Tasks in selected view">{visible.map(task => {
        const taskStatus = getTaskStatus(task, now);
        return <li key={task.id} className={`plan-hub-task ui-interactive-row${taskStatus === 'Overdue' ? ' is-overdue' : ''}${task.completed ? ' is-complete' : ''}`}>
          <label className="plan-hub-task-check"><input type="checkbox" checked={task.completed} onChange={() => onToggleTask(task)} aria-label={`Mark ${task.title} ${task.completed ? 'incomplete' : 'complete'}`} /></label>
          <button type="button" onClick={() => onOpenTask(task)} className="plan-hub-task-open"><span className="plan-hub-row-title">{task.title}</span><span className="plan-hub-row-meta">{taskStatus === 'Overdue' ? 'Overdue \u00b7 ' : task.completed ? 'Completed \u00b7 ' : ''}{formatTaskDate(task.dueDate, today)}{task.dueTime ? ` \u00b7 ${task.dueTime}` : task.dueDate ? ' \u00b7 end of day' : ''}<span className="plan-schedule-indicators">{task.recurring && task.recurring !== 'None' && <span><Repeat2 size={12} aria-hidden="true" />Repeats {task.recurring.toLocaleLowerCase()}</span>}{task.reminderAt && <span><Bell size={12} aria-hidden="true" />Reminder set</span>}</span></span><ChevronRight size={17} aria-hidden="true" /></button>
        </li>;
      })}</ul> : <div className="plan-hub-empty"><CircleCheck size={21} aria-hidden="true" /><div><strong>{!tasks.length ? 'No tasks yet' : narrowed ? 'No tasks match this view' : 'You are all caught up'}</strong><span>{!tasks.length ? 'Start with one thing you want to remember.' : narrowed ? 'Try another view or status, or clear your search.' : 'Your completed tasks are available under All statuses.'}</span>{narrowed && tasks.length > 0 && <button type="button" onClick={() => { setView('all'); setStatus('all'); setQuery(''); }}>Show every task</button>}</div></div>}
    </section>
    <footer className="plan-workspace-footer"><button type="button" onClick={onNavigatePlanner}><CalendarDays size={16} aria-hidden="true" />Calendar planner<ChevronRight size={15} aria-hidden="true" /></button><button type="button" onClick={onOpenGoals}>Goals in Life<ChevronRight size={15} aria-hidden="true" /></button></footer>
  </section>;
}
