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

export interface SessionAuthorizationState {
  biometricEnabled: boolean;
  biometricAuthenticated: boolean;
  coordinatorAuthenticated: boolean;
  sessionGeneration: number;
  captureGeneration: number;
}

export function isSessionAuthorized(state: SessionAuthorizationState): boolean {
  if (!state.biometricEnabled) return true;
  return (
    state.biometricAuthenticated &&
    state.coordinatorAuthenticated &&
    state.sessionGeneration === state.captureGeneration
  );
}
