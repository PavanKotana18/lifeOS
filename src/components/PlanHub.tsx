import type { Goal, Task } from '../types';
import { sortTasksBySchedule } from '../services/domainUtils';
type Props = { tasks: Task[]; goals: Goal[]; today: string; onNavigate: (tab: 'planner' | 'goals' | 'habits') => void; onCreateTask: () => void };

export default function PlanHub({ tasks, goals, today, onNavigate, onCreateTask }: Props) {
  const openTasks = sortTasksBySchedule(tasks.filter(task => !task.completed)).slice(0, 4);
  const activeGoals = goals.filter(goal => goal.status === 'In Progress').slice(0, 3);
  return <section aria-labelledby="plan-title" className="space-y-4">
    <header><p className="text-sm text-secondary">A clear next step</p><h2 id="plan-title" className="text-xl font-semibold">Plan</h2></header>
    <section className="lifeos-panel rounded-2xl border p-4" aria-labelledby="plan-tasks-title">
      <div className="flex items-center justify-between gap-2"><div><h3 id="plan-tasks-title" className="font-semibold">Tasks</h3><p className="text-xs text-secondary">{openTasks.length ? 'Your next open tasks' : 'No open tasks'}</p></div><button onClick={() => onNavigate('planner')} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">Open planner</button></div>
      {openTasks.length > 0 && <ul className="mt-3 divide-y divide-[var(--stroke)]">{openTasks.map(task => <li key={task.id} className="flex justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate">{task.title}</span><span className="shrink-0 text-xs text-secondary">{task.dueDate || 'No date'}{task.dueDate === today ? ' · Today' : ''}{task.dueTime ? ` · ${task.dueTime}` : task.dueDate ? ' · end of day' : ''}</span></li>)}</ul>}
      <button onClick={onCreateTask} className="lifeos-accent-button mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-semibold">Add a task</button>
    </section>
    <section className="lifeos-panel rounded-2xl border p-4" aria-labelledby="plan-goals-title">
      <div className="flex items-center justify-between gap-2"><div><h3 id="plan-goals-title" className="font-semibold">Goals</h3><p className="text-xs text-secondary">{activeGoals.length ? 'Keep a meaningful milestone in view' : 'Start with one outcome you care about'}</p></div><button onClick={() => onNavigate('goals')} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--accent)]">View goals</button></div>
      {activeGoals.length > 0 && <ul className="mt-3 space-y-2">{activeGoals.map(goal => <li key={goal.id} className="flex justify-between gap-3 text-sm"><span className="truncate">{goal.title}</span><span className="shrink-0 text-xs text-secondary">{goal.targetDate}</span></li>)}</ul>}
    </section>
    <button onClick={() => onNavigate('habits')} className="lifeos-panel min-h-12 w-full rounded-xl border px-4 text-left text-sm font-medium">Review routines <span className="float-right text-secondary">→</span></button>
  </section>;
}
