import type { Goal, Task } from '../types';
import { sortTasksBySchedule } from '../services/domainUtils';
type Props = { tasks: Task[]; goals: Goal[]; today: string; onNavigate: (tab: 'planner' | 'goals' | 'habits') => void; onCreateTask: () => void };

export default function PlanHub({ tasks, goals, today, onNavigate, onCreateTask }: Props) {
  const openTasks = sortTasksBySchedule(tasks.filter(task => !task.completed)).slice(0, 4);
  const activeGoals = goals.filter(goal => goal.status === 'In Progress').slice(0, 3);
  return <section aria-labelledby="plan-title" className="plan-hub">
    <header className="plan-hub-heading"><p className="type-eyebrow">MAKE ROOM FOR WHAT MATTERS</p><h2 id="plan-title" className="type-page-title">Plan</h2><p className="type-body text-secondary">A clear next step, with enough space to change course.</p></header>
    <section aria-labelledby="plan-tasks-title" className="plan-hub-section">
      <div className="plan-hub-section-heading"><div><h3 id="plan-tasks-title" className="type-section-title">Tasks</h3><p className="type-caption text-secondary">{openTasks.length ? 'Your next open tasks' : 'No open tasks'}</p></div><button onClick={() => onNavigate('planner')} className="plan-hub-link">Open planner</button></div>
      {openTasks.length > 0 && <ul className="plan-hub-list">{openTasks.map(task => <li key={task.id} className="plan-hub-row"><span className="plan-hub-row-title type-body">{task.title}</span><span className="plan-hub-row-meta type-caption">{task.dueDate || 'No date'}{task.dueDate === today ? ' · Today' : ''}{task.dueTime ? ` · ${task.dueTime}` : task.dueDate ? ' · end of day' : ''}</span></li>)}</ul>}
      <button onClick={onCreateTask} className="lifeos-accent-button plan-hub-create type-button">Add a task</button>
    </section>
    <section aria-labelledby="plan-goals-title" className="plan-hub-section">
      <div className="plan-hub-section-heading"><div><h3 id="plan-goals-title" className="type-section-title">Goals</h3><p className="type-caption text-secondary">{activeGoals.length ? 'Keep a meaningful milestone in view' : 'Start with one outcome you care about'}</p></div><button onClick={() => onNavigate('goals')} className="plan-hub-link">View goals</button></div>
      {activeGoals.length > 0 && <ul className="plan-hub-list">{activeGoals.map(goal => <li key={goal.id} className="plan-hub-row"><span className="plan-hub-row-title type-body">{goal.title}</span><span className="plan-hub-row-meta type-caption">{goal.targetDate}</span></li>)}</ul>}
    </section>
    <button onClick={() => onNavigate('habits')} className="plan-hub-routines type-body">Review routines <span aria-hidden="true">→</span></button>
  </section>;
}
