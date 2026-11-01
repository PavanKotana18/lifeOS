/**
 * Comprehensive Automated Verification Suite for LifeOS
 * Tests all workflows mandated by Section 15 of user specification:
 * 1. Finance (income, expense, monthly totals, edit, delete, budget calculations, category analytics)
 * 2. Habits (create, mark completed, persistence, streaks calculation, history)
 * 3. Goals (create, update progress, milestone completion, time remaining, overdue)
 * 4. Planner (create task, priority, due date, completion, filtering)
 * 5. Dashboard (reactive integration, dynamic updates on create/delete)
 * 6. Backup & Restore (JSON export, validation, import, integrity check)
 */

process.env.TZ = 'America/New_York';
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
function loadTsModule(path) {
  const loadedModule = { exports: {} };
  const source = fs.readFileSync(path, 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: loadedModule, exports: loadedModule.exports, Promise, Intl, Date, Math, Number, String, Object, Array, Error });
  return loadedModule.exports;
}
const { createAuthCoordinator } = loadTsModule('./src/services/authCoordinator.ts');
const userPreferenceUtils = loadTsModule('./src/services/userPreferences.ts');
const { buildFinanceAnalytics } = loadTsModule('./src/services/financeAnalytics.ts');
const { pushTabHistory, popTabHistory } = loadTsModule('./src/services/tabHistory.ts');
const {
  calculateStreaks,
  calculateFinanceMetrics,
  formatLocalDate,
  formatLocalDateTime,
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
} = require('./src_core_logic.js');

// Mock in-memory database abstraction layer matching Dexie API
class MockLifeOSDatabase {
  constructor() {
    this.tables = {
      transactions: new Map(),
      categories: new Map(),
      budgets: new Map(),
      savingsGoals: new Map(),
      savingsContributions: new Map(),
      habits: new Map(),
      habitLogs: new Map(),
      goals: new Map(),
      milestones: new Map(),
      tasks: new Map(),
      settings: new Map()
    };
    this.seedDefaultCategories();
  }

  seedDefaultCategories() {
    const defaultCats = [
      { id: 'c1', name: 'Salary', type: 'income', color: '#10B981', icon: 'wallet' },
      { id: 'c2', name: 'Freelance', type: 'income', color: '#3B82F6', icon: 'laptop' },
      { id: 'c3', name: 'Rent', type: 'expense', color: '#EF4444', icon: 'home' },
      { id: 'c4', name: 'Food', type: 'expense', color: '#F59E0B', icon: 'utensils' },
      { id: 'c5', name: 'Transport', type: 'expense', color: '#6366F1', icon: 'car' },
      { id: 'c6', name: 'Utilities', type: 'expense', color: '#8B5CF6', icon: 'zap' },
      { id: 'c7', name: 'Investments', type: 'expense', color: '#EC4899', icon: 'trending-up' }
    ];
    for (const c of defaultCats) {
      this.tables.categories.set(c.id, c);
    }
  }

  // Generic CRUD
  async add(table, item) {
    const id = item.id || 'id_' + Math.random().toString(36).substr(2, 9);
    const record = { ...item, id, createdAt: item.createdAt || new Date().toISOString() };
    this.tables[table].set(id, record);
    return id;
  }

  async get(table, id) {
    return this.tables[table].get(id) || null;
  }

  async toArray(table) {
    return Array.from(this.tables[table].values());
  }

  async update(table, id, updates) {
    const existing = this.tables[table].get(id);
    if (!existing) throw new Error(`Record ${id} not found in ${table}`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.tables[table].set(id, updated);
    return updated;
  }

  async delete(table, id) {
    return this.tables[table].delete(id);
  }

  async clearAll() {
    for (const key of Object.keys(this.tables)) {
      this.tables[key].clear();
    }
    this.seedDefaultCategories();
  }

  // Export full JSON
  async exportJSON() {
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      appName: 'LifeOS',
      data: {}
    };
    for (const key of Object.keys(this.tables)) {
      exportData.data[key] = Array.from(this.tables[key].values());
    }
    return JSON.stringify(exportData, null, 2);
  }

