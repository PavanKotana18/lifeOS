import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Weekday, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { buildTaskNotificationPlan } from './domainUtils';
import type { Goal, Habit, Milestone, NotificationPreferences, Task } from '../types';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  taskReminders: false,
  upcomingDeadlines: false,
  overdueAlerts: false,
  habitReminders: false,
  milestoneReminders: false,
};

const notificationId = (key: string) => {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483646 + 1;
};

const taskNotificationId = (task: Task, kind: string) => notificationId(`task:${task.id}:${kind}`);
const isNative = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');

function localDateTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

async function cancelIds(ids: number[]) {
  if (!isNative() || !ids.length) return;
  try { await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) }); } catch { /* No matching scheduled notifications is harmless. */ }
}

async function schedule(notifications: LocalNotificationSchema[]) {
  if (!isNative() || !notifications.length) return;
  await LocalNotifications.schedule({ notifications });
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

  async syncTasks(tasks: Task[], preferences: NotificationPreferences) {
    if (!isNative()) return;
    const ids = tasks.flatMap(task => ['taskReminders', 'upcomingDeadlines', 'overdueAlerts'].map(kind => taskNotificationId(task, kind)));
    await cancelIds(ids);
    if (!(await this.checkPermission()).includes('granted')) return;

    const labels: Record<string, string> = {
      taskReminders: 'Task reminder', upcomingDeadlines: 'Upcoming deadline', overdueAlerts: 'Task overdue',
    };
    const notifications = tasks.flatMap(task => buildTaskNotificationPlan(task, preferences, new Date()).map(plan => ({
      id: taskNotificationId(task, plan.kind),
      title: labels[plan.kind] || 'LifeOS reminder',
      body: task.title,
      schedule: { at: plan.at, allowWhileIdle: false },
      channelId: 'lifeos-reminders',
      smallIcon: 'ic_transparent',
      extra: { kind: plan.kind, taskId: task.id },
    })));
    await schedule(notifications);
  },

  async cancelTask(task: Task) {
    await cancelIds(['taskReminders', 'upcomingDeadlines', 'overdueAlerts'].map(kind => taskNotificationId(task, kind)));
  },

  async syncHabits(habits: Habit[], preferences: NotificationPreferences) {
    if (!isNative()) return;
    const weekdays = [Weekday.Sunday, Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday, Weekday.Thursday, Weekday.Friday, Weekday.Saturday];
    const entries = habits.filter(habit => habit.reminderTime).flatMap(habit => {
      const [hour, minute] = (habit.reminderTime || '').split(':').map(Number);
      const days = habit.frequency === 'weekdays' ? weekdays.slice(1, 6)
        : habit.frequency === 'weekends' ? [Weekday.Saturday, Weekday.Sunday]
          : habit.frequency === 'weekly' ? [habit.reminderWeekday || Weekday.Monday] : weekdays;
      return days.map(weekday => ({ habit, hour, minute, weekday }));
    });
    await cancelIds(habits.flatMap(habit => [1, 2, 3, 4, 5, 6, 7].map(day => notificationId(`habit:${habit.id}:${day}`))));
    if (!preferences.habitReminders || !(await this.checkPermission()).includes('granted')) return;
    await schedule(entries.map(({ habit, hour, minute, weekday }) => ({
      id: notificationId(`habit:${habit.id}:${weekday}`),
      title: 'Habit reminder', body: `Time for: ${habit.name}`,
      schedule: { on: { weekday, hour, minute }, allowWhileIdle: false },
      channelId: 'lifeos-reminders', smallIcon: 'ic_transparent',
      extra: { kind: 'habitReminder', habitId: habit.id },
    })));
  },

  async cancelHabit(habit: Habit) {
    const ids = [1, 2, 3, 4, 5, 6, 7].map(day => notificationId(`habit:${habit.id}:${day}`));
    await cancelIds(ids);
  },

  async syncMilestones(goals: Goal[], milestones: Milestone[], preferences: NotificationPreferences) {
    if (!isNative()) return;
    const completedGoalIds = new Set(goals.filter(goal => goal.status === 'Completed').map(goal => goal.id));
    const activeMilestones = milestones.filter(milestone => !milestone.completed && milestone.targetDate && !completedGoalIds.has(milestone.goalId));
    const ids = milestones.map(milestone => notificationId(`milestone:${milestone.id}`));
    await cancelIds(ids);
    if (!preferences.milestoneReminders || !(await this.checkPermission()).includes('granted')) return;
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
  },

  async cancelMilestones(milestones: Milestone[]) {
    await cancelIds(milestones.map(milestone => notificationId(`milestone:${milestone.id}`)));
  },

  async ensureChannel() {
    if (!isNative()) return;
    await LocalNotifications.createChannel({ id: 'lifeos-reminders', name: 'LifeOS reminders', description: 'Local task, habit and goal reminders', importance: 4 });
  },
};
