import type { ReminderKind } from './notificationCopy';

export const NOTIFICATION_INBOX_KEY = 'notificationInbox.v1';
export const INBOX_MAX = 250;
const RETENTION = 45 * 86_400_000;

export type InboxKind = ReminderKind | 'commitment' | 'budget' | 'savings' | 'backup' | 'recovery' | 'notesReminder';
export type InboxEvidence = 'in-app' | 'receiver' | 'delivered' | 'opened';
export type InboxSource = 'task' | 'habit' | 'milestone' | 'commitment' | 'budget' | 'savings' | 'backup' | 'recovery' | 'note';
export type InboxInput = { kind: InboxKind; source: InboxSource; sourceId: string; occurrence: string; at: number;
  evidence: InboxEvidence; observedAt?: number; revision?: string };
export type InboxEvent = InboxInput & { key: string; readAt?: number; dismissedAt?: number; resolvedAt?: number };
export type InboxChange = {
  events?: InboxInput[];
  sources?: Record<string, string>;
  action?: { kind: 'read' | 'dismiss'; key: string } | { kind: 'readAll' | 'clear' };
};

export const INBOX_LABELS: Record<InboxKind, string> = {
  dueTime: 'Task due', taskReminders: 'Task reminder', upcomingDeadlines: 'Upcoming deadline', overdueAlerts: 'Overdue task',
  taskSnooze: 'Snoozed task reminder', habitReminder: 'Habit check-in', milestoneReminder: 'Goal milestone',
  commitment: 'Scheduled payment or income', budget: 'Budget threshold', savings: 'Savings target date',
  backup: 'Review your backup', recovery: 'Set up recovery', notesReminder: 'Note reminder',
};
const localDay = (date: Date) => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'),
].join('-');
const evidenceOrder: InboxEvidence[] = ['in-app', 'receiver', 'delivered', 'opened'];
const eventSources: Record<InboxKind, InboxSource> = {
  dueTime: 'task', taskReminders: 'task', upcomingDeadlines: 'task', overdueAlerts: 'task', taskSnooze: 'task',
  habitReminder: 'habit', milestoneReminder: 'milestone', commitment: 'commitment', budget: 'budget',
  savings: 'savings', backup: 'backup', recovery: 'recovery', notesReminder: 'note',
};
export const inboxSourceKey = (source: InboxSource, id: string) => source + ':' + id;
export const inboxEventKey = (event: InboxInput) => JSON.stringify([event.kind, event.sourceId, event.occurrence]);

function accepted(input: InboxInput, now: number) {
  return Object.prototype.hasOwnProperty.call(eventSources, input.kind) && input.source === eventSources[input.kind] &&
    typeof input.sourceId === 'string' && input.sourceId.length > 0 && input.sourceId.length <= 160 &&
    typeof input.occurrence === 'string' && input.occurrence.length > 0 && input.occurrence.length <= 80 &&
    Number.isFinite(input.at) && input.at <= now + 60_000 && input.at > now - RETENTION &&
    evidenceOrder.includes(input.evidence);
}

export function changeNotificationInbox(value: unknown, change: InboxChange, now = Date.now()): InboxEvent[] {
  const entries = new Map<string, InboxEvent>();
  if (Array.isArray(value)) for (const event of value.slice(0, INBOX_MAX)) {
    if (event && accepted(event, now) && event.key === inboxEventKey(event)) entries.set(event.key, { ...event });
  }
  for (const event of (change.events || []).slice(0, INBOX_MAX)) {
    if (!accepted(event, now)) continue;
    let key = inboxEventKey(event);
    let previous = entries.get(key);
    if (!previous && event.source !== 'habit') {
      // Pre-upgrade Android records carried no instant for some reminder kinds.
      const day = /^\d{4}-\d{2}-\d{2}$/.test(event.occurrence) ? event.occurrence : localDay(new Date(event.at));
      const match = [...entries.values()].find(row => row.kind === event.kind && row.sourceId === event.sourceId &&
        localDay(new Date(row.at)) === day && (row.occurrence === day || event.occurrence === day));
      if (match) {
        previous = match;
        if (event.occurrence !== day) entries.delete(match.key);
        else key = match.key;
        entries.set(key, { ...match, key, occurrence: event.occurrence === day ? match.occurrence : event.occurrence });
        previous = entries.get(key);
      }
    }
    const { kind, source, sourceId, occurrence, at, evidence, observedAt, revision } = event;
    if (!previous) entries.set(key, { key, kind, source, sourceId, occurrence, at, evidence, observedAt, revision });
    else {
      const stronger = evidenceOrder.indexOf(evidence) > evidenceOrder.indexOf(previous.evidence);
      if (stronger || (!previous.revision && revision)) entries.set(key, {
        ...previous, revision: previous.revision || revision,
        evidence: stronger ? evidence : previous.evidence,
        observedAt: stronger ? observedAt : previous.observedAt,
      });
    }
  }
  const rows = [...entries.values()];
  for (const event of rows) {
    if (change.sources) {
      const current = change.sources[inboxSourceKey(event.source, event.sourceId)];
      if (current === undefined || (event.revision && event.revision !== current)) event.resolvedAt ||= now;
      else if (!event.revision) event.revision = current;
    }
    const action = change.action;
    if (action?.kind === 'clear' || (action?.kind === 'dismiss' && action.key === event.key)) event.dismissedAt ||= now;
    if (action?.kind === 'readAll' || (action?.kind === 'read' && action.key === event.key)) event.readAt ||= now;
  }
  return rows.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key)).slice(0, INBOX_MAX);
}

export function nativeInboxEvent(extra: Record<string, unknown> | undefined, evidence: Exclude<InboxEvidence, 'in-app'>, observedAt = Date.now()): InboxInput | undefined {
  const kind = extra?.kind as InboxKind;
  if (!extra || typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(eventSources, kind)) return;
  const source = eventSources[kind];
  if (source !== 'task' && source !== 'habit' && source !== 'milestone') return;
  const sourceId = extra[source + 'Id'];
  if (typeof sourceId !== 'string' || sourceId.startsWith('lifeos-demo-v2:')) return;
  const scheduled = extra.occurrenceAt || extra.originalReminderAt;
  const parsed = typeof scheduled === 'string' ? Date.parse(scheduled) : NaN;
  const at = Number.isFinite(parsed) && parsed <= observedAt + 60_000 ? parsed : observedAt;
  const date = new Date(at);
  const day = localDay(date);
  // Older Android reminders did not ship occurrence metadata. Their local-day fallback avoids
  // repeats from an active notification without claiming the exact schedule time.
  const occurrence = source === 'habit' || !Number.isFinite(parsed) ? day : date.toISOString();
  return { kind, source, sourceId, occurrence, at, evidence, observedAt };
}
