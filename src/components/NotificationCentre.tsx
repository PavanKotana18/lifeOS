import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, CalendarClock, CircleCheck, Flag, HardDrive, PiggyBank, Shield, Wallet, X } from 'lucide-react';
import { INBOX_LABELS, type InboxChange, type InboxEvent } from '../services/notificationInbox';

const icons = { task: CalendarClock, habit: CircleCheck, milestone: Flag, commitment: Wallet, budget: Wallet,
  savings: PiggyBank, backup: HardDrive, recovery: Shield, note: Bell };
const delivery = { 'in-app': 'In-app reminder', receiver: 'Android receiver observed', delivered: 'Seen in Android notifications', opened: 'Opened from Android' };
const filters = ['All', 'Unread', 'Reminders'] as const;
type Filter = typeof filters[number];

export function NotificationCentre({ rows, loading, failed, enabled, settings, onShowSettings, onClose, onApply, onOpen, onTaskAction, actions, formatDate, recordLabel }: {
  rows: InboxEvent[]; loading: boolean; failed: boolean; enabled: boolean; settings: ReactNode; onShowSettings: () => void;
  onClose: () => void; onApply: (action: InboxChange['action']) => Promise<boolean>;
  onOpen: (event: InboxEvent) => void; onTaskAction: (event: InboxEvent, action: 'lifeos-task-done' | 'lifeos-task-snooze') => void;
  actions: { snooze: boolean }; formatDate: (date: Date) => string; recordLabel: (event: InboxEvent) => string | undefined;
}) {
  const [filter, setFilter] = useState<Filter>('All');
  const list = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const showingSettings = Boolean(settings);
  useEffect(() => {
    if (showingSettings) closeButton.current?.focus();
    else if (document.activeElement === closeButton.current) settingsButton.current?.focus();
  }, [showingSettings]);
  const visible = rows.filter(row => filter === 'All' || (filter === 'Unread' ? !row.readAt && !row.resolvedAt
    : row.source !== 'budget' && row.source !== 'recovery'));
  const groups = new Map<string, InboxEvent[]>();
  for (const row of visible) {
    const label = formatDate(new Date(row.at));
    const group = groups.get(label);
    if (group) group.push(row);
    else groups.set(label, [row]);
  }
  return <section id="notification-centre" role="dialog" aria-modal="true" aria-labelledby="notification-centre-title"
    className="notification-centre lifeos-page" data-no-primary-swipe>
    <div className="notification-centre-header">
      <h1 id="notification-centre-title">{settings ? 'Notification settings' : 'Notification Centre'}</h1>
      <button ref={closeButton} type="button" aria-label={settings ? 'Done with notification settings' : 'Close Notification Centre'} className="feather-icon-button" onClick={onClose}>
        <X size={20} aria-hidden="true" />
      </button>
    </div>
    {settings ? <div className="notification-centre-body">{settings}</div> : <>
      <div className="notification-centre-controls">
        <div aria-label="Filter notifications" className="notification-filters">
          {filters.map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => {
            setFilter(value); if (list.current) list.current.scrollTop = 0;
          }}>{value}</button>)}
        </div>
        <div className="notification-commands">
          <button ref={settingsButton} type="button" className="feather-secondary" onClick={onShowSettings}>Settings</button>
          <button type="button" className="feather-secondary" disabled={!rows.some(row => !row.readAt && !row.resolvedAt)}
            onClick={() => void onApply({ kind: 'readAll' })}>Mark all as read</button>
        </div>
      </div>
      <div ref={list} className="notification-centre-body">
        {failed && <p role="alert" className="lifeos-warning rounded-xl p-3">Notification history could not be opened.</p>}
        {loading ? <p role="status">Loading notification history…</p> : !failed && !groups.size &&
          <div className="notification-empty"><Bell aria-hidden="true" size={26} /><h2>{filter === 'Unread' ? 'All caught up' : filter === 'Reminders' ? 'No reminders' : 'No notifications'}</h2>
            <p>{enabled ? 'New reminders and alerts will appear here as they become available.' : 'Check Settings for in-app reminder visibility and protected history availability.'}</p></div>}
        {[...groups].map(([label, group]) => <section key={label} className="notification-date-group">
          <h2>{label}</h2>
          <ul>{group.map(row => {
            const Icon = icons[row.source];
            const title = INBOX_LABELS[row.kind];
            const subject = !row.resolvedAt ? recordLabel(row) : undefined;
            const context = subject ? ' for ' + subject : '';
            return <li key={row.key} className="lifeos-panel notification-item" data-unread={!row.readAt && !row.resolvedAt || undefined}>
              <div className="notification-item-main">
                <span className="notification-item-icon lifeos-tint lifeos-accent-text"><Icon size={19} aria-hidden="true" /></span>
                <div><h3>{title}</h3>{subject && <p className="notification-subject">{subject}</p>}<p>{row.resolvedAt ? 'No longer active' : delivery[row.evidence]}{!row.readAt && !row.resolvedAt ? ' · Unread' : ''}</p></div>
                <button aria-label={'Dismiss ' + title + context} type="button" className="feather-icon-button"
                  onClick={() => void onApply({ kind: 'dismiss', key: row.key })}><X size={17} aria-hidden="true" /></button>
              </div>
              <div className="notification-item-actions">
                {!row.resolvedAt && row.source !== 'note' && <button type="button" className="feather-secondary" aria-label={subject ? "Open " + subject : undefined} onClick={() => onOpen(row)}>Open</button>}
                {!row.resolvedAt && row.source === 'task' && <>
                  <button type="button" className="feather-secondary" aria-label={'Mark done' + context} onClick={() => onTaskAction(row, 'lifeos-task-done')}>Mark done</button>
                  {actions.snooze && <button type="button" className="feather-secondary" aria-label={'Snooze 10 min' + context} onClick={() => onTaskAction(row, 'lifeos-task-snooze')}>Snooze 10 min</button>}
                </>}
                {!row.readAt && <button type="button" className="feather-secondary" aria-label={'Mark as read' + context} onClick={() => void onApply({ kind: 'read', key: row.key })}>Mark as read</button>}
              </div>
            </li>;
          })}</ul>
        </section>)}
      </div>
    </>}
  </section>;
}
