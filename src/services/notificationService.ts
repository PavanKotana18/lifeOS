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
const NativeRuntimeInfo = registerPlugin<{ getInfo(): Promise<{ androidApi: number; packageName: string; versionName: string; versionCode: number }> }>('LifeOSRuntimeInfo');
const NativeNotificationSettings = registerPlugin<{ open(): Promise<void> }>('NotificationSettings');
const NativeNotificationTapLaunch = registerPlugin<{
  getInitialAction(): Promise<{ action?: { notification?: { id?: number; extra?: Record<string, unknown> } } }>;
  acknowledgeInitialAction(options: { id: number }): Promise<void>;
}>('NotificationTapLaunch');
const diagnosticKey = 'lifeos.notificationDiagnostics';
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
        writeLastError('permission-denied-or-revoked');
        updateDiagnostics({ lastScheduleResult: 'not-scheduled:permission-unavailable' });
        return;
      }
      const pending = await LocalNotifications.getPending();
      const taskKinds = new Set(['taskReminders', 'upcomingDeadlines', 'overdueAlerts']);
      const oldTaskNotifications = pending.notifications.filter(item => taskKinds.has(String(item.extra?.kind || '')));

      const labels: Record<string, string> = {
        taskReminders: 'Task reminder', upcomingDeadlines: 'Upcoming deadline', overdueAlerts: 'Task overdue',
      };
      const now = new Date();
      const notifications = tasks.flatMap(task => buildTaskNotificationPlan(task, preferences, now).map(plan => ({
        id: taskNotificationId(task, plan.kind), title: labels[plan.kind] || 'LifeOS reminder', body: 'Unlock LifeOS to view your reminder.',
        schedule: { at: plan.at, allowWhileIdle: true }, channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
        extra: { kind: plan.kind, taskId: task.id },
      })));
      const desiredIds = new Set(notifications.map(item => item.id));
      const notificationOwners = new Map<number, string>();
      for (const item of notifications) {
        const owner = `${String(item.extra?.kind)}:${String(item.extra?.taskId)}`;
        const existing = notificationOwners.get(item.id);
        if (existing && existing !== owner) throw new Error('notification-id-collision');
        notificationOwners.set(item.id, owner);
      }
      if (notifications.length) {
        // Queue the replacement set first. A failed update must not erase
        // reminders which were already queued successfully.
        await schedule(notifications);
        const after = await LocalNotifications.getPending();
        const pendingById = new Map(after.notifications.map(item => [item.id, item]));
        const missing = notifications.filter(item => {
          const pendingItem = pendingById.get(item.id);
          return !pendingItem || !pendingTimeMatches(pendingItem.schedule?.at, item.schedule.at);
        });
        if (missing.length) throw new Error(`schedule-verification-missing:${missing.length}`);
      }
      // Retire only stale LifeOS task schedules after the desired set is
      // confirmed. Serializing this operation prevents overlapping syncs from
      // cancelling each other's schedules during rapid task edits/resume.
      const stale = oldTaskNotifications.filter(item => !desiredIds.has(item.id));
      await cancelIds(stale.map(item => item.id));
      if (stale.length) updateDiagnostics({ lastCancellationReason: 'task-removed-completed-or-no-longer-eligible' });
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
    const pending = isNative() ? await LocalNotifications.getPending() : { notifications: [] };
    const planned = buildTaskNotificationPlan(task, { ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences }, new Date());
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
    const pendingMatchesPlan = Boolean(pendingItem && taskPlan && pendingTimeMatches(pendingItem.schedule?.at, taskPlan.at));
    let cancellationReason = '';
    if (task.completed) cancellationReason = 'task-completed';
    else if (!task.reminderAt) cancellationReason = 'reminder-not-configured';
    else if (!preferences.taskReminders) cancellationReason = 'category-disabled';
    else if (permission !== 'granted') cancellationReason = `permission-${permission}`;
    else if (!taskPlan) cancellationReason = 'invalid-or-past-reminder-time';
    else if (pendingItem && !pendingMatchesPlan) cancellationReason = 'pending-time-mismatch';
    else if (!pendingItem) cancellationReason = 'not-present-in-android-pending-queue';
    const dueAt = task.dueTime ? localDateTime(task.dueDate, task.dueTime) : null;
    const record = readDiagnosticRecord();
    return {
      taskReference: task.id,
      eligible: Boolean(taskPlan && permission === 'granted' && preferences.taskReminders && !task.completed),
      scheduledLocalTime: taskPlan?.at.toLocaleString() || null,
      scheduledUtcTime: formatDateForDiagnostic(taskPlan?.at),
      dueLocalTime: dueAt?.toLocaleString() || (task.dueDate && !task.dueTime ? 'date-only; no time assigned' : null),
      dueUtcTime: formatDateForDiagnostic(dueAt),
      categoryEnabled: preferences.taskReminders,
      androidPermission: permission,
      notificationId: id,
      schedulingResult: pendingMatchesPlan ? 'pending' : taskPlan && permission === 'granted' && preferences.taskReminders && !task.completed
        ? taskScheduleStatus.get(task.id) || 'not-present-in-android-pending-queue'
        : 'not-scheduled',
      pendingNotificationId: pendingMatchesPlan ? pendingItem?.id ?? null : null,
      pendingTimestampMatches: pendingMatchesPlan,
      cancellationReason: cancellationReason || record.lastCancellationReason || null,
      lastScheduleAttempt: record.lastScheduleAttempt || null,
      lastScheduleResult: record.lastScheduleResult || 'unknown',
      plannedNotifications,
      exactAlarm: await this.checkExactAlarmPermission(),
    };
  },

  async addActionListener(listener: (action: { notification: { id: number; extra?: Record<string, unknown> } }) => void) {
    if (!requireNativeNotifications()) return { remove: async () => {} };
    return LocalNotifications.addListener('localNotificationActionPerformed', action => {
      const kind = typeof action.notification.extra?.kind === 'string' ? action.notification.extra.kind : 'unknown';
      updateDiagnostics({ lastActionEvent: { at: new Date().toISOString(), kind, id: action.notification.id } });
      listener(action);
    });
  },

  async getInitialTapAction() {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('NotificationTapLaunch')) return null;
    const result = await NativeNotificationTapLaunch.getInitialAction();
    const action = result.action?.notification && typeof result.action.notification.id === 'number'
      ? { notification: { id: result.action.notification.id, extra: result.action.notification.extra } }
      : null;
    if (action) updateDiagnostics({ lastActionEvent: { at: new Date().toISOString(), kind: String(action.notification.extra?.kind || 'unknown'), id: action.notification.id } });
    return action;
  },

  async acknowledgeInitialTapAction(id: number) {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('NotificationTapLaunch')) return;
    await NativeNotificationTapLaunch.acknowledgeInitialAction({ id });
  },

  async cancelTask(task: Task) {
    try {
      await cancelIds(['taskReminders', 'upcomingDeadlines', 'overdueAlerts'].map(kind => taskNotificationId(task, kind)));
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
      schedule: { on: { weekday, hour, minute }, allowWhileIdle: true },
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
        schedule: { at, allowWhileIdle: true }, channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
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
      exactAlarm: 'unknown', channel: 'unknown', pendingCount: 0, androidApi: null, packageName: null,
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
      const [permissionValue, exactAlarmValue, channels, pending, enabled] = await Promise.all([
        withTimeout(this.checkPermission(), 'permission-check'),
        withTimeout(this.checkExactAlarmPermission(), 'exact-alarm-check'),
        withTimeout(LocalNotifications.listChannels(), 'channel-check'),
        withTimeout(LocalNotifications.getPending(), 'pending-check'),
        withTimeout(LocalNotifications.areEnabled(), 'app-notification-check'),
      ] as const);
      const permission = String(permissionValue);
      const exactAlarm = String(exactAlarmValue);
      let runtime: { androidApi: number; packageName: string; versionName: string; versionCode: number } | null = null;
      if (Capacitor.isPluginAvailable('LifeOSRuntimeInfo')) {
        try { runtime = await withTimeout(NativeRuntimeInfo.getInfo(), 'runtime-info'); } catch { /* Runtime facts are optional; notification availability is probed independently. */ }
      }
      const channel = channels.channels.find(item => item.id === 'lifeos-reminders');
      return {
        ...empty, capability: 'available', platform, supported: true, permission,
        appNotifications: enabled.value ? 'enabled' : 'disabled', exactAlarm,
        channel: channel ? Number(channel.importance) === 0 ? 'blocked (importance 0)' : `available (importance ${channel.importance ?? 'unknown'})` : 'not created',
        pendingCount: pending.notifications.length,
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
