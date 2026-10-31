import React, { useState, useEffect, useMemo } from 'react';
import { StorageService, db } from './db';
import { BiometricService } from './services/biometricService';
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
  const [financeMonth, setFinanceMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [financeTypeFilter, setFinanceTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [financeCategoryFilter, setFinanceCategoryFilter] = useState<string>('all');
  const [financeSearch, setFinanceSearch] = useState<string>('');
  const [financeSort, setFinanceSort] = useState<string>('date-desc');

  const [habitsSubtab, setHabitsSubtab] = useState<'checklist' | 'weekly' | 'monthly'>('checklist');
  const [habitsSelectedDate, setHabitsSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [goalsSubtab, setGoalsSubtab] = useState<'active' | 'completed'>('active');
  const [goalsCategoryFilter, setGoalsCategoryFilter] = useState<string>('all');

  const [plannerSubtab, setPlannerSubtab] = useState<'agenda' | 'weekly' | 'all'>('agenda');
  const [plannerFilter, setPlannerFilter] = useState<'all' | 'overdue'>('all');

  // UI Toast & Modal State
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'danger' } | null>(null);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [createKind, setCreateKind] = useState<'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution' | null>(null);
  const [createDraft, setCreateDraft] = useState<Record<string, string>>({});

  // Load Initial Settings & Data
  useEffect(() => {
    initApp();
  }, []);

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

    const lockSetting = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
    setBiometricEnabled(lockSetting);

    if (lockSetting) {
      setIsLocked(true);
      triggerBiometricAuth();
    }

    await reloadAllData();

    // Setup app lifecycle listener for re-locking on background resume
    const cap = (window as any).Capacitor;
    if (cap && cap.Plugins && cap.Plugins.App) {
      cap.Plugins.App.addListener('appStateChange', async (state: { isActive: boolean }) => {
        if (!state.isActive) {
          const isBio = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
          if (isBio) {
            setIsLocked(true);
          }
        } else {
          const isBio = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
          if (isBio) {
            triggerBiometricAuth();
          }
        }
      });
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
  };

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    await StorageService.settings.set('theme', next);
  };

  const openCreateForm = (kind: 'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution') => {
    const today = new Date().toISOString().slice(0, 10);
    setCreateDraft({
      title: '', amount: '', category: kind === 'goal' ? 'Other' : '', date: today, month: financeMonth,
      type: 'expense', priority: 'Medium', frequency: 'daily', target: '', current: '0', unit: '',
    });
    setCreateKind(kind);
  };

  const saveNewRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createKind) return;
    const value = (key: string) => (createDraft[key] || '').trim();
    try {
      if (createKind === 'transaction') {
        const amount = Number(value('amount'));
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
        await StorageService.transactions.add({
          type: value('type') as 'income' | 'expense', amount, category: value('category'),
          description: value('title'), date: value('date'), paymentMethod: value('paymentMethod') || 'Other',
        });
      } else if (createKind === 'habit') {
        await StorageService.habits.add({ name: value('title'), frequency: value('frequency') as Habit['frequency'], color: '#6366f1' });
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
        await StorageService.tasks.add({
          title: value('title'), dueDate: value('date'), priority: value('priority') as Task['priority'],
          category: value('category') || undefined, recurring: 'None', completed: false,
        });
      }
      await reloadAllData();
      setCreateKind(null);
      showToast(`${createKind[0].toUpperCase()}${createKind.slice(1)} added`, 'success');
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

  const getDaysRemainingText = (targetDateStr: string) => {
    if (!targetDateStr) return '';
    const today = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');
    const target = new Date(targetDateStr + 'T00:00:00');
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
      count: monthlyTxs.length
    };
  }, [transactions, budgets, financeMonth]);

  // Habit Streak Calculation Helper
  const getHabitStreaks = (habitId: string, targetDate: string) => {
    const completedDates = new Set(
      habitLogs.filter(l => l.habitId === habitId && l.completed).map(l => l.date)
    );

    if (completedDates.size === 0) {
      return { currentStreak: 0, longestStreak: 0, completedToday: false, totalCount: 0 };
    }

    const completedToday = completedDates.has(targetDate);
    const sorted = Array.from(completedDates).sort();

    let longestStreak = 0;
    let tempStreak = 0;
    let prev: Date | null = null;

    for (const d of sorted) {
      const cur = new Date(d + 'T00:00:00');
      if (prev) {
        const diff = Math.round((cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) tempStreak++;
        else if (diff > 1) tempStreak = 1;
      } else {
        tempStreak = 1;
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      prev = cur;
    }

    let currentStreak = 0;
    let check = new Date(targetDate + 'T00:00:00');
    if (!completedDates.has(targetDate)) {
      check.setDate(check.getDate() - 1);
    }

    while (true) {
      const yyyy = check.getFullYear();
      const mm = String(check.getMonth() + 1).padStart(2, '0');
      const dd = String(check.getDate()).padStart(2, '0');
      const checkStr = `${yyyy}-${mm}-${dd}`;
      if (completedDates.has(checkStr)) {
        currentStreak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }

    return { currentStreak, longestStreak, completedToday, totalCount: completedDates.size };
  };

  // Productivity Score Calculation
  const productivityScore = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const completedHabits = habits.filter(h => getHabitStreaks(h.id, todayStr).completedToday).length;
    const habitWeight = habits.length > 0 ? (completedHabits / habits.length) * 50 : 50;

    const todayTasks = tasks.filter(t => t.dueDate === todayStr || (!t.dueDate && !t.completed));
    const completedTasks = todayTasks.filter(t => t.completed).length;
    const taskWeight = todayTasks.length > 0 ? (completedTasks / todayTasks.length) * 50 : 50;

    return Math.min(100, Math.round(habitWeight + taskWeight));
  }, [habits, habitLogs, tasks]);

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
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'} pb-24`}>
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
              <p className="text-xs text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              <h2 className="text-xl font-bold mt-0.5">Welcome back!</h2>
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
                    const todayStr = new Date().toISOString().split('T')[0];
                    const stats = getHabitStreaks(h.id, todayStr);
                    return (
                      <div key={h.id} className="p-3 rounded-xl bg-slate-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={async () => {
                              await StorageService.habits.logCompletion(h.id, todayStr, !stats.completedToday);
                              await reloadAllData();
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
              {tasks.filter(t => !t.completed).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No pending tasks for today. You're all caught up!</div>
              ) : (
                <div className="space-y-2">
                  {tasks.filter(t => !t.completed).slice(0, 4).map(t => (
                    <div key={t.id} className="p-3 rounded-xl bg-slate-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={async () => {
                            await StorageService.tasks.toggleCompleted(t.id, !t.completed);
                            await reloadAllData();
                            showToast('Task updated', 'success');
                          }}
                          className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                        />
                        <div>
                          <p className="text-sm font-medium">{t.title}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${t.priority === 'Urgent' ? 'bg-rose-500/20 text-rose-400' : t.priority === 'High' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                            {t.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
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
                </div>

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

                {/* Transactions List */}
                <div className="space-y-2">
                  {transactions.filter(t => {
                    const matchType = financeTypeFilter === 'all' || t.type === financeTypeFilter;
                    const matchQuery = !financeSearch || (t.description && t.description.toLowerCase().includes(financeSearch.toLowerCase()));
                    return matchType && matchQuery;
                  }).length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">No transactions recorded. Add one above.</div>
                  ) : (
                    transactions
                      .filter(t => (financeTypeFilter === 'all' || t.type === financeTypeFilter) && (!financeSearch || t.description.toLowerCase().includes(financeSearch.toLowerCase())))
                      .map(t => (
                        <div key={t.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-sm">{t.description || t.category}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(t.date)} &bull; {t.category} ({t.paymentMethod})</p>
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

            <div className="space-y-2">
              {habits.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">No habits added. Tap demo data in Settings or create custom habits.</div>
              ) : (
                habits.map(h => {
                  const todayStr = habitsSelectedDate;
                  const stats = getHabitStreaks(h.id, todayStr);
                  return (
                    <div key={h.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <button
                          onClick={async () => {
                            await StorageService.habits.logCompletion(h.id, todayStr, !stats.completedToday);
                            await reloadAllData();
                            showToast(stats.completedToday ? 'Habit unmarked' : 'Habit finished! 🔥', 'success');
                          }}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition ${stats.completedToday ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600'}`}
                        >
                          {stats.completedToday ? '✓' : ''}
                        </button>
                        <div>
                          <p className={`font-semibold text-sm ${stats.completedToday ? 'line-through text-slate-500' : ''}`}>{h.name}</p>
                          <p className="text-xs text-amber-400 font-semibold mt-0.5">🔥 {stats.currentStreak} day streak (Best: {stats.longestStreak})</p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          await StorageService.habits.delete(h.id);
                          await reloadAllData();
                          showToast('Habit removed', 'info');
                        }}
                        className="text-xs text-slate-500 hover:text-rose-400"
                      >
                        Delete
                      </button>
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
            {goals.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">No active goals yet.</div>
            ) : (
              goals.map(g => {
                const pct = g.targetValue > 0 ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : 0;
                return (
                  <div key={g.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm">{g.title}</h4>
                      <span className="text-xs font-bold text-indigo-400">{pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{g.currentValue} / {g.targetValue} {g.unit || ''}</span>
                      <span>{getDaysRemainingText(g.targetDate)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* VIEW 5: PLANNER */}
        {activeTab === 'planner' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Daily Tasks & Agenda</h2><button onClick={() => openCreateForm('task')} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">+ Add task</button></div>
            {tasks.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">No tasks found.</div>
            ) : (
              <div className="space-y-2">
                {tasks.map(t => (
                  <div key={t.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={t.completed}
                        onChange={async () => {
                          await StorageService.tasks.toggleCompleted(t.id, !t.completed);
                          await reloadAllData();
                        }}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      />
                      <div>
                        <p className={`text-sm font-medium ${t.completed ? 'line-through text-slate-500' : ''}`}>{t.title}</p>
                        <p className="text-xs text-slate-400">{formatDate(t.dueDate)} &bull; {t.priority}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await StorageService.tasks.delete(t.id);
                        await reloadAllData();
                        showToast('Task removed', 'info');
                      }}
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 6: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Settings & System</h2>

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
                    a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Backup JSON exported', 'success');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold"
                >
                  Export JSON
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-4 rounded-xl bg-slate-900 border border-rose-900/50 space-y-3">
              <h3 className="text-sm font-semibold text-rose-400">Data Reset</h3>
              <p className="text-xs text-slate-400">Permanently erase all personal database records.</p>
              <button
                onClick={async () => {
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
              <h2 className="text-lg font-bold">{createKind === 'budget' ? 'Set monthly budget' : createKind === 'contribution' ? 'Add savings contribution' : createKind === 'savings' ? 'Add savings goal' : `Add ${createKind}`}</h2>
              <button type="button" aria-label="Close" onClick={() => setCreateKind(null)} className="rounded-lg px-3 py-1 text-slate-300 hover:bg-slate-800">✕</button>
            </div>
            {!['budget', 'contribution'].includes(createKind) && <label className="mb-3 block text-xs text-slate-300">
              {createKind === 'transaction' ? 'Description' : createKind === 'habit' ? 'Habit name' : createKind === 'goal' || createKind === 'savings' ? 'Goal title' : 'Task title'}
              <input autoFocus required maxLength={120} value={createDraft.title || ''} onChange={e => setCreateDraft({ ...createDraft, title: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white" />
            </label>}
            {createKind === 'transaction' && <>
              <label className="mb-3 block text-xs text-slate-300">Type<select value={createDraft.type} onChange={e => setCreateDraft({ ...createDraft, type: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="expense">Expense</option><option value="income">Income</option></select></label>
              <label className="mb-3 block text-xs text-slate-300">Amount<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={createDraft.amount} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Category<input required maxLength={50} value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Payment method<input maxLength={50} value={createDraft.paymentMethod || ''} onChange={e => setCreateDraft({ ...createDraft, paymentMethod: e.target.value })} placeholder="Other" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'habit' && <label className="mb-3 block text-xs text-slate-300">Frequency<select value={createDraft.frequency} onChange={e => setCreateDraft({ ...createDraft, frequency: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option><option value="weekly">Weekly</option></select></label>}
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
            {createKind === 'task' && <>
              <label className="mb-3 block text-xs text-slate-300">Priority<select value={createDraft.priority} onChange={e => setCreateDraft({ ...createDraft, priority: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              <label className="mb-3 block text-xs text-slate-300">Category (optional)<input maxLength={50} value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
            </>}
            {!['habit', 'budget'].includes(createKind) && <label className="mb-4 block text-xs text-slate-300">{createKind === 'goal' || createKind === 'savings' ? 'Target date' : createKind === 'task' ? 'Due date' : 'Date'}<input required type="date" value={createDraft.date} onChange={e => setCreateDraft({ ...createDraft, date: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>}
            <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white active:scale-[.99]">{createKind === 'budget' ? 'Save budget' : createKind === 'contribution' ? 'Save contribution' : `Save ${createKind}`}</button>
          </form>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900 border-t border-slate-800 flex justify-around py-3 z-30">
        {(['dashboard', 'finance', 'habits', 'goals', 'planner', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[11px] capitalize font-medium flex flex-col items-center ${activeTab === tab ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
          >
            {tab === 'dashboard' ? 'Home' : tab}
          </button>
        ))}
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
