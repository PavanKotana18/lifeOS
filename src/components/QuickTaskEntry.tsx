import InfoTip from './InfoTip';
import { PreferenceChoice } from './PreferenceChoice';
import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Task } from '../types';

export type QuickTaskDetails = { dueDate?: string; dueTime?: string; reminderAt?: string; priority?: Task['priority'] };
type Props = { onAdd: (title: string, details?: QuickTaskDetails) => Promise<void>; label?: string };

/** A protected write is provided by the caller; this form owns only a draft. */
export default function QuickTaskEntry({ onAdd, label = 'Quick task' }: Props) {
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('Medium');
  const operation = useRef(false);

  const submitQuickTask = async (event: FormEvent) => {
    event.preventDefault();
    if (operation.current) return;
    const nextTitle = title.trim();
    if (!nextTitle) { setError('Enter a task title.'); return; }
    if (nextTitle.length > 200) { setError('Keep the task title to 200 characters or fewer.'); return; }
    operation.current = true;
    setSaving(true);
    setError('');
    try {
      if (!dueDate && (dueTime || reminderAt)) throw new Error('Add a due date before choosing a time or reminder.');
      await onAdd(nextTitle, { dueDate: dueDate || undefined, dueTime: dueTime || undefined, reminderAt: reminderAt || undefined, priority });
      setTitle('');
      setDueDate(''); setDueTime(''); setReminderAt(''); setPriority('Medium');
    } catch (cause) {
      setError(cause instanceof Error && cause.message.trim() ? cause.message : 'Task could not be saved. Your draft is still here.');
    } finally {
      operation.current = false;
      setSaving(false);
    }
  };

  return <form onSubmit={submitQuickTask} aria-label={`${label} creation`} aria-busy={saving} className="lifeos-panel rounded-2xl border p-4">
    <label htmlFor={fieldId} className="block text-sm font-semibold">{label}</label>
    <div className="mt-2 flex items-start gap-2">
      <input id={fieldId} required maxLength={200} value={title} disabled={saving}
        onChange={event => setTitle(event.target.value)} aria-invalid={error ? true : undefined}
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`} placeholder="What would you like to do?"
        className="lifeos-input min-h-11 min-w-0 flex-1 rounded-xl px-3 py-2 text-sm disabled:opacity-60" />
      <button type="submit" disabled={saving || !title.trim()} className="lifeos-accent-button min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">{saving ? 'Adding...' : 'Add task'}</button>
    </div>
    <p id={hintId} className="mt-2 text-xs text-secondary">Add a date when you are ready to schedule it.</p>
    <details className="mt-2 rounded-xl border border-[var(--stroke)] px-3"><summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-secondary">Schedule, priority and reminder</summary><div className="grid grid-cols-2 gap-2 pb-3">
      <label className="text-xs text-secondary">Due date<input type="date" value={dueDate} onChange={event => { setDueDate(event.target.value); if (!event.target.value) { setDueTime(''); setReminderAt(''); } }} className="lifeos-input mt-1 min-h-11 w-full rounded-lg px-2 text-sm" /></label>
      <label className="text-xs text-secondary">Time<input type="time" disabled={!dueDate} value={dueTime} onChange={event => setDueTime(event.target.value)} className="lifeos-input mt-1 min-h-11 w-full rounded-lg px-2 text-sm disabled:opacity-50" /></label>
      <div className="text-xs text-secondary"><PreferenceChoice variant="field" label="Priority" value={priority}
                options={[...(['Low', 'Medium', 'High', 'Urgent'].map(item => [String(item), item] as const))]} onSelect={event => setPriority(event as Task['priority'])} /></div>
      <label className="col-span-2 text-xs text-secondary">Reminder<input type="datetime-local" disabled={!dueDate} value={reminderAt} onChange={event => setReminderAt(event.target.value)} className="lifeos-input mt-1 min-h-11 w-full rounded-lg px-2 text-sm disabled:opacity-50" /></label><div className="flex items-center gap-2 text-xs text-secondary">Task reminders <InfoTip label="Task reminders" /></div>
    </div></details>
    {error && <p id={errorId} role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
  </form>;
}
