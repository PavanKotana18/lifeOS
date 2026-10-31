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
const lastSyncKey = 'lifeos.notificationLastSync';
let ensureChannelPromise: Promise<void> | null = null;

export interface NotificationDiagnostics {
  supported: boolean;
  permission: string;
  channel: string;
  pendingCount: number;
  lastError: string;
  lastSyncTime: string;
  exactAlarmStatus: string;
  scheduledItems?: Array<{ id: number; timestamp?: string; kind: string }>;
}

function readLastError() {
  try { return localStorage.getItem(diagnosticKey) || ''; } catch { return ''; }
}
function writeLastError(error: string) {
  try { if (error) localStorage.setItem(diagnosticKey, error); else localStorage.removeItem(diagnosticKey); } catch { /* Diagnostics are best-effort when storage is unavailable. */ }
}
function readLastSync() {
  try { return localStorage.getItem(lastSyncKey) || ''; } catch { return ''; }
}
function writeLastSync(iso = new Date().toISOString()) {
  try { localStorage.setItem(lastSyncKey, iso); } catch { /* best-effort */ }
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
  try {
    await LocalNotifications.schedule({ notifications });
  } catch (error) {
    const msg = errorMessage(error).toLowerCase();
    // Handle devices/users where exact alarm permission (SCHEDULE_EXACT_ALARM)
    // is restricted or revoked in Android settings: fallback to inexact timing
    if (msg.includes('exact') || msg.includes('alarm') || msg.includes('security')) {
      console.warn('Exact alarm scheduling disallowed; falling back to battery-saving inexact timing:', error);
      const fallback = notifications.map(n => ({
        ...n,
        schedule: n.schedule ? { ...n.schedule, allowWhileIdle: false } : undefined,
      }));
      await LocalNotifications.schedule({ notifications: fallback });
      writeLastError('Exact alarm access revoked/restricted; notifications scheduled with inexact timing.');
      return;
    }
    throw error;
  }
}

