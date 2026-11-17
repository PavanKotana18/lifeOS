import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type Props = { onAdd: (title: string) => Promise<void>; label?: string };

/** A protected write is provided by the caller; this form owns only a draft. */
export default function QuickTaskEntry({ onAdd, label = 'Quick task' }: Props) {
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
      await onAdd(nextTitle);
      setTitle('');
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
    <p id={hintId} className="mt-2 text-xs text-secondary">Save without a date. You can schedule it later.</p>
    {error && <p id={errorId} role="alert" className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
  </form>;
}
