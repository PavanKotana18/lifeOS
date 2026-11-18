import React, { useEffect, useRef } from 'react';
import type { Task, TaskSubtask } from '../types';
import TaskSubtasks from './TaskSubtasks';

type Props = {
  task: Task;
  status: string;
  dueLabel: string;
  reminderLabel: string;
  reminderContent?: React.ReactNode;
  onBack: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete?: () => void;
  onSubtasks: (subtasks: TaskSubtask[]) => void;
};

export default function TaskDetailScreen({ task, status, dueLabel, reminderLabel, reminderContent, onBack, onEdit, onToggle, onDelete, onSubtasks }: Props) {
  const screenRef = useRef<HTMLElement>(null);
  useEffect(() => { screenRef.current?.focus(); }, []);
  return <section ref={screenRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="task-detail-title" className="task-detail-screen lifeos-panel">
    <header className="task-detail-header"><button type="button" onClick={onBack} className="min-h-11 rounded-xl px-3 text-sm font-semibold lifeos-accent-text">← Back to tasks</button><p className="type-eyebrow">TASK DETAILS</p><h2 id="task-detail-title" className="type-page-title break-words">{task.title}</h2></header>
    {task.description && <section className="task-detail-section"><h3 className="type-caption text-secondary">Description</h3><p className="mt-1 whitespace-pre-wrap text-sm">{task.description}</p></section>}
    <dl className="task-detail-meta"><div><dt>Due</dt><dd>{dueLabel}</dd></div><div><dt>Status</dt><dd className={status === 'Overdue' ? 'text-[var(--danger)]' : status === 'Completed' ? 'text-[var(--success)]' : 'lifeos-accent-text'}>{status}</dd></div><div><dt>Priority</dt><dd>{task.priority}</dd></div><div><dt>Reminder</dt><dd>{reminderLabel}</dd></div>{task.recurring && task.recurring !== 'None' && <div><dt>Repeats</dt><dd>{task.recurring}</dd></div>}{task.category && <div><dt>Category</dt><dd>{task.category}</dd></div>}</dl>
    <TaskSubtasks subtasks={task.subtasks} onChange={onSubtasks} />
    {reminderContent}
    {onDelete && <button type="button" className="lifeos-danger min-h-11 rounded-xl px-3 text-sm" onClick={onDelete}>Delete task</button>}
    <footer className="task-detail-actions"><button type="button" onClick={onEdit} className="min-h-11 flex-1 rounded-xl border border-[var(--stroke)] text-sm font-semibold lifeos-accent-text">Edit task</button><button type="button" onClick={onToggle} className="min-h-11 flex-1 rounded-xl lifeos-accent-button text-sm font-semibold">{task.completed ? 'Reopen task' : 'Complete task'}</button></footer>
  </section>;
}
