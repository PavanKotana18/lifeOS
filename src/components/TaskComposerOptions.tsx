import { formatLocalDate, parseLocalDateTime, taskDateOnlyAlert } from '../services/domainUtils';
import type { Goal } from '../types';
import InfoTip from './InfoTip';
import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import { Bell, CalendarDays, Flag, CalendarClock } from 'lucide-react';
import { AliveDisclosure, AliveReveal } from './AliveDisclosure';
import { PreferenceChoice } from './PreferenceChoice';

type Draft = Record<string, string>;
type Panel = 'schedule' | 'reminder';
const titleForRepeat: Record<string, string> = { None: 'Does not repeat', Daily: 'Daily', Weekly: 'Weekly', Monthly: 'Monthly' };
const priorityChoices = ['Low', 'Medium', 'High', 'Urgent'].map(value => [value, value] as const);
const repeatChoices = Object.entries(titleForRepeat);
const reminderChoices = [
  ['', 'No extra reminder'], ['5', '5 minutes before'], ['10', '10 minutes before'], ['15', '15 minutes before'],
  ['30', '30 minutes before'], ['60', '1 hour before'], ['1440', '1 day before'], ['custom', 'Custom lead time'],
] as const;
const field = 'lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm';

export default function TaskComposerOptions({ draft, update, dateOnlyAlertTime, alertsEnabled = true, goals = [], editing, dirty }: {
  draft: Draft;
  update: Dispatch<SetStateAction<Draft>>;
  dateOnlyAlertTime: string;
  alertsEnabled?: boolean;
  goals?: Goal[];
  editing: boolean;
  dirty: () => void;
}) {
  const [panel, setPanel] = useState<Panel | null>('schedule');
  const id = useId();
  const [timeHint, setTimeHint] = useState('');
  const now = new Date();
  const preview = draft.date ? draft.time ? parseLocalDateTime(draft.date, draft.time)
    : taskDateOnlyAlert(draft.date, dateOnlyAlertTime, editing ? undefined : now.toISOString()) : null;
  const reminderPreview = !alertsEnabled || draft.dueAlert === 'off' || (!draft.time && !dateOnlyAlertTime)
    ? 'Due-date alerts are off.' : !draft.date ? 'Choose a date to preview the reminder.'
      : !preview || preview <= now ? 'No upcoming due-date alert.'
        : !draft.time && +preview === +now + 60_000 ? 'Reminder: shortly after saving.'
          : 'Reminder: ' + preview.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  const set = (key: string, value: string) => update(current => ({ ...current, [key]: value }));
  const choose = (key: string, value: string) => { dirty(); set(key, value); };
  const toggle = (value: Panel) => setPanel(current => current === value ? null : value);
  const reminderEnabled = Boolean(draft.date && (draft.time || dateOnlyAlertTime || draft.reminderAt));
  const savedLead = draft.reminderLead || '';
  const lead = reminderChoices.some(option => option[0] === savedLead) || savedLead === 'legacy' ? savedLead : 'custom';
  const reminderOptions = draft.reminderAt ? [...reminderChoices, ['legacy', 'Keep saved reminder'] as const] : reminderChoices;
  const repeat = draft.recurring || 'None';

  return <div className="task-composer-options" onInvalidCapture={event => {
    if (event.target instanceof HTMLElement && event.target.id === id + '-custom-reminder') setPanel('reminder');
  }}>
    <div className="task-quick-actions" aria-label="Task options" role="group">
      <button type="button" className="task-option" aria-expanded={panel === 'schedule'} aria-controls={id + '-schedule'} onClick={() => toggle('schedule')}>
        <CalendarDays size={18} aria-hidden="true" />
        <span><strong>Schedule</strong><small>{draft.date || 'No date'}</small></span>
      </button>
      <button type="button" className="task-option" aria-expanded={panel === 'reminder'} aria-controls={id + '-reminder'} onClick={() => toggle('reminder')}>
        <Bell size={18} aria-hidden="true" />
        <span><strong>Reminder</strong><small>{lead ? 'Extra alert' : draft.dueAlert === 'off' ? 'Off' : 'Due-time options'}</small></span>
      </button>
      <PreferenceChoice label="Priority" value={draft.priority || 'Medium'} options={priorityChoices}
        onSelect={priority => choose('priority', priority)} icon={<Flag size={18} aria-hidden="true" />} />
      <PreferenceChoice label="Repeat" value={repeat} options={repeatChoices} onSelect={value => choose('recurring', value)}
        icon={<CalendarClock size={18} aria-hidden="true" />} disabled={!draft.date} disabledHint="Set a date first" />
    </div>
    <AliveReveal id={id + '-schedule'} open={panel === 'schedule'}>
      <div className="task-option-panel grid grid-cols-2 gap-3">
        <label className="text-xs text-secondary">Due date
          <input type="date" min={!editing ? formatLocalDate(now) : undefined} required={!editing} value={draft.date || ''} onChange={event => {
            const date = event.target.value;
            const invalidTime = Boolean(date && draft.time && (parseLocalDateTime(date, draft.time) ?? new Date(0)) <= new Date());
            setTimeHint(invalidTime ? 'The previous time has passed on this date. Choose another time.' : '');
            update(current => ({ ...current, date, ...(invalidTime ? { time: '' } : {}),
              ...(!date ? { time: '', reminderAt: '', reminderLead: '', recurring: 'None' } : {}) }));
          }} className={field} />
        </label>
        <label className="text-xs text-secondary">Time (optional)
          <input disabled={!draft.date} type="time" value={draft.time || ''} onChange={event => { setTimeHint(''); set('time', event.target.value); }} className={field} />
        </label>
        <p className="col-span-2 text-xs text-secondary" aria-live="polite">{timeHint || reminderPreview}</p>
      </div>
    </AliveReveal>
    <AliveReveal id={id + '-reminder'} open={panel === 'reminder'}>
      <div className="task-option-panel space-y-2">
        <div className="flex items-center gap-2 text-xs text-secondary">Task reminders <InfoTip label="Task reminders" /></div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" disabled={!draft.date || !(draft.time || dateOnlyAlertTime)} checked={draft.dueAlert !== 'off'}
            onChange={event => set('dueAlert', event.target.checked ? 'on' : 'off')} /> Alert at due time
        </label>
        <PreferenceChoice variant="field" label="Extra reminder" options={reminderOptions} value={lead}
          disabled={!reminderEnabled} disabledHint="Set a date and time first" onSelect={value => choose('reminderLead', value)} />
        {lead === 'custom' && <label className="block text-sm">Minutes before
          <input id={id + '-custom-reminder'} disabled={!reminderEnabled} type="number" min="1" max="10080" required
            value={draft.reminderCustom || (savedLead === 'custom' ? '' : savedLead)}
            onChange={event => {
              const reminderCustom = event.target.value;
              update(current => ({ ...current, reminderLead: 'custom', reminderCustom }));
            }} className={field} />
        </label>}
      </div>
    </AliveReveal>
    <AliveDisclosure label={editing ? "Task notes" : "Notes and subtasks"} defaultOpen={editing && Boolean(draft.description)}>
      <div className="task-option-panel space-y-3">
        <label className="block text-xs text-secondary">Description (optional)
          <textarea rows={2} maxLength={500} value={draft.description || ''} onChange={event => set('description', event.target.value)} className={field} />
        </label>
        {!editing && <label className="block text-xs text-secondary">Subtasks (one per line)
          <textarea rows={3} value={draft.subtasks || ''} onChange={event => set('subtasks', event.target.value)} className={field} />
        </label>}
      </div>
    </AliveDisclosure>
    <AliveDisclosure label={goals.length ? "Category and related goal" : "Task category"} defaultOpen={editing && Boolean(draft.category)}>
      <div className="task-option-panel space-y-3">
        {goals.length > 0 && <PreferenceChoice variant="field" searchable={goals.length > 8} label="Linked goal" value={draft.goalId || ''}
          options={[[ '', 'No linked goal' ], ...goals.map(goal => [goal.id, goal.title] as const)]} onSelect={value => choose('goalId', value)} />}
        <label className="block text-xs text-secondary">Category (optional)
          <input maxLength={50} value={draft.category || ''} onChange={event => set('category', event.target.value)} className={field} />
        </label>
      </div>
    </AliveDisclosure>
  </div>;
}
