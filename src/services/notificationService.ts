import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications, Weekday, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { buildTaskNotificationPlan, stableNotificationId } from './domainUtils';
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
const NativeNotificationSettings = registerPlugin<{ open(): Promise<void> }>('NotificationSettings');
const diagnosticKey = 'lifeos.notificationDiagnostics';
let ensureChannelPromise: Promise<void> | null = null;

export interface NotificationDiagnostics {
  supported: boolean;
  permission: string;
  exactAlarm: string;
  channel: string;
  pendingCount: number;
  lastError: string;
}

function readLastError() {
  try { return localStorage.getItem(diagnosticKey) || ''; } catch { return ''; }
}
function writeLastError(error: string) {
  try { if (error) localStorage.setItem(diagnosticKey, error); else localStorage.removeItem(diagnosticKey); } catch { /* Diagnostics are best-effort when storage is unavailable. */ }
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }

function localDateTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

async function cancelIds(ids: number[]) {
  if (!isNative() || !ids.length) return;
  await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
}

async function schedule(notifications: LocalNotificationSchema[]) {
  if (!isNative() || !notifications.length) return;
  await LocalNotifications.schedule({ notifications });
}

// Match only reminder kinds owned by this app; retain unrelated pending entries.
async function cancelPendingKinds(kinds: string[]) {
  if (!isNative()) return;
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
    if (!isNative()) return;
    try {
      await this.ensureChannel();
      if (!(await this.canScheduleNotifications())) {
        writeLastError('permission-denied-or-revoked');
        return;
      }
      const pending = await LocalNotifications.getPending();
      const taskKinds = new Set(['taskReminders', 'upcomingDeadlines', 'overdueAlerts']);
      const oldTaskNotifications = pending.notifications.filter(item => taskKinds.has(String(item.extra?.kind || '')));
      await cancelIds(oldTaskNotifications.map(item => item.id));

      const labels: Record<string, string> = {
        taskReminders: 'Task reminder', upcomingDeadlines: 'Upcoming deadline', overdueAlerts: 'Task overdue',
      };
      const now = new Date();
      const notifications = tasks.flatMap(task => buildTaskNotificationPlan(task, preferences, now).map(plan => ({
        id: taskNotificationId(task, plan.kind), title: labels[plan.kind] || 'LifeOS reminder', body: 'Unlock LifeOS to view your reminder.',
        schedule: { at: plan.at, allowWhileIdle: true }, channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
        extra: { kind: plan.kind, taskId: task.id },
      })));
      if (notifications.length) {
        await schedule(notifications);
        const after = await LocalNotifications.getPending();
        const scheduledIds = new Set(after.notifications.map(item => item.id));
        const missing = notifications.filter(item => !scheduledIds.has(item.id));
        if (missing.length) throw new Error(`schedule-verification-missing:${missing.length}`);
      }
      writeLastError('');
    } catch (error) {
      writeLastError(errorMessage(error));
      console.error('LifeOS task notification scheduling failed:', error);
      throw error;
    }
  },

  async diagnoseTaskReminder(task: Task, preferences: NotificationPreferences) {
    const permission = await this.checkPermission();
    const kind = 'taskReminders';
    const id = taskNotificationId(task, kind);
    const pending = isNative() ? await LocalNotifications.getPending() : { notifications: [] };
    const planned = buildTaskNotificationPlan(task, { ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences }, new Date());
    const taskPlan = planned.find(item => item.kind === kind);
    const pendingItem = pending.notifications.find(item => item.id === id);
    let cancellationReason = '';
    if (task.completed) cancellationReason = 'task-completed';
    else if (!task.reminderAt) cancellationReason = 'reminder-not-configured';
    else if (!preferences.taskReminders) cancellationReason = 'category-disabled';
    else if (permission !== 'granted') cancellationReason = `permission-${permission}`;
    else if (!taskPlan) cancellationReason = 'invalid-or-past-reminder-time';
    else if (!pendingItem) cancellationReason = 'not-present-in-android-pending-queue';
    return {
      taskReference: task.id,
      eligible: Boolean(taskPlan && permission === 'granted' && preferences.taskReminders && !task.completed),
      scheduledLocalTime: taskPlan?.at.toLocaleString() || null,
      categoryEnabled: preferences.taskReminders,
      androidPermission: permission,
      schedulingResult: pendingItem ? 'pending' : cancellationReason ? 'not-scheduled' : 'unknown',
      pendingNotificationId: pendingItem?.id ?? null,
      cancellationReason: cancellationReason || null,
      exactAlarm: await this.checkExactAlarmPermission(),
    };
  },

  async addActionListener(listener: (action: { notification: { id: number; extra?: Record<string, unknown> } }) => void) {
    if (!isNative()) return { remove: async () => {} };
    return LocalNotifications.addListener('localNotificationActionPerformed', listener);
  },

  async cancelTask(task: Task) {
    try { await cancelIds(['taskReminders', 'upcomingDeadlines', 'overdueAlerts'].map(kind => taskNotificationId(task, kind))); }
    catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS task notification cancellation failed:', error); throw error; }
  },

  async syncHabits(habits: Habit[], preferences: NotificationPreferences) {
    if (!isNative()) return;
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
    } catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS habit notification scheduling failed:', error); throw error; }
  },

  async cancelHabit(habit: Habit) {
    const ids = [1, 2, 3, 4, 5, 6, 7].map(day => notificationId(`habit:${habit.id}:${day}`));
    try { await cancelIds(ids); }
    catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS habit notification cancellation failed:', error); throw error; }
  },

  async syncMilestones(goals: Goal[], milestones: Milestone[], preferences: NotificationPreferences) {
    if (!isNative()) return;
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
    } catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS milestone notification scheduling failed:', error); throw error; }
  },

  async cancelMilestones(milestones: Milestone[]) {
    try { await cancelIds(milestones.map(milestone => notificationId(`milestone:${milestone.id}`))); }
    catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS milestone notification cancellation failed:', error); throw error; }
  },

  async ensureChannel() {
    if (!isNative()) return;
    if (!ensureChannelPromise) ensureChannelPromise = LocalNotifications.createChannel({ id: 'lifeos-reminders', name: 'LifeOS reminders', description: 'Local task, habit and goal reminders', importance: 4, visibility: 0 })
      .catch(error => { ensureChannelPromise = null; writeLastError(errorMessage(error)); console.error('LifeOS notification channel creation failed:', error); throw error; });
    const pending = ensureChannelPromise;
    try { await pending; }
    finally { if (ensureChannelPromise === pending) ensureChannelPromise = null; }
  },

  async getDiagnostics(): Promise<NotificationDiagnostics> {
    if (!isNative()) return { supported: false, permission: 'unsupported', exactAlarm: 'unsupported', channel: 'unavailable', pendingCount: 0, lastError: readLastError() };
    try {
      const [permission, exactAlarm, channels, pending] = await Promise.all([
        this.checkPermission(),
        this.checkExactAlarmPermission(),
        LocalNotifications.listChannels(),
        LocalNotifications.getPending()
      ]);
      const channel = channels.channels.find(item => item.id === 'lifeos-reminders');
      return {
        supported: true, permission, exactAlarm,
        channel: channel ? Number(channel.importance) === 0 ? 'blocked (importance 0)' : `available (importance ${channel.importance ?? 'unknown'})` : 'not created',
        pendingCount: pending.notifications.length, lastError: readLastError(),
      };
    } catch (error) {
      writeLastError(errorMessage(error));
      return { supported: true, permission: 'error', exactAlarm: 'error', channel: 'unavailable', pendingCount: 0, lastError: errorMessage(error) };
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
    } catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS test notification failed:', error); throw error; }
  },

  async sendImmediateTestNotification() {
    return this.testNotification(1_000);
  },

  async openSettings() {
    if (!Capacitor.isNativePlatform()) throw new Error('Android app settings are only available in the installed app.');
    await NativeNotificationSettings.open();
  },
};
