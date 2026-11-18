import { useRef, useState } from 'react';
import { Bell, ChevronRight, CircleCheck, Plus, Repeat2, SlidersHorizontal } from 'lucide-react';
import type { Task } from '../types';
import { getTaskStatus, sortTasksBySchedule } from '../services/domainUtils';


export type PlanView = 'today' | 'upcoming' | 'all' | 'unscheduled';
export type PlanStatus = 'all' | 'open' | 'completed' | 'overdue';
type Props = {
  tasks: Task[]; today: string; now: Date;
  onOpenTask: (task: Task, trigger: HTMLButtonElement) => void;
  onToggleTask: (task: Task) => void;
  onCreate: () => void;
};

export const emptyPlanFilters = { priority: '', category: '', from: '', through: '', reminder: '', recurrence: '' };
export type PlanFilters = typeof emptyPlanFilters;
const advancedFilterCount = (filters: PlanFilters) => Object.values(filters).filter(Boolean).length;

export function taskMatchesFilters(task: Task, filters: PlanFilters) {
  const hasReminder = Boolean(task.reminderAt || task.reminderLeadMinutes || (task.dueDate && task.dueTime && !task.dueAlertDisabled));
  const repeating = task.recurring !== 'None';
  return (!filters.priority || task.priority === filters.priority) &&
    (!filters.category || task.category === filters.category) &&
    (!filters.from || Boolean(task.dueDate && task.dueDate >= filters.from)) &&
    (!filters.through || Boolean(task.dueDate && task.dueDate <= filters.through)) &&
    (!filters.reminder || hasReminder === (filters.reminder === 'yes')) &&
    (!filters.recurrence || repeating === (filters.recurrence === 'yes'));
}

