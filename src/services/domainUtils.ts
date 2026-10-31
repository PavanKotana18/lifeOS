import type { NotificationPreferences, Task } from '../types';

export const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const formatLocalDateTime = (date: Date) => `${formatLocalDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
export function parseLocalDateTime(date: string, time = '00:00', endOfDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const [hour, minute] = endOfDay ? [23, 59] : time.split(':').map(Number);
  const result = new Date(year, month - 1, day, hour, minute, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}
export const getTaskDeadline = (task: Pick<Task, 'dueDate' | 'dueTime'>) => task.dueDate ? parseLocalDateTime(task.dueDate, task.dueTime || '00:00', !task.dueTime) : null;
export function getTaskStatus(task: Pick<Task, 'dueDate' | 'dueTime' | 'completed'>, now = new Date()): 'Pending' | 'Overdue' | 'Completed' {
  if (task.completed) return 'Completed';
  const deadline = getTaskDeadline(task);
  return deadline && now > deadline ? 'Overdue' : 'Pending';
}
export function sortTasksByDeadline<T extends Pick<Task, 'dueDate' | 'dueTime' | 'completed'>>(tasks: T[], now = new Date()): T[] {
  return [...tasks].sort((a, b) => {
    const rank = (task: T) => getTaskStatus(task, now) === 'Overdue' ? 0 : getTaskStatus(task, now) === 'Completed' ? 2 : 1;
    const statusDelta = rank(a) - rank(b);
    if (statusDelta) return statusDelta;
    return (getTaskDeadline(a)?.getTime() ?? Infinity) - (getTaskDeadline(b)?.getTime() ?? Infinity);
  });
}
export const getGoalProgress = (current: number, target: number) => target > 0 ? Math.max(0, Math.min(100, Math.round(current / target * 100))) : 0;
export function calculateWeeklyHabitRate(logs: { habitId: string; date: string; completed: boolean }[], habitId: string, today = new Date()) {
  let completed = 0;
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    if (logs.some(log => log.habitId === habitId && log.date === formatLocalDate(day) && log.completed)) completed++;
  }
  return { completed, rate: Math.round(completed / 7 * 100) };
}
export function calculateStreaks(logs: { habitId: string; date: string; completed: boolean }[], habitId: string, today: string) {
  const completedDates = new Set(logs.filter(log => log.habitId === habitId && log.completed).map(log => log.date));
  const ordinal = (date: string) => { const [year, month, day] = date.split('-').map(Number); return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000); };
  const dates = [...completedDates].sort(); let longestStreak = 0; let streak = 0; let previous = -2;
  for (const date of dates) { const day = ordinal(date); streak = day === previous + 1 ? streak + 1 : 1; longestStreak = Math.max(longestStreak, streak); previous = day; }
  const completedToday = completedDates.has(today); let check = ordinal(today) - (completedToday ? 0 : 1); let currentStreak = 0;
  while (completedDates.has(new Date(check * 86_400_000).toISOString().slice(0, 10))) { currentStreak++; check--; }
  return { currentStreak, longestStreak, completedToday };
}
export function buildFinanceEntry(localDateTime: string, savedAt = new Date()) {
  const parsed = new Date(localDateTime);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid local transaction date/time');
  return { date: formatLocalDate(parsed), occurredAt: parsed.toISOString(), createdAt: savedAt.toISOString() };
}
export function buildTaskNotificationPlan(task: Task, preferences: NotificationPreferences, now = new Date()) {
  if (task.completed) return [] as { kind: keyof NotificationPreferences; at: Date }[];
  const plan: { kind: keyof NotificationPreferences; at: Date }[] = [];
  const deadline = getTaskDeadline(task);
  const add = (kind: keyof NotificationPreferences, at: Date | null) => { if (at && !Number.isNaN(at.getTime()) && at > now) plan.push({ kind, at }); };
  if (preferences.taskReminders && task.reminderAt) add('taskReminders', new Date(task.reminderAt));
  if (deadline && preferences.upcomingDeadlines) add('upcomingDeadlines', task.dueTime ? new Date(deadline.getTime() - 60 * 60_000) : parseLocalDateTime(task.dueDate, '09:00'));
  if (deadline && preferences.overdueAlerts) add('overdueAlerts', new Date(deadline.getTime() + 60_000));
  return plan;
}