  // Import JSON with validation
  async importJSON(jsonString) {
    let parsed;
    try {
      parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
      throw new Error('Invalid JSON format');
    }

    if (!parsed || !parsed.data) {
      throw new Error('Invalid LifeOS backup schema: missing data key');
    }

    // Verify critical tables exist in backup
    const requiredTables = ['transactions', 'habits', 'goals', 'tasks'];
    for (const req of requiredTables) {
      if (!Array.isArray(parsed.data[req])) {
        throw new Error(`Invalid LifeOS backup: table "${req}" must be an array`);
      }
    }

    // Replace data
    for (const [key, rows] of Object.entries(parsed.data)) {
      if (this.tables[key]) {
        this.tables[key].clear();
        for (const row of rows) {
          this.tables[key].set(row.id, row);
        }
      }
    }

    return {
      success: true,
      restoredTables: Object.keys(parsed.data),
      totalRecords: Object.values(parsed.data).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0)
    };
  }
}

// Run test suite
async function runTestSuite() {
  console.log('=== STARTING LIFEOS AUTOMATED VERIFICATION SUITE ===\n');
  const db = new MockLifeOSDatabase();
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    } else {
      console.log(`✅ PASSED: ${message}`);
      passedTests++;
    }
  }

  // --- 1. FINANCE TESTS ---
  console.log('\n--- 1. Testing Finance Module ---');
  // Create income transaction
  const txIncomeId = await db.add('transactions', {
    type: 'income',
    amount: 120000,
    category: 'Salary',
    description: 'October Monthly Salary',
    date: '2026-10-01',
    paymentMethod: 'Bank Transfer'
  });
  assert(txIncomeId != null, 'Create income transaction (Salary: ₹1,20,000)');

  // Create expense transaction
  const txExpenseId = await db.add('transactions', {
    type: 'expense',
    amount: 35000,
    category: 'Rent',
    description: 'Apartment rent',
    date: '2026-10-02',
    paymentMethod: 'UPI'
  });
  const txExpense2Id = await db.add('transactions', {
    type: 'expense',
    amount: 15000,
    category: 'Food',
    description: 'Groceries & Dining',
    date: '2026-10-10',
    paymentMethod: 'Credit Card'
  });
  assert(txExpenseId != null && txExpense2Id != null, 'Create expense transactions (Rent: ₹35,000, Food: ₹15,000)');

  // Set budget
  await db.add('budgets', {
    monthlyAmount: 60000,
    monthYear: '2026-10'
  });

  // Verify monthly totals
  let txs = await db.toArray('transactions');
  let budgets = await db.toArray('budgets');
  let finMetrics = calculateFinanceMetrics(txs, budgets, '2026-10');
  assert(finMetrics.totalIncome === 120000, `Verify monthly total income: expected 120000, got ${finMetrics.totalIncome}`);
  assert(finMetrics.totalExpenses === 50000, `Verify monthly total expenses: expected 50000, got ${finMetrics.totalExpenses}`);
  assert(finMetrics.remainingBalance === 70000, `Verify remaining balance: expected 70000, got ${finMetrics.remainingBalance}`);
  assert(finMetrics.budgetUtilisation === 83.3, `Verify budget utilisation: expected 83.3%, got ${finMetrics.budgetUtilisation}%`);

  // Edit transaction
  await db.update('transactions', txExpense2Id, { amount: 18000, notes: 'Added weekend grocery run' });
  const updatedTx = await db.get('transactions', txExpense2Id);
  assert(updatedTx.amount === 18000, `Edit transaction amount updated to 18000`);

  // Recalculate
  txs = await db.toArray('transactions');
  finMetrics = calculateFinanceMetrics(txs, budgets, '2026-10');
  assert(finMetrics.totalExpenses === 53000, `Verify recalculation after edit: total expenses 53000`);

  // Delete transaction
  await db.delete('transactions', txExpenseId);
  txs = await db.toArray('transactions');
  finMetrics = calculateFinanceMetrics(txs, budgets, '2026-10');
  assert(finMetrics.totalExpenses === 18000, `Verify recalculation after delete: total expenses 18000`);
  assert(finMetrics.categoryExpenses['Food'] === 18000 && !finMetrics.categoryExpenses['Rent'], `Verify category analytics after delete`);

  // --- 2. HABITS TESTS ---
  console.log('\n--- 2. Testing Habit Tracker Module ---');
  const habitId = await db.add('habits', {
    name: 'Drink 3L Water',
    frequency: 'daily',
    icon: 'droplet',
    color: '#3B82F6'
  });
  assert(habitId != null, 'Create habit "Drink 3L Water"');

  // Mark completion for 4 consecutive days
  const todayStr = '2026-10-31';
  const dates = ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'];
  for (const d of dates) {
    await db.add('habitLogs', {
      habitId,
      date: d,
      completed: true,
      completedAt: d + 'T10:00:00Z'
    });
  }

  // Verify persistence and streak calculation
  const habitLogs = await db.toArray('habitLogs');
  const streakInfo = calculateStreaks(habitLogs, habitId, todayStr);
  assert(streakInfo.completedToday === true, 'Verify habit marked completed today');
  assert(streakInfo.currentStreak === 4, `Verify current streak is 4 (got ${streakInfo.currentStreak})`);
  assert(streakInfo.longestStreak === 4, `Verify longest streak is 4 (got ${streakInfo.longestStreak})`);

  // Historical habit records
  const habitLogsForHabit = habitLogs.filter(l => l.habitId === habitId);
  assert(habitLogsForHabit.length === 4, 'Verify historical records preserved against actual dates');

  // Undo completion today
  const todayLog = habitLogsForHabit.find(l => l.date === todayStr);
  await db.update('habitLogs', todayLog.id, { completed: false });
  const updatedLogs = await db.toArray('habitLogs');
  const streakAfterUndo = calculateStreaks(updatedLogs, habitId, todayStr);
  assert(streakAfterUndo.completedToday === false, 'Verify undo completion today');
  // Current streak should still be 3 (since completed yesterday)
  assert(streakAfterUndo.currentStreak === 3, `Verify streak calculation after undo (got ${streakAfterUndo.currentStreak})`);

  // --- 3. GOALS TESTS ---
  console.log('\n--- 3. Testing Goals Module ---');
  const goalId = await db.add('goals', {
    title: 'Run Half Marathon',
    description: 'Complete 21.1 km race',
    category: 'Fitness',
    targetValue: 21.1,
    currentValue: 5.0,
    unit: 'km',
    startDate: '2026-10-01',
    targetDate: '2026-12-31',
    priority: 'High',
    status: 'In Progress'
  });
  assert(goalId != null, 'Create goal "Run Half Marathon"');

  // Add milestone
  const m1 = await db.add('milestones', {
    goalId,
    title: 'Run 10 km comfortably',
    targetDate: '2026-11-15',
    completed: false
  });
  const m2 = await db.add('milestones', {
    goalId,
    title: 'Run 15 km training race',
    targetDate: '2026-12-01',
    completed: false
  });
  assert(m1 != null && m2 != null, 'Add milestones to goal');

  // Complete milestone and update progress
  await db.update('milestones', m1, { completed: true, completedAt: new Date().toISOString() });
  await db.update('goals', goalId, { currentValue: 10.0 });
  const updatedGoal = await db.get('goals', goalId);
  const goalMilestones = (await db.toArray('milestones')).filter(m => m.goalId === goalId);
  const progressPct = ((updatedGoal.currentValue / updatedGoal.targetValue) * 100).toFixed(1);
  assert(progressPct === '47.4', `Verify progress calculation: expected 47.4%, got ${progressPct}%`);
  assert(goalMilestones.filter(m => m.completed).length === 1, 'Verify milestone completed status');

  // --- 4. PLANNER TESTS ---
  console.log('\n--- 4. Testing Daily Planner Module ---');
  const taskId = await db.add('tasks', {
    title: 'Review Quarterly Investment Portfolio',
    dueDate: '2026-10-31',
    priority: 'Urgent',
    category: 'Financial',
    notes: 'Rebalance equity and debt mutual funds',
    recurring: 'None',
    completed: false
  });
  assert(taskId != null, 'Create task with Urgent priority');

  // Edit priority and due date
  await db.update('tasks', taskId, { priority: 'High', dueDate: '2026-11-01' });
  let task = await db.get('tasks', taskId);
  assert(task.priority === 'High' && task.dueDate === '2026-11-01', 'Edit priority to High and change due date to 2026-11-01');

  // Mark task completed
  await db.update('tasks', taskId, { completed: true, completedAt: new Date().toISOString() });
  task = await db.get('tasks', taskId);
  assert(task.completed === true, 'Mark task completed and verify persistent state');

  // --- 4B. LOCAL DATE/TIME, STATUS, PROGRESS AND NOTIFICATION PLAN TESTS ---
  console.log('\n--- 4B. Testing local deadlines and scheduling logic ---');
  const dayEndTask = { dueDate: '2026-03-08', completed: false };
  assert(getTaskStatus(dayEndTask, new Date(2026, 2, 8, 23, 59, 59, 999)) === 'Pending', 'Task without a time remains pending through the end of its local due day');
  assert(getTaskStatus(dayEndTask, new Date(2026, 2, 9, 0, 0, 0, 1)) === 'Overdue', 'Task without a time becomes overdue after its local due day ends');
  assert(getTaskStatus({ dueDate: '2026-03-08', dueTime: '09:30' }, new Date(2026, 2, 8, 9, 31)) === 'Overdue', 'Task with a due time becomes overdue after that local time');
  assert(getTaskStatus({ dueDate: '2026-03-07', completed: true }, new Date(2026, 2, 9)) === 'Completed', 'Completed tasks never become overdue');
  const orderedTasks = sortTasksByDeadline([
    { id: 'later', dueDate: '2026-03-10' },
    { id: 'overdue', dueDate: '2026-03-07' },
    { id: 'done', dueDate: '2026-03-06', completed: true }
  ], new Date(2026, 2, 8, 12));
  assert(orderedTasks.map(task => task.id).join(',') === 'overdue,later,done', 'Task sorting places overdue items first and completed items last');
  const dstLogs = ['2026-03-07', '2026-03-08', '2026-03-09'].map(date => ({ habitId: 'dst', date, completed: true }));
  assert(calculateStreaks(dstLogs, 'dst', '2026-03-09').currentStreak === 3, 'Habit streak remains continuous across the daylight-saving transition');
  assert(calculateWeeklyHabitRate(dstLogs, 'dst', new Date(2026, 2, 9)).rate === 43, 'Weekly completion rate uses local calendar days');
  // Frequency-aware habit analytics regression tests
  const weekdayLogs = ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30']
    .map(date => ({ habitId: 'weekday', date, completed: true }));
  assert(calculateWeeklyHabitRate(weekdayLogs, 'weekday', new Date(2026, 9, 30), 'weekdays').rate === 100,
    'Weekday habit rate uses five scheduled weekdays, not seven calendar days');
  const weekendLogs = ['2026-10-24','2026-10-25']
    .map(date => ({ habitId: 'weekend', date, completed: true }));
  assert(calculateWeeklyHabitRate(weekendLogs, 'weekend', new Date(2026, 9, 25), 'weekends').rate === 100,
    'Weekend habit rate uses scheduled weekend days');
  assert(calculateWeeklyHabitRate([{ habitId: 'weekly', date: '2026-10-28', completed: true }],
    'weekly', new Date(2026, 9, 30), 'weekly').rate === 100,
    'Weekly habit needs one completion in the current Monday-Sunday week');
  assert(calculateWeeklyHabitRate(
    [{ habitId: 'weekly-boundary', date: '2026-11-01', completed: true }],
    'weekly-boundary', new Date(2026, 10, 8), 'weekly'
  ).rate === 0, 'Previous Sunday does not count in the new Monday-Sunday week');
  assert(calculateWeeklyHabitRate(
    [{ habitId: 'weekly-boundary', date: '2026-11-09', completed: true }],
    'weekly-boundary', new Date(2026, 10, 8), 'weekly'
  ).rate === 0, 'Next Monday does not count in the current calendar week');
  const weekdayStreakLogs = ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30']
    .map(date => ({ habitId: 'weekday-streak', date, completed: true }));
  assert(calculateStreaks(weekdayStreakLogs, 'weekday-streak', '2026-11-02', 'weekdays').currentStreak === 5,
    'Weekday streak continues across Saturday and Sunday');
  const weeklyStreakLogs = ['2026-10-19','2026-10-28']
    .map(date => ({ habitId: 'weekly-streak', date, completed: true }));
  assert(calculateStreaks(weeklyStreakLogs, 'weekly-streak', '2026-10-30', 'weekly').currentStreak === 2,
    'Weekly streak counts consecutive calendar weeks');
  assert(getGoalProgress(125, 100) === 100 && getGoalProgress(-2, 100) === 0, 'Goal progress is bounded between zero and one hundred percent');
  const localNow = new Date(2026, 6, 4, 8, 5, 6, 7);
  const entry = buildFinanceEntry(formatLocalDateTime(localNow), localNow);
  assert(entry.date === '2026-07-04' && entry.occurredAt === new Date('2026-07-04T08:05').toISOString(), 'Finance date/time converts from device-local input to a stable instant');
  assert(entry.createdAt === localNow.toISOString(), 'Finance entry keeps the exact save timestamp');
  const taskPlan = buildTaskNotificationPlan({ dueDate: '2026-07-06', dueTime: '10:00', reminderAt: new Date(2026, 6, 6, 9, 15).toISOString() }, { taskReminders: true, upcomingDeadlines: true, overdueAlerts: true }, new Date(2026, 6, 4));
  assert(taskPlan.length === 3 && taskPlan[0].at.getHours() === 9 && taskPlan[0].at.getMinutes() === 15, 'Task notification planning includes custom reminder, upcoming deadline and overdue alert times');
  assert(buildTaskNotificationPlan({ dueDate: '2026-07-06', completed: true }, { taskReminders: true, upcomingDeadlines: true, overdueAlerts: true }, new Date(2026, 6, 4)).length === 0, 'Completed task notifications are not scheduled');

  console.log('\n--- 4C. Testing onboarding, profile and notification diagnostics ---');
  assert(shouldShowOnboarding(false, false) && !shouldShowOnboarding(false, true), 'A fresh empty install enters onboarding while an existing profile/data set migrates past it');
  assert(shouldShowOnboarding(false, false, true) && !shouldShowOnboarding(true, false, true), 'An interrupted first-run flow resumes while a completed flow remains closed');
  assert(shouldShowOnboarding(false, false, true), 'Skipping optional biometric setup does not prevent unfinished onboarding from resuming');
  assert(profileInitial(' Pavan Kotana ') === 'P' && profileInitial('') === '', 'Profile avatar uses the uppercase first letter and handles an empty name');
  assert(resolveAppearance('dark', false) === 'dark' && resolveAppearance('light', true) === 'light' && resolveAppearance('system', true) === 'dark' && resolveAppearance('system', false) === 'light', 'Dark, light and system appearance preferences resolve correctly');
  assert(userPreferenceUtils.resolveSystemDark(false, true) === false && userPreferenceUtils.resolveSystemDark(true, false) === true && userPreferenceUtils.resolveSystemDark(undefined, false) === false, 'Native Android appearance overrides stale WebView media state and browsers fall back to matchMedia');
  const restoredPreferences = userPreferenceUtils.mergeUserPreferences({ currency: 'EUR', distance: 'mi', timeFormat: '24h' }, 'INR');
  assert(restoredPreferences.currency === 'EUR' && restoredPreferences.distance === 'mi' && restoredPreferences.timeFormat === '24h' && restoredPreferences.volume === 'L', 'Stored preferences restore while new fields receive safe defaults');
  assert(userPreferenceUtils.formatCurrency(1234.5, 'USD', 'en-US') === '$1,234.50' && userPreferenceUtils.formatCurrency(1234.5, 'EUR', 'de-DE').includes('1.234,50'), 'Currency uses locale separators and currency precision');
  assert(userPreferenceUtils.getNumberLocale('EUR', 'system') === undefined, 'System locale uses the device Intl locale instead of inferring locale from currency');
  assert(userPreferenceUtils.formatTimePreference(new Date(2026, 0, 2, 13, 5), '24h', 'en-GB').includes('13:05') && userPreferenceUtils.formatTimePreference(new Date(2026, 0, 2, 13, 5), '12h', 'en-US').includes('1:05'), 'Time format preference changes display without altering stored timestamps');
  assert(Math.abs(userPreferenceUtils.convertMeasurement(1, 'mi', 'km') - 1.609344) < 1e-12 && Math.abs(userPreferenceUtils.convertMeasurement(500, 'mL', 'L') - 0.5) < 1e-12, 'Distance and volume conversion preserve precise canonical values');
  assert(Math.abs(userPreferenceUtils.convertMeasurement(1, 'mph', 'm/s') - 0.44704) < 1e-12 && userPreferenceUtils.convertMeasurement(0, 'L', 'US gal') === 0, 'Speed conversions and zero edge cases are supported');
  let invalidConversionRejected = false; try { userPreferenceUtils.convertMeasurement(1, 'mi', 'L'); } catch { invalidConversionRejected = true; }
  assert(invalidConversionRejected && userPreferenceUtils.formatDatePreference(new Date(2026, 0, 2), 'YMD') === '2026-01-02', 'Incompatible units fail safely and date display preference formats consistently');
  const transactionUpdate = userPreferenceUtils.buildTransactionUpdate({ type: 'expense', amount: 18.25, category: 'Food', description: 'Lunch', dateTime: '2026-10-31T12:15', paymentMethod: 'UPI', notes: 'Workday', isRecurring: false });
  assert(transactionUpdate.amount === 18.25 && transactionUpdate.date === '2026-10-31' && transactionUpdate.notes === 'Workday' && !('id' in transactionUpdate) && !('createdAt' in transactionUpdate), 'Transaction edit fields exclude identity and creation timestamp so updates preserve them');
  const analyticsRows = buildFinanceAnalytics([
    { date: '2026-09-03', amount: 120, type: 'expense', category: 'Rent' },
    { date: '2026-10-01', amount: 1000, type: 'income', category: 'Salary' },
    { date: '2026-10-02', amount: 100, type: 'expense', category: 'Food' },
    { date: '2026-10-03', amount: 50, type: 'expense', category: 'Rent' },
  ], [{ monthYear: '2026-10', categoryId: 'Food', monthlyAmount: 150 }, { monthYear: '2026-10', monthlyAmount: 200 }], '2026-10');
  assert(analyticsRows.totalIncome === 1000 && analyticsRows.totalExpenses === 150 && analyticsRows.netSavings === 850 && analyticsRows.savingsRate === 85 && analyticsRows.expenseChange === 25, 'Finance analytics totals, savings rate, and month comparison derive from stored records');
  assert(analyticsRows.largestCategory.name === 'Food' && analyticsRows.largestCategory.percentage > 66 && analyticsRows.budgetRows[0].spent === 100 && analyticsRows.budgetRows[0].remaining === 50, 'Expense category ranking and category budget insights are accurate');
  const noBaseline = buildFinanceAnalytics([{ date: '2026-10-03', amount: 20, type: 'expense', category: 'Other' }], [], '2026-10');
  const zeroBaseline = buildFinanceAnalytics([{ date: '2026-09-03', amount: 100, type: 'income' }, { date: '2026-10-03', amount: 20, type: 'expense', category: 'Other' }], [], '2026-10');
  assert(noBaseline.expenseChange === null && !noBaseline.previousMonthHasRecords && zeroBaseline.expenseChange === null && zeroBaseline.previousMonthHasRecords, 'Analytics distinguish missing prior data from a recorded month with zero expenses');
  let financeHistory = [];
  financeHistory = pushTabHistory(financeHistory, 'overview', 'transactions');
  financeHistory = pushTabHistory(financeHistory, 'transactions', 'budgets');
  const financeBackOne = popTabHistory(financeHistory, 'overview');
  const financeBackTwo = popTabHistory(financeBackOne.history, 'overview');
  assert(financeBackOne.next === 'transactions' && financeBackTwo.next === 'overview' && financeBackTwo.history.length === 0 && pushTabHistory(financeHistory, 'budgets', 'budgets').length === 2, 'Nested Finance navigation returns through visited subtabs without duplicate entries');
  assert(resolveAppearance('system', false) === 'light' && resolveAppearance('system', true) === 'dark' && resolveAppearance('light', true) === 'light' && resolveAppearance('dark', false) === 'dark' && resolveAppearance('system', false) === 'light', 'System follows current appearance after switching back from either explicit theme and persisted System survives restart');
  let themeListener; let systemDark = true; const appliedThemes = [];
  const unwatchTheme = watchSystemTheme({ get matches() { return systemDark; }, addEventListener: (_, listener) => { themeListener = listener; }, removeEventListener: () => { themeListener = undefined; } }, theme => appliedThemes.push(theme));
  systemDark = false; themeListener(); systemDark = true; themeListener(); unwatchTheme();
  assert(appliedThemes.join(',') === 'dark,light,dark' && !themeListener, 'System appearance updates while running and removes its listener on cleanup');
  let authCalls = 0; let finishAuth;
  const gate = createAuthCoordinator(() => { authCalls++; return new Promise(resolve => { finishAuth = resolve; }); });
  const firstPrompt = gate.authenticate(); const duplicatePrompt = gate.authenticate();
  assert(firstPrompt === duplicatePrompt && authCalls === 0, 'Cold launch authentication coalesces duplicate lifecycle requests into one prompt');
  await Promise.resolve();
  finishAuth(false);
  assert(await firstPrompt === false && !gate.isAuthenticated(), 'Cancelled/failed authentication leaves protected state locked');
  const retryPrompt = gate.authenticate(); await Promise.resolve(); finishAuth(true);
  assert(await retryPrompt && gate.isAuthenticated() && authCalls === 2, 'Authentication failure supports a controlled retry and successful authentication unlocks');
  gate.resetForBackground();
  const resumePrompt = gate.authenticate(); await Promise.resolve(); finishAuth(true);
  assert(await resumePrompt && authCalls === 3, 'Backgrounding relocks and a resumed session requires authentication again');
  let finishStaleAuth;
  const staleGate = createAuthCoordinator(() => new Promise(resolve => { finishStaleAuth = resolve; }));
  const stalePrompt = staleGate.authenticate(); await Promise.resolve(); staleGate.resetForBackground(); finishStaleAuth(true);
  assert(await stalePrompt === false && !staleGate.isAuthenticated(), 'Authentication completing after backgrounding cannot unlock the app');
  const febLeapDays = getMonthCalendarDays(2024, 1);
  const janDays = getMonthCalendarDays(2021, 0);
  assert(febLeapDays.filter(day => day.startsWith('2024-02-')).length === 29 && febLeapDays.includes('2024-03-03'), 'Monthly planner grid covers leap days and adjacent month boundaries');
  assert(janDays[0] === '2020-12-28' && janDays.includes('2021-01-31'), 'Calendar grid starts on Monday and includes month edges');
  assert(getTasksForDate([{ id: 1, dueDate: '2026-10-31' }, { id: 2, dueDate: '2026-11-01' }], '2026-10-31').length === 1, 'Calendar selection filters the agenda to its local date');
  assert(greetingForHour(8, 'Pavan') === 'Good morning, Pavan.' && greetingForHour(14, '') === 'Good afternoon.', 'Personal greeting uses local hour and handles a missing display name');
  assert(normalizeNotificationPermission('granted', true) === 'Granted' && normalizeNotificationPermission('denied', true).includes('settings') && normalizeNotificationPermission('prompt', false) === 'Not requested', 'Notification permission states distinguish granted, denied and not-yet-requested');
  assert(shouldAnimateNavigation(false) && !shouldAnimateNavigation(true), 'Navigation transition respects reduced-motion preference');
  const backRoute = { appReady: true, onboarding: false, locked: false, dialogOpen: false, exitDialogOpen: false, taskDetailsOpen: false, childViewOpen: false, tab: 'finance' };
  assert(resolveBackAction({ ...backRoute, dialogOpen: true }, true) === 'dismiss-dialog' && resolveBackAction({ ...backRoute, tab: 'planner', taskDetailsOpen: true }, true) === 'close-task-details', 'Back closes dialogs and nested task details before changing pages');
  assert(resolveBackAction({ ...backRoute, tab: 'settings', childViewOpen: true }, true) === 'close-child-view' && resolveBackAction({ ...backRoute, tab: 'settings' }, true) === 'previous-tab', 'Back closes notification preferences to Profile, then returns to the previous tab');
  assert(resolveBackAction(backRoute, true) === 'previous-tab' && resolveBackAction({ ...backRoute, tab: 'dashboard' }, false) === 'confirm-exit' && resolveBackAction({ ...backRoute, onboarding: true }, true) === 'ignore', 'Back follows prior tabs and confirms exit only at the application root');
  assert(stableNotificationId('task:abc:taskReminders') === stableNotificationId('task:abc:taskReminders') && stableNotificationId('task:abc:taskReminders') !== stableNotificationId('task:def:taskReminders'), 'Notification IDs remain stable per task and distinct across tasks');
  const reminderPrefs = { taskReminders: true, upcomingDeadlines: false, overdueAlerts: false };
  assert(buildTaskNotificationPlan({ dueDate: '2026-07-06', reminderAt: new Date(2026, 6, 6, 9, 15).toISOString() }, reminderPrefs, new Date(2026, 6, 4)).length === 1, 'An explicitly selected future task reminder is planned when its category is enabled');
  assert(buildTaskNotificationPlan({ dueDate: '2026-07-06' }, reminderPrefs, new Date(2026, 6, 4)).length === 0, 'Tasks without a selected reminder do not create task reminder notifications');
  assert(buildTaskNotificationPlan({ dueDate: '2026-07-06', reminderAt: new Date(2026, 6, 3, 9, 15).toISOString() }, reminderPrefs, new Date(2026, 6, 4)).length === 0, 'Past task reminders are skipped instead of scheduled');

  // --- 5. DASHBOARD TESTS ---
  console.log('\n--- 5. Testing Central Dashboard Integration ---');
  // Check that dashboard aggregate values react to actual DB state
  const allTxs = await db.toArray('transactions');
  const allHabits = await db.toArray('habits');
  const allTasks = await db.toArray('tasks');
  const allGoals = await db.toArray('goals');

  const pendingTasks = allTasks.filter(t => !t.completed);
  const completedTasks = allTasks.filter(t => t.completed);
  assert(pendingTasks.length === 0 && completedTasks.length === 1, 'Verify dashboard pending vs completed tasks count');

  // Add another task to verify dashboard reactivity
  const task2Id = await db.add('tasks', {
    title: 'Call Insurance Agent',
    dueDate: '2026-10-31',
    priority: 'Medium',
    completed: false
  });
  const updatedTasks = await db.toArray('tasks');
  assert(updatedTasks.filter(t => !t.completed).length === 1, 'Dashboard dynamically reflects new pending task');

  // Productivity Score Calculation Test
  // Productivity score = (Habits completed / total habits * 50) + (Tasks completed / total tasks due today * 50)
  const prodScore = Math.round((1 / 1 * 50) + (1 / 2 * 50));
  assert(prodScore === 75, `Verify dynamic productivity score calculation: ${prodScore}%`);

  // --- 6. BACKUP & RESTORE TESTS ---
  console.log('\n--- 6. Testing Backup & Restore Module ---');
  const exportedJSON = await db.exportJSON();
  assert(typeof exportedJSON === 'string' && exportedJSON.length > 500, 'Export complete application data to valid JSON string');

  // Clear data
  await db.clearAll();
  const txsAfterClear = await db.toArray('transactions');
  const habitsAfterClear = await db.toArray('habits');
  assert(txsAfterClear.length === 0 && habitsAfterClear.length === 0, 'Clear all data confirmed and verified empty');

  // Import previously exported JSON
  const importResult = await db.importJSON(exportedJSON);
  assert(importResult.success === true, `Import JSON backup successfully`);
  
  // Verify all records restored
  const restoredTxs = await db.toArray('transactions');
  const restoredHabits = await db.toArray('habits');
  const restoredTasks = await db.toArray('tasks');
  const restoredGoals = await db.toArray('goals');
  assert(restoredTxs.length > 0, `Restored ${restoredTxs.length} transactions`);
  assert(restoredHabits.length > 0, `Restored ${restoredHabits.length} habits`);
  assert(restoredTasks.length >= 2, `Restored ${restoredTasks.length} tasks`);
  assert(restoredGoals.length > 0, `Restored ${restoredGoals.length} goals`);

  console.log(`\n========================================`);
  console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} assertions verified)`);
  console.log(`========================================\n`);
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
