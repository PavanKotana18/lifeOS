/**
 * Core Domain Models and Business Logic for LifeOS
 */

// Streak Calculation Engine
function calculateStreaks(habitLogs, targetHabitId, todayStr) {
  // habitLogs: array of { habitId, date: 'YYYY-MM-DD', completed: boolean }
  const completedDates = new Set(
    habitLogs
      .filter(l => l.habitId === targetHabitId && l.completed)
      .map(l => l.date)
  );

  if (completedDates.size === 0) {
    return { currentStreak: 0, longestStreak: 0, completedToday: false };
  }

  const completedToday = completedDates.has(todayStr);

  // Parse all dates and sort ascending
  const sortedDates = Array.from(completedDates).sort();
  
  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = null;

  for (const dStr of sortedDates) {
      const curDate = new Date(`${dStr}T00:00:00`);
    if (prevDate) {
      const diffDays = dateOrdinal(dStr) - dateOrdinal(formatLocalDate(prevDate));
      if (diffDays === 1) {
        tempStreak += 1;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    prevDate = curDate;
  }

  // Calculate current streak: check backward from today or yesterday
  let currentStreak = 0;
  let checkDate = new Date(todayStr + 'T00:00:00');
  
  // If not completed today, streak might still be active if completed yesterday
  if (!completedDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const yyyy = checkDate.getFullYear();
    const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
    const dd = String(checkDate.getDate()).padStart(2, '0');
    const checkStr = `${yyyy}-${mm}-${dd}`;

    if (completedDates.has(checkStr)) {
      currentStreak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak, completedToday };
}

function dateOrdinal(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatLocalDateTime(date) {
  return `${formatLocalDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseLocalDateTime(dateStr, timeStr = '00:00', endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = (timeStr || '00:00').split(':').map(Number);
  const date = new Date(year, month - 1, day, endOfDay ? 23 : hour, endOfDay ? 59 : minute, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function getTaskDeadline(task) {
  return parseLocalDateTime(task.dueDate, task.dueTime || '00:00', !task.dueTime);
}

function getTaskStatus(task, now = new Date()) {
  if (task.completed) return 'Completed';
  const deadline = getTaskDeadline(task);
  return deadline && now.getTime() > deadline.getTime() ? 'Overdue' : 'Pending';
}

function sortTasksByDeadline(tasks, now = new Date()) {
  const rank = { Overdue: 0, Pending: 1, Completed: 2 };
  return [...tasks].sort((a, b) => {
    const statusDiff = rank[getTaskStatus(a, now)] - rank[getTaskStatus(b, now)];
    if (statusDiff) return statusDiff;
    return (getTaskDeadline(a)?.getTime() ?? Infinity) - (getTaskDeadline(b)?.getTime() ?? Infinity);
  });
}

function getGoalProgress(current, target) {
  const currentValue = Number(current) || 0;
  const targetValue = Number(target) || 0;
  if (targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(currentValue / targetValue * 100)));
}

function calculateWeeklyHabitRate(logs, habitId, today = new Date()) {
  let completed = 0;
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = formatLocalDate(day);
    if (logs.some(log => log.habitId === habitId && log.date === key && log.completed)) completed++;
  }
  return { completed, rate: Math.round(completed / 7 * 100) };
}

function buildTaskNotificationPlan(task, preferences, now = new Date()) {
  if (task.completed) return [];
  const plan = [];
  const deadline = getTaskDeadline(task);
  const add = (kind, at) => { if (at && at.getTime() > now.getTime()) plan.push({ kind, at }); };
  if (preferences.taskReminders && task.reminderAt) {
    const reminder = new Date(task.reminderAt);
    if (!Number.isNaN(reminder.getTime())) add('taskReminders', reminder);
  }
  if (deadline && preferences.upcomingDeadlines) {
    const upcoming = task.dueTime
      ? new Date(deadline.getTime() - 60 * 60 * 1000)
      : parseLocalDateTime(task.dueDate, '09:00');
    add('upcomingDeadlines', upcoming);
  }
  if (deadline && preferences.overdueAlerts) add('overdueAlerts', new Date(deadline.getTime() + 60 * 1000));
  return plan;
}

function buildFinanceEntry(localDateTime, savedAt = new Date()) {
  const parsed = new Date(localDateTime);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid local transaction date/time');
  return { date: formatLocalDate(parsed), occurredAt: parsed.toISOString(), createdAt: savedAt.toISOString() };
}

function shouldShowOnboarding(completed, hasLegacyData, started = false) {
  return started ? !completed : !completed && !hasLegacyData;
}

function profileInitial(name) {
  return String(name || '').trim().charAt(0).toLocaleUpperCase();
}

function resolveAppearance(preference, systemDark) {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

function normalizeNotificationPermission(status, wasRequested) {
  return status === 'granted' ? 'Granted'
    : status === 'denied' && wasRequested ? 'Denied · open Android settings'
      : status === 'denied' ? 'Denied'
        : status === 'prompt' || status === 'prompt-with-rationale' ? 'Not requested' : status;
}

function shouldAnimateNavigation(prefersReducedMotion) {
  return !prefersReducedMotion;
}

function resolveBackAction(state, hasPreviousTab) {
  if (!state.appReady || state.onboarding || state.locked) return 'ignore';
  if (state.dialogOpen) return 'dismiss-dialog';
  if (state.exitDialogOpen) return 'dismiss-exit-dialog';
  if (state.taskDetailsOpen) return 'close-task-details';
  if (state.childViewOpen) return 'close-child-view';
  if (hasPreviousTab) return 'previous-tab';
  if (state.tab !== 'dashboard') return 'home';
  return 'confirm-exit';
}

function getMonthCalendarDays(year, monthIndex, weekStartsOnMonday = true) {
  const first = new Date(year, monthIndex, 1);
  const offset = weekStartsOnMonday ? (first.getDay() + 6) % 7 : first.getDay();
  const count = Math.ceil((offset + new Date(year, monthIndex + 1, 0).getDate()) / 7) * 7;
  const start = new Date(year, monthIndex, 1 - offset);
  return Array.from({ length: count }, (_, index) => formatLocalDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)));
}

function getTasksForDate(tasks, date) {
  return tasks.filter(task => task.dueDate === date);
}

function greetingForHour(hour, name) {
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const cleanName = String(name || '').trim();
  return cleanName ? `${greeting}, ${cleanName}.` : `${greeting}.`;
}

function watchSystemTheme(media, onTheme) {
  const update = () => onTheme(media.matches ? 'dark' : 'light');
  update();
  if (media.addEventListener) media.addEventListener('change', update);
  else if (media.addListener) media.addListener(update);
  return () => {
    if (media.removeEventListener) media.removeEventListener('change', update);
    else if (media.removeListener) media.removeListener(update);
  };
}

function stableNotificationId(key) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) { hash ^= key.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 2147483646 + 1;
}

// Financial Analytics Engine
function calculateFinanceMetrics(transactions, budgets, currentMonthStr) {
  // currentMonthStr: 'YYYY-MM'
  const monthlyTx = transactions.filter(t => t.date.startsWith(currentMonthStr));
  
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryExpenses = {};

  for (const tx of monthlyTx) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else if (tx.type === 'expense') {
      totalExpenses += amt;
      categoryExpenses[tx.category] = (categoryExpenses[tx.category] || 0) + amt;
    }
  }

  const remainingBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  // Budget calculations
  let totalBudget = 0;
  for (const b of budgets) {
    if (!b.monthYear || b.monthYear === currentMonthStr) {
      totalBudget += Number(b.monthlyAmount) || 0;
    }
  }

  const budgetUtilisation = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
  const remainingBudget = totalBudget - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    remainingBalance,
    savingsRate: Number(savingsRate.toFixed(1)),
    totalBudget,
    budgetUtilisation: Number(budgetUtilisation.toFixed(1)),
    remainingBudget,
    categoryExpenses
  };
}

// Export for node testing
module.exports = {
  calculateStreaks,
  calculateFinanceMetrics,
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDateTime,
  getTaskDeadline,
  getTaskStatus,
  sortTasksByDeadline,
  getGoalProgress,
  calculateWeeklyHabitRate,
  buildTaskNotificationPlan,
  buildFinanceEntry,
  shouldShowOnboarding,
  profileInitial,
  resolveAppearance,
  normalizeNotificationPermission,
  shouldAnimateNavigation,
  stableNotificationId,
  getMonthCalendarDays,
  getTasksForDate,
  greetingForHour,
  watchSystemTheme,
  resolveBackAction
};