export const NotificationService = {
  isSupported: isNative,

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

  async syncTasks(tasks: Task[], preferences: NotificationPreferences, isAuthorized?: () => boolean) {
    if (!isNative()) return;
    try {
      await this.ensureChannel();
      if (isAuthorized && !isAuthorized()) return;
      const pending = await LocalNotifications.getPending();
      const taskKinds = new Set(['taskReminders', 'upcomingDeadlines', 'overdueAlerts']);
      const oldTaskNotifications = pending.notifications.filter(item => taskKinds.has(String(item.extra?.kind || '')));
      await cancelIds(oldTaskNotifications.map(item => item.id));
      if (await this.checkPermission() !== 'granted') return;
      if (isAuthorized && !isAuthorized()) return;

      const labels: Record<string, string> = {
        taskReminders: 'Task reminder', upcomingDeadlines: 'Upcoming deadline', overdueAlerts: 'Task overdue',
      };
      const now = new Date();
      const notifications = tasks.flatMap(task => buildTaskNotificationPlan(task, preferences, now).map(plan => ({
        id: taskNotificationId(task, plan.kind), title: labels[plan.kind] || 'LifeOS reminder', body: task.title,
        schedule: { at: plan.at, allowWhileIdle: true }, channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
        extra: { kind: plan.kind, taskId: task.id },
      })));
      if (isAuthorized && !isAuthorized()) return;
      if (notifications.length) {
        await schedule(notifications);
        if (isAuthorized && !isAuthorized()) {
          await cancelIds(notifications.map(item => item.id));
          return;
        }
      }
      writeLastError('');
      writeLastSync();
    } catch (error) {
      writeLastError(errorMessage(error));
      console.error('LifeOS task notification scheduling failed:', error);
      throw error;
    }
  },

  async cancelTask(task: Task) {
    try { await cancelIds(['taskReminders', 'upcomingDeadlines', 'overdueAlerts'].map(kind => taskNotificationId(task, kind))); }
    catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS task notification cancellation failed:', error); throw error; }
  },

  async syncHabits(habits: Habit[], preferences: NotificationPreferences, isAuthorized?: () => boolean) {
    if (!isNative()) return;
    try {
    await this.ensureChannel();
    if (isAuthorized && !isAuthorized()) return;
    const weekdays = [Weekday.Sunday, Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday, Weekday.Thursday, Weekday.Friday, Weekday.Saturday];
    const entries = habits.filter(habit => habit.reminderTime).flatMap(habit => {
      const [hour, minute] = (habit.reminderTime || '').split(':').map(Number);
      const days = habit.frequency === 'weekdays' ? weekdays.slice(1, 6)
        : habit.frequency === 'weekends' ? [Weekday.Saturday, Weekday.Sunday]
          : habit.frequency === 'weekly' ? [habit.reminderWeekday || Weekday.Monday] : weekdays;
      return days.map(weekday => ({ habit, hour, minute, weekday }));
    });
    await cancelIds(habits.flatMap(habit => [1, 2, 3, 4, 5, 6, 7].map(day => notificationId(`habit:${habit.id}:${day}`))));
    if (!preferences.habitReminders || await this.checkPermission() !== 'granted') return;
    if (isAuthorized && !isAuthorized()) return;
    const habitNotifications = entries.map(({ habit, hour, minute, weekday }) => ({
      id: notificationId(`habit:${habit.id}:${weekday}`),
      title: 'Habit reminder', body: `Time for: ${habit.name}`,
      schedule: { on: { weekday, hour, minute }, allowWhileIdle: true },
      channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
      extra: { kind: 'habitReminder', habitId: habit.id },
    }));
    if (habitNotifications.length) {
      await schedule(habitNotifications);
      if (isAuthorized && !isAuthorized()) {
        await cancelIds(habitNotifications.map(item => item.id));
        return;
      }
    }
    writeLastSync();
    } catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS habit notification scheduling failed:', error); throw error; }
  },

  async cancelHabit(habit: Habit) {
    const ids = [1, 2, 3, 4, 5, 6, 7].map(day => notificationId(`habit:${habit.id}:${day}`));
    try { await cancelIds(ids); }
    catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS habit notification cancellation failed:', error); throw error; }
  },

  async syncMilestones(goals: Goal[], milestones: Milestone[], preferences: NotificationPreferences, isAuthorized?: () => boolean) {
    if (!isNative()) return;
    try {
    await this.ensureChannel();
    if (isAuthorized && !isAuthorized()) return;
    const completedGoalIds = new Set(goals.filter(goal => goal.status === 'Completed').map(goal => goal.id));
    const activeMilestones = milestones.filter(milestone => !milestone.completed && milestone.targetDate && !completedGoalIds.has(milestone.goalId));
    const ids = milestones.map(milestone => notificationId(`milestone:${milestone.id}`));
    await cancelIds(ids);
    if (!preferences.milestoneReminders || await this.checkPermission() !== 'granted') return;
    if (isAuthorized && !isAuthorized()) return;
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
    if (isAuthorized && !isAuthorized()) return;
    if (notifications.length) {
      await schedule(notifications);
      if (isAuthorized && !isAuthorized()) {
        await cancelIds(notifications.map(item => item.id));
        return;
      }
    }
    writeLastSync();
    } catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS milestone notification scheduling failed:', error); throw error; }
  },

  async cancelMilestones(milestones: Milestone[]) {
    try { await cancelIds(milestones.map(milestone => notificationId(`milestone:${milestone.id}`))); }
    catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS milestone notification cancellation failed:', error); throw error; }
  },

  async sanitizePendingNotifications() {
    if (!isNative()) return;
    try {
      const pending = await LocalNotifications.getPending();
      const sensitiveKinds = new Set([
        'taskReminders', 'taskReminder',
        'upcomingDeadlines', 'upcomingDeadline',
        'overdueAlerts', 'overdueAlert',
        'habitReminders', 'habitReminder',
        'milestoneReminders', 'milestoneReminder'
      ]);
      const toSanitize = pending.notifications.filter(item => sensitiveKinds.has(String(item.extra?.kind || '')));
      if (toSanitize.length) {
        // Redact titles and descriptions to ensure privacy on lock
        const sanitized = toSanitize.map(item => ({
          ...item,
          title: 'LifeOS reminder',
          body: 'You have a scheduled reminder (unlock to view details)',
          schedule: item.schedule ? { ...item.schedule, allowWhileIdle: true } : undefined,
        }));
        await schedule(sanitized as LocalNotificationSchema[]);
      }
    } catch (error) {
      writeLastError(errorMessage(error));
      console.warn('LifeOS could not sanitize pending notifications on lock:', error);
    }
  },

  async cancelPendingNotifications() {
    if (!isNative()) return;
    try {
      const pending = await LocalNotifications.getPending();
      const sensitiveKinds = new Set([
        'taskReminders', 'taskReminder',
        'upcomingDeadlines', 'upcomingDeadline',
        'overdueAlerts', 'overdueAlert',
        'habitReminders', 'habitReminder',
        'milestoneReminders', 'milestoneReminder'
      ]);
      const sensitiveNotifications = pending.notifications.filter(item => sensitiveKinds.has(String(item.extra?.kind || '')));
      if (sensitiveNotifications.length) {
        await cancelIds(sensitiveNotifications.map(item => item.id));
      }
    } catch (error) {
      writeLastError(errorMessage(error));
      console.warn('LifeOS could not cancel pending sensitive notifications on lock:', error);
    }
  },

  async ensureChannel() {
    if (!isNative()) return;
    if (!ensureChannelPromise) ensureChannelPromise = LocalNotifications.createChannel({ id: 'lifeos-reminders', name: 'LifeOS reminders', description: 'Local task, habit and goal reminders', importance: 4 })
      .catch(error => { ensureChannelPromise = null; writeLastError(errorMessage(error)); console.error('LifeOS notification channel creation failed:', error); throw error; });
    const pending = ensureChannelPromise;
    try { await pending; }
    finally { if (ensureChannelPromise === pending) ensureChannelPromise = null; }
  },

  async getDiagnostics(): Promise<NotificationDiagnostics> {
    if (!isNative()) {
      return {
        supported: false,
        permission: 'unsupported',
        channel: 'unavailable',
        pendingCount: 0,
        lastError: readLastError(),
        lastSyncTime: readLastSync(),
        exactAlarmStatus: 'unavailable',
        scheduledItems: [],
      };
    }
    try {
      const permission = await this.checkPermission();
      const [channels, pending] = await Promise.all([LocalNotifications.listChannels(), LocalNotifications.getPending()]);
      const channel = channels.channels.find(item => item.id === 'lifeos-reminders');
      // Redact sensitive task content: only record id, timestamp, kind
      const scheduledItems = pending.notifications.map(item => ({
        id: item.id,
        kind: String(item.extra?.kind || 'unknown'),
        timestamp: item.schedule?.at ? new Date(item.schedule.at).toISOString() : undefined,
      }));
      const lastErr = readLastError();
      let exactAlarmStatus = 'unavailable';
      if (permission === 'granted') {
        if (lastErr && lastErr.toLowerCase().includes('exact alarm')) {
          exactAlarmStatus = 'restricted (inexact fallback active)';
        } else {
          exactAlarmStatus = 'granted (exact alarms enabled)';
        }
      } else if (permission === 'denied') {
        exactAlarmStatus = 'blocked (notification permission denied)';
      } else {
        exactAlarmStatus = `pending (${permission})`;
      }

      return {
        supported: true,
        permission,
        channel: channel ? Number(channel.importance) === 0 ? 'blocked (importance 0)' : `available (importance ${channel.importance ?? 'unknown'})` : 'not created',
        pendingCount: pending.notifications.length,
        lastError: lastErr,
        lastSyncTime: readLastSync(),
        exactAlarmStatus,
        scheduledItems,
      };
    } catch (error) {
      writeLastError(errorMessage(error));
      return {
        supported: true,
        permission: 'error',
        channel: 'unavailable',
        pendingCount: 0,
        lastError: errorMessage(error),
        lastSyncTime: readLastSync(),
        exactAlarmStatus: 'error',
        scheduledItems: [],
      };
    }
  },

  async testNotification() {
    if (!isNative()) throw new Error('Local notifications are available only in the installed Android app.');
    const permission = await this.checkPermission();
    if (permission !== 'granted') throw new Error(`Android notification permission is ${permission}. Enable it in Android settings first.`);
    try {
      await this.ensureChannel();
      await cancelIds([testId]);
      const at = new Date(Date.now() + 10_000);
      await schedule([{ id: testId, title: 'LifeOS test notification', body: 'Local notifications are reaching your device.', schedule: { at, allowWhileIdle: true }, channelId: 'lifeos-reminders', smallIcon: 'ic_transparent', extra: { kind: 'test' } }]);
      writeLastError('');
      return at;
    } catch (error) { writeLastError(errorMessage(error)); console.error('LifeOS test notification failed:', error); throw error; }
  },

  async openSettings() {
    if (!Capacitor.isNativePlatform()) throw new Error('Android app settings are only available in the installed app.');
    await NativeNotificationSettings.open();
  },
};
