import React, { Suspense, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import packageInfo from '../package.json';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Home, Leaf, Moon, Search, Shield, ShieldCheck, Smartphone, Sun, UserRound, WalletCards } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';

import { StorageService, sessionManager, activateEncryptedStorage, isEncryptedStorageActivated, validateBackupTables, getRecoveryChallenge, hasEncryptedRecords, hasPrivateRows } from './db';
import { CryptoService, type PreparedRecovery } from './services/cryptoService.ts';
import { createProtectedSessionController, type NewUserRecoveryChoice } from './services/cryptoSessionCoordinator';
import { encryptBackup, MAX_BACKUP_FILE_BYTES } from './services/backupCryptoService';
import { decodeBackupForRestore } from './services/backupImportService';
import BackupPassphraseDialog from './components/BackupPassphraseDialog';
import RecoveryDialog from './components/RecoveryDialog';
import SecureSetupDialog from './components/SecureSetupDialog';
import FirstRecordSecurityDialog from './components/FirstRecordSecurityDialog';
import { createRecoveryController } from './services/recoveryService';
import { quoteCsvCell } from './services/csvExportService.ts';
import { exportBackupFile } from './services/backupExportService';
import { confirmScreenshotResume, isSensitiveScreenshotState, setSensitiveScreenshotState } from './services/screenshotProtection';
import { BiometricService } from './services/biometricService';
import { createAuthCoordinator } from './services/authCoordinator';
import { CURRENCY_CODES, DEFAULT_USER_PREFERENCES, buildTransactionUpdate, canonicalUnit, convertMeasurement, formatCurrency, formatDatePreference, formatTimePreference, mergeUserPreferences, resolveSystemDark, type UserPreferences } from './services/userPreferences';
import { createMoneyRecordAmount, decimalToMinorUnits, formatCurrencyChoice, formatMinorUnits, getCurrencyMetadata, minorUnitsToDecimal } from './services/financeCore';
import { calculateAccountBalances } from './services/financialAccounting';
import { buildFinanceAnalytics } from './services/financeAnalytics';
import { getBudgetDisplayStatus } from './services/budgetDisplay';
import { buildDuplicateTransactionDraft } from './services/transactionDraft';
import { DEFAULT_TODAY_LAYOUT, moveTodaySection, normalizeTodayLayout, setTodaySectionVisible, TODAY_SECTION_LABELS, type TodayLayout, type TodaySectionId } from './services/todayLayout';
import { applyThemeTokens, DEFAULT_THEME_ID, resolveThemeId, THEME_CATALOG, type ThemeId } from './services/themeCatalog';
import { resolveInitialVisualTheme } from './services/systemAppearance';
import MoneyHome from './components/MoneyHome';
import MoneyAccounts from './components/MoneyAccounts';
import MoneyPlanning from './components/MoneyPlanning';
import { LifeOSMark as BrandMark } from './components/LifeOSBrand';
import SavingsGoalProgress from './components/SavingsGoalProgress';
import ConfirmationDialog, { type ConfirmationOptions } from './components/ConfirmationDialog';
import { ProfileHome, ProfileSubpage, type ProfileSection } from './components/ProfileSettings';
import ProfilePreferences from './components/ProfilePreferences';
import RetainedScreen from './components/RetainedScreen';
import ReminderStatusSummary from './components/ReminderStatusSummary';
import { useRecordDialog } from './hooks/useRecordDialog';
import { PRIMARY_NAVIGATION, primaryDestinationForTab, type MainTab } from './services/navigationCatalog';
import { popTabHistory, pushTabHistory } from './services/tabHistory';
import { beginPrimaryGesture, matchesPrimaryGestureClickSuppression, primaryGestureStartBlockReason, recordGestureTrace, resolvePrimaryGestureEnd, shouldAnimatePrimaryGestureSettlement, shouldSuppressPrimaryGestureClick, updatePrimaryGesture, type PrimaryGestureSession, type PrimaryGestureTargetKind } from './services/navigationGestures';
import { readMotionDuration, screenScrollKey } from './services/uiNavigation';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationService, type NotificationDiagnostics } from './services/notificationService';
import type { AccountTransfer, FinancialAccount, ManualExchangeRate, NotificationPreferences, PlannedCommitment, SavingsContribution } from './types';
import Onboarding from './components/Onboarding';
import { buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, formatLocalDate, formatLocalDateTime, getGoalProgress, getMonthCalendarDays, getTaskStatus, getTasksForDate, getTodayOverview, greetingForHour, profileInitial, resolveAppearance, resolveBackAction, shouldShowOnboarding, sortTasksByDeadline, sortTransactions, watchSystemTheme } from './services/domainUtils';

const FinanceCharts = React.lazy(() => import('./components/FinanceCharts'));
const FinanceProjection = React.lazy(() => import('./components/FinanceProjection'));
const LifeHub = React.lazy(() => import('./components/LifeHub'));
const PlanHub = React.lazy(() => import('./components/PlanHub'));
const InsightsHub = React.lazy(() => import('./components/InsightsHub'));

const RuntimeInfo = registerPlugin<{ getSystemGestureInsets: () => Promise<{ left: number; right: number }> }>('LifeOSRuntimeInfo');

function ScreenLoading({ label }: { label: string }) {
  return <div className="ui-loading-state p-6 text-center text-sm" role="status" aria-live="polite">{label}</div>;
}

const systemDarkPreference = () => resolveSystemDark((window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark, window.matchMedia('(prefers-color-scheme: dark)').matches);
const applyDomTheme = (theme: 'dark' | 'light', themeId: ThemeId = DEFAULT_THEME_ID) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  applyThemeTokens(themeId, theme);
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101712' : '#FAFAF7');
};

const notificationLabels: Record<keyof NotificationPreferences, string> = {
  taskReminders: 'Task reminders',
  upcomingDeadlines: 'Upcoming task deadlines',
  overdueAlerts: 'Overdue task alerts',
  habitReminders: 'Habit reminders',
  milestoneReminders: 'Goal milestone reminders',
};

