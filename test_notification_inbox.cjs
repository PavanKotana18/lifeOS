'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { changeNotificationInbox, inboxEventKey, nativeInboxEvent, INBOX_MAX } = require('./src/services/notificationInbox.ts');
const { buildInboxSnapshot, DEFAULT_INBOX_PREFERENCES } = require('./src/services/notificationInboxProducers.ts');

const now = new Date(2026, 10, 27, 11, 0);
const at = new Date(2026, 10, 27, 10, 0).toISOString();
const task = { kind: 'dueTime', source: 'task', sourceId: 'test-task', occurrence: at, at: Date.parse(at), evidence: 'in-app', revision: 'initial' };
const key = inboxEventKey(task);
const sources = { 'task:test-task': 'initial' };
const delivered = nativeInboxEvent({ kind: 'dueTime', taskId: 'test-task', occurrenceAt: at, title: 'never keep this' }, 'delivered', +now);
assert.equal(delivered.title, undefined);
assert.equal(inboxEventKey(delivered), key);
let rows = changeNotificationInbox(undefined, { events: [task, delivered], sources }, +now);
assert.equal(rows.length, 1);
assert.equal(rows[0].evidence, 'delivered');
assert.equal(rows[0].readAt, undefined);
const initialRows = rows;
rows = changeNotificationInbox(rows, { action: { kind: 'read', key } }, +now);
assert.equal(rows[0].readAt, +now);
assert.equal(initialRows[0].readAt, undefined, 'writes do not mutate the preceding snapshot');
rows = changeNotificationInbox(JSON.parse(JSON.stringify(rows)), { events: [task, delivered], sources }, +now + 1);
assert.equal(rows[0].readAt, +now, 'duplicate observations across restart preserve read state');
rows = changeNotificationInbox(rows, { action: { kind: 'clear' }, sources: {} }, +now + 2);
rows = changeNotificationInbox(rows, { events: [task, delivered], sources }, +now + 3);
assert.equal(rows[0].dismissedAt, +now + 2, 'a repeated Android observation cannot restore cleared history');
assert.equal(rows[0].resolvedAt, +now + 2, 'removed records resolve and cannot be reactivated');
assert.equal(changeNotificationInbox([task], { events: [task] }, +now + 46 * 86_400_000).length, 0);
assert.equal(changeNotificationInbox([], { events: Array.from({ length: 400 }, (_, id) => ({ ...task, sourceId: String(id) })) }, +now).length, INBOX_MAX);
assert.equal(nativeInboxEvent({ kind: 'notesReminder', noteId: 'x' }, 'opened', +now), undefined);
assert.equal(nativeInboxEvent({ kind: 'dueTime', taskId: 'lifeos-demo-v2:sample' }, 'opened', +now), undefined);

let legacy = nativeInboxEvent({ kind: 'dueTime', taskId: 'test-task' }, 'receiver', +now);
legacy = changeNotificationInbox([], { events: [legacy], action: { kind: 'readAll' } }, +now)[0];
const upgraded = changeNotificationInbox([legacy], { events: [task], sources }, +now + 1);
assert.equal(upgraded.length, 1);
assert.equal(upgraded[0].key, key);
assert.equal(upgraded[0].readAt, +now);
assert.equal(upgraded[0].evidence, 'receiver');

const input = {
  now, preferences: { ...DEFAULT_INBOX_PREFERENCES, commitments: true, budgets: true, savings: true, backupSince: +now - 40 * 86_400_000 },
  reminderPreferences: { taskReminders: true, upcomingDeadlines: true, overdueAlerts: true, habitReminders: true, milestoneReminders: true },
  dateOnlyAlertTime: '09:00', lastBackup: 0, recoveryPending: true, categories: [],
  tasks: [{ id: 't', dueDate: '2026-11-27', dueTime: '10:00', reminderLeadMinutes: 30, createdAt: '2026-11-26' }],
  habits: [{ id: 'h', frequency: 'daily', reminderTime: '10:00', createdAt: '2026-11-26' }], habitLogs: [],
  goals: [{ id: 'g', status: 'In Progress' }], milestones: [{ id: 'm', goalId: 'g', targetDate: '2026-11-27' }],
  commitments: [{ id: 'c', status: 'active', nextDueDate: '2026-11-29' }],
  savings: [{ id: 's', currencyCode: 'INR', targetDate: '2026-11-29', targetAmountMinor: '1007', currentAmountMinor: '1006' }],
  budgets: [{ id: 'b', currencyCode: 'INR', monthYear: '2026-11', amountMinor: '1000' }],
  transactions: [{ id: 'without-currency', type: 'expense', date: '2026-11-11', amount: 100 },
    { id: 'expense', currencyCode: 'INR', type: 'expense', date: '2026-11-12', amountMinor: '800' }],
};
const snapshot = buildInboxSnapshot(input);
assert.deepEqual(new Set(snapshot.events.map(row => row.kind)), new Set([
  'dueTime', 'taskReminders', 'upcomingDeadlines', 'overdueAlerts', 'habitReminder', 'milestoneReminder',
  'commitment', 'budget', 'savings', 'backup', 'recovery',
]));
assert.ok(snapshot.events.every(row => row.evidence === 'in-app'));
assert.equal(buildInboxSnapshot({ ...input, preferences: { ...input.preferences, enabled: false } }).events.length, 0);
assert.ok(!buildInboxSnapshot({ ...input, transactions: input.transactions.slice(0, 1) }).events.some(row => row.kind === 'budget'));
assert.ok(!buildInboxSnapshot({ ...input, habitLogs: [{ habitId: 'h', date: '2026-11-27', completed: true }] }).events.some(row => row.kind === 'habitReminder'));
console.log('Notification inbox lifecycle, evidence, legacy deduplication, retention and domain producers passed.');