export function selectPlanTasks(tasks: Task[], today: string, now: Date, view: PlanView, query: string, status: PlanStatus, filters: PlanFilters = emptyPlanFilters): Task[] {
  const needle = query.trim().toLocaleLowerCase();
  return sortTasksBySchedule(tasks.filter(task => {
    if (view === 'today' && task.dueDate !== today) return false;
    if (view === 'upcoming' && (!task.dueDate || task.dueDate <= today)) return false;
    if (view === 'unscheduled' && task.dueDate) return false;
    if (status === 'open' && task.completed) return false;
    if (status === 'completed' && !task.completed) return false;
    if (status === 'overdue' && getTaskStatus(task, now) !== 'Overdue') return false;
    return taskMatchesFilters(task, filters) && (!needle || [task.title, task.description, task.notes, task.category].some(value => value?.toLocaleLowerCase().includes(needle)));
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

export default function PlanHub({ tasks, today, now, onOpenTask, onToggleTask, onCreate }: Props) {
  const [view, setView] = useState<PlanView>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PlanStatus>('all');
  const dialog = useRef<HTMLDialogElement>(null);
  const [filters, setFilters] = useState(emptyPlanFilters);
  const [draft, setDraft] = useState({ ...emptyPlanFilters, status: 'all' as PlanStatus });
  const count = advancedFilterCount(filters) + Number(status !== 'all');
  const categories = [...new Set(tasks.map(task => task.category).filter(Boolean))].sort();
  const visible = selectPlanTasks(tasks, today, now, view, query, status, filters);
  const views: { id: PlanView; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'today', label: 'Today' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'unscheduled', label: 'Unscheduled' }];
  const narrowed = Boolean(query.trim()) || count > 0 || view !== 'all';
  return <section aria-labelledby="plan-title" className="plan-hub plan-workspace">
    <header className="plan-workspace-heading flex items-center justify-between gap-3">
      <h2 id="plan-title" className="type-section-title">Tasks</h2>
      <button type="button" className="lifeos-accent-button min-h-11 rounded-xl px-3 text-sm font-semibold inline-flex items-center gap-2" onClick={onCreate}><Plus size={16} aria-hidden="true" />Create Task</button>
    </header>
    <div className="plan-view-controls" data-no-tab-swipe>
      <div className="plan-view-switch" role="group" aria-label="Task views">{views.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}<span>{selectPlanTasks(tasks, today, now, item.id, query, status, filters).length}</span></button>)}</div>
      <div className="plan-toolbar">
        <input type="search" aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={event => setQuery(event.target.value)} className="lifeos-input" />
        <button type="button" className="lifeos-input" aria-haspopup="dialog" onClick={() => { setDraft({ ...filters, status }); dialog.current?.showModal(); }}><SlidersHorizontal size={16} aria-hidden="true" />Filters{count ? ' (' + count + ')' : ''}</button>
      </div>
      <dialog className="plan-filter-sheet lifeos-page" ref={dialog} data-plan-filters aria-label="Task filters" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <form onSubmit={event => {
          event.preventDefault();
          const { status: next, ...rest } = draft;
          setStatus(next); setFilters(rest); dialog.current?.close();
        }}>
          <header className="flex items-center justify-between"><h3 className="text-lg font-semibold">Filters</h3><button type="button" className="min-h-11 px-2" onClick={() => dialog.current?.close()}>Close</button></header>
          <div className="plan-filter-fields">
            <label>Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as PlanStatus })}><option value="all">All statuses</option><option value="open">Pending</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select></label>
            <label>Priority<select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })}><option value="">Any priority</option>{['Low','Medium','High','Urgent'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>From<input type="date" value={draft.from} max={draft.through || undefined} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
            <label>Through<input type="date" value={draft.through} min={draft.from || undefined} onChange={event => setDraft({ ...draft, through: event.target.value })} /></label>
            <label>Category<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Reminder<select value={draft.reminder} onChange={event => setDraft({ ...draft, reminder: event.target.value })}><option value="">Any</option><option value="yes">Has alert</option><option value="no">No alert</option></select></label>
            <label>Repeat<select value={draft.recurrence} onChange={event => setDraft({ ...draft, recurrence: event.target.value })}><option value="">Any</option><option value="yes">Repeating</option><option value="no">One-time</option></select></label>
          </div>
          <footer className="grid grid-cols-2 gap-2"><button type="button" className="lifeos-input min-h-11 rounded-xl" onClick={() => setDraft({ ...emptyPlanFilters, status: 'all' })}>Clear filters</button><button type="submit" className="lifeos-accent-button min-h-11 rounded-xl">Apply filters</button></footer>
        </form>
      </dialog>
    </div>
    <section className="plan-task-workspace" aria-labelledby="plan-tasks-title">
      <div className="plan-list-heading"><h3 id="plan-tasks-title">{views.find(item => item.id === view)?.label} tasks</h3><span role="status" className="type-caption text-secondary">{visible.length} shown</span></div>
      {visible.length ? <ul className="plan-hub-list" aria-label="Tasks in selected view">{visible.map(task => {
        const taskStatus = getTaskStatus(task, now);
        return <li key={task.id} className={`plan-hub-task ui-interactive-row${taskStatus === 'Overdue' ? ' is-overdue' : ''}${task.completed ? ' is-complete' : ''}`}>
          <label className="plan-hub-task-check"><input type="checkbox" checked={task.completed} onChange={() => onToggleTask(task)} aria-label={`Mark ${task.title} ${task.completed ? 'incomplete' : 'complete'}`} /></label>
          <button type="button" onClick={event => onOpenTask(task, event.currentTarget)} className="plan-hub-task-open"><span className="plan-hub-row-title">{task.title}</span><span className="plan-hub-row-meta">{taskStatus === 'Overdue' ? 'Overdue \u00b7 ' : task.completed ? 'Completed \u00b7 ' : ''}{formatTaskDate(task.dueDate, today)}{task.dueTime ? ` \u00b7 ${task.dueTime}` : task.dueDate ? ' \u00b7 end of day' : ''}<span className="plan-schedule-indicators">{task.recurring && task.recurring !== 'None' && <span><Repeat2 size={12} aria-hidden="true" />Repeats {task.recurring.toLocaleLowerCase()}</span>}{(task.reminderAt || task.reminderLeadMinutes) && <span><Bell size={12} aria-hidden="true" />Reminder set</span>}</span></span><ChevronRight size={17} aria-hidden="true" /></button>
        </li>;
      })}</ul> : <div className="plan-hub-empty"><CircleCheck size={21} aria-hidden="true" /><div><strong>{!tasks.length ? 'No tasks yet' : narrowed ? 'No tasks match this view' : 'You are all caught up'}</strong><span>{!tasks.length ? 'Start with one thing you want to remember.' : narrowed ? 'Try another view or status, or clear your search.' : 'Your completed tasks are available under All statuses.'}</span>{narrowed && tasks.length > 0 && <button type="button" onClick={() => { setView('all'); setStatus('all'); setFilters(emptyPlanFilters); setQuery(''); }}>Show every task</button>}</div></div>}
    </section>
  </section>;
}
