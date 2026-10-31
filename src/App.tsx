import React, { useState, useEffect, useMemo } from 'react';
import { Activity, CalendarDays, CheckCircle2, CircleDollarSign, Goal as GoalIcon, Home, Settings as SettingsIcon } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { StorageService, db } from './db';
import { BiometricService } from './services/biometricService';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationService } from './services/notificationService';
import type { NotificationPreferences } from './types';
import { buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, formatLocalDate, formatLocalDateTime, getGoalProgress, getTaskStatus, sortTasksByDeadline } from './services/domainUtils';

const notificationLabels: Record<keyof NotificationPreferences, string> = {
  taskReminders: 'Task reminders',
  upcomingDeadlines: 'Upcoming task deadlines',
  overdueAlerts: 'Overdue task alerts',
  habitReminders: 'Habit reminders',
  milestoneReminders: 'Goal milestone reminders',
};
import {
  Transaction,
  Category,
  Budget,
  SavingsGoal,
  Habit,
  HabitLog,
  Goal,
  Milestone,
  Task
} from './types';

export default function App() {
  // Navigation & Theme State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'finance' | 'habits' | 'goals' | 'planner' | 'settings'>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currency, setCurrency] = useState<string>('INR');
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [displayName, setDisplayName] = useState('');
  const [clockNow, setClockNow] = useState(() => new Date());
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationPermissionRequested, setNotificationPermissionRequested] = useState(false);

  // Biometric Lock State
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);

  // Core Data Collections
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Subtab & Filter States
  const [financeSubtab, setFinanceSubtab] = useState<'overview' | 'transactions' | 'budgets' | 'savings' | 'analytics'>('overview');
  const [financeMonth, setFinanceMonth] = useState<string>(formatLocalDate(new Date()).substring(0, 7));
  const [financeTypeFilter, setFinanceTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [financeCategoryFilter, setFinanceCategoryFilter] = useState<string>('all');
  const [financeSearch, setFinanceSearch] = useState<string>('');
  const [financeSort, setFinanceSort] = useState<string>('date-desc');

  const [habitsSubtab, setHabitsSubtab] = useState<'checklist' | 'weekly' | 'monthly'>('checklist');
  const [habitsSelectedDate, setHabitsSelectedDate] = useState<string>(formatLocalDate(new Date()));

  const [goalsSubtab, setGoalsSubtab] = useState<'active' | 'completed'>('active');
  const [goalsCategoryFilter, setGoalsCategoryFilter] = useState<string>('all');

  const [plannerSubtab, setPlannerSubtab] = useState<'agenda' | 'weekly' | 'all'>('agenda');
  const [plannerFilter, setPlannerFilter] = useState<'all' | 'pending' | 'overdue' | 'completed' | 'today' | 'tomorrow' | 'upcoming'>('all');
  const [plannerSearch, setPlannerSearch] = useState('');
  const [plannerPriority, setPlannerPriority] = useState('all');

  // UI Toast & Modal State
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'danger' } | null>(null);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [createKind, setCreateKind] = useState<'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution' | 'milestone' | 'goal-progress' | null>(null);
  const [createDraft, setCreateDraft] = useState<Record<string, string>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  // Load Initial Settings & Data
  useEffect(() => {
    initApp();
    const timer = window.setInterval(() => setClockNow(new Date()), 60_000);
    let appStateListener: { remove: () => Promise<void> } | undefined;
    CapacitorApp.addListener('appStateChange', async state => {
      if (!state.isActive) {
        const isBio = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
        if (isBio) setIsLocked(true);
        return;
      }
      setClockNow(new Date());
      const isBio = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
      if (isBio) triggerBiometricAuth();
      const records = await reloadAllData();
      const prefs = await StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, prefs);
    }).then(listener => { appStateListener = listener; });
    return () => {
      window.clearInterval(timer);
      appStateListener?.remove();
    };
  }, []);

  useEffect(() => {
    let listener: { remove: () => Promise<void> } | undefined;
    CapacitorApp.addListener('backButton', () => {
      if (createKind) { setCreateKind(null); return; }
      if (activeTab !== 'dashboard') { setActiveTab('dashboard'); return; }
      void CapacitorApp.exitApp();
    }).then(value => { listener = value; });
    return () => { listener?.remove(); };
  }, [activeTab, createKind]);

  const showToast = (message: string, type: 'info' | 'success' | 'danger' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const initApp = async () => {
    const savedTheme = await StorageService.settings.get<'dark' | 'light'>('theme', 'dark');
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');

    const savedCur = await StorageService.settings.get<string>('currency', 'INR');
    setCurrency(savedCur);
    setCurrencySymbol(savedCur === 'INR' ? '₹' : savedCur === 'USD' ? '$' : savedCur === 'EUR' ? '€' : savedCur === 'GBP' ? '£' : 'د.إ');
    setDisplayName(await StorageService.settings.get<string>('displayName', ''));
    const savedNotificationPreferences = await StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
    const hasRequestedNotifications = await StorageService.settings.get<boolean>('notificationPermissionRequested', false);
    setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...savedNotificationPreferences });
    setNotificationPermissionRequested(hasRequestedNotifications);

    const lockSetting = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
    setBiometricEnabled(lockSetting);

    if (lockSetting) {
      setIsLocked(true);
      triggerBiometricAuth();
    }

    const records = await reloadAllData();
    await NotificationService.ensureChannel();
    await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, { ...DEFAULT_NOTIFICATION_PREFERENCES, ...savedNotificationPreferences });
  };

  const syncNotificationSchedules = async (taskRows: Task[], habitRows: Habit[], goalRows: Goal[], milestoneRows: Milestone[], preferences = notificationPreferences) => {
    const results = await Promise.allSettled([
      NotificationService.syncTasks(taskRows, preferences),
      NotificationService.syncHabits(habitRows, preferences),
      NotificationService.syncMilestones(goalRows, milestoneRows, preferences),
    ]);
    if (results.some(result => result.status === 'rejected')) console.warn('One or more local notification schedules could not be updated.');
  };

  const updateDisplayName = async (name: string) => {
    setDisplayName(name.slice(0, 48));
    await StorageService.settings.set('displayName', name.slice(0, 48).trim());
  };

  const toggleNotificationCategory = async (key: keyof NotificationPreferences) => {
    const enabled = !notificationPreferences[key];
    if (enabled) {
      if (!NotificationService.isSupported()) {
        showToast('Local notifications are available in the Android app after installing the updated build.', 'danger');
        return;
      }
      let permission = await NotificationService.checkPermission();
      if (permission !== 'granted') {
        if (notificationPermissionRequested) {
          showToast('Notifications are blocked in Android settings. Enable them there to continue.', 'danger');
          return;
        }
        setNotificationPermissionRequested(true);
        await StorageService.settings.set('notificationPermissionRequested', true);
        permission = await NotificationService.requestPermission();
      }
      if (permission !== 'granted') {
        showToast('Notification permission was not granted. Your preferences were not changed.', 'danger');
        return;
      }
    }
    const next = { ...notificationPreferences, [key]: enabled };
    setNotificationPreferences(next);
    await StorageService.settings.set('notificationPreferences', next);
    await syncNotificationSchedules(tasks, habits, goals, milestones, next);
    showToast(`${enabled ? 'Enabled' : 'Disabled'} ${notificationLabels[key].toLowerCase()}`, 'success');
  };

  const importBackupFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const hasRecords = await Promise.all([
        db.transactions.count(), db.categories.count(), db.budgets.count(), db.savingsGoals.count(), db.savingsContributions.count(),
        db.habits.count(), db.habitLogs.count(), db.goals.count(), db.milestones.count(), db.tasks.count(), db.settings.count(),
      ]).then(counts => counts.some(count => count > 0));
      if (hasRecords && !window.confirm('This backup will replace the existing LifeOS data on this device. Export a backup first if you need a copy. Continue?')) return;
      await StorageService.backup.importData(text, { replaceExisting: true });
      const records = await reloadAllData();
      const prefs = await StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...prefs });
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, prefs);
      showToast('Backup restored successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not restore this backup', 'danger');
    }
  };

  const triggerBiometricAuth = async () => {
    const res = await BiometricService.authenticate('Unlock LifeOS', 'Confirm your fingerprint to access your personal data');
    if (res.success) {
      setIsLocked(false);
      showToast('Welcome back!', 'success');
    } else {
      showToast(res.message || 'Authentication required', 'danger');
    }
  };

  const reloadAllData = async () => {
    const [txs, cats, bgs, sgs, hbs, hLogs, gls, mls, tks] = await Promise.all([
      StorageService.transactions.getAll(),
      StorageService.categories.getAll(),
      StorageService.budgets.getAll(),
      StorageService.savings.getGoals(),
      StorageService.habits.getAll(),
      StorageService.habits.getLogs(),
      StorageService.goals.getAll(),
      db.milestones.toArray(),
      StorageService.tasks.getAll()
    ]);

    setTransactions(txs);
    setCategories(cats);
    setBudgets(bgs);
    setSavingsGoals(sgs);
    setHabits(hbs);
    setHabitLogs(hLogs);
    setGoals(gls);
    setMilestones(mls);
    setTasks(tks);
    return { tasks: tks, habits: hbs, goals: gls, milestones: mls };
  };

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    await StorageService.settings.set('theme', next);
  };

  const openCreateForm = (kind: 'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution' | 'milestone' | 'goal-progress', goalId?: string) => {
    const now = new Date();
    const today = formatLocalDate(now);
    setCreateDraft({
      title: '', amount: '', category: kind === 'goal' ? 'Other' : '', date: today, month: financeMonth,
      dateTime: formatLocalDateTime(now), time: '', reminderAt: '', description: '', notes: '',
      type: 'expense', priority: 'Medium', frequency: 'daily', target: '', current: '0', unit: '',
      goalId: goalId || '', recurring: 'None', reminderWeekday: '2',
    });
    setEditingTaskId(null);
    setEditingHabitId(null);
    setCreateKind(kind);
  };

  const openEditTask = (task: Task) => {
    setCreateDraft({
      title: task.title, description: task.description || task.notes || '', date: task.dueDate,
      time: task.dueTime || '', reminderAt: task.reminderAt ? formatLocalDateTime(new Date(task.reminderAt)) : '',
      priority: task.priority, category: task.category || '', recurring: task.recurring || 'None',
    });
    setEditingTaskId(task.id);
    setCreateKind('task');
  };

  const openGoalProgressForm = (goal: Goal) => {
    setCreateDraft({ goalId: goal.id, current: String(goal.currentValue) });
    setEditingTaskId(null);
    setCreateKind('goal-progress');
  };

  const openEditHabit = (habit: Habit) => {
    setCreateDraft({ title: habit.name, frequency: habit.frequency, reminderTime: habit.reminderTime || '', reminderWeekday: String(habit.reminderWeekday || 2) });
    setEditingHabitId(habit.id);
    setEditingTaskId(null);
    setCreateKind('habit');
  };

  const saveNewRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createKind) return;
    const value = (key: string) => (createDraft[key] || '').trim();
    try {
      if (createKind === 'transaction') {
        const amount = Number(value('amount'));
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
        const entry = buildFinanceEntry(value('dateTime'));
        await StorageService.transactions.add({
          type: value('type') as 'income' | 'expense', amount, category: value('category'),
          description: value('title'), date: entry.date, occurredAt: entry.occurredAt, paymentMethod: value('paymentMethod') || 'Other',
        });
      } else if (createKind === 'habit') {
        const habit: Partial<Habit> = { name: value('title'), frequency: value('frequency') as Habit['frequency'], color: '#6366f1', reminderTime: value('reminderTime') || undefined, reminderWeekday: value('frequency') === 'weekly' ? Number(value('reminderWeekday')) : undefined };
        if (editingHabitId) await StorageService.habits.update(editingHabitId, habit);
        else await StorageService.habits.add({ ...habit, name: habit.name!, frequency: habit.frequency!, color: habit.color! });
      } else if (createKind === 'budget') {
        const monthlyAmount = Number(value('amount'));
        if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) throw new Error('Enter a budget greater than zero.');
        await StorageService.budgets.upsert({ monthlyAmount, monthYear: value('month') });
      } else if (createKind === 'savings') {
        const targetAmount = Number(value('target'));
        const currentAmount = Number(value('current'));
        if (!Number.isFinite(targetAmount) || targetAmount <= 0 || !Number.isFinite(currentAmount) || currentAmount < 0) {
          throw new Error('Enter a positive savings target and a valid current amount.');
        }
        await StorageService.savings.addGoal({ title: value('title'), targetAmount, currentAmount, targetDate: value('date'), category: value('category') || undefined });
      } else if (createKind === 'contribution') {
        const amount = Number(value('amount'));
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a contribution greater than zero.');
        await StorageService.savings.addContribution({ goalId: value('goalId'), amount, date: value('date'), notes: value('notes') || undefined });
      } else if (createKind === 'milestone') {
        await StorageService.goals.addMilestone({ goalId: value('goalId'), title: value('title'), targetDate: value('date') || undefined, completed: false });
      } else if (createKind === 'goal-progress') {
        const currentValue = Number(value('current'));
        const goal = goals.find(item => item.id === value('goalId'));
        if (!goal || !Number.isFinite(currentValue) || currentValue < 0) throw new Error('Choose a goal and enter valid progress.');
        await StorageService.goals.update(goal.id, { currentValue });
      } else if (createKind === 'goal') {
        const targetValue = Number(value('target'));
        const currentValue = Number(value('current'));
        if (!Number.isFinite(targetValue) || targetValue <= 0 || !Number.isFinite(currentValue) || currentValue < 0) {
          throw new Error('Enter a positive target and a valid current progress value.');
        }
        await StorageService.goals.add({
          title: value('title'), category: value('category') as Goal['category'], targetValue,
          currentValue, unit: value('unit') || undefined, startDate: value('startDate') || value('date'),
          targetDate: value('date'), priority: value('priority') as Goal['priority'], status: 'In Progress',
        });
      } else {
        const reminderAt = value('reminderAt') ? new Date(value('reminderAt')).toISOString() : undefined;
        const taskUpdates: Partial<Task> = {
          title: value('title'), description: value('description') || undefined, notes: value('description') || undefined,
          dueDate: value('date'), dueTime: value('time') || undefined, reminderAt,
          priority: value('priority') as Task['priority'], category: value('category') || undefined,
          recurring: value('recurring') as Task['recurring'],
        };
        if (editingTaskId) await StorageService.tasks.update(editingTaskId, taskUpdates);
        else await StorageService.tasks.add({ ...taskUpdates, title: taskUpdates.title!, dueDate: taskUpdates.dueDate!, priority: taskUpdates.priority!, recurring: taskUpdates.recurring!, completed: false });
      }
      const records = await reloadAllData();
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
      setCreateKind(null);
      const wasEditingTask = editingTaskId;
      const wasEditingHabit = editingHabitId;
      setEditingTaskId(null);
      setEditingHabitId(null);
      showToast(wasEditingTask ? 'Task updated' : wasEditingHabit ? 'Habit updated' : createKind === 'milestone' ? 'Milestone added' : createKind === 'goal-progress' ? 'Goal progress updated' : `${createKind[0].toUpperCase()}${createKind.slice(1)} added`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save this item', 'danger');
    }
  };

  const formatMoney = (amount: number) => {
    const num = Number(amount) || 0;
    if (currency === 'INR') {
      return currencySymbol + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }
    return currencySymbol + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const previousMonthKey = (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number);
    const previous = new Date(year, month - 2, 1);
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
  };

  const getDaysRemainingText = (targetDateStr: string) => {
    if (!targetDateStr) return '';
    const todayParts = formatLocalDate(clockNow).split('-').map(Number);
    const targetParts = targetDateStr.split('-').map(Number);
    const todayOrdinal = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const targetOrdinal = Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2]);
    const diffDays = Math.round((targetOrdinal - todayOrdinal) / 86400000);
    if (diffDays === 0) return 'Due today';
    if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
    return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
  };

  // Financial Metrics Calculation
  const financeMetrics = useMemo(() => {
    const monthlyTxs = transactions.filter(t => t.date && t.date.startsWith(financeMonth));
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryExpenses: Record<string, number> = {};

    for (const tx of monthlyTxs) {
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

    let totalBudget = 0;
    for (const b of budgets) {
      if (!b.categoryId && (!b.monthYear || b.monthYear === financeMonth)) {
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
      categoryExpenses,
      previousMonthIncome: transactions.filter(t => t.date?.startsWith(previousMonthKey(financeMonth)) && t.type === 'income').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
      previousMonthExpenses: transactions.filter(t => t.date?.startsWith(previousMonthKey(financeMonth)) && t.type === 'expense').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
      count: monthlyTxs.length
    };
  }, [transactions, budgets, financeMonth]);

  // Habit Streak Calculation Helper
  const getHabitStreaks = (habitId: string, targetDate: string) => {
    const stats = calculateStreaks(habitLogs, habitId, targetDate);
    return { ...stats, totalCount: new Set(habitLogs.filter(log => log.habitId === habitId && log.completed).map(log => log.date)).size };
  };

  // Productivity Score Calculation
  const productivityScore = useMemo(() => {
    const todayStr = formatLocalDate(clockNow);
    const completedHabits = habits.filter(h => getHabitStreaks(h.id, todayStr).completedToday).length;
    const habitWeight = habits.length > 0 ? (completedHabits / habits.length) * 50 : 50;

    const todayTasks = tasks.filter(t => t.dueDate === todayStr || (!t.dueDate && !t.completed));
    const completedTasks = todayTasks.filter(t => t.completed).length;
    const taskWeight = todayTasks.length > 0 ? (completedTasks / todayTasks.length) * 50 : 50;

    return Math.min(100, Math.round(habitWeight + taskWeight));
  }, [habits, habitLogs, tasks, clockNow]);

  const todayKey = formatLocalDate(clockNow);
  const tomorrowDate = new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() + 1);
  const tomorrowKey = formatLocalDate(tomorrowDate);
  const dashboardTasks = useMemo(() => sortTasksByDeadline(tasks.filter(task => getTaskStatus(task, clockNow) === 'Overdue' || task.dueDate === todayKey), clockNow).slice(0, 5), [tasks, clockNow, todayKey]);
  const visiblePlannerTasks = useMemo(() => sortTasksByDeadline(tasks.filter(task => {
    const status = getTaskStatus(task, clockNow);
    const statusMatch = plannerFilter === 'all' || plannerFilter === 'today' || plannerFilter === 'tomorrow' || plannerFilter === 'upcoming'
      ? true : status.toLowerCase() === plannerFilter;
    const dateMatch = plannerFilter === 'today' ? task.dueDate === todayKey
      : plannerFilter === 'tomorrow' ? task.dueDate === tomorrowKey
        : plannerFilter === 'upcoming' ? task.dueDate > tomorrowKey && task.dueDate <= formatLocalDate(new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() + 7))
          : true;
    const query = plannerSearch.trim().toLowerCase();
    const searchMatch = !query || `${task.title} ${task.description || ''} ${task.notes || ''} ${task.category || ''}`.toLowerCase().includes(query);
    return statusMatch && dateMatch && searchMatch && (plannerPriority === 'all' || task.priority === plannerPriority);
  }), clockNow), [tasks, clockNow, plannerFilter, plannerSearch, plannerPriority, todayKey, tomorrowKey]);

  const goalProgress = (goal: Goal) => getGoalProgress(goal.currentValue, goal.targetValue);
  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    const query = financeSearch.trim().toLowerCase();
    const haystack = `${tx.description || ''} ${tx.category || ''} ${tx.notes || ''} ${tx.paymentMethod || ''}`.toLowerCase();
    return tx.date?.startsWith(financeMonth)
      && (financeTypeFilter === 'all' || tx.type === financeTypeFilter)
      && (financeCategoryFilter === 'all' || tx.category === financeCategoryFilter)
      && (!query || haystack.includes(query));
  }).sort((a, b) => financeSort === 'date-asc' ? (a.date || '').localeCompare(b.date || '')
    : financeSort === 'amount-desc' ? b.amount - a.amount : (b.date || '').localeCompare(a.date || '')),
  [transactions, financeMonth, financeTypeFilter, financeCategoryFilter, financeSearch, financeSort]);

  // If App is Biometrically Locked, render Lock Screen Overlay
  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 bg-[#090d16] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">LifeOS is Locked</h2>
        <p className="text-sm text-slate-400 mb-8 max-w-xs">Biometric authentication is required to protect your personal data.</p>
        <button
          onClick={triggerBiometricAuth}
          className="w-full max-w-xs py-3.5 px-6 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/30 active:scale-95 transition"
        >
          Verify Biometrics
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'}`} style={{ paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom))' }}>
      {/* Top Mobile Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center max-w-md mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-sm">L</div>
          <div>
            <h1 className="text-base font-bold leading-tight">LifeOS</h1>
            <p className="text-[10px] text-slate-400">Offline Personal Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Offline Active</span>
          <button onClick={toggleTheme} className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm">
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* VIEW 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-400">{clockNow.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              <h2 className="text-xl font-bold mt-0.5">{displayName.trim() ? `Welcome back, ${displayName.trim()}!` : 'Welcome back!'}</h2>
            </div>

            {/* Productivity Score Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-blue-950/30 border border-indigo-800/40">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Daily Performance</span>
                  <h3 className="text-lg font-bold mt-1">Productivity Score</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{productivityScore}% adherence today</p>
                </div>
                <div className="w-14 h-14 rounded-full border-4 border-indigo-500 bg-slate-900 flex items-center justify-center text-base font-black text-indigo-400">
                  {productivityScore}%
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 mt-3 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${productivityScore}%` }} />
              </div>
            </div>

            {/* Active Goals Summary */}
            <section className="rounded-2xl border border-violet-800/40 bg-gradient-to-br from-violet-950/35 to-indigo-950/25 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Goals</p><h3 className="text-sm font-semibold">{goals.filter(goal => goal.status === 'In Progress').length} active goals</h3></div>
                <button onClick={() => setActiveTab('goals')} className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-300" aria-label="Open Goals">View all →</button>
              </div>
              {goals.filter(goal => goal.status === 'In Progress').length === 0 ? (
                <div className="rounded-xl bg-slate-900/50 px-3 py-4 text-center text-xs text-slate-400"><p>No active goals yet.</p><button onClick={() => { setActiveTab('goals'); openCreateForm('goal'); }} className="mt-2 font-semibold text-violet-300">Create your first goal</button></div>
              ) : <div className="space-y-3">{goals.filter(goal => goal.status === 'In Progress').slice(0, 3).map(goal => {
                const progress = goalProgress(goal);
                return <button key={goal.id} onClick={() => setActiveTab('goals')} className="block w-full rounded-xl bg-slate-900/55 p-3 text-left">
                  <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{goal.title}</span><span className="shrink-0 text-xs font-bold text-violet-300">{progress}%</span></div>
                  <div className="my-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${progress}%` }} /></div>
                  <div className="flex justify-between gap-2 text-[10px] text-slate-400"><span>{goal.currentValue} / {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ''}</span><span>{formatDate(goal.targetDate)} · {getDaysRemainingText(goal.targetDate)}</span></div>
                </button>;
              })}</div>}
            </section>

            {/* Financial Overview Card */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Monthly Finance ({financeMonth})</h3>
                <button onClick={() => setActiveTab('finance')} className="text-xs text-indigo-400 font-semibold">Details &rarr;</button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="p-3 rounded-xl bg-slate-800/60">
                  <p className="text-xs text-slate-400">Total Income</p>
                  <p className="text-base font-bold text-emerald-400 mt-0.5">{formatMoney(financeMetrics.totalIncome)}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/60">
                  <p className="text-xs text-slate-400">Total Expenses</p>
                  <p className="text-base font-bold text-rose-400 mt-0.5">{formatMoney(financeMetrics.totalExpenses)}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Net Balance: <strong className={financeMetrics.remainingBalance >= 0 ? 'text-white' : 'text-rose-400'}>{formatMoney(financeMetrics.remainingBalance)}</strong></span>
                <span>Savings: <strong className="text-indigo-400">{financeMetrics.savingsRate}%</strong></span>
              </div>
            </div>

            {/* Today's Habits Summary */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Habits Today</h3>
                <button onClick={() => setActiveTab('habits')} className="text-xs text-indigo-400 font-semibold">Manage</button>
              </div>
              {habits.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No habits configured yet. Create one in Habits tab.</div>
              ) : (
                <div className="space-y-2">
                  {habits.slice(0, 4).map(h => {
                    const todayStr = todayKey;
                    const stats = getHabitStreaks(h.id, todayStr);
                    return (
                      <div key={h.id} className="p-3 rounded-xl bg-slate-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={async () => {
                              await StorageService.habits.logCompletion(h.id, todayStr, !stats.completedToday);
                              const records = await reloadAllData();
                              await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
                            }}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs transition ${stats.completedToday ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600'}`}
                          >
                            {stats.completedToday ? '✓' : ''}
                          </button>
                          <div>
                            <p className={`text-sm font-medium ${stats.completedToday ? 'line-through text-slate-500' : ''}`}>{h.name}</p>
                            <p className="text-[10px] text-amber-400 font-semibold">🔥 {stats.currentStreak} day streak</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Tasks */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Today's Agenda</h3>
                <button onClick={() => setActiveTab('planner')} className="text-xs text-indigo-400 font-semibold">All Tasks</button>
              </div>
              {dashboardTasks.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No tasks due today. You're all caught up!</div>
              ) : (
                <div className="space-y-2">
                  {dashboardTasks.map(t => {
                    const status = getTaskStatus(t, clockNow);
                    return <div key={t.id} className={`p-3 rounded-xl border flex items-center justify-between ${status === 'Overdue' ? 'border-rose-500/40 bg-rose-950/35' : 'border-slate-800 bg-slate-800/60'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={async () => {
                            await StorageService.tasks.toggleCompleted(t.id, !t.completed);
                            if (!t.completed) await NotificationService.cancelTask(t);
                            const records = await reloadAllData();
                            await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
                            showToast('Task updated', 'success');
                          }}
                          className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                        />
                        <div>
                          <p className="text-sm font-medium">{t.title}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(t.dueDate)}{t.dueTime ? ` · ${t.dueTime}` : ''}</p>
                          <div className="mt-1 flex flex-wrap gap-1"><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${t.priority === 'Urgent' ? 'bg-rose-500/20 text-rose-400' : t.priority === 'High' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>{t.priority}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${status === 'Overdue' ? 'bg-rose-500/20 text-rose-300' : status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{status}</span></div>
                        </div>
                      </div>
                    </div>
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: FINANCE */}
        {activeTab === 'finance' && (
          <div className="space-y-4">
            <div className="flex bg-slate-900 p-1 rounded-xl gap-1 text-xs font-semibold overflow-x-auto">
              {(['overview', 'transactions', 'budgets', 'savings', 'analytics'] as const).map(sub => (
                <button
                  key={sub}
                  onClick={() => setFinanceSubtab(sub)}
                  className={`flex-1 py-2 px-3 rounded-lg capitalize whitespace-nowrap ${financeSubtab === sub ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {/* Overview Subtab */}
            {financeSubtab === 'overview' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold">Monthly Focus</h3>
                  <input
                    type="month"
                    value={financeMonth}
                    onChange={(e) => setFinanceMonth(e.target.value)}
                    className="p-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-400">Total Income</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">{formatMoney(financeMetrics.totalIncome)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-400">Total Expenses</p>
                    <p className="text-xl font-bold text-rose-400 mt-1">{formatMoney(financeMetrics.totalExpenses)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-400">Remaining Balance</p>
                    <p className="text-xl font-bold mt-1">{formatMoney(financeMetrics.remainingBalance)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-400">Savings Rate</p>
                    <p className="text-xl font-bold text-indigo-400 mt-1">{financeMetrics.savingsRate}%</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-semibold">Month-over-month</h4><span className="text-[10px] text-slate-400">vs {previousMonthKey(financeMonth)}</span></div>
                  {[{ label: 'Income', current: financeMetrics.totalIncome, previous: financeMetrics.previousMonthIncome, color: 'bg-emerald-500' }, { label: 'Expenses', current: financeMetrics.totalExpenses, previous: financeMetrics.previousMonthExpenses, color: 'bg-rose-500' }].map(row => {
                    const max = Math.max(row.current, row.previous, 1);
                    return <div key={row.label} className="mb-3 last:mb-0"><div className="mb-1 flex justify-between text-[10px]"><span>{row.label}</span><span>{formatMoney(row.current)} <span className="text-slate-500">· {formatMoney(row.previous)}</span></span></div><div className="flex h-2 gap-1"><div className={`h-full rounded ${row.color}`} style={{ width: `${row.current / max * 100}%` }} /><div className="h-full rounded bg-slate-600" style={{ width: `${row.previous / max * 100}%` }} /></div></div>;
                  })}
                  <p className="mt-2 text-[9px] text-slate-500">Current month · previous month</p>
                </div>

                {/* Quick Add Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openCreateForm('transaction')}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-xs active:scale-95 transition"
                  >
                    + Record Transaction
                  </button>
                </div>
              </div>
            )}

            {/* Transactions Subtab */}
            {financeSubtab === 'transactions' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search description, category..."
                    value={financeSearch}
                    onChange={(e) => setFinanceSearch(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <button onClick={() => openCreateForm('transaction')} className="shrink-0 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white">+ Add</button>
                </div>
                <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-400">Month<input aria-label="Transaction month" type="month" value={financeMonth} onChange={e => setFinanceMonth(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-white" /></label><label className="text-[10px] text-slate-400">Category<select value={financeCategoryFilter} onChange={e => setFinanceCategoryFilter(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-white"><option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label></div>

                {/* Filters */}
                <div className="flex gap-1.5 overflow-x-auto text-xs pb-1">
                  {(['all', 'income', 'expense'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFinanceTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-full capitalize whitespace-nowrap ${financeTypeFilter === t ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <label className="flex items-center justify-between text-[10px] text-slate-400">Sort<select value={financeSort} onChange={e => setFinanceSort(e.target.value)} className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-white"><option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option><option value="amount-desc">Largest amount</option></select></label>

                {/* Transactions List */}
                <div className="space-y-2">
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">No transactions match these filters.</div>
                  ) : (
                    filteredTransactions.map(t => (
                        <div key={t.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-sm">{t.description || t.category}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(t.date)}{t.occurredAt ? ` · ${new Date(t.occurredAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''} &bull; {t.category} ({t.paymentMethod})</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                            </p>
                            <button
                              onClick={async () => {
                                await StorageService.transactions.delete(t.id);
                                await reloadAllData();
                                showToast('Transaction deleted', 'info');
                              }}
                              className="text-[10px] text-slate-500 hover:text-rose-400 mt-1"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {financeSubtab === 'budgets' && <div className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Monthly budgets</h3><p className="text-xs text-slate-400">Track spending against a monthly limit</p></div><button onClick={() => openCreateForm('budget')} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">+ Add budget</button></div>
              {budgets.filter(b => !b.monthYear || b.monthYear === financeMonth).length === 0 ? <div className="rounded-2xl border border-slate-800 bg-slate-900 py-8 text-center text-sm text-slate-400">No budget set for {financeMonth}.</div> : budgets.filter(b => !b.monthYear || b.monthYear === financeMonth).map(b => {
                const spent = b.categoryId ? (financeMetrics.categoryExpenses[b.categoryId] || 0) : financeMetrics.totalExpenses;
                const pct = b.monthlyAmount > 0 ? Math.min(100, Math.round(spent / b.monthlyAmount * 100)) : 0;
                return <div key={b.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between text-sm"><strong>{b.categoryId || 'Overall budget'}</strong><span>{formatMoney(spent)} / {formatMoney(b.monthlyAmount)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} /></div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>{pct}% used</span><span>{formatMoney(Math.max(0, b.monthlyAmount - spent))} remaining</span></div><button onClick={async () => { await StorageService.budgets.delete(b.id); await reloadAllData(); showToast('Budget deleted', 'info'); }} className="mt-2 text-xs text-slate-400">Delete</button></div>;
              })}
            </div>}

            {financeSubtab === 'savings' && <div className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Savings goals</h3><p className="text-xs text-slate-400">Build toward the things you care about</p></div><button onClick={() => openCreateForm('savings')} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">+ Add goal</button></div>
              {savingsGoals.length === 0 ? <div className="rounded-2xl border border-slate-800 bg-slate-900 py-8 text-center text-sm text-slate-400">No savings goals yet.</div> : savingsGoals.map(goal => {
                const pct = goal.targetAmount > 0 ? Math.min(100, Math.round(goal.currentAmount / goal.targetAmount * 100)) : 0;
                return <div key={goal.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between gap-3"><div><h4 className="font-semibold">{goal.title}</h4><p className="text-xs text-slate-400">{goal.category || 'Personal'} · target {formatDate(goal.targetDate)}</p></div><span className="text-sm font-bold text-indigo-400">{pct}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>{formatMoney(goal.currentAmount)} saved</span><span>of {formatMoney(goal.targetAmount)}</span></div><div className="mt-3 flex gap-4"><button onClick={() => { setCreateDraft({ goalId: goal.id, date: new Date().toISOString().slice(0, 10), amount: '', notes: '' }); setCreateKind('contribution'); }} className="text-xs font-semibold text-indigo-400">Add contribution</button><button onClick={async () => { await StorageService.savings.deleteGoal(goal.id); await reloadAllData(); showToast('Savings goal deleted', 'info'); }} className="text-xs text-slate-400">Delete</button></div></div>;
              })}
            </div>}

            {financeSubtab === 'analytics' && <div className="space-y-3">
              <div><h3 className="font-semibold">Spending breakdown</h3><p className="text-xs text-slate-400">Expenses in {financeMonth}</p></div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="mb-4 flex justify-between text-sm"><span>Total expenses</span><strong>{formatMoney(financeMetrics.totalExpenses)}</strong></div>{Object.entries(financeMetrics.categoryExpenses).length === 0 ? <p className="py-4 text-center text-sm text-slate-400">No expenses to analyze yet.</p> : Object.entries(financeMetrics.categoryExpenses).sort((a, b) => b[1] - a[1]).map(([category, amount]) => <div key={category} className="mb-3 last:mb-0"><div className="mb-1 flex justify-between text-xs"><span>{category}</span><span>{formatMoney(amount)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${financeMetrics.totalExpenses ? amount / financeMetrics.totalExpenses * 100 : 0}%` }} /></div></div>)}</div>
            </div>}
          </div>
        )}

        {/* VIEW 3: HABITS */}
        {activeTab === 'habits' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Habit Tracker</h2>
                <p className="text-xs text-slate-400">Daily consistency monitor</p>
              </div>
              <button onClick={() => openCreateForm('habit')} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">+ Add habit</button>
            </div>
            <label className="block text-xs text-slate-400">Completion date<input type="date" max={todayKey} value={habitsSelectedDate} onChange={e => setHabitsSelectedDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm" /></label>

            <div className="space-y-2">
              {habits.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">No habits added. Tap demo data in Settings or create custom habits.</div>
              ) : (
                habits.map(h => {
                  const todayStr = habitsSelectedDate;
                  const stats = getHabitStreaks(h.id, todayStr);
                  const weekly = calculateWeeklyHabitRate(habitLogs, h.id, clockNow);
                  const historyDays = Array.from({ length: 7 }, (_, index) => new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() - 6 + index));
                  return (
                    <div key={h.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button aria-label={`Mark ${h.name} ${stats.completedToday ? 'incomplete' : 'complete'}`} onClick={async () => { await StorageService.habits.logCompletion(h.id, todayStr, !stats.completedToday); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast(stats.completedToday ? 'Habit unmarked' : 'Habit finished!', 'success'); }} className={`h-9 w-9 shrink-0 rounded-full border-2 text-sm ${stats.completedToday ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-600'}`}>{stats.completedToday ? '✓' : ''}</button><div className="min-w-0"><p className={`truncate font-semibold text-sm ${stats.completedToday ? 'line-through text-slate-500' : ''}`}>{h.name}</p><p className="text-[10px] text-amber-400">🔥 {stats.currentStreak} day streak · best {stats.longestStreak}</p></div></div><div className="flex gap-1"><button onClick={() => openEditHabit(h)} className="rounded-lg px-2 py-1 text-xs text-indigo-400">Edit</button><button onClick={async () => { if (!window.confirm(`Delete habit “${h.name}” and its completion history?`)) return; await NotificationService.cancelHabit(h); await StorageService.habits.delete(h.id); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Habit removed', 'info'); }} className="rounded-lg px-2 py-1 text-xs text-slate-400">Delete</button></div></div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span>Weekly completion</span><span>{weekly.completed}/7 days · {weekly.rate}%</span></div><div className="mt-1 flex gap-1">{historyDays.map(day => { const dayKey = formatLocalDate(day); const done = habitLogs.some(log => log.habitId === h.id && log.date === dayKey && log.completed); return <span key={dayKey} title={`${dayKey}: ${done ? 'complete' : 'missed'}`} className={`h-2 flex-1 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-700'}`} />; })}</div>
                      {h.reminderTime && <p className="mt-2 text-[10px] text-slate-400">Reminder · {h.reminderTime} local</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: GOALS */}
        {activeTab === 'goals' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Personal Goals</h2><button onClick={() => openCreateForm('goal')} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">+ Add goal</button></div>
            <div className="flex gap-2"><button onClick={() => setGoalsSubtab('active')} className={`flex-1 rounded-xl px-3 py-2 text-xs ${goalsSubtab === 'active' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Active</button><button onClick={() => setGoalsSubtab('completed')} className={`flex-1 rounded-xl px-3 py-2 text-xs ${goalsSubtab === 'completed' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Completed</button></div>
            <select aria-label="Goal category" value={goalsCategoryFilter} onChange={e => setGoalsCategoryFilter(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs"><option value="all">All categories</option>{['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => <option key={category}>{category}</option>)}</select>
            {goals.filter(goal => (goalsSubtab === 'completed' ? goal.status === 'Completed' : goal.status === 'In Progress') && (goalsCategoryFilter === 'all' || goal.category === goalsCategoryFilter)).length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-10 text-center text-sm text-slate-400">{goalsSubtab === 'completed' ? 'Completed goals will appear here.' : 'No active goals yet. Set a goal to start tracking progress.'}</div>
            ) : (
              goals.filter(goal => (goalsSubtab === 'completed' ? goal.status === 'Completed' : goal.status === 'In Progress') && (goalsCategoryFilter === 'all' || goal.category === goalsCategoryFilter)).map(g => {
                const pct = goalProgress(g);
                const goalMilestones = milestones.filter(milestone => milestone.goalId === g.id);
                return <div key={g.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-sm">{g.title}</h4><p className="text-[10px] text-slate-400">{g.category} · target {formatDate(g.targetDate)} · {getDaysRemainingText(g.targetDate)}</p></div><span className="text-sm font-bold text-indigo-400">{pct}%</span></div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                  <div className="flex justify-between text-xs text-slate-400"><span>{g.currentValue} / {g.targetValue}{g.unit ? ` ${g.unit}` : ''}</span><span>{goalMilestones.filter(milestone => milestone.completed).length}/{goalMilestones.length} milestones</span></div>
                  <div className="flex flex-wrap gap-2"><button onClick={() => openGoalProgressForm(g)} className="rounded-lg bg-slate-800 px-2.5 py-2 text-[10px] font-semibold text-indigo-300">Update progress</button>{goalsSubtab === 'active' && <button onClick={() => openCreateForm('milestone', g.id)} className="rounded-lg bg-slate-800 px-2.5 py-2 text-[10px] font-semibold text-slate-200">+ Milestone</button>}<button onClick={async () => { await StorageService.goals.update(g.id, { status: goalsSubtab === 'completed' ? 'In Progress' : 'Completed' }); await reloadAllData(); showToast(goalsSubtab === 'completed' ? 'Goal reopened' : 'Goal completed', 'success'); }} className="rounded-lg bg-slate-800 px-2.5 py-2 text-[10px] font-semibold text-emerald-300">{goalsSubtab === 'completed' ? 'Reopen' : 'Complete'}</button><button onClick={async () => { if (!window.confirm(`Delete goal “${g.title}” and its milestones?`)) return; await NotificationService.cancelMilestones(goalMilestones); await StorageService.goals.delete(g.id); await reloadAllData(); showToast('Goal deleted', 'info'); }} className="rounded-lg bg-slate-800 px-2.5 py-2 text-[10px] text-rose-300">Delete</button></div>
                  {goalMilestones.length > 0 && <div className="space-y-2 border-t border-slate-800 pt-3">{goalMilestones.map(milestone => <div key={milestone.id} className="flex items-center gap-2"><input aria-label={`Mark ${milestone.title} complete`} type="checkbox" checked={milestone.completed} onChange={async () => { await StorageService.goals.toggleMilestone(milestone.id, !milestone.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} className="h-4 w-4 accent-indigo-500" /><div className="min-w-0 flex-1"><p className={`text-xs ${milestone.completed ? 'text-slate-500 line-through' : ''}`}>{milestone.title}</p>{milestone.targetDate && <p className="text-[9px] text-slate-500">{formatDate(milestone.targetDate)} · {getDaysRemainingText(milestone.targetDate)}</p>}</div></div>)}</div>}
                </div>;
              })
            )}
          </div>
        )}

        {/* VIEW 5: PLANNER */}
        {activeTab === 'planner' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Daily Tasks & Agenda</h2><button onClick={() => openCreateForm('task')} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">+ Add task</button></div>
            <input value={plannerSearch} onChange={e => setPlannerSearch(e.target.value)} placeholder="Search tasks and descriptions" className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm" />
            <div className="grid grid-cols-2 gap-2"><select aria-label="Task filter" value={plannerFilter} onChange={e => setPlannerFilter(e.target.value as typeof plannerFilter)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs">{['all', 'today', 'tomorrow', 'upcoming', 'pending', 'overdue', 'completed'].map(filter => <option key={filter} value={filter}>{filter[0].toUpperCase() + filter.slice(1)}</option>)}</select><select aria-label="Task priority filter" value={plannerPriority} onChange={e => setPlannerPriority(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs"><option value="all">All priorities</option>{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></div>
            {visiblePlannerTasks.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 py-10 text-center text-sm text-slate-400">No tasks match this view. Add a task or change the filters.</div>
            ) : (
              <div className="space-y-2">
                {visiblePlannerTasks.map(t => {
                  const status = getTaskStatus(t, clockNow);
                  return <div key={t.id} className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 ${status === 'Overdue' ? 'border-rose-500/40 bg-rose-950/25' : 'border-slate-800 bg-slate-900'}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={t.completed}
                        onChange={async () => {
                          await StorageService.tasks.toggleCompleted(t.id, !t.completed);
                          if (!t.completed) await NotificationService.cancelTask(t);
                          const records = await reloadAllData();
                          await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
                        }}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      />
                      <div>
                        <p className={`text-sm font-medium ${t.completed ? 'line-through text-slate-500' : ''}`}>{t.title}</p>
                        {t.description && <p className="mt-0.5 text-xs text-slate-400">{t.description}</p>}
                        <p className="text-xs text-slate-400">Due {formatDate(t.dueDate)}{t.dueTime ? ` · ${t.dueTime}` : ' · end of day'}</p>
                        <div className="mt-1 flex gap-1"><span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">{t.priority}</span><span className={`rounded px-1.5 py-0.5 text-[9px] ${status === 'Overdue' ? 'bg-rose-500/20 text-rose-300' : status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'}`}>{status}</span>{t.recurring !== 'None' && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">{t.recurring}</span>}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2"><button onClick={() => openEditTask(t)} className="rounded-lg px-2 py-1 text-xs text-indigo-400">Edit</button><button onClick={async () => { if (!window.confirm(`Delete “${t.title}”?`)) return; await NotificationService.cancelTask(t); await StorageService.tasks.delete(t.id); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Task removed', 'info'); }} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-rose-400">Delete</button></div>
                  </div>
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 6: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Settings & System</h2>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Profile</h3>
              <label className="block text-xs text-slate-300">Display name<input value={displayName} maxLength={48} onChange={event => { void updateDisplayName(event.target.value); }} placeholder="What should LifeOS call you?" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <p className="text-[11px] text-slate-500">Your name is stored on this device and appears on your dashboard.</p>
              <div className="flex items-center justify-between"><span className="text-xs font-medium">Appearance</span><button onClick={async () => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); document.documentElement.classList.toggle('dark', next === 'dark'); await StorageService.settings.set('theme', next); }} className="min-h-10 rounded-xl bg-slate-800 px-4 text-xs font-semibold">Switch to {theme === 'dark' ? 'light' : 'dark'} theme</button></div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Local notifications</h3>
              <p className="text-xs text-slate-400">Notifications are scheduled on this device. Android may deliver them approximately unless exact alarm access is granted; LifeOS does not request that special access.</p>
              {!NotificationService.isSupported() && <p className="text-[11px] text-amber-300">Install the updated Android build to use local notifications.</p>}
              {(Object.keys(notificationLabels) as (keyof NotificationPreferences)[]).map(key => <div key={key} className="flex min-h-11 items-center justify-between gap-3 border-t border-slate-800 pt-2"><span className="text-xs">{notificationLabels[key]}</span><button role="switch" aria-checked={notificationPreferences[key]} onClick={() => void toggleNotificationCategory(key)} className={`min-h-9 min-w-14 rounded-full px-3 text-[11px] font-bold ${notificationPreferences[key] ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{notificationPreferences[key] ? 'On' : 'Off'}</button></div>)}
            </section>

            {/* Biometric Security */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold">Biometric Security</h3>
              <p className="text-xs text-slate-400">Protects LifeOS using Android 16 BiometricPrompt (fingerprint or device PIN).</p>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-medium">Biometric Lock</span>
                <button
                  onClick={async () => {
                    const avail = await BiometricService.isAvailable();
                    if (!biometricEnabled && !avail.isAvailable) {
                      showToast('Biometrics not enrolled or supported on this device', 'danger');
                      return;
                    }
                    const next = !biometricEnabled;
                    setBiometricEnabled(next);
                    await StorageService.settings.set('biometricLockEnabled', next);
                    showToast(next ? 'Biometric Lock enabled' : 'Biometric Lock disabled', 'info');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold ${biometricEnabled ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}
                >
                  {biometricEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            {/* Demo Data Trigger */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold">Sample Demonstration Data</h3>
              <p className="text-xs text-slate-400">Load sample transactions, habits, goals, and tasks to evaluate all features.</p>
              <button
                onClick={async () => {
                  await StorageService.backup.seedDemoData();
                  await reloadAllData();
                  showToast('Sample demonstration data loaded', 'success');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition"
              >
                Load Sample Demo Data
              </button>
            </div>

            {/* Backup & Restore */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold">Backup & Restore</h3>
              <p className="text-xs text-slate-400">Export or restore your full database as a validated JSON file.</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const json = await StorageService.backup.exportData();
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lifeos-backup-${formatLocalDate(new Date())}.json`;
                    a.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    showToast('Backup JSON exported', 'success');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold"
                >
                  Export JSON
                </button>
                <button onClick={() => document.getElementById('lifeos-backup-import')?.click()} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-white">Restore JSON</button>
              </div>
              <input id="lifeos-backup-import" type="file" accept="application/json,.json" className="hidden" onChange={event => { void importBackupFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
              <button onClick={() => {
                const rows = transactions.map(tx => [tx.id, tx.type, tx.description, tx.amount, tx.category, tx.date, formatLocalDateTime(new Date(tx.occurredAt || tx.createdAt)), tx.paymentMethod || '']);
                const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
                const csv = [['id', 'type', 'description', 'amount', 'category', 'date', 'entry_time', 'payment_method'], ...rows].map(row => row.map(quote).join(',')).join('\n');
                const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `lifeos-transactions-${formatLocalDate(new Date())}.csv`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('Transactions CSV exported', 'success');
              }} className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-white">Export transactions CSV</button>
            </div>

            {/* Danger Zone */}
            <div className="p-4 rounded-xl bg-slate-900 border border-rose-900/50 space-y-3">
              <h3 className="text-sm font-semibold text-rose-400">Data Reset</h3>
              <p className="text-xs text-slate-400">Permanently erase all personal database records.</p>
              <button
                onClick={async () => {
                  if (!window.confirm('Permanently erase all LifeOS data stored on this device? This cannot be undone.')) return;
                  await Promise.all([NotificationService.syncTasks([], DEFAULT_NOTIFICATION_PREFERENCES), NotificationService.syncHabits([], DEFAULT_NOTIFICATION_PREFERENCES), NotificationService.syncMilestones([], [], DEFAULT_NOTIFICATION_PREFERENCES)]);
                  await StorageService.backup.clearAll();
                  await reloadAllData();
                  showToast('All personal records erased', 'info');
                }}
                className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                Clear All Application Data
              </button>
            </div>
          </div>
        )}
      </main>

      {createKind && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateKind(null); }}>
          <form onSubmit={saveNewRecord} className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingTaskId ? 'Edit task' : editingHabitId ? 'Edit habit' : createKind === 'budget' ? 'Set monthly budget' : createKind === 'contribution' ? 'Add savings contribution' : createKind === 'savings' ? 'Add savings goal' : createKind === 'milestone' ? 'Add goal milestone' : createKind === 'goal-progress' ? 'Update goal progress' : `Add ${createKind}`}</h2>
              <button type="button" aria-label="Close" onClick={() => setCreateKind(null)} className="rounded-lg px-3 py-1 text-slate-300 hover:bg-slate-800">✕</button>
            </div>
            {!['budget', 'contribution', 'goal-progress'].includes(createKind) && <label className="mb-3 block text-xs text-slate-300">
              {createKind === 'transaction' ? 'Description' : createKind === 'habit' ? 'Habit name' : createKind === 'goal' || createKind === 'savings' ? 'Goal title' : createKind === 'milestone' ? 'Milestone title' : 'Task title'}
              <input autoFocus required maxLength={120} value={createDraft.title || ''} onChange={e => setCreateDraft({ ...createDraft, title: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white" />
            </label>}
            {createKind === 'transaction' && <>
              <label className="mb-3 block text-xs text-slate-300">Type<select value={createDraft.type} onChange={e => setCreateDraft({ ...createDraft, type: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="expense">Expense</option><option value="income">Income</option></select></label>
              <label className="mb-3 block text-xs text-slate-300">Amount<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={createDraft.amount} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Category<input required maxLength={50} value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Payment method<input maxLength={50} value={createDraft.paymentMethod || ''} onChange={e => setCreateDraft({ ...createDraft, paymentMethod: e.target.value })} placeholder="Other" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-4 block text-xs text-slate-300">Transaction date and time<input required type="datetime-local" value={createDraft.dateTime || ''} onChange={e => setCreateDraft({ ...createDraft, dateTime: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'habit' && <>
              <label className="mb-3 block text-xs text-slate-300">Frequency<select value={createDraft.frequency} onChange={e => setCreateDraft({ ...createDraft, frequency: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option><option value="weekly">Weekly</option></select></label>
              <label className="mb-3 block text-xs text-slate-300">Reminder time (optional)<input type="time" value={createDraft.reminderTime || ''} onChange={e => setCreateDraft({ ...createDraft, reminderTime: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              {createDraft.frequency === 'weekly' && <label className="mb-3 block text-xs text-slate-300">Reminder weekday<select value={createDraft.reminderWeekday || '2'} onChange={e => setCreateDraft({ ...createDraft, reminderWeekday: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>}
            </>}
            {createKind === 'goal' && <>
              <label className="mb-3 block text-xs text-slate-300">Category<select value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => <option key={category}>{category}</option>)}</select></label>
              <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Target<input required type="number" min="0.01" step="any" inputMode="decimal" value={createDraft.target} onChange={e => setCreateDraft({ ...createDraft, target: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label><label className="text-xs text-slate-300">Current<input type="number" min="0" step="any" inputMode="decimal" value={createDraft.current} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label></div>
              <label className="mb-3 block text-xs text-slate-300">Unit (optional)<input maxLength={20} value={createDraft.unit} onChange={e => setCreateDraft({ ...createDraft, unit: e.target.value })} placeholder="km, books, ₹..." className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'budget' && <>
              <label className="mb-3 block text-xs text-slate-300">Monthly limit<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={createDraft.amount || ''} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-4 block text-xs text-slate-300">Month<input required type="month" value={createDraft.month || financeMonth} onChange={e => setCreateDraft({ ...createDraft, month: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'savings' && <>
              <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Target amount<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={createDraft.target || ''} onChange={e => setCreateDraft({ ...createDraft, target: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label><label className="text-xs text-slate-300">Already saved<input type="number" min="0" step="0.01" inputMode="decimal" value={createDraft.current} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label></div>
              <label className="mb-3 block text-xs text-slate-300">Category (optional)<input maxLength={40} value={createDraft.category || ''} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'contribution' && <>
              <label className="mb-3 block text-xs text-slate-300">Savings goal<select required value={createDraft.goalId || ''} onChange={e => setCreateDraft({ ...createDraft, goalId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{savingsGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
              <label className="mb-3 block text-xs text-slate-300">Amount<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={createDraft.amount || ''} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Note (optional)<input maxLength={100} value={createDraft.notes || ''} onChange={e => setCreateDraft({ ...createDraft, notes: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'milestone' && <label className="mb-3 block text-xs text-slate-300">Goal<select required value={createDraft.goalId || ''} onChange={e => setCreateDraft({ ...createDraft, goalId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>}
            {createKind === 'goal-progress' && <><label className="mb-3 block text-xs text-slate-300">Goal<select required value={createDraft.goalId || ''} onChange={e => setCreateDraft({ ...createDraft, goalId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label><label className="mb-4 block text-xs text-slate-300">Current progress<input required type="number" min="0" step="any" inputMode="decimal" value={createDraft.current || ''} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label></>}
            {createKind === 'task' && <>
              <label className="mb-3 block text-xs text-slate-300">Description (optional)<textarea rows={2} maxLength={500} value={createDraft.description || ''} onChange={e => setCreateDraft({ ...createDraft, description: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Priority<select value={createDraft.priority} onChange={e => setCreateDraft({ ...createDraft, priority: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              <label className="mb-3 block text-xs text-slate-300">Category (optional)<input maxLength={50} value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Due date<input required type="date" value={createDraft.date || ''} onChange={e => setCreateDraft({ ...createDraft, date: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-2 py-3 text-sm" /></label><label className="text-xs text-slate-300">Due time (optional)<input type="time" value={createDraft.time || ''} onChange={e => setCreateDraft({ ...createDraft, time: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-2 py-3 text-sm" /></label></div>
              <label className="mb-3 block text-xs text-slate-300">Reminder (optional)<input type="datetime-local" value={createDraft.reminderAt || ''} onChange={e => setCreateDraft({ ...createDraft, reminderAt: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /><span className="mt-1 block text-[10px] text-slate-500">Uses local time; delivery may be approximate on Android.</span></label>
              <label className="mb-3 block text-xs text-slate-300">Repeat<select value={createDraft.recurring || 'None'} onChange={e => setCreateDraft({ ...createDraft, recurring: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['None', 'Daily', 'Weekly', 'Monthly'].map(item => <option key={item}>{item}</option>)}</select></label>
            </>}
            {!['habit', 'budget', 'task', 'transaction', 'goal-progress'].includes(createKind) && <label className="mb-4 block text-xs text-slate-300">{createKind === 'goal' || createKind === 'savings' ? 'Target date' : createKind === 'milestone' ? 'Target date (optional)' : 'Date'}<input type="date" required={createKind !== 'milestone'} value={createDraft.date || ''} onChange={e => setCreateDraft({ ...createDraft, date: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>}
            <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white active:scale-[.99]">{editingTaskId ? 'Update task' : editingHabitId ? 'Update habit' : createKind === 'budget' ? 'Save budget' : createKind === 'contribution' ? 'Save contribution' : createKind === 'goal-progress' ? 'Save progress' : `Save ${createKind}`}</button>
          </form>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-30 mx-auto grid max-w-md grid-cols-6 border-t border-slate-800 bg-slate-900/95 px-1 pt-2 backdrop-blur" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
        {(['dashboard', 'finance', 'habits', 'goals', 'planner', 'settings'] as const).map(tab => {
          const Icon = ({ dashboard: Home, finance: CircleDollarSign, habits: Activity, goals: GoalIcon, planner: CalendarDays, settings: SettingsIcon })[tab];
          const label = ({ dashboard: 'Home', finance: 'Finance', habits: 'Habits', goals: 'Goals', planner: 'Planner', settings: 'Settings' })[tab];
          return (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-label={label}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[9px] leading-none font-medium ${activeTab === tab ? 'bg-indigo-500/10 text-indigo-300 font-bold' : 'text-slate-400'}`}
          >
            <Icon size={18} strokeWidth={activeTab === tab ? 2.4 : 1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
          );
        })}
      </nav>

      {/* In-app Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl text-xs font-semibold text-white flex items-center gap-2">
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
