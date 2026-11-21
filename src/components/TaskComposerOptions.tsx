import InfoTip from './InfoTip';
import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import { Bell, CalendarDays, Flag, Repeat2 } from 'lucide-react';
import { AliveDisclosure, AliveReveal } from './AliveDisclosure';
import { PreferenceChoice } from './ProfilePreferences';
import type { Goal } from '../types';

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

export default function TaskComposerOptions({ draft, update, dateOnlyAlertTime, goals, editing, dirty }: {
  draft: Draft;
  update: Dispatch<SetStateAction<Draft>>;
  dateOnlyAlertTime: string;
  goals: Goal[];
  editing: boolean;
  dirty: () => void;
}) {
  const [panel, setPanel] = useState<Panel | null>(draft.date ? 'schedule' : null);
  const id = useId();
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
        icon={<Repeat2 size={18} aria-hidden="true" />} disabled={!draft.date} disabledHint="Set a date first" />
    </div>
    <AliveReveal id={id + '-schedule'} open={panel === 'schedule'}>
      <div className="task-option-panel grid grid-cols-2 gap-3">
        <label className="text-xs text-secondary">Due date
          <input type="date" value={draft.date || ''} onChange={event => {
            const date = event.target.value;
            update(current => ({ ...current, date, ...(!date ? { time: '', reminderAt: '', reminderLead: '', recurring: 'None' } : {}) }));
          }} className={field} />
        </label>
        <label className="text-xs text-secondary">Time
          <input disabled={!draft.date} type="time" value={draft.time || ''} onChange={event => set('time', event.target.value)} className={field} />
        </label>
      </div>
    </AliveReveal>
    <AliveReveal id={id + '-reminder'} open={panel === 'reminder'}>
      <div className="task-option-panel space-y-2">
        <div className="flex items-center gap-2 text-xs text-secondary">Task reminders <InfoTip label="Task reminders" /></div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" disabled={!draft.date || !(draft.time || dateOnlyAlertTime)} checked={draft.dueAlert !== 'off'}
            onChange={event => set('dueAlert', event.target.checked ? 'on' : 'off')} /> Alert at due time
        </label>
        <PreferenceChoice label="Extra reminder" options={reminderOptions} value={lead}
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
    <AliveDisclosure label={editing ? "Task notes" : "Notes and subtasks"}>
      <div className="task-option-panel space-y-3">
        <label className="block text-xs text-secondary">Notes
          <textarea rows={2} maxLength={500} value={draft.description || ''} onChange={event => set('description', event.target.value)} className={field} />
        </label>

        {!editing && <label className="block text-xs text-secondary">Subtasks (one per line)
          <textarea rows={3} value={draft.subtasks || ''} onChange={event => set('subtasks', event.target.value)} className={field} />
        </label>}
      </div>
    </AliveDisclosure>
    <AliveDisclosure label={goals.length ? "Category and related goal" : "Task category"}>
      <div className="task-option-panel space-y-3">
        <label className="block text-xs text-secondary">Category (optional)
          <input maxLength={50} value={draft.category || ''} onChange={event => set('category', event.target.value)} className={field} />
        </label>
        {goals.length > 0 && <PreferenceChoice label="Linked goal" searchable={goals.length > 8} value={draft.goalId || ''}
          options={[[ '', 'No linked goal' ], ...goals.map(goal => [goal.id, goal.title] as const)]} onSelect={value => choose('goalId', value)} />}
      </div>
    </AliveDisclosure>
  </div>;
}
