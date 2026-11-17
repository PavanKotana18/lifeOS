import React, { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { TaskSubtask } from '../types';
import { getSubtaskProgress } from '../services/taskViews';

type Props = { subtasks?: TaskSubtask[]; onChange: (subtasks: TaskSubtask[]) => void };

export default function TaskSubtasks({ subtasks = [], onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const progress = getSubtaskProgress(subtasks);
  const save = (next: TaskSubtask[]) => onChange(next);
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    const now = new Date().toISOString();
    save([...subtasks, { id: globalThis.crypto.randomUUID(), title, completed: false, createdAt: now }]);
    setDraft('');
  };
  const commitEdit = (id: string) => {
    const title = editTitle.trim();
    if (!title) return;
    save(subtasks.map(item => item.id === id ? { ...item, title, updatedAt: new Date().toISOString() } : item));
    setEditingId(null);
    setEditTitle('');
  };

  return <section className="task-subtasks" aria-labelledby="task-subtasks-title">
    <div className="flex items-center justify-between gap-3"><h3 id="task-subtasks-title" className="text-sm font-semibold">Subtasks</h3>{progress.total > 0 && <span className="text-xs text-secondary">{progress.completed} of {progress.total} complete</span>}</div>
    {progress.total > 0 && <div className="task-subtask-progress" role="progressbar" aria-label="Subtask completion" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}><span style={{ width: `${progress.percent}%` }} /></div>}
    {subtasks.length > 0 && <ul className="mt-2 divide-y divide-[var(--stroke)]" aria-label="Subtasks">{subtasks.map(item => <li key={item.id} className="flex min-h-12 items-center gap-2 py-1">
      <input type="checkbox" checked={item.completed} onChange={() => save(subtasks.map(current => current.id === item.id ? { ...current, completed: !current.completed, updatedAt: new Date().toISOString() } : current))} aria-label={`${item.completed ? 'Reopen' : 'Complete'} subtask ${item.title}`} />
      {editingId === item.id ? <><input autoFocus value={editTitle} onChange={event => setEditTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') commitEdit(item.id); if (event.key === 'Escape') setEditingId(null); }} aria-label="Edit subtask title" className="lifeos-input min-h-10 min-w-0 flex-1 rounded-lg px-2 text-sm" /><button type="button" onClick={() => commitEdit(item.id)} aria-label="Save subtask" className="min-h-10 min-w-10 rounded-lg lifeos-accent-text"><Check size={17} /></button><button type="button" onClick={() => setEditingId(null)} aria-label="Cancel subtask edit" className="min-h-10 min-w-10 rounded-lg text-secondary"><X size={17} /></button></> : <><span className={`min-w-0 flex-1 break-words text-sm ${item.completed ? 'text-secondary line-through' : ''}`}>{item.title}</span><button type="button" onClick={() => { setEditingId(item.id); setEditTitle(item.title); }} aria-label={`Edit subtask ${item.title}`} className="min-h-10 min-w-10 rounded-lg text-secondary"><Pencil size={15} /></button><button type="button" onClick={() => save(subtasks.filter(current => current.id !== item.id))} aria-label={`Delete subtask ${item.title}`} className="min-h-10 min-w-10 rounded-lg text-secondary"><Trash2 size={15} /></button></>}
    </li>)}</ul>}
    <form className="mt-2 flex gap-2" onSubmit={event => { event.preventDefault(); add(); }}><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={160} aria-label="New subtask" placeholder="Add a step" className="lifeos-input min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm" /><button type="submit" disabled={!draft.trim()} className="lifeos-panel flex min-h-11 items-center gap-1 rounded-xl border px-3 text-xs font-semibold lifeos-accent-text disabled:opacity-50"><Plus size={15} />Add</button></form>
  </section>;
}
