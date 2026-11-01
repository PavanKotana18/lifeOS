import type { NotificationPreferences, Task } from '../types';
export type AppearancePreference = 'dark' | 'light' | 'system';

export const profileInitial = (name: string) => name.trim().charAt(0).toLocaleUpperCase() || '';
export const resolveAppearance = (preference: AppearancePreference, systemDark: boolean) => preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
export const shouldShowOnboarding = (completed: boolean, hasLegacyData: boolean, started = false) => started ? !completed : !completed && !hasLegacyData;
export const shouldAnimateNavigation = (prefersReducedMotion: boolean) => !prefersReducedMotion;
export function resolveBackAction(state: { appReady: boolean; onboarding: boolean; locked: boolean; dialogOpen: boolean; exitDialogOpen: boolean; taskDetailsOpen: boolean; tab: string; childViewOpen: boolean }, hasPreviousTab: boolean) {
  if (!state.appReady || state.onboarding || state.locked) return 'ignore';
  if (state.dialogOpen) return 'dismiss-dialog';
  if (state.exitDialogOpen) return 'dismiss-exit-dialog';
  if (state.taskDetailsOpen) return 'close-task-details';
  if (state.childViewOpen) return 'close-child-view';
  if (hasPreviousTab) return 'previous-tab';
  if (state.tab !== 'dashboard') return 'home';
  return 'confirm-exit';
}
type ThemeMediaQuery = {
  matches: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};
export function watchSystemTheme(media: ThemeMediaQuery, onTheme: (theme: 'dark' | 'light') => void) {
  const update = () => onTheme(media.matches ? 'dark' : 'light');
  update();
  if (media.addEventListener) media.addEventListener('change', update); else media.addListener?.(update);
  return () => { if (media.removeEventListener) media.removeEventListener('change', update); else media.removeListener?.(update); };
}
export const getTasksForDate = <T extends { dueDate?: string }>(tasks: T[], date: string) => tasks.filter(task => task.dueDate === date);
export function getMonthCalendarDays(year: number, monthIndex: number, weekStartsOnMonday = true): string[] {
  const first = new Date(year, monthIndex, 1);
  const offset = weekStartsOnMonday ? (first.getDay() + 6) % 7 : first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  const start = new Date(year, monthIndex, 1 - offset);
  return Array.from({ length: cellCount }, (_, index) => formatLocalDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)));
}
export const greetingForHour = (hour: number, name: string) => {
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const cleanName = name.trim();
  return cleanName ? `${greeting}, ${cleanName}.` : `${greeting}.`;
};
export const normalizeNotificationPermission = (status: string, wasRequested: boolean) => status === 'granted' ? 'Granted' : status === 'denied' && wasRequested ? 'Denied · open Android settings' : status === 'denied' ? 'Denied' : status === 'prompt' || status === 'prompt-with-rationale' ? 'Not requested' : status;
export const stableNotificationId = (key: string) => {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) { hash ^= key.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 2147483646 + 1;
};

export const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const formatLocalDateTime = (date: Date) => `${formatLocalDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
export function parseLocalDateTime(date: string, time = '00:00', endOfDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  if (!endOfDay && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
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
export function isHabitScheduledOnDate(
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly',
  date: string
): boolean {
  if (frequency === 'daily' || frequency === 'weekly') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const day = parsed.getUTCDay();
  return frequency === 'weekdays' ? day >= 1 && day <= 5 : day === 0 || day === 6;
}

export function calculateWeeklyHabitRate(
  logs: { habitId: string; date: string; completed: boolean }[],
  habitId: string,
  today = new Date(),
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' = 'daily'
) {
  const completedDates = new Set(
    logs.filter(log => log.habitId === habitId && log.completed).map(log => log.date)
  );

  const eligibleDates: string[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = formatLocalDate(day);
    if (isHabitScheduledOnDate(frequency, key)) eligibleDates.push(key);
  }

  if (frequency === 'weekly') {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const completed = [...completedDates].some(date => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
      const d = new Date(`${date}T00:00:00`);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    }) ? 1 : 0;
    return { completed, scheduled: 1, rate: completed ? 100 : 0 };
  }

  const completed = eligibleDates.filter(date => completedDates.has(date)).length;
  return {
    completed,
    scheduled: eligibleDates.length,
    rate: eligibleDates.length ? Math.round(completed / eligibleDates.length * 100) : 0
  };
}

export function calculateStreaks(
  logs: { habitId: string; date: string; completed: boolean }[],
  habitId: string,
  today: string,
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' = 'daily'
) {
  const completedDates = new Set(
    logs.filter(log => log.habitId === habitId && log.completed)
      .map(log => log.date)
      .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
  );

  const ordinal = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  };
  const dateFromOrdinal = (value: number) =>
    new Date(value * 86400000).toISOString().slice(0, 10);
  const completedToday = completedDates.has(today);

  if (frequency === 'weekly') {
    const weekStart = (date: string) => {
      const day = new Date(`${date}T00:00:00Z`).getUTCDay();
      return ordinal(date) - ((day + 6) % 7);
    };
    const weeks = new Set([...completedDates].map(weekStart));
    if (!weeks.size) return { currentStreak: 0, longestStreak: 0, completedToday };

    const sorted = [...weeks].sort((a, b) => a - b);
    let longestStreak = 0;
    let run = 0;
    let previous: number | null = null;
    for (const week of sorted) {
      run = previous !== null && week === previous + 7 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      previous = week;
    }

    const currentWeek = weekStart(today);
    let checkWeek = weeks.has(currentWeek) ? currentWeek : currentWeek - 7;
    let currentStreak = 0;
    while (weeks.has(checkWeek)) {
      currentStreak++;
      checkWeek -= 7;
    }
    return { currentStreak, longestStreak, completedToday };
  }

  const scheduled = (date: string) => isHabitScheduledOnDate(frequency, date);
  const dates = [...completedDates].filter(scheduled).sort();
  if (!dates.length) return { currentStreak: 0, longestStreak: 0, completedToday };

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of dates) {
    let previousScheduled = ordinal(date) - 1;
    while (!scheduled(dateFromOrdinal(previousScheduled))) previousScheduled--;
    run = previous !== null && ordinal(previous) === previousScheduled ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = date;
  }

  let check = ordinal(today);
  if (!completedDates.has(today) || !scheduled(today)) {
    check--;
    while (!scheduled(dateFromOrdinal(check))) check--;
  }

  let currentStreak = 0;
  while (completedDates.has(dateFromOrdinal(check)) && scheduled(dateFromOrdinal(check))) {
    currentStreak++;
    check--;
    while (!scheduled(dateFromOrdinal(check))) check--;
  }
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
