import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import packageInfo from '../package.json';
import { Activity, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Goal as GoalIcon, Home, Moon, Shield, ShieldCheck, Smartphone, Sun, UserRound } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StorageService, db } from './db';
import { BiometricService } from './services/biometricService';
import { createAuthCoordinator } from './services/authCoordinator';
import { DEFAULT_USER_PREFERENCES, buildTransactionUpdate, canonicalUnit, convertMeasurement, formatCurrency, formatDatePreference, formatTimePreference, mergeUserPreferences, resolveSystemDark, type UserPreferences } from './services/userPreferences';
import { buildFinanceAnalytics } from './services/financeAnalytics';
import { popTabHistory, pushTabHistory } from './services/tabHistory';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationService, type NotificationDiagnostics } from './services/notificationService';
import type { NotificationPreferences } from './types';
import Onboarding, { type AppearancePreference } from './components/Onboarding';
import { buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, isHabitScheduledOnDate, formatLocalDate, formatLocalDateTime, getGoalProgress, getMonthCalendarDays, getTaskStatus, getTasksForDate, greetingForHour, profileInitial, resolveAppearance, resolveBackAction, shouldShowOnboarding, sortTasksByDeadline, watchSystemTheme } from './services/domainUtils';

type MainTab = 'dashboard' | 'finance' | 'habits' | 'goals' | 'planner' | 'settings';
const systemDarkPreference = () => resolveSystemDark((window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark, window.matchMedia('(prefers-color-scheme: dark)').matches);
const applyDomTheme = (theme: 'dark' | 'light') => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#090d16' : '#f8fafc');
};

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
  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const activeTabRef = useRef<MainTab>('dashboard');
  const navigationHistory = useRef<MainTab[]>([]);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [plannerSelectedDate, setPlannerSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [plannerDisplayedMonth, setPlannerDisplayedMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [plannerDetailTaskId, setPlannerDetailTaskId] = useState<string | null>(null);
  const [profileNotificationsOpen, setProfileNotificationsOpen] = useState(false);
  const scrollPositions = useRef<Record<string, number>>({});
  const [theme, setTheme] = useState<'dark' | 'light'>(() => systemDarkPreference() ? 'dark' : 'light');
  const [appearance, setAppearancePreference] = useState<AppearancePreference>('system');
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [displayName, setDisplayName] = useState('');
  const [clockNow, setClockNow] = useState(() => new Date());
  const [logoPhase, setLogoPhase] = useState<'brand' | 'rest'>('brand');
  const logoIntroPlayed = useRef(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationPermissionRequested, setNotificationPermissionRequested] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationDiagnostics, setNotificationDiagnostics] = useState<NotificationDiagnostics>({ supported: false, permission: 'checking', channel: 'unknown', pendingCount: 0, lastError: '' });
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [startupError, setStartupError] = useState('');
  const [appReady, setAppReady] = useState(false);

  // Biometric Lock State
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [biometricAvailability, setBiometricAvailability] = useState('Checking device support');
  const [biometricMessage, setBiometricMessage] = useState('');
  const biometricAuthInFlight = useRef<Promise<boolean> | null>(null);
  const biometricAuthenticated = useRef(false);
  const startupComplete = useRef(false);
  const authCoordinator = useRef(createAuthCoordinator(async () => {
    const result = await BiometricService.authenticate('Unlock LifeOS', 'Confirm your identity to access your personal data');
    if (!result.success) setBiometricMessage(result.message || 'Authentication was not completed. Retry when you are ready.');
    return result.success;
  })).current;

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
  const financeSubtabHistory = useRef<Array<typeof financeSubtab>>([]);
  const [financeMonth, setFinanceMonth] = useState<string>(formatLocalDate(new Date()).substring(0, 7));
  const [financeTypeFilter, setFinanceTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [financeCategoryFilter, setFinanceCategoryFilter] = useState<string>('all');
  const [financeSearch, setFinanceSearch] = useState<string>('');
  const [financeSort, setFinanceSort] = useState<string>('date-desc');
  const [financeAnalyticsRange, setFinanceAnalyticsRange] = useState<3 | 6 | 12>(6);

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
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  const backState = useRef({ createKind, modalContent, plannerDetailTaskId, profileNotificationsOpen, activeTab, financeSubtab, habitsSubtab, goalsSubtab, appReady, onboardingRequired, onboardingComplete, isLocked, showExitConfirmation });
  backState.current = { createKind, modalContent, plannerDetailTaskId, profileNotificationsOpen, activeTab, financeSubtab, habitsSubtab, goalsSubtab, appReady, onboardingRequired, onboardingComplete, isLocked, showExitConfirmation };

  const navigateTo = (tab: MainTab) => {
    const previous = activeTabRef.current;
    if (previous === tab) return;
    navigationHistory.current.push(previous);
    activeTabRef.current = tab;
    setShowExitConfirmation(false);
    setActiveTab(tab);
  };

  const navigateBack = () => {
    const state = backState.current;
    const action = resolveBackAction({ appReady: state.appReady, onboarding: state.onboardingRequired && !state.onboardingComplete, locked: state.isLocked, dialogOpen: Boolean(state.createKind || state.modalContent), exitDialogOpen: state.showExitConfirmation, taskDetailsOpen: Boolean(state.plannerDetailTaskId), tab: state.activeTab, childViewOpen: (state.activeTab === 'finance' && state.financeSubtab !== 'overview') || (state.activeTab === 'habits' && state.habitsSubtab !== 'checklist') || (state.activeTab === 'goals' && state.goalsSubtab !== 'active') || (state.activeTab === 'settings' && state.profileNotificationsOpen) }, navigationHistory.current.length > 0);
    if (action === 'ignore') return;
    if (action === 'dismiss-dialog') { requestCloseForm(); setModalContent(null); return; }
    if (action === 'dismiss-exit-dialog') { setShowExitConfirmation(false); return; }
    if (action === 'close-task-details') { setPlannerDetailTaskId(null); return; }
    if (action === 'close-child-view') {
      if (state.activeTab === 'finance') {
        const previous = popTabHistory(financeSubtabHistory.current, 'overview');
        financeSubtabHistory.current = previous.history;
        setFinanceSubtab(previous.next);
      }
      if (state.activeTab === 'habits') setHabitsSubtab('checklist');
      if (state.activeTab === 'goals') setGoalsSubtab('active');
      if (state.activeTab === 'settings') setProfileNotificationsOpen(false);
      return;
    }
    const previous = navigationHistory.current.pop();
    if (action === 'previous-tab' && previous) {
      activeTabRef.current = previous;
      setActiveTab(previous);
      return;
    }
    if (action === 'home') {
      activeTabRef.current = 'dashboard';
      setActiveTab('dashboard');
      return;
    }
    setShowExitConfirmation(true);
  };

  // Load Initial Settings & Data
  useEffect(() => {
    void initApp().catch(error => {
      console.error('LifeOS startup failed.', error);
      setStartupError(error instanceof Error ? error.message : 'LifeOS could not open local data.');
    });
    const timer = window.setInterval(() => setClockNow(new Date()), 60_000);
    let appStateListener: { remove: () => Promise<void> } | undefined;
    CapacitorApp.addListener('appStateChange', async state => {
      if (!state.isActive) {
        const isBio = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
        if (isBio) { biometricAuthenticated.current = false; authCoordinator.resetForBackground(); setIsLocked(true); setBiometricVerified(false); setBiometricMessage(''); }
        return;
      }
      setClockNow(new Date());
      const isBio = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
      if (isBio && startupComplete.current && !biometricAuthenticated.current) void triggerBiometricAuth();
      const records = await reloadAllData();
      const prefs = await StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
      const master = await StorageService.settings.get<boolean>('notificationsEnabled', Object.values(prefs).some(Boolean));
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(prefs, master));
      await refreshNotificationDiagnostics();
    }).then(listener => { appStateListener = listener; });
    return () => {
      window.clearInterval(timer);
      appStateListener?.remove();
    };
  }, []);

  useEffect(() => {
    let listener: { remove: () => Promise<void> } | undefined;
    CapacitorApp.addListener('backButton', () => navigateBack()).then(value => { listener = value; });
    return () => { listener?.remove(); };
  }, []);

  useEffect(() => {
    if (appearance !== 'system') return;
    const update = (resolved: 'dark' | 'light') => { setTheme(resolved); applyDomTheme(resolved); };
    const nativeTheme = (event: Event) => update((event as CustomEvent<{ dark: boolean }>).detail.dark ? 'dark' : 'light');
    window.addEventListener('lifeos:system-appearance', nativeTheme);
    const stopMedia = typeof (window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark === 'boolean'
      ? () => {}
      : watchSystemTheme(window.matchMedia('(prefers-color-scheme: dark)'), update);
    return () => { stopMedia(); window.removeEventListener('lifeos:system-appearance', nativeTheme); };
  }, [appearance]);

  useEffect(() => {
    if (!appReady || isLocked || (onboardingRequired && !onboardingComplete) || logoIntroPlayed.current) return;
    logoIntroPlayed.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLogoPhase('rest'); return; }
    const toRest = window.setTimeout(() => setLogoPhase('rest'), 240);
    return () => window.clearTimeout(toRest);
  }, [appReady, isLocked, onboardingRequired, onboardingComplete]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollPositions.current[activeTab] || 0);
    root.style.scrollBehavior = previous;
    return () => { scrollPositions.current[activeTab] = window.scrollY; };
  }, [activeTab]);

  const showToast = (message: string, type: 'info' | 'success' | 'danger' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const requestCloseForm = () => {
    if (!backState.current.createKind) return;
    if (!window.confirm('Close this form? Any unsaved changes will be lost.')) return;
    setCreateKind(null); setEditingTaskId(null); setEditingHabitId(null); setEditingTransactionId(null); setEditingGoalId(null);
  };

  const navigateFinanceSubtab = (next: typeof financeSubtab) => {
    if (next === financeSubtab) return;
    financeSubtabHistory.current = pushTabHistory(financeSubtabHistory.current, financeSubtab, next);
    setFinanceSubtab(next);
  };

  const saveUserPreference = async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const updated = { ...userPrefs, [key]: value };
    setUserPrefs(updated);
    await StorageService.settings.set('userPreferences', updated);
    if (key === 'currency') await StorageService.settings.set('currency', value);
  };

  const initApp = async () => {
    const savedTheme = await StorageService.settings.get<AppearancePreference>('theme', 'system');
    setAppearancePreference(savedTheme);
    const resolvedTheme = resolveAppearance(savedTheme, systemDarkPreference());
    setTheme(resolvedTheme);
    applyDomTheme(resolvedTheme);
    localStorage.setItem('lifeos-appearance', savedTheme);

    const storedCurrency = await StorageService.settings.get<UserPreferences['currency']>('currency', 'INR');
    const savedUserPrefs = await StorageService.settings.get<Partial<UserPreferences>>('userPreferences', {});
    setUserPrefs(mergeUserPreferences(savedUserPrefs, storedCurrency));
    setDisplayName(await StorageService.settings.get<string>('displayName', ''));
    const savedNotificationPreferences = await StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
    const hasRequestedNotifications = await StorageService.settings.get<boolean>('notificationPermissionRequested', false);
    const savedNotificationsEnabled = await StorageService.settings.get<boolean | undefined>('notificationsEnabled', undefined);
    const notificationsOn = savedNotificationsEnabled ?? Object.values(savedNotificationPreferences).some(Boolean);
    setNotificationsEnabled(notificationsOn);
    setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...savedNotificationPreferences });
    setNotificationPermissionRequested(hasRequestedNotifications);

    const lockSetting = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
    setBiometricEnabled(lockSetting);
    setIsLocked(lockSetting);
    const availability = await BiometricService.isAvailable();
    setBiometricAvailability(availability.isAvailable ? 'Available' : availability.code === 'NOT_ENROLLED' ? 'Supported, but no device credential is enrolled' : 'Unavailable on this device');

    const completed = await StorageService.settings.get<boolean>('onboardingCompleted', false);
    const started = await StorageService.settings.get<boolean>('onboardingStarted', false);
    const savedOnboardingStep = await StorageService.settings.get<number>('onboardingStep', 0);
    // Keep this inspection read-only: saving a default theme before this point
    // made a fresh database look like a legacy install and skipped onboarding.
    const settingsCount = await db.settings.count();
    const dataCounts = await Promise.all([db.transactions.count(), db.categories.count(), db.budgets.count(), db.savingsGoals.count(), db.savingsContributions.count(), db.habits.count(), db.habitLogs.count(), db.goals.count(), db.milestones.count(), db.tasks.count()]);
    const legacyState = settingsCount > 0 || dataCounts.some(count => count > 0);
    const needsOnboarding = shouldShowOnboarding(completed, legacyState, started);
    setOnboardingRequired(needsOnboarding);
    setOnboardingComplete(completed || !needsOnboarding);
    setOnboardingStep(Math.max(0, Math.min(4, savedOnboardingStep)));
    if (!completed && !needsOnboarding) await StorageService.settings.set('onboardingCompleted', true);
    if (needsOnboarding && !started) await StorageService.settings.set('onboardingStarted', true);

    // A fresh process does not necessarily receive an appStateChange resume event.
    // Authenticate as part of bootstrap before appReady can expose protected UI.
    if (lockSetting) await triggerBiometricAuth();

    const records = await reloadAllData();
    await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...savedNotificationPreferences }, notificationsOn));
    await refreshNotificationDiagnostics();
    startupComplete.current = true;
    setAppReady(true);
  };

  const effectiveNotificationPreferences = (preferences: NotificationPreferences, master = notificationsEnabled): NotificationPreferences => master ? preferences : DEFAULT_NOTIFICATION_PREFERENCES;

  const applyAppearance = async (preference: AppearancePreference) => {
    setAppearancePreference(preference);
    const resolved = resolveAppearance(preference, systemDarkPreference());
    setTheme(resolved);
    applyDomTheme(resolved);
    await StorageService.settings.set('theme', preference);
    localStorage.setItem('lifeos-appearance', preference);
  };

  const refreshNotificationDiagnostics = async () => {
    const diagnostics = await NotificationService.getDiagnostics();
    setNotificationDiagnostics(diagnostics);
  };

  const askNotificationPermission = async () => {
    try {
      if (!NotificationService.isSupported()) return { granted: false, status: 'unsupported', message: 'Install the updated Android build to enable local notifications.' };
      let status = await NotificationService.checkPermission();
      if (status === 'granted') return { granted: true, status };
      if (notificationPermissionRequested) return { granted: false, status, message: 'Permission was previously declined. Open Android notification settings to allow it.' };
      setNotificationPermissionRequested(true);
      await StorageService.settings.set('notificationPermissionRequested', true);
      status = await NotificationService.requestPermission();
      return status === 'granted'
        ? { granted: true, status }
        : { granted: false, status, message: 'Android did not grant notification permission. You can continue and enable it later in Profile.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Android notification permission could not be checked.';
      return { granted: false, status: 'error', message };
    }
  };

  const saveNotificationSelection = async (preferences: NotificationPreferences) => {
    setNotificationPreferences(preferences);
    const enabled = Object.values(preferences).some(Boolean);
    setNotificationsEnabled(enabled);
    await StorageService.settings.set('notificationPreferences', preferences);
    await StorageService.settings.set('notificationsEnabled', enabled);
  };

  const syncNotificationSchedules = async (taskRows: Task[], habitRows: Habit[], goalRows: Goal[], milestoneRows: Milestone[], preferences = notificationPreferences) => {
    const results = await Promise.allSettled([
      NotificationService.syncTasks(taskRows, preferences),
      NotificationService.syncHabits(habitRows, preferences),
      NotificationService.syncMilestones(goalRows, milestoneRows, preferences),
    ]);
    if (results.some(result => result.status === 'rejected')) {
      console.warn('One or more local notification schedules could not be updated.', results.filter(result => result.status === 'rejected'));
      await refreshNotificationDiagnostics();
      return;
    }
    await refreshNotificationDiagnostics();
  };

  const updateDisplayName = async (name: string) => {
    setDisplayName(name.slice(0, 48));
    await StorageService.settings.set('displayName', name.slice(0, 48).trim());
  };

  const toggleNotificationCategory = async (key: keyof NotificationPreferences) => {
    const enabled = !notificationPreferences[key];
    if (enabled) {
      const permission = await askNotificationPermission();
      if (!permission.granted) { showToast(permission.message || `Notification permission: ${permission.status}`, 'danger'); return; }
    }
    const next = { ...notificationPreferences, [key]: enabled };
    setNotificationPreferences(next);
    const master = enabled || (notificationsEnabled && Object.entries(next).some(([category, value]) => category !== key && value));
    setNotificationsEnabled(master);
    await StorageService.settings.set('notificationPreferences', next);
    await StorageService.settings.set('notificationsEnabled', master);
    await syncNotificationSchedules(tasks, habits, goals, milestones, effectiveNotificationPreferences(next, master));
    showToast(`${enabled ? 'Enabled' : 'Disabled'} ${notificationLabels[key].toLowerCase()}`, 'success');
  };

  const setNotificationsMaster = async (enabled: boolean) => {
    if (enabled) {
      const permission = await askNotificationPermission();
      if (!permission.granted) { showToast(permission.message || `Notification permission: ${permission.status}`, 'danger'); return; }
    }
    setNotificationsEnabled(enabled);
    await StorageService.settings.set('notificationsEnabled', enabled);
    await syncNotificationSchedules(tasks, habits, goals, milestones, effectiveNotificationPreferences(notificationPreferences, enabled));
    await refreshNotificationDiagnostics();
    showToast(enabled ? 'Notifications enabled' : 'Notifications paused', 'success');
  };

  const openNotificationSettings = async () => {
    try { await NotificationService.openSettings(); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Could not open Android notification settings', 'danger'); }
  };

  const handleEnableBiometric = async () => {
    const availability = await BiometricService.isAvailable();
    if (!availability.isAvailable) return { success: false, message: availability.code === 'NOT_ENROLLED' ? 'No fingerprint or device screen lock is enrolled. Set one up in Android settings, then try again.' : 'Device authentication is not available on this device.' };
    const result = await BiometricService.authenticate('Secure LifeOS', 'Confirm to enable the app lock');
    if (!result.success) return { success: false, message: result.message || 'Authentication was not completed.' };
    setBiometricEnabled(true); setBiometricVerified(true);
    biometricAuthenticated.current = true;
    authCoordinator.markAuthenticated();
    await StorageService.settings.set('biometricLockEnabled', true);
    return { success: true };
  };

  const finishOnboarding = async () => {
    await StorageService.settings.set('onboardingCompleted', true);
    await StorageService.settings.set('onboardingStarted', false);
    await StorageService.settings.set('onboardingStep', 0);
    setOnboardingStep(0);
    setOnboardingComplete(true); setOnboardingRequired(false); navigationHistory.current = []; activeTabRef.current = 'dashboard'; setActiveTab('dashboard');
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
      const master = await StorageService.settings.get<boolean>('notificationsEnabled', Object.values(prefs).some(Boolean));
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...prefs });
      setNotificationsEnabled(master);
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(prefs, master));
      showToast('Backup restored successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not restore this backup', 'danger');
    }
  };

  const triggerBiometricAuth = async () => {
    if (biometricAuthInFlight.current) return biometricAuthInFlight.current;
    if (biometricAuthenticated.current) return true;
    const attempt = (async () => {
      setIsLocked(true);
      setBiometricMessage('Confirm your identity to open LifeOS.');
      const availability = await BiometricService.isAvailable();
      if (!availability.isAvailable) {
        const message = availability.code === 'NOT_ENROLLED'
          ? 'No biometric or device screen lock is enrolled. Set one up in Android settings, then retry.'
          : 'Device authentication is unavailable. Your data remains locked until authentication is available.';
        setBiometricMessage(message);
        setBiometricAvailability(message);
        return false;
      }
      const success = await authCoordinator.authenticate();
      if (success) {
        biometricAuthenticated.current = true;
        setIsLocked(false);
        setBiometricVerified(true);
        setBiometricMessage('');
        return true;
      }
      return false;
    })().catch(error => {
      const message = error instanceof Error ? error.message : 'Device authentication failed. Your data remains locked.';
      setBiometricMessage(message);
      console.error('LifeOS biometric startup authentication failed.', error);
      return false;
    }).finally(() => { biometricAuthInFlight.current = null; });
    biometricAuthInFlight.current = attempt;
    return attempt;
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
    setAppearancePreference(next);
    applyDomTheme(next);
    await StorageService.settings.set('theme', next);
    localStorage.setItem('lifeos-appearance', next);
  };

  const openCreateForm = (kind: 'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution' | 'milestone' | 'goal-progress', goalId?: string, taskDate?: string) => {
    const now = new Date();
    const today = formatLocalDate(now);
    setCreateDraft({
      title: '', amount: '', category: kind === 'goal' ? 'Other' : '', date: taskDate || today, month: financeMonth,
      dateTime: formatLocalDateTime(now), time: '', reminderAt: '', description: '', notes: '',
      type: 'expense', priority: 'Medium', frequency: 'daily', target: '', current: '0', unit: '',
      goalId: goalId || '', recurring: 'None', reminderWeekday: '2',
    });
    setEditingTaskId(null);
    setEditingHabitId(null);
    setEditingTransactionId(null);
    setEditingGoalId(null);
    setCreateKind(kind);
  };

  const openEditTransaction = (transaction: Transaction) => {
    setCreateDraft({
      title: transaction.description || '', amount: String(transaction.amount), category: transaction.category,
      type: transaction.type, paymentMethod: transaction.paymentMethod || 'Other',
      dateTime: formatLocalDateTime(new Date(transaction.occurredAt || transaction.createdAt)),
      notes: transaction.notes || '', isRecurring: transaction.isRecurring ? 'yes' : '',
    });
    setEditingTransactionId(transaction.id); setEditingTaskId(null); setEditingHabitId(null); setEditingGoalId(null); setCreateKind('transaction');
  };

  const openEditGoal = (goal: Goal) => {
    const oldUnit = goal.unit || '';
    const selectedUnit = ['km', 'mi', 'mile', 'miles'].includes(oldUnit) ? userPrefs.distance
      : ['L', 'l', 'mL', 'US gal', 'Imp gal'].includes(oldUnit) ? userPrefs.volume
        : ['km/h', 'm/s', 'mph'].includes(oldUnit) ? userPrefs.speed : oldUnit;
    const target = oldUnit && selectedUnit !== oldUnit ? convertMeasurement(goal.targetValue, oldUnit, selectedUnit) : goal.targetValue;
    const current = oldUnit && selectedUnit !== oldUnit ? convertMeasurement(goal.currentValue, oldUnit, selectedUnit) : goal.currentValue;
    setCreateDraft({ title: goal.title, category: goal.category, target: String(target), current: String(current), unit: selectedUnit, date: goal.targetDate, startDate: goal.startDate, priority: goal.priority, status: goal.status, description: goal.description || '' });
    setEditingGoalId(goal.id); setEditingTaskId(null); setEditingHabitId(null); setEditingTransactionId(null); setCreateKind('goal');
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
    setCreateDraft({ title: habit.name, description: habit.description || '', targetPerDay: habit.targetPerDay === undefined ? '' : String(habit.targetPerDay), frequency: habit.frequency, reminderTime: habit.reminderTime || '', reminderWeekday: String(habit.reminderWeekday || 2) });
    setEditingHabitId(habit.id);
    setEditingTaskId(null);
    setCreateKind('habit');
  };

  const saveNewRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createKind) return;
    const value = (key: string) => (createDraft[key] || '').trim();
    let reminderCouldNotEnable = false;
    try {
      if (createKind === 'task' && value('reminderAt') && (!notificationsEnabled || !notificationPreferences.taskReminders)) {
        const permission = await askNotificationPermission();
        if (permission.granted) {
          const nextPreferences = { ...notificationPreferences, taskReminders: true };
          setNotificationPreferences(nextPreferences); setNotificationsEnabled(true);
          await StorageService.settings.set('notificationPreferences', nextPreferences);
          await StorageService.settings.set('notificationsEnabled', true);
        } else reminderCouldNotEnable = true;
      }
      if (createKind === 'transaction') {
        const values = buildTransactionUpdate({ type: value('type') as 'income' | 'expense', amount: Number(value('amount')), category: value('category'), description: value('title'), dateTime: value('dateTime'), paymentMethod: value('paymentMethod'), notes: value('notes'), isRecurring: value('isRecurring') === 'yes' });
        if (editingTransactionId) await StorageService.transactions.update(editingTransactionId, values);
        else await StorageService.transactions.add(values);
      } else if (createKind === 'habit') {
        const targetPerDay = value('targetPerDay') ? Number(value('targetPerDay')) : undefined;
        if (targetPerDay !== undefined && (!Number.isFinite(targetPerDay) || targetPerDay <= 0)) throw new Error('Habit target must be greater than zero.');
        const existingHabit = editingHabitId ? habits.find(habit => habit.id === editingHabitId) : undefined;
        const habit: Partial<Habit> = { name: value('title'), description: value('description') || undefined, frequency: value('frequency') as Habit['frequency'], color: existingHabit?.color || '#6366f1', targetPerDay, reminderTime: value('reminderTime') || undefined, reminderWeekday: value('frequency') === 'weekly' ? Number(value('reminderWeekday')) : undefined };
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
        let targetValue = Number(value('target'));
        let currentValue = Number(value('current'));
        if (!Number.isFinite(targetValue) || targetValue <= 0 || !Number.isFinite(currentValue) || currentValue < 0) {
          throw new Error('Enter a positive target and a valid current progress value.');
        }
        let goalUnit = value('unit');
        if (canonicalUnit(goalUnit) !== goalUnit) {
          const canonical = canonicalUnit(goalUnit);
          targetValue = convertMeasurement(targetValue, goalUnit, canonical);
          currentValue = convertMeasurement(currentValue, goalUnit, canonical);
          goalUnit = canonical;
        }
        const goalFields = {
          title: value('title'), description: value('description') || undefined,
          category: value('category') as Goal['category'], targetValue, currentValue,
          unit: goalUnit || undefined, startDate: value('startDate') || value('date'), targetDate: value('date'),
          priority: value('priority') as Goal['priority'], status: (value('status') || 'In Progress') as Goal['status'],
        };
        if (editingGoalId) await StorageService.goals.update(editingGoalId, goalFields);
        else await StorageService.goals.add(goalFields);
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
      const reminderOptedIn = createKind === 'task' && Boolean(value('reminderAt')) && !reminderCouldNotEnable;
      const schedulePreferences = { ...notificationPreferences, taskReminders: reminderOptedIn || notificationPreferences.taskReminders };
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(schedulePreferences, notificationsEnabled || reminderOptedIn));
      setCreateKind(null);
      const wasEditingTask = editingTaskId;
      const wasEditingHabit = editingHabitId;
      const wasEditingTransaction = editingTransactionId;
      const wasEditingGoal = editingGoalId;
      setEditingTaskId(null);
      setEditingHabitId(null);
      setEditingTransactionId(null); setEditingGoalId(null);
      showToast(reminderCouldNotEnable ? 'Task saved, but Android notification permission is unavailable. Enable it in Profile to receive its reminder.' : wasEditingTask ? 'Task updated' : wasEditingHabit ? 'Habit updated' : wasEditingTransaction ? 'Transaction updated' : wasEditingGoal ? 'Goal updated' : createKind === 'milestone' ? 'Milestone added' : createKind === 'goal-progress' ? 'Goal progress updated' : `${createKind[0].toUpperCase()}${createKind.slice(1)} added`, reminderCouldNotEnable ? 'danger' : 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save this item', 'danger');
    }
  };

  const formatMoney = (amount: number) => {
    return formatCurrency(Number(amount) || 0, userPrefs.currency, userPrefs.locale);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts.map(Number);
    return formatDatePreference(new Date(year, month - 1, day), userPrefs.dateFormat);
  };
  const formatTime = (date: Date) => formatTimePreference(date, userPrefs.timeFormat, userPrefs.locale);
  const formatClockTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    return Number.isInteger(hour) && Number.isInteger(minute) ? formatTime(new Date(2000, 0, 1, hour, minute)) : time;
  };
  const formatDateTime = (date: Date) => `${formatDate(formatLocalDate(date))} · ${formatTime(date)}`;

  const preferredUnitFor = (unit: string) => {
    const canonical = canonicalUnit(unit);
    return canonical === 'km' ? userPrefs.distance : canonical === 'L' ? userPrefs.volume : canonical === 'm/s' ? userPrefs.speed : unit;
  };
  const displayGoalMeasure = (value: number, unit = '') => {
    if (!unit || canonicalUnit(unit) === unit && !['km', 'L', 'm/s'].includes(unit)) return `${value}${unit ? ` ${unit}` : ''}`;
    const target = preferredUnitFor(unit);
    try { return `${convertMeasurement(value, unit, target)} ${target}`; } catch { return `${value} ${unit}`; }
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

  const financeAnalytics = useMemo(() => buildFinanceAnalytics(transactions, budgets, financeMonth, financeAnalyticsRange), [transactions, budgets, financeMonth, financeAnalyticsRange]);

  // Habit Streak Calculation Helper
  const getHabitStreaks = (habitId: string, targetDate: string) => {
    const stats = calculateStreaks(habitLogs, habitId, targetDate, habits.find(h => h.id === habitId)?.frequency || 'daily');
    return { ...stats, totalCount: new Set(habitLogs.filter(log => log.habitId === habitId && log.completed).map(log => log.date)).size };
  };

  // Productivity Score Calculation
  const productivityScore = useMemo(() => {
    const todayStr = formatLocalDate(clockNow);
    const completedHabits = habits.filter(h => {
      if (h.frequency === 'weekly') return calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency).completed > 0;
      if (!isHabitScheduledOnDate(h.frequency, todayStr)) return true;
      return getHabitStreaks(h.id, todayStr).completedToday;
    }).length;
    const habitWeight = habits.length > 0 ? (completedHabits / habits.length) * 50 : 50;

    const todayTasks = tasks.filter(t => t.dueDate === todayStr || (!t.dueDate && !t.completed));
    const completedTasks = todayTasks.filter(t => t.completed).length;
    const taskWeight = todayTasks.length > 0 ? (completedTasks / todayTasks.length) * 50 : 50;

    return Math.min(100, Math.round(habitWeight + taskWeight));
  }, [habits, habitLogs, tasks, clockNow]);

  const todayKey = formatLocalDate(clockNow);
  const tomorrowDate = new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() + 1);
  const tomorrowKey = formatLocalDate(tomorrowDate);
  const calendarDays = useMemo(() => getMonthCalendarDays(plannerDisplayedMonth.getFullYear(), plannerDisplayedMonth.getMonth(), userPrefs.firstDayOfWeek === 'monday'), [plannerDisplayedMonth, userPrefs.firstDayOfWeek]);
  const plannerTasksByDate = useMemo(() => {
    const byDate = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const rows = byDate.get(task.dueDate) || [];
      rows.push(task); byDate.set(task.dueDate, rows);
    }
    return byDate;
  }, [tasks]);
  const selectedPlannerDateLabel = new Date(`${plannerSelectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dashboardTasks = useMemo(() => sortTasksByDeadline(tasks.filter(task => getTaskStatus(task, clockNow) === 'Overdue' || task.dueDate === todayKey), clockNow).slice(0, 5), [tasks, clockNow, todayKey]);
  const visiblePlannerTasks = useMemo(() => {
    const dateScopedTasks = ['today', 'tomorrow', 'upcoming'].includes(plannerFilter) ? tasks : getTasksForDate(tasks, plannerSelectedDate);
    return sortTasksByDeadline(dateScopedTasks.filter(task => {
    const status = getTaskStatus(task, clockNow);
    const dateScope = ['today', 'tomorrow', 'upcoming'].includes(plannerFilter);
    const statusMatch = dateScope || plannerFilter === 'all' ? true : status.toLowerCase() === plannerFilter;
    const dateMatch = plannerFilter === 'today' ? task.dueDate === todayKey
      : plannerFilter === 'tomorrow' ? task.dueDate === tomorrowKey
        : plannerFilter === 'upcoming' ? task.dueDate > tomorrowKey && task.dueDate <= formatLocalDate(new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() + 7))
          : task.dueDate === plannerSelectedDate;
    const query = plannerSearch.trim().toLowerCase();
    const searchMatch = !query || `${task.title} ${task.description || ''} ${task.notes || ''} ${task.category || ''}`.toLowerCase().includes(query);
    return statusMatch && dateMatch && searchMatch && (plannerPriority === 'all' || task.priority === plannerPriority);
    }), clockNow);
  }, [tasks, clockNow, plannerFilter, plannerSearch, plannerPriority, todayKey, tomorrowKey, plannerSelectedDate]);
  const plannerDetailTask = plannerDetailTaskId ? tasks.find(task => task.id === plannerDetailTaskId) : undefined;

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

  if (!appReady) return <div className={`fixed inset-0 flex items-center justify-center px-6 ${theme === 'dark' ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'}`} aria-label={startupError ? 'LifeOS could not start' : 'Loading LifeOS'}>{startupError ? <div className="max-w-sm text-center"><h1 className="text-xl font-semibold">LifeOS could not open</h1><p className="mt-2 text-sm text-slate-300">{startupError}</p><button className="mt-5 min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold" onClick={() => { setStartupError(''); void initApp().catch(error => setStartupError(error instanceof Error ? error.message : 'LifeOS could not open local data.')); }}>Try again</button></div> : <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />}</div>;

  if (onboardingRequired && !onboardingComplete && !isLocked) return <Onboarding
    initialName={displayName}
    preferences={notificationPreferences}
    appearance={appearance}
    initialStep={onboardingStep}
    onStepChange={async step => { await StorageService.settings.set('onboardingStarted', true); await StorageService.settings.set('onboardingStep', step); setOnboardingStep(step); }}
    onSaveIdentity={async name => { await updateDisplayName(name); }}
    onEnableBiometric={handleEnableBiometric}
    onSkipBiometric={() => {}}
    onAppearance={applyAppearance}
    onEnableNotifications={async selected => {
      const permission = await askNotificationPermission();
      if (!permission.granted) return { granted: false, status: permission.status, message: permission.message };
      await saveNotificationSelection(selected);
      await syncNotificationSchedules(tasks, habits, goals, milestones, effectiveNotificationPreferences(selected, true));
      return { granted: true, status: 'granted' };
    }}
    onSkipNotifications={async () => { if (!notificationsEnabled) await saveNotificationSelection(DEFAULT_NOTIFICATION_PREFERENCES); }}
    onOpenNotificationSettings={openNotificationSettings}
    onFinish={finishOnboarding}
  />;

  // If App is Biometrically Locked, render Lock Screen Overlay
  if (isLocked) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center ${theme === 'dark' ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'}`}>
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
          {biometricMessage ? 'Try again' : 'Verify Biometrics'}
        </button>
        {biometricMessage && <p role="status" className="mt-4 max-w-xs text-sm text-amber-300">{biometricMessage}</p>}
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'}`} style={{ paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom))' }}>
      {/* Top Mobile Header */}
      <header className="app-header sticky top-0 z-40 mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3 sm:px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={`lifeos-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white logo-${logoPhase}`} aria-hidden="true">
            <span>L</span>
          </div>
          <div className="min-w-0">
            <h1 className="header-greeting text-[clamp(1.05rem,4.2vw,1.35rem)] font-semibold leading-tight tracking-tight">{greetingForHour(clockNow.getHours(), displayName)}</h1>
            <p className="mt-0.5 truncate text-xs text-slate-400">{activeTab === 'dashboard' ? "Here's your day at a glance." : `Your ${({ finance: 'finances', habits: 'habits', goals: 'goals', planner: 'planner', settings: 'profile' } as Record<string, string>)[activeTab] || 'day'}, thoughtfully organized.`}</p>
          </div>
        </div>
        <button onClick={toggleTheme} aria-label={`Switch appearance from ${theme} theme`} className="app-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-slate-800 text-slate-200 transition active:scale-95">{theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</button>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* VIEW 1: DASHBOARD */}
        <div key={activeTab} className="tab-transition">
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            <div><p className="text-sm font-medium text-slate-500">{clockNow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><h2 className="text-lg font-semibold tracking-tight">Today</h2></div>

            {/* Productivity Score Card */}
            <div className="dashboard-score p-4 rounded-2xl bg-slate-900 border border-slate-800">
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
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Goals</p><h3 className="text-sm font-semibold">{goals.filter(goal => goal.status === 'In Progress').length} active goals</h3></div>
                <button onClick={() => navigateTo('goals')} className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-300" aria-label="Open Goals">View all →</button>
              </div>
              {goals.filter(goal => goal.status === 'In Progress').length === 0 ? (
                <div className="rounded-xl bg-slate-900/50 px-3 py-4 text-center text-xs text-slate-400"><p>No active goals yet.</p><button onClick={() => { navigateTo('goals'); openCreateForm('goal'); }} className="mt-2 font-semibold text-violet-300">Create your first goal</button></div>
              ) : <div className="space-y-3">{goals.filter(goal => goal.status === 'In Progress').slice(0, 3).map(goal => {
                const progress = goalProgress(goal);
                return <button key={goal.id} onClick={() => navigateTo('goals')} className="block w-full rounded-xl bg-slate-900/55 p-3 text-left">
                  <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{goal.title}</span><span className="shrink-0 text-xs font-bold text-violet-300">{progress}%</span></div>
                  <div className="my-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${progress}%` }} /></div>
                  <div className="flex justify-between gap-2 text-[10px] text-slate-400"><span>{displayGoalMeasure(goal.currentValue, goal.unit)} / {displayGoalMeasure(goal.targetValue, goal.unit)}</span><span>{formatDate(goal.targetDate)} · {getDaysRemainingText(goal.targetDate)}</span></div>
                </button>;
              })}</div>}
            </section>

            {/* Financial Overview Card */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Monthly Finance ({financeMonth})</h3>
                <button onClick={() => navigateTo('finance')} className="text-xs text-indigo-400 font-semibold">Details &rarr;</button>
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
                <button onClick={() => navigateTo('habits')} className="text-xs text-indigo-400 font-semibold">Manage</button>
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
                <button onClick={() => navigateTo('planner')} className="text-xs text-indigo-400 font-semibold">All Tasks</button>
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
                          <p className="text-[10px] text-slate-400">{formatDate(t.dueDate)}{t.dueTime ? ` · ${formatClockTime(t.dueTime)}` : ''}</p>
                          <div className="mt-1 flex flex-wrap gap-1"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.priority === 'Urgent' ? 'bg-rose-500/20 text-rose-400' : t.priority === 'High' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>{t.priority}</span><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${status === 'Overdue' ? 'bg-rose-500/20 text-rose-300' : status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{status}</span></div>
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
                  onClick={() => navigateFinanceSubtab(sub)}
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
                  <p className="mt-2 text-[10px] text-slate-500">Current month · previous month</p>
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
                        <div key={t.id} role="button" tabIndex={0} aria-label={`Edit transaction ${t.description || t.category}`} onClick={() => openEditTransaction(t)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditTransaction(t); } }} className="cursor-pointer p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center transition hover:border-indigo-500/50 active:scale-[.995]">
                          <div>
                            <p className="font-semibold text-sm">{t.description || t.category}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(t.date)}{t.occurredAt ? ` · ${formatTime(new Date(t.occurredAt))}` : ''} &bull; {t.category} ({t.paymentMethod})</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                            </p>
                            <button
                              onClick={async event => {
                                event.stopPropagation();
                                if (!window.confirm(`Delete transaction “${t.description || t.category}”?`)) return;
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

            {financeSubtab === 'analytics' && <div className="space-y-4">
              <div className="flex items-center justify-between gap-2"><div><h3 className="text-base font-semibold">Financial insights</h3><p className="text-xs text-slate-400">Based on transactions saved on this device</p></div><label className="text-[10px] text-slate-400">Month<input type="month" aria-label="Analytics month" value={financeMonth} onChange={event => setFinanceMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs" /></label></div>
              <div className="grid grid-cols-2 gap-2.5">
                {[['Income', financeAnalytics.totalIncome, 'text-emerald-400'], ['Expenses', financeAnalytics.totalExpenses, 'text-rose-400'], ['Net savings', financeAnalytics.netSavings, financeAnalytics.netSavings < 0 ? 'text-rose-400' : 'text-primary'], ['Savings rate', financeAnalytics.savingsRate === null ? null : `${financeAnalytics.savingsRate.toFixed(1)}%`, 'text-indigo-400']].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 text-lg font-semibold ${color}`}>{value === null ? '—' : typeof value === 'number' ? formatMoney(value) : value}</p></div>)}
              </div>
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between gap-2"><div><h4 className="text-sm font-semibold">Income & expenses</h4><p className="text-xs text-slate-400">Monthly totals</p></div><select aria-label="Analytics time range" value={financeAnalyticsRange} onChange={event => setFinanceAnalyticsRange(Number(event.target.value) as 3 | 6 | 12)} className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs"><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option></select></div>
                <div className="h-56 w-full">{financeAnalytics.periodRows.some(row => row.hasRecords) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={financeAnalytics.periodRows} margin={{ top: 8, right: 4, left: -18, bottom: 2 }}><CartesianGrid vertical={false} stroke={theme === 'dark' ? '#263244' : '#dbe3ed'} /><XAxis dataKey="month" tick={{ fill: theme === 'dark' ? '#aebbd0' : '#475569', fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tickFormatter={value => Number(value).toLocaleString(userPrefs.locale === 'system' ? undefined : userPrefs.locale)} tick={{ fill: theme === 'dark' ? '#aebbd0' : '#475569', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: theme === 'dark' ? '#111827' : '#fff', borderColor: theme === 'dark' ? '#334155' : '#cbd5e1', borderRadius: 12 }} formatter={(value: number | null, name: string) => [value === null ? 'No records' : formatMoney(value), name]} labelFormatter={(_, rows) => rows?.[0]?.payload?.key || ''} /><Legend /><Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">Add transactions to see monthly trends.</div>}</div>
                <p className="mt-2 text-[11px] text-slate-500">Months without transactions are shown as missing data; a recorded month with zero income or expenses is a real zero.</p>
              </section>
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="mb-2"><h4 className="text-sm font-semibold">Expense categories</h4><p className="text-xs text-slate-400">{financeMonth} · {formatMoney(financeAnalytics.totalExpenses)} total</p></div>
                {financeAnalytics.categories.length === 0 ? <div className="py-7 text-center text-sm text-slate-400">No expense records for this month.</div> : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><div className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={financeAnalytics.categories} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}><Cell fill="#4f46e5" />{financeAnalytics.categories.slice(1).map((entry, index) => <Cell key={entry.name} fill={['#0f766e', '#d97706', '#0284c7', '#7c3aed', '#be123c', '#475569'][index % 6]} />)}</Pie><Tooltip contentStyle={{ background: theme === 'dark' ? '#111827' : '#fff', borderColor: theme === 'dark' ? '#334155' : '#cbd5e1', borderRadius: 12 }} formatter={(value: number) => formatMoney(value)} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{financeAnalytics.categories.map((entry, index) => <div key={entry.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: ['#4f46e5', '#0f766e', '#d97706', '#0284c7', '#7c3aed', '#be123c', '#475569'][index % 7] }} /><span className="truncate">{entry.name}</span></span><span className="shrink-0 text-right text-secondary">{formatMoney(entry.amount)} · {entry.percentage.toFixed(1)}%</span></div>)}</div></div>}
              </section>
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h4 className="text-sm font-semibold">Budget status</h4>{financeAnalytics.budgetRows.length === 0 ? <p className="mt-2 text-xs text-slate-400">No budgets are set for this month.</p> : <div className="mt-3 space-y-3">{financeAnalytics.budgetRows.map(row => { const pct = row.allocated ? row.spent / row.allocated * 100 : 0; return <div key={row.category}><div className="flex justify-between gap-2 text-xs"><span>{row.category}</span><span>{formatMoney(row.spent)} / {formatMoney(row.allocated)}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div><div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{pct.toFixed(0)}% used</span><span className={row.remaining < 0 ? 'text-rose-400' : ''}>{formatMoney(row.remaining)} {row.remaining < 0 ? 'over budget' : 'remaining'}</span></div></div>; })}</div>}</section>
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h4 className="text-sm font-semibold">What stands out</h4><div className="mt-2 space-y-2 text-sm text-secondary">{financeAnalytics.largestCategory ? <p>Largest expense category: <strong className="text-primary">{financeAnalytics.largestCategory.name}</strong> at {formatMoney(financeAnalytics.largestCategory.amount)} ({financeAnalytics.largestCategory.percentage.toFixed(1)}%).</p> : <p>No category insight yet; add expense records to build a comparison.</p>}{financeAnalytics.expenseChange === null ? <p>{financeAnalytics.previousMonthHasRecords ? 'No expense baseline in the previous month for a percentage comparison.' : 'Previous-month comparison is unavailable because there are no saved records for that month.'}</p> : <p>Expenses {financeAnalytics.expenseChange > 0 ? 'increased' : financeAnalytics.expenseChange < 0 ? 'decreased' : 'were unchanged'} {Math.abs(financeAnalytics.expenseChange).toFixed(1)}% from last month.</p>}{financeAnalytics.budgetRows.filter(row => row.allocated > 0 && row.spent / row.allocated >= 0.8).map(row => <p key={row.category}>{row.category} budget is {Math.round(row.spent / row.allocated * 100)}% used.</p>)}</div></section>
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
                <div className="text-center py-10 text-xs text-slate-500">No habits added. Tap demo data in Profile or create custom habits.</div>
              ) : (
                habits.map(h => {
                  const todayStr = habitsSelectedDate;
                  const stats = getHabitStreaks(h.id, todayStr);
                  const weekly = calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency);
                  const historyDays = Array.from({ length: 7 }, (_, index) => new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() - 6 + index));
                  return (
                      <div key={h.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button aria-label={`Mark ${h.name} ${stats.completedToday ? 'incomplete' : 'complete'}`} onClick={async event => { event.stopPropagation(); await StorageService.habits.logCompletion(h.id, todayStr, !stats.completedToday); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast(stats.completedToday ? 'Habit unmarked' : 'Habit finished!', 'success'); }} className={`h-9 w-9 shrink-0 rounded-full border-2 text-sm ${stats.completedToday ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-600'}`}>{stats.completedToday ? '✓' : ''}</button><button onClick={() => openEditHabit(h)} className="min-w-0 text-left"><span className={`block truncate font-semibold text-sm ${stats.completedToday ? 'line-through text-slate-500' : ''}`}>{h.name}</span><span className="block text-[10px] text-amber-400">🔥 {stats.currentStreak} day streak · best {stats.longestStreak}</span></button></div><button onClick={async event => { event.stopPropagation(); if (!window.confirm(`Delete habit “${h.name}” and its completion history?`)) return; await NotificationService.cancelHabit(h); await StorageService.habits.delete(h.id); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Habit removed', 'info'); }} className="rounded-lg px-2 py-1 text-xs text-slate-400">Delete</button></div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"><span>Weekly completion</span><span>{weekly.completed}/{weekly.scheduled} days · {weekly.rate}%</span></div><div className="mt-1 flex gap-1">{historyDays.map(day => { const dayKey = formatLocalDate(day); const done = habitLogs.some(log => log.habitId === h.id && log.date === dayKey && log.completed); return <span key={dayKey} title={`${dayKey}: ${done ? 'complete' : 'missed'}`} className={`h-2 flex-1 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-700'}`} />; })}</div>
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
                  <div className="flex items-start justify-between gap-3"><div><button onClick={() => openEditGoal(g)} className="min-h-9 text-left font-semibold text-sm hover:text-indigo-300">{g.title}</button><p className="text-[10px] text-slate-400">{g.category} · target {formatDate(g.targetDate)} · {getDaysRemainingText(g.targetDate)}</p></div><span className="text-sm font-bold text-indigo-400">{pct}%</span></div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                  <div className="flex justify-between text-xs text-slate-400"><span>{displayGoalMeasure(g.currentValue, g.unit)} / {displayGoalMeasure(g.targetValue, g.unit)}</span><span>{goalMilestones.filter(milestone => milestone.completed).length}/{goalMilestones.length} milestones</span></div>
                  <div className="flex flex-wrap gap-2"><button onClick={() => openGoalProgressForm(g)} className="rounded-lg bg-slate-800 px-2.5 py-2 text-[10px] font-semibold text-indigo-300">Update progress</button>{goalsSubtab === 'active' && <button onClick={() => openCreateForm('milestone', g.id)} className="rounded-lg bg-slate-800 px-2.5 py-2 text-[10px] font-semibold text-slate-200">+ Milestone</button>}<button onClick={async () => { await StorageService.goals.update(g.id, { status: goalsSubtab === 'completed' ? 'In Progress' : 'Completed' }); await reloadAllData(); showToast(goalsSubtab === 'completed' ? 'Goal reopened' : 'Goal completed', 'success'); }} className="rounded-lg bg-slate-800 px-2.5 py-2 text-[10px] font-semibold text-emerald-300">{goalsSubtab === 'completed' ? 'Reopen' : 'Complete'}</button><button onClick={async () => { if (!window.confirm(`Delete goal “${g.title}” and its milestones?`)) return; await NotificationService.cancelMilestones(goalMilestones); await StorageService.goals.delete(g.id); await reloadAllData(); showToast('Goal deleted', 'info'); }} className="rounded-lg bg-slate-800 px-2.5 py-2 text-[10px] text-rose-300">Delete</button></div>
                  {goalMilestones.length > 0 && <div className="space-y-2 border-t border-slate-800 pt-3">{goalMilestones.map(milestone => <div key={milestone.id} className="flex items-center gap-2"><input aria-label={`Mark ${milestone.title} complete`} type="checkbox" checked={milestone.completed} onChange={async () => { await StorageService.goals.toggleMilestone(milestone.id, !milestone.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} className="h-4 w-4 accent-indigo-500" /><div className="min-w-0 flex-1"><p className={`text-xs ${milestone.completed ? 'text-slate-500 line-through' : ''}`}>{milestone.title}</p>{milestone.targetDate && <p className="text-[10px] text-slate-500">{formatDate(milestone.targetDate)} · {getDaysRemainingText(milestone.targetDate)}</p>}</div></div>)}</div>}
                </div>;
              })
            )}
          </div>
        )}

        {/* VIEW 5: PLANNER */}
        {activeTab === 'planner' && (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Planner</p><h2 className="text-xl font-semibold tracking-tight">Your calendar</h2></div><button onClick={() => openCreateForm('task', undefined, plannerSelectedDate)} className="min-h-11 shrink-0 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition active:scale-[.98]">+ Add task</button></div>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5 shadow-sm" aria-label="Monthly task calendar">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1"><button aria-label="Previous month" onClick={() => setPlannerDisplayedMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="min-h-10 min-w-10 rounded-lg text-slate-300 transition hover:bg-slate-800 active:scale-95"><ChevronLeft size={19} className="mx-auto" /></button><h3 className="min-w-32 text-center text-sm font-semibold">{plannerDisplayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button aria-label="Next month" onClick={() => setPlannerDisplayedMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="min-h-10 min-w-10 rounded-lg text-slate-300 transition hover:bg-slate-800 active:scale-95"><ChevronRight size={19} className="mx-auto" /></button></div>
                <button onClick={() => { setPlannerSelectedDate(todayKey); setPlannerDisplayedMonth(new Date(clockNow.getFullYear(), clockNow.getMonth(), 1)); setPlannerFilter('all'); }} className="min-h-9 rounded-lg px-3 text-xs font-semibold text-indigo-400 transition active:scale-95">Today</button>
              </div>
              <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-slate-500">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} className="py-1">{day}</span>)}</div>
              <div className="grid grid-cols-7 gap-y-1">
                {calendarDays.map(day => {
                  const dayTasks = plannerTasksByDate.get(day) || [];
                  const overdue = dayTasks.some(task => getTaskStatus(task, clockNow) === 'Overdue');
                  const allComplete = dayTasks.length > 0 && dayTasks.every(task => task.completed);
                  const inMonth = day.slice(0, 7) === `${plannerDisplayedMonth.getFullYear()}-${String(plannerDisplayedMonth.getMonth() + 1).padStart(2, '0')}`;
                  const isToday = day === todayKey;
                  const selected = day === plannerSelectedDate;
                  const label = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                  return <button key={day} aria-label={`${label}${dayTasks.length ? `, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : ''}${overdue ? ', overdue tasks' : ''}`} aria-pressed={selected} onClick={() => { setPlannerSelectedDate(day); if (!inMonth) setPlannerDisplayedMonth(new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, 1)); setPlannerFilter('all'); }} className={`relative flex min-h-10 flex-col items-center justify-center rounded-xl text-xs transition active:scale-95 ${selected ? 'bg-indigo-600 font-semibold text-white shadow-sm' : isToday ? 'border border-indigo-400/70 font-semibold text-indigo-300' : inMonth ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600'}`}>
                    <span>{Number(day.slice(-2))}</span>{dayTasks.length > 0 && <span className={`mt-0.5 h-1 w-1 rounded-full ${selected ? 'bg-white' : overdue ? 'bg-rose-500' : allComplete ? 'bg-emerald-500' : 'bg-indigo-400'}`} aria-hidden="true" />}
                  </button>;
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 pt-2.5 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-indigo-400" />Tasks</span><span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />Overdue</span><span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Complete</span></div>
            </section>
            <section className="space-y-3" aria-label="Selected day agenda">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold">{plannerFilter === 'today' ? 'Today' : plannerFilter === 'tomorrow' ? 'Tomorrow' : plannerFilter === 'upcoming' ? 'Upcoming' : selectedPlannerDateLabel}</h3><p className="text-xs text-slate-500">{visiblePlannerTasks.length} task{visiblePlannerTasks.length === 1 ? '' : 's'}</p></div><button onClick={() => openCreateForm('task', undefined, plannerSelectedDate)} className="min-h-10 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-indigo-400">Quick add</button></div>
              <input aria-label="Search planner tasks" value={plannerSearch} onChange={e => setPlannerSearch(e.target.value)} placeholder="Search tasks" className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm" />
              <div className="grid grid-cols-2 gap-2"><select aria-label="Task date or status filter" value={plannerFilter} onChange={e => setPlannerFilter(e.target.value as typeof plannerFilter)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs">{['all', 'today', 'tomorrow', 'upcoming', 'pending', 'overdue', 'completed'].map(filter => <option key={filter} value={filter}>{filter === 'all' ? 'Selected day · all' : filter[0].toUpperCase() + filter.slice(1)}</option>)}</select><select aria-label="Task priority filter" value={plannerPriority} onChange={e => setPlannerPriority(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs"><option value="all">All priorities</option>{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></div>
              {plannerDetailTask && <article className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-4" aria-label="Task details"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Task details</p><h4 className="mt-1 text-lg font-semibold">{plannerDetailTask.title}</h4></div><button onClick={() => setPlannerDetailTaskId(null)} className="min-h-10 rounded-lg px-3 text-xs text-slate-400">Back to agenda</button></div><p className="mt-2 text-sm text-slate-400">{plannerDetailTask.description || 'No description added.'}</p><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-slate-800 p-3"><p className="text-xs text-slate-500">Due</p><p className="mt-1 font-medium">{formatDate(plannerDetailTask.dueDate)}{plannerDetailTask.dueTime ? ` · ${formatClockTime(plannerDetailTask.dueTime)}` : ' · end of day'}</p></div><div className="rounded-xl bg-slate-800 p-3"><p className="text-xs text-slate-500">Status</p><p className={`mt-1 font-semibold ${getTaskStatus(plannerDetailTask, clockNow) === 'Overdue' ? 'text-rose-300' : getTaskStatus(plannerDetailTask, clockNow) === 'Completed' ? 'text-emerald-300' : 'text-indigo-300'}`}>{getTaskStatus(plannerDetailTask, clockNow)}</p></div><div className="rounded-xl bg-slate-800 p-3"><p className="text-xs text-slate-500">Priority</p><p className="mt-1 font-medium">{plannerDetailTask.priority}</p></div><div className="rounded-xl bg-slate-800 p-3"><p className="text-xs text-slate-500">Reminder</p><p className="mt-1 font-medium">{plannerDetailTask.reminderAt ? formatDateTime(new Date(plannerDetailTask.reminderAt)) : 'None'}</p></div></div><div className="mt-4 flex gap-2"><button onClick={() => openEditTask(plannerDetailTask)} className="min-h-11 flex-1 rounded-xl border border-slate-700 text-sm font-semibold text-indigo-400">Edit task</button><button onClick={async () => { await StorageService.tasks.toggleCompleted(plannerDetailTask.id, !plannerDetailTask.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} className="min-h-11 flex-1 rounded-xl bg-indigo-600 text-sm font-semibold text-white">{plannerDetailTask.completed ? 'Reopen task' : 'Complete task'}</button></div></article>}
            {visiblePlannerTasks.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-9 text-center"><div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><CalendarDays size={20} /></div><p className="text-sm font-medium">Nothing planned for this view</p><p className="mt-1 text-xs text-slate-500">Choose another day or add a task when you’re ready.</p></div>
            ) : (
              <div className="space-y-2">
                {visiblePlannerTasks.map(t => {
                  const status = getTaskStatus(t, clockNow);
                  return <div key={t.id} role="button" tabIndex={0} aria-label={`Open task ${t.title}`} onClick={() => setPlannerDetailTaskId(t.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPlannerDetailTaskId(t.id); } }} className={`cursor-pointer p-3.5 rounded-xl border flex items-center justify-between gap-2 transition hover:border-indigo-500/50 ${status === 'Overdue' ? 'border-rose-500/40 bg-rose-950/25' : 'border-slate-800 bg-slate-900'}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={t.completed}
                        onClick={event => event.stopPropagation()}
                        onChange={async () => {
                          await StorageService.tasks.toggleCompleted(t.id, !t.completed);
                          if (!t.completed) await NotificationService.cancelTask(t);
                          const records = await reloadAllData();
                          await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
                        }}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      />
                      <div>
                        <span className={`text-sm font-medium ${t.completed ? 'line-through text-slate-500' : ''}`}>{t.title}</span>
                        {t.description && <p className="mt-0.5 text-xs text-slate-400">{t.description}</p>}
                        <p className="text-xs text-slate-400">Due {formatDate(t.dueDate)}{t.dueTime ? ` · ${formatClockTime(t.dueTime)}` : ' · end of day'}</p>
                        <div className="mt-1 flex gap-1"><span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{t.priority}</span><span className={`rounded px-1.5 py-0.5 text-[10px] ${status === 'Overdue' ? 'bg-rose-500/20 text-rose-300' : status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'}`}>{status}</span>{t.recurring !== 'None' && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{t.recurring}</span>}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2"><button onClick={async event => { event.stopPropagation(); if (!window.confirm(`Delete “${t.title}”?`)) return; await NotificationService.cancelTask(t); await StorageService.tasks.delete(t.id); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Task removed', 'info'); }} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-rose-400">Delete</button></div>
                  </div>
                })}
              </div>
            )}
            </section>
          </div>
        )}

        {/* VIEW 6: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="profile-page space-y-5">
            <div><p className="text-xs font-semibold tracking-wide text-indigo-400">PROFILE & PREFERENCES</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Your Profile</h2><p className="mt-1 text-sm text-slate-400">Personalize how LifeOS works for you.</p></div>

            <section className="profile-panel rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <div className="flex items-center gap-3"><div className="profile-avatar flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">{profileInitial(displayName) || <UserRound size={21} />}</div><div><p className="text-xs text-slate-400">Your LifeOS profile</p><h3 className="mt-0.5 text-lg font-semibold">{displayName.trim() || 'Personal details'}</h3></div></div>
              <label className="block text-xs text-slate-300">Display name<input value={displayName} maxLength={48} onChange={event => { void updateDisplayName(event.target.value); }} placeholder="What should LifeOS call you?" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <p className="text-xs text-slate-500">Your name appears in the greeting and Profile avatar.</p>
            </section>

            <section className="profile-panel rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
              <div><h3 className="text-base font-semibold">Security</h3><p className="mt-1 text-xs text-slate-400">Device-level authentication for the app.</p></div>
              <p className="text-xs text-slate-400">LifeOS asks Android to verify your fingerprint or device credential. Biometric data is handled by Android and is never stored by LifeOS.</p>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/60 p-3"><div><p className="text-xs font-medium">Biometric lock</p><p className="mt-1 text-[10px] text-slate-400">{biometricAvailability}</p></div><button role="switch" aria-checked={biometricEnabled} onClick={async () => { if (biometricEnabled) { setBiometricEnabled(false); setBiometricVerified(false); setIsLocked(false); await StorageService.settings.set('biometricLockEnabled', false); showToast('Biometric lock disabled', 'success'); return; } const result = await handleEnableBiometric(); if (result.success) showToast('Biometric lock enabled', 'success'); else showToast(result.message || 'Could not enable biometric lock', 'danger'); }} className={`min-h-10 min-w-16 rounded-full px-3 text-xs font-bold ${biometricEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{biometricEnabled ? 'On' : 'Off'}</button></div>
              {biometricEnabled && <p className={`flex items-center gap-1 text-[11px] ${biometricVerified ? 'text-emerald-300' : 'text-amber-300'}`}>{biometricVerified ? <ShieldCheck size={14} /> : <Shield size={14} />}{biometricVerified ? 'Biometric verified for this session' : 'Protected; authenticate to unlock'}</p>}
            </section>

            <section className="profile-panel rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
              <h3 className="text-base font-semibold">Appearance</h3><p className="text-xs text-slate-400">Choose a theme or follow Android's system setting.</p>
              <div className="grid grid-cols-3 gap-2">{([['dark', 'Dark', Moon], ['light', 'Light', Sun], ['system', 'System', Smartphone]] as const).map(([value, label, Icon]) => <button key={value} aria-pressed={appearance === value} onClick={() => void applyAppearance(value)} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-semibold ${appearance === value ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200' : 'border-slate-700 bg-slate-800 text-slate-300'}`}><Icon size={14} />{label}</button>)}</div>
            </section>

            <section className="profile-panel rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <div><h3 className="text-base font-semibold">Preferences</h3><p className="mt-1 text-xs text-slate-400">Formats affect display and new input only. Existing amounts are never converted.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-300">Currency<select value={userPrefs.currency} onChange={event => void saveUserPreference('currency', event.target.value as UserPreferences['currency'])} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="INR">INR · ₹</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option><option value="GBP">GBP · £</option></select></label>
                <label className="text-xs text-slate-300">Distance<select value={userPrefs.distance} onChange={event => void saveUserPreference('distance', event.target.value as UserPreferences['distance'])} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="km">Kilometres · km</option><option value="mi">Miles · mi</option></select></label>
                <label className="text-xs text-slate-300">Speed<select value={userPrefs.speed} onChange={event => void saveUserPreference('speed', event.target.value as UserPreferences['speed'])} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="km/h">Kilometres/hour</option><option value="m/s">Metres/second</option><option value="mph">Miles/hour</option></select></label>
                <label className="text-xs text-slate-300">Volume<select value={userPrefs.volume} onChange={event => void saveUserPreference('volume', event.target.value as UserPreferences['volume'])} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="L">Litres · L</option><option value="mL">Millilitres · mL</option><option value="US gal">US gallons</option><option value="Imp gal">Imperial gallons</option></select></label>
                <label className="text-xs text-slate-300">Date format<select value={userPrefs.dateFormat} onChange={event => void saveUserPreference('dateFormat', event.target.value as UserPreferences['dateFormat'])} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="DMY">DD/MM/YYYY</option><option value="MDY">MM/DD/YYYY</option><option value="YMD">YYYY-MM-DD</option></select></label>
                <label className="text-xs text-slate-300">Week starts<select value={userPrefs.firstDayOfWeek} onChange={event => void saveUserPreference('firstDayOfWeek', event.target.value as UserPreferences['firstDayOfWeek'])} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label>
                <label className="text-xs text-slate-300">Time format<select value={userPrefs.timeFormat} onChange={event => void saveUserPreference('timeFormat', event.target.value as UserPreferences['timeFormat'])} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="12h">12-hour</option><option value="24h">24-hour</option></select></label>
                <label className="text-xs text-slate-300">Number locale<select value={userPrefs.locale} onChange={event => void saveUserPreference('locale', event.target.value as UserPreferences['locale'])} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="system">Follow device</option><option value="en-IN">English · India</option><option value="en-US">English · US</option><option value="en-GB">English · UK</option><option value="de-DE">German · Germany</option></select></label>
              </div>
              <p className="text-[11px] text-slate-500">Financial values use one stored currency and are only reformatted here; no exchange-rate conversion is applied. Distance and volume use canonical storage units for new goal measurements. Speed is saved as a preference for features that use it.</p>
            </section>

            <button onClick={() => setProfileNotificationsOpen(true)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 text-left transition active:scale-[.99]"><span><span className="block text-sm font-semibold">Notification preferences</span><span className="mt-0.5 block text-xs text-slate-400">{notificationsEnabled ? 'Notifications enabled' : 'Notifications paused'} · {notificationDiagnostics.permission === 'granted' ? 'Android permission granted' : 'Check permission'}</span></span><ChevronRight size={18} className="shrink-0 text-slate-500" /></button>

            {profileNotificationsOpen && <div className={`fixed inset-0 z-40 overflow-y-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] ${theme === 'dark' ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'}`} role="dialog" aria-modal="true" aria-label="Notification preferences"><div className="mx-auto max-w-md space-y-4"><button onClick={() => setProfileNotificationsOpen(false)} className="flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm font-medium text-indigo-400"><ChevronLeft size={18} />Your Profile</button><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Preferences</p><h2 className="text-xl font-semibold">Local notifications</h2></div>
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <p className="text-xs text-slate-400">Android can delay inexact reminders to save battery. LifeOS does not request exact-alarm access.</p>
              <div className="flex min-h-11 items-center justify-between rounded-xl bg-slate-800/60 px-3"><span className="text-xs font-semibold">All notifications</span><button role="switch" aria-checked={notificationsEnabled} onClick={() => void setNotificationsMaster(!notificationsEnabled)} className={`min-h-9 min-w-14 rounded-full px-3 text-[11px] font-bold ${notificationsEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{notificationsEnabled ? 'On' : 'Off'}</button></div>
              <p className="text-[11px] text-slate-400">Android permission: <strong className={notificationDiagnostics.permission === 'granted' ? 'text-emerald-300' : 'text-amber-300'}>{notificationDiagnostics.permission === 'granted' ? 'Granted' : notificationDiagnostics.permission === 'denied' ? 'Denied · open settings to allow' : notificationDiagnostics.permission === 'prompt' || notificationDiagnostics.permission === 'prompt-with-rationale' ? 'Not requested yet' : notificationDiagnostics.permission}</strong></p>
              {!notificationDiagnostics.supported && <p className="text-[11px] text-amber-300">The native notification plugin is not available in this runtime.</p>}
              {(Object.keys(notificationLabels) as (keyof NotificationPreferences)[]).map(key => <div key={key} className="flex min-h-11 items-center justify-between gap-3 border-t border-slate-800 pt-2"><span className="text-xs">{notificationLabels[key]}</span><button role="switch" aria-checked={notificationPreferences[key]} onClick={() => void toggleNotificationCategory(key)} className={`min-h-9 min-w-14 rounded-full px-3 text-[11px] font-bold ${notificationPreferences[key] ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{notificationPreferences[key] ? 'On' : 'Off'}</button></div>)}
              <div className="space-y-1 rounded-xl border border-slate-800 p-3 text-[10px] text-slate-400"><p>Plugin: <span className={notificationDiagnostics.supported ? 'text-emerald-300' : 'text-amber-300'}>{notificationDiagnostics.supported ? 'available' : 'unavailable'}</span></p><p>Channel: {notificationDiagnostics.channel}</p><p>Pending notifications: {notificationDiagnostics.pendingCount}</p><p>Last scheduling error: <span className={notificationDiagnostics.lastError ? 'text-rose-300' : 'text-emerald-300'}>{notificationDiagnostics.lastError || 'None'}</span></p></div>
              <div className="grid grid-cols-2 gap-2"><button onClick={async () => { try { const at = await NotificationService.testNotification(); await refreshNotificationDiagnostics(); showToast(`Test notification scheduled for ${at.toLocaleTimeString()}`, 'success'); } catch (error) { await refreshNotificationDiagnostics(); showToast(error instanceof Error ? error.message : 'Test notification failed', 'danger'); } }} className="min-h-11 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white">Test notification · 10 sec</button><button onClick={() => void openNotificationSettings()} className="min-h-11 rounded-xl bg-slate-800 px-3 text-xs font-semibold">Android settings</button></div>
              <button onClick={() => void refreshNotificationDiagnostics()} className="min-h-10 w-full rounded-xl border border-slate-700 text-xs font-medium text-slate-300">Refresh diagnostics</button>
            </section></div></div>}

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

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
              <h3 className="text-sm font-semibold">LifeOS information</h3><p className="text-xs text-slate-400">Version {packageInfo.version} · Package com.lifeos.personal</p><p className="text-[11px] text-slate-500">Offline-first personal management. Your records are stored in the local app database.</p>
              <button onClick={async () => { if (!window.confirm('Restart the welcome tour? Your records will remain untouched. Onboarding choices may update your name, appearance, security and notification preferences.')) return; await StorageService.settings.set('onboardingCompleted', false); await StorageService.settings.set('onboardingStarted', true); await StorageService.settings.set('onboardingStep', 0); setOnboardingStep(0); setOnboardingComplete(false); setOnboardingRequired(true); }} className="min-h-10 rounded-xl border border-slate-700 px-3 text-xs font-medium">Restart onboarding</button>
            </section>

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
        </div>
      </main>

      {createKind && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) requestCloseForm(); }}>
          <form onSubmit={saveNewRecord} className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingTransactionId ? 'Edit transaction' : editingGoalId ? 'Edit goal' : editingTaskId ? 'Edit task' : editingHabitId ? 'Edit habit' : createKind === 'budget' ? 'Set monthly budget' : createKind === 'contribution' ? 'Add savings contribution' : createKind === 'savings' ? 'Add savings goal' : createKind === 'milestone' ? 'Add goal milestone' : createKind === 'goal-progress' ? 'Update goal progress' : `Add ${createKind}`}</h2>
              <button type="button" aria-label="Close" onClick={requestCloseForm} className="rounded-lg px-3 py-1 text-slate-300 hover:bg-slate-800">✕</button>
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
              <label className="mb-3 block text-xs text-slate-300">Notes (optional)<textarea rows={2} maxLength={500} value={createDraft.notes || ''} onChange={e => setCreateDraft({ ...createDraft, notes: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 flex min-h-11 items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={createDraft.isRecurring === 'yes'} onChange={e => setCreateDraft({ ...createDraft, isRecurring: e.target.checked ? 'yes' : '' })} />Recurring transaction</label>
              <label className="mb-4 block text-xs text-slate-300">Transaction date and time<input required type="datetime-local" value={createDraft.dateTime || ''} onChange={e => setCreateDraft({ ...createDraft, dateTime: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'habit' && <>
              <label className="mb-3 block text-xs text-slate-300">Description (optional)<textarea rows={2} maxLength={300} value={createDraft.description || ''} onChange={e => setCreateDraft({ ...createDraft, description: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Frequency<select value={createDraft.frequency} onChange={e => setCreateDraft({ ...createDraft, frequency: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm"><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option><option value="weekly">Weekly</option></select></label>
              <label className="mb-3 block text-xs text-slate-300">Daily target (optional)<input type="number" min="0.01" step="any" value={createDraft.targetPerDay || ''} onChange={e => setCreateDraft({ ...createDraft, targetPerDay: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Reminder time (optional)<input type="time" value={createDraft.reminderTime || ''} onChange={e => setCreateDraft({ ...createDraft, reminderTime: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              {createDraft.frequency === 'weekly' && <label className="mb-3 block text-xs text-slate-300">Reminder weekday<select value={createDraft.reminderWeekday || '2'} onChange={e => setCreateDraft({ ...createDraft, reminderWeekday: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>}
            </>}
            {createKind === 'goal' && <>
              <label className="mb-3 block text-xs text-slate-300">Category<select value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => <option key={category}>{category}</option>)}</select></label>
              <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Target<input required type="number" min="0.01" step="any" inputMode="decimal" value={createDraft.target} onChange={e => setCreateDraft({ ...createDraft, target: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label><label className="text-xs text-slate-300">Current<input type="number" min="0" step="any" inputMode="decimal" value={createDraft.current} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label></div>
              <label className="mb-3 block text-xs text-slate-300">Unit (optional)<input maxLength={20} value={createDraft.unit} onChange={e => setCreateDraft({ ...createDraft, unit: e.target.value })} placeholder="km, books, ₹..." className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-slate-300">Priority<select value={createDraft.priority || 'Medium'} onChange={e => setCreateDraft({ ...createDraft, priority: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              {editingGoalId && <label className="mb-3 block text-xs text-slate-300">Status<select value={createDraft.status || 'In Progress'} onChange={e => setCreateDraft({ ...createDraft, status: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm">{['In Progress', 'Paused', 'Completed'].map(status => <option key={status}>{status}</option>)}</select></label>}
              <label className="mb-3 block text-xs text-slate-300">Description (optional)<textarea rows={2} maxLength={500} value={createDraft.description || ''} onChange={e => setCreateDraft({ ...createDraft, description: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm" /></label>
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
            {editingTransactionId && <button type="button" onClick={async () => { if (!window.confirm('Delete this transaction? This cannot be undone.')) return; await StorageService.transactions.delete(editingTransactionId); setCreateKind(null); setEditingTransactionId(null); await reloadAllData(); showToast('Transaction deleted', 'info'); }} className="mb-2 min-h-11 w-full rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-medium text-rose-400">Delete transaction</button>}
            <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white active:scale-[.99]">{editingTransactionId ? 'Save transaction' : editingGoalId ? 'Save goal' : editingTaskId ? 'Save task' : editingHabitId ? 'Save habit' : createKind === 'budget' ? 'Save budget' : createKind === 'contribution' ? 'Save contribution' : createKind === 'goal-progress' ? 'Save progress' : `Save ${createKind}`}</button>
          </form>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-30 mx-auto grid max-w-md grid-cols-6 border-t border-slate-800 bg-slate-900/95 px-1 pt-2 backdrop-blur" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
        {(['dashboard', 'finance', 'habits', 'goals', 'planner', 'settings'] as const).map(tab => {
          const Icon = ({ dashboard: Home, finance: CircleDollarSign, habits: Activity, goals: GoalIcon, planner: CalendarDays, settings: UserRound })[tab];
          const label = ({ dashboard: 'Home', finance: 'Finance', habits: 'Habits', goals: 'Goals', planner: 'Planner', settings: 'Profile' })[tab];
          return (
          <button
            key={tab}
            onClick={() => navigateTo(tab)}
            aria-label={label}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] leading-none font-medium transition duration-200 active:scale-95 ${activeTab === tab ? 'bg-indigo-500/10 text-indigo-300 font-bold' : 'text-slate-400'}`}
          >
            {tab === 'settings' ? <span className={`flex h-[21px] w-[21px] items-center justify-center rounded-full text-[10px] font-bold ${displayName.trim() ? 'bg-indigo-500 text-white' : activeTab === tab ? 'bg-indigo-500/20 text-indigo-200' : 'bg-slate-700 text-slate-300'}`} aria-hidden="true">{profileInitial(displayName) || <Icon size={14} />}</span> : <Icon size={18} strokeWidth={activeTab === tab ? 2.4 : 1.8} aria-hidden="true" />}
            <span>{label}</span>
          </button>
          );
        })}
      </nav>

      {showExitConfirmation && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-5" role="presentation"><section className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="exit-lifeos-title"><h2 id="exit-lifeos-title" className="text-lg font-semibold">Leave LifeOS?</h2><p className="mt-2 text-sm text-slate-400">Your changes are saved on this device. You can return anytime.</p><div className="mt-5 flex gap-2"><button autoFocus onClick={() => setShowExitConfirmation(false)} className="min-h-11 flex-1 rounded-xl border border-slate-700 text-sm font-medium">Stay</button><button onClick={() => void CapacitorApp.exitApp()} className="min-h-11 flex-1 rounded-xl bg-indigo-600 text-sm font-semibold text-white">Exit app</button></div></section></div>}

      {/* In-app Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl text-xs font-semibold text-white flex items-center gap-2">
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
