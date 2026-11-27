import type { Budget, Category, Goal, Habit, HabitLog, Milestone, NotificationPreferences, PlannedCommitment, SavingsGoal, Task, Transaction } from '../types';
import { buildTaskNotificationPlan, formatLocalDate, habitScheduleOnDate, isHabitEligible } from './domainUtils';
import { buildFinanceAnalytics } from './financeAnalytics';
import { decimalToMinorUnits } from './financeCore';
import { isGoalComplete } from './goalModes';
import { inboxSourceKey, type InboxInput, type InboxKind, type InboxSource } from './notificationInbox';

export const INBOX_PREFERENCES_KEY = 'notificationInboxPreferences.v1';
export const LAST_BACKUP_KEY = 'notificationInboxLastBackupAt.v1';
export const DEFAULT_INBOX_PREFERENCES = { enabled: true, commitments: false, budgets: false, savings: false, backupSince: 0 };
export type InboxPreferences = typeof DEFAULT_INBOX_PREFERENCES;

type Snapshot = {
  now: Date; preferences: InboxPreferences; reminderPreferences: NotificationPreferences; dateOnlyAlertTime: string;
  tasks: Task[]; habits: Habit[]; habitLogs: HabitLog[]; goals: Goal[]; milestones: Milestone[];
  commitments: PlannedCommitment[]; savings: SavingsGoal[]; budgets: Budget[]; transactions: Transaction[];
  categories: Category[]; recoveryPending: boolean; lastBackup: number;
};
const dayMs = 86_400_000;
const sample = (id: string) => id.startsWith('lifeos-demo-v2:');
const local = (date: string, time = '09:00') => new Date(date + 'T' + time + ':00');

export function matchesTaskReminder(task: Task, kind: InboxKind, at: number, dateOnlyAlertTime: string) {
  if (kind === 'taskSnooze') return !task.completed;
  const preferences: NotificationPreferences = {
    taskReminders: kind === 'dueTime' || kind === 'taskReminders',
    upcomingDeadlines: kind === 'upcomingDeadlines',
    overdueAlerts: kind === 'overdueAlerts',
    habitReminders: false,
    milestoneReminders: false,
  };
  return buildTaskNotificationPlan(task, preferences, new Date(at - 2 * 60_000), dateOnlyAlertTime)
    .some(plan => plan.kind === kind && +plan.at === at);
}

