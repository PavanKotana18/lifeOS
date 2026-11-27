import { useId, useState } from 'react';
import { Bell } from 'lucide-react';
import type { NotificationPreferences } from '../types';
import { NOTIFICATION_TONES, reminderCopy, type NotificationTone } from '../services/notificationCopy';
import type { InboxPreferences } from '../services/notificationInboxProducers';
import type { NotificationDiagnostics } from '../services/notificationService';
import { PreferenceChoice } from './PreferenceChoice';
import { ProfileButton, ProfileGroup, ProfileIcon, ProfileSettingRow, ProfileStatus, ProfileToggle } from './ProfileSettings';

const labels: Record<keyof NotificationPreferences, string> = {
  taskReminders: 'Task reminders', upcomingDeadlines: 'Upcoming deadlines', overdueAlerts: 'Overdue alerts',
  habitReminders: 'Habit reminders', milestoneReminders: 'Goal milestones',
};
const formatStatus = (value: string) => value === 'granted' ? 'Allowed' : value === 'prompt' || value === 'prompt-with-rationale' ? 'Permission needed'
  : value === 'unsupported' ? 'Unavailable here' : value.charAt(0).toUpperCase() + value.slice(1);

export function ProfileNotifications({ master, categories, diagnostics, dateOnly, tone, inbox, historyAvailable, busy,
  onMaster, onCategory, onDate, onTone, onAndroid, onExact, onInbox, onOpen, onClear }: {
  master: boolean; categories: NotificationPreferences; diagnostics: NotificationDiagnostics;
  dateOnly: string; tone: NotificationTone; inbox: InboxPreferences; historyAvailable: boolean; busy: boolean;
  onMaster: () => void; onCategory: (key: keyof NotificationPreferences) => void; onDate: (time: string) => void;
  onTone: (tone: string) => void; onAndroid: () => void; onExact: () => void;
  onInbox: (change: Partial<InboxPreferences>) => void; onOpen?: () => void; onClear: () => void;
}) {
  const timingId = useId();
  const [sample, setSample] = useState(0);
  const preview = reminderCopy(sample % 2 ? 'dueTime' : 'habitReminder', tone, sample);
  const android = diagnostics.platform === 'android';
  const optionalDisabled = busy || !inbox.enabled || !historyAvailable;
  return <div className="profile-design profile-notifications">
    <ProfileGroup title="Notification availability" topic="Notification permissions" icon={Bell}>
      <ProfileToggle title="Android reminders" detail="Allow BusyDoo to send device reminders when Android permits delivery."
        checked={master} disabled={busy} onChange={onMaster} />
      <ProfileStatus title="Android permission" value={android ? formatStatus(diagnostics.permission) : 'Unavailable here'} />
      {android && <ProfileStatus title="Delivery in Android settings" value={formatStatus(diagnostics.appNotifications)} />}
    </ProfileGroup>
    <ProfileGroup title="Reminder preferences" description="Saved categories apply to new inbox reminders and eligible Android alerts.">
      {(Object.keys(labels) as (keyof NotificationPreferences)[]).map(key => <ProfileToggle key={key} title={labels[key]}
        checked={categories[key]} disabled={busy} onChange={() => onCategory(key)} />)}
    </ProfileGroup>
    <ProfileGroup title="Reminder timing">
      <div className="profile-row"><label className="profile-row-copy" htmlFor={timingId}><strong>Date-only task alerts</strong>
        <small>Applies to tasks with a date and no due time.</small></label>
        <input id={timingId} type="time" disabled={busy} value={dateOnly || ''} onChange={event => onDate(event.target.value)} /></div>
      {dateOnly ? <ProfileSettingRow title="Turn off date-only alerts" disabled={busy} onClick={() => onDate('')} /> :
        <ProfileStatus title="Date-only alerts" value="Off" />}
    </ProfileGroup>
    <ProfileGroup title="Notification tone" variant="plain" description="Tone changes reminder wording. Sound and vibration are managed in Android.">
      <div className="profile-row-list">
        <PreferenceChoice profile disabled={busy} label="Notification tone" value={tone} options={NOTIFICATION_TONES.map(value => [value, formatStatus(value)])} onSelect={onTone} />
      </div>
      <div className="profile-tone-sample" aria-live="polite">
        <ProfileIcon icon={Bell} /><strong>{preview.title}</strong><p className="profile-description">{preview.body}</p>
      </div>
      <div className="profile-actions"><ProfileButton onClick={() => setSample(value => value + 1)}>Preview another reminder</ProfileButton></div>
    </ProfileGroup>
    <ProfileGroup title="Android delivery settings" topic="Exact reminders">
      {android && diagnostics.exactAlarm !== 'granted' ?
        <ProfileSettingRow title="Precise alarms" detail="Review special access for eligible alerts." value="Review access" onClick={onExact} /> :
        <ProfileStatus title="Precise alarms" value={diagnostics.exactAlarm === 'granted' ? 'Allowed' : 'Unavailable here'} />}
      {android && <ProfileSettingRow title="Sound and vibration" detail="Open BusyDoo’s Android notification settings." onClick={onAndroid} />}
    </ProfileGroup>
    <ProfileGroup title="In-app reminders" description="Choose what can appear inside BusyDoo.">
      <ProfileToggle title="In-app reminders" checked={inbox.enabled} disabled={busy || !historyAvailable} onChange={() => onInbox({ enabled: !inbox.enabled })} />
      <ProfileToggle title="Scheduled payments and income" checked={inbox.commitments} disabled={optionalDisabled}
        onChange={() => onInbox({ commitments: !inbox.commitments })} />
      <ProfileToggle title="Budget threshold at 80%" checked={inbox.budgets} disabled={optionalDisabled}
        onChange={() => onInbox({ budgets: !inbox.budgets })} />
      <ProfileToggle title="Savings target dates" checked={inbox.savings} disabled={optionalDisabled} onChange={() => onInbox({ savings: !inbox.savings })} />
      <ProfileToggle title="Encrypted backup reminder" detail="After 30 days" checked={inbox.backupSince > 0} disabled={optionalDisabled}
        onChange={() => onInbox({ backupSince: inbox.backupSince > 0 ? 0 : Date.now() })} />
    </ProfileGroup>
    <ProfileGroup title="Notification Centre history" topic="Notification history">
      {!historyAvailable && <p className="profile-description">Set up protected storage to enable history and inbox preferences.</p>}
      {onOpen && historyAvailable && <ProfileSettingRow title="Open Notification Centre" onClick={onOpen} />}
      {historyAvailable && <ProfileSettingRow title="Clear notification history" onClick={onClear} />}
    </ProfileGroup>
  </div>;
}
