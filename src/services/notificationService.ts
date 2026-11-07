import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications, Weekday, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { buildTaskNotificationPlan, stableNotificationId } from './domainUtils';
import { LIFEOS_BUILD_INFO } from './buildInfo';
import type { Goal, Habit, Milestone, NotificationPreferences, Task } from '../types';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  taskReminders: false,
  upcomingDeadlines: false,
  overdueAlerts: false,
  habitReminders: false,
  milestoneReminders: false,
};

const notificationId = stableNotificationId;

const taskNotificationId = (task: Task, kind: string) => notificationId(`task:${task.id}:${kind}`);
const testId = notificationId('lifeos:test-notification');
const isNative = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
const NativeRuntimeInfo = registerPlugin<{ getInfo(): Promise<{ androidApi: number; packageName: string; versionName: string; versionCode: number; batteryOptimizationExempt?: boolean | null }> }>('LifeOSRuntimeInfo');
const NativeNotificationSettings = registerPlugin<{ open(): Promise<void> }>('NotificationSettings');
const NativeNotificationTapLaunch = registerPlugin<{
  getInitialAction(): Promise<{ action?: { notification?: { id?: number; extra?: Record<string, unknown> } } }>;
  acknowledgeInitialAction(options: { id: number }): Promise<void>;
}>('NotificationTapLaunch');
const diagnosticKey = 'lifeos.notificationDiagnostics';
const lifecycleKey = 'lifeos.notificationLifecycle.v1';
let ensureChannelPromise: Promise<void> | null = null;
let taskSyncQueue: Promise<void> = Promise.resolve();
const taskScheduleStatus = new Map<string, 'pending' | 'schedule-failed'>();

export interface NotificationDiagnostics {
  capability: 'initializing' | 'available' | 'unavailable' | 'error';
  platform: string;
  supported: boolean;
  permission: string;
  appNotifications: string;
  exactAlarm: string;
  channel: string;
  pendingCount: number;
  visibleNotificationCount: number;
  visibleNotificationIds: number[];
  batteryOptimizationExempt: boolean | null;
  androidApi: number | null;
  packageName: string | null;
  versionName: string | null;
  versionCode: number | null;
  build: typeof LIFEOS_BUILD_INFO;
  lastScheduleAttempt: string | null;
  lastScheduleResult: string;
  lastCancellationReason: string | null;
  lastActionEvent: { at: string; kind: string; id: number } | null;
  lastError: string;
}