export function buildInboxSnapshot(state: Snapshot) {
  const { now, preferences, reminderPreferences, dateOnlyAlertTime } = state;
  const date = formatLocalDate(now);
  const month = date.slice(0, 7);
  const events: InboxInput[] = [];
  const sources: Record<string, string> = Object.create(null);
  const labels = new Map<string, string>();
  const source = (type: InboxSource, id: string, revision: unknown, label?: string) => {
    const key = inboxSourceKey(type, id);
    sources[key] = JSON.stringify(revision);
    if (label) labels.set(key, label);
  };
  const add = (kind: InboxKind, type: InboxSource, id: string, at: Date, occurrence?: string, maxAge = dayMs) => {
    const revision = sources[inboxSourceKey(type, id)];
    if (preferences.enabled && revision && +at <= +now && +at > +now - maxAge) {
      events.push({ kind, source: type, sourceId: id, at: +at, occurrence: occurrence ?? at.toISOString(), evidence: 'in-app', revision });
    }
  };

  const tasks = new Map<string, Task>();
  for (const task of state.tasks) {
    if (task.completed || sample(task.id) || sample(task.recurrenceRootId || '')) continue;
    tasks.set(task.id, task);
    source('task', task.id, [task.dueDate, task.dueTime, task.reminderAt, task.reminderLeadMinutes, task.dueAlertDisabled,
      task.dateOnlyAlertAnchorAt, task.dueTime ? null : dateOnlyAlertTime], task.title);
    if (!preferences.enabled) continue;
    for (const plan of buildTaskNotificationPlan(task, reminderPreferences, new Date(+now - dayMs), dateOnlyAlertTime)) {
      if (+plan.at >= Date.parse(task.createdAt)) add(plan.kind, 'task', task.id, plan.at);
    }
  }
  const completedHabits = new Set(state.habitLogs.filter(log => log.date === date && log.completed).map(log => log.habitId));
  for (const habit of state.habits) {
    if (habit.archived || sample(habit.id) || !habit.reminderTime || !isHabitEligible(habit, date) || completedHabits.has(habit.id)) continue;
    if (habit.frequency === 'weekly' && !habitScheduleOnDate(habit, date) && now.getDay() + 1 !== (habit.reminderWeekday ?? 2)) continue;
    source('habit', habit.id, [habit.reminderTime, habit.reminderWeekday, habit.frequency, habitScheduleOnDate(habit, date)], habit.name);
    const at = local(date, habit.reminderTime);
    if (reminderPreferences.habitReminders && +at >= Date.parse(habit.createdAt)) add('habitReminder', 'habit', habit.id, at, date);
  }
  const milestonesByGoal = new Map<string, Milestone[]>();
  for (const row of state.milestones) {
    if (!milestonesByGoal.has(row.goalId)) milestonesByGoal.set(row.goalId, []);
    milestonesByGoal.get(row.goalId)?.push(row);
  }
  const activeGoals = new Set(state.goals.filter(goal => !goal.archived && !sample(goal.id) &&
    (goal.mode === undefined ? goal.status === 'In Progress' : goal.status !== 'Paused' && !isGoalComplete(goal, milestonesByGoal.get(goal.id) ?? []))).map(goal => goal.id));
  for (const row of state.milestones) {
    if (row.completed || !row.targetDate || sample(row.id) || !activeGoals.has(row.goalId)) continue;
    source('milestone', row.id, [row.goalId, row.targetDate], row.title);
    if (reminderPreferences.milestoneReminders) add('milestoneReminder', 'milestone', row.id, local(row.targetDate));
  }

  if (preferences.commitments) for (const row of state.commitments) {
    if (row.status !== 'active' || sample(row.id) || row.nextDueDate < date) continue;
    const at = local(row.nextDueDate);
    at.setDate(at.getDate() - 3);
    source('commitment', row.id, row.nextDueDate, row.title);
    add('commitment', 'commitment', row.id, at, row.nextDueDate, 5 * dayMs);
  }
  if (preferences.savings) for (const row of state.savings) {
    if (!row.currencyCode || !row.targetDate || row.targetDate < date || sample(row.id)) continue;
    const saved = row.currentAmountMinor ?? decimalToMinorUnits(String(row.currentAmount), row.currencyCode);
    const target = row.targetAmountMinor ?? decimalToMinorUnits(String(row.targetAmount), row.currencyCode);
    if (BigInt(saved) >= BigInt(target)) continue;
    const at = local(row.targetDate);
    at.setDate(at.getDate() - 3);
    source('savings', row.id, [row.targetDate, row.currencyCode, String(target)], row.title);
    add('savings', 'savings', row.id, at, row.targetDate, 5 * dayMs);
  }
  if (preferences.budgets) {
    const budgets = state.budgets.filter(row => !sample(row.id));
    const transactions = state.transactions.filter(row => !sample(row.id));
    const currencies = new Set(budgets.filter(row => row.monthYear === month).flatMap(row => row.currencyCode ? [row.currencyCode] : []));
    for (const currency of currencies) {
      const analytics = buildFinanceAnalytics(transactions, budgets, month, 2, state.categories, currency);
      for (const row of analytics.budgetRows) {
        const allocated = BigInt(row.allocatedMinor);
        if (!row.id || row.category === 'Unknown category' || row.carryoverUnavailable || allocated <= 0n ||
            BigInt(row.spentMinor) * 100n < allocated * 80n) continue;
        source('budget', row.id, [month, currency, row.allocatedMinor], row.category);
        add('budget', 'budget', row.id, now, month);
      }
    }
  }
  if (preferences.backupSince > 0) {
    const cycle = Math.max(preferences.backupSince, state.lastBackup);
    source('backup', 'local', cycle);
    const due = cycle + 30 * dayMs;
    add('backup', 'backup', 'local', new Date(Math.max(due, +now - dayMs + 1)), String(cycle), 2 * dayMs);
  }
  if (state.recoveryPending) {
    source('recovery', 'local', 1);
    add('recovery', 'recovery', 'local', now, 'deferred');
  }
  const acceptsObservation = (event: InboxInput) => {
    if (sources[inboxSourceKey(event.source, event.sourceId)] === undefined) return false;
    if (event.source === 'task' && event.occurrence.includes('T')) {
      const task = tasks.get(event.sourceId);
      return Boolean(task && matchesTaskReminder(task, event.kind, event.at, dateOnlyAlertTime));
    }
    return true;
  };
  return { events, sources, acceptsObservation, labels };
}