type AppearancePreference = 'dark' | 'light' | 'system';
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
  const [tabTransition, setTabTransition] = useState<{ id: number; to: MainTab; phase: 'prepare' | 'running'; direction?: 'left' | 'right' } | null>(null);
  const tabTransitionSequence = useRef(0);
  const activeTransitionId = useRef<number | null>(null);
  const transitionToTab = (tab: MainTab, direction?: 'left' | 'right') => {
    const previous = activeTabRef.current;
    const outgoing = document.getElementById(`screen-${previous}`);
    outgoing?.removeAttribute('data-gesture-dragging');
    outgoing?.style.removeProperty('--gesture-x');
    swipeSettleAnimation.current?.cancel();
    swipeSettleAnimation.current = null;
    swipePointer.current = null;
    swipeOriginAction.current = null;
    activeTabRef.current = tab;
    if (previous === tab) { setActiveTab(tab); return; }
    const reducedMotion = typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      activeTransitionId.current = null;
      setTabTransition(null);
      setActiveTab(tab);
      return;
    }
    const id = ++tabTransitionSequence.current;
    activeTransitionId.current = id;
    setTabTransition({ id, to: tab, phase: 'prepare', direction });
    setActiveTab(tab);
  };
  const navigationHistory = useRef<MainTab[]>([]);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [todayLayout, setTodayLayout] = useState<TodayLayout>(DEFAULT_TODAY_LAYOUT);
  const todayLayoutRef = useRef<TodayLayout>(DEFAULT_TODAY_LAYOUT);
  const todayLayoutSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const [todayCustomizationOpen, setTodayCustomizationOpen] = useState(false);
  const [plannerSelectedDate, setPlannerSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [plannerDisplayedMonth, setPlannerDisplayedMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [plannerDetailTaskId, setPlannerDetailTaskId] = useState<string | null>(null);
  const pendingNotificationTaskId = useRef<string | null>(null);
  const pendingNotificationActionId = useRef<number | null>(null);
  const handledNotificationIds = useRef(new Set<number>());
  const [profileSection, setProfileSection] = useState<ProfileSection>('home');
  const swipePointer = useRef<PrimaryGestureSession | null>(null);
  const activeTouchPointers = useRef(new Set<number>());
  const swipeSuppressed = useRef(false);
  const swipeOriginAction = useRef<HTMLElement | null>(null);
  const swipeClickSuppression = useRef<{ pointerId: number; target: HTMLElement; expiresAt: number } | null>(null);
  const appMainElement = useRef<HTMLElement | null>(null);
  const gestureEventHandlers = useRef({
    move: (_event: PointerEvent) => {},
    up: (_event: PointerEvent) => {},
    cancel: (_event: PointerEvent) => {},
    lost: (_event: PointerEvent) => {},
  });
  const nativeGestureInsets = useRef<{ left: number; right: number } | null>(null);
  const swipeMoveFrame = useRef<number | null>(null);
  const swipeSettleAnimation = useRef<Animation | null>(null);
  const scrollPositions = useRef<Record<string, number>>({});
  const [theme, setTheme] = useState<'dark' | 'light'>(() => systemDarkPreference() ? 'dark' : 'light');
  const [appearance, setAppearancePreference] = useState<AppearancePreference>('system');
  const [visualThemeId, setVisualThemeId] = useState<ThemeId>(() => {
    try { return resolveThemeId(localStorage.getItem('lifeos-theme-id')); } catch { return DEFAULT_THEME_ID; }
  });
  const [themePreviewId, setThemePreviewId] = useState<ThemeId | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [displayName, setDisplayName] = useState('');
  const [clockNow, setClockNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [logoPhase, setLogoPhase] = useState<'brand' | 'rest'>('brand');
  const logoIntroPlayed = useRef(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationPermissionRequested, setNotificationPermissionRequested] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationDiagnostics, setNotificationDiagnostics] = useState<NotificationDiagnostics>({
    capability: 'initializing', platform: 'initializing', supported: false, permission: 'checking',
    appNotifications: 'checking', exactAlarm: 'checking', channel: 'checking', pendingCount: 0,
    visibleNotificationCount: 0, visibleNotificationIds: [], batteryOptimizationExempt: null,
    androidApi: null, packageName: null, versionName: null, versionCode: null, build: __LIFEOS_BUILD_INFO__,
    lastScheduleAttempt: null, lastScheduleResult: 'unknown', lastCancellationReason: null,
    lastActionEvent: null, lastError: '',
  });
  const [taskReminderDiagnostics, setTaskReminderDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [startupError, setStartupError] = useState('');
  const [appReady, setAppReady] = useState(false);
  const [firstRecordSecurityOpen, setFirstRecordSecurityOpen] = useState(false);
  const [recoveryProvisioned, setRecoveryProvisioned] = useState(false);
  const [recoveryDeferred, setRecoveryDeferred] = useState(false);
  const safeFirstRunBrowse = useRef(false);
  const firstRecordSetupAuthorized = useRef(false);
  const firstRecordSecurityResolver = useRef<((choice: NewUserRecoveryChoice | null) => void) | null>(null);
  const requestFirstRecordSecurity = async (): Promise<NewUserRecoveryChoice | null> => {
    await setSensitiveScreenshotState(true);
    if (firstRecordSecurityResolver.current) throw new Error('Security setup is already open.');
    return new Promise(resolve => {
      firstRecordSecurityResolver.current = choice => {
        firstRecordSecurityResolver.current = null;
        setFirstRecordSecurityOpen(false);
        resolve(choice);
      };
      setFirstRecordSecurityOpen(true);
    });
  };
  useEffect(() => () => { firstRecordSecurityResolver.current?.(null); }, []);

  useEffect(() => {
    if (!appReady && !startupError) return;
    (window as Window & { lifeosStartupReady?: boolean }).lifeosStartupReady = true;
    window.dispatchEvent(new Event('lifeos:startup-ready'));
  }, [appReady, startupError]);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const recoveryController = useRef(createRecoveryController(CryptoService, sessionManager, getRecoveryChallenge)).current;
  const [secureSetup, setSecureSetup] = useState<{ prepared?: PreparedRecovery } | null>(null);
  const secureSetupResolver = useRef<((accepted: boolean) => void) | null>(null);
  const requestSecureSetup = async (prepared?: PreparedRecovery): Promise<boolean> => {
    await setSensitiveScreenshotState(true);
    if (secureSetupResolver.current) return Promise.reject(new Error('Secure setup is already open.'));
    return new Promise(resolve => {
      secureSetupResolver.current = accepted => {
        secureSetupResolver.current = null;
        setSecureSetup(null);
        resolve(accepted);
      };
      setSecureSetup(prepared ? { prepared } : {});
    });
  };
  useEffect(() => () => { secureSetupResolver.current?.(false); }, []);
  const [backupPrompt, setBackupPrompt] = useState<'export' | 'import' | null>(null);
  const backupPassphraseResolver = useRef<((value: string | null) => void) | null>(null);
  const backupOperation = useRef(false);
  const [backupOperationInProgress, setBackupOperationInProgress] = useState(false);
  const requestBackupPassphrase = async (purpose: 'export' | 'import'): Promise<string | null> => {
    await setSensitiveScreenshotState(true);
    if (backupPassphraseResolver.current) return Promise.reject(new Error('A backup prompt is already open.'));
    return new Promise(resolve => {
      backupPassphraseResolver.current = value => {
        backupPassphraseResolver.current = null; setBackupPrompt(null); resolve(value);
      };
      setBackupPrompt(purpose);
    });
  };
  useEffect(() => () => { backupPassphraseResolver.current?.(null); }, []);


  // Biometric Lock State
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [biometricAvailability, setBiometricAvailability] = useState('Checking device support');
  const [biometricMessage, setBiometricMessage] = useState('');
  const [biometricAuthActive, setBiometricAuthActive] = useState(false);
  const [activityResumeGuard, setActivityResumeGuard] = useState(false);
  const biometricAuthInFlight = useRef<Promise<boolean> | null>(null);
  const biometricAuthenticated = useRef(false);
  const startupComplete = useRef(false);
  const encryptedSession = useRef(createProtectedSessionController(CryptoService, sessionManager, {
    hasEncryptedRecords,
    requestInitialSetup: () => {
      if (firstRecordSetupAuthorized.current) {
        firstRecordSetupAuthorized.current = false;
        return Promise.resolve(true);
      }
      return requestSecureSetup();
    },
    confirmRecovery: prepared => requestSecureSetup(prepared),
    activateStorage: activateEncryptedStorage,
    isStorageActive: isEncryptedStorageActivated,
  })).current;

  const sensitiveScreenshot = activityResumeGuard || isSensitiveScreenshotState({
    appReady,
    onboardingRequired,
    onboardingComplete,
    secureSetupOpen: secureSetup !== null || firstRecordSecurityOpen,
    recoveryOpen,
    backupPassphraseOpen: backupPrompt !== null,
    backupOperationInProgress,
    locked: isLocked,
    biometricAuthenticationInProgress: biometricAuthActive,
  });
  useEffect(() => {
    // The native Activity defaults to protected. A failed bridge call therefore
    // leaves screenshots blocked rather than exposing an uncertain screen.
    const protectUntilRevalidated = () => {
      setActivityResumeGuard(true);
      void setSensitiveScreenshotState(true).catch(() => undefined);
    };
    window.addEventListener('lifeos:activity-resumed', protectUntilRevalidated);
    void setSensitiveScreenshotState(sensitiveScreenshot).catch(() => undefined);
    return () => window.removeEventListener('lifeos:activity-resumed', protectUntilRevalidated);
  }, [sensitiveScreenshot]);
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
  const [savingsContributions, setSavingsContributions] = useState<SavingsContribution[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>([]);
  const [manualExchangeRates, setManualExchangeRates] = useState<ManualExchangeRate[]>([]);
  const [plannedCommitments, setPlannedCommitments] = useState<PlannedCommitment[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Subtab & Filter States
  const [financeSubtab, setFinanceSubtab] = useState<'overview' | 'transactions' | 'accounts' | 'budgets' | 'savings' | 'planning' | 'analytics'>('overview');
  const [openMoneyTransferOnAccounts, setOpenMoneyTransferOnAccounts] = useState(false);
  const financeSubtabHistory = useRef<Array<typeof financeSubtab>>([]);
  const [financeMonth, setFinanceMonth] = useState<string>(formatLocalDate(new Date()).substring(0, 7));
  const [financeTypeFilter, setFinanceTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [financeCategoryFilter, setFinanceCategoryFilter] = useState<string>('all');
  const [financeAccountFilter, setFinanceAccountFilter] = useState<string>('all');
  const [financeCurrencyFilter, setFinanceCurrencyFilter] = useState<string>('all');
  const [financeSearch, setFinanceSearch] = useState<string>('');
  const [financeSort, setFinanceSort] = useState<string>('date-desc');
  const [financeAnalyticsRange, setFinanceAnalyticsRange] = useState<3 | 6 | 12>(6);

  const [habitsSubtab, setHabitsSubtab] = useState<'checklist' | 'weekly' | 'monthly'>('checklist');
  const [habitsSelectedDate, setHabitsSelectedDate] = useState<string>(formatLocalDate(new Date()));

  const [goalsSubtab, setGoalsSubtab] = useState<'active' | 'paused' | 'completed'>('active');
  const [goalsCategoryFilter, setGoalsCategoryFilter] = useState<string>('all');

  const [plannerSubtab, setPlannerSubtab] = useState<'agenda' | 'weekly' | 'all'>('agenda');
  const [plannerFilter, setPlannerFilter] = useState<'all' | 'pending' | 'overdue' | 'completed' | 'today' | 'tomorrow' | 'upcoming'>('all');
  const [plannerSearch, setPlannerSearch] = useState('');
  const [plannerPriority, setPlannerPriority] = useState('all');

  // UI Toast & Modal State
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'danger' } | null>(null);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationOptions | null>(null);
  const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const [createFormDirty, setCreateFormDirty] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [createKind, setCreateKind] = useState<'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution' | 'milestone' | 'goal-progress' | null>(null);
  const [createDraft, setCreateDraft] = useState<Record<string, string>>({});
  const [transactionDetailsOpen, setTransactionDetailsOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editingSavingsGoalId, setEditingSavingsGoalId] = useState<string | null>(null);

  const backState = useRef({ createKind, modalContent, plannerDetailTaskId, profileSection, activeTab, financeSubtab, habitsSubtab, goalsSubtab, appReady, onboardingRequired, onboardingComplete, isLocked, showExitConfirmation });
  backState.current = { createKind, modalContent, plannerDetailTaskId, profileSection, activeTab, financeSubtab, habitsSubtab, goalsSubtab, appReady, onboardingRequired, onboardingComplete, isLocked, showExitConfirmation };

  const navigateTo = (tab: MainTab, direction?: 'left' | 'right') => {
    const previous = activeTabRef.current;
    if (previous === tab) return;
    scrollPositions.current[activeScreenKey] = window.scrollY;
    if (tab === 'settings') navigateProfileSection('home');
    navigationHistory.current = pushTabHistory(navigationHistory.current, previous, tab);
    setShowExitConfirmation(false);
    transitionToTab(tab, direction);
  };

  const clearGestureDrag = (animateBack: boolean) => {
    const screen = document.getElementById(`screen-${activeTabRef.current}`);
    if (!screen?.hasAttribute('data-gesture-dragging')) return;
    const transform = getComputedStyle(screen).transform;
    screen.removeAttribute('data-gesture-dragging');
    screen.style.removeProperty('--gesture-x');
    if (!animateBack || !shouldAnimatePrimaryGestureSettlement(window.matchMedia('(prefers-reduced-motion: reduce)').matches) || typeof screen.animate !== 'function') return;
    const animation = screen.animate([{ transform }, { transform: 'none' }], { duration: 110, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    swipeSettleAnimation.current = animation;
    void animation.finished.catch(() => undefined).finally(() => {
      if (swipeSettleAnimation.current === animation) swipeSettleAnimation.current = null;
    });
  };

  const cancelPrimaryGesture = (reason: string, pointerId = swipePointer.current?.pointerId ?? -1) => {
    const session = swipePointer.current;
    if (session) recordGestureTrace({ event: 'interrupted', pointerId, deltaX: 0, deltaY: 0, state: session.axis, reason }, import.meta.env.DEV);
    swipePointer.current = null;
    swipeOriginAction.current = null;
    if (swipeMoveFrame.current !== null) { window.cancelAnimationFrame(swipeMoveFrame.current); swipeMoveFrame.current = null; }
    clearGestureDrag(false);
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    void RuntimeInfo.getSystemGestureInsets().then(insets => {
      if (active && Number.isFinite(insets.left) && Number.isFinite(insets.right) && insets.left >= 0 && insets.right >= 0) {
        nativeGestureInsets.current = { left: insets.left, right: insets.right };
      }
    }).catch(() => { /* CSS safe-area values and a conservative fallback remain available. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const cancelForEnvironmentChange = () => {
      cancelPrimaryGesture('window-resized');
      activeTouchPointers.current.clear();
      swipeSuppressed.current = false;
    };
    const cancelForBackground = () => {
      if (document.visibilityState !== 'visible') {
        cancelPrimaryGesture('document-hidden');
        activeTouchPointers.current.clear();
        swipeSuppressed.current = false;
      }
    };
    const cancelForBlur = () => {
      cancelPrimaryGesture('window-blurred');
      activeTouchPointers.current.clear();
      swipeSuppressed.current = false;
    };
    window.addEventListener('resize', cancelForEnvironmentChange, { passive: true });
    window.addEventListener('blur', cancelForBlur);
    document.addEventListener('visibilitychange', cancelForBackground);
    return () => {
      window.removeEventListener('resize', cancelForEnvironmentChange);
      window.removeEventListener('blur', cancelForBlur);
      document.removeEventListener('visibilitychange', cancelForBackground);
    };
  }, []);

  const handleContentPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    // A new contact is a new interaction, even if WebView reuses its pointer ID.
    swipeClickSuppression.current = null;
    activeTouchPointers.current.add(event.pointerId);
    if (activeTouchPointers.current.size > 1) {
      swipeSuppressed.current = true;
      cancelPrimaryGesture('multiple-pointers', event.pointerId);
      recordGestureTrace({ event: 'pointerdown', pointerId: event.pointerId, deltaX: 0, deltaY: 0, state: 'suppressed', reason: 'multiple-pointers' }, import.meta.env.DEV);
      return;
    }
    if (swipeSuppressed.current) return;
    swipeSettleAnimation.current?.cancel();
    swipeSettleAnimation.current = null;
    swipePointer.current = null;

    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const hardExcluded = target.closest('[data-no-tab-swipe],[data-swipe-exclude],[data-gesture-owner="native"],[role="dialog"],[aria-modal="true"],.ui-bottom-sheet,[data-horizontal-scroll],.recharts-wrapper,[data-chart],canvas,[role="slider"],input[type="range"]');
    const textEntry = target.closest('textarea,select,[contenteditable="true"],[role="textbox"],input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"])');
    const nativePicker = target.closest('[data-native-picker],input[type="date"],input[type="time"],input[type="month"],input[type="file"],input[type="color"]');
    const interactive = target.closest('button,a,label,summary,input[type="button"],input[type="submit"],input[type="reset"],input[type="checkbox"],input[type="radio"],[role="button"],[role="switch"],[role="checkbox"],[role="tab"]');
    let ancestor: HTMLElement | null = target as HTMLElement;
    let horizontallyScrollable = false;
    while (ancestor && ancestor !== event.currentTarget) {
      const overflowX = window.getComputedStyle(ancestor).overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') && ancestor.scrollWidth > ancestor.clientWidth + 2) {
        horizontallyScrollable = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    const probe = event.currentTarget.ownerDocument.querySelector<HTMLElement>('.lifeos-safe-area-probe');
    const cssInsets = probe ? getComputedStyle(probe) : null;
    const leftSafeArea = Number.parseFloat(cssInsets?.paddingLeft || '0') || 0;
    const rightSafeArea = Number.parseFloat(cssInsets?.paddingRight || '0') || 0;
    // Android supplies the actual system gesture insets; CSS safe areas cover
    // browsers that expose them. The small fallback is a shared logical-pixel
    // minimum, not a device-specific screen coordinate.
    const leftGutter = Math.max(16, leftSafeArea, nativeGestureInsets.current?.left || 0);
    const rightGutter = Math.max(16, rightSafeArea, nativeGestureInsets.current?.right || 0);
    const systemEdge = event.clientX <= leftGutter || event.clientX >= window.innerWidth - rightGutter;
    const targetKind: PrimaryGestureTargetKind = textEntry ? 'text-entry'
      : nativePicker ? 'native-picker'
        : hardExcluded || horizontallyScrollable ? 'horizontal-control'
          : interactive ? 'ordinary-interactive' : 'content';
    const context = {
      enabled: userPrefs.swipeNavigationEnabled,
      pointerType: event.pointerType,
      settingsScreen: activeTab === 'settings',
      modalOpen: Boolean(createKind || modalContent),
      multiplePointers: activeTouchPointers.current.size > 1,
      systemEdge,
      targetKind,
    };
    const blockReason = primaryGestureStartBlockReason(context);
    if (blockReason) {
      recordGestureTrace({ event: 'pointerdown', pointerId: event.pointerId, deltaX: 0, deltaY: 0, state: 'idle', reason: blockReason }, import.meta.env.DEV);
      return;
    }
    swipeOriginAction.current = interactive instanceof HTMLElement ? interactive : null;
    swipePointer.current = beginPrimaryGesture({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), viewportWidth: window.innerWidth });
    recordGestureTrace({ event: 'pointerdown', pointerId: event.pointerId, deltaX: 0, deltaY: 0, state: 'pending' }, import.meta.env.DEV);
  };

  const handleContentPointerMove = (event: PointerEvent) => {
    const start = swipePointer.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.viewportWidth !== window.innerWidth) { cancelPrimaryGesture('viewport-changed', event.pointerId); return; }
    const update = updatePrimaryGesture(start, event.pointerId, event.clientX, event.clientY);
    swipePointer.current = update.session;
    recordGestureTrace({ event: 'pointermove', pointerId: event.pointerId, deltaX: update.deltaX, deltaY: update.deltaY, state: update.session.axis }, import.meta.env.DEV);
    if (update.session.axis === 'vertical') { clearGestureDrag(false); return; }
    if (update.session.axis === 'horizontal' && start.axis !== 'horizontal') {
      // Capture only after horizontal intent is clear. A normal button tap and
      // browser-owned vertical scroll keep their native pointer/click lifecycle.
      try { appMainElement.current?.setPointerCapture(event.pointerId); } catch { /* Window tracking remains active if capture is unavailable. */ }
    }
    if (!update.accepted || swipeMoveFrame.current !== null) return;
    const screen = document.getElementById(`screen-${activeTabRef.current}`);
    if (!screen) return;
    swipeMoveFrame.current = window.requestAnimationFrame(() => {
      swipeMoveFrame.current = null;
      if (swipePointer.current?.pointerId !== start.pointerId || swipePointer.current.axis !== 'horizontal') return;
      screen.setAttribute('data-gesture-dragging', 'true');
      screen.style.setProperty('--gesture-x', `${swipePointer.current.latestOffsetX}px`);
    });
  };

  const endPointerTracking = (pointerId: number) => {
    activeTouchPointers.current.delete(pointerId);
    if (activeTouchPointers.current.size === 0) swipeSuppressed.current = false;
  };

  const handleContentPointerUp = (event: PointerEvent) => {
    const start = swipePointer.current;
    endPointerTracking(event.pointerId);
    if (swipeSuppressed.current) return;
    if (swipeMoveFrame.current !== null) { window.cancelAnimationFrame(swipeMoveFrame.current); swipeMoveFrame.current = null; }
    if (!start || start.pointerId !== event.pointerId) return;
    const target = resolvePrimaryGestureEnd(activeTabRef.current, start, event.pointerId, event.clientX, event.clientY, performance.now(), userPrefs.swipeNavigationEnabled);
    const deltaX = event.clientX - start.startX;
    const deltaY = event.clientY - start.startY;
    recordGestureTrace({ event: 'pointerup', pointerId: event.pointerId, deltaX, deltaY, state: start.axis, decision: target || 'settle-back' }, import.meta.env.DEV);
    swipePointer.current = null;
    if (target) {
      const originAction = swipeOriginAction.current;
      if (shouldSuppressPrimaryGestureClick(start) && originAction) {
        swipeClickSuppression.current = { pointerId: event.pointerId, target: originAction, expiresAt: performance.now() + 500 };
      }
      swipeOriginAction.current = null;
      navigateTo(target, deltaX < 0 ? 'left' : 'right');
    } else {
      if (shouldSuppressPrimaryGestureClick(start) && swipeOriginAction.current) {
        swipeClickSuppression.current = { pointerId: event.pointerId, target: swipeOriginAction.current, expiresAt: performance.now() + 500 };
      }
      swipeOriginAction.current = null;
      clearGestureDrag(true);
    }
  };

  const handleContentPointerCancel = (event: PointerEvent) => {
    endPointerTracking(event.pointerId);
    const start = swipePointer.current;
    if (start?.pointerId === event.pointerId) {
      recordGestureTrace({ event: 'pointercancel', pointerId: event.pointerId, deltaX: 0, deltaY: 0, state: start.axis, reason: 'browser-cancelled' }, import.meta.env.DEV);
      swipeOriginAction.current = null;
      cancelPrimaryGesture('browser-cancelled', event.pointerId);
    }
  };

  const handleContentLostPointerCapture = (event: PointerEvent) => {
    endPointerTracking(event.pointerId);
    const start = swipePointer.current;
    if (start?.pointerId === event.pointerId) {
      recordGestureTrace({ event: 'lostpointercapture', pointerId: event.pointerId, deltaX: 0, deltaY: 0, state: start.axis, reason: 'capture-lost' }, import.meta.env.DEV);
      swipeOriginAction.current = null;
      cancelPrimaryGesture('capture-lost', event.pointerId);
    }
  };

  const handleContentClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    const suppression = swipeClickSuppression.current;
    if (!suppression) return;
    if (performance.now() > suppression.expiresAt) { swipeClickSuppression.current = null; return; }
    const hasPointerId = 'pointerId' in event.nativeEvent;
    const nativePointerId = hasPointerId ? Number((event.nativeEvent as PointerEvent).pointerId) : -1;
    const clicked = event.target instanceof Element ? event.target : null;
    if (matchesPrimaryGestureClickSuppression(suppression, { pointerId: hasPointerId ? nativePointerId : undefined, target: clicked, detail: event.detail, now: performance.now() })) {
      event.preventDefault();
      event.stopPropagation();
      swipeClickSuppression.current = null;
    }
  };

  gestureEventHandlers.current = {
    move: handleContentPointerMove,
    up: handleContentPointerUp,
    cancel: handleContentPointerCancel,
    lost: handleContentLostPointerCapture,
  };

  useEffect(() => {
    const onAdditionalPointerDown = (event: PointerEvent) => {
      const session = swipePointer.current;
      const target = event.target;
      if (!session || event.pointerId === session.pointerId || !target || appMainElement.current?.contains(target as Node)) return;
      activeTouchPointers.current.add(event.pointerId);
      swipeSuppressed.current = true;
      cancelPrimaryGesture('multiple-pointers', event.pointerId);
      recordGestureTrace({ event: 'pointerdown', pointerId: event.pointerId, deltaX: 0, deltaY: 0, state: 'suppressed', reason: 'multiple-pointers' }, import.meta.env.DEV);
    };
    const onMove = (event: PointerEvent) => gestureEventHandlers.current.move(event);
    const onUp = (event: PointerEvent) => gestureEventHandlers.current.up(event);
    const onCancel = (event: PointerEvent) => gestureEventHandlers.current.cancel(event);
    const onLost = (event: PointerEvent) => gestureEventHandlers.current.lost(event);
    window.addEventListener('pointerdown', onAdditionalPointerDown, true);
    window.addEventListener('pointermove', onMove, { capture: true, passive: true });
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    window.addEventListener('lostpointercapture', onLost, true);
    return () => {
      window.removeEventListener('pointerdown', onAdditionalPointerDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('lostpointercapture', onLost, true);
    };
  }, []);

  const navigateBack = () => {
    const state = backState.current;
    const action = resolveBackAction({ appReady: state.appReady, onboarding: state.onboardingRequired && !state.onboardingComplete, locked: state.isLocked, dialogOpen: Boolean(state.createKind || state.modalContent), exitDialogOpen: state.showExitConfirmation, taskDetailsOpen: Boolean(state.plannerDetailTaskId), tab: state.activeTab, childViewOpen: (state.activeTab === 'finance' && state.financeSubtab !== 'overview') || (state.activeTab === 'habits' && state.habitsSubtab !== 'checklist') || (state.activeTab === 'goals' && state.goalsSubtab !== 'active') || (state.activeTab === 'settings' && state.profileSection !== 'home') }, navigationHistory.current.length > 0);
    if (action === 'ignore') return;
    if (action === 'exit-app') { void CapacitorApp.exitApp(); return; }
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
      if (state.activeTab === 'settings') navigateProfileSection('home');
      return;
    }
    const history = popTabHistory(navigationHistory.current, 'dashboard');
    navigationHistory.current = history.history;
    const previous = history.next;
    if (action === 'previous-tab' && previous) {
      rememberActiveScroll();
      transitionToTab(previous);
      return;
    }
    if (action === 'home') {
      rememberActiveScroll();
      transitionToTab('dashboard');
      return;
    }
    setShowExitConfirmation(true);
  };

  // Connectivity is informational only; LifeOS records remain in local IndexedDB.
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(typeof navigator === 'undefined' || navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Initial Settings & Data
  useEffect(() => {
    void initApp().catch(error => {
      console.error('LifeOS startup failed.', error);
      setStartupError(error instanceof Error ? error.message : 'LifeOS could not open local data.');
    });
    const timer = window.setInterval(() => setClockNow(new Date()), 60_000);
    let disposed = false;
    let resumeInProgress = false;
    let appStateListener: { remove: () => Promise<void> } | undefined;

    void CapacitorApp.addListener('appStateChange', async state => {
      if (disposed) return;
      if (!state.isActive) {
        setActivityResumeGuard(true);
        backupPassphraseResolver.current?.(null);
        secureSetupResolver.current?.(false);
        setIsLocked(true);
        setBiometricVerified(false);
        biometricAuthenticated.current = false;
        authCoordinator.resetForBackground();
        // Close native admission even during setup, not only after migration.
        try { await encryptedSession.lock(); }
        catch { setBiometricMessage('The native key could not be locked. Access remains blocked.'); }
        return;
      }
      if (resumeInProgress) return;
      resumeInProgress = true;
      setBiometricAuthActive(true);
      try {
        // Wait for any previous background operation drain before reopening.
        await sessionManager.waitForIdle();
        if (disposed || !startupComplete.current) return;

        setClockNow(new Date());
        // A pristine first install may browse without private storage. Returning
        // from Android settings must not turn that safe browse into auth setup.
        if (safeFirstRunBrowse.current && !isEncryptedStorageActivated()) {
          setIsLocked(false);
          setBiometricVerified(false);
          void refreshNotificationDiagnostics();
          await confirmScreenshotResume();
          setActivityResumeGuard(false);
          return;
        }
        await encryptedSession.open();
        if (disposed || !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) return;
        biometricAuthenticated.current = true;
        setBiometricVerified(true);
        setIsLocked(false);
        if (!sessionManager.isUnlocked()) return;
        const records = await reloadAllData();
        if (disposed) return;
        const prefs = await StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
        const master = await StorageService.settings.get<boolean>('notificationsEnabled', Object.values(prefs).some(Boolean));
        // Returning from Android settings refreshes permissions/diagnostics but
        // never resumes or advances the removed multi-page onboarding wizard.
        await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones,
          effectiveNotificationPreferences(prefs, master));
        if (!disposed && typeof processPendingTaskNotification === 'function') await processPendingTaskNotification();
        if (!disposed) await refreshNotificationDiagnostics();
        if (!disposed) {
          await confirmScreenshotResume();
          setActivityResumeGuard(false);
        }
      } catch (error) {
        if (isEncryptedStorageActivated()) {
          setIsLocked(true);
          setBiometricMessage(error instanceof Error ? error.message : 'The encryption key remains locked.');
        }
        console.error('LifeOS resume recovery failed.', error);
      } finally {
        resumeInProgress = false;
        setBiometricAuthActive(false);
      }
    }).then(async listener => {
      if (disposed) await listener.remove();
      else appStateListener = listener;
    }).catch(error => {
      if (!disposed) console.error('LifeOS app-state listener registration failed.', error);
    });

    return () => {
      disposed = true;
      window.clearInterval(timer);
      if (appStateListener) void appStateListener.remove().catch(error => console.error('LifeOS app-state listener cleanup failed.', error));
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener('backButton', () => {
      if (!disposed) navigateBack();
    }).then(async value => {
      if (disposed) await value.remove();
      else listener = value;
    }).catch(error => {
      if (!disposed) console.error('LifeOS back-button listener registration failed.', error);
    });
    return () => {
      disposed = true;
      if (listener) void listener.remove().catch(error => console.error('LifeOS back-button listener cleanup failed.', error));
    };
  }, []);

  useEffect(() => {
    if (appearance !== 'system') return;
    const update = (resolved: 'dark' | 'light') => { setTheme(resolved); applyDomTheme(resolved, themePreviewId || visualThemeId); };
    const nativeTheme = (event: Event) => update((event as CustomEvent<{ dark: boolean }>).detail.dark ? 'dark' : 'light');
    window.addEventListener('lifeos:system-appearance', nativeTheme);
    const stopMedia = typeof (window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark === 'boolean'
      ? () => {}
      : watchSystemTheme(window.matchMedia('(prefers-color-scheme: dark)'), update);
    return () => { stopMedia(); window.removeEventListener('lifeos:system-appearance', nativeTheme); };
  }, [appearance, visualThemeId, themePreviewId]);

  useEffect(() => {
    if (!appReady || isLocked || (onboardingRequired && !onboardingComplete) || logoIntroPlayed.current) return;
    logoIntroPlayed.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLogoPhase('rest'); return; }
    const toRest = window.setTimeout(() => setLogoPhase('rest'), 240);
    return () => window.clearTimeout(toRest);
  }, [appReady, isLocked, onboardingRequired, onboardingComplete]);

  const activeScreenKey = screenScrollKey({
    tab: activeTab,
    financeSubtab,
    profileSection,
    goalsSubtab,
    habitsSubtab,
  });

  const rememberActiveScroll = () => { scrollPositions.current[activeScreenKey] = window.scrollY; };
  const navigateProfileSection = (section: ProfileSection) => {
    rememberActiveScroll();
    setProfileSection(section);
  };

  useEffect(() => {
    const rememberScroll = () => { scrollPositions.current[activeScreenKey] = window.scrollY; };
    window.addEventListener('scroll', rememberScroll, { passive: true });
    return () => window.removeEventListener('scroll', rememberScroll);
  }, [activeScreenKey]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollPositions.current[activeScreenKey] || 0);
    root.style.scrollBehavior = previous;
  }, [activeScreenKey]);

  const finishTabTransition = (id: number) => {
    if (activeTransitionId.current !== id) return;
    activeTransitionId.current = null;
    setTabTransition(current => current?.id === id ? null : current);
  };

  useEffect(() => {
    if (!tabTransition) return;
    const { id, phase } = tabTransition;
    if (phase === 'prepare') {
      // Commit the new opaque screen once before starting its short entrance.
      const frame = window.requestAnimationFrame(() => {
        setTabTransition(current => current?.id === id ? { ...current, phase: 'running' } : current);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const duration = readMotionDuration(getComputedStyle(document.documentElement).getPropertyValue('--motion-tab'), 260);
    const fallback = window.setTimeout(() => finishTabTransition(id), duration + 120);
    return () => window.clearTimeout(fallback);
  }, [tabTransition]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settleImmediately = () => {
      if (!preference.matches) return;
      activeTransitionId.current = null;
      setTabTransition(null);
    };
    preference.addEventListener?.('change', settleImmediately);
    return () => preference.removeEventListener?.('change', settleImmediately);
  }, []);

  useEffect(() => {
    if (!isLocked) return;
    cancelPrimaryGesture('app-locked');
    activeTouchPointers.current.clear();
    swipeSuppressed.current = false;
    swipeClickSuppression.current = null;
    activeTransitionId.current = null;
    setTabTransition(null);
  }, [isLocked]);

  const transitionPropsFor = (screen: MainTab) => {
    if (!tabTransition || tabTransition.to !== screen || activeTab !== screen) return {};
    return {
      transitionPhase: tabTransition.phase,
      transitionDirection: tabTransition.direction,
      onTransitionEnd: (event: React.TransitionEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget && event.propertyName === 'transform') finishTabTransition(tabTransition.id);
      },
    };
  };

  const showToast = (message: string, type: 'info' | 'success' | 'danger' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const confirmAction = (options: ConfirmationOptions): Promise<boolean> => new Promise(resolve => {
    confirmationResolver.current?.(false);
    confirmationResolver.current = resolve;
    setConfirmation(options);
  });

  const settleConfirmation = (confirmed: boolean) => {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  };

  useEffect(() => {
    if (isLocked && confirmation) settleConfirmation(false);
  }, [isLocked, confirmation]);

  const persistTodayLayout = (next: TodayLayout) => {
    const normalized = normalizeTodayLayout(next);
    todayLayoutRef.current = normalized;
    setTodayLayout(normalized);
    todayLayoutSaveQueue.current = todayLayoutSaveQueue.current
      .catch(() => undefined)
      .then(() => StorageService.settings.set('todayLayout', normalized))
      .catch(() => showToast('Today layout could not be saved. Your previous layout will return after restart.', 'danger'));
  };

  const todaySectionStyle = (id: TodaySectionId): React.CSSProperties => ({
    order: todayLayout.order.indexOf(id) + 2,
    display: todayLayout.hidden.includes(id) ? 'none' : undefined,
  });

  const requestCloseForm = () => {
    if (createOperation.current) return;
    if (!backState.current.createKind) return;
    const close = () => {
      setCreateKind(null); setEditingTaskId(null); setEditingHabitId(null); setEditingTransactionId(null); setEditingGoalId(null); setEditingContributionId(null); setEditingSavingsGoalId(null); setCreateFormDirty(false);
    };
    if (!createFormDirty) { close(); return; }
    void confirmAction({ title: 'Discard unsaved changes?', message: 'Your edits have not been saved.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true }).then(confirmed => { if (confirmed) close(); });
  };

  useRecordDialog(Boolean(createKind) && !isLocked, requestCloseForm);

  const navigateFinanceSubtab = (next: typeof financeSubtab) => {
    if (next === financeSubtab) return;
    rememberActiveScroll();
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
    // Bootstrap-safe preferences only.
    const savedTheme = await StorageService.settings.get<AppearancePreference>('theme', 'system');
    const savedVisualTheme = await resolveInitialVisualTheme(() => StorageService.settings.get('visualTheme', visualThemeId));
    setVisualThemeId(savedVisualTheme);
    setAppearancePreference(savedTheme);
    const resolvedTheme = resolveAppearance(savedTheme, systemDarkPreference());
    setTheme(resolvedTheme);
    applyDomTheme(resolvedTheme, savedVisualTheme);
    try { localStorage.setItem('lifeos-theme-id', savedVisualTheme); } catch { /* Cosmetic cache is optional. */ }
    localStorage.setItem('lifeos-appearance', savedTheme);

    const lockSetting = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
    setBiometricEnabled(lockSetting);
    setIsLocked(lockSetting);

    const availability = await BiometricService.isAvailable();
    setBiometricAvailability(
      availability.isAvailable
        ? 'Available'
        : availability.code === 'NOT_ENROLLED'
          ? 'Supported, but no device credential is enrolled'
          : 'Unavailable on this device'
    );

    // Only bootstrap-safe markers are read before encryption is active.
    const completed = await StorageService.settings.get<boolean>('onboardingCompleted', false);
    const started = await StorageService.settings.get<boolean>('onboardingStarted', false);
    let savedOnboardingStep = await StorageService.settings.get<number>('onboardingStep', 0);

    const nativeState = await CryptoService.getKeyState();
    const hasCiphertext = await hasEncryptedRecords();
    const hasExistingPrivateRows = await hasPrivateRows();
    const safeFirstRunState = nativeState.metadataConsistent && !nativeState.keyProvisioned &&
      !nativeState.recoveryProvisioned && !nativeState.recoveryDeferred &&
      (!nativeState.keystoreAliasPresent || nativeState.initialSetupPending === true) &&
      !nativeState.unlocked && !nativeState.recoveryNeedsRebind && !hasCiphertext && !hasExistingPrivateRows;
    if (safeFirstRunState) {
      // Empty installs and explicitly interrupted initial setup may browse
      // without private storage; the first private write resumes setup.
      safeFirstRunBrowse.current = true;
      startupComplete.current = true;
      setIsLocked(false);
      setBiometricVerified(false);
      setRecoveryProvisioned(false);
      setRecoveryDeferred(false);
      setDisplayName(await StorageService.settings.get<string>('displayName', ''));
      setOnboardingRequired(!completed);
      setOnboardingComplete(completed);
      setOnboardingStep(0);
      if (!completed && await StorageService.settings.get<boolean>('notificationDefaultsPending', false) === false) {
        await StorageService.settings.set('notificationDefaultsPending', true);
      }
      if (!started && !completed) await StorageService.settings.set('onboardingStarted', true);
      const notificationPermission = await NotificationService.checkPermission();
      await reconcileNotificationPreferences(notificationPermission);
      setAppReady(true);
      return;
    }

    safeFirstRunBrowse.current = false;
    // Existing keys, ciphertext, and legacy records retain the existing
    // authenticated migration/recovery path before private hydration.
    setIsLocked(true);
    await encryptedSession.open();
    if (!sessionManager.isUnlocked() || !isEncryptedStorageActivated()) throw new Error('Secure startup expired after app lock. Retry in the foreground.');
    biometricAuthenticated.current = true;
    setBiometricVerified(true);
    setIsLocked(false);
    const openedKeyState = await CryptoService.getKeyState();
    setRecoveryProvisioned(openedKeyState.recoveryProvisioned);
    setRecoveryDeferred(openedKeyState.recoveryDeferred === true);

    // Private preferences are read only after session authorization.
    const storedCurrency = await StorageService.settings.get<UserPreferences['currency']>('currency', 'INR');
    const savedUserPrefs = await StorageService.settings.get<Partial<UserPreferences>>('userPreferences', {});
    setUserPrefs(mergeUserPreferences(savedUserPrefs, storedCurrency));
    setDisplayName(await StorageService.settings.get<string>('displayName', ''));
    const savedTodayLayout = normalizeTodayLayout(await StorageService.settings.get<unknown>('todayLayout', DEFAULT_TODAY_LAYOUT));
    todayLayoutRef.current = savedTodayLayout;
    setTodayLayout(savedTodayLayout);

    const savedNotificationPreferences = await StorageService.settings.get<NotificationPreferences>(
      'notificationPreferences',
      DEFAULT_NOTIFICATION_PREFERENCES
    );
    const hasRequestedNotifications = await StorageService.settings.get<boolean>(
      'notificationPermissionRequested',
      false
    );
    const savedNotificationsEnabled = await StorageService.settings.get<boolean | undefined>(
      'notificationsEnabled',
      undefined
    );
    const notificationsOn =
      savedNotificationsEnabled ?? Object.values(savedNotificationPreferences).some(Boolean);

    setNotificationsEnabled(notificationsOn);
    setNotificationPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...savedNotificationPreferences
    });
    setNotificationPermissionRequested(hasRequestedNotifications);
    const notificationsEnabledAfterResume = notificationsOn;

    // This operation inspects private tables, so it must follow authentication.
    const legacyState = await StorageService.backup.hasData();
    const needsOnboarding = shouldShowOnboarding(completed, legacyState, started);

    setOnboardingRequired(needsOnboarding);
    setOnboardingComplete(completed || !needsOnboarding);
    setOnboardingStep(Math.max(0, Math.min(4, savedOnboardingStep)));

    if (!completed && !needsOnboarding) {
      await StorageService.settings.set('onboardingCompleted', true);
    }
    if (needsOnboarding && !started) {
      await StorageService.settings.set('onboardingStarted', true);
    }

    // Recheck in case the app was backgrounded during startup.
    if (!sessionManager.isUnlocked()) {
      startupComplete.current = true;
      setAppReady(true);
      return;
    }

    const records = await reloadAllData();
    await syncNotificationSchedules(
      records.tasks,
      records.habits,
      records.goals,
      records.milestones,
      effectiveNotificationPreferences(
        { ...DEFAULT_NOTIFICATION_PREFERENCES, ...savedNotificationPreferences },
        notificationsEnabledAfterResume
      )
    );
    if (typeof processPendingTaskNotification === 'function') await processPendingTaskNotification();
    startupComplete.current = true;
    setAppReady(true);
  };

  const effectiveNotificationPreferences = (preferences: NotificationPreferences, master = notificationsEnabled): NotificationPreferences => master ? preferences : DEFAULT_NOTIFICATION_PREFERENCES;

  const applyAppearance = async (preference: AppearancePreference) => {
    setAppearancePreference(preference);
    const resolved = resolveAppearance(preference, systemDarkPreference());
    setTheme(resolved);
    applyDomTheme(resolved, themePreviewId || visualThemeId);
    await StorageService.settings.set('theme', preference);
    localStorage.setItem('lifeos-appearance', preference);
  };

  const previewVisualTheme = (themeId: ThemeId) => {
    setThemePreviewId(themeId);
    applyDomTheme(theme, themeId);
  };

  const cancelVisualThemePreview = () => {
    setThemePreviewId(null);
    applyDomTheme(theme, visualThemeId);
  };

  const applyVisualTheme = async () => {
    if (!themePreviewId) return;
    try {
      await StorageService.settings.set('visualTheme', themePreviewId);
      setVisualThemeId(themePreviewId);
      try { localStorage.setItem('lifeos-theme-id', themePreviewId); } catch { /* Persistent setting remains authoritative. */ }
      setThemePreviewId(null);
      applyDomTheme(theme, themePreviewId);
      showToast('Color theme applied', 'success');
    } catch (error) {
      cancelVisualThemePreview();
      showToast(error instanceof Error ? error.message : 'Could not save this theme.', 'danger');
    }
  };

  const refreshNotificationDiagnostics = async () => {
    const diagnostics = await NotificationService.getDiagnostics();
    setNotificationDiagnostics(diagnostics);
    return diagnostics;
  };

  useEffect(() => {
    if (!appReady) return;
    void refreshNotificationDiagnostics();
  }, [appReady, profileSection]);

  const copyNotificationDiagnostics = async () => {
    const diagnostics = await refreshNotificationDiagnostics();
    const report = JSON.stringify({
      app: { version: diagnostics.versionName || diagnostics.build.appVersion, versionCode: diagnostics.versionCode, commit: diagnostics.build.commit, buildNumber: diagnostics.build.buildNumber, packageName: diagnostics.packageName },
      androidApi: diagnostics.androidApi,
      capacitor: diagnostics.build.capacitor,
      notifications: {
        capability: diagnostics.capability, platform: diagnostics.platform, permission: diagnostics.permission,
        appNotifications: diagnostics.appNotifications, exactAlarm: diagnostics.exactAlarm,
        channel: diagnostics.channel, pendingCount: diagnostics.pendingCount,
        visibleNotificationCount: diagnostics.visibleNotificationCount,
        visibleNotificationIds: diagnostics.visibleNotificationIds,
        batteryOptimizationExempt: diagnostics.batteryOptimizationExempt,
        lastScheduleAttempt: diagnostics.lastScheduleAttempt, lastScheduleResult: diagnostics.lastScheduleResult,
        lastCancellationReason: diagnostics.lastCancellationReason, lastActionEvent: diagnostics.lastActionEvent,
        lastError: diagnostics.lastError || null,
      },
      lastTaskReminder: taskReminderDiagnostics || null,
    }, null, 2);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(report);
      else {
        const field = document.createElement('textarea'); field.value = report; field.setAttribute('readonly', '');
        field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field); field.select();
        const copied = document.execCommand('copy'); field.remove();
        if (!copied) throw new Error('Clipboard is unavailable.');
      }
      showToast('Privacy-safe notification diagnostics copied', 'success');
    } catch { showToast('Could not copy diagnostics. Refresh and try again.', 'danger'); }
  };

  const askNotificationPermission = async () => {
    try {
      if (!NotificationService.isSupported()) return { granted: false, status: 'unsupported', message: 'Install the updated Android build to enable local notifications.' };
      let status = await NotificationService.checkPermission();
      if (status !== 'granted') {
        if (status !== 'prompt' && status !== 'prompt-with-rationale') {
          return { granted: false, status, message: 'Notifications remain off. You can allow them later in Settings → Notifications.' };
        }
        // Android owns prior-denial policy. Only request while the native plugin
        // reports a promptable state; never persist an unsafe pre-encryption flag.
        setNotificationPermissionRequested(true);
        status = await NotificationService.requestPermission();
        if (status !== 'granted') {
          return { granted: false, status, message: 'Notifications remain off. You can allow them later in Settings → Notifications.' };
        }
      }

      // Android can deliver approximate reminders without exact-alarm access.
      // Keep the exact-alarm state visible in Settings, but never interrupt task
      // creation or claim reminders cannot schedule solely for that reason.
      const exactAlarm = await NotificationService.checkExactAlarmPermission();
      return { granted: true, status: exactAlarm === 'granted' ? 'granted' : 'approximate' };


    } catch (error) {
      const message = error instanceof Error ? error.message : 'Android notification permission could not be checked.';
      return { granted: false, status: 'error', message };
    }
  };

  const saveNotificationSelection = async (preferences: NotificationPreferences, enabled = Object.values(preferences).some(Boolean)) => {
    setNotificationPreferences(preferences);
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
      return false;
    }
    await refreshNotificationDiagnostics();
    return true;
  };

  const updateDisplayName = async (name: string) => {
    const normalized = name.slice(0, 48).trim();
    setDisplayName(name.slice(0, 48));
    await StorageService.settings.set('displayName', normalized);
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
    setBiometricAuthActive(true);
    try {
      await setSensitiveScreenshotState(true);
      const availability = await BiometricService.isAvailable();
      if (!availability.isAvailable) return { success: false, message: availability.code === 'NOT_ENROLLED' ? 'No fingerprint or device screen lock is enrolled. Set one up in Android settings, then try again.' : 'Device authentication is not available on this device.' };
      let result: { success: boolean; message?: string };
      if (isEncryptedStorageActivated()) {
        try { await encryptedSession.open(); result = { success: true }; }
        catch (error) { return { success: false, message: error instanceof Error ? error.message : 'Encryption authentication failed.' }; }
      } else {
        result = await BiometricService.authenticate('Secure LifeOS', 'Confirm to enable the app lock');
      }
      if (!result.success) return { success: false, message: result.message || 'Authentication was not completed.' };
      if (!isEncryptedStorageActivated()) sessionManager.unlock();
      setBiometricEnabled(true); setBiometricVerified(true);
      biometricAuthenticated.current = true;
      authCoordinator.markAuthenticated();
      await StorageService.settings.set('biometricLockEnabled', true);
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Device authentication could not be completed.' };
    } finally {
      setBiometricAuthActive(false);
    }
  };

  const openRecovery = async () => {
    try {
      await setSensitiveScreenshotState(true);
      setRecoveryOpen(true);
    } catch {
      setStartupError('Recovery cannot open because screenshot protection is unavailable. Your data remains protected.');
    }
  };

  const setupRecoveryFromSettings = async () => {
    if (!isEncryptedStorageActivated() || !sessionManager.isUnlocked()) {
      showToast('Unlock LifeOS before setting up a recovery kit.', 'danger');
      return;
    }
    try {
      const state = await CryptoService.getKeyState();
      if (state.recoveryProvisioned) {
        setRecoveryProvisioned(true);
        setRecoveryDeferred(false);
        showToast('Your recovery kit is already confirmed.', 'info');
        return;
      }
      if (!state.recoveryDeferred) throw new Error('Recovery setup is unavailable for this encryption state. Your data remains protected.');
      const prepared = await CryptoService.prepareRecovery();
      if (!(await requestSecureSetup(prepared))) return;
      await CryptoService.confirmRecovery();
      const verified = await CryptoService.getKeyState();
      if (!verified.metadataConsistent || !verified.recoveryProvisioned || verified.recoveryDeferred) {
        throw new Error('Recovery-kit confirmation could not be verified. Your encrypted records remain protected.');
      }
      setRecoveryProvisioned(true);
      setRecoveryDeferred(false);
      showToast('Recovery kit confirmed for this device.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not set up a recovery kit.', 'danger');
    }
  };

  const reconcileNotificationPreferences = async (permission: string) => {
    const pendingNewUserDefaults = await StorageService.settings.get<boolean>('notificationDefaultsPending', false);
    const saved = await StorageService.settings.get<NotificationPreferences | undefined>('notificationPreferences', undefined);
    if (permission === 'granted' && pendingNewUserDefaults && !saved) {
      const defaults: NotificationPreferences = { taskReminders: true, upcomingDeadlines: true, overdueAlerts: true, habitReminders: true, milestoneReminders: true };
      await StorageService.settings.set('notificationPreferences', defaults);
      await StorageService.settings.set('notificationsEnabled', true);
      await StorageService.settings.set('notificationDefaultsPending', false);
      setNotificationPreferences(defaults);
      setNotificationsEnabled(true);
      return defaults;
    }
    if (permission === 'granted' && pendingNewUserDefaults && saved) {
      await StorageService.settings.set('notificationDefaultsPending', false);
    }
    if (saved) setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...saved });
    const enabled = permission === 'granted' && await StorageService.settings.get<boolean>('notificationsEnabled', false);
    setNotificationsEnabled(Boolean(enabled));
    return saved || DEFAULT_NOTIFICATION_PREFERENCES;
  };

  const finishOnboarding = async () => {
    await StorageService.settings.set('onboardingCompleted', true);
    await StorageService.settings.set('onboardingStarted', false);
    await StorageService.settings.set('onboardingStep', 0);
    setOnboardingStep(0);
    setOnboardingComplete(true); setOnboardingRequired(false); navigationHistory.current = []; transitionToTab('dashboard');
    // Let React commit Today and ensure the Android Activity is foregrounded
    // before invoking the native permission API. Denial never blocks entry.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      void (async () => {
        try {
          if (!NotificationService.isSupported()) return;
          await NotificationService.ensureChannel();
          const permission = await NotificationService.checkPermission();
          if (permission === 'prompt' || permission === 'prompt-with-rationale') {
            setNotificationPermissionRequested(true);
            const granted = await NotificationService.requestPermission();
            await reconcileNotificationPreferences(granted);
          } else {
            await reconcileNotificationPreferences(permission);
          }
        } catch (error) {
          console.warn('Welcome notification permission request did not complete.', error);
        } finally {
          await refreshNotificationDiagnostics();
        }
      })();
    }));
  };

  const processPendingTaskNotification = async () => {
    const taskId = pendingNotificationTaskId.current;
    if (!taskId || isLocked || !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) return;
    pendingNotificationTaskId.current = null;
    const task = (await StorageService.tasks.getAll()).find(item => item.id === taskId);
    rememberActiveScroll();
    transitionToTab('planner');
    if (!task) {
      setPlannerDetailTaskId(null);
      showToast('That reminder no longer has an available task.', 'info');
      const actionId = pendingNotificationActionId.current;
      pendingNotificationActionId.current = null;
      if (actionId !== null) await NotificationService.acknowledgeInitialTapAction(actionId);
      return;
    }
    setPlannerSelectedDate(task.dueDate);
    setPlannerDetailTaskId(task.id);
    const actionId = pendingNotificationActionId.current;
    pendingNotificationActionId.current = null;
    if (actionId !== null) await NotificationService.acknowledgeInitialTapAction(actionId);
  };

  const diagnosePlannerTaskReminder = async (task: Task) => {
    let synchronizationFailed = false;
    try {
      await NotificationService.syncTasks(tasks, effectiveNotificationPreferences(notificationPreferences, notificationsEnabled));
    } catch {
      synchronizationFailed = true;
    }
    try {
      const report = await NotificationService.diagnoseTaskReminder(
        task,
        effectiveNotificationPreferences(notificationPreferences, notificationsEnabled)
      );
      setTaskReminderDiagnostics({
        ...report,
        sessionReady: sessionManager.isUnlocked() && isEncryptedStorageActivated(),
        synchronizationFailed,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Reminder diagnostics unavailable.', 'danger');
    }
  };

  useEffect(() => {
    let disposed = false;
    let listener: { remove: () => Promise<void> } | null = null;
    let receivedListener: { remove: () => Promise<void> } | null = null;
    const handleAction = (action: { notification: { id: number; extra?: Record<string, unknown> } }) => {
      const extra = action.notification.extra || {};
      const id = action.notification.id;
      if (handledNotificationIds.current.has(id)) return;
      handledNotificationIds.current.add(id);
      window.setTimeout(() => handledNotificationIds.current.delete(id), 10_000);
      if (extra.kind === 'test') {
        navigateTo('settings');
        navigateProfileSection('notifications');
        void NotificationService.acknowledgeInitialTapAction(id);
        return;
      }
      const taskId = typeof extra.taskId === 'string' ? extra.taskId : '';
      if (!taskId) { navigateTo('planner'); void NotificationService.acknowledgeInitialTapAction(id); return; }
      pendingNotificationTaskId.current = taskId;
      pendingNotificationActionId.current = id;
      if (!isLocked && sessionManager.isUnlocked() && isEncryptedStorageActivated()) {
        void processPendingTaskNotification().catch(error => showToast(error instanceof Error ? error.message : 'Could not open that reminder.', 'danger'));
      }
    };
    void NotificationService.addActionListener(handleAction).then(async handle => {
      if (disposed) { await handle.remove(); return; }
      listener = handle;
      // The Capacitor listener receives onNewIntent; this native one-shot also
      // covers notification taps that cold-start the Activity via onCreate.
      const initialAction = await NotificationService.getInitialTapAction();
      if (initialAction) handleAction(initialAction);
    }).catch(error => console.warn('Notification tap listener could not start.', error));
    void NotificationService.addReceivedListener(() => { void refreshNotificationDiagnostics(); }).then(async handle => {
      if (disposed) { await handle.remove(); return; }
      receivedListener = handle;
    }).catch(error => console.warn('Notification delivery listener could not start.', error));
    return () => { disposed = true; if (listener) void listener.remove(); if (receivedListener) void receivedListener.remove(); };
  }, [isLocked]);

  const importBackupFile = async (file?: File) => {
    if (!file || backupOperation.current) return;
    backupOperation.current = true;
    setBackupOperationInProgress(true);
    let restored = false;
    try {
      await setSensitiveScreenshotState(true);
      if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('Backup file exceeds the supported size.');
      const text = await decodeBackupForRestore(await file.text(), {
        requestPassphrase: () => requestBackupPassphrase('import'),
        confirmLegacy: () => confirmAction({ title: 'Import a legacy backup?', message: 'This older backup is not encrypted. LifeOS will validate it before restoring. New exports are encrypted.', confirmLabel: 'Validate and continue', cancelLabel: 'Cancel' }),
        validateTables: validateBackupTables,
      });
      if (text === null) return;
      const hasRecords = await StorageService.backup.hasData();
      if (hasRecords && !(await confirmAction({ title: 'Replace existing LifeOS data?', message: 'Restoring this backup replaces the records currently on this device. Export a backup first if you may need a copy.', confirmLabel: 'Replace and restore', cancelLabel: 'Keep current data', destructive: true }))) return;
      await StorageService.backup.importData(text, { replaceExisting: hasRecords });
      restored = true;
      const records = await reloadAllData();
      const prefs = await StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
      const master = await StorageService.settings.get<boolean>('notificationsEnabled', Object.values(prefs).some(Boolean));
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...prefs });
      setNotificationsEnabled(master);
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(prefs, master));
      showToast('Backup restored successfully', 'success');
    } catch (error) {
      showToast(restored ? 'Backup restored, but the screen could not refresh. Reopen LifeOS to verify.' : error instanceof Error ? error.message : 'Could not restore this backup', 'danger');
    } finally { backupOperation.current = false; setBackupOperationInProgress(false); }
  };

  const triggerBiometricAuth = async () => {
    if (biometricAuthInFlight.current) return biometricAuthInFlight.current;
    setBiometricAuthActive(true);
    const attempt = (async () => {
      try {
        await setSensitiveScreenshotState(true);
        await encryptedSession.open();
        if (!sessionManager.isUnlocked() || !isEncryptedStorageActivated()) throw new Error('Authentication expired after app lock.');
        biometricAuthenticated.current = true;
        setIsLocked(false);
        setBiometricVerified(true);
        setBiometricMessage('');
        // Retry must complete all private startup hydration when startup was
        // cancelled; native unlock alone never marks the application ready.
        if (!startupComplete.current) await initApp();
        else await reloadAllData();
        if (typeof processPendingTaskNotification === 'function') await processPendingTaskNotification();
        return true;
      } catch (error) {
        sessionManager.lock();
        setIsLocked(true);
        setBiometricVerified(false);
        setBiometricMessage(error instanceof Error ? error.message : 'Encryption authentication failed.');
        return false;
      }
    })();
    biometricAuthInFlight.current = attempt;
    void attempt.then(() => { biometricAuthInFlight.current = null; setBiometricAuthActive(false); }, () => { biometricAuthInFlight.current = null; setBiometricAuthActive(false); });
    return attempt;
  };

  const reloadAllData = async () => {
    const [txs, cats, bgs, sgs, scs, accounts, transfers, rates, commitments, hbs, hLogs, gls, mls, tks] = await Promise.all([
      StorageService.transactions.getAll(),
      StorageService.categories.getAll(),
      StorageService.budgets.getAll(),
      StorageService.savings.getGoals(),
      StorageService.savings.getContributions(),
      StorageService.accounts.getAll(),
      StorageService.accounts.getTransfers(),
      StorageService.exchangeRates.getAll(),
      StorageService.commitments.getAll(),
      StorageService.habits.getAll(),
      StorageService.habits.getLogs(),
      StorageService.goals.getAll(),
      StorageService.goals.getAllMilestones(),
      StorageService.tasks.getAll()
    ]);

    setTransactions(txs);
    setCategories(cats);
    setBudgets(bgs);
    setSavingsGoals(sgs);
    setSavingsContributions(scs);
    setFinancialAccounts(accounts);
    setAccountTransfers(transfers);
    setManualExchangeRates(rates);
    setPlannedCommitments(commitments);
    setHabits(hbs);
    setHabitLogs(hLogs);
    setGoals(gls);
    setMilestones(mls);
    setTasks(tks);
    return { tasks: tks, habits: hbs, goals: gls, milestones: mls };
  };

  const handleHabitCompletion = async (
    habitId: string,
    habitName: string,
    date: string,
    currentlyCompleted: boolean
  ) => {
    try {
      await StorageService.habits.logCompletion(habitId, date, !currentlyCompleted);
    } catch (error) {
      console.error('LifeOS could not save habit completion.', error);
      showToast(error instanceof Error ? error.message : 'Could not update habit completion', 'danger');
      return;
    }

    let records;
    try {
      records = await reloadAllData();
    } catch (error) {
      console.error('Habit was saved, but LifeOS could not refresh its data.', error);
      showToast(`${habitName} was saved, but the screen could not refresh. Reopen Habits to verify.`, 'danger');
      return;
    }

    try {
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
    } catch (error) {
      console.error('Habit was saved, but notification schedules could not refresh.', error);
      showToast(`${habitName} was saved, but notification schedules could not refresh.`, 'danger');
      return;
    }

    showToast(currentlyCompleted ? 'Habit unmarked' : 'Habit finished!', 'success');
  };

  const handleHabitDeletion = async (habit: Habit) => {
    try {
      await StorageService.habits.delete(habit.id);
    } catch (error) {
      console.error('LifeOS could not delete habit.', error);
      showToast(error instanceof Error ? error.message : 'Could not delete habit', 'danger');
      return;
    }

    let records;
    try {
      records = await reloadAllData();
    } catch (error) {
      console.error('Habit was deleted, but LifeOS could not refresh its data.', error);
      showToast(`${habit.name} was deleted, but the screen could not refresh. Reopen Habits to verify.`, 'danger');
      return;
    }

    try {
      await NotificationService.cancelHabit(habit);
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
    } catch (error) {
      console.error('Habit was deleted, but notification schedules could not refresh.', error);
      showToast(`${habit.name} was deleted, but notification schedules could not refresh.`, 'danger');
      return;
    }

    showToast('Habit removed', 'info');
  };

  const openCreateForm = (kind: 'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution' | 'milestone' | 'goal-progress', goalId?: string, taskDate?: string) => {
    const now = new Date();
    const today = formatLocalDate(now);
    setCreateFormDirty(false);
    setCreateDraft({
      title: '', amount: '', category: kind === 'transaction' ? (categories.find(category => category.type === 'expense')?.name || '') : kind === 'goal' ? 'Other' : '', date: taskDate || today, month: financeMonth,
      dateTime: formatLocalDateTime(now), time: '', reminderAt: '', description: '', notes: '',
      currencyCode: userPrefs.currency, accountId: '', type: 'expense', priority: 'Medium', frequency: 'daily', target: '', current: '0', unit: '',
      goalId: goalId || '', recurring: 'None', reminderWeekday: '2',
    });
    setEditingTaskId(null);
    setEditingHabitId(null);
    setEditingTransactionId(null);
    setEditingGoalId(null);
    setEditingContributionId(null);
    setEditingSavingsGoalId(null);
    setTransactionDetailsOpen(false);
    setCreateKind(kind);
  };

  const openEditTransaction = (transaction: Transaction) => {
    setCreateFormDirty(false);
    setCreateDraft({
      title: transaction.description || '', amount: String(transaction.amount), category: transaction.category,
      type: transaction.type, paymentMethod: transaction.paymentMethod || 'Other',
      currencyCode: transaction.currencyCode || userPrefs.currency, accountId: transaction.accountId || '',
      dateTime: transaction.occurredAt ? formatLocalDateTime(new Date(transaction.occurredAt)) : '',
      notes: transaction.notes || '', isRecurring: transaction.isRecurring ? 'yes' : '',
    });
    setTransactionDetailsOpen(true);
    setEditingTransactionId(transaction.id); setEditingTaskId(null); setEditingHabitId(null); setEditingGoalId(null); setCreateKind('transaction');
  };

  const openEditSavingsGoal = (goal: SavingsGoal) => {
    setCreateFormDirty(false);
    setCreateDraft({ title: goal.title, target: String(goal.targetAmount), current: String(goal.currentAmount), category: goal.category || '', date: goal.targetDate });
    setEditingSavingsGoalId(goal.id); setEditingTaskId(null); setEditingHabitId(null); setEditingTransactionId(null); setEditingGoalId(null); setEditingContributionId(null); setCreateKind('savings');
  };

  const openEditContribution = (contribution: SavingsContribution) => {
    setCreateFormDirty(false);
    setCreateDraft({ goalId: contribution.goalId, amount: String(contribution.amount), date: contribution.date, notes: contribution.notes || '' });
    setEditingContributionId(contribution.id);
    setEditingTaskId(null); setEditingHabitId(null); setEditingTransactionId(null); setEditingGoalId(null);
    setCreateKind('contribution');
  };

  const openDuplicateTransaction = (transaction: Transaction) => {
    openCreateForm('transaction');
    setCreateDraft(current => buildDuplicateTransactionDraft(current, transaction));
  };

  const openEditGoal = (goal: Goal) => {
    setCreateFormDirty(false);
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
    setCreateFormDirty(false);
    setCreateDraft({
      title: task.title, description: task.description || task.notes || '', date: task.dueDate,
      time: task.dueTime || '', reminderAt: task.reminderAt ? formatLocalDateTime(new Date(task.reminderAt)) : '',
      priority: task.priority, category: task.category || '', recurring: task.recurring || 'None',
    });
    setEditingTaskId(task.id);
    setCreateKind('task');
  };

  const openGoalProgressForm = (goal: Goal) => {
    setCreateFormDirty(false);
    setCreateDraft({ goalId: goal.id, current: String(goal.currentValue) });
    setEditingTaskId(null);
    setCreateKind('goal-progress');
  };

  const openEditHabit = (habit: Habit) => {
    setCreateFormDirty(false);
    setCreateDraft({ title: habit.name, description: habit.description || '', targetPerDay: habit.targetPerDay === undefined ? '' : String(habit.targetPerDay), frequency: habit.frequency, reminderTime: habit.reminderTime || '', reminderWeekday: String(habit.reminderWeekday || 2) });
    setEditingHabitId(habit.id);
    setEditingTaskId(null);
    setCreateKind('habit');
  };

  const createOperation = useRef(false);

  const ensurePrivateStorageBeforeWrite = async () => {
    if (isEncryptedStorageActivated() && sessionManager.isUnlocked()) return;
    const choice = await requestFirstRecordSecurity();
    if (!choice) throw new Error('Security setup was cancelled. No private record was saved.');
    firstRecordSetupAuthorized.current = true;
    try {
      await encryptedSession.open({ recoveryChoice: choice });
    } finally {
      firstRecordSetupAuthorized.current = false;
    }
    if (!sessionManager.isUnlocked() || !isEncryptedStorageActivated()) {
      throw new Error('Encrypted storage could not be verified. No private record was saved.');
    }
    safeFirstRunBrowse.current = false;
    setIsLocked(false);
    setBiometricEnabled(true);
    setBiometricVerified(true);
    biometricAuthenticated.current = true;
    const state = await CryptoService.getKeyState();
    if (!state.metadataConsistent || !state.keyProvisioned || !state.unlocked ||
        (!state.recoveryProvisioned && !state.recoveryDeferred)) {
      throw new Error('Encryption and recovery state could not be verified. No private record was saved.');
    }
    setRecoveryProvisioned(state.recoveryProvisioned);
    setRecoveryDeferred(state.recoveryDeferred === true);
    await StorageService.settings.set('biometricLockEnabled', true);
    await reloadAllData();
  };

  const saveNewRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createKind || createOperation.current) return;
    createOperation.current = true;
    setRecordSaving(true);
    let committed = false;
    const value = (key: string) => (createDraft[key] || '').trim();
    let reminderCouldNotEnable = false;
    try {
      await ensurePrivateStorageBeforeWrite();
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
        const existingTransaction = editingTransactionId ? transactions.find(tx => tx.id === editingTransactionId) : undefined;
        const preserveUnknownTime = Boolean(existingTransaction && !existingTransaction.occurredAt && !value('dateTime'));
        const values = { ...buildTransactionUpdate({ type: value('type') as 'income' | 'expense', amount: value('amount'), currencyCode: (value('currencyCode') || existingTransaction?.currencyCode || (!editingTransactionId ? userPrefs.currency : undefined)) as typeof CURRENCY_CODES[number] | undefined, category: value('category'), description: value('title'), dateTime: value('dateTime'), date: existingTransaction?.date, preserveUnknownTime, paymentMethod: value('paymentMethod'), notes: value('notes'), isRecurring: value('isRecurring') === 'yes' }), accountId: value('accountId') || existingTransaction?.accountId };
        const accountId = values.accountId;
        if (accountId && !financialAccounts.some(account => account.id === accountId && account.isActive && account.currencyCode === (values.currencyCode || existingTransaction?.currencyCode || userPrefs.currency))) throw new Error('Choose an active account with the same currency as this transaction.')
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
        const money = createMoneyRecordAmount(value('amount'), userPrefs.currency);
        await StorageService.budgets.upsert({ categoryId: value('categoryId') || undefined, monthlyAmount: money.amount, amountMinor: money.amountMinor, currencyCode: money.currencyCode, monthYear: value('month') });
      } else if (createKind === 'savings') {
        const target = createMoneyRecordAmount(value('target'), editingSavingsGoalId ? savingsGoals.find(goal => goal.id === editingSavingsGoalId)?.currencyCode || userPrefs.currency : userPrefs.currency);
        if (editingSavingsGoalId) {
          const existing = savingsGoals.find(goal => goal.id === editingSavingsGoalId);
          if (!existing) throw new Error('This savings goal is no longer available. Refresh Savings before editing.');
          await StorageService.savings.updateGoal(editingSavingsGoalId, { title: value('title'), targetAmount: target.amount, targetAmountMinor: target.amountMinor, currencyCode: existing.currencyCode || target.currencyCode, ...(existing.currentAmountMinor ? {} : { currentAmountMinor: decimalToMinorUnits(String(existing.currentAmount), existing.currencyCode || target.currencyCode).toString() }), targetDate: value('date'), category: value('category') || undefined });
        } else {
          const current = createMoneyRecordAmount(value('current') || '0', userPrefs.currency, true);
          await StorageService.savings.addGoal({ title: value('title'), targetAmount: target.amount, currentAmount: current.amount, targetAmountMinor: target.amountMinor, currentAmountMinor: current.amountMinor, currencyCode: userPrefs.currency, targetDate: value('date'), category: value('category') || undefined });
        }
      } else if (createKind === 'contribution') {
        if (editingContributionId) {
          const existingContribution = savingsContributions.find(row => row.id === editingContributionId);
          if (!existingContribution) throw new Error('This contribution is no longer available. Refresh Savings before editing.');
          const code = existingContribution.currencyCode;
          const money = code ? createMoneyRecordAmount(value('amount'), code) : null;
          await StorageService.savings.updateContribution(editingContributionId, {
            amount: money?.amount ?? Number(value('amount')),
            ...(money ? { amountMinor: money.amountMinor, currencyCode: money.currencyCode } : {}),
            date: value('date'), notes: value('notes') || undefined,
          });
        } else {
          const money = createMoneyRecordAmount(value('amount'), userPrefs.currency);
          await StorageService.savings.addContribution({
            goalId: value('goalId'), amount: money.amount, amountMinor: money.amountMinor,
            currencyCode: money.currencyCode, date: value('date'), notes: value('notes') || undefined
          });
        }
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
      // A resolved storage write is committed. Close before fallible refresh work.
      committed = true;
      setCreateKind(null);
      setCreateFormDirty(false);
      setEditingTaskId(null); setEditingHabitId(null);
      setEditingTransactionId(null); setEditingGoalId(null); setEditingContributionId(null); setEditingSavingsGoalId(null);
      const records = await reloadAllData();
      const reminderOptedIn = createKind === 'task' && Boolean(value('reminderAt')) && !reminderCouldNotEnable;
      const schedulePreferences = { ...notificationPreferences, taskReminders: reminderOptedIn || notificationPreferences.taskReminders };
      const schedulesUpdated = await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(schedulePreferences, notificationsEnabled || reminderOptedIn));
      const wasEditingTask = editingTaskId;
      const wasEditingHabit = editingHabitId;
      const wasEditingTransaction = editingTransactionId;
      const wasEditingGoal = editingGoalId;
      const wasEditingContribution = editingContributionId;
      const reminderSyncFailed = createKind === 'task' && Boolean(value('reminderAt')) && !reminderCouldNotEnable && !schedulesUpdated;
      showToast(reminderCouldNotEnable ? 'Task saved, but Android notification permission is unavailable. Enable it in Profile to receive its reminder.' : reminderSyncFailed ? 'Task saved, but its reminder was not confirmed in Android. Open task details and check reminder status.' : wasEditingTask ? 'Task updated' : wasEditingHabit ? 'Habit updated' : wasEditingTransaction ? 'Transaction updated' : wasEditingGoal ? 'Goal updated' : wasEditingContribution ? 'Contribution updated and savings total reconciled' : createKind === 'milestone' ? 'Milestone added' : createKind === 'goal-progress' ? 'Goal progress updated' : `${createKind[0].toUpperCase()}${createKind.slice(1)} added`, reminderCouldNotEnable || reminderSyncFailed ? 'danger' : 'success');
    } catch (error) {
      showToast(committed ? 'Saved, but the view or reminders could not refresh. Reopen the list to refresh; do not submit this item again.' : error instanceof Error ? error.message : 'Could not save this item', 'danger');
    } finally { createOperation.current = false; setRecordSaving(false); }
  };

  const accountBalances = useMemo(() => calculateAccountBalances(financialAccounts, transactions, accountTransfers), [financialAccounts, transactions, accountTransfers]);
  const accountSummaries = financialAccounts.filter(account => account.isActive).map(account => ({ id: account.id, name: account.name, type: account.type, currencyCode: account.currencyCode, balanceMinor: (accountBalances.get(account.id) || 0n).toString() }));

  const formatMoney = (amount: number, currencyCode: string = userPrefs.currency) => {
    return formatCurrency(Number(amount) || 0, currencyCode, userPrefs.locale);
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
    const monthlyAllTxs = transactions.filter(t => t.date && t.date.startsWith(financeMonth));
    const monthlyTxs = monthlyAllTxs.filter(t => !t.currencyCode || t.currencyCode === userPrefs.currency);
    let totalIncomeMinor = 0n;
    let totalExpensesMinor = 0n;
    const categoryExpenseMinor: Record<string, bigint> = Object.create(null);
    const minorOf = (tx: Transaction) => tx.amountMinor && tx.currencyCode === userPrefs.currency && /^(0|[1-9]\d*)$/.test(tx.amountMinor)
      ? BigInt(tx.amountMinor) : decimalToMinorUnits(tx.amount, userPrefs.currency);

    for (const tx of monthlyTxs) {
      const amt = minorOf(tx);
      if (tx.type === 'income') {
        totalIncomeMinor += amt;
      } else if (tx.type === 'expense') {
        totalExpensesMinor += amt;
        categoryExpenseMinor[tx.category] = (categoryExpenseMinor[tx.category] || 0n) + amt;
      }
    }

    const totalIncome = Number(minorUnitsToDecimal(totalIncomeMinor, userPrefs.currency));
    const totalExpenses = Number(minorUnitsToDecimal(totalExpensesMinor, userPrefs.currency));
    const categoryExpenses: Record<string, number> = Object.create(null);
    for (const [category, amount] of Object.entries(categoryExpenseMinor)) {
      categoryExpenses[category] = Number(minorUnitsToDecimal(amount, userPrefs.currency));
    }

    const remainingBalance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

    const totalBudgetMinor = budgets.filter(b => !b.categoryId && (!b.monthYear || b.monthYear === financeMonth) && (!b.currencyCode || b.currencyCode === userPrefs.currency))
      .reduce((total, budget) => total + (budget.amountMinor && budget.currencyCode === userPrefs.currency && /^(0|[1-9]\d*)$/.test(budget.amountMinor)
        ? BigInt(budget.amountMinor) : decimalToMinorUnits(budget.monthlyAmount, userPrefs.currency)), 0n);
    const totalBudget = Number(minorUnitsToDecimal(totalBudgetMinor, userPrefs.currency));

    const budgetUtilisation = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
    const remainingBudget = totalBudget - totalExpenses;
    const previousMonthRows = transactions.filter(t => t.date?.startsWith(previousMonthKey(financeMonth)) && (!t.currencyCode || t.currencyCode === userPrefs.currency));
    const previousMonthTotal = (type: 'income' | 'expense') => Number(minorUnitsToDecimal(
      previousMonthRows.filter(t => t.type === type).reduce((sum, tx) => sum + minorOf(tx), 0n), userPrefs.currency));

    return {
      totalIncome,
      totalExpenses,
      remainingBalance,
      savingsRate: Number(savingsRate.toFixed(1)),
      excludedCurrencyCount: monthlyAllTxs.length - monthlyTxs.length,
      totalBudget,
      budgetUtilisation: Number(budgetUtilisation.toFixed(1)),
      remainingBudget,
      categoryExpenses,
      previousMonthIncome: previousMonthTotal('income'),
      previousMonthExpenses: previousMonthTotal('expense'),
      count: monthlyTxs.length
    };
  }, [transactions, budgets, financeMonth, userPrefs.currency]);

  const financeAnalytics = useMemo(() => buildFinanceAnalytics(transactions, budgets, financeMonth, financeAnalyticsRange, categories, userPrefs.currency), [transactions, budgets, financeMonth, financeAnalyticsRange, categories, userPrefs.currency]);
  const hasFinanceChartData = financeAnalytics.periodRows.some(row => row.hasRecords) || financeAnalytics.categories.length > 0;

  // Habit Streak Calculation Helper
  const getHabitStreaks = (habitId: string, targetDate: string) => {
    const stats = calculateStreaks(habitLogs, habitId, targetDate, habits.find(h => h.id === habitId)?.frequency || 'daily');
    return { ...stats, totalCount: new Set(habitLogs.filter(log => log.habitId === habitId && log.completed).map(log => log.date)).size };
  };

  const todayKey = formatLocalDate(clockNow);
  const todayOverview = useMemo(
    () => getTodayOverview(tasks, habits, habitLogs, todayKey),
    [tasks, habits, habitLogs, todayKey]
  );
  const lifeHubHabits = useMemo(() => habits.map(habit => {
    const stats = getHabitStreaks(habit.id, todayKey);
    return { id: habit.id, name: habit.name, completedToday: stats.completedToday, currentStreak: stats.currentStreak };
  }), [habits, habitLogs, todayKey]);
  const lifeHubGoals = useMemo(() => goals.filter(goal => goal.status === 'In Progress').map(goal => {
    const goalMilestones = milestones.filter(milestone => milestone.goalId === goal.id);
    return { id: goal.id, title: goal.title, progress: getGoalProgress(goal.currentValue, goal.targetValue), current: displayGoalMeasure(goal.currentValue, goal.unit), target: displayGoalMeasure(goal.targetValue, goal.unit), targetDate: formatDate(goal.targetDate), completedMilestones: goalMilestones.filter(milestone => milestone.completed).length, milestoneCount: goalMilestones.length };
  }), [goals, milestones, userPrefs.dateFormat, userPrefs.distance, userPrefs.volume, userPrefs.speed]);
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
  const dashboardUpcomingTasks = useMemo(() => sortTasksByDeadline(tasks.filter(task => !task.completed && task.dueDate > todayKey), clockNow).slice(0, 4), [tasks, clockNow, todayKey]);
  const visiblePlannerTasks = useMemo(() => {
    const dateScopedTasks = ['today', 'tomorrow', 'upcoming'].includes(plannerFilter) ? tasks : getTasksForDate(tasks, plannerSelectedDate);
    return sortTasksByDeadline(dateScopedTasks.filter(task => {
    const status = getTaskStatus(task, clockNow);
    const dateScope = ['today', 'tomorrow', 'upcoming'].includes(plannerFilter);
    const statusMatch = dateScope || plannerFilter === 'all' ? true : status.toLowerCase() === plannerFilter;
    const dateMatch = plannerFilter === 'today' ? task.dueDate === todayKey
      : plannerFilter === 'tomorrow' ? task.dueDate === tomorrowKey
        : plannerFilter === 'upcoming' ? task.dueDate > todayKey && task.dueDate <= formatLocalDate(new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() + 7))
          : task.dueDate === plannerSelectedDate;
    const query = plannerSearch.trim().toLowerCase();
    const searchMatch = !query || `${task.title} ${task.description || ''} ${task.notes || ''} ${task.category || ''}`.toLowerCase().includes(query);
    return statusMatch && dateMatch && searchMatch && (plannerPriority === 'all' || task.priority === plannerPriority);
    }), clockNow);
  }, [tasks, clockNow, plannerFilter, plannerSearch, plannerPriority, todayKey, tomorrowKey, plannerSelectedDate]);
  const plannerDetailTask = plannerDetailTaskId ? tasks.find(task => task.id === plannerDetailTaskId) : undefined;

  const goalProgress = (goal: Goal) => getGoalProgress(goal.currentValue, goal.targetValue);
  const editingLegacyDateOnly = Boolean(createKind === 'transaction' && editingTransactionId
    && !transactions.find(tx => tx.id === editingTransactionId)?.occurredAt);
  const filteredTransactions = useMemo(() => sortTransactions(transactions.filter(tx => {
    const query = financeSearch.trim().toLowerCase();
    const haystack = `${tx.description || ''} ${tx.category || ''} ${tx.notes || ''} ${tx.paymentMethod || ''}`.toLowerCase();
    return tx.date?.startsWith(financeMonth)
      && (financeTypeFilter === 'all' || tx.type === financeTypeFilter)
      && (financeCategoryFilter === 'all' || tx.category === financeCategoryFilter)
      && (financeAccountFilter === 'all' || (financeAccountFilter === 'unassigned' ? !tx.accountId : tx.accountId === financeAccountFilter))
      && (financeCurrencyFilter === 'all' || (tx.currencyCode || userPrefs.currency) === financeCurrencyFilter)
      && (!query || haystack.includes(query));
  }), financeSort as 'date-asc' | 'date-desc' | 'amount-desc'),
  [transactions, financeMonth, financeTypeFilter, financeCategoryFilter, financeAccountFilter, financeCurrencyFilter, userPrefs.currency, financeSearch, financeSort]);
  const financeOverviewTransactions = useMemo(
    () => sortTransactions(transactions.filter(tx => tx.date?.startsWith(financeMonth)), 'date-desc').slice(0, 4),
    [transactions, financeMonth]
  );

  if (secureSetup) return <SecureSetupDialog prepared={secureSetup.prepared} onDecision={accepted => secureSetupResolver.current?.(accepted)} />;

  if (recoveryOpen) return <RecoveryDialog onRecover={kit => { setIsLocked(true); biometricAuthenticated.current = false; authCoordinator.resetForBackground(); return recoveryController.recover(kit).then(async () => { setRecoveryOpen(false); setStartupError(''); await initApp(); }); }} onClose={() => setRecoveryOpen(false)} />;

  if (backupPrompt) return <BackupPassphraseDialog purpose={backupPrompt} onComplete={value => backupPassphraseResolver.current?.(value)} />;

  if (!appReady) return <div className="lifeos-page fixed inset-0 flex items-center justify-center px-6" aria-label={startupError ? 'LifeOS could not start' : 'Loading LifeOS'}>{startupError ? <div className="max-w-sm text-center"><h1 className="text-xl font-semibold">LifeOS could not open</h1><p className="mt-2 text-sm text-secondary">{startupError}</p><button className="lifeos-accent-button mt-5 min-h-11 rounded-xl px-5 text-sm font-semibold" onClick={() => { setStartupError(''); void initApp().catch(error => setStartupError(error instanceof Error ? error.message : 'LifeOS could not open local data.')); }}>Try again</button><button className="lifeos-input mt-3 block min-h-11 w-full rounded-xl px-4" onClick={() => { void openRecovery(); }}>Recover encryption key</button></div> : <div className="h-8 w-8 animate-spin rounded-full border-2 lifeos-border" style={{ borderTopColor: 'var(--accent)' }} aria-hidden="true" />}</div>;

  if (firstRecordSecurityOpen) return <FirstRecordSecurityDialog onDecision={choice => {
    void setSensitiveScreenshotState(false).catch(() => {});
    firstRecordSecurityResolver.current?.(choice);
  }} />;

  if (onboardingRequired && !onboardingComplete && !isLocked) return <Onboarding
    initialName={displayName}
    onSaveIdentity={updateDisplayName}
    onFinish={finishOnboarding}
  />;

  // If App is Biometrically Locked, render Lock Screen Overlay
  if (isLocked) {
    return (
      <div className="lifeos-page fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="lifeos-tint lifeos-border mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border">
          <svg className="h-10 w-10 lifeos-accent-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">LifeOS is Locked</h2>
        <p className="text-sm text-secondary mb-8 max-w-xs">Biometric authentication is required to protect your personal data.</p>
        <button
          onClick={triggerBiometricAuth}
          className="lifeos-accent-button min-h-12 w-full max-w-xs rounded-xl px-6 py-3.5 font-semibold active:scale-95 transition"
        >
          {biometricMessage ? 'Try again' : 'Verify Biometrics'}
        </button>
          <button className="lifeos-input mt-3 min-h-11 rounded-xl px-4" onClick={() => { void openRecovery(); }}>Recover encryption key</button>
        {biometricMessage && <p role="status" className="lifeos-warning mt-4 max-w-xs text-sm">{biometricMessage}</p>}
      </div>
    );
  }

  return (
    <div className="lifeos-page app-shell">
      <span className="lifeos-safe-area-probe" aria-hidden="true" />
      {/* Top Mobile Header */}
      <header className="app-header app-header-shell sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`lifeos-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl logo-${logoPhase}`} aria-hidden="true">
            <BrandMark className="h-8 w-8" />
          </div>
          <h1 className="app-brand-name">LifeOS</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => navigateTo('settings')} aria-label="Open profile and settings" className="app-profile-button flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition active:scale-95">{profileInitial(displayName) || <UserRound size={18} aria-hidden="true" />}</button>
        </div>
      </header>

      {!isOnline && (
        <div role="status" aria-live="polite" className="app-content-width px-4 pt-2">
          <div className="lifeos-warning lifeos-panel rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'var(--warning)' }}>
            Offline — LifeOS records remain stored on this device. Internet-dependent services may be unavailable.
          </div>
        </div>
      )}

      {/* Main Container */}
      <main ref={appMainElement} className="app-main" onPointerDown={handleContentPointerDown} onClickCapture={handleContentClickCapture}>
        <div className="ui-tab-screen-stack">
        {/* VIEW 1: DASHBOARD */}
        <RetainedScreen active={activeTab === 'dashboard'} id="screen-dashboard" {...transitionPropsFor('dashboard')} render={() => (
          <div className="today-sections" data-testid="today-dashboard">
            <div className="today-heading" style={{ order: 0 }}><div><p className="text-sm font-medium text-muted">{clockNow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2 className="text-xl font-semibold tracking-tight">{greetingForHour(clockNow.getHours(), displayName)}</h2></div><button type="button" onClick={() => setTodayCustomizationOpen(open => !open)} aria-expanded={todayCustomizationOpen} aria-controls="today-customization" className="lifeos-raised min-h-11 rounded-xl px-3 text-xs font-semibold lifeos-accent-text">Customize</button></div>

            {todayCustomizationOpen && <section id="today-customization" aria-labelledby="today-customization-title" className="today-customization lifeos-panel rounded-2xl border p-4" style={{ order: 1 }}>
              <div className="mb-3"><h3 id="today-customization-title" className="text-sm font-semibold">Make Today yours</h3><p className="mt-1 text-xs text-secondary">Choose which sections appear and arrange their order.</p></div>
              <ul className="today-customization-list">{todayLayout.order.map((id, index) => <li key={id}>
                <label className="today-section-toggle"><input type="checkbox" checked={!todayLayout.hidden.includes(id)} disabled={id === 'focus'} onChange={event => persistTodayLayout(setTodaySectionVisible(todayLayoutRef.current, id, event.target.checked))} /><span>{TODAY_SECTION_LABELS[id]}</span></label>
                <div className="today-order-actions"><button type="button" aria-label={`Move ${TODAY_SECTION_LABELS[id]} up`} disabled={index === 0} onClick={() => persistTodayLayout(moveTodaySection(todayLayoutRef.current, id, -1))}>↑</button><button type="button" aria-label={`Move ${TODAY_SECTION_LABELS[id]} down`} disabled={index === todayLayout.order.length - 1} onClick={() => persistTodayLayout(moveTodaySection(todayLayoutRef.current, id, 1))}>↓</button></div>
              </li>)}</ul>
              <button type="button" onClick={() => persistTodayLayout(DEFAULT_TODAY_LAYOUT)} className="mt-3 min-h-11 rounded-lg px-2 text-xs font-semibold lifeos-accent-text">Restore default layout</button>
            </section>}

            {/* Keep the first panel focused: one useful progress cue and fast ways to act. */}
            <section className="today-focus lifeos-panel rounded-2xl border p-4" style={todaySectionStyle('focus')} aria-labelledby="today-overview-title" data-testid="today-overview">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">YOUR DAY</p>
                  <h3 id="today-overview-title" className="mt-1 text-base font-semibold">Today’s priorities</h3>
                  {todayOverview.tasksDue > 0 ? <p className="mt-1 text-sm text-secondary"><span className="font-medium">Tasks due today</span> · <strong className="font-semibold text-primary tabular-nums">{todayOverview.tasksCompleted} of {todayOverview.tasksDue}</strong> complete</p>
                    : <p className="mt-1 text-sm text-secondary">Choose one thing to make time for today.</p>}
                </div>
                <div className="today-quick-actions" aria-label="Quick add">
                  <button type="button" onClick={() => openCreateForm('task')} className="lifeos-accent-button min-h-11 rounded-xl px-3 text-xs font-semibold">+ Task</button>
                </div>
              </div>
              {todayOverview.tasksDue > 0 && <div className="today-focus-progress mt-3" role="progressbar" aria-label="Today’s tasks complete" aria-valuemin={0} aria-valuemax={todayOverview.tasksDue} aria-valuenow={todayOverview.tasksCompleted}><span style={{ width: `${Math.min(100, (todayOverview.tasksCompleted / todayOverview.tasksDue) * 100)}%` }} /></div>}
              {tasks.some(task => getTaskStatus(task, clockNow) === 'Overdue') && <button type="button" className="today-attention-link" onClick={() => { setPlannerFilter('overdue'); navigateTo('planner'); }}>Review overdue tasks <ChevronRight size={16} aria-hidden="true" /></button>}
            </section>

            {/* Active Goals Summary */}
            <section className="today-section-goals lifeos-panel rounded-2xl border p-4" style={todaySectionStyle('goals')}>
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-wider lifeos-accent-text">Goals</p><h3 className="text-sm font-semibold">{goals.filter(goal => goal.status === 'In Progress').length} active goals</h3></div>
                <button onClick={() => navigateTo('goals')} className="rounded-lg px-2 py-1 text-xs font-semibold lifeos-accent-text" aria-label="Open Goals">View all →</button>
              </div>
              {goals.filter(goal => goal.status === 'In Progress').length === 0 ? (
                <div className="today-inline-empty"><p>No active goals yet.</p><button onClick={() => { navigateTo('goals'); openCreateForm('goal'); }} className="min-h-11 font-semibold lifeos-accent-text">Create your first goal</button></div>
              ) : <div className="space-y-3">{goals.filter(goal => goal.status === 'In Progress').slice(0, 3).map(goal => {
                const progress = goalProgress(goal);
                return <button key={goal.id} onClick={() => navigateTo('goals')} className="lifeos-raised block min-h-11 w-full rounded-xl p-3 text-left">
                  <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{goal.title}</span><span className="shrink-0 text-xs font-bold lifeos-accent-text">{progress}%</span></div>
                  <div className="lifeos-progress-track my-2 h-1.5 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} /></div>
                  <div className="flex justify-between gap-2 text-[10px] text-secondary"><span>{displayGoalMeasure(goal.currentValue, goal.unit)} / {displayGoalMeasure(goal.targetValue, goal.unit)}</span><span>{formatDate(goal.targetDate)} · {getDaysRemainingText(goal.targetDate)}</span></div>
                </button>;
              })}</div>}
            </section>

            {/* Financial Overview Card */}
            <div className="today-money-summary today-section-money lifeos-panel rounded-2xl border p-4" style={todaySectionStyle('money')}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Money this month</h3>
                <button onClick={() => navigateTo('finance')} className="min-h-11 text-xs lifeos-accent-text font-semibold">Details &rarr;</button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="p-3 rounded-xl lifeos-raised">
                  <p className="text-xs text-secondary">Income</p>
                  <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: 'var(--success)' }}>{formatMoney(financeAnalytics.totalIncome)}</p>
                </div>
                <div className="p-3 rounded-xl lifeos-raised">
                  <p className="text-xs text-secondary">Expenses</p>
                  <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: 'var(--danger)' }}>{formatMoney(financeAnalytics.totalExpenses)}</p>
                </div>
              </div>
              <div className="flex justify-between gap-3 text-xs text-secondary">
                <span>Net this month: <strong className="text-primary tabular-nums">{formatMoney(financeAnalytics.netSavings)}</strong></span>
                <span>Savings rate: <strong className="tabular-nums" style={{ color: financeAnalytics.savingsRate !== null && financeAnalytics.savingsRate < 0 ? 'var(--danger)' : 'var(--accent)' }}>{financeAnalytics.savingsRate === null ? '—' : `${financeAnalytics.savingsRate.toFixed(1)}%`}</strong></span>
              </div>
            </div>

            {/* Today's Habits Summary */}
            <div className="today-habit-summary lifeos-panel rounded-2xl border p-4" style={todaySectionStyle('habits')}>
              <div className="flex justify-between items-center mb-3">
                <div><p className="type-eyebrow">DAILY ROUTINES</p><h3 className="text-sm font-semibold">Habits today</h3><p className="type-caption text-secondary">{todayOverview.routinesDue ? `${todayOverview.routinesCompleted} of ${todayOverview.routinesDue} checked` : 'Check in at your own pace.'}</p></div>
                <div className="today-habit-actions"><button type="button" onClick={() => openCreateForm('habit')} className="min-h-11 rounded-lg px-2 text-xs font-semibold lifeos-accent-text">Add habit</button><button type="button" onClick={() => navigateTo('habits')} className="min-h-11 rounded-lg px-2 text-xs font-semibold lifeos-accent-text">All habits</button></div>
              </div>
              {habits.length === 0 ? (
                <div className="today-inline-empty"><p>No habits to check in yet. Add one when you’re ready.</p></div>
              ) : (
                <div className="space-y-2">
                  {habits.slice(0, 4).map(h => {
                    const todayStr = todayKey;
                    const stats = getHabitStreaks(h.id, todayStr);
                    return (
                      <div key={h.id} className="p-3 rounded-xl lifeos-raised flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleHabitCompletion(h.id, h.name, todayStr, stats.completedToday)}
                            type="button"
                            aria-pressed={stats.completedToday}
                            aria-label={`${stats.completedToday ? 'Mark' : 'Complete'} ${h.name} ${stats.completedToday ? 'incomplete' : 'for today'}`}
                            className="lifeos-panel flex min-h-11 min-w-11 items-center justify-center rounded-full border-2 text-xs transition"
                            style={{ borderColor: stats.completedToday ? 'var(--success)' : 'var(--stroke)', backgroundColor: stats.completedToday ? 'var(--success)' : 'var(--surface)', color: 'var(--page)' }}
                          >
                            {stats.completedToday ? '✓' : ''}
                          </button>
                          <div>
                            <p className={`text-sm font-medium ${stats.completedToday ? 'line-through text-muted' : ''}`}>{h.name}</p>
                            <p className="text-[10px] text-[var(--warning)] font-semibold">🔥 {stats.currentStreak} day streak</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Future dated tasks are separate from today's agenda. */}
            <section className="today-upcoming-section lifeos-panel rounded-2xl border p-4" style={todaySectionStyle('upcoming')} aria-labelledby="today-upcoming-title">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">NEXT</p><h3 id="today-upcoming-title" className="mt-1 text-sm font-semibold">Coming up</h3></div><button type="button" onClick={() => { setPlannerFilter('upcoming'); navigateTo('planner'); }} className="min-h-11 rounded-xl px-2 text-xs font-semibold lifeos-accent-text">View plan</button></div>
              {dashboardUpcomingTasks.length === 0 ? <p className="today-inline-empty">No upcoming tasks. Add a date to a task to plan ahead.</p> : <ul className="space-y-2">{dashboardUpcomingTasks.map(task => <li key={task.id}><button type="button" onClick={() => { setPlannerSelectedDate(task.dueDate); setPlannerFilter('all'); navigateTo('planner'); }} className="lifeos-raised flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left"><span className="min-w-0"><strong className="block truncate text-sm font-medium">{task.title}</strong><span className="block text-xs text-secondary">{formatDate(task.dueDate)}{task.dueTime ? ` · ${formatClockTime(task.dueTime)}` : ''}</span></span><span className="shrink-0 text-xs font-medium text-secondary">{task.priority}</span></button></li>)}</ul>}
            </section>

            {/* Pending Tasks */}
            <section className="today-agenda lifeos-panel rounded-2xl border p-4" style={todaySectionStyle('agenda')} aria-labelledby="today-agenda-title">
              <div className="flex justify-between items-center mb-3">
                <div><p className="type-eyebrow">DUE TODAY</p><h3 id="today-agenda-title" className="text-sm font-semibold">Your tasks</h3></div>
                <button onClick={() => navigateTo('planner')} className="min-h-11 rounded-lg px-2 text-xs lifeos-accent-text font-semibold">Open Plan</button>
              </div>
              {dashboardTasks.length === 0 ? (
                <div className="today-inline-empty"><p>No tasks due today. Your day is open.</p></div>
              ) : (
                <div className="space-y-2">
                  {dashboardTasks.map(t => {
                    const status = getTaskStatus(t, clockNow);
                    return <div key={t.id} className={`today-task-row ui-interactive-row${status === 'Overdue' ? ' is-overdue' : ''}`}>
                        <label className="today-task-check" aria-label={`Mark ${t.title} ${t.completed ? 'incomplete' : 'complete'}`}>
                          <input
                            type="checkbox"
                            aria-label={`Mark ${t.title} ${t.completed ? 'incomplete' : 'complete'}`}
                            checked={t.completed}
                            onChange={async () => {
                              await StorageService.tasks.toggleCompleted(t.id, !t.completed);
                              if (!t.completed) await NotificationService.cancelTask(t);
                              const records = await reloadAllData();
                              await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
                              showToast('Task updated', 'success');
                            }}
                            className="h-5 w-5 cursor-pointer rounded"
                            style={{ accentColor: 'var(--accent)' }}
                          />
                        </label>
                        <button type="button" onClick={() => { setPlannerDetailTaskId(t.id); setPlannerSelectedDate(t.dueDate || todayKey); setPlannerFilter('all'); navigateTo('planner'); }} className="today-task-open" aria-label={`Open ${t.title} details`}>
                          <span className={`today-task-title${t.completed ? ' is-complete' : ''}`}>{t.title}</span>
                          <span className="today-task-meta">{t.dueTime ? formatClockTime(t.dueTime) : 'Due today'} · {status} · {t.priority} priority</span>
                        </button>
                    </div>
                  })}
                </div>
              )}
            </section>
          </div>
        )} />

        {/* VIEW 2: FINANCE */}
        <RetainedScreen active={activeTab === 'life'} id="screen-life" {...transitionPropsFor('life')} render={() => <Suspense fallback={<ScreenLoading label="Loading your life overview…" />}><LifeHub
          habits={lifeHubHabits}
          goals={lifeHubGoals}
          routinesDue={todayOverview.routinesDue}
          completedRoutines={todayOverview.routinesCompleted}
          weeklyCompleted={todayOverview.weeklyRoutinesCompleted}
          weeklyTotal={todayOverview.weeklyRoutinesTotal}
          onCheckIn={habit => { const original = habits.find(item => item.id === habit.id); if (original) void handleHabitCompletion(original.id, original.name, todayKey, habit.completedToday); }}
          onCreateHabit={() => openCreateForm('habit')}
          onCreateGoal={() => openCreateForm('goal')}
          onHabits={() => { setHabitsSubtab('checklist'); navigateTo('habits'); }}
          onGoals={() => { setGoalsSubtab('active'); navigateTo('goals'); }}
          onInsights={() => navigateTo('insights')}
        /></Suspense>} />

        <RetainedScreen active={activeTab === 'plan'} id="screen-plan" {...transitionPropsFor('plan')} render={() => <Suspense fallback={<ScreenLoading label="Loading your plan…" />}><PlanHub tasks={tasks} today={todayKey} now={clockNow}
          onNavigatePlanner={() => navigateTo('planner')}
          onOpenTask={task => { setPlannerDetailTaskId(task.id); setPlannerSelectedDate(task.dueDate || todayKey); setPlannerFilter('all'); navigateTo('planner'); }}
          onToggleTask={async task => { await StorageService.tasks.toggleCompleted(task.id, !task.completed); if (!task.completed) await NotificationService.cancelTask(task); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Task updated', 'success'); }}
          onCreateTask={() => openCreateForm('task')}
          onSelectRange={range => { setPlannerFilter(range); if (range === 'today') setPlannerSelectedDate(todayKey); if (range === 'tomorrow') setPlannerSelectedDate(tomorrowKey); navigateTo('planner'); }}
          onOpenGoals={() => { setGoalsSubtab('active'); navigateTo('goals'); }} /></Suspense>} />

        <RetainedScreen active={activeTab === 'insights'} id="screen-insights" {...transitionPropsFor('insights')} render={() => <Suspense fallback={<ScreenLoading label="Loading your insights…" />}><InsightsHub
          month={financeMonth}
          income={financeMetrics.totalIncome}
          expenses={financeMetrics.totalExpenses}
          balance={financeMetrics.remainingBalance}
          transactionCount={financeMetrics.count}
          completedRoutines={todayOverview.routinesCompleted}
          routinesDue={todayOverview.routinesDue}
          weeklyCompleted={todayOverview.weeklyRoutinesCompleted}
          weeklyTotal={todayOverview.weeklyRoutinesTotal}
          goals={goals.filter(goal => goal.status === 'In Progress')}
          hasHistory={transactions.length > 0 || habits.length > 0 || goals.length > 0}
          formatMoney={formatMoney}
          onFinance={() => { setFinanceSubtab('analytics'); navigateTo('finance'); }}
          onHabits={() => { setHabitsSubtab('weekly'); navigateTo('habits'); }}
          onGoals={() => { setGoalsSubtab('active'); navigateTo('goals'); }}
        /></Suspense>} />

        <RetainedScreen active={activeTab === 'finance'} retainInactive id="screen-finance" {...transitionPropsFor('finance')} render={() => (
          <div className="money-page space-y-5">
            {financeSubtab !== 'overview' && <div className="money-page-toolbar">
              <button type="button" onClick={() => navigateFinanceSubtab('overview')} className="money-back-button" aria-label="Back to Money home"><ChevronLeft size={18} aria-hidden="true" /> Money</button>
              <label className="sr-only" htmlFor="money-destination">Money section</label>
              <div className="money-destination-control"><label className="sr-only" htmlFor="money-destination">Money section</label><select id="money-destination" value={financeSubtab} onChange={event => navigateFinanceSubtab(event.target.value as typeof financeSubtab)}>
                {(['transactions', 'accounts', 'budgets', 'savings', 'planning', 'analytics'] as const).map(sub => <option key={sub} value={sub}>{sub === 'planning' ? 'Financial planning' : sub[0].toUpperCase() + sub.slice(1)}</option>)}
              </select><ChevronDown size={16} aria-hidden="true" /></div>
            </div>}

            {/* Money home: recorded cash flow, never an inferred account balance. */}
            {financeSubtab === 'overview' && (
              <MoneyHome
                month={financeMonth}
                income={financeAnalytics.totalIncome}
                expenses={financeAnalytics.totalExpenses}
                netCashFlow={financeAnalytics.netSavings}
                budgetRows={financeAnalytics.budgetRows}
                largestCategory={financeAnalytics.largestCategory}
                expenseChange={financeAnalytics.expenseChange}
                hasPreviousMonthRecords={financeAnalytics.previousMonthHasRecords}
                excludedCurrencyCount={financeAnalytics.excludedCurrencyCount}
                transactions={financeOverviewTransactions}
                formatMoney={formatMoney}
                formatDate={formatDate}
                formatTime={formatTime}
                onMonthChange={setFinanceMonth}
                onAddExpense={() => openCreateForm('transaction')}
                onAddIncome={() => {
                  openCreateForm('transaction');
                  setCreateDraft(current => ({ ...current, type: 'income', category: categories.find(category => category.type === 'income')?.name || '' }));
                }}
                onTransfer={() => { setOpenMoneyTransferOnAccounts(true); navigateFinanceSubtab('accounts'); }}
                onMoveToSavings={() => {
                  navigateFinanceSubtab('savings');
                  if (savingsGoals.length === 1) {
                    openCreateForm('contribution', savingsGoals[0].id);
                  }
                }}
                onTransactions={() => navigateFinanceSubtab('transactions')}
                onBudgets={() => navigateFinanceSubtab('budgets')}
                onSavings={() => navigateFinanceSubtab('savings')}
                onAnalytics={() => navigateFinanceSubtab('analytics')}
                onPlanning={() => navigateFinanceSubtab('planning')}
                onAccounts={() => navigateFinanceSubtab('accounts')}
                accountSummaries={accountSummaries}
                savingsGoals={savingsGoals}
                legacyCurrency={userPrefs.currency}
                onEditTransaction={openEditTransaction}
              />
            )}

            {financeSubtab === 'accounts' && <MoneyAccounts accounts={financialAccounts} transactions={transactions} transfers={accountTransfers} currencyCode={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale}
              autoOpenTransfer={openMoneyTransferOnAccounts} onTransferRequestHandled={() => setOpenMoneyTransferOnAccounts(false)}
              confirmAction={confirmAction}
              onCreateAccount={async input => { await StorageService.accounts.add(input); await reloadAllData(); }}
              onUpdateAccount={async (id, input) => { await StorageService.accounts.update(id, input); await reloadAllData(); }}
              onDeleteAccount={async id => { await StorageService.accounts.delete(id); await reloadAllData(); }}
              onCreateTransfer={async input => { await StorageService.accounts.addTransfer(input); await reloadAllData(); }}
              onUpdateTransfer={async (id, input) => { await StorageService.accounts.updateTransfer(id, input); await reloadAllData(); }}
              onReverseTransfer={async (id, date) => { await StorageService.accounts.reverseTransfer(id, date); await reloadAllData(); }}
              onDeleteTransfer={async id => { await StorageService.accounts.deleteTransfer(id); await reloadAllData(); }} />}

            {/* Transactions Subtab */}
            {financeSubtab === 'transactions' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search description, category..."
                    value={financeSearch}
                    onChange={(e) => setFinanceSearch(e.target.value)}
                    className="lifeos-input min-h-11 flex-1 rounded-xl px-3 py-2.5 text-xs"
                  />
                  <button onClick={() => openCreateForm('transaction')} className="lifeos-accent-button min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold">+ Add</button>
                </div>
                <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-secondary">Month<input aria-label="Transaction month" type="month" value={financeMonth} onChange={e => setFinanceMonth(e.target.value)} className="lifeos-input mt-1 block min-h-11 w-full rounded-lg px-2 py-2 text-xs" /></label><label className="text-[10px] text-secondary">Category<select value={financeCategoryFilter} onChange={e => setFinanceCategoryFilter(e.target.value)} className="lifeos-input mt-1 block min-h-11 w-full rounded-lg px-2 py-2 text-xs"><option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label><label className="text-[10px] text-secondary">Account<select aria-label="Filter transactions by account" value={financeAccountFilter} onChange={e => setFinanceAccountFilter(e.target.value)} className="lifeos-input mt-1 block min-h-11 w-full rounded-lg px-2 py-2 text-xs"><option value="all">All accounts</option><option value="unassigned">Unassigned</option>{financialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}{account.isActive ? "" : " · Archived"}</option>)}</select></label><label className="text-[10px] text-secondary">Currency<select aria-label="Filter transactions by currency" value={financeCurrencyFilter} onChange={e => setFinanceCurrencyFilter(e.target.value)} className="lifeos-input mt-1 block min-h-11 w-full rounded-lg px-2 py-2 text-xs"><option value="all">All currencies</option>{CURRENCY_CODES.map(code => <option key={code} value={code}>{formatCurrencyChoice(code, userPrefs.locale === "system" ? undefined : userPrefs.locale)}</option>)}</select></label></div>

                {/* Filters */}
                <div role="group" aria-label="Filter transactions by type" className="flex flex-wrap gap-2 text-xs pb-1">
                  {(['all', 'income', 'expense'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFinanceTypeFilter(t)}
                      aria-pressed={financeTypeFilter === t}
                      className={`min-h-11 rounded-full px-3 capitalize ${financeTypeFilter === t ? 'lifeos-accent-button font-semibold' : 'lifeos-panel text-secondary border border-[var(--stroke)]'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <label className="flex items-center justify-between text-[10px] text-secondary">Sort<select value={financeSort} onChange={e => setFinanceSort(e.target.value)} className="lifeos-input min-h-11 rounded-lg px-2 py-2 text-xs"><option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option><option value="amount-desc">Largest amount</option></select></label>

                {/* Transactions List */}
                <div className="space-y-2">
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted">No transactions match these filters.</div>
                  ) : (
                    filteredTransactions.map(t => (
                      <article key={t.id} className="transaction-history-item lifeos-panel rounded-xl border p-3.5">
                        <div className="transaction-history-main">
                          <button type="button" onClick={() => openEditTransaction(t)} aria-label={`Edit transaction ${t.description || t.category}`} className="transaction-history-copy">
                            <strong>{t.description || t.category}</strong>
                            <span>{formatDate(t.date)}{t.occurredAt ? ` · ${formatTime(new Date(t.occurredAt))}` : ' · time not recorded'} &bull; {t.category} ({t.paymentMethod || 'Other'}){t.accountId ? ` · ${financialAccounts.find(account => account.id === t.accountId)?.name || 'Archived account'}` : ''}</span>
                          </button>
                          <span className={`transaction-history-amount ${t.type === 'income' ? 'is-income' : 'is-expense'}`}>
                            {t.type === 'income' ? '+' : '−'}{formatMoney(t.amount, t.currencyCode || userPrefs.currency)}
                          </span>
                        </div>
                        <div className="transaction-history-actions">
                          <button type="button" onClick={() => openDuplicateTransaction(t)} aria-label={`Duplicate transaction ${t.description || t.category}`}>Duplicate</button>
                          <button type="button" onClick={async () => {
                            if (!(await confirmAction({ title: 'Delete this transaction?', message: `“${t.description || t.category}” will be removed from your transaction history.`, confirmLabel: 'Delete transaction', destructive: true }))) return;
                            await StorageService.transactions.delete(t.id);
                            await reloadAllData();
                            showToast('Transaction deleted', 'info');
                          }} aria-label={`Delete transaction ${t.description || t.category}`}>Delete</button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}

            {financeSubtab === 'budgets' && <div className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Monthly budgets</h3><p className="text-xs text-secondary">Track spending against a monthly limit</p></div><button onClick={() => openCreateForm('budget')} className="lifeos-accent-button min-h-11 rounded-xl px-3 py-2 text-xs font-semibold">+ Add budget</button></div>
              {budgets.some(b => (!b.monthYear || b.monthYear === financeMonth) && b.currencyCode && b.currencyCode !== userPrefs.currency) && <p role="status" className="rounded-xl border border-[var(--stroke)] p-3 text-xs text-secondary">Budgets in another currency are hidden until a dated exchange rate is available.</p>}
              {budgets.filter(b => (!b.monthYear || b.monthYear === financeMonth) && (!b.currencyCode || b.currencyCode === userPrefs.currency)).length === 0 ? <div className="rounded-2xl border border-[var(--stroke)] lifeos-panel py-8 text-center text-sm text-secondary">No budget set for {financeMonth}.</div> : budgets.filter(b => (!b.monthYear || b.monthYear === financeMonth) && (!b.currencyCode || b.currencyCode === userPrefs.currency)).map(b => {
                const budgetCategoryName = b.categoryId ? categories.find(category => category.id === b.categoryId)?.name : undefined;
                const budgetName = b.categoryId ? (budgetCategoryName || 'Unavailable category') : 'Overall budget';
                const categoryMissing = Boolean(b.categoryId && !budgetCategoryName);
                const spent = b.categoryId ? (budgetCategoryName ? financeMetrics.categoryExpenses[budgetCategoryName] || 0 : 0) : financeMetrics.totalExpenses;
                const budgetStatus = getBudgetDisplayStatus(categoryMissing ? Number.NaN : spent, b.monthlyAmount);
                const budgetLabel = categoryMissing ? 'Usage unavailable' : budgetStatus.percentUsed === null ? 'No monthly limit set' : `${budgetStatus.percentUsed.toFixed(0)}% used`;
                const overLabel = budgetStatus.percentUsed === null ? `${formatMoney(budgetStatus.overBy)} over plan · no monthly limit` : `${budgetStatus.percentUsed.toFixed(0)}% used · ${formatMoney(budgetStatus.overBy)} over plan`;
                const overAccessibleLabel = budgetStatus.percentUsed === null ? `${formatMoney(budgetStatus.overBy)} over plan with no monthly limit` : `${budgetStatus.percentUsed.toFixed(0)}% used, ${formatMoney(budgetStatus.overBy)} over plan`;
                const amountLabel = categoryMissing ? 'Unavailable' : formatMoney(spent);
                const remainingLabel = categoryMissing ? 'Restore category to track this plan' : budgetStatus.isOver ? 'Above plan' : budgetStatus.percentUsed === null ? 'Set a limit to track remaining' : `${formatMoney(budgetStatus.remaining)} remaining in plan`;
                return <div key={b.id} className="rounded-2xl border border-[var(--stroke)] lifeos-panel p-4"><div className="flex justify-between text-sm"><strong>{budgetName}</strong><span>{amountLabel} / {formatMoney(b.monthlyAmount)}</span></div><div className="lifeos-progress-track mt-3 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${budgetName} usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(budgetStatus.barPercent)} aria-valuetext={budgetStatus.isOver ? overAccessibleLabel : budgetLabel}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${budgetStatus.barPercent}%`, backgroundColor: budgetStatus.isOver ? 'var(--warning)' : undefined }} /></div><div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-secondary"><span>{budgetStatus.isOver ? overLabel : budgetLabel}</span><span>{remainingLabel}</span></div><button aria-label={`Delete ${budgetName}`} onClick={async () => {
                  if (!(await confirmAction({ title: 'Delete this budget?', message: `${budgetName} will be removed. Saved transactions will remain unchanged.`, confirmLabel: 'Delete budget', destructive: true }))) return;
                  try { await StorageService.budgets.delete(b.id); }
                  catch { showToast('Budget deletion could not be confirmed. Refresh before retrying.', 'danger'); return; }
                  setBudgets(current => current.filter(item => item.id !== b.id));
                  try { await reloadAllData(); showToast('Budget plan deleted', 'success'); }
                  catch { showToast('Budget deleted. Reopen Finance to refresh the latest data.', 'info'); }
                }} className="mt-2 min-h-11 rounded-lg px-2 text-xs text-secondary">Delete plan</button></div>;
              })}
            </div>}

            {financeSubtab === 'savings' && <div className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Savings goals</h3><p className="text-xs text-secondary">Build toward the things you care about</p></div><button onClick={() => openCreateForm('savings')} className="lifeos-accent-button min-h-11 rounded-xl px-3 py-2 text-xs font-semibold">+ Add goal</button></div>
              {savingsGoals.length === 0 ? <div className="rounded-2xl border border-[var(--stroke)] lifeos-panel py-8 text-center text-sm text-secondary">No savings goals yet.</div> : <div className="lifeos-panel rounded-2xl border px-4">{savingsGoals.map(goal => <SavingsGoalProgress key={goal.id} goal={goal} onEditGoal={() => openEditSavingsGoal(goal)} contributions={savingsContributions.filter(item => item.goalId === goal.id)} formatMoney={formatMoney} formatDate={formatDate} onEditContribution={openEditContribution} onDeleteContribution={async contribution => {
                  if (!(await confirmAction({ title: 'Delete this contribution?', message: `${formatMoney(contribution.amount, contribution.currencyCode || goal.currencyCode)} will be removed and the saved goal total will be adjusted.`, confirmLabel: 'Delete contribution', destructive: true }))) return;
                  try { await StorageService.savings.deleteContribution(contribution.id); await reloadAllData(); showToast('Contribution deleted and savings total updated', 'success'); }
                  catch (error) { showToast(error instanceof Error ? error.message : 'Contribution could not be deleted safely.', 'danger'); }
                }} onContribute={() => {
                  setCreateFormDirty(false);
                  setCreateDraft({
                    goalId: goal.id,
                    date: new Date().toISOString().slice(0, 10),
                    amount: '',
                    notes: '',
                  });
                  setCreateKind('contribution');
                }} onDelete={async () => {
                  if (!(await confirmAction({ title: 'Delete this savings goal?', message: `“${goal.title}” and its recorded contributions will be removed.`, confirmLabel: 'Delete savings goal', destructive: true }))) return;
                  try { await StorageService.savings.deleteGoal(goal.id); }
                  catch { showToast('LifeOS could not confirm the deletion. Refresh Savings before retrying.', 'danger'); return; }
                  setSavingsGoals(current => current.filter(item => item.id !== goal.id));
                  try { await reloadAllData(); showToast('Savings goal deleted', 'success'); }
                  catch { showToast('Goal deleted. Reopen Savings to refresh the latest data.', 'info'); }
                }} />)}</div>}
            </div>}

            {financeSubtab === 'planning' && <div className="space-y-5">{activeTab === 'finance' && <Suspense fallback={<ScreenLoading label="Loading financial planning…" />}><FinanceProjection currencyCode={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale} /></Suspense>}<MoneyPlanning commitments={plannedCommitments} rates={manualExchangeRates} accounts={financialAccounts} categories={categories} confirmAction={confirmAction}
              onAddCommitment={async input => { await StorageService.commitments.add(input); await reloadAllData(); }}
              onUpdateCommitment={async (id, input) => { await StorageService.commitments.update(id, input); await reloadAllData(); }}
              onDeleteCommitment={async id => { await StorageService.commitments.delete(id); await reloadAllData(); }}
              onAddRate={async input => { await StorageService.exchangeRates.add(input); await reloadAllData(); }}
              onUpdateRate={async (id, input) => { await StorageService.exchangeRates.update(id, input); await reloadAllData(); }}
              onDeleteRate={async id => { await StorageService.exchangeRates.delete(id); await reloadAllData(); }} /></div>}

            {financeSubtab === 'analytics' && <div className="space-y-4">
              <div className="flex items-center justify-between gap-2"><div><h3 className="text-base font-semibold">Financial insights</h3><p className="text-xs text-secondary">Based on transactions saved on this device</p></div><label className="text-[10px] text-secondary">Month<input type="month" aria-label="Analytics month" value={financeMonth} onChange={event => setFinanceMonth(event.target.value)} className="lifeos-input mt-1 block min-h-11 rounded-lg px-2 py-2 text-xs" /></label></div>
              <div className="grid grid-cols-2 gap-2.5">
                {[['Income', financeAnalytics.totalIncome, 'text-[var(--success)]'], ['Expenses', financeAnalytics.totalExpenses, 'text-[var(--danger)]'], ['Net savings', financeAnalytics.netSavings, financeAnalytics.netSavings < 0 ? 'text-[var(--danger)]' : 'text-primary'], ['Savings rate', financeAnalytics.savingsRate === null ? null : `${financeAnalytics.savingsRate.toFixed(1)}%`, 'lifeos-accent-text']].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-[var(--stroke)] lifeos-panel p-4"><p className="text-xs text-secondary">{label}</p><p className={`mt-1 text-lg font-semibold ${color}`}>{value === null ? '—' : typeof value === 'number' ? formatMoney(value) : value}</p></div>)}
              </div>
              {activeTab === 'finance' && (hasFinanceChartData ? <Suspense fallback={<ScreenLoading label="Loading financial charts…" />}>
                <FinanceCharts analytics={financeAnalytics} theme={theme} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale} formatMoney={formatMoney} month={financeMonth} range={financeAnalyticsRange} onRangeChange={setFinanceAnalyticsRange} />
              </Suspense> : <section className="finance-chart-empty lifeos-panel" aria-label="Financial chart empty state"><strong>No recorded patterns yet</strong><span>Charts appear after you save income or spending. No sample numbers are shown.</span></section>)}
              <section className="rounded-2xl border border-[var(--stroke)] lifeos-panel p-4"><h4 className="text-sm font-semibold">Budget status</h4>{financeAnalytics.budgetRows.length === 0 ? <p className="mt-2 text-xs text-secondary">No budgets are set for this month.</p> : <div className="mt-3 space-y-3">{financeAnalytics.budgetRows.map(row => { const pct = row.allocated ? row.spent / row.allocated * 100 : 0; return <div key={row.category}><div className="flex justify-between gap-2 text-xs"><span>{row.category}</span><span>{formatMoney(row.spent)} / {formatMoney(row.allocated)}</span></div><div className="lifeos-progress-track mt-1.5 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${row.category} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)}><div className={`h-full rounded-full ${pct >= 100 ? 'bg-[var(--danger)]' : pct >= 80 ? 'bg-[var(--warning)]' : 'bg-[var(--accent)]'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div><div className="mt-1 flex justify-between text-[11px] text-secondary"><span>{pct.toFixed(0)}% used</span><span className={row.remaining < 0 ? 'text-[var(--danger)]' : 'text-secondary'}>{formatMoney(row.remaining)} {row.remaining < 0 ? 'over budget' : 'remaining'}</span></div></div>; })}</div>}</section>
              <section className="rounded-2xl border border-[var(--stroke)] lifeos-panel p-4"><h4 className="text-sm font-semibold">What stands out</h4><div className="mt-2 space-y-2 text-sm text-secondary">{financeAnalytics.largestCategory ? <p>Largest expense category: <strong className="text-primary">{financeAnalytics.largestCategory.name}</strong> at {formatMoney(financeAnalytics.largestCategory.amount)} ({financeAnalytics.largestCategory.percentage.toFixed(1)}%).</p> : <p>No category insight yet; add expense records to build a comparison.</p>}{financeAnalytics.expenseChange === null ? <p>{financeAnalytics.previousMonthHasRecords ? 'No expense baseline in the previous month for a percentage comparison.' : 'Previous-month comparison is unavailable because there are no saved records for that month.'}</p> : <p>Expenses {financeAnalytics.expenseChange > 0 ? 'increased' : financeAnalytics.expenseChange < 0 ? 'decreased' : 'were unchanged'} {Math.abs(financeAnalytics.expenseChange).toFixed(1)}% from last month.</p>}{financeAnalytics.budgetRows.filter(row => row.allocated > 0 && row.spent / row.allocated >= 0.8).map(row => <p key={row.category}>{row.category} budget is {Math.round(row.spent / row.allocated * 100)}% used.</p>)}</div></section>
            </div>}
          </div>
        )} />

        {/* VIEW 3: HABITS */}
        <RetainedScreen active={activeTab === 'habits'} id="screen-habits" {...transitionPropsFor('habits')} render={() => (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Habit Tracker</h2>
                <p className="text-xs text-secondary">Daily consistency monitor</p>
              </div>
              <button onClick={() => openCreateForm('habit')} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-xs font-semibold">+ Add habit</button>
            </div>
            <label className="block text-xs text-secondary">Completion date<input type="date" max={todayKey} value={habitsSelectedDate} onChange={e => setHabitsSelectedDate(e.target.value)} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-2.5 text-sm" /></label>

            <div className="space-y-2">
              {habits.length === 0 ? (
                <div className="lifeos-panel rounded-2xl border py-10 text-center text-sm text-secondary"><p>No habits yet.</p><p className="mt-1 text-xs">Create a routine that fits your day.</p><button onClick={() => openCreateForm('habit')} className="lifeos-accent-button mt-4 min-h-11 rounded-xl px-4 text-xs font-semibold">Create a habit</button></div>
              ) : (
                habits.map(h => {
                  const todayStr = habitsSelectedDate;
                  const stats = getHabitStreaks(h.id, todayStr);
                  const weekly = calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency);
                  const historyDays = Array.from({ length: 7 }, (_, index) => new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() - 6 + index));
                  return (
                      <div key={h.id} className="lifeos-panel rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><button type="button" aria-pressed={stats.completedToday} aria-label={`Mark ${h.name} ${stats.completedToday ? 'incomplete' : 'complete'}`} onClick={event => { event.stopPropagation(); void handleHabitCompletion(h.id, h.name, todayStr, stats.completedToday); }} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${stats.completedToday ? 'border-[var(--success)] text-[var(--surface)]' : 'border-[var(--stroke)] text-secondary'}`} style={stats.completedToday ? { backgroundColor: 'var(--success)' } : undefined}>{stats.completedToday ? '✓' : ''}</button><button onClick={() => openEditHabit(h)} className="min-w-0 text-left"><span className={`block truncate font-semibold text-sm ${stats.completedToday ? 'line-through text-secondary' : ''}`}>{h.name}</span><span className="block text-[10px] text-[var(--warning)]">🔥 {stats.currentStreak} day streak · best {stats.longestStreak}</span></button></div><button type="button" onClick={event => { event.stopPropagation(); void confirmAction({ title: 'Delete this habit?', message: `“${h.name}” and its completion history will be removed.`, confirmLabel: 'Delete habit', destructive: true }).then(confirmed => { if (confirmed) void handleHabitDeletion(h); }); }} className="min-h-11 rounded-lg px-3 text-xs text-secondary">Delete</button></div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-secondary"><span>Weekly completion</span><span className="tabular-nums">{weekly.completed}/{weekly.scheduled} days · {weekly.rate}%</span></div><div role="img" aria-label={`${weekly.completed} of ${weekly.scheduled} scheduled habit days complete this week`} className="mt-1 flex gap-1">{historyDays.map(day => { const dayKey = formatLocalDate(day); const done = habitLogs.some(log => log.habitId === h.id && log.date === dayKey && log.completed); return <span key={dayKey} title={`${dayKey}: ${done ? 'complete' : 'missed'}`} aria-hidden="true" className="h-2 flex-1 rounded-full" style={{ backgroundColor: done ? 'var(--success)' : 'var(--surface-raised)' }} />; })}</div>
                      {h.reminderTime && <p className="mt-2 text-[10px] text-secondary">Reminder · {h.reminderTime} local</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )} />

        {/* VIEW 4: GOALS */}
        <RetainedScreen active={activeTab === 'goals'} id="screen-goals" {...transitionPropsFor('goals')} render={() => (
          <div className="space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-lg font-bold">Personal Goals</h2><button onClick={() => openCreateForm('goal')} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-xs font-semibold">+ Add goal</button></div>
            <div className="grid grid-cols-3 gap-2">{(['active', 'paused', 'completed'] as const).map(tab => <button key={tab} type="button" aria-pressed={goalsSubtab === tab} onClick={() => setGoalsSubtab(tab)} className={`min-h-11 rounded-xl px-2 text-xs capitalize ${goalsSubtab === tab ? 'lifeos-tint lifeos-accent-text font-semibold' : 'lifeos-panel border text-secondary'}`}>{tab}</button>)}</div>
            <select aria-label="Goal category" value={goalsCategoryFilter} onChange={e => setGoalsCategoryFilter(e.target.value)} className="lifeos-input min-h-11 w-full rounded-xl px-3 py-2.5 text-xs"><option value="all">All categories</option>{['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => <option key={category}>{category}</option>)}</select>
            {goals.filter(goal => (goal.status === (goalsSubtab === 'active' ? 'In Progress' : goalsSubtab === 'paused' ? 'Paused' : 'Completed')) && (goalsCategoryFilter === 'all' || goal.category === goalsCategoryFilter)).length === 0 ? (
              <div className="goal-empty-state"><div><p className="type-eyebrow">{goalsCategoryFilter === 'all' ? goalsSubtab.toUpperCase() : goalsCategoryFilter.toUpperCase()}</p><h3 className="type-section-title">{goalsSubtab === 'completed' ? 'No completed goals yet' : goalsSubtab === 'paused' ? 'No paused goals' : goalsCategoryFilter === 'all' ? 'A goal when you’re ready' : `No ${goalsCategoryFilter.toLowerCase()} goals yet`}</h3><p className="mt-1 text-sm text-secondary">{goalsSubtab === 'completed' ? 'Completed goals will stay here as a record of what you reached.' : goalsSubtab === 'paused' ? 'If plans change, you can pause an active goal and return to it later.' : 'Choose a longer-term outcome and add milestones when they help.'}</p></div>{goalsSubtab === 'active' && <button onClick={() => openCreateForm('goal')} className="lifeos-accent-button min-h-11 shrink-0 rounded-xl px-4 text-xs font-semibold">Create a goal</button>}</div>
            ) : (
              goals.filter(goal => (goal.status === (goalsSubtab === 'active' ? 'In Progress' : goalsSubtab === 'paused' ? 'Paused' : 'Completed')) && (goalsCategoryFilter === 'all' || goal.category === goalsCategoryFilter)).map(g => {
                const pct = goalProgress(g);
                const goalMilestones = milestones.filter(milestone => milestone.goalId === g.id);
                return <div key={g.id} className="lifeos-panel space-y-3 rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3"><div><button onClick={() => openEditGoal(g)} className="min-h-11 text-left font-semibold text-sm lifeos-accent-text">{g.title}</button><p className="text-[10px] text-secondary">{g.category} · target {formatDate(g.targetDate)} · {getDaysRemainingText(g.targetDate)}</p></div><span className="text-sm font-bold lifeos-accent-text">{pct}%</span></div>
                  <div className="lifeos-progress-track h-2 w-full overflow-hidden rounded-full" role="progressbar" aria-label={`${g.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${pct}%` }} /></div>
                  <div className="flex justify-between text-xs text-secondary"><span>{displayGoalMeasure(g.currentValue, g.unit)} / {displayGoalMeasure(g.targetValue, g.unit)}</span><span>{goalMilestones.filter(milestone => milestone.completed).length}/{goalMilestones.length} milestones</span></div>
                  <div className="flex flex-wrap gap-2"><button onClick={() => openGoalProgressForm(g)} className="lifeos-tint lifeos-accent-text min-h-11 rounded-xl px-3 text-xs font-semibold">Update progress</button>{goalsSubtab === 'active' && <button onClick={() => openCreateForm('milestone', g.id)} className="lifeos-raised lifeos-border min-h-11 rounded-xl border px-3 text-xs font-semibold">+ Milestone</button>}{goalsSubtab !== 'completed' && <button onClick={async () => { const nextStatus = goalsSubtab === 'active' ? 'Paused' : 'In Progress'; await StorageService.goals.update(g.id, { status: nextStatus }); await reloadAllData(); showToast(nextStatus === 'Paused' ? 'Goal paused' : 'Goal resumed', 'success'); }} className="lifeos-raised min-h-11 rounded-xl px-3 text-xs font-semibold text-[var(--warning)]">{goalsSubtab === 'active' ? 'Pause' : 'Resume'}</button>}<button onClick={async () => { const nextStatus = goalsSubtab === 'completed' ? 'In Progress' : 'Completed'; await StorageService.goals.update(g.id, { status: nextStatus }); await reloadAllData(); showToast(nextStatus === 'Completed' ? 'Goal completed' : 'Goal reopened', 'success'); }} className="lifeos-raised min-h-11 rounded-xl px-3 text-xs font-semibold text-[var(--success)]">{goalsSubtab === 'completed' ? 'Reopen' : 'Complete'}</button><button onClick={async () => { if (!(await confirmAction({ title: 'Delete this goal?', message: `“${g.title}” and its milestones will be removed.`, confirmLabel: 'Delete goal', destructive: true }))) return; await NotificationService.cancelMilestones(goalMilestones); await StorageService.goals.delete(g.id); await reloadAllData(); showToast('Goal deleted', 'info'); }} className="lifeos-raised lifeos-danger min-h-11 rounded-xl px-3 text-xs">Delete</button></div>
                  {goalMilestones.length > 0 && <div className="space-y-2 border-t border-[var(--stroke)] pt-3">{goalMilestones.map(milestone => <label key={milestone.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2"><input aria-label={`Mark ${milestone.title} complete`} type="checkbox" checked={milestone.completed} onChange={async () => { await StorageService.goals.toggleMilestone(milestone.id, !milestone.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} className="h-5 w-5 shrink-0" style={{ accentColor: 'var(--accent)' }} /><span className="min-w-0 flex-1"><span className={`block text-xs ${milestone.completed ? 'text-secondary line-through' : ''}`}>{milestone.title}</span>{milestone.targetDate && <span className="block text-[10px] text-secondary">{formatDate(milestone.targetDate)} · {getDaysRemainingText(milestone.targetDate)}</span>}</span></label>)}</div>}
                </div>;
              })
            )}
          </div>
        )} />

        {/* VIEW 5: PLANNER */}
        <RetainedScreen active={activeTab === 'planner'} id="screen-planner" {...transitionPropsFor('planner')} render={() => (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3"><div><p className="type-eyebrow">PLANNER</p><h2 className="type-page-title">Tasks by date</h2><p className="type-caption text-secondary">Choose a range or a day.</p></div><button onClick={() => openCreateForm('task', undefined, plannerSelectedDate)} className="lifeos-accent-button min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98]">+ Add task</button></div>
            <div className="planner-range-nav" role="group" aria-label="Choose task range" data-no-tab-swipe>
              {(['today', 'tomorrow', 'upcoming'] as const).map((range, index) => <button key={range} type="button" aria-pressed={plannerFilter === range || (plannerFilter === 'all' && range === 'today' && plannerSelectedDate === todayKey)} onClick={() => setPlannerFilter(range)}>{index === 2 ? 'Next 7 days' : range[0].toUpperCase() + range.slice(1)}</button>)}
            </div>
            <details className="planner-calendar-disclosure" data-no-tab-swipe>
              <summary><span>Calendar</span><span>{plannerDisplayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></summary>
            <section className="lifeos-panel rounded-2xl border p-3.5 shadow-sm" aria-label="Monthly task calendar" data-no-tab-swipe>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1"><button aria-label="Previous month" onClick={() => setPlannerDisplayedMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="min-h-11 min-w-11 rounded-lg text-secondary transition hover:bg-[var(--surface-raised)] active:scale-95"><ChevronLeft size={19} className="mx-auto" /></button><h3 className="min-w-32 text-center text-sm font-semibold">{plannerDisplayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button aria-label="Next month" onClick={() => setPlannerDisplayedMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="min-h-11 min-w-11 rounded-lg text-secondary transition hover:bg-[var(--surface-raised)] active:scale-95"><ChevronRight size={19} className="mx-auto" /></button></div>
                <button onClick={() => { setPlannerSelectedDate(todayKey); setPlannerDisplayedMonth(new Date(clockNow.getFullYear(), clockNow.getMonth(), 1)); setPlannerFilter('all'); }} className="min-h-11 rounded-lg px-3 text-xs font-semibold lifeos-accent-text transition active:scale-95">Today</button>
              </div>
              <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-secondary">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} className="py-1">{day}</span>)}</div>
              <div className="grid grid-cols-7 gap-y-1">
                {calendarDays.map(day => {
                  const dayTasks = plannerTasksByDate.get(day) || [];
                  const overdue = dayTasks.some(task => getTaskStatus(task, clockNow) === 'Overdue');
                  const allComplete = dayTasks.length > 0 && dayTasks.every(task => task.completed);
                  const inMonth = day.slice(0, 7) === `${plannerDisplayedMonth.getFullYear()}-${String(plannerDisplayedMonth.getMonth() + 1).padStart(2, '0')}`;
                  const isToday = day === todayKey;
                  const selected = day === plannerSelectedDate;
                  const label = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                  return <button key={day} aria-label={`${label}${dayTasks.length ? `, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : ''}${overdue ? ', overdue tasks' : ''}`} aria-pressed={selected} onClick={() => { setPlannerSelectedDate(day); if (!inMonth) setPlannerDisplayedMonth(new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, 1)); setPlannerFilter('all'); }} className={`relative flex min-h-11 flex-col items-center justify-center rounded-xl text-xs transition active:scale-95 ${selected ? 'lifeos-accent-button font-semibold shadow-sm' : isToday ? 'lifeos-border border font-semibold lifeos-accent-text' : inMonth ? 'text-primary hover:bg-[var(--surface-raised)]' : 'text-muted'}`}>
                    <span>{Number(day.slice(-2))}</span>{dayTasks.length > 0 && <span className="mt-0.5 h-1 w-1 rounded-full" style={{ backgroundColor: selected ? 'var(--surface)' : overdue ? 'var(--danger)' : allComplete ? 'var(--success)' : 'var(--accent)' }} aria-hidden="true" />}
                  </button>;
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--stroke)] pt-2.5 text-[10px] text-secondary"><span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />Tasks</span><span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />Overdue</span><span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />Complete</span></div>
            </section>
            </details>
            <section className="space-y-3" aria-label="Selected day agenda">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold">{plannerFilter === 'today' ? 'Today' : plannerFilter === 'tomorrow' ? 'Tomorrow' : plannerFilter === 'upcoming' ? 'Upcoming' : selectedPlannerDateLabel}</h3><p className="text-xs text-secondary">{visiblePlannerTasks.length} task{visiblePlannerTasks.length === 1 ? '' : 's'}</p></div></div>
              <details className="planner-filters">
                <summary><Search size={15} aria-hidden="true" />Search and filters</summary>
                <div className="planner-filter-fields"><input aria-label="Search planner tasks" value={plannerSearch} onChange={e => setPlannerSearch(e.target.value)} placeholder="Search tasks" className="lifeos-input min-h-11 w-full rounded-xl px-3 py-2.5 text-sm" />
                  <div className="grid grid-cols-2 gap-2"><select aria-label="Task date or status filter" value={plannerFilter} onChange={e => setPlannerFilter(e.target.value as typeof plannerFilter)} className="lifeos-input min-h-11 rounded-xl px-3 py-2.5 text-xs">{['all', 'today', 'tomorrow', 'upcoming', 'pending', 'overdue', 'completed'].map(filter => <option key={filter} value={filter}>{filter === 'all' ? 'Selected day · all' : filter[0].toUpperCase() + filter.slice(1)}</option>)}</select><select aria-label="Task priority filter" value={plannerPriority} onChange={e => setPlannerPriority(e.target.value)} className="lifeos-input min-h-11 rounded-xl px-3 py-2.5 text-xs"><option value="all">All priorities</option>{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></div>
                </div>
              </details>
              {plannerDetailTask && <article className="lifeos-panel rounded-2xl border border-[var(--accent)] p-4" aria-label="Task details"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide lifeos-accent-text">Task details</p><h4 className="mt-1 text-lg font-semibold">{plannerDetailTask.title}</h4></div><button onClick={() => setPlannerDetailTaskId(null)} className="min-h-11 rounded-lg px-3 text-xs text-secondary">Back to agenda</button></div>{plannerDetailTask.description && <section className="mt-3"><h5 className="type-caption text-secondary">Notes</h5><p className="mt-1 whitespace-pre-wrap text-sm">{plannerDetailTask.description}</p></section>}<div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl lifeos-raised p-3"><p className="text-xs text-muted">Due</p><p className="mt-1 font-medium">{formatDate(plannerDetailTask.dueDate)}{plannerDetailTask.dueTime ? ` · ${formatClockTime(plannerDetailTask.dueTime)}` : ' · end of day'}</p></div><div className="rounded-xl lifeos-raised p-3"><p className="text-xs text-muted">Status</p><p className={`mt-1 font-semibold ${getTaskStatus(plannerDetailTask, clockNow) === 'Overdue' ? 'text-[var(--danger)]' : getTaskStatus(plannerDetailTask, clockNow) === 'Completed' ? 'text-[var(--success)]' : 'lifeos-accent-text'}`}>{getTaskStatus(plannerDetailTask, clockNow)}</p></div><div className="rounded-xl lifeos-raised p-3"><p className="text-xs text-muted">Priority</p><p className="mt-1 font-medium">{plannerDetailTask.priority}</p></div><div className="rounded-xl lifeos-raised p-3"><p className="text-xs text-muted">Reminder</p><p className="mt-1 font-medium">{plannerDetailTask.reminderAt ? formatDateTime(new Date(plannerDetailTask.reminderAt)) : 'None'}</p></div>{plannerDetailTask.recurring && plannerDetailTask.recurring !== 'None' && <div className="rounded-xl lifeos-raised p-3"><p className="text-xs text-muted">Repeats</p><p className="mt-1 font-medium">{plannerDetailTask.recurring}</p></div>}{plannerDetailTask.category && <div className="rounded-xl lifeos-raised p-3"><p className="text-xs text-muted">Category</p><p className="mt-1 font-medium">{plannerDetailTask.category}</p></div>}</div><details className="task-reminder-details"><summary>Reminder help</summary><p className="text-xs text-secondary">Android may delay reminders when the device is idle. LifeOS will not change your task when you check its status.</p>{plannerDetailTask.reminderAt ? <button type="button" onClick={() => void diagnosePlannerTaskReminder(plannerDetailTask)} className="mt-2 min-h-11 rounded-lg px-2 text-xs font-semibold lifeos-accent-text">Check reminder status</button> : <p className="mt-2 text-xs text-secondary">No reminder is set. Edit this task to add one.</p>}{taskReminderDiagnostics?.taskReference === plannerDetailTask.id && <ReminderStatusSummary report={taskReminderDiagnostics} reminderAt={plannerDetailTask.reminderAt} />}</details><div className="mt-4 flex gap-2"><button onClick={() => openEditTask(plannerDetailTask)} className="min-h-11 flex-1 rounded-xl border border-[var(--stroke)] text-sm font-semibold lifeos-accent-text">Edit task</button><button onClick={async () => { await StorageService.tasks.toggleCompleted(plannerDetailTask.id, !plannerDetailTask.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} className="min-h-11 flex-1 rounded-xl lifeos-accent-button text-sm font-semibold">{plannerDetailTask.completed ? 'Reopen task' : 'Complete task'}</button></div></article>}
            {visiblePlannerTasks.length === 0 ? (
              <div className="lifeos-panel rounded-2xl border px-5 py-9 text-center"><div className="lifeos-raised mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-secondary"><CalendarDays size={20} /></div><p className="text-sm font-medium">Nothing planned for this view</p><p className="mt-1 text-xs text-secondary">Choose another day or add a task when you’re ready.</p><button onClick={() => openCreateForm('task', undefined, plannerSelectedDate)} className="lifeos-accent-button mt-4 min-h-11 rounded-xl px-4 text-xs font-semibold">Add a task</button></div>
            ) : (
              <div className="space-y-2">
                {visiblePlannerTasks.map(t => {
                  const status = getTaskStatus(t, clockNow);
                  return <div key={t.id} role="button" tabIndex={0} aria-label={`Open task ${t.title}`} onClick={() => setPlannerDetailTaskId(t.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPlannerDetailTaskId(t.id); } }} className="lifeos-panel flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3.5 transition hover:border-[var(--accent)]" style={{ borderColor: status === 'Overdue' ? 'var(--danger)' : undefined }}>
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
                        aria-label={`Mark ${t.title} ${t.completed ? 'incomplete' : 'complete'}`}
                        className="h-5 w-5 cursor-pointer rounded"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <div>
                        <span className={`text-sm font-medium ${t.completed ? 'line-through text-secondary' : ''}`}>{t.title}</span>
                        {t.description && <p className="mt-0.5 text-xs text-secondary">{t.description}</p>}
                        <p className="text-xs text-secondary">Due {formatDate(t.dueDate)}{t.dueTime ? ` · ${formatClockTime(t.dueTime)}` : ' · end of day'}</p>
                        <div className="mt-1 flex gap-1"><span className="lifeos-raised rounded px-1.5 py-0.5 text-[10px] text-secondary">{t.priority}</span><span className="lifeos-raised rounded px-1.5 py-0.5 text-[10px]" style={{ color: status === 'Overdue' ? 'var(--danger)' : status === 'Completed' ? 'var(--success)' : 'var(--accent)' }}>{status}</span>{t.recurring !== 'None' && <span className="lifeos-raised rounded px-1.5 py-0.5 text-[10px] text-secondary">{t.recurring}</span>}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2"><button onClick={async event => { event.stopPropagation(); if (!(await confirmAction({ title: 'Delete this task?', message: `“${t.title}” will be removed from your plan.`, confirmLabel: 'Delete task', destructive: true }))) return; await NotificationService.cancelTask(t); await StorageService.tasks.delete(t.id); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Task removed', 'info'); }} className="lifeos-danger min-h-11 rounded-lg px-3 text-xs">Delete</button></div>
                  </div>
                })}
              </div>
            )}
            </section>
          </div>
        )} />

        {/* VIEW 6: SETTINGS */}
        <RetainedScreen active={activeTab === 'settings'} id="screen-settings" {...transitionPropsFor('settings')} render={() => (
          <div className="profile-page space-y-5">
            {profileSection === 'home' && <ProfileHome name={displayName} initial={profileInitial(displayName)} onNameChange={name => { void updateDisplayName(name); }} onOpen={section => { navigateProfileSection(section); if (section === 'notifications') void refreshNotificationDiagnostics(); }} />}

            {profileSection === 'privacy' && <ProfileSubpage title="Privacy & security" description="Keep your personal records protected on this device." onBack={() => navigateProfileSection('home')}><section className="lifeos-panel rounded-2xl border p-5 space-y-3">
              <div><h3 className="text-base font-semibold">Security</h3><p className="mt-1 text-xs text-secondary">Device-level authentication for the app.</p></div>
              <p className="text-xs text-secondary">LifeOS asks Android to verify your fingerprint or device credential. Biometric data is handled by Android and is never stored by LifeOS.</p>
              <div className="lifeos-raised flex items-center justify-between gap-2 rounded-xl p-3"><div><p className="text-xs font-medium">Biometric lock</p><p className="mt-1 text-[10px] text-secondary">{biometricAvailability}</p></div><button role="switch" aria-checked={biometricEnabled} onClick={async () => { if (biometricEnabled) { setBiometricEnabled(false); setBiometricVerified(false); setIsLocked(false); await StorageService.settings.set('biometricLockEnabled', false); showToast('Biometric lock disabled', 'success'); return; } const result = await handleEnableBiometric(); if (result.success) showToast('Biometric lock enabled', 'success'); else showToast(result.message || 'Could not enable biometric lock', 'danger'); }} className={`min-h-11 min-w-16 rounded-full px-3 text-xs font-bold ${biometricEnabled ? 'lifeos-accent-button' : 'lifeos-panel border text-secondary'}`}>{biometricEnabled ? 'On' : 'Off'}</button></div>
              {biometricEnabled && <p className="flex items-center gap-1 text-[11px]" style={{ color: biometricVerified ? 'var(--success)' : 'var(--warning)' }}>{biometricVerified ? <ShieldCheck size={14} /> : <Shield size={14} />}{biometricVerified ? 'Biometric verified for this session' : 'Protected; authenticate to unlock'}</p>}
              {recoveryProvisioned ? <p className="text-xs text-secondary">Encrypted recovery kit confirmed.</p> : recoveryDeferred ? <div className="lifeos-raised rounded-xl p-3"><p className="text-xs font-medium">Recovery kit not set up</p><p className="mt-1 text-xs text-secondary">Your records remain encrypted on this device. Set up a recovery kit to restore access if this device key is lost.</p><button type="button" onClick={() => void setupRecoveryFromSettings()} className="lifeos-accent-button mt-3 min-h-11 rounded-xl px-4 text-xs font-semibold">Set up recovery kit</button></div> : null}
            </section></ProfileSubpage>}

            {profileSection === 'appearance' && <ProfileSubpage title="Appearance" description="Choose how LifeOS looks. Your theme is saved on this device." onBack={() => navigateProfileSection('home')}><section className="lifeos-panel rounded-2xl border p-5 space-y-3">
              <h3 className="text-base font-semibold">Appearance</h3><p className="text-xs text-secondary">Choose a theme or follow Android's system setting.</p>
              <div className="grid grid-cols-3 gap-2">{([['dark', 'Dark', Moon], ['light', 'Light', Sun], ['system', 'System', Smartphone]] as const).map(([value, label, Icon]) => <button key={value} type="button" aria-pressed={appearance === value} onClick={() => void applyAppearance(value)} className={`lifeos-panel flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-semibold ${appearance === value ? 'lifeos-tint lifeos-accent-text' : 'text-secondary'}`}><Icon size={14} />{label}</button>)}</div>
            </section>

            <section className="lifeos-panel rounded-2xl border p-5 space-y-4" aria-labelledby="color-theme-title">
              <div><h3 id="color-theme-title" className="text-base font-semibold">Color theme</h3><p className="mt-1 text-xs text-secondary">Preview a coordinated palette. Apply to save it, or cancel to restore your current theme.</p></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.entries(THEME_CATALOG) as Array<[ThemeId, typeof THEME_CATALOG[ThemeId]]>).map(([id, option]) => {
                  const previewTokens = option[theme];
                  const selected = (themePreviewId || visualThemeId) === id;
                  return <button key={id} type="button" aria-pressed={selected} aria-label={`Preview ${option.label}`} onClick={() => previewVisualTheme(id)} className={`lifeos-panel flex min-h-14 items-center gap-2 rounded-xl border p-2 text-left text-xs ${selected ? 'ring-2 ring-offset-2 ring-offset-[var(--page)]' : ''}`} style={selected ? { outlineColor: previewTokens.focus, ['--tw-ring-color' as string]: previewTokens.focus } as React.CSSProperties : undefined}>
                    <span className="flex shrink-0 gap-0.5" aria-hidden="true">{[previewTokens.background, previewTokens.accent, ...previewTokens.chartSeries.slice(1, 3)].map(color => <span key={color} className="h-5 w-2.5 rounded-full border" style={{ backgroundColor: color, borderColor: previewTokens.border }} />)}</span>
                    <span className="font-medium">{option.label}</span>
                  </button>;
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => previewVisualTheme(DEFAULT_THEME_ID)} className="lifeos-panel min-h-11 rounded-xl border px-3 text-sm">Restore default</button>
                <button type="button" disabled={!themePreviewId} onClick={cancelVisualThemePreview} className="lifeos-panel min-h-11 rounded-xl border px-3 text-sm disabled:opacity-50">Cancel</button>
                <button type="button" disabled={!themePreviewId} onClick={() => void applyVisualTheme()} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">Apply theme</button>
              </div>
            </section></ProfileSubpage>}

            {profileSection === 'preferences' && <ProfileSubpage title="Preferences" description="Choose how LifeOS displays dates, amounts and measurements." onBack={() => navigateProfileSection('home')}><ProfilePreferences preferences={userPrefs} hasFinancialRecords={transactions.length > 0 || budgets.length > 0 || savingsGoals.length > 0} onChange={(key, value) => { void saveUserPreference(key, value); }} /></ProfileSubpage>}

            {profileSection === 'notifications' && <ProfileSubpage title="Notifications" description="Choose which local reminders LifeOS may send." onBack={() => navigateProfileSection('home')}><section className="lifeos-panel rounded-xl border p-4 space-y-3">
              <p className="text-xs text-secondary">Android can delay inexact reminders to save battery. LifeOS does not request exact-alarm access.</p>
              <div className="lifeos-raised flex min-h-11 items-center justify-between rounded-xl px-3"><span className="text-xs font-semibold">All notifications</span><button role="switch" aria-checked={notificationsEnabled} onClick={() => void setNotificationsMaster(!notificationsEnabled)} className={`min-h-11 min-w-14 rounded-full px-3 text-[11px] font-bold ${notificationsEnabled ? 'lifeos-accent-button' : 'lifeos-panel border text-secondary'}`}>{notificationsEnabled ? 'On' : 'Off'}</button></div>
              <p className="text-[11px] text-secondary">Android permission: <strong className={notificationDiagnostics.permission === 'granted' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>{notificationDiagnostics.permission === 'granted' ? 'Granted' : notificationDiagnostics.permission === 'denied' ? 'Denied · open settings to allow' : notificationDiagnostics.permission === 'prompt' || notificationDiagnostics.permission === 'prompt-with-rationale' ? 'Not requested yet' : notificationDiagnostics.permission}</strong></p>
              {notificationDiagnostics.capability === 'initializing' && <p role="status" className="text-[11px] text-secondary">Checking Android notification support…</p>}
              {notificationDiagnostics.capability === 'unavailable' && <p className="text-[11px] text-[var(--warning)]">Android notification support is unavailable in this app build. Your reminder definitions remain saved.</p>}
              {notificationDiagnostics.capability === 'error' && <p className="text-[11px] text-[var(--warning)]">Android notification diagnostics could not be read. Refresh to retry.</p>}
              {(Object.keys(notificationLabels) as (keyof NotificationPreferences)[]).map(key => <div key={key} className="flex min-h-11 items-center justify-between gap-3 border-t border-[var(--stroke)] pt-2"><span className="text-xs">{notificationLabels[key]}</span><button role="switch" aria-checked={notificationPreferences[key]} onClick={() => void toggleNotificationCategory(key)} className={`min-h-11 min-w-14 rounded-full px-3 text-[11px] font-bold ${notificationPreferences[key] ? 'lifeos-accent-button' : 'lifeos-panel border text-secondary'}`}>{notificationPreferences[key] ? 'On' : 'Off'}</button></div>)}
              <div className="space-y-1 rounded-xl border border-[var(--stroke)] p-3 text-[10px] text-secondary"><p>Capability: <span className={notificationDiagnostics.capability === 'available' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>{notificationDiagnostics.capability}</span> · {notificationDiagnostics.platform}</p><p>Build: {notificationDiagnostics.versionName || notificationDiagnostics.build.appVersion} ({notificationDiagnostics.build.commit}) · API {notificationDiagnostics.androidApi ?? 'unknown'}</p><p>Capacitor core / local notifications: {notificationDiagnostics.build.capacitor.core} / {notificationDiagnostics.build.capacitor.localNotifications}</p><p>Android permission: {notificationDiagnostics.permission} · App notifications: {notificationDiagnostics.appNotifications}</p><p>Alarms &amp; reminders access: {notificationDiagnostics.exactAlarm}</p>{notificationDiagnostics.exactAlarm !== 'granted' && <p>Timing: approximate; Android may defer while idle or under device power management.</p>}<p>Power allowlist exemption: {notificationDiagnostics.batteryOptimizationExempt === null ? 'unknown' : String(notificationDiagnostics.batteryOptimizationExempt)} · OEM controls may differ</p><p>Channel: {notificationDiagnostics.channel}</p><p>Pending scheduled records: {notificationDiagnostics.pendingCount}</p><p>Currently visible in notification shade: {notificationDiagnostics.visibleNotificationCount} · IDs {notificationDiagnostics.visibleNotificationIds.join(', ') || 'none'}</p><p>Last schedule: {notificationDiagnostics.lastScheduleAttempt || 'unknown'} · {notificationDiagnostics.lastScheduleResult}</p><p>Last cancellation reason: {notificationDiagnostics.lastCancellationReason || 'none recorded'}</p><p>Last action event: {notificationDiagnostics.lastActionEvent ? `${notificationDiagnostics.lastActionEvent.kind}, ${notificationDiagnostics.lastActionEvent.at}` : 'unknown'}</p><p>Last scheduling error: <span className={notificationDiagnostics.lastError ? 'text-[var(--danger)]' : 'text-[var(--success)]'}>{notificationDiagnostics.lastError || 'None'}</span></p></div>
              <div className="grid grid-cols-2 gap-2"><button onClick={async () => { try { const at = await NotificationService.testNotification(); await refreshNotificationDiagnostics(); showToast(`Scheduled test for ${at.toLocaleTimeString()}; check whether it arrives.`, 'success'); } catch (error) { await refreshNotificationDiagnostics(); showToast(error instanceof Error ? error.message : 'Test notification failed', 'danger'); } }} className="lifeos-accent-button min-h-11 rounded-xl px-3 text-xs font-semibold">Schedule test · 10 sec</button><button onClick={async () => { try { const at = await NotificationService.sendImmediateTestNotification(); await refreshNotificationDiagnostics(); showToast(`Immediate test requested for ${at.toLocaleTimeString()}; check whether it arrives.`, 'success'); } catch (error) { await refreshNotificationDiagnostics(); showToast(error instanceof Error ? error.message : 'Immediate test failed', 'danger'); } }} className="lifeos-panel min-h-11 rounded-xl border px-3 text-xs font-semibold">Immediate test</button><button onClick={() => void openNotificationSettings()} className="col-span-2 lifeos-panel min-h-11 rounded-xl border px-3 text-xs font-semibold">Android settings</button></div>
              <button onClick={() => void refreshNotificationDiagnostics()} className="min-h-11 w-full rounded-xl border border-[var(--stroke)] text-xs font-medium text-secondary">Refresh diagnostics</button>
              <button onClick={() => void copyNotificationDiagnostics()} className="min-h-11 w-full rounded-xl border border-[var(--stroke)] text-xs font-medium text-secondary">Copy privacy-safe diagnostics</button>
            </section></ProfileSubpage>}

            {profileSection === 'data' && <ProfileSubpage title="Data & backup" description="Manage encrypted copies and local records." onBack={() => navigateProfileSection('home')}>
            {/* Kept available, but disclosed because these records are added to the live local database. */}
            <details className="profile-demo-disclosure">
              <summary>Sample data for demonstrations</summary>
              <div className="lifeos-panel rounded-xl border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Add demonstration records</h3>
              <p className="text-xs text-secondary">This adds sample transactions, habits, goals, and tasks alongside your records. Export a backup first if you need to preserve the current state. LifeOS does not automatically remove these records later.</p>
              <button
                onClick={async () => {
                  if (!(await confirmAction({ title: 'Add sample records to this device?', message: 'Demonstration transactions, habits, goals, and tasks will be added alongside your existing records. They are not automatically removed.', confirmLabel: 'Add sample records', cancelLabel: 'Cancel' }))) return;
                  await StorageService.backup.seedDemoData();
                  await reloadAllData();
                  showToast('Sample demonstration data loaded', 'success');
                }}
                className="lifeos-raised min-h-11 w-full rounded-xl px-3 text-xs font-semibold transition"
              >
                Add sample records
              </button>
              </div>
            </details>

            {/* Backup & Restore */}
            <div className="lifeos-panel rounded-xl border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Backup & Restore</h3>
              <p className="text-xs text-secondary">Export a passphrase-encrypted backup, or restore a validated encrypted or legacy JSON backup.</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (backupOperation.current) return;
                    backupOperation.current = true;
                    setBackupOperationInProgress(true);
                    try {
                      await setSensitiveScreenshotState(true);
                      const passphrase = await requestBackupPassphrase('export');
                      if (passphrase === null) return;
                      const token = sessionManager.capture();
                      const json = await encryptBackup(await StorageService.backup.exportData(), passphrase);
                      sessionManager.assertCurrent(token);
                      const result = await exportBackupFile({
                        contents: json,
                        fileName: `lifeos-backup-${formatLocalDate(new Date())}.json`,
                        mimeType: 'application/json'
                      });

                      if (result.status === 'saved') {
                        showToast(`Backup saved successfully (${result.bytesWritten} bytes).`, 'success');
                      } else if (result.status === 'cancelled') {
                        showToast('Backup export cancelled. No file was saved.', 'info');
                      } else {
                        showToast('Backup download started. Check your browser downloads.', 'success');
                      }
                    } catch (error) {
                      console.error('LifeOS backup export failed:', error);
                      showToast(error instanceof Error ? `Backup export failed: ${error.message}` : 'Backup export failed. Your data was not changed.', 'danger');
                    } finally { backupOperation.current = false; setBackupOperationInProgress(false); }
                  }}
                  className="lifeos-raised min-h-11 flex-1 rounded-xl px-3 text-xs font-semibold"
                >
                  Export encrypted backup
                </button>
                <button onClick={() => document.getElementById('lifeos-backup-import')?.click()} className="lifeos-raised min-h-11 flex-1 rounded-xl px-3 text-xs font-semibold">Restore JSON</button>
              </div>
              <input id="lifeos-backup-import" type="file" accept="application/json,.json" className="hidden" onChange={event => { void importBackupFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
              <button onClick={async () => {
                try {
                  const rows = transactions.map(tx => [tx.type, tx.description, tx.amount, tx.category, tx.date, formatLocalDateTime(new Date(tx.occurredAt || tx.createdAt)), tx.paymentMethod || '']);
                  const quote = quoteCsvCell;
                  const csv = [['type', 'description', 'amount', 'category', 'date', 'entry_time', 'payment_method'], ...rows].map(row => row.map(quote).join(',')).join('\n');

                  const result = await exportBackupFile({
                    contents: csv,
                    fileName: `lifeos-transactions-${formatLocalDate(new Date())}.csv`,
                    mimeType: 'text/csv'
                  });

                  if (result.status === 'saved') {
                    showToast(`Transactions CSV saved (${result.bytesWritten} bytes).`, 'success');
                  } else if (result.status === 'cancelled') {
                    showToast('CSV export cancelled. No file was saved.', 'info');
                  } else {
                    showToast('CSV download started. Check your browser downloads.', 'success');
                  }
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Transactions CSV export failed.', 'danger');
                }
              }} className="lifeos-raised min-h-11 w-full rounded-xl px-3 text-xs font-semibold">Export transactions CSV</button>
            </div>

            {/* Danger Zone */}
            <div className="lifeos-panel rounded-xl border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--danger)]">Data Reset</h3>
              <p className="text-xs text-secondary">Permanently erase all personal database records.</p>
              <button
                onClick={async () => {
                  if (!(await confirmAction({ title: 'Erase all LifeOS data?', message: 'This permanently removes all personal records stored on this device. This cannot be undone.', confirmLabel: 'Erase all data', cancelLabel: 'Keep my data', destructive: true }))) return;
                  try {
                    await NotificationService.cancelAllRecordReminders();
                    await StorageService.backup.clearAll();
                    await reloadAllData();
                    showToast('All personal records erased', 'info');
                  } catch {
                    showToast('Reset did not complete. Please retry; reminder cleanup must succeed before records are erased.', 'danger');
                  }
                }}
                className="lifeos-danger min-h-11 w-full rounded-xl border px-3 text-xs font-semibold"
              >
                Clear All Application Data
              </button>
            </div>
            </ProfileSubpage>}
            {profileSection === 'about' && <ProfileSubpage title="About LifeOS" description="A private, offline-first space for your plans and progress." onBack={() => navigateProfileSection('home')}>
            <section className="lifeos-panel rounded-xl border p-4 space-y-2">
              <h3 className="text-sm font-semibold">LifeOS information</h3><p className="text-xs text-secondary">Version {packageInfo.version} · Package com.lifeos.personal</p><p className="text-[11px] text-muted">Offline-first personal management. Your records are stored in the local app database.</p>
              <button onClick={async () => { if (!(await confirmAction({ title: 'Restart the welcome tour?', message: 'Your records will remain untouched. Choices made during onboarding may update your name, appearance, security, and notification preferences.', confirmLabel: 'Restart tour' }))) return; await StorageService.settings.set('onboardingCompleted', false); await StorageService.settings.set('onboardingStarted', true); await StorageService.settings.set('onboardingStep', 0); setOnboardingStep(0); setOnboardingComplete(false); setOnboardingRequired(true); }} className="min-h-11 rounded-xl border border-[var(--stroke)] px-3 text-xs font-medium">Restart onboarding</button>
            </section>
            </ProfileSubpage>}
          </div>
        )} />
        </div>
      </main>

      {createKind && (
        <div className="ui-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestCloseForm(); }}>
          <form onSubmit={saveNewRecord} onChange={() => setCreateFormDirty(true)} role="dialog" aria-modal="true" aria-labelledby="record-form-title" aria-describedby="record-form-description" aria-busy={recordSaving} className="ui-sheet-motion ui-bottom-sheet lifeos-panel w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border p-5 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 id="record-form-title" className="text-lg font-bold">{editingTransactionId ? 'Edit transaction' : editingGoalId ? 'Edit goal' : editingTaskId ? 'Edit task' : editingHabitId ? 'Edit habit' : editingContributionId ? 'Edit savings contribution' : editingSavingsGoalId ? 'Edit savings goal' : createKind === 'budget' ? 'Set monthly budget' : createKind === 'contribution' ? 'Add savings contribution' : createKind === 'savings' ? (editingSavingsGoalId ? 'Edit savings goal' : 'Add savings goal') : createKind === 'milestone' ? 'Add goal milestone' : createKind === 'goal-progress' ? 'Update goal progress' : `Add ${createKind}`}</h2>
              <button type="button" aria-label="Close" disabled={recordSaving} onClick={requestCloseForm} className="lifeos-panel min-h-11 min-w-11 rounded-lg border text-secondary">✕</button>
            </div>
            <p id="record-form-description" className="record-form-description">{createKind === 'task' ? 'Start with a title and date. Reminders and repeat options are below.' : createKind === 'transaction' ? 'Enter the amount and category. An account is optional.' : createKind === 'habit' ? 'Choose a routine and how often you want to check in.' : createKind === 'goal' ? 'Name the outcome, then choose a measurable target.' : 'Complete the details below. Your changes are saved only when you confirm.'}</p>
            {!['budget', 'contribution', 'goal-progress'].includes(createKind) && <label className="mb-3 block text-xs text-secondary">
              {createKind === 'transaction' ? 'Merchant or description (optional)' : createKind === 'habit' ? 'Habit name' : createKind === 'goal' || createKind === 'savings' ? 'Goal title' : createKind === 'milestone' ? 'Milestone title' : 'Task title'}
              <input autoFocus={createKind !== 'transaction'} required={createKind !== 'transaction'} maxLength={120} value={createDraft.title || ''} onChange={e => setCreateDraft({ ...createDraft, title: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" />
            </label>}
            {createKind === 'transaction' && <>
              <label className="mb-3 block text-xs text-secondary">Type<select value={createDraft.type} onChange={e => {
                const type = e.target.value as 'income' | 'expense';
                const category = categories.find(item => item.type === type)?.name || '';
                setCreateDraft({ ...createDraft, type, category });
              }} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm"><option value="expense">Expense</option><option value="income">Income</option></select></label>
              <label className="mb-3 block text-xs text-secondary">Amount · {createDraft.currencyCode || userPrefs.currency}<input autoFocus={!editingTransactionId} required type="number" min={10 ** -getCurrencyMetadata(createDraft.currencyCode || userPrefs.currency).fractionDigits} step={10 ** -getCurrencyMetadata(createDraft.currencyCode || userPrefs.currency).fractionDigits} inputMode="decimal" value={createDraft.amount} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-secondary">Category<select required value={createDraft.category || ''} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">
                <option value="">Select category</option>
                {createDraft.category && !categories.some(category => category.name === createDraft.category && category.type === createDraft.type) && (
                  <option value={createDraft.category}>Legacy category: {createDraft.category}</option>
                )}
                {categories.filter(category => category.type === createDraft.type).map(category => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select></label>
              <button type="button" className="mb-3 min-h-11 rounded-lg px-2 text-left text-xs font-semibold lifeos-accent-text" aria-expanded={transactionDetailsOpen} aria-controls="transaction-optional-details" onClick={() => setTransactionDetailsOpen(open => !open)}>{transactionDetailsOpen ? 'Hide optional details' : 'Add optional details'}</button>
              {transactionDetailsOpen && <div id="transaction-optional-details" className="transaction-optional-details rounded-xl p-3">
                <label className="mb-3 block text-xs text-secondary">Currency<select value={createDraft.currencyCode || userPrefs.currency} onChange={e => setCreateDraft({ ...createDraft, currencyCode: e.target.value, accountId: financialAccounts.some(account => account.id === createDraft.accountId && account.currencyCode === e.target.value) ? createDraft.accountId : '' })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{CURRENCY_CODES.map(code => <option key={code} value={code}>{formatCurrencyChoice(code, userPrefs.locale === 'system' ? undefined : userPrefs.locale)}</option>)}</select><span className="mt-1 block">This labels the transaction. Changing the reporting currency does not convert saved records.</span></label>
                <label className="mb-3 block text-xs text-secondary">Account (optional)<select value={createDraft.accountId || ''} onChange={e => { const account = financialAccounts.find(row => row.id === e.target.value); setCreateDraft({ ...createDraft, accountId: e.target.value, ...(account ? { currencyCode: account.currencyCode } : {}) }); }} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm"><option value="">Unassigned</option>{financialAccounts.filter(account => account.isActive).map(account => <option key={account.id} value={account.id}>{account.name} · {account.currencyCode}</option>)}</select></label>
                <label className="mb-3 block text-xs text-secondary">Payment method<input maxLength={50} value={createDraft.paymentMethod || ''} onChange={e => setCreateDraft({ ...createDraft, paymentMethod: e.target.value })} placeholder="Other" className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <label className="mb-3 block text-xs text-secondary">Notes (optional)<textarea rows={2} maxLength={500} value={createDraft.notes || ''} onChange={e => setCreateDraft({ ...createDraft, notes: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <label className="mb-3 flex min-h-11 items-center gap-2 text-xs text-secondary"><input type="checkbox" checked={createDraft.isRecurring === 'yes'} onChange={e => setCreateDraft({ ...createDraft, isRecurring: e.target.checked ? 'yes' : '' })} />Recurring transaction</label>
                <label className="mb-1 block text-xs text-secondary">Transaction date and time{editingLegacyDateOnly && <span className="mt-1 block text-[var(--warning)]">This older record has no saved time. Leave this empty to preserve its date-only history.</span>}<input required={!editingLegacyDateOnly} type="datetime-local" value={createDraft.dateTime || ''} onChange={e => setCreateDraft({ ...createDraft, dateTime: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              </div>}
            </>}
            {createKind === 'habit' && <>
              <label className="mb-3 block text-xs text-secondary">How often?<select value={createDraft.frequency} onChange={e => setCreateDraft({ ...createDraft, frequency: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm"><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option><option value="weekly">Weekly</option></select></label>
              <label className="mb-3 block text-xs text-secondary">Description (optional)<textarea rows={2} maxLength={300} value={createDraft.description || ''} onChange={e => setCreateDraft({ ...createDraft, description: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-secondary">Daily target (optional)<input type="number" min="0.01" step="any" value={createDraft.targetPerDay || ''} onChange={e => setCreateDraft({ ...createDraft, targetPerDay: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-secondary">Reminder time (optional)<input type="time" value={createDraft.reminderTime || ''} onChange={e => setCreateDraft({ ...createDraft, reminderTime: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              {createDraft.frequency === 'weekly' && <label className="mb-3 block text-xs text-secondary">Reminder weekday<select value={createDraft.reminderWeekday || '2'} onChange={e => setCreateDraft({ ...createDraft, reminderWeekday: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>}
            </>}
            {createKind === 'goal' && <>
              <label className="mb-3 block text-xs text-secondary">Category<select value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => <option key={category}>{category}</option>)}</select></label>
              <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-secondary">Target<input required type="number" min="0.01" step="any" inputMode="decimal" value={createDraft.target} onChange={e => setCreateDraft({ ...createDraft, target: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label><label className="text-xs text-secondary">Current<input type="number" min="0" step="any" inputMode="decimal" value={createDraft.current} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label></div>
              <label className="mb-3 block text-xs text-secondary">Unit (optional)<input maxLength={20} value={createDraft.unit} onChange={e => setCreateDraft({ ...createDraft, unit: e.target.value })} placeholder="km, books, ₹..." className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-secondary">Priority<select value={createDraft.priority || 'Medium'} onChange={e => setCreateDraft({ ...createDraft, priority: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              {editingGoalId && <label className="mb-3 block text-xs text-secondary">Status<select value={createDraft.status || 'In Progress'} onChange={e => setCreateDraft({ ...createDraft, status: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['In Progress', 'Paused', 'Completed'].map(status => <option key={status}>{status}</option>)}</select></label>}
              <label className="mb-3 block text-xs text-secondary">Description (optional)<textarea rows={2} maxLength={500} value={createDraft.description || ''} onChange={e => setCreateDraft({ ...createDraft, description: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'budget' && <>
              <label className="mb-3 block text-xs text-secondary">Budget category (optional)<select value={createDraft.categoryId || ''} onChange={e => setCreateDraft({ ...createDraft, categoryId: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm"><option value="">Overall budget</option>{categories.filter(category => category.type === 'expense').map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="mb-3 block text-xs text-secondary">Monthly limit · {userPrefs.currency}<input required type="number" min={10 ** -getCurrencyMetadata(userPrefs.currency).fractionDigits} step={10 ** -getCurrencyMetadata(userPrefs.currency).fractionDigits} inputMode="decimal" value={createDraft.amount || ''} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <label className="mb-4 block text-xs text-secondary">Month<input required type="month" value={createDraft.month || financeMonth} onChange={e => setCreateDraft({ ...createDraft, month: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'savings' && <>
              <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-secondary">Target amount · {userPrefs.currency}<input required type="number" min={10 ** -getCurrencyMetadata(userPrefs.currency).fractionDigits} step={10 ** -getCurrencyMetadata(userPrefs.currency).fractionDigits} inputMode="decimal" value={createDraft.target || ''} onChange={e => setCreateDraft({ ...createDraft, target: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>{!editingSavingsGoalId && <label className="text-xs text-secondary">Already saved<input type="number" min="0" step={10 ** -getCurrencyMetadata(userPrefs.currency).fractionDigits} inputMode="decimal" value={createDraft.current} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>}</div>
              <label className="mb-3 block text-xs text-secondary">Category (optional)<input maxLength={40} value={createDraft.category || ''} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'contribution' && <>
              {editingContributionId ? <p className="mb-3 text-xs text-secondary">Savings goal · {savingsGoals.find(goal => goal.id === createDraft.goalId)?.title || 'Unavailable'}</p> : <label className="mb-3 block text-xs text-secondary">Savings goal<select required value={createDraft.goalId || ''} onChange={e => setCreateDraft({ ...createDraft, goalId: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{savingsGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>}
              {(() => { const contributionCurrency = savingsContributions.find(item => item.id === editingContributionId)?.currencyCode || savingsGoals.find(goal => goal.id === createDraft.goalId)?.currencyCode || userPrefs.currency; const digits = getCurrencyMetadata(contributionCurrency).fractionDigits; return <label className="mb-3 block text-xs text-secondary">Amount · {contributionCurrency}<input required type="number" min={10 ** -digits} step={10 ** -digits} inputMode="decimal" value={createDraft.amount || ''} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>; })()}
              <label className="mb-3 block text-xs text-secondary">Note (optional)<input maxLength={100} value={createDraft.notes || ''} onChange={e => setCreateDraft({ ...createDraft, notes: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <p className="mb-3 rounded-xl bg-[var(--surface-raised)] p-3 text-xs leading-relaxed text-secondary">A contribution updates this savings goal only; it does not record a cash movement or reduce expense and budget totals. If money moves between tracked accounts, record that separately as a transfer.</p>
            </>}
            {createKind === 'milestone' && <label className="mb-3 block text-xs text-secondary">Goal<select required value={createDraft.goalId || ''} onChange={e => setCreateDraft({ ...createDraft, goalId: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>}
            {createKind === 'goal-progress' && <><label className="mb-3 block text-xs text-secondary">Goal<select required value={createDraft.goalId || ''} onChange={e => setCreateDraft({ ...createDraft, goalId: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label><label className="mb-4 block text-xs text-secondary">Current progress<input required type="number" min="0" step="any" inputMode="decimal" value={createDraft.current || ''} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label></>}
            {createKind === 'task' && <>
              <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-secondary">Due date<input required type="date" value={createDraft.date || ''} onChange={e => setCreateDraft({ ...createDraft, date: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-2 py-3 text-sm" /></label><label className="text-xs text-secondary">Time (optional)<input type="time" value={createDraft.time || ''} onChange={e => setCreateDraft({ ...createDraft, time: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-2 py-3 text-sm" /></label></div>
              <label className="mb-3 block text-xs text-secondary">Priority<select value={createDraft.priority} onChange={e => setCreateDraft({ ...createDraft, priority: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              <details className="ui-optional-form-details" open={Boolean(editingTaskId && (createDraft.description || createDraft.category || createDraft.reminderAt || (createDraft.recurring && createDraft.recurring !== 'None')))}><summary>More task details</summary>
                <label className="mb-3 block text-xs text-secondary">Description (optional)<textarea rows={2} maxLength={500} value={createDraft.description || ''} onChange={e => setCreateDraft({ ...createDraft, description: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <label className="mb-3 block text-xs text-secondary">Category (optional)<input maxLength={50} value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <label className="mb-3 block text-xs text-secondary">Reminder (optional)<input type="datetime-local" value={createDraft.reminderAt || ''} onChange={e => setCreateDraft({ ...createDraft, reminderAt: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /><span className="mt-1 block text-[10px] text-muted">Uses local time; delivery may be approximate on Android.</span></label>
                <label className="mb-3 block text-xs text-secondary">Repeat<select value={createDraft.recurring || 'None'} onChange={e => setCreateDraft({ ...createDraft, recurring: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['None', 'Daily', 'Weekly', 'Monthly'].map(item => <option key={item}>{item}</option>)}</select></label>
              </details>
            </>}
            {!['habit', 'budget', 'task', 'transaction', 'goal-progress'].includes(createKind) && <label className="mb-4 block text-xs text-secondary">{createKind === 'goal' || createKind === 'savings' ? 'Target date' : createKind === 'milestone' ? 'Target date (optional)' : 'Date'}<input type="date" required={createKind !== 'milestone'} value={createDraft.date || ''} onChange={e => setCreateDraft({ ...createDraft, date: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>}
            {editingTransactionId && <button type="button" onClick={async () => { if (!(await confirmAction({ title: 'Delete this transaction?', message: 'This transaction will be removed from your history. This cannot be undone.', confirmLabel: 'Delete transaction', destructive: true }))) return; await StorageService.transactions.delete(editingTransactionId); setCreateKind(null); setCreateFormDirty(false); setEditingTransactionId(null); await reloadAllData(); showToast('Transaction deleted', 'info'); }} className="mb-2 min-h-11 w-full rounded-xl border border-[var(--danger)] px-4 py-2.5 text-sm font-medium text-[var(--danger)]">Delete transaction</button>}
            {editingContributionId && <button type="button" onClick={async () => { if (!(await confirmAction({ title: 'Delete this contribution?', message: 'The contribution will be removed and subtracted from the saved goal total.', confirmLabel: 'Delete contribution', destructive: true }))) return; try { await StorageService.savings.deleteContribution(editingContributionId); setCreateKind(null); setCreateFormDirty(false); setEditingContributionId(null); await reloadAllData(); showToast('Contribution deleted and savings total reconciled', 'success'); } catch (error) { showToast(error instanceof Error ? error.message : 'Contribution could not be deleted safely.', 'danger'); } }} className="mb-2 min-h-11 w-full rounded-xl border border-[var(--danger)] px-4 py-2.5 text-sm font-medium text-[var(--danger)]">Delete contribution</button>}
            <div className="ui-form-actions"><button type="button" disabled={recordSaving} onClick={requestCloseForm} className="lifeos-raised min-h-12 flex-1 rounded-xl text-sm font-semibold">Cancel</button><button type="submit" disabled={recordSaving} className="lifeos-accent-button min-h-12 flex-1 rounded-xl px-3 text-sm font-semibold">{recordSaving ? 'Saving…' : editingTransactionId ? 'Save transaction' : editingGoalId ? 'Save goal' : editingTaskId ? 'Save task' : editingHabitId ? 'Save habit' : editingContributionId ? 'Save contribution' : editingSavingsGoalId ? 'Save savings goal' : createKind === 'budget' ? 'Save budget' : createKind === 'contribution' ? 'Save contribution' : createKind === 'goal-progress' ? 'Save progress' : `Save ${createKind}`}</button></div>
          </form>
        </div>
      )}

      {/* Floating Bottom Nav */}
      <nav aria-label="Main navigation" className="lifeos-nav app-bottom-nav fixed bottom-0 left-0 right-0 z-30 mx-auto grid grid-cols-4 border-t px-2 pt-2 backdrop-blur">
        {PRIMARY_NAVIGATION.map(({ tab, label, icon }) => {
          const Icon = ({ home: Home, wallet: WalletCards, calendar: CalendarDays, life: Leaf })[icon];
          const isSelected = primaryDestinationForTab(activeTab) === tab;
          return (
          <button
            key={tab}
            data-tab={tab}
            onClick={() => {
              if (isSelected) {
                if (activeTab !== tab) { navigateTo(tab); return; }
                if (tab === 'finance') setFinanceSubtab('overview');
                if (tab === 'life') { setHabitsSubtab('checklist'); setGoalsSubtab('active'); }
                return;
              }
              navigateTo(tab);
            }}
            aria-label={label}
            aria-current={isSelected ? 'page' : undefined}
            className={`nav-item ui-control-feedback flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] leading-none font-medium ${isSelected ? 'lifeos-tint lifeos-accent-text font-bold' : 'text-secondary'}`}
          >
            <Icon size={18} strokeWidth={isSelected ? 2.4 : 1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
          );
        })}
      </nav>

      {showExitConfirmation && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-5" role="presentation"><section className="lifeos-panel w-full max-w-sm rounded-2xl border p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="exit-lifeos-title"><h2 id="exit-lifeos-title" className="text-lg font-semibold">Leave LifeOS?</h2><p className="mt-2 text-sm text-secondary">Your changes are saved on this device. You can return anytime.</p><div className="mt-5 flex gap-2"><button autoFocus onClick={() => setShowExitConfirmation(false)} className="lifeos-input min-h-11 flex-1 rounded-xl text-sm font-medium">Stay</button><button onClick={() => void CapacitorApp.exitApp()} className="lifeos-accent-button min-h-11 flex-1 rounded-xl text-sm font-semibold">Exit app</button></div></section></div>}

      {confirmation && <ConfirmationDialog {...confirmation} onCancel={() => settleConfirmation(false)} onConfirm={() => settleConfirmation(true)} />}

      {/* In-app Toast Notification */}
      {toast && (
        <div role="status" aria-live="polite" className={`ui-toast lifeos-raised lifeos-border fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-2xl ${toast.type === 'success' ? 'ui-success-feedback' : ''}`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