type NotificationDiagnosticRecord = {
  lastError?: string;
  lastScheduleAttempt?: string;
  lastScheduleResult?: string;
  lastCancellationReason?: string;
  lastActionEvent?: { at: string; kind: string; id: number };
};
type ReminderLifecycle = {
  kind: 'taskReminders';
  configuredAt: string | null;
  reminderAt: string;
  scheduleMode: 'exact' | 'inexact-allowWhileIdle' | 'unknown';
  scheduleRequestedAt: string | null;
  nativeAcceptedAt: string | null;
  pendingObservedAt: string | null;
  deliveryState: 'requested' | 'accepted' | 'pending-observed' | 'native-receiver-event-observed' | 'active-observed' | 'tapped' | 'delivery-unconfirmed' | 'cancelled' | 'schedule-failed' | 'unknown';
  deliveryObservedAt: string | null;
  receiverEventAt: string | null;
  tappedAt: string | null;
  cancellationAt: string | null;
  cancellationReason: string | null;
  updatedAt: string;
};
function readReminderLifecycle(): Record<string, ReminderLifecycle> {
  try {
    const value = JSON.parse(localStorage.getItem(lifecycleKey) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function updateReminderLifecycle(id: number, update: Partial<ReminderLifecycle> & Pick<ReminderLifecycle, 'kind' | 'reminderAt'>) {
  try {
    const all = readReminderLifecycle();
    const key = String(id);
    const previous = all[key];
    const changedReminder = Boolean(previous && previous.reminderAt !== update.reminderAt);
    const base = changedReminder ? {
      kind: 'taskReminders' as const, configuredAt: update.configuredAt ?? previous?.configuredAt ?? null,
      reminderAt: update.reminderAt, scheduleMode: 'unknown' as const, scheduleRequestedAt: null,
      nativeAcceptedAt: null, pendingObservedAt: null, deliveryState: 'unknown' as const,
      deliveryObservedAt: null, receiverEventAt: null, tappedAt: null, cancellationAt: null, cancellationReason: null,
      updatedAt: new Date().toISOString(),
    } : previous;
    all[key] = { ...base, ...update, updatedAt: new Date().toISOString() } as ReminderLifecycle;
    const entries = Object.entries(all).sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt)).slice(0, 128);
    localStorage.setItem(lifecycleKey, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* Diagnostic persistence is best-effort and contains no record content. */ }
}
function readDiagnosticRecord(): NotificationDiagnosticRecord {
  try { return JSON.parse(localStorage.getItem(diagnosticKey) || '{}'); } catch { return {}; }
}
function updateDiagnostics(update: Partial<NotificationDiagnosticRecord>) {
  try { localStorage.setItem(diagnosticKey, JSON.stringify({ ...readDiagnosticRecord(), ...update })); } catch { /* Diagnostics are best-effort when storage is unavailable. */ }
}
function safeErrorCode(error: unknown) {
  const name = error instanceof Error && /^[A-Za-z]+Error$/.test(error.name) ? error.name : 'Error';
  return `${name}:native-operation-failed`;
}
function writeLastError(error: string) { updateDiagnostics({ lastError: error || '' }); }
function withTimeout<T>(operation: Promise<T>, label: string, timeoutMs = 5000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}-timeout`)), timeoutMs);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

function requireNativeNotifications() {
  if (!Capacitor.isNativePlatform()) return false;
  if (!Capacitor.isPluginAvailable('LocalNotifications')) {
    writeLastError('local-notifications-plugin-not-registered');
    updateDiagnostics({ lastScheduleResult: 'failed:local-notifications-plugin-not-registered' });
    throw new Error('Local Notifications native plugin is not registered in this installed Android build.');
  }
  return true;
}
function pendingTimeMatches(actual: unknown, expected: Date) {
  if (actual === undefined || actual === null) return false;
  const actualTime = actual instanceof Date ? actual.getTime() : new Date(actual as string | number).getTime();
  return Number.isFinite(actualTime) && Math.abs(actualTime - expected.getTime()) < 1000;
}
function asDate(value: unknown) {
  if (value instanceof Date) return new Date(value.getTime());
  return new Date(value as string | number);
}

function localDateTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

async function cancelIds(ids: number[]) {
  if (!ids.length || !requireNativeNotifications()) return;
  await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
}

async function schedule(notifications: LocalNotificationSchema[]) {
  if (!notifications.length || !requireNativeNotifications()) return;
  await LocalNotifications.schedule({ notifications });
}

function formatDateForDiagnostic(date: Date | null | undefined) {
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

// Match only reminder kinds owned by this app; retain unrelated pending entries.
async function cancelPendingKinds(kinds: string[]) {
  if (!requireNativeNotifications()) return;
  const pending = await LocalNotifications.getPending();
  const owned = new Set(kinds);
  await cancelIds(pending.notifications.filter(item => owned.has(String(item.extra?.kind || ''))).map(item => item.id));
}

export const NotificationService = {
  isSupported: isNative,

  async cancelAllRecordReminders() {
    await cancelPendingKinds(['taskReminders', 'upcomingDeadlines', 'overdueAlerts', 'habitReminder', 'milestoneReminder']);
  },

  async checkPermission() {
    if (!isNative()) return 'unsupported';
    const status = await LocalNotifications.checkPermissions();
    return status.display;
  },

  async requestPermission() {
    if (!isNative()) return 'unsupported';
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return 'granted';
    const result = await LocalNotifications.requestPermissions();
    return result.display;
  },

  async checkExactAlarmPermission() {
    if (!isNative()) return 'unsupported';
    const status = await LocalNotifications.checkExactNotificationSetting();
    return status.exact_alarm;
  },

  async requestExactAlarmPermission() {
    if (!isNative()) return 'unsupported';
    const status = await LocalNotifications.changeExactNotificationSetting();
    return status.exact_alarm;
  },

  async canScheduleNotifications() {
    // Capacitor's Android scheduler uses setAndAllowWhileIdle when exact-alarm
    // access is unavailable. POST_NOTIFICATIONS is the delivery gate; exact
    // access controls precision and must not disable all reminders.
    return isNative() && await this.checkPermission() === 'granted';
  },

  async syncTasks(tasks: Task[], preferences: NotificationPreferences) {
    if (!requireNativeNotifications()) return;
    const run = async () => {
      updateDiagnostics({ lastScheduleAttempt: new Date().toISOString(), lastScheduleResult: 'running', lastCancellationReason: '' });
      try {
      await this.ensureChannel();
      if (!(await this.canScheduleNotifications())) {
        const pending = await LocalNotifications.getPending();
        const owned = pending.notifications.filter(item => ['taskReminders', 'upcomingDeadlines', 'overdueAlerts'].includes(String(item.extra?.kind || '')));
        await cancelIds(owned.map(item => item.id));
        for (const item of owned) {
          if (String(item.extra?.kind) !== 'taskReminders') continue;
          const task = tasks.find(row => String(row.id) === String(item.extra?.taskId || ''));
          const reminderAt = task?.reminderAt || (typeof item.extra?.originalReminderAt === 'string' ? item.extra.originalReminderAt : null);
          if (!reminderAt) continue;
          updateReminderLifecycle(item.id, {
            kind: 'taskReminders', configuredAt: task?.createdAt || null, reminderAt,
            deliveryState: 'cancelled', cancellationAt: new Date().toISOString(), cancellationReason: 'android-notification-permission-unavailable',
          });
        }
        for (const task of tasks) taskScheduleStatus.delete(task.id);
        writeLastError('permission-denied-or-revoked');
        updateDiagnostics({ lastScheduleResult: 'not-scheduled:permission-unavailable', lastCancellationReason: owned.length ? 'android-notification-permission-unavailable' : '' });
        return;
      }
      const pending = await LocalNotifications.getPending();
      const delivered = await LocalNotifications.getDeliveredNotifications();
      const exactAlarm = await this.checkExactAlarmPermission();
      const scheduleMode = exactAlarm === 'granted' ? 'exact' as const : 'inexact-allowWhileIdle' as const;
      const taskKinds = new Set(['taskReminders', 'upcomingDeadlines', 'overdueAlerts']);
      const oldTaskNotifications = pending.notifications.filter(item => taskKinds.has(String(item.extra?.kind || '')));

      const labels: Record<string, string> = {
        taskReminders: 'Task reminder', upcomingDeadlines: 'Upcoming deadline', overdueAlerts: 'Task overdue',
      };
      const now = new Date();
      const notifications = tasks.flatMap(task => buildTaskNotificationPlan(task, preferences, now).map(plan => ({
        id: taskNotificationId(task, plan.kind), title: labels[plan.kind] || 'LifeOS reminder', body: 'Unlock LifeOS to view your reminder.',
        // Exact-alarm denial falls back to Android's idle-aware inexact alarm.
        // Reserve the per-app idle quota for reminders the user explicitly set;
        // deadline/overdue alerts are separate, lower-priority events.
        schedule: { at: plan.at, allowWhileIdle: plan.kind === 'taskReminders' }, channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
        extra: { kind: plan.kind, taskId: task.id,
          ...(plan.kind === 'taskReminders' && task.reminderAt ? { originalReminderAt: task.reminderAt } : {}) },
      })));
      for (const task of tasks) {
        if (!task.reminderAt || task.completed) continue;
        const id = taskNotificationId(task, 'taskReminders');
        const existingPending = pending.notifications.some(item => item.id === id);
        const existingVisible = delivered.notifications.some(item => Number(item.id) === id);
        const previous = readReminderLifecycle()[String(id)];
        const observed = existingVisible ? {
          deliveryState: 'active-observed' as const, deliveryObservedAt: new Date().toISOString(),
        } : existingPending ? {
          deliveryState: 'pending-observed' as const, pendingObservedAt: new Date().toISOString(),
        } : previous?.nativeAcceptedAt && new Date(task.reminderAt).getTime() <= now.getTime() ? {
          deliveryState: 'delivery-unconfirmed' as const,
        } : {};
        updateReminderLifecycle(id, {
          kind: 'taskReminders', configuredAt: task.createdAt || null,
          reminderAt: task.reminderAt, scheduleMode: previous?.scheduleMode || 'unknown',
          ...observed,
        });
      }
      const desiredIds = new Set(notifications.map(item => item.id));
      const tasksById = new Map(tasks.map(task => [String(task.id), task]));
      const visibleIds = new Set(delivered.notifications.map(item => Number(item.id)).filter(Number.isInteger));
      const lateCatchUps: LocalNotificationSchema[] = [];
      const retainedLateIds = new Set<number>();
      for (const item of oldTaskNotifications) {
        if (String(item.extra?.kind || '') !== 'taskReminders') continue;
        const taskId = String(item.extra?.taskId || '');
        const task = tasksById.get(taskId);
        if (!task || task.completed || !preferences.taskReminders || !task.reminderAt) continue;
        const selectedAt = new Date(task.reminderAt);
        if (!Number.isFinite(selectedAt.getTime()) || selectedAt > now) continue;
        const originalAt = item.extra?.originalReminderAt
          ? asDate(item.extra.originalReminderAt)
          : item.schedule?.at ? asDate(item.schedule.at) : new Date(NaN);
        const existingTrigger = item.schedule?.at ? asDate(item.schedule.at) : null;
        // Plugin 6.1.3 rewrites elapsed schedules to now+15s on reboot but
        // keeps legacy extras unchanged. Recognize that narrow restore window
        // when the selected reminder itself is already past.
        const looksBootRestored = !item.extra?.originalReminderAt && existingTrigger !== null &&
          existingTrigger > now && existingTrigger.getTime() - now.getTime() <= 60_000;
        if (!pendingTimeMatches(originalAt, selectedAt) && !looksBootRestored) continue;
        if (visibleIds.has(item.id)) {
          retainedLateIds.add(item.id);
          continue;
        }
        const catchUpStillPending = item.extra?.lateCatchUp === true && existingTrigger !== null && existingTrigger > now;
        if (!catchUpStillPending) {
          // The Capacitor pending list is persisted plugin state, not direct
          // AlarmManager introspection. The plugin receiver removes the saved
          // row after posting. A still-persisted missed reminder is therefore
          // eligible for one foreground catch-up rather than stale cancellation.
          lateCatchUps.push({
            id: item.id,
            title: 'Task reminder',
            body: 'Unlock LifeOS to view your reminder.',
            schedule: { at: new Date(now.getTime() + 5_000), allowWhileIdle: true },
            channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
            extra: { kind: 'taskReminders', taskId, lateCatchUp: true, originalReminderAt: task.reminderAt },
          });
        }
        retainedLateIds.add(item.id);
      }
      for (const id of retainedLateIds) desiredIds.add(id);
      const notificationOwners = new Map<number, string>();
      for (const item of notifications) {
        const owner = `${String(item.extra?.kind)}:${String(item.extra?.taskId)}`;
        const existing = notificationOwners.get(item.id);
        if (existing && existing !== owner) throw new Error('notification-id-collision');
        notificationOwners.set(item.id, owner);
      }
      if (notifications.length || lateCatchUps.length) {
        // Queue the replacement set first. A failed update must not erase
        // reminders which were already queued successfully.
        const requestedAt = new Date().toISOString();
        for (const item of notifications) {
          if (String(item.extra?.kind) !== 'taskReminders') continue;
          const task = tasksById.get(String(item.extra?.taskId || ''));
          if (!task?.reminderAt) continue;
          updateReminderLifecycle(item.id, {
            kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
            scheduleMode, scheduleRequestedAt: requestedAt, deliveryState: 'requested',
            cancellationAt: null, cancellationReason: null,
          });
        }
        for (const item of lateCatchUps) {
          const task = tasksById.get(String(item.extra?.taskId || ''));
          if (!task?.reminderAt) continue;
          updateReminderLifecycle(item.id, {
            kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
            scheduleMode, scheduleRequestedAt: requestedAt, deliveryState: 'requested',
            cancellationAt: null, cancellationReason: null,
          });
        }
        await schedule([...notifications, ...lateCatchUps]);
        for (const item of [...notifications, ...lateCatchUps]) {
          if (String(item.extra?.kind) !== 'taskReminders') continue;
          const task = tasksById.get(String(item.extra?.taskId || ''));
          if (!task?.reminderAt) continue;
          updateReminderLifecycle(item.id, {
            kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
            scheduleMode, nativeAcceptedAt: new Date().toISOString(), deliveryState: 'accepted',
          });
        }
        const after = await LocalNotifications.getPending();
        const pendingById = new Map(after.notifications.map(item => [item.id, item]));
        const missing = [...notifications, ...lateCatchUps].filter(item => {
          const pendingItem = pendingById.get(item.id);
          return !pendingItem || !pendingTimeMatches(pendingItem.schedule?.at, item.schedule.at);
        });
        if (missing.length) throw new Error(`schedule-verification-missing:${missing.length}`);
        for (const item of [...notifications, ...lateCatchUps]) {
          if (String(item.extra?.kind) !== 'taskReminders') continue;
          const task = tasksById.get(String(item.extra?.taskId || ''));
          if (!task?.reminderAt) continue;
          updateReminderLifecycle(item.id, {
            kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
            scheduleMode,
            pendingObservedAt: new Date().toISOString(), deliveryState: 'pending-observed',
          });
        }
      }
      // Retire only stale LifeOS task schedules after the desired set is
      // confirmed. Serializing this operation prevents overlapping syncs from
      // cancelling each other's schedules during rapid task edits/resume.
      const stale = oldTaskNotifications.filter(item => !desiredIds.has(item.id));
      await cancelIds(stale.map(item => item.id));
      if (stale.length) {
        const cancellationReasonFor = (item: LocalNotificationSchema) => {
          const task = tasksById.get(String(item.extra?.taskId || ''));
          return !task ? 'task-deleted'
            : task.completed ? 'task-completed'
              : String(item.extra?.kind) === 'taskReminders' && !preferences.taskReminders ? 'category-disabled'
                : 'task-reminder-replaced-or-ineligible';
        };
        updateDiagnostics({ lastCancellationReason: cancellationReasonFor(stale[0]) });
        for (const item of stale) {
          if (String(item.extra?.kind) !== 'taskReminders') continue;
          const task = tasksById.get(String(item.extra?.taskId || ''));
          const reminderAt = task?.reminderAt || (typeof item.extra?.originalReminderAt === 'string' ? item.extra.originalReminderAt : null);
          if (!reminderAt) continue;
          updateReminderLifecycle(item.id, {
            kind: 'taskReminders', configuredAt: task?.createdAt || null, reminderAt,
            deliveryState: 'cancelled', cancellationAt: new Date().toISOString(), cancellationReason: cancellationReasonFor(item),
          });
        }
      }
      const finalPending = await LocalNotifications.getPending();
      const finalIds = new Set(finalPending.notifications.map(item => item.id));
      for (const task of tasks) {
        const reminderId = taskNotificationId(task, 'taskReminders');
        if (finalIds.has(reminderId)) taskScheduleStatus.set(task.id, 'pending');
        else taskScheduleStatus.delete(task.id);
      }
      writeLastError('');
      updateDiagnostics({ lastScheduleResult: `pending-queue-verified:${notifications.length}` });
      } catch (error) {
        for (const task of tasks) taskScheduleStatus.set(task.id, 'schedule-failed');
        for (const task of tasks) {
          if (!task.reminderAt) continue;
          updateReminderLifecycle(taskNotificationId(task, 'taskReminders'), {
            kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
            deliveryState: 'schedule-failed',
          });
        }
        const code = safeErrorCode(error);
        writeLastError(code);
        updateDiagnostics({ lastScheduleResult: `failed:${code}` });
        console.warn('LifeOS task notification scheduling failed:', code);
        throw error;
      }
    };
    const result = taskSyncQueue.then(run, run);
    taskSyncQueue = result.then(() => undefined, () => undefined);
    return result;
  },

  async diagnoseTaskReminder(task: Task, preferences: NotificationPreferences) {
    const permission = await this.checkPermission();
    const kind = 'taskReminders';
    const id = taskNotificationId(task, kind);
    const [pending, delivered] = isNative() ? await Promise.all([
      LocalNotifications.getPending(), LocalNotifications.getDeliveredNotifications(),
    ]) : [{ notifications: [] }, { notifications: [] }];
    const now = new Date();
    const planned = buildTaskNotificationPlan(task, { ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences }, now);
    const plannedNotifications = planned.map(item => {
      const notificationId = taskNotificationId(task, item.kind);
      const pendingNotification = pending.notifications.find(entry => entry.id === notificationId);
      return {
        kind: item.kind,
        scheduledLocalTime: item.at.toLocaleString(),
        scheduledUtcTime: item.at.toISOString(),
        notificationId,
        inAndroidPendingQueue: Boolean(pendingNotification && pendingTimeMatches(pendingNotification.schedule?.at, item.at)),
      };
    });
    const taskPlan = planned.find(item => item.kind === kind);
    const pendingItem = pending.notifications.find(item => item.id === id);
    const visibleItem = delivered.notifications.find(item => Number(item.id) === id);
    const selectedReminderAt = task.reminderAt ? new Date(task.reminderAt) : null;
    let lifecycle = readReminderLifecycle()[String(id)] || null;
    if (visibleItem && task.reminderAt) {
      updateReminderLifecycle(id, { kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
        deliveryState: 'active-observed', deliveryObservedAt: new Date().toISOString() });
      lifecycle = readReminderLifecycle()[String(id)] || lifecycle;
    } else if (pendingItem && task.reminderAt) {
      updateReminderLifecycle(id, { kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
        deliveryState: 'pending-observed', pendingObservedAt: new Date().toISOString() });
      lifecycle = readReminderLifecycle()[String(id)] || lifecycle;
    } else if (task.reminderAt && lifecycle?.nativeAcceptedAt && selectedReminderAt && selectedReminderAt <= now) {
      updateReminderLifecycle(id, { kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
        deliveryState: 'delivery-unconfirmed' });
      lifecycle = readReminderLifecycle()[String(id)] || lifecycle;
    }
    const pendingMatchesPlan = Boolean(pendingItem && taskPlan && pendingTimeMatches(pendingItem.schedule?.at, taskPlan.at));
    const persistedOriginalAt = pendingItem?.extra?.originalReminderAt
      ? asDate(pendingItem.extra.originalReminderAt)
      : pendingItem?.schedule?.at ? asDate(pendingItem.schedule.at) : null;
    const latePending = Boolean(pendingItem && selectedReminderAt && !Number.isNaN(selectedReminderAt.getTime()) &&
      selectedReminderAt <= now && pendingTimeMatches(persistedOriginalAt, selectedReminderAt));
    let cancellationReason = '';
    if (task.completed) cancellationReason = 'task-completed';
    else if (!task.reminderAt) cancellationReason = 'reminder-not-configured';
    else if (!preferences.taskReminders) cancellationReason = 'category-disabled';
    else if (permission !== 'granted') cancellationReason = `permission-${permission}`;
    else if (visibleItem || latePending) cancellationReason = '';
    else if (!taskPlan) cancellationReason = selectedReminderAt && !Number.isNaN(selectedReminderAt.getTime()) && selectedReminderAt <= now
      ? 'reminder-time-passed;delivery-not-observable' : 'invalid-reminder-time';
    else if (pendingItem && !pendingMatchesPlan) cancellationReason = 'pending-time-mismatch';
    else if (!pendingItem) cancellationReason = 'not-present-in-android-pending-queue';
    const dueAt = task.dueTime ? localDateTime(task.dueDate, task.dueTime) : null;
    const record = readDiagnosticRecord();
    const exactAlarm = await this.checkExactAlarmPermission();
    return {
      taskReference: task.id,
      eligible: Boolean((taskPlan || latePending || visibleItem) && permission === 'granted' && preferences.taskReminders && !task.completed),
      schedulingState: visibleItem ? 'currently-visible-in-android-shade' : latePending
        ? pendingItem?.extra?.lateCatchUp === true ? 'late-catch-up-pending' : 'past-time-still-persisted;delivery-unconfirmed'
        : taskPlan ? 'scheduled-for-future' : 'not-scheduled',
      deliveryEvidence: visibleItem ? 'currently-visible' : pendingItem ? 'pending-store-only' : 'unknown-no-active-or-pending-record',
      lifecycleEvidence: lifecycle ? {
        configuredAt: lifecycle.configuredAt,
        reminderAt: lifecycle.reminderAt,
        scheduleMode: lifecycle.scheduleMode,
        scheduleRequestedAt: lifecycle.scheduleRequestedAt,
        nativeAcceptedAt: lifecycle.nativeAcceptedAt,
        pendingObservedAt: lifecycle.pendingObservedAt,
        deliveryState: visibleItem ? 'active-observed' : pendingItem ? 'pending-observed' : lifecycle.deliveryState,
        deliveryObservedAt: lifecycle.deliveryObservedAt,
        receiverEventAt: lifecycle.receiverEventAt,
        tappedAt: lifecycle.tappedAt,
        cancellationAt: lifecycle.cancellationAt,
        cancellationReason: lifecycle.cancellationReason,
        deliveryUnconfirmed: Boolean(!visibleItem && !pendingItem && lifecycle.nativeAcceptedAt !== null && selectedReminderAt && selectedReminderAt <= now),
      } : null,
      scheduledLocalTime: selectedReminderAt && !Number.isNaN(selectedReminderAt.getTime()) ? selectedReminderAt.toLocaleString() : null,
      scheduledUtcTime: formatDateForDiagnostic(selectedReminderAt),
      pendingScheduledLocalTime: pendingItem?.schedule?.at ? asDate(pendingItem.schedule.at).toLocaleString() : null,
      pendingScheduledUtcTime: pendingItem?.schedule?.at ? formatDateForDiagnostic(asDate(pendingItem.schedule.at)) : null,
      dueLocalTime: dueAt?.toLocaleString() || (task.dueDate && !task.dueTime ? 'date-only; no time assigned' : null),
      dueUtcTime: formatDateForDiagnostic(dueAt),
      categoryEnabled: preferences.taskReminders,
      androidPermission: permission,
      notificationId: id,
      schedulingResult: visibleItem ? 'currently-visible-in-android-shade' : latePending ? 'late-delivery-pending' : pendingMatchesPlan ? 'pending' : taskPlan && permission === 'granted' && preferences.taskReminders && !task.completed
        ? taskScheduleStatus.get(task.id) || 'not-present-in-android-pending-queue'
        : 'not-scheduled',
      pendingNotificationId: pendingMatchesPlan || latePending ? pendingItem?.id ?? null : null,
      pendingTimestampMatches: pendingMatchesPlan || latePending,
      visibleInNotificationShade: Boolean(visibleItem),
      exactAlarm,
      deliveryTiming: exactAlarm === 'granted' ? 'exact-capability-available' : 'inexact-approximate; Android may defer during idle or device power management',
      cancellationReason: lifecycle?.cancellationReason || cancellationReason || (visibleItem || latePending ? null : record.lastCancellationReason) || null,
      lastScheduleAttempt: record.lastScheduleAttempt || null,
      lastScheduleResult: record.lastScheduleResult || 'unknown',
      plannedNotifications,
    };
  },

  async addActionListener(listener: (action: { notification: { id: number; extra?: Record<string, unknown> } }) => void) {
    if (!requireNativeNotifications()) return { remove: async () => {} };
    return LocalNotifications.addListener('localNotificationActionPerformed', action => {
      const kind = typeof action.notification.extra?.kind === 'string' ? action.notification.extra.kind : 'unknown';
      if (kind === 'taskReminders' && action.notification.extra?.originalReminderAt) {
        updateReminderLifecycle(action.notification.id, {
          kind: 'taskReminders', reminderAt: String(action.notification.extra.originalReminderAt),
          deliveryState: 'tapped', tappedAt: new Date().toISOString(),
        });
      }
      updateDiagnostics({ lastActionEvent: { at: new Date().toISOString(), kind, id: action.notification.id } });
      listener(action);
    });
  },

  async addReceivedListener(listener: (notification: { id: number; extra?: Record<string, unknown> }) => void) {
    if (!requireNativeNotifications()) return { remove: async () => {} };
    return LocalNotifications.addListener('localNotificationReceived', notification => {
      const kind = typeof notification.extra?.kind === 'string' ? notification.extra.kind : 'unknown';
      if (kind === 'taskReminders' && notification.extra?.originalReminderAt) {
        updateReminderLifecycle(notification.id, {
          kind: 'taskReminders', reminderAt: String(notification.extra.originalReminderAt),
          deliveryState: 'native-receiver-event-observed', receiverEventAt: new Date().toISOString(),
        });
      }
      listener(notification);
    });
  },

  async getInitialTapAction() {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('NotificationTapLaunch')) return null;
    const result = await NativeNotificationTapLaunch.getInitialAction();
    const action = result.action?.notification && typeof result.action.notification.id === 'number'
      ? { notification: { id: result.action.notification.id, extra: result.action.notification.extra } }
      : null;
    if (action) {
      const kind = String(action.notification.extra?.kind || 'unknown');
      if (kind === 'taskReminders' && action.notification.extra?.originalReminderAt) {
        updateReminderLifecycle(action.notification.id, {
          kind: 'taskReminders', reminderAt: String(action.notification.extra.originalReminderAt),
          deliveryState: 'tapped', tappedAt: new Date().toISOString(),
        });
      }
      updateDiagnostics({ lastActionEvent: { at: new Date().toISOString(), kind, id: action.notification.id } });
    }
    return action;
  },

  async acknowledgeInitialTapAction(id: number) {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('NotificationTapLaunch')) return;
    await NativeNotificationTapLaunch.acknowledgeInitialAction({ id });
  },

  async cancelTask(task: Task) {
    try {
      await cancelIds(['taskReminders', 'upcomingDeadlines', 'overdueAlerts'].map(kind => taskNotificationId(task, kind)));
      if (task.reminderAt) updateReminderLifecycle(taskNotificationId(task, 'taskReminders'), {
        kind: 'taskReminders', configuredAt: task.createdAt || null, reminderAt: task.reminderAt,
        deliveryState: 'cancelled', cancellationAt: new Date().toISOString(), cancellationReason: 'task-deleted',
      });
      updateDiagnostics({ lastCancellationReason: 'task-deleted' });
    } catch (error) { writeLastError(safeErrorCode(error)); console.warn('LifeOS task notification cancellation failed.'); throw error; }
  },

  async syncHabits(habits: Habit[], preferences: NotificationPreferences) {
    if (!requireNativeNotifications()) return;
    try {
    await this.ensureChannel();
    const weekdays = [Weekday.Sunday, Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday, Weekday.Thursday, Weekday.Friday, Weekday.Saturday];
    const entries = habits.filter(habit => habit.reminderTime).flatMap(habit => {
      const [hour, minute] = (habit.reminderTime || '').split(':').map(Number);
      const days = habit.frequency === 'weekdays' ? weekdays.slice(1, 6)
        : habit.frequency === 'weekends' ? [Weekday.Saturday, Weekday.Sunday]
          : habit.frequency === 'weekly' ? [habit.reminderWeekday || Weekday.Monday] : weekdays;
      return days.map(weekday => ({ habit, hour, minute, weekday }));
    });
    await cancelPendingKinds(['habitReminder']);
    await cancelIds(habits.flatMap(habit => [1, 2, 3, 4, 5, 6, 7].map(day => notificationId(`habit:${habit.id}:${day}`))));
    if (!preferences.habitReminders || !(await this.canScheduleNotifications())) { if (preferences.habitReminders) writeLastError('permission-denied-or-revoked'); return; }
    await schedule(entries.map(({ habit, hour, minute, weekday }) => ({
      id: notificationId(`habit:${habit.id}:${weekday}`),
      title: 'Habit reminder', body: `Time for: ${habit.name}`,
      schedule: { on: { weekday, hour, minute }, allowWhileIdle: false },
      channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
      extra: { kind: 'habitReminder', habitId: habit.id },
    })));
    } catch (error) { writeLastError(safeErrorCode(error)); console.warn('LifeOS habit notification scheduling failed.'); throw error; }
  },

  async cancelHabit(habit: Habit) {
    const ids = [1, 2, 3, 4, 5, 6, 7].map(day => notificationId(`habit:${habit.id}:${day}`));
    try { await cancelIds(ids); }
    catch (error) { writeLastError(safeErrorCode(error)); console.warn('LifeOS habit notification cancellation failed.'); throw error; }
  },

  async syncMilestones(goals: Goal[], milestones: Milestone[], preferences: NotificationPreferences) {
    if (!requireNativeNotifications()) return;
    try {
    await this.ensureChannel();
    await cancelPendingKinds(['milestoneReminder']);
    const completedGoalIds = new Set(goals.filter(goal => goal.status === 'Completed').map(goal => goal.id));
    const activeMilestones = milestones.filter(milestone => !milestone.completed && milestone.targetDate && !completedGoalIds.has(milestone.goalId));
    const ids = milestones.map(milestone => notificationId(`milestone:${milestone.id}`));
    await cancelIds(ids);
    if (!preferences.milestoneReminders || !(await this.canScheduleNotifications())) { if (preferences.milestoneReminders) writeLastError('permission-denied-or-revoked'); return; }
    const goalById = new Map(goals.map(goal => [goal.id, goal]));
    const now = new Date();
    const notifications = activeMilestones.flatMap(milestone => {
      const goal = goalById.get(milestone.goalId);
      const at = milestone.targetDate ? localDateTime(milestone.targetDate, '09:00') : null;
      if (!at || at <= now) return [];
      return [{
        id: notificationId(`milestone:${milestone.id}`),
        title: 'Goal milestone', body: `${milestone.title}${goal ? ` · ${goal.title}` : ''}`,
        schedule: { at, allowWhileIdle: false }, channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
        extra: { kind: 'milestoneReminder', milestoneId: milestone.id },
      }];
    });
    await schedule(notifications);
    } catch (error) { writeLastError(safeErrorCode(error)); console.warn('LifeOS milestone notification scheduling failed.'); throw error; }
  },

  async cancelMilestones(milestones: Milestone[]) {
    try { await cancelIds(milestones.map(milestone => notificationId(`milestone:${milestone.id}`))); }
    catch (error) { writeLastError(safeErrorCode(error)); console.warn('LifeOS milestone notification cancellation failed.'); throw error; }
  },

  async ensureChannel() {
    if (!requireNativeNotifications()) return;
    if (!ensureChannelPromise) ensureChannelPromise = LocalNotifications.createChannel({ id: 'lifeos-reminders', name: 'LifeOS reminders', description: 'Local task, habit and goal reminders', importance: 4, visibility: 0 })
      .catch(error => { ensureChannelPromise = null; writeLastError(safeErrorCode(error)); console.warn('LifeOS notification channel creation failed.'); throw error; });
    const pending = ensureChannelPromise;
    try { await pending; }
    finally { if (ensureChannelPromise === pending) ensureChannelPromise = null; }
  },

  async getDiagnostics(): Promise<NotificationDiagnostics> {
    const platform = Capacitor.getPlatform();
    const record = readDiagnosticRecord();
    const empty: NotificationDiagnostics = {
      capability: 'unavailable', platform, supported: false, permission: 'unknown', appNotifications: 'unknown',
      exactAlarm: 'unknown', channel: 'unknown', pendingCount: 0, visibleNotificationCount: 0,
      visibleNotificationIds: [], batteryOptimizationExempt: null, androidApi: null, packageName: null,
      versionName: null, versionCode: null, build: LIFEOS_BUILD_INFO, lastScheduleAttempt: record.lastScheduleAttempt || null,
      lastScheduleResult: record.lastScheduleResult || 'unknown', lastCancellationReason: record.lastCancellationReason || null,
      lastActionEvent: record.lastActionEvent || null, lastError: record.lastError || '',
    };
    if (!Capacitor.isNativePlatform()) return { ...empty, capability: 'unavailable', permission: 'unsupported', exactAlarm: 'unsupported', channel: 'not-applicable' };
    // Capacitor exposes registered native plugins synchronously. Probe a few
    // bounded times because this service can be requested during first React
    // render before the bridge finishes attaching its plugin proxies.
    let pluginAvailable = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      pluginAvailable = Capacitor.isPluginAvailable('LocalNotifications');
      if (pluginAvailable) break;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!pluginAvailable) return { ...empty, capability: 'unavailable', permission: 'unknown', exactAlarm: 'unknown', channel: 'unknown', lastError: 'local-notifications-plugin-not-registered' };
    try {
      const [permissionValue, exactAlarmValue, channels, pending, delivered, enabled] = await Promise.all([
        withTimeout(this.checkPermission(), 'permission-check'),
        withTimeout(this.checkExactAlarmPermission(), 'exact-alarm-check'),
        withTimeout(LocalNotifications.listChannels(), 'channel-check'),
        withTimeout(LocalNotifications.getPending(), 'pending-check'),
        withTimeout(LocalNotifications.getDeliveredNotifications(), 'delivered-check'),
        withTimeout(LocalNotifications.areEnabled(), 'app-notification-check'),
      ] as const);
      const permission = String(permissionValue);
      const exactAlarm = String(exactAlarmValue);
      let runtime: { androidApi: number; packageName: string; versionName: string; versionCode: number; batteryOptimizationExempt?: boolean | null } | null = null;
      if (Capacitor.isPluginAvailable('LifeOSRuntimeInfo')) {
        try { runtime = await withTimeout(NativeRuntimeInfo.getInfo(), 'runtime-info'); } catch { /* Runtime facts are optional; notification availability is probed independently. */ }
      }
      const channel = channels.channels.find(item => item.id === 'lifeos-reminders');
      return {
        ...empty, capability: 'available', platform, supported: true, permission,
        appNotifications: enabled.value ? 'enabled' : 'disabled', exactAlarm,
        channel: channel ? Number(channel.importance) === 0 ? 'blocked (importance 0)' : `available (importance ${channel.importance ?? 'unknown'})` : 'not created',
        pendingCount: pending.notifications.length,
        visibleNotificationCount: delivered.notifications.length,
        visibleNotificationIds: delivered.notifications.map(item => Number(item.id)).filter(Number.isInteger),
        batteryOptimizationExempt: runtime?.batteryOptimizationExempt ?? null,
        androidApi: runtime?.androidApi ?? null, packageName: runtime?.packageName ?? null,
        versionName: runtime?.versionName ?? null, versionCode: runtime?.versionCode ?? null,
        lastError: record.lastError || '',
      };
    } catch (error) {
      const code = safeErrorCode(error);
      writeLastError(code);
      return { ...empty, capability: 'error', platform, supported: true, permission: 'error', exactAlarm: 'error', channel: 'unknown', lastError: code };
    }
  },

  async testNotification(delayMs = 10_000) {
    if (!isNative()) throw new Error('Local notifications are available only in the installed Android app.');
    const permission = await this.checkPermission();
    if (permission !== 'granted') throw new Error(`Android notification permission is ${permission}. Allow notifications in Android settings.`);
    try {
      await this.ensureChannel();
      await cancelIds([testId]);
      const at = new Date(Date.now() + Math.max(1_000, delayMs));
      await schedule([{ id: testId, title: 'LifeOS test notification', body: 'Local notifications are reaching your device.', schedule: { at, allowWhileIdle: true }, channelId: 'lifeos-reminders', smallIcon: 'ic_transparent', extra: { kind: 'test' } }]);
      const pending = await LocalNotifications.getPending();
      if (!pending.notifications.some(item => item.id === testId)) throw new Error('schedule-verification-missing:test-notification');
      writeLastError('');
      return at;
    } catch (error) { writeLastError(safeErrorCode(error)); console.warn('LifeOS test notification failed.'); throw error; }
  },

  async sendImmediateTestNotification() {
    return this.testNotification(1_000);
  },

  async openSettings() {
    if (!Capacitor.isNativePlatform()) throw new Error('Android app settings are only available in the installed app.');
    await NativeNotificationSettings.open();
  },
};
