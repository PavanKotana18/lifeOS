import React, { useLayoutEffect, useRef } from 'react';
import { useIsPresent } from 'motion/react';
import * as m from 'motion/react-m';
import type { Task, TaskSubtask } from '../types';
import TaskSubtasks from './TaskSubtasks';

type Props = {
  task: Task;
  reducedMotion: boolean;
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

export default function TaskDetailScreen({ task, reducedMotion, status, dueLabel, reminderLabel, reminderContent, onBack, onEdit, onToggle, onDelete, onSubtasks }: Props) {
  const screenRef = useRef<HTMLElement | null>(null);
  const present = useIsPresent();
  useLayoutEffect(() => {
    if (present) screenRef.current?.focus({ preventScroll: true });
  }, [present]);
  return <m.section ref={element => {
    screenRef.current = element;
    element?.toggleAttribute('inert', !present);
  }} tabIndex={-1} role="dialog" aria-modal={present || undefined} aria-hidden={!present || undefined}
    data-record-background data-exiting={!present}
    initial={reducedMotion ? false : { transform: 'translate3d(100%, 0, 0)' }}
    animate={{ transform: 'none' }}
    exit={reducedMotion ? undefined : { transform: 'translate3d(100%, 0, 0)', transition: { duration: .25, ease: [.32, 0, .67, 1] } }}
    transition={{ type: 'spring', duration: .31, bounce: .02 }} aria-labelledby="task-detail-title" className="task-detail-screen lifeos-panel">
    <header className="task-detail-header"><button type="button" onClick={onBack} className="min-h-11 rounded-xl px-3 text-sm font-semibold lifeos-accent-text">← Back to tasks</button><h2 id="task-detail-title" className="type-page-title break-words">{task.title}</h2></header>
    {(task.description || task.notes) && <section className="task-detail-section"><h3 className="type-caption text-secondary">Description</h3><p className="mt-1 whitespace-pre-wrap text-sm">{task.description || task.notes}</p></section>}
    <dl className="task-detail-meta"><div><dt>Due</dt><dd>{dueLabel}</dd></div><div><dt>Status</dt><dd className={status === 'Overdue' ? 'text-[var(--danger)]' : status === 'Completed' ? 'text-[var(--success)]' : 'lifeos-accent-text'}>{status}</dd></div><div><dt>Priority</dt><dd>{task.priority}</dd></div><div><dt>Reminder</dt><dd>{reminderLabel}</dd></div>{task.recurring && task.recurring !== 'None' && <div><dt>Repeats</dt><dd>{task.recurring}</dd></div>}{task.category && <div><dt>Category</dt><dd>{task.category}</dd></div>}</dl>
    <TaskSubtasks subtasks={task.subtasks} onChange={onSubtasks} />
    {reminderContent}
    {onDelete && <button type="button" className="lifeos-danger min-h-11 rounded-xl px-3 text-sm" onClick={onDelete}>Delete task</button>}
    <footer className="task-detail-actions"><button type="button" onClick={onEdit} className="min-h-11 flex-1 rounded-xl border border-[var(--stroke)] text-sm font-semibold lifeos-accent-text">Edit task</button><button type="button" onClick={onToggle} className="min-h-11 flex-1 rounded-xl lifeos-accent-button text-sm font-semibold">{task.completed ? 'Reopen task' : 'Complete task'}</button></footer>
  </m.section>;
}
