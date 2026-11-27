import { useId } from 'react';
import type { NotificationPreferences } from '../types';
import { NOTIFICATION_TONES, reminderCopy, type NotificationTone } from '../services/notificationCopy';
import type { InboxPreferences } from '../services/notificationInboxProducers';
import type { NotificationDiagnostics } from '../services/notificationService';
import { PreferenceChoice } from './ProfilePreferences';
import { ProfileGroup, ProfileSettingRow, ProfileStatus, ProfileToggle } from './ProfileSettings';

const labels: Record<keyof NotificationPreferences, string> = {
  taskReminders: 'Task reminders', upcomingDeadlines: 'Upcoming deadlines', overdueAlerts: 'Overdue alerts',
  habitReminders: 'Habit reminders', milestoneReminders: 'Goal milestones',
};

export function ProfileNotifications({ master, categories, diagnostics, dateOnly, tone, inbox, historyAvailable, busy,
  onMaster, onCategory, onDate, onTone, onAndroid, onExact, onInbox, onOpen, onClear }: {
  master: boolean; categories: NotificationPreferences; diagnostics: NotificationDiagnostics;
  dateOnly: string; tone: NotificationTone; inbox: InboxPreferences; historyAvailable: boolean; busy: boolean;
  onMaster: () => void; onCategory: (key: keyof NotificationPreferences) => void; onDate: (time: string) => void;
  onTone: (tone: string) => void; onAndroid: () => void; onExact: () => void;
  onInbox: (change: Partial<InboxPreferences>) => void; onOpen?: () => void; onClear: () => void;
}) {
  const timingId = useId();
  return <div className="profile-notifications">
    <ProfileGroup title="Android delivery" description="This switch controls phone notifications. The in-app inbox has its own switch below.">
      <ProfileToggle title="Android reminders" checked={master} disabled={busy} onChange={onMaster} />
      <ProfileStatus title="Android permission" value={diagnostics.platform === 'android' ? diagnostics.permission : 'Unavailable here'} />
      {diagnostics.platform === 'android' && <ProfileStatus title="App notifications" value={diagnostics.appNotifications} />}
      {diagnostics.platform === 'android' && diagnostics.exactAlarm !== 'granted' ?
        <ProfileSettingRow title="Precise alarms" value="Review access" onClick={onExact} /> :
        <ProfileStatus title="Precise alarms" value={diagnostics.exactAlarm === 'granted' ? 'Allowed' : 'Unavailable here'} />}
            {diagnostics.platform === 'android' && <ProfileSettingRow title="Sound, vibration and delivery settings" value="Android" onClick={onAndroid} />}
      <p className="profile-detail">Without precise alarm access, Android may deliver reminders later.</p>
    </ProfileGroup>
    <ProfileGroup title="Reminder categories" description="These choices apply to the inbox and, when enabled, to Android reminders.">
      {(Object.keys(labels) as (keyof NotificationPreferences)[]).map(key => <ProfileToggle key={key} title={labels[key]}
        checked={categories[key]} disabled={busy} onChange={() => onCategory(key)} />)}
    </ProfileGroup>
    <ProfileGroup title="Reminder timing and tone">
      <div className="preference-row"><label htmlFor={timingId}>Date-only task alerts</label>
        <input id={timingId} className="lifeos-input min-h-11 rounded-lg px-2" type="time" disabled={busy}
          value={dateOnly || ''} onChange={event => onDate(event.target.value)} /></div>
      {dateOnly ? <ProfileSettingRow title="Turn off date-only alerts" onClick={() => onDate('')} /> :
        <p className="profile-detail">Off. Tasks with a due time still follow their reminder settings.</p>}
      <PreferenceChoice label="Notification tone" value={tone} options={NOTIFICATION_TONES.map(value => [value, value[0].toUpperCase() + value.slice(1)])} onSelect={onTone} />
      <p className="profile-detail">{reminderCopy('habitReminder', tone, 0).body}</p>
    </ProfileGroup>
    <ProfileGroup title="Notification Centre" description="History stays encrypted on this device. Turning off in-app reminders stops new in-app reminders. Android delivery can still appear here if enabled.">
      <ProfileToggle title="In-app reminders" checked={inbox.enabled} disabled={busy || !historyAvailable} onChange={() => onInbox({ enabled: !inbox.enabled })} />
      <ProfileToggle title="Upcoming scheduled payments and income" checked={inbox.commitments} disabled={busy || !inbox.enabled || !historyAvailable}
        onChange={() => onInbox({ commitments: !inbox.commitments })} />
      <ProfileToggle title="Budget threshold at 80%" checked={inbox.budgets} disabled={busy || !inbox.enabled || !historyAvailable}
        onChange={() => onInbox({ budgets: !inbox.budgets })} />
      <ProfileToggle title="Savings target dates" checked={inbox.savings} disabled={busy || !inbox.enabled || !historyAvailable}
        onChange={() => onInbox({ savings: !inbox.savings })} />
      <ProfileToggle title="Encrypted backup reminder" detail="After 30 days" checked={inbox.backupSince > 0} disabled={busy || !inbox.enabled || !historyAvailable}
        onChange={() => onInbox({ backupSince: inbox.backupSince > 0 ? 0 : Date.now() })} />
      {!historyAvailable && <p className="profile-detail">Notification history and inbox settings become available after protected storage is set up.</p>}
      {onOpen && historyAvailable && <ProfileSettingRow title="Open Notification Centre" onClick={onOpen} />}
      {historyAvailable && <ProfileSettingRow title="Clear notification history" onClick={onClear} />}
    </ProfileGroup>
  </div>;
}
