import { AliveDisclosure } from './components/AliveDisclosure';
import LifeDoodle from './components/LifeDoodle';
import { useAliveNavigation } from './hooks/useAliveNavigation';
import TaskComposerOptions from './components/TaskComposerOptions';
import { AnimatePresence, LazyMotion, domAnimation } from 'motion/react';
import * as m from 'motion/react-m';
import { RecordComposerLayer } from './components/RecordComposerLayer';
import { animateRoute } from './services/aliveMotion';
import { useInterfaceMotion } from './hooks/useInterfaceMotion';
import MotionPreferences from './components/MotionPreferences';
import MoneyDetailHeader from './components/MoneyDetailHeader';
import InfoTip from './components/InfoTip';
import { estimateDragVelocity, type MotionSample } from './services/interfaceMotion';
import React, { Suspense, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import packageInfo from '../package.json';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Home, Leaf, Moon, Search, Shield, ShieldCheck, Smartphone, Sun, WalletCards } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';

import { StorageService, sessionManager, activateEncryptedStorage, isEncryptedStorageActivated, validateBackupTables, getRecoveryChallenge, hasEncryptedRecords, hasPrivateRows } from './db';
import { CryptoService, type PreparedRecovery } from './services/cryptoService.ts';
import { createProtectedSessionController, unlockEncryptedSession, type NewUserRecoveryChoice } from './services/cryptoSessionCoordinator';
import { RecoveryExportLifecycle } from './services/recoveryExportLifecycle';
import { encryptBackup, MAX_BACKUP_FILE_BYTES } from './services/backupCryptoService';
import { decodeBackupForRestore } from './services/backupImportService';
import BackupPassphraseDialog from './components/BackupPassphraseDialog';
import RecoveryDialog from './components/RecoveryDialog';
import HabitHistory from './components/HabitHistory';
import SecureSetupDialog from './components/SecureSetupDialog';
import FirstRecordSecurityDialog from './components/FirstRecordSecurityDialog';
import { createRecoveryController } from './services/recoveryService';
import { quoteCsvCell } from './services/csvExportService.ts';
import { exportBackupFile } from './services/backupExportService';
import { confirmScreenshotResume, isSensitiveScreenshotState, setSensitiveScreenshotState } from './services/screenshotProtection';
import { BiometricService } from './services/biometricService';
import { createAuthCoordinator } from './services/authCoordinator';
import { CURRENCY_CODES, DEFAULT_USER_PREFERENCES, buildTransactionUpdate, canonicalUnit, convertMeasurement, formatCurrency, formatDatePreference, formatTimePreference, mergeUserPreferences, resolveSystemDark, formatHabitQuantity, normalizeHabitUnit, type UserPreferences } from './services/userPreferences';
import { createMoneyRecordAmount, decimalToMinorUnits, formatCurrencyChoice, formatMinorUnits, getCurrencyMetadata, minorUnitsToDecimal } from './services/financeCore';
import { buildFinanceAnalytics } from './services/financeAnalytics';
import { budgetCarryoverMinor, getExactBudgetDisplayStatus } from './services/budgetDisplay';
import { buildDuplicateTransactionDraft } from './services/transactionDraft';
import { DEFAULT_TODAY_LAYOUT, moveTodaySection, normalizeTodayLayout, setTodaySectionVisible, TODAY_SECTION_LABELS, type TodayLayout, type TodaySectionId } from './services/todayLayout';
import { groupUpcomingTasks } from './services/taskViews';
import TaskDetailScreen from './components/TaskDetailScreen';
import { applyThemeTokens, DEFAULT_THEME_ID, resolveThemeId, THEME_CATALOG, type ThemeId } from './services/themeCatalog';
import { buildCustomAccentOverrides, normalizeCustomAccent } from './services/customAccent';
import CustomAccentPicker from './components/CustomAccentPicker';
import { resolveInitialVisualTheme } from './services/systemAppearance';
import MoneyHome from './components/MoneyHome';
import MoneyAccounts, { type AccountDraft, type TransferDraft } from './components/MoneyAccounts';
import type { QuickTaskDetails } from './components/QuickTaskEntry';
import PlannedCashFlow from './components/PlannedCashFlow';
import MoneyPlanning, { type MoneyPlanningDraftState } from './components/MoneyPlanning';
import ProfileDrawer from './components/ProfileDrawer';
import LicenseText from './components/LicenseText';
import { pickProfilePhoto, prepareProfilePhoto, PROFILE_PHOTO_SETTING, readProfilePhoto } from './services/profilePhoto';
import SavingsGoalProgress from './components/SavingsGoalProgress';
import ConfirmationDialog, { type ConfirmationOptions } from './components/ConfirmationDialog';
import { ProfileAvatar, ProfileHome, ProfileSettingRow, ProfileSubpage, profileParent, type ProfileSection } from './components/ProfileSettings';
import ProfilePreferences, { PreferenceChoice } from './components/ProfilePreferences';
import RetainedScreen from './components/RetainedScreen';
import ReminderStatusSummary from './components/ReminderStatusSummary';
import { useRecordDialog } from './hooks/useRecordDialog';
import { useBottomNavigationInset } from './hooks/useBottomNavigationInset';
import { PRIMARY_NAVIGATION, primaryDestinationForTab, resolvePlanPath, type MainTab } from './services/navigationCatalog';
import { popTabHistory, pushTabHistory } from './services/tabHistory';
import { beginPrimaryGesture, matchesPrimaryGestureClickSuppression, primaryGestureStartBlockReason, recordGestureTrace, resolvePrimaryGestureEnd, shouldCancelPrimaryCaptureLoss, shouldSuppressPrimaryGestureClick, updatePrimaryGesture, type PrimaryGestureSession, type PrimaryGestureTargetKind } from './services/navigationGestures';
import { screenScrollKey } from './services/uiNavigation';
import { normalizeNotificationTone, NOTIFICATION_TONES, reminderCopy, type NotificationTone } from './services/notificationCopy';
import { DEFAULT_NOTIFICATION_PREFERENCES, FIRST_CONSENT_NOTIFICATION_PREFERENCES, NotificationService, type NotificationDiagnostics, type ReminderAction } from './services/notificationService';
import type { AccountTransfer, FinancialAccount, ManualExchangeRate, NotificationPreferences, PlannedCommitment, SavingsContribution } from './types';
import Onboarding from './components/Onboarding';
import { INITIAL_ONBOARDING_JOURNEY, ONBOARDING_NOTIFICATIONS_STEP, normalizeOnboardingJourney, resumeOnboardingStep, type OnboardingJourney } from './services/onboardingJourney';
import { buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, formatLocalDate, formatLocalDateTime, getGoalProgress, getMonthCalendarDays, getTaskStatus, getTasksForDate, getTodayOverview, isHabitEligible, greetingForHour, profileInitial, resolveAppearance, resolveBackAction, shouldShowOnboarding, sortTasksByDeadline, sortTransactions, watchSystemTheme } from './services/domainUtils';

const FinanceCharts = React.lazy(() => import('./components/FinanceCharts'));
const FinanceProjection = React.lazy(() => import('./components/FinanceProjection'));
const PlanHub = React.lazy(() => import('./components/PlanHub'));
const InsightsHub = React.lazy(() => import('./components/InsightsHub'));

const RuntimeInfo = registerPlugin<{ getSystemGestureInsets: () => Promise<{ left: number; right: number }> }>('LifeOSRuntimeInfo');

function formatMonthYear(month: string, long = false) {
  const date = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? new Date(`${month}-01T12:00:00`) : new Date();
  return date.toLocaleDateString(undefined, { month: long ? 'long' : 'short', year: 'numeric' });
}

function ScreenLoading({ label }: { label: string }) {
  return <div className="ui-loading-state p-6 text-center text-sm" role="status" aria-live="polite">{label}</div>;
}

const systemDarkPreference = () => resolveSystemDark((window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark, window.matchMedia('(prefers-color-scheme: dark)').matches);
const applyDomTheme = (theme: 'dark' | 'light', themeId: ThemeId = DEFAULT_THEME_ID, customAccent?: string) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  applyThemeTokens(themeId, theme);
  for (const [name, value] of Object.entries(buildCustomAccentOverrides(normalizeCustomAccent(customAccent), themeId, theme))) {
    document.documentElement.style.setProperty(name, value);
  }
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101712' : '#FAFAF7');
};

const notificationLabels: Record<keyof NotificationPreferences, string> = {
  taskReminders: 'Due-time and early task alerts',
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
  const interfaceMotion = useInterfaceMotion();
  // Navigation & Theme State
  const navigationMotion = useAliveNavigation(interfaceMotion.preset, interfaceMotion.reducedMotion);
  const { activeTab, activeTabRef, tabTransition, transitionPropsFor } = navigationMotion;
  const releaseGestureCapture = (pointerId?: number) => {
    if (pointerId == null) return;
    const surface = gestureSurfaceElement.current;
    if (surface?.hasPointerCapture?.(pointerId)) {
      try { surface.releasePointerCapture(pointerId); } catch { /* Pointer may already have ended. */ }
    }
  };
  const transitionToTab = (tab: MainTab, direction?: 'left' | 'right', velocity = 0) => {
    const pointerId = swipePointer.current?.pointerId;
    swipePointer.current = null;
    swipeOriginAction.current = null;
    releaseGestureCapture(pointerId);
    navigationMotion.jumpTo(tab, direction, velocity);
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
  const taskDetailReturnFocusRef = useRef<HTMLElement | null>(null);
  const taskDetailReturnTabRef = useRef<MainTab | null>(null);
  const plannerHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const pendingNotification = useRef<ReminderAction | null>(null);
  const reminderProcessing = useRef(false);
  const handledNotificationIds = useRef(new Set<number>());
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileClosing, setProfileClosing] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSection>('home');
  const profileScroll = useRef<Record<string, number>>({});
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [pendingProfilePhoto, setPendingProfilePhoto] = useState<File | null>(null);
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState('');
  const profilePhotoOperation = useRef(false);
  const swipePointer = useRef<PrimaryGestureSession | null>(null);
  const activeTouchPointers = useRef(new Set<number>());
  const swipeSuppressed = useRef(false);
  const swipeOriginAction = useRef<HTMLElement | null>(null);
  const swipeClickSuppression = useRef<{ pointerId: number; target: HTMLElement; expiresAt: number } | null>(null);
  const gestureSurfaceElement = useRef<HTMLDivElement | null>(null);
  const gestureEventHandlers = useRef({
    move: (_event: PointerEvent) => {},
    up: (_event: PointerEvent) => {},
    cancel: (_event: PointerEvent) => {},
    lost: (_event: PointerEvent) => {},
  });
  const nativeGestureInsets = useRef<{ left: number; right: number } | null>(null);
  const swipeMoveFrame = useRef<number | null>(null);
  const swipeSamples = useRef<MotionSample[]>([]);
  const scrollPositions = useRef<Record<string, number>>({});
  const [theme, setTheme] = useState<'dark' | 'light'>(() => systemDarkPreference() ? 'dark' : 'light');
  const [appearance, setAppearancePreference] = useState<AppearancePreference>('system');
  const [visualThemeId, setVisualThemeId] = useState<ThemeId>(() => {
    try { return resolveThemeId(localStorage.getItem('lifeos-theme-id')); } catch { return DEFAULT_THEME_ID; }
  });
  const [themePreviewId, setThemePreviewId] = useState<ThemeId | null>(null);
  const [customAccent, setCustomAccent] = useState<string | undefined>(() => {
    try { return normalizeCustomAccent(localStorage.getItem('lifeos-custom-accent')); } catch { return undefined; }
  });
  const customAccentSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [displayName, setDisplayName] = useState('');
  const [clockNow, setClockNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const logoIntroPlayed = useRef(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationPermissionRequested, setNotificationPermissionRequested] = useState(false);
  const [notificationTone, setNotificationTone] = useState<NotificationTone>('warm');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationDiagnostics, setNotificationDiagnostics] = useState<NotificationDiagnostics>({
    capability: 'initializing', platform: 'initializing', supported: false, permission: 'checking',
    appNotifications: 'checking', exactAlarm: 'checking', channel: 'checking', pendingCount: 0,
    visibleNotificationCount: 0, visibleNotificationIds: [], batteryOptimizationExempt: null,
    androidApi: null, packageName: null, versionName: null, versionCode: null, build: __LIFEOS_BUILD_INFO__,
    lastScheduleAttempt: null, lastScheduleResult: 'unknown', lastCancellationReason: null,
    lastActionEvent: null, reminderLifecycle: [], lastError: '',
  });
  const developerToolsEnabled = import.meta.env.DEV || notificationDiagnostics.packageName === 'com.lifeos.personal.debug';
  navigationMotion.measure.current = developerToolsEnabled;
  const [taskReminderDiagnostics, setTaskReminderDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [dateOnlyAlertTime, setDateOnlyAlertTime] = useState('');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingJourney, setOnboardingJourney] = useState<OnboardingJourney>(INITIAL_ONBOARDING_JOURNEY);
  const [startupError, setStartupError] = useState('');
  const [appReady, setAppReady] = useState(false);
  const [firstRecordSecurityOpen, setFirstRecordSecurityOpen] = useState(false);
  const [recoveryProvisioned, setRecoveryProvisioned] = useState(false);
  const [recoveryDeferred, setRecoveryDeferred] = useState(false);
  const safeFirstRunBrowse = useRef(false);
  const firstRecordSetupAuthorized = useRef(false);
  const onboardingSetupAuthorized = useRef(false);
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
  const recoveryExportLifecycle = useRef(new RecoveryExportLifecycle()).current;
  const recoveryExportResumeInFlight = useRef(false);
  const recoveryExportLockDrain = useRef<Promise<void> | null>(null);
  const recoveryExportReturnPending = useRef(false);
  const [recoveryExportResumeReady, setRecoveryExportResumeReady] = useState(true);
  const beginRecoveryExportActivity = () => {
    recoveryExportReturnPending.current = false;
    setRecoveryExportResumeReady(false);
    const lease = recoveryExportLifecycle.begin();
    return () => {
      lease.release();
      if (!recoveryExportReturnPending.current) setRecoveryExportResumeReady(true);
    };
  };
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
  const [deviceCredentialOnly, setDeviceCredentialOnly] = useState(false);
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
      if (onboardingSetupAuthorized.current) {
        onboardingSetupAuthorized.current = false;
        return Promise.resolve(true);
      }
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

  const resumeRecoveryAfterPicker = async (): Promise<boolean> => {
    const leaseId = recoveryExportLifecycle.pendingResume();
    if (leaseId === null) {
      if (recoveryExportReturnPending.current && secureSetupResolver.current) {
        // The bounded picker window expired. Safely return to the recovery step
        // so the user can authenticate and prepare a fresh kit.
        recoveryExportReturnPending.current = false;
        secureSetupResolver.current(false);
        sessionManager.lock();
        await CryptoService.lock().catch(() => undefined);
        setBiometricVerified(false);
        biometricAuthenticated.current = false;
        await confirmScreenshotResume().catch(() => undefined);
        setActivityResumeGuard(false);
        setRecoveryExportResumeReady(true);
      }
      return false;
    }
    if (recoveryExportResumeInFlight.current) return false;
    recoveryExportResumeInFlight.current = true;
    setRecoveryExportResumeReady(false);
    setBiometricAuthActive(true);
    try {
      await recoveryExportLockDrain.current?.catch(() => undefined);
      const before = await CryptoService.getKeyState();
      if (!before.metadataConsistent || !before.keyProvisioned || !before.keystoreAliasPresent ||
          before.recoveryNeedsRebind || before.recoveryProvisioned || !before.recoveryDeferred) {
        throw new Error('Recovery setup state changed while LifeOS was backgrounded. Encrypted data remains protected; restart this step to retry.');
      }
      await unlockEncryptedSession(CryptoService, sessionManager);
      const after = await CryptoService.getKeyState();
      if (!after.metadataConsistent || !after.keyProvisioned || !after.keystoreAliasPresent ||
          after.recoveryNeedsRebind || !after.unlocked || !(await CryptoService.isUnlocked()) ||
          !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) {
        throw new Error('LifeOS could not verify secure access after returning from the save picker. Your data remains locked.');
      }
      setBiometricMessage('');
      setBiometricVerified(true);
      setIsLocked(false);
      biometricAuthenticated.current = true;
      await confirmScreenshotResume();
      recoveryExportLifecycle.completeResume(leaseId);
      recoveryExportReturnPending.current = false;
      setActivityResumeGuard(false);
      setRecoveryExportResumeReady(true);
      return true;
    } catch (error) {
      sessionManager.lock();
      await CryptoService.lock().catch(() => undefined);
      setIsLocked(true);
      setBiometricVerified(false);
      biometricAuthenticated.current = false;
      setBiometricMessage(error instanceof Error ? error.message : 'Unlock was not completed. Recovery setup remains safely paused.');
      setRecoveryExportResumeReady(false);
      return false;
    } finally {
      recoveryExportResumeInFlight.current = false;
      setBiometricAuthActive(false);
    }
  };

  const sensitiveScreenshot = activityResumeGuard || profileOpen || isSensitiveScreenshotState({
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
  const bottomNavigationRef = useBottomNavigationInset();
  const [accountFormDraft, setAccountFormDraft] = useState<AccountDraft | null>(null);
  const [accountFormDirty, setAccountFormDirty] = useState(false);
  const [transferFormDraft, setTransferFormDraft] = useState<TransferDraft | null>(null);
  const [transferFormDirty, setTransferFormDirty] = useState(false);
  const [planningDrafts, setPlanningDrafts] = useState<MoneyPlanningDraftState>({ commitment: null, rate: null, commitmentDirty: false, rateDirty: false });
  const [financeWriteBusy, setFinanceWriteBusy] = useState(false);
  const financeWriteOperation = useRef(false);
  const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>([]);
  const [manualExchangeRates, setManualExchangeRates] = useState<ManualExchangeRate[]>([]);
  const [plannedCommitments, setPlannedCommitments] = useState<PlannedCommitment[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Subtab & Filter States
  const moneyPageRef = useRef<HTMLDivElement>(null);
  const moneyRoute = useRef({ depth: 0, section: 'overview' });
  const [financeSubtab, setFinanceSubtab] = useState<'overview' | 'monthly' | 'transactions' | 'accounts' | 'budgets' | 'savings' | 'planning' | 'analytics' | 'projection'>('overview');
  const [transactionDetailId, setTransactionDetailId] = useState<string | null>(null);
  const transactionDetailDialog = useRef<HTMLDialogElement>(null);
  const transactionDetail = activeTab === 'finance' ? transactions.find(row => row.id === transactionDetailId) : undefined;
  useEffect(() => {
    const dialog = transactionDetailDialog.current;
    if (transactionDetail && dialog && !dialog.open) dialog.showModal();
  }, [transactionDetail]);
  const [openMoneyTransferOnAccounts, setOpenMoneyTransferOnAccounts] = useState(false);
  const financeSubtabHistory = useRef<Array<typeof financeSubtab>>([]);
  const [financeMonth, setFinanceMonth] = useState<string>(formatLocalDate(new Date()).substring(0, 7));
  const activityFilterDialog = useRef<HTMLDialogElement>(null);
  const [activityRange, setActivityRange] = useState({ from: '', through: '', min: '', max: '' });
  const [financeTypeFilter, setFinanceTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [financeCategoryFilter, setFinanceCategoryFilter] = useState<string>('all');
  const [financeAccountFilter, setFinanceAccountFilter] = useState<string>('all');
  const [financeCurrencyFilter, setFinanceCurrencyFilter] = useState<string>('all');
  const [financeSearch, setFinanceSearch] = useState<string>('');
  const [financeSort, setFinanceSort] = useState<string>('date-desc');
  const [financeAnalyticsRange, setFinanceAnalyticsRange] = useState<3 | 6 | 12>(6);

  const [habitsSubtab, setHabitsSubtab] = useState<'checklist' | 'weekly' | 'monthly'>('checklist');
  const [habitsSelectedDate, setHabitsSelectedDate] = useState<string>(formatLocalDate(new Date()));
  const [historicalQuantityUnit, setHistoricalQuantityUnit] = useState('');

  const [goalsSubtab, setGoalsSubtab] = useState<'active' | 'paused' | 'completed' | 'archived'>('active');
  const [lifeDetail, setLifeDetail] = useState<{ kind: 'habit' | 'goal'; id: string } | null>(null);
  const [goalsCategoryFilter, setGoalsCategoryFilter] = useState<string>('all');

  const [plannerSubtab, setPlannerSubtab] = useState<'agenda' | 'weekly' | 'all'>('agenda');
  const [plannerFilter, setPlannerFilter] = useState<'all' | 'pending' | 'overdue' | 'completed' | 'today' | 'tomorrow' | 'upcoming' | 'unscheduled'>('all');
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
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const backState = useRef({ createKind, modalContent, plannerDetailTaskId, profileOpen, profileSection, activeTab, financeSubtab, habitsSubtab, goalsSubtab, appReady, onboardingRequired, onboardingComplete, isLocked, showExitConfirmation, accountFormDraft, accountFormDirty, transferFormDraft, transferFormDirty, planningDrafts, todayCustomizationOpen, lifeDetail });
  backState.current = { createKind, modalContent, plannerDetailTaskId, profileOpen, profileSection, activeTab, financeSubtab, habitsSubtab, goalsSubtab, appReady, onboardingRequired, onboardingComplete, isLocked, showExitConfirmation, accountFormDraft, accountFormDirty, transferFormDraft, transferFormDirty, planningDrafts, todayCustomizationOpen, lifeDetail };

  const navigateTo = (destination: MainTab, direction?: 'left' | 'right', velocity = 0) => {
    if (destination === 'settings') { openProfile(); return; }
    if (backState.current.profileOpen) closeProfile();
    const tab = destination === 'life' ? 'plan' : destination;
    const previous = activeTabRef.current;
    if (previous === tab) return;
    rememberActiveScroll();
    navigationHistory.current = pushTabHistory(navigationHistory.current, previous, tab);
    setShowExitConfirmation(false);
    transitionToTab(tab, direction, velocity);
  };

  const planPathHandler = useRef<(path: string) => void>(() => undefined);
  planPathHandler.current = path => {
    const destination = resolvePlanPath(path);
    if (!destination) return;
    setLifeDetail(null);
    navigateTo(destination);
  };
  useEffect(() => {
    if (!appReady || !onboardingComplete || isLocked) return;
    const handlePath = () => planPathHandler.current(window.location.hash || window.location.pathname);
    handlePath();
    window.addEventListener('hashchange', handlePath);
    return () => window.removeEventListener('hashchange', handlePath);
  }, [appReady, onboardingComplete, isLocked]);

  useEffect(() => {
    if (!appReady || isLocked || !onboardingComplete) return;
    const warmPlan = () => { void import('./components/PlanHub').catch(() => undefined); };
    if (typeof window.requestIdleCallback === 'function') {
      const request = window.requestIdleCallback(warmPlan);
      return () => window.cancelIdleCallback(request);
    }
    const timer = window.setTimeout(warmPlan, 500);
    return () => window.clearTimeout(timer);
  }, [appReady, isLocked, onboardingComplete]);

  const renderPlanNavigation = (selected: 'plan' | 'habits' | 'goals') => (
    <header className="plan-destination-header">
      <h1 className="type-page-title">Plan</h1>
      <nav aria-label="Plan destinations" className="plan-destinations">
        {([{ tab: 'plan', label: 'Tasks' }, { tab: 'habits', label: 'Habits' }, { tab: 'goals', label: 'Goals' }] as const).map(({ tab, label }) =>
          <button key={tab} type="button" aria-current={selected === tab ? 'page' : undefined} onClick={() => {
            if (tab === selected) return;
            setLifeDetail(null);
            setHabitsSubtab('checklist');
            setGoalsSubtab('active');
            setGoalsCategoryFilter('all');
            navigateTo(tab);
          }}>{label}</button>
        )}
      </nav>
    </header>
  );

  const clearGestureDrag = (animateBack: boolean, velocity = 0) => navigationMotion.endDrag(animateBack, velocity);

  const cancelPrimaryGesture = (reason: string, pointerId = swipePointer.current?.pointerId ?? -1) => {
    const session = swipePointer.current;
    if (session) recordGestureTrace({ event: 'interrupted', pointerId, deltaX: 0, deltaY: 0, state: session.axis, reason }, import.meta.env.DEV);
    swipePointer.current = null;
    releaseGestureCapture(pointerId);
    swipeOriginAction.current = null;
    if (swipeMoveFrame.current !== null) { window.cancelAnimationFrame(swipeMoveFrame.current); swipeMoveFrame.current = null; }
    clearGestureDrag(reason !== 'app-locked' && reason !== 'document-hidden');
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
      navigationMotion.cancel();
      cancelPrimaryGesture('window-resized');
      activeTouchPointers.current.clear();
      swipeSuppressed.current = false;
    };
    const cancelForBackground = () => {
      if (document.visibilityState !== 'visible') {
        navigationMotion.cancel();
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
    const cancelForSelection = () => {
      if (window.getSelection()?.isCollapsed === false) cancelPrimaryGesture('text-selection');
    };
    document.addEventListener('selectionchange', cancelForSelection);
    const cancelForContextMenu = () => cancelPrimaryGesture('context-menu');
    window.addEventListener('contextmenu', cancelForContextMenu);
    window.addEventListener('resize', cancelForEnvironmentChange, { passive: true });
    window.addEventListener('blur', cancelForBlur);
    document.addEventListener('visibilitychange', cancelForBackground);
    return () => {
      document.removeEventListener('selectionchange', cancelForSelection);
      window.removeEventListener('contextmenu', cancelForContextMenu);
      window.removeEventListener('resize', cancelForEnvironmentChange);
      window.removeEventListener('blur', cancelForBlur);
      document.removeEventListener('visibilitychange', cancelForBackground);
    };
  }, [interfaceMotion.preset, interfaceMotion.reducedMotion]);

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
    swipePointer.current = null;

    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const hardExcluded = target.closest('[data-no-tab-swipe],[data-swipe-exclude],[data-gesture-owner="native"],[role="dialog"],[aria-modal="true"],.ui-bottom-sheet,[data-horizontal-scroll],[role="slider"],input[type="range"]');
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
    const targetKind: PrimaryGestureTargetKind = textEntry || window.getSelection()?.isCollapsed === false ? 'text-entry'
      : nativePicker ? 'native-picker'
        : hardExcluded || horizontallyScrollable ? 'horizontal-control'
          : interactive ? 'ordinary-interactive' : 'content';
    const context = {
      enabled: userPrefs.swipeNavigationEnabled,
      pointerType: event.pointerType,
      settingsScreen: profileOpen,
      modalOpen: Boolean(createKind || modalContent || (activeTab === 'finance' && (financeSubtab === 'accounts' ? (accountFormDraft || transferFormDraft) : financeSubtab === 'planning' && (planningDrafts.commitment || planningDrafts.rate)))),
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
    if (start.axis === 'pending') swipeSamples.current = [{ x: start.startX, time: start.startedAt }];
    const update = updatePrimaryGesture(start, event.pointerId, event.clientX, event.clientY);
    swipePointer.current = update.session;
    swipeSamples.current = [...swipeSamples.current.slice(-7), { x: event.clientX, time: performance.now() }];
    recordGestureTrace({ event: 'pointermove', pointerId: event.pointerId, deltaX: update.deltaX, deltaY: update.deltaY, state: update.session.axis }, import.meta.env.DEV);
    if (update.session.axis === 'vertical') { clearGestureDrag(false); return; }
    if (update.session.axis === 'horizontal' && start.axis !== 'horizontal') {
      navigationMotion.beginDrag();
      // Capture only after horizontal intent is clear. A normal button tap and
      // browser-owned vertical scroll keep their native pointer/click lifecycle.
      try { gestureSurfaceElement.current?.setPointerCapture(event.pointerId); } catch { /* Window tracking remains active if capture is unavailable. */ }
    }
    if (!update.accepted || swipeMoveFrame.current !== null) return;
    swipeMoveFrame.current = window.requestAnimationFrame(() => {
      swipeMoveFrame.current = null;
      const current = swipePointer.current;
      if (current?.pointerId !== start.pointerId || current.axis !== 'horizontal') return;
      navigationMotion.moveDrag(current.latestOffsetX / .92);
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
    const velocity = estimateDragVelocity([...swipeSamples.current, { x: event.clientX, time: performance.now() }], interfaceMotion.preset);
    swipeSamples.current = [];
    swipePointer.current = null;
    if (target) {
      const originAction = swipeOriginAction.current;
      if (shouldSuppressPrimaryGestureClick(start) && originAction) {
        swipeClickSuppression.current = { pointerId: event.pointerId, target: originAction, expiresAt: performance.now() + 500 };
      }
      swipeOriginAction.current = null;
      navigateTo(target, deltaX < 0 ? 'left' : 'right', velocity);
    } else {
      if (shouldSuppressPrimaryGestureClick(start) && swipeOriginAction.current) {
        swipeClickSuppression.current = { pointerId: event.pointerId, target: swipeOriginAction.current, expiresAt: performance.now() + 500 };
      }
      swipeOriginAction.current = null;
      clearGestureDrag(true, velocity);
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
    // Touch starts with implicit capture on the child. Transferring ownership
    // to main emits loss on that child before main's gotpointercapture event.
    // Only a real loss of our owner should cancel the horizontal gesture.
    const owner = gestureSurfaceElement.current;
    if (!shouldCancelPrimaryCaptureLoss(event.target === owner, owner?.hasPointerCapture(event.pointerId) === true)) return;
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
      if (!session || event.pointerId === session.pointerId || !target || gestureSurfaceElement.current?.contains(target as Node)) return;
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

  const closeTaskDetail = () => {
    rememberActiveScroll();
    setPlannerDetailTaskId(null);
    const destination = taskDetailReturnTabRef.current;
    taskDetailReturnTabRef.current = null;
    if (!destination) return;
    if (navigationHistory.current[navigationHistory.current.length - 1] === destination) navigationHistory.current = navigationHistory.current.slice(0, -1);
    transitionToTab(destination, 'right');
  };

  const navigateBack = () => {
    const state = backState.current;
    if (typeof document !== 'undefined') {
      const scheduledDetail = document.querySelector<HTMLElement>('dialog[data-scheduled-details][open] [data-motion-back]');
      if (scheduledDetail) { scheduledDetail.click(); return; }
      const filterSheet = document.querySelector<HTMLDialogElement>('dialog[data-plan-filters][open],dialog[data-activity-filters][open],dialog[data-transaction-details][open],dialog[data-preference-choice][open]');
      if (filterSheet) { filterSheet.close(); return; }
      const contextualInfo = document.querySelector<HTMLDialogElement>('dialog[data-contextual-info="true"][open]');
      if (contextualInfo) { contextualInfo.close(); return; }
    }
    if (confirmationResolver.current) { settleConfirmation(false); return; }
    if (state.profileOpen && backupPassphraseResolver.current) { backupPassphraseResolver.current(null); return; }
    if (firstRecordSecurityResolver.current) { void setSensitiveScreenshotState(state.profileOpen).catch(() => undefined); firstRecordSecurityResolver.current(null); return; }
    if (state.profileOpen && !state.isLocked && !backupPrompt && !recoveryOpen && secureSetup === null) { backFromProfile(); return; }
    if (!state.isLocked && state.appReady && state.activeTab === 'finance' && ((state.financeSubtab === 'accounts' && (state.accountFormDraft || state.transferFormDraft)) || (state.financeSubtab === 'planning' && (state.planningDrafts.commitment || state.planningDrafts.rate)))) {
      void requestCloseFinanceDraft(); return;
    }
    if (!state.isLocked && state.appReady && !(state.onboardingRequired && !state.onboardingComplete) && state.activeTab === 'dashboard' && state.todayCustomizationOpen && !state.createKind && !state.modalContent) {
      closeTodayCustomization(); return;
    }
    if (!state.isLocked && state.appReady && !state.createKind && !state.modalContent && state.lifeDetail && (state.activeTab === 'habits' || state.activeTab === 'goals')) { showLifeDetail(null); return; }
    const action = resolveBackAction({ appReady: state.appReady, onboarding: state.onboardingRequired && !state.onboardingComplete, locked: state.isLocked, dialogOpen: Boolean(state.createKind || state.modalContent), exitDialogOpen: state.showExitConfirmation, taskDetailsOpen: state.activeTab === 'planner' && Boolean(state.plannerDetailTaskId), tab: state.activeTab, childViewOpen: (state.activeTab === 'finance' && state.financeSubtab !== 'overview') || (state.activeTab === 'habits' && state.habitsSubtab !== 'checklist') || (state.activeTab === 'goals' && state.goalsSubtab !== 'active') || (state.activeTab === 'settings' && state.profileSection !== 'home') }, navigationHistory.current.length > 0);
    if (action === 'ignore') return;
    if (action === 'exit-app') { void CapacitorApp.exitApp(); return; }
    if (action === 'dismiss-dialog') { requestCloseForm(); setModalContent(null); return; }
    if (action === 'dismiss-exit-dialog') { setShowExitConfirmation(false); return; }
    if (action === 'close-task-details') { closeTaskDetail(); return; }
    if (action === 'close-child-view') {
      if (state.activeTab === 'finance') {
        rememberActiveScroll();
        const previous = popTabHistory(financeSubtabHistory.current, 'overview');
        financeSubtabHistory.current = previous.history;
        setFinanceSubtab(previous.next);
      }
      if (state.activeTab === 'habits') { rememberActiveScroll(); setHabitsSubtab('checklist'); }
      if (state.activeTab === 'goals') { rememberActiveScroll(); setGoalsSubtab('active'); }
      return;
    }
    const history = popTabHistory(navigationHistory.current, 'dashboard');
    navigationHistory.current = history.history;
    const previous = history.next;
    if (action === 'previous-tab' && previous) {
      rememberActiveScroll();
      transitionToTab(previous, primaryDestinationForTab(previous) === primaryDestinationForTab(state.activeTab) ? 'right' : undefined);
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
        const recoveryPicker = secureSetupResolver.current
          ? recoveryExportLifecycle.markInactive()
          : null;
        if (recoveryPicker === null) secureSetupResolver.current?.(false);
        else {
          recoveryExportReturnPending.current = true;
          setRecoveryExportResumeReady(false);
        }
        setIsLocked(true);
        setBiometricVerified(false);
        biometricAuthenticated.current = false;
        authCoordinator.resetForBackground();
        // Close native admission even during setup, not only after migration.
        const lockOperation = encryptedSession.lock();
        if (recoveryPicker !== null) recoveryExportLockDrain.current = lockOperation;
        try { await lockOperation; }
        catch { setBiometricMessage('The native key could not be locked. Access remains blocked.'); }
        return;
      }
      if (resumeInProgress) return;
      resumeInProgress = true;
      if (secureSetupResolver.current && recoveryExportReturnPending.current) {
        try { await resumeRecoveryAfterPicker(); }
        finally { resumeInProgress = false; }
        return;
      }
      setBiometricAuthActive(true);
      try {
        // Wait for any previous background operation drain before reopening.
        await sessionManager.waitForIdle();
        if (disposed || !startupComplete.current) return;

        setClockNow(new Date());
        // A pristine first install may browse without private storage. Returning
        // from Android settings must not turn that safe browse into auth setup.
        if (safeFirstRunBrowse.current && !isEncryptedStorageActivated()) {
          const optionalLock = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
          setIsLocked(optionalLock);
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

  const navigateBackRef = useRef(navigateBack);
  navigateBackRef.current = navigateBack;
  useEffect(() => {
    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener('backButton', () => {
      if (!disposed) navigateBackRef.current();
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
    const update = (resolved: 'dark' | 'light') => { setTheme(resolved); applyDomTheme(resolved, themePreviewId || visualThemeId, customAccent); };
    const nativeTheme = (event: Event) => update((event as CustomEvent<{ dark: boolean }>).detail.dark ? 'dark' : 'light');
    window.addEventListener('lifeos:system-appearance', nativeTheme);
    const stopMedia = typeof (window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark === 'boolean'
      ? () => {}
      : watchSystemTheme(window.matchMedia('(prefers-color-scheme: dark)'), update);
    return () => { stopMedia(); window.removeEventListener('lifeos:system-appearance', nativeTheme); };
  }, [appearance, visualThemeId, themePreviewId, customAccent]);

  useEffect(() => {
    applyDomTheme(theme, themePreviewId || visualThemeId, customAccent);
  }, [theme, visualThemeId, themePreviewId, customAccent]);

  const activeScreenKey = screenScrollKey({
    tab: activeTab,
    financeSubtab,
    profileSection,
    goalsSubtab,
    habitsSubtab,
    detailKey: lifeDetail?.kind === (activeTab === 'habits' ? 'habit' : 'goal') ? lifeDetail.id : undefined,
  });

  const rememberActiveScroll = () => { scrollPositions.current[activeScreenKey] = window.scrollY; };
  const showLifeDetail = (detail: typeof lifeDetail) => { rememberActiveScroll(); setLifeDetail(detail); };
  const navigateProfileSection = (section: ProfileSection) => {
    if (profileSection === 'themes' && section !== 'themes' && themePreviewId) cancelVisualThemePreview();
    setProfileSection(section);
  };
  const openProfile = () => {
    closeTodayCustomization();
    navigationMotion.cancel();
    cancelPrimaryGesture('profile-opened');
    setShowExitConfirmation(false);
    if (backState.current.profileOpen) return;
    setProfileClosing(false);
    setProfileSection('home');
    setProfileOpen(true);
  };
  const closeProfile = () => {
    setProfileClosing(true);
  };
  const finishProfileClose = () => {
    navigateProfileSection('home');
    setProfileOpen(false);
    setProfileClosing(false);
  };
  const backFromProfile = () => {
    if (profileClosing) return;
    if (profileSection === 'home') closeProfile();
    else navigateProfileSection(profileParent(profileSection));
  };

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollPositions.current[activeScreenKey] || 0);
    root.style.scrollBehavior = previous;
  }, [activeScreenKey]);

  useLayoutEffect(() => {
    const depth = financeSubtabHistory.current.length;
    const previous = moneyRoute.current;
    moneyRoute.current = { depth, section: financeSubtab };
    const page = moneyPageRef.current;
    if (activeTab !== 'finance' || tabTransition || previous.section === financeSubtab || !page?.animate || interfaceMotion.reducedMotion) return;
    const direction = depth < previous.depth || financeSubtab === 'overview' ? -1 : 1;
    const flight = animateRoute(page, { x: direction * 46, opacity: .68 }, { x: 0, opacity: 1 }, interfaceMotion.preset);
    return () => flight.cancel();
  }, [activeTab, financeSubtab, interfaceMotion.reducedMotion]);

  useEffect(() => {
    if (!isLocked) return;
    cancelPrimaryGesture('app-locked');
    activeTouchPointers.current.clear();
    swipeSuppressed.current = false;
    swipeClickSuppression.current = null;
    navigationMotion.cancel();
  }, [isLocked, navigationMotion.cancel]);

  useLayoutEffect(() => {
    if (!lifeDetail || interfaceMotion.reducedMotion) return;
    const detail = document.querySelector<HTMLElement>(`[aria-labelledby="${lifeDetail.kind}-detail-title"]`);
    if (!detail) return;
    const animation = animateRoute(detail, { x: 44, opacity: .86 }, { x: 0, opacity: 1 }, interfaceMotion.preset);
    return () => animation.cancel();
  }, [lifeDetail, interfaceMotion.preset, interfaceMotion.reducedMotion]);

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

  const closeTodayCustomization = () => setTodayCustomizationOpen(false);
  const dismissTodayCustomizationBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeTodayCustomization();
  };
  useEffect(() => {
    if (activeTab !== 'dashboard' || isLocked) setTodayCustomizationOpen(false);
  }, [activeTab, isLocked]);

  const todaySectionStyle = (id: TodaySectionId): React.CSSProperties => ({
    order: todayLayout.order.indexOf(id) + 2,
    display: todayLayout.hidden.includes(id) || (id === 'habits' && !habits.length) || (id === 'goals' && !goals.some(goal => goal.status === 'In Progress' && !goal.archived)) || (id === 'upcoming' && !tasks.some(task => !task.completed && task.dueDate && task.dueDate > formatLocalDate(clockNow))) || (id === 'agenda' && !tasks.some(task => task.dueDate === formatLocalDate(clockNow) || getTaskStatus(task, clockNow) === 'Overdue')) || (id === 'money' && !transactions.length) ? 'none' : undefined,
  });

  const requestCloseForm = () => {
    if (createOperation.current) return;
    if (!backState.current.createKind) return;
    const close = () => {
      setCreateKind(null); setEditingTaskId(null); setEditingHabitId(null); setEditingTransactionId(null); setEditingGoalId(null); setEditingContributionId(null); setEditingSavingsGoalId(null); setEditingBudgetId(null); setEditingBudgetId(null); setCreateFormDirty(false);
    };
    if (!createFormDirty) { close(); return; }
    void confirmAction({ title: 'Discard unsaved changes?', message: 'Your edits have not been saved.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true }).then(confirmed => { if (confirmed) close(); });
  };

  const requestCloseFinanceDraft = async () => {
    if (financeWriteOperation.current) return;
    const state = backState.current;
    const account = state.financeSubtab === 'accounts' && state.accountFormDraft;
    const transfer = state.financeSubtab === 'accounts' && state.transferFormDraft;
    const dirty = account ? state.accountFormDirty : transfer ? state.transferFormDirty : state.planningDrafts.commitment ? state.planningDrafts.commitmentDirty : state.planningDrafts.rateDirty;
    if (dirty && !(await confirmAction({ title: 'Discard unsaved changes?', message: 'Your edits have not been saved.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true }))) return;
    if (account) { setAccountFormDraft(null); setAccountFormDirty(false); }
    else if (transfer) { setTransferFormDraft(null); setTransferFormDirty(false); }
    else setPlanningDrafts({ commitment: null, rate: null, commitmentDirty: false, rateDirty: false });
  };
  const financeDialogOpen = activeTab === 'finance' && (financeSubtab === 'accounts' ? Boolean(accountFormDraft || transferFormDraft) : financeSubtab === 'planning' && Boolean(planningDrafts.commitment || planningDrafts.rate));
  const recordDialogId = createKind ? 'record-dialog' : financeSubtab === 'accounts'
    ? (transferFormDraft ? 'money-transfer-dialog' : 'money-account-dialog')
    : planningDrafts.commitment ? 'money-commitment-dialog' : 'money-rate-dialog';
  useRecordDialog(Boolean(createKind || financeDialogOpen) && !isLocked && !firstRecordSecurityOpen && secureSetup === null,
    () => { if (createKind) requestCloseForm(); else void requestCloseFinanceDraft(); }, recordDialogId);
  useRecordDialog(todayCustomizationOpen && activeTab === 'dashboard' && !isLocked && !createKind && !modalContent && !firstRecordSecurityOpen && secureSetup === null,
    closeTodayCustomization, 'today-customization');

  const navigateFinanceSubtab = (next: typeof financeSubtab) => {
    if (next === financeSubtab) return;
    rememberActiveScroll();
    financeSubtabHistory.current = pushTabHistory(financeSubtabHistory.current, financeSubtab, next);
    setFinanceSubtab(next);
  };

  const saveUserPreference = async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const updated = { ...userPrefs, [key]: value };
    try {
      await StorageService.settings.set('userPreferences', updated);
      setUserPrefs(updated);
    } catch { showToast('Could not save this preference.', 'danger'); }
  };

  const initApp = async () => {
    // Bootstrap-safe preferences only.
    const savedTheme = await StorageService.settings.get<AppearancePreference>('theme', 'system');
    const savedVisualTheme = await resolveInitialVisualTheme(() => StorageService.settings.get('visualTheme', visualThemeId));
    let cachedAccent: string | undefined;
    try { cachedAccent = normalizeCustomAccent(localStorage.getItem('lifeos-custom-accent')); } catch { /* Cosmetic cache is optional. */ }
    let accentTimer: ReturnType<typeof setTimeout> | number | undefined;
    let storedAccent: unknown;
    try {
      storedAccent = await Promise.race([
        Promise.resolve().then(() => StorageService.settings.get('customAccent', null)),
        new Promise<undefined>(resolve => { accentTimer = setTimeout(resolve, 1500); }),
      ]);
    } catch { storedAccent = undefined; }
    finally { if (accentTimer !== undefined) clearTimeout(accentTimer); }
    const savedAccent = storedAccent === undefined ? cachedAccent : normalizeCustomAccent(storedAccent);
    setCustomAccent(savedAccent);
    setVisualThemeId(savedVisualTheme);
    setAppearancePreference(savedTheme);
    const resolvedTheme = resolveAppearance(savedTheme, systemDarkPreference());
    setTheme(resolvedTheme);
    applyDomTheme(resolvedTheme, savedVisualTheme, savedAccent);
    try { localStorage.setItem('lifeos-theme-id', savedVisualTheme); } catch { /* Cosmetic cache is optional. */ }
    try {
      if (savedAccent) localStorage.setItem('lifeos-custom-accent', savedAccent);
      else localStorage.removeItem('lifeos-custom-accent');
    } catch { /* Cosmetic cache is optional. */ }
    localStorage.setItem('lifeos-appearance', savedTheme);

    setDateOnlyAlertTime(await StorageService.settings.get<string>('dateOnlyAlertTime', ''));
    setNotificationTone(normalizeNotificationTone(await StorageService.settings.get('notificationTone', 'warm')));
    const lockSetting = await StorageService.settings.get<boolean>('biometricLockEnabled', false);
    setBiometricEnabled(lockSetting);
    setIsLocked(lockSetting);

    const availability = await BiometricService.isAvailable();
    setDeviceCredentialOnly(availability.isAvailable && availability.deviceCredentialAvailable === true && availability.strongBiometricAvailable === false);
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
    const storedOnboardingJourney = await StorageService.settings.get<unknown>('onboardingJourney', null);
    const normalizedJourney = normalizeOnboardingJourney(storedOnboardingJourney);
    setOnboardingJourney(normalizedJourney);
    const legacyStep = await StorageService.settings.get<number>('onboardingStep', 0);
    const previousVersion = (storedOnboardingJourney as { version?: number } | null)?.version;
    const savedOnboardingStep = resumeOnboardingStep(legacyStep, previousVersion);
    if (!completed && started && savedOnboardingStep !== legacyStep) await StorageService.settings.set('onboardingStep', savedOnboardingStep);

    const nativeState = await CryptoService.getKeyState();
    const hasCiphertext = await hasEncryptedRecords();
    const hasExistingPrivateRows = await hasPrivateRows();
    const safeFirstRunState = nativeState.metadataConsistent && !nativeState.keyProvisioned &&
      !nativeState.recoveryProvisioned && !nativeState.recoveryDeferred &&
      (!nativeState.keystoreAliasPresent || nativeState.initialSetupPending === true) &&
      !nativeState.unlocked && !nativeState.recoveryNeedsRebind && !hasCiphertext && !hasExistingPrivateRows;
    if (safeFirstRunState) {
      if (!completed && JSON.stringify(storedOnboardingJourney) !== JSON.stringify(normalizedJourney)) {
        // Persist removal of legacy optional skip values so restart resumes the
        // same required stage instead of repeatedly interpreting stale choices.
        await StorageService.settings.set('onboardingJourney', normalizedJourney);
      }
      // Empty installs and explicitly interrupted initial setup may browse
      // without private storage; the first private write resumes setup.
      safeFirstRunBrowse.current = true;
      startupComplete.current = true;
      setIsLocked(lockSetting);
      setBiometricVerified(false);
      setRecoveryProvisioned(false);
      setRecoveryDeferred(false);
      setDisplayName(await StorageService.settings.get<string>('onboardingNameDraft', ''));
      setOnboardingRequired(!completed);
      setOnboardingComplete(completed);
      setOnboardingStep(savedOnboardingStep);
      if (!started && !completed) await StorageService.settings.set('onboardingStarted', true);
      await reconcileNotificationPreferences();
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
    const onboardingNameDraft = await StorageService.settings.get<string>('onboardingNameDraft', '');
    if (onboardingNameDraft) {
      // The draft is bootstrap-only. Once the native key is active, promote it
      // to the encrypted profile setting before exposing the private workspace.
      await StorageService.settings.set('displayName', onboardingNameDraft);
      await StorageService.settings.delete('onboardingNameDraft');
    }
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
    const hasEnabledCategory = Object.values(savedNotificationPreferences).some(Boolean);
    const notificationsOn = savedNotificationsEnabled ?? hasEnabledCategory;
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
    setOnboardingStep(savedOnboardingStep);

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
    applyDomTheme(resolved, themePreviewId || visualThemeId, customAccent);
    await StorageService.settings.set('theme', preference);
    localStorage.setItem('lifeos-appearance', preference);
  };

  const previewVisualTheme = (themeId: ThemeId) => {
    setThemePreviewId(themeId);
    applyDomTheme(theme, themeId, customAccent);
  };

  const cancelVisualThemePreview = () => {
    setThemePreviewId(null);
    applyDomTheme(theme, visualThemeId, customAccent);
  };

  const applyVisualTheme = async () => {
    if (!themePreviewId) return;
    try {
      await StorageService.settings.set('visualTheme', themePreviewId);
      setVisualThemeId(themePreviewId);
      try { localStorage.setItem('lifeos-theme-id', themePreviewId); } catch { /* Persistent setting remains authoritative. */ }
      setThemePreviewId(null);
      applyDomTheme(theme, themePreviewId, customAccent);
      showToast('Color theme applied', 'success');
    } catch (error) {
      cancelVisualThemePreview();
      showToast(error instanceof Error ? error.message : 'Could not save this theme.', 'danger');
    }
  };

  const applyCustomAccent = async (color: string | undefined) => {
    const normalized = normalizeCustomAccent(color);
    if (color !== undefined && !normalized) {
      showToast('Choose a color in #RRGGBB format.', 'danger');
      return;
    }
    const save = customAccentSaveQueue.current.then(async () => {
      await StorageService.settings.set('customAccent', normalized ?? null);
      setCustomAccent(normalized);
      try {
        if (normalized) localStorage.setItem('lifeos-custom-accent', normalized);
        else localStorage.removeItem('lifeos-custom-accent');
      } catch { /* Persistent cosmetic setting remains authoritative. */ }
      showToast(normalized ? 'Accent color applied' : 'Palette accent restored', 'success');
    });
    // Keep later choices usable after a failed write without applying it.
    customAccentSaveQueue.current = save.catch(() => {});
    try { await save; }
    catch { showToast('Could not save this accent color. Try again.', 'danger'); }
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
        await NotificationService.requestPermission();
        status = await NotificationService.checkPermission();
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

  const acceptOnboardingNotifications = async () => {
    const permission = await askNotificationPermission();
    await refreshNotificationDiagnostics();
    if (!permission.granted) throw new Error(permission.message || 'Android has not allowed notifications.');
    const saved = await StorageService.settings.get<NotificationPreferences | undefined>('notificationPreferences', undefined);
    const preferences = saved ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...saved } : FIRST_CONSENT_NOTIFICATION_PREFERENCES;
    await saveNotificationSelection(preferences, true);
    await syncNotificationSchedules(tasks, habits, goals, milestones, preferences);
  };

  const saveNotificationSelection = async (preferences: NotificationPreferences, enabled = Object.values(preferences).some(Boolean)) => {
    await StorageService.settings.set('notificationPreferences', preferences);
    await StorageService.settings.set('notificationsEnabled', enabled);
    setNotificationPreferences(preferences);
    setNotificationsEnabled(enabled);
  };

  const syncNotificationSchedules = async (taskRows: Task[], habitRows: Habit[], goalRows: Goal[], milestoneRows: Milestone[], preferences = effectiveNotificationPreferences(notificationPreferences, notificationsEnabled)) => {
    const dateOnlyAlertTime = typeof StorageService.settings.get === 'function' ? await StorageService.settings.get<string>('dateOnlyAlertTime', '') : undefined;
    const tone = normalizeNotificationTone(await StorageService.settings.get?.('notificationTone', 'warm'));
    const results = await Promise.allSettled([
      NotificationService.syncTasks(taskRows, preferences, dateOnlyAlertTime, tone),
      NotificationService.syncHabits(habitRows, preferences, tone),
      NotificationService.syncMilestones(goalRows, milestoneRows, preferences, tone),
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
    await StorageService.settings.set('displayName', normalized);
    setDisplayName(normalized);
  };

  const toggleNotificationCategory = async (key: keyof NotificationPreferences) => {
    const enabled = !notificationPreferences[key];
    if (enabled) {
      const permission = await askNotificationPermission();
      if (!permission.granted) { showToast(permission.message || `Notification permission: ${permission.status}`, 'danger'); return; }
    }
    const next = { ...notificationPreferences, [key]: enabled };
    try {
      await saveNotificationSelection(next, notificationsEnabled);
      const synchronized = await syncNotificationSchedules(tasks, habits, goals, milestones, effectiveNotificationPreferences(next, notificationsEnabled));
      if (!synchronized) showToast('Saved, but Android could not update some alerts.', 'danger');
    } catch { showToast('Could not save this notification preference.', 'danger'); }
  };

  const setNotificationsMaster = async (enabled: boolean) => {
    if (enabled) {
      const permission = await askNotificationPermission();
      if (!permission.granted) { showToast(permission.message || `Notification permission: ${permission.status}`, 'danger'); return; }
    }
    try {
      const saved = await StorageService.settings.get<NotificationPreferences | undefined>('notificationPreferences', undefined);
      const preferences = enabled && !saved ? FIRST_CONSENT_NOTIFICATION_PREFERENCES : notificationPreferences;
      await saveNotificationSelection(preferences, enabled);
      const synchronized = await syncNotificationSchedules(tasks, habits, goals, milestones, effectiveNotificationPreferences(preferences, enabled));
      if (!synchronized) showToast('Saved, but Android could not update some alerts.', 'danger');
      else showToast(enabled ? 'Notifications enabled' : 'Notifications paused', 'success');
    } catch { showToast('Could not save notifications.', 'danger'); }
  };

  const openNotificationSettings = async () => {
    try { await NotificationService.openSettings(); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Could not open Android notification settings', 'danger'); }
  };

  const requestExactAlarmAccess = async () => {
    try {
      const result = await NotificationService.requestExactAlarmPermission();
      await refreshNotificationDiagnostics();
      if (result === 'granted') {
        const synchronized = await syncNotificationSchedules(tasks, habits, goals, milestones);
        if (!synchronized) { showToast('Precise access is on, but some reminders could not be updated.', 'danger'); return; }
        showToast('Exact alarm access is available for eligible reminders.', 'success');
      } else {
        showToast('Exact alarm access is off. Android may delay reminders; your saved reminders remain in place.', 'info');
      }
    } catch (error) {
      await refreshNotificationDiagnostics();
      showToast(error instanceof Error ? error.message : 'Could not open exact alarm access settings.', 'danger');
    }
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

  const saveOnboardingIdentity = async (name: string) => {
    const normalized = name.trim().slice(0, 48);
    if (!normalized) throw new Error('Enter your name to continue.');
    await StorageService.settings.set('onboardingNameDraft', normalized);
    setDisplayName(normalized);
  };

  const provisionOnboardingProtection = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const before = await CryptoService.getKeyState();
      if (!before.metadataConsistent || before.recoveryNeedsRebind) {
        throw new Error('LifeOS found an existing key that needs recovery. No key was replaced. Open recovery or retry after restoring access.');
      }
      await setSensitiveScreenshotState(true);
      onboardingSetupAuthorized.current = true;
      await encryptedSession.open({ recoveryChoice: 'later' });
      const state = await CryptoService.getKeyState();
      if (!state.metadataConsistent || !state.keyProvisioned || !state.keystoreAliasPresent ||
          !state.unlocked || !state.recoveryDeferred || state.recoveryProvisioned ||
          !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) {
        throw new Error('LifeOS could not verify encrypted storage. Your records remain locked; please retry.');
      }

      const draftName = await StorageService.settings.get<string>('onboardingNameDraft', '');
      if (!draftName.trim()) throw new Error('Your name is missing. Return to the first step and enter it again.');
      await StorageService.settings.set('displayName', draftName.trim());
      await StorageService.settings.delete('onboardingNameDraft');
      setDisplayName(draftName.trim());
      setRecoveryProvisioned(false);
      setRecoveryDeferred(true);
      setBiometricEnabled(true);
      setBiometricVerified(true);
      biometricAuthenticated.current = true;
      setIsLocked(false);
      safeFirstRunBrowse.current = false;
      await StorageService.settings.set('biometricLockEnabled', true);
      await reloadAllData();
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Secure setup did not complete. Your data remains locked; please retry.' };
    } finally {
      onboardingSetupAuthorized.current = false;
    }
  };

  const confirmOnboardingRecovery = async (label: string): Promise<boolean> => {
    try {
      if (!sessionManager.isUnlocked() || !isEncryptedStorageActivated() || !(await CryptoService.isUnlocked())) {
        await encryptedSession.open();
      }
      let state = await CryptoService.getKeyState();
      if (state.recoveryProvisioned && state.metadataConsistent && !state.recoveryDeferred &&
          state.keyProvisioned && state.unlocked && isEncryptedStorageActivated()) {
        setRecoveryProvisioned(true); setRecoveryDeferred(false);
        return true;
      }
      if (!state.metadataConsistent || !state.keyProvisioned || !state.recoveryDeferred || state.recoveryNeedsRebind) {
        throw new Error('Recovery setup is not ready. Encrypted data remains protected; retry secure setup.');
      }
      const prepared = await CryptoService.prepareRecovery();
      if (!(await requestSecureSetup(prepared))) {
        await CryptoService.cancelPendingRecovery();
        return false;
      }
      await CryptoService.confirmRecovery();
      state = await CryptoService.getKeyState();
      if (!state.metadataConsistent || !state.keyProvisioned || !state.recoveryProvisioned ||
          state.recoveryDeferred || state.recoveryNeedsRebind || !state.unlocked ||
          !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) {
        throw new Error('The recovery kit was not verified. Your private workspace remains closed.');
      }
      setRecoveryProvisioned(true); setRecoveryDeferred(false);
      // The component stores this optional label in onboardingJourney. It is
      // metadata only and is never used as a recovery secret.
      void label;
      return true;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Recovery setup could not be verified. Please retry.');
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

  const reconcileNotificationPreferences = async () => {
    const saved = await StorageService.settings.get<NotificationPreferences | undefined>('notificationPreferences', undefined);
    if (saved) setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...saved });
    const enabled = await StorageService.settings.get<boolean>('notificationsEnabled', Object.values(saved || {}).some(Boolean));
    setNotificationsEnabled(Boolean(enabled));
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...saved };
  };

  const finishOnboarding = async () => {
    if (!safeFirstRunBrowse.current && !sessionManager.isUnlocked()) await encryptedSession.open();
    const [state, savedJourney, nameDraft] = await Promise.all([
      CryptoService.getKeyState(),
      StorageService.settings.get<OnboardingJourney>('onboardingJourney', INITIAL_ONBOARDING_JOURNEY),
      StorageService.settings.get<string>('onboardingNameDraft', '')
    ]);
    const safeToBrowse = !state.keyProvisioned && safeFirstRunBrowse.current && !state.recoveryNeedsRebind;
    const secureWorkspaceOpen = state.metadataConsistent && state.keyProvisioned && state.unlocked &&
      !state.recoveryNeedsRebind && (state.recoveryProvisioned || state.recoveryDeferred) &&
      sessionManager.isUnlocked() && isEncryptedStorageActivated();
    const savedName = secureWorkspaceOpen
      ? await StorageService.settings.get<string>('displayName', '')
      : '';
    const identityName = nameDraft.trim() || savedName.trim();
    if ((!safeToBrowse && !secureWorkspaceOpen) || !identityName)
      throw new Error('LifeOS could not verify the workspace state. No protected records were opened.');
    if (secureWorkspaceOpen && nameDraft.trim()) {
      await StorageService.settings.set('displayName', identityName);
      await StorageService.settings.delete('onboardingNameDraft');
    }
    const completedJourney: OnboardingJourney = {
      ...normalizeOnboardingJourney(savedJourney),
      stage: 'recovery',
      protection: state.keyProvisioned ? 'enabled' : 'pending',
      recovery: state.recoveryProvisioned ? 'confirmed' : 'pending',
    };
    await StorageService.settings.set('onboardingJourney', completedJourney);
    setOnboardingJourney(completedJourney);
    await StorageService.settings.set('notificationDefaultsPending', false);
    await StorageService.settings.set('onboardingCompleted', true);
    await StorageService.settings.set('onboardingStarted', false);
    await StorageService.settings.set('onboardingStep', 0);
    setOnboardingStep(0);
    setOnboardingComplete(true); setOnboardingRequired(false); navigationHistory.current = []; transitionToTab('dashboard');
  };

  const processPendingTaskNotification = async () => {
    const action = pendingNotification.current;
    if (!action || reminderProcessing.current || !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) return;
    reminderProcessing.current = true;
    const extra = action.notification.extra || {};
    try {
      let opened = false;
      if (typeof extra.taskId === 'string') {
        const task = (await StorageService.tasks.getAll()).find(item => item.id === extra.taskId);
        if (task) {
          opened = true;
          if (action.actionId === 'lifeos-task-done') {
            if (!task.completed) await StorageService.tasks.toggleCompleted(task.id, true);
            const records = await reloadAllData();
            const preferences = await StorageService.settings.get('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
            const master = await StorageService.settings.get('notificationsEnabled', Object.values(preferences).some(Boolean));
            await NotificationService.cancelTask(task);
            const refreshed = await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones,
              effectiveNotificationPreferences(preferences, master));
            showToast(refreshed ? 'Task marked done' : 'Task marked done. Some reminders could not refresh.', refreshed ? 'success' : 'danger');
          } else if (action.actionId === 'lifeos-task-snooze') {
            const enabled = await StorageService.settings.get('notificationsEnabled', false);
            const preferences = await StorageService.settings.get('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
            if (!enabled || !preferences.taskReminders) throw new Error('Turn on task reminders before snoozing.');
            const tone = normalizeNotificationTone(await StorageService.settings.get('notificationTone', 'warm'));
            if (await NotificationService.snoozeTask(task, tone)) showToast('Reminder snoozed for 10 minutes', 'success');
          } else {
            taskDetailReturnTabRef.current = activeTabRef.current === 'planner' ? null : activeTabRef.current;
            taskDetailReturnFocusRef.current = null;
            navigateTo('planner');
            setPlannerSelectedDate(task.dueDate || formatLocalDate(new Date()));
            setPlannerDetailTaskId(task.id);
          }
        }
      } else if (typeof extra.habitId === 'string') {
        const habit = (await StorageService.habits.getAll()).find(item => item.id === extra.habitId);
        if (habit) { setHabitsSelectedDate(formatLocalDate(new Date())); setLifeDetail({ kind: 'habit', id: habit.id }); navigateTo('habits'); opened = true; }
      } else if (extra.kind === 'milestoneReminder') {
        const milestone = (await StorageService.goals.getAllMilestones()).find(item => item.id === extra.milestoneId);
        if (milestone && (await StorageService.goals.getAll()).some(goal => goal.id === milestone.goalId)) {
          setLifeDetail({ kind: 'goal', id: milestone.goalId }); navigateTo('goals'); opened = true;
        }
      }
      if (!opened) showToast('That reminder no longer has an available record.', 'info');
      await NotificationService.acknowledgeInitialTapAction(action.notification.id);
    } catch (error) {
      handledNotificationIds.current.delete(action.notification.id);
      showToast(error instanceof Error ? error.message : 'Could not open that reminder.', 'danger');
    } finally {
      reminderProcessing.current = false;
      if (pendingNotification.current === action) pendingNotification.current = null;
      else if (pendingNotification.current) void processPendingTaskNotification();
    }
  };

  useEffect(() => {
    if (appReady && !isLocked && typeof processPendingTaskNotification === 'function') void processPendingTaskNotification();
  }, [appReady, isLocked]);

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
    const handleAction = (action: ReminderAction) => {
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
      pendingNotification.current = action;
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
        if (safeFirstRunBrowse.current && !isEncryptedStorageActivated()) {
          // Optional app protection never provisions or admits private storage.
          const result = await BiometricService.authenticate('Unlock LifeOS', 'Use your phone’s secure unlock');
          if (!result.success) throw new Error(result.message || 'Authentication was not completed.');
          biometricAuthenticated.current = true;
          setBiometricVerified(true); setIsLocked(false); setBiometricMessage('');
          return true;
        }
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
    const [txs, cats, bgs, sgs, scs, accounts, transfers, rates, commitments, hbs, hLogs, gls, mls, tks, storedPhoto] = await Promise.all([
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
      StorageService.tasks.getAll(),
      isEncryptedStorageActivated() && sessionManager.isUnlocked() ? StorageService.settings.get<unknown>(PROFILE_PHOTO_SETTING, null) : null,
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
    setProfilePhoto(readProfilePhoto(storedPhoto));
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

  const handleHabitQuantity = async (habit: Habit, date: string, delta: number) => {
    try {
      const next = await StorageService.habits.adjustQuantity(habit.id, date, delta);
      await reloadAllData();
      showToast(`${habit.name}: ${formatHabitQuantity(next, habit.quantityUnit)} / ${formatHabitQuantity(habit.targetPerDay || 0, habit.quantityUnit)}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update habit progress.', 'danger');
    }
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
      title: '', amount: '', category: kind === 'transaction' ? (categories.find(category => category.type === 'expense')?.name || '') : kind === 'goal' ? 'Other' : '', date: kind === 'task' || kind === 'goal' ? taskDate || '' : taskDate || today, month: financeMonth,
      dateTime: formatLocalDateTime(now), time: '', reminderAt: '', description: '', notes: '',
      currencyCode: userPrefs.currency, accountId: '', type: 'expense', priority: 'Medium', frequency: 'daily', target: '', current: '0', unit: '',
      goalId: goalId || '', recurring: 'None', reminderWeekday: '2', trackingMode: 'binary', quantityUnit: '',
    });
    setEditingTaskId(null);
    setEditingHabitId(null);
    setEditingTransactionId(null);
    setEditingGoalId(null);
    setEditingContributionId(null);
    setEditingSavingsGoalId(null);
    setEditingBudgetId(null);
    setTransactionDetailsOpen(false);
    setCreateKind(kind);
  };

  const openEditBudget = (budget: Budget) => {
    setCreateFormDirty(false);
    setEditingBudgetId(budget.id);
    setCreateDraft({ categoryId: budget.categoryId || '', amount: budget.amountMinor && budget.currencyCode ? minorUnitsToDecimal(BigInt(budget.amountMinor), budget.currencyCode) : String(budget.monthlyAmount), month: budget.monthYear, currencyCode: budget.currencyCode || userPrefs.currency, carryover: budget.carryover ? 'yes' : 'no' });
    setCreateKind('budget');
  };

  const openEditTransaction = (transaction: Transaction) => {
    setCreateFormDirty(false);
    setCreateDraft({
      title: transaction.description || '', amount: transaction.amountMinor !== undefined && transaction.currencyCode ? minorUnitsToDecimal(BigInt(transaction.amountMinor), transaction.currencyCode) : String(transaction.amount), category: transaction.category,
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
    setCreateDraft({ title: goal.title, target: goal.targetAmountMinor && goal.currencyCode ? minorUnitsToDecimal(BigInt(goal.targetAmountMinor), goal.currencyCode) : String(goal.targetAmount), current: goal.currentAmountMinor && goal.currencyCode ? minorUnitsToDecimal(BigInt(goal.currentAmountMinor), goal.currencyCode) : String(goal.currentAmount), currencyCode: goal.currencyCode || userPrefs.currency, category: goal.category || '', date: goal.targetDate });
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
    setCreateDraft(current => buildDuplicateTransactionDraft(current, transaction, financialAccounts));
  };

  const openEditGoal = (goal: Goal) => {
    setCreateFormDirty(false);
    const oldUnit = goal.unit || '';
    const selectedUnit = ['km', 'mi', 'mile', 'miles'].includes(oldUnit) ? userPrefs.distance
      : ['L', 'l', 'mL', 'US gal', 'Imp gal'].includes(oldUnit) ? userPrefs.volume
        : ['km/h', 'm/s', 'mph'].includes(oldUnit) ? userPrefs.speed : oldUnit;
    const target = oldUnit && selectedUnit !== oldUnit ? convertMeasurement(goal.targetValue, oldUnit, selectedUnit) : goal.targetValue;
    const current = oldUnit && selectedUnit !== oldUnit ? convertMeasurement(goal.currentValue, oldUnit, selectedUnit) : goal.currentValue;
    setCreateDraft({ title: goal.title, category: goal.category, target: String(target), current: String(current), unit: selectedUnit, date: goal.targetDate, startDate: goal.startDate, priority: goal.priority, status: goal.status, goalMode: goal.mode || 'accumulate', baselineValue: goal.baselineValue === undefined ? '' : String(oldUnit && selectedUnit !== oldUnit ? convertMeasurement(goal.baselineValue, oldUnit, selectedUnit) : goal.baselineValue), description: goal.description || '' });
    setEditingGoalId(goal.id); setEditingTaskId(null); setEditingHabitId(null); setEditingTransactionId(null); setCreateKind('goal');
  };

  const openEditTask = (task: Task) => {
    setCreateFormDirty(false);
    setCreateDraft({
      title: task.title, description: task.description || task.notes || '', date: task.dueDate || '',
      time: task.dueTime || '', dueAlert: task.dueAlertDisabled ? 'off' : 'on', reminderLead: task.reminderLeadMinutes ? String(task.reminderLeadMinutes) : task.reminderAt ? 'legacy' : '', reminderAt: task.reminderAt ? formatLocalDateTime(new Date(task.reminderAt)) : '',
      priority: task.priority, category: task.category || '', goalId: goals.some(goal => goal.id === task.goalId) ? task.goalId! : '', recurring: task.recurring || 'None',
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
    setCreateDraft({ title: habit.name, description: habit.description || '', targetPerDay: habit.targetPerDay === undefined ? '' : String(habit.targetPerDay), trackingMode: habit.trackingMode || 'binary', quantityUnit: habit.quantityUnit || '', goalId: goals.some(goal => goal.id === habit.goalId) ? habit.goalId! : '', frequency: habit.frequency, weekdays: habit.schedule?.[habit.schedule.length - 1]?.weekdays.join(',') || '', weeklySessions: String(habit.schedule?.[habit.schedule.length - 1]?.sessionsPerWeek || ''), reminderTime: habit.reminderTime || '', reminderWeekday: String(habit.reminderWeekday || 2) });
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
    const pendingName = await StorageService.settings.get<string>('onboardingNameDraft', '');
    if (pendingName.trim()) {
      await StorageService.settings.set('displayName', pendingName.trim());
      await StorageService.settings.delete('onboardingNameDraft');
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

  const changeProfilePhoto = async (remove = false) => {
    if (profilePhotoOperation.current) return;
    profilePhotoOperation.current = true;
    setProfilePhotoBusy(true);
    setProfilePhotoError('');
    let selected = false;
    try {
      if (remove) {
        await StorageService.settings.delete(PROFILE_PHOTO_SETTING);
        setProfilePhoto(null);
      } else {
        const file = await pickProfilePhoto();
        if (file) { selected = true; setPendingProfilePhoto(file); }
      }
    } catch { setProfilePhotoError('Could not change your profile photo. Try again.'); }
    finally {
      if (!selected) { profilePhotoOperation.current = false; setProfilePhotoBusy(false); }
    }
  };

  useEffect(() => {
    if (!pendingProfilePhoto || !appReady || isLocked || activityResumeGuard) return;
    setPendingProfilePhoto(null);
    void (async () => {
      try {
        const photo = await prepareProfilePhoto(pendingProfilePhoto);
        await ensurePrivateStorageBeforeWrite();
        if (!sessionManager.isUnlocked() || !isEncryptedStorageActivated()) throw new Error('Unlock LifeOS and choose your photo again.');
        await StorageService.settings.set(PROFILE_PHOTO_SETTING, photo);
        setProfilePhoto(photo);
        showToast('Profile photo saved', 'success');
      } catch (error) { setProfilePhotoError(error instanceof Error ? error.message : 'Could not save your profile photo.'); }
      finally { profilePhotoOperation.current = false; setProfilePhotoBusy(false); }
    })();
  }, [pendingProfilePhoto, appReady, isLocked, activityResumeGuard]);

  const runPreparedFinanceWrite = async (write: () => Promise<unknown>) => {
    if (financeWriteOperation.current) throw new Error('A financial record is already being saved.');
    financeWriteOperation.current = true;
    setFinanceWriteBusy(true);
    try {
      await ensurePrivateStorageBeforeWrite();
      await write();
      await reloadAllData();
      showToast('Financial record saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'This record could not be saved.', 'danger');
      throw error;
    } finally { financeWriteOperation.current = false; setFinanceWriteBusy(false); }
  };

  const quickTaskOperation = useRef(false);
  const addUnscheduledTask = async (title: string, details: QuickTaskDetails = {}) => {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle.length > 200) throw new Error('Enter a task title of 1 to 200 characters.');
    if (!details.dueDate && (details.dueTime || details.reminderAt)) throw new Error('Add a due date before choosing a time or reminder.');
    if (details.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(details.dueDate)) throw new Error('Choose a valid due date.');
    if (details.dueTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(details.dueTime)) throw new Error('Choose a valid task time.');
    if (quickTaskOperation.current) throw new Error('A task is already being saved.');
    quickTaskOperation.current = true;
    try {
      let committed = false;
      await ensurePrivateStorageBeforeWrite();
      const reminderAt = details.reminderAt ? new Date(details.reminderAt).toISOString() : undefined;
      await StorageService.tasks.add({ title: nextTitle, dueDate: details.dueDate, dueTime: details.dueTime,
        reminderAt, priority: details.priority || 'Medium', recurring: 'None', completed: false });
      committed = true;
      try {
        const records = await reloadAllData();
        const synchronized = await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones,
          effectiveNotificationPreferences(notificationPreferences, notificationsEnabled));
        const scheduleFailed = notificationsEnabled && notificationPreferences.taskReminders && Boolean(details.dueDate) && !synchronized;
        showToast(scheduleFailed ? 'Task saved, but Android scheduling could not be confirmed.' : 'Task saved', scheduleFailed ? 'danger' : 'success');
      } catch {
        if (!committed) throw new Error('Task could not be confirmed after saving. Retry from the Plan screen.');
        showToast('Task saved, but Plan could not refresh. Reopen it to verify.', 'info');
      }
    } finally { quickTaskOperation.current = false; }
  };

  const saveNewRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createKind || createOperation.current) return;
    const errorField = event.currentTarget?.querySelector?.('[data-record-validation]');
    if (errorField) errorField.textContent = '';
    createOperation.current = true;
    setRecordSaving(true);
    let committed = false;
    const value = (key: string) => (createDraft[key] || '').trim();
    try {
      if (createKind === 'goal' && !value('title')) throw new Error('Enter a goal name.');
      if (createKind === 'task' && !value('title')) throw new Error('Enter a task title.');
      if (createKind === 'task' && !value('date') && (value('time') || value('reminderLead') || value('reminderAt') || (value('recurring') && value('recurring') !== 'None'))) throw new Error('Add a due date before setting a time, reminder or repeat.');
      await ensurePrivateStorageBeforeWrite();
      // A fresh user may begin with Money. Categories are private and are only
      // loaded after explicit secure provisioning; never post an unclassified
      // transaction merely to get through that first-use step.
      if (createKind === 'transaction' && !value('category')) {
        showToast('Choose a category to finish saving your transaction.', 'info');
        return;
      }
      if (createKind === 'transaction') {
        const existingTransaction = editingTransactionId ? transactions.find(tx => tx.id === editingTransactionId) : undefined;
        const preserveUnknownTime = Boolean(existingTransaction && !existingTransaction.occurredAt && !value('dateTime'));
        const values = { ...buildTransactionUpdate({ type: value('type') as 'income' | 'expense', amount: value('amount'), currencyCode: (value('currencyCode') || existingTransaction?.currencyCode || (!editingTransactionId ? userPrefs.currency : undefined)) as typeof CURRENCY_CODES[number] | undefined, category: value('category'), description: value('title'), dateTime: value('dateTime'), date: existingTransaction?.date, preserveUnknownTime, paymentMethod: value('paymentMethod'), notes: value('notes'), isRecurring: value('isRecurring') === 'yes' }), accountId: Object.prototype.hasOwnProperty.call(createDraft, 'accountId') ? value('accountId') || undefined : existingTransaction?.accountId };
        const accountId = values.accountId;
        if (accountId && !financialAccounts.some(account => account.id === accountId && account.isActive && account.currencyCode === (values.currencyCode || existingTransaction?.currencyCode || userPrefs.currency))) throw new Error('Choose an active account with the same currency as this transaction.')
        if (editingTransactionId) await StorageService.transactions.update(editingTransactionId, values);
        else await StorageService.transactions.add(values);
      } else if (createKind === 'habit') {
        const targetPerDay = value('targetPerDay') ? Number(value('targetPerDay')) : undefined;
        if (targetPerDay !== undefined && (!Number.isFinite(targetPerDay) || targetPerDay <= 0)) throw new Error('Habit target must be greater than zero.');
        const trackingMode = value('trackingMode') === 'quantity' ? 'quantity' : 'binary';
        const existingHabit = editingHabitId ? habits.find(habit => habit.id === editingHabitId) : undefined;
        if (editingHabitId && habitLogs.some(log => log.habitId === editingHabitId) && trackingMode !== (existingHabit?.trackingMode || 'binary')) throw new Error('Tracking mode cannot change after check-in history exists. Create another habit to use a different tracking mode.');
        if (trackingMode === 'quantity' && (!targetPerDay || !value('quantityUnit').trim())) throw new Error('Quantity tracking needs a daily target and unit.');
        const weekdayKeys = [...new Set(value('weekdays').split(',').filter(Boolean).map(Number))].sort();
        const weeklySessions = value('weeklySessions') ? Number(value('weeklySessions')) : undefined;
        if (weeklySessions !== undefined && (!Number.isInteger(weeklySessions) || weeklySessions < 1 || weeklySessions > weekdayKeys.length)) throw new Error('Choose enough scheduled days for your weekly target.');
        const previousSchedule = existingHabit?.schedule ?? [];
        const nextSchedule = weekdayKeys.length ? { from: formatLocalDate(new Date()), weekdays: weekdayKeys, sessionsPerWeek: weeklySessions } : undefined;
        const latestSchedule = previousSchedule[previousSchedule.length - 1];
        const scheduleChanged = nextSchedule && (latestSchedule?.weekdays.join(',') !== weekdayKeys.join(',') || latestSchedule.sessionsPerWeek !== weeklySessions);
        const schedule = scheduleChanged ? [...previousSchedule.filter(entry => entry.from !== nextSchedule.from), nextSchedule] : existingHabit?.schedule;
        const goalId = value('goalId');
        if (goalId && !goals.some(goal => goal.id === goalId)) throw new Error('Choose an available goal.');
        const habit: Partial<Habit> = { goalId: goalId || undefined, name: value('title'), description: value('description') || undefined, frequency: value('frequency') as Habit['frequency'], color: existingHabit?.color || '#6366f1', targetPerDay, schedule, trackingMode, quantityUnit: trackingMode === 'quantity' ? normalizeHabitUnit(value('quantityUnit')) : undefined, reminderTime: value('reminderTime') || undefined, reminderWeekday: value('frequency') === 'weekly' ? Number(value('reminderWeekday')) : undefined };
        if (editingHabitId) await StorageService.habits.update(editingHabitId, habit);
        else await StorageService.habits.add({ ...habit, name: habit.name!, frequency: habit.frequency!, color: habit.color! });
      } else if (createKind === 'budget') {
        const code = editingBudgetId ? budgets.find(row => row.id === editingBudgetId)?.currencyCode || userPrefs.currency : userPrefs.currency;
        const money = createMoneyRecordAmount(value('amount'), code);
        await StorageService.budgets.upsert({ categoryId: value('categoryId') || undefined, monthlyAmount: money.amount, amountMinor: money.amountMinor, currencyCode: money.currencyCode, monthYear: value('month'), ...(value('carryover') ? { carryover: value('carryover') === 'yes' } : {}) });
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
        if (goal.mode === 'frequency' && !Number.isInteger(currentValue)) throw new Error('Enter a whole number of sessions.');
        await StorageService.goals.update(goal.id, { currentValue });
      } else if (createKind === 'goal') {
        const mode = (value('goalMode') || 'accumulate') as NonNullable<Goal['mode']>;
        let targetValue = mode === 'milestone' ? 0 : Number(value('target'));
        let currentValue = mode === 'milestone' ? 0 : Number(value('current'));
        if (mode === 'frequency' && (!Number.isInteger(targetValue) || !Number.isInteger(currentValue))) throw new Error('Enter whole numbers for sessions.');
        let baselineValue = mode === 'reduce' ? Number(value('baselineValue')) : undefined;
        if (mode === 'reduce' && (!Number.isFinite(baselineValue) || baselineValue! <= targetValue)) throw new Error('Enter a starting value above the reduction target.');
        if (!Number.isFinite(targetValue) || targetValue < 0 || (!targetValue && mode !== 'reduce' && mode !== 'milestone') || !Number.isFinite(currentValue) || currentValue < 0) {
          throw new Error('Enter a positive target and a valid current progress value.');
        }
        let goalUnit = value('unit');
        if (canonicalUnit(goalUnit) !== goalUnit) {
          const canonical = canonicalUnit(goalUnit);
          targetValue = convertMeasurement(targetValue, goalUnit, canonical);
          currentValue = convertMeasurement(currentValue, goalUnit, canonical);
          if (baselineValue !== undefined) baselineValue = convertMeasurement(baselineValue, goalUnit, canonical);
          goalUnit = canonical;
        }
        const goalFields = {
          title: value('title'), description: value('description') || undefined,
          category: value('category') as Goal['category'], targetValue, currentValue, mode, baselineValue,
          unit: goalUnit || undefined, startDate: value('startDate') || formatLocalDate(new Date()), targetDate: value('date'),
          priority: value('priority') as Goal['priority'], status: (value('status') || 'In Progress') as Goal['status'],
        };
        if (editingGoalId) await StorageService.goals.update(editingGoalId, goalFields);
        else await StorageService.goals.add(goalFields);
      } else {
        const reminderAt = value('reminderLead') === 'legacy' && value('reminderAt') ? new Date(value('reminderAt')).toISOString() : undefined;
        const reminderLeadMinutes = value('reminderLead') && value('reminderLead') !== 'legacy' ? Number(value('reminderLead') === 'custom' ? value('reminderCustom') : value('reminderLead')) : undefined;
        const goalId = value('goalId');
        if (goalId && !goals.some(goal => goal.id === goalId)) throw new Error('Choose an available goal.');
        const subtasks = value('subtasks').split('\n').map(title => title.trim()).filter(Boolean);
        if (subtasks.length > 25 || subtasks.some(title => title.length > 160)) throw new Error('Use up to 25 subtasks with 160 characters each.');
        const taskUpdates: Partial<Task> = {
          title: value('title'), description: value('description') || undefined, notes: value('description') || undefined,
          dueDate: value('date') || undefined, dueTime: value('time') || undefined, reminderAt, reminderLeadMinutes, dueAlertDisabled: value('dueAlert') === 'off',
          priority: value('priority') as Task['priority'], category: value('category') || undefined,
          recurring: (value('recurring') || 'None') as Task['recurring'], goalId: goalId || undefined,
          ...(!editingTaskId && subtasks.length ? { subtasks: subtasks.map(title => ({ id: crypto.randomUUID(), title, completed: false, createdAt: new Date().toISOString() })) } : {}),
        };
        if (editingTaskId) {
          const original = tasks.find(task => task.id === editingTaskId);
          if (original?.dueDate && taskUpdates.dueDate && original.recurring === taskUpdates.recurring && original.recurring !== 'None') {
            taskUpdates.recurrenceScheduledDate = original.recurrenceScheduledDate || original.dueDate;
            taskUpdates.recurrenceAnchorDay = original.recurrenceAnchorDay ?? Number(taskUpdates.recurrenceScheduledDate.slice(-2));
          } else {
            taskUpdates.recurrenceScheduledDate = undefined;
            taskUpdates.recurrenceAnchorDay = undefined;
          }
          await StorageService.tasks.update(editingTaskId, taskUpdates);
        }
        else await StorageService.tasks.add({ ...taskUpdates, title: taskUpdates.title!, dueDate: taskUpdates.dueDate!, priority: taskUpdates.priority!, recurring: taskUpdates.recurring!, completed: false });
      }
      // A resolved storage write is committed. Close before fallible refresh work.
      committed = true;
      setCreateKind(null);
      setCreateFormDirty(false);
      setEditingTaskId(null); setEditingHabitId(null);
      setEditingTransactionId(null); setEditingGoalId(null); setEditingContributionId(null); setEditingSavingsGoalId(null);
      const records = await reloadAllData();
      const schedulesUpdated = await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(notificationPreferences, notificationsEnabled));
      const wasEditingTask = editingTaskId;
      const wasEditingHabit = editingHabitId;
      const wasEditingTransaction = editingTransactionId;
      const wasEditingGoal = editingGoalId;
      const wasEditingContribution = editingContributionId;
      const reminderSyncFailed = createKind === 'task' && Boolean(value('date')) && notificationsEnabled && notificationPreferences.taskReminders && !schedulesUpdated;
      showToast(reminderSyncFailed ? 'Task saved, but its reminder was not confirmed in Android. Open task details and check reminder status.' : wasEditingTask ? 'Task updated' : wasEditingHabit ? 'Habit updated' : wasEditingTransaction ? 'Transaction updated' : wasEditingGoal ? 'Goal updated' : wasEditingContribution ? 'Contribution updated and savings total reconciled' : createKind === 'milestone' ? 'Milestone added' : createKind === 'goal-progress' ? 'Goal progress updated' : `${createKind[0].toUpperCase()}${createKind.slice(1)} added`, reminderSyncFailed ? 'danger' : 'success');
    } catch (error) {
      if (!committed && errorField) errorField.textContent = error instanceof Error ? error.message : 'Could not save this item.';
      showToast(committed ? 'Saved, but the view or reminders could not refresh. Reopen the list to refresh; do not submit this item again.' : error instanceof Error ? error.message : 'Could not save this item', 'danger');
    } finally { createOperation.current = false; setRecordSaving(false); }
  };


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
    const stats = calculateStreaks(habitLogs, habitId, targetDate, habits.find(h => h.id === habitId)?.frequency || 'daily', habits.find(h => h.id === habitId));
    return { ...stats, totalCount: new Set(habitLogs.filter(log => log.habitId === habitId && log.completed).map(log => log.date)).size };
  };

  const todayKey = formatLocalDate(clockNow);
  const todayOverview = useMemo(
    () => getTodayOverview(tasks, habits, habitLogs, todayKey),
    [tasks, habits, habitLogs, todayKey]
  );
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
  const dashboardTasks = useMemo(() => sortTasksByDeadline(tasks.filter(task => getTaskStatus(task, clockNow) === 'Overdue' || task.dueDate === todayKey), clockNow).slice(0, 3), [tasks, clockNow, todayKey]);
  const dashboardUpcomingTasks = useMemo(() => sortTasksByDeadline(tasks.filter(task => !task.completed && Boolean(task.dueDate) && task.dueDate > todayKey), clockNow).slice(0, 2), [tasks, clockNow, todayKey]);
  const visiblePlannerTasks = useMemo(() => {
    const dateScopedTasks = ['today', 'tomorrow', 'upcoming', 'unscheduled'].includes(plannerFilter) ? tasks : getTasksForDate(tasks, plannerSelectedDate);
    return sortTasksByDeadline(dateScopedTasks.filter(task => {
    const status = getTaskStatus(task, clockNow);
    const dateScope = ['today', 'tomorrow', 'upcoming', 'unscheduled'].includes(plannerFilter);
    const statusMatch = dateScope || plannerFilter === 'all' ? true : status.toLowerCase() === plannerFilter;
    const dateMatch = plannerFilter === 'today' ? task.dueDate === todayKey
      : plannerFilter === 'tomorrow' ? task.dueDate === tomorrowKey
        : plannerFilter === 'upcoming' ? Boolean(task.dueDate) && task.dueDate > todayKey && task.dueDate <= formatLocalDate(new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() + 7))
          : plannerFilter === 'unscheduled' ? !task.dueDate : task.dueDate === plannerSelectedDate;
    const query = plannerSearch.trim().toLowerCase();
    const searchMatch = !query || `${task.title} ${task.description || ''} ${task.notes || ''} ${task.category || ''}`.toLowerCase().includes(query);
    return statusMatch && dateMatch && searchMatch && (plannerPriority === 'all' || task.priority === plannerPriority);
    }), clockNow);
  }, [tasks, clockNow, plannerFilter, plannerSearch, plannerPriority, todayKey, tomorrowKey, plannerSelectedDate]);
  const plannerDetailTask = plannerDetailTaskId ? tasks.find(task => task.id === plannerDetailTaskId) : undefined;
  const upcomingTaskGroups = useMemo(() => groupUpcomingTasks(visiblePlannerTasks, todayKey), [visiblePlannerTasks, todayKey]);
  useEffect(() => {
    if (!plannerDetailTaskId && taskDetailReturnFocusRef.current?.isConnected) taskDetailReturnFocusRef.current.focus({ preventScroll: true });
  }, [plannerDetailTaskId]);

  const changeGoalStatus = async (goal: Goal, status: Goal['status']) => {
    try {
      if (status === 'Completed' && (goal.currentValue < goal.targetValue || milestones.some(item => item.goalId === goal.id && !item.completed))) {
        showToast('Reach the target and finish its milestones to complete this goal.', 'info');
        return;
      }
      await StorageService.goals.update(goal.id, { status });
      const records = await reloadAllData();
      const saved = records.goals.find(item => item.id === goal.id);
      if (saved?.status !== status) { showToast('The goal status did not change. Review its progress and milestones.', 'info'); return; }
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
      showToast(status === 'Paused' ? 'Goal paused' : status === 'Completed' ? 'Goal completed' : 'Goal resumed', 'success');
    } catch { showToast('Could not update the goal status.', 'danger'); }
  };

  const deleteGoalFromDetails = async (goal: Goal) => {
    if (!(await confirmAction({ title: 'Delete this goal?', message: 'The goal and its milestones will be removed.', confirmLabel: 'Delete goal', destructive: true }))) return;
    try {
      await StorageService.goals.delete(goal.id);
      const records = await reloadAllData();
      setLifeDetail(null);
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
      showToast('Goal deleted', 'success');
    } catch { showToast('Could not delete the goal.', 'danger'); }
  };

  const goalProgress = (goal: Goal) => {
    if (goal.mode === 'milestone') {
      const rows = milestones.filter(row => row.goalId === goal.id);
      return getGoalProgress(rows.filter(row => row.completed).length, rows.length);
    }
    if (goal.mode === 'reduce') return getGoalProgress((goal.baselineValue ?? 0) - goal.currentValue, (goal.baselineValue ?? 0) - goal.targetValue);
    return getGoalProgress(goal.currentValue, goal.targetValue);
  };
  const editingLegacyDateOnly = Boolean(createKind === 'transaction' && editingTransactionId
    && !transactions.find(tx => tx.id === editingTransactionId)?.occurredAt);
  const matchesActivityDate = (date: string) => activityRange.from || activityRange.through
    ? (!activityRange.from || date >= activityRange.from) && (!activityRange.through || date <= activityRange.through)
    : date.startsWith(financeMonth);
  const matchesActivityAmount = (minor: string | undefined, amount: number, currency: string) => {
    if (!activityRange.min && !activityRange.max) return true;
    try {
      const value = minor === undefined ? decimalToMinorUnits(String(amount), currency) : BigInt(minor);
      return (!activityRange.min || value >= decimalToMinorUnits(activityRange.min, currency))
        && (!activityRange.max || value <= decimalToMinorUnits(activityRange.max, currency));
    } catch { return false; }
  };
  const filteredTransfers = financeTypeFilter === 'all' || financeTypeFilter === 'transfer'
    ? accountTransfers.filter(row => {
      const names = financialAccounts.filter(account => account.id === row.fromAccountId || account.id === row.toAccountId).map(account => account.name);
      const query = financeSearch.trim().toLowerCase();
      return matchesActivityDate(row.date) && financeCategoryFilter === 'all'
        && (financeAccountFilter === 'all' || financeAccountFilter === row.fromAccountId || financeAccountFilter === row.toAccountId)
        && (financeCurrencyFilter === 'all' || financeCurrencyFilter === row.fromCurrencyCode || financeCurrencyFilter === row.toCurrencyCode)
        && (matchesActivityAmount(row.fromAmountMinor, 0, row.fromCurrencyCode) && (financeCurrencyFilter === 'all' || financeCurrencyFilter === row.fromCurrencyCode)
          || matchesActivityAmount(row.toAmountMinor, 0, row.toCurrencyCode) && financeCurrencyFilter === row.toCurrencyCode)
        && (!query || [row.notes, ...names, 'transfer'].some(value => value?.toLowerCase().includes(query)));
    }) : [];
  const filteredTransactions = useMemo(() => sortTransactions(transactions.filter(tx => {
    const query = financeSearch.trim().toLowerCase();
    const haystack = `${tx.description || ''} ${tx.category || ''} ${tx.notes || ''} ${tx.paymentMethod || ''}`.toLowerCase();
    return matchesActivityDate(tx.date) && matchesActivityAmount(tx.amountMinor, tx.amount, tx.currencyCode || userPrefs.currency)
      && (financeTypeFilter === 'all' || tx.type === financeTypeFilter)
      && (financeCategoryFilter === 'all' || tx.category === financeCategoryFilter)
      && (financeAccountFilter === 'all' || (financeAccountFilter === 'unassigned' ? !tx.accountId : tx.accountId === financeAccountFilter))
      && (financeCurrencyFilter === 'all' || (tx.currencyCode || userPrefs.currency) === financeCurrencyFilter)
      && (!query || haystack.includes(query));
  }), financeSort as 'date-asc' | 'date-desc' | 'amount-desc'),
  [transactions, financeMonth, activityRange, financeTypeFilter, financeCategoryFilter, financeAccountFilter, financeCurrencyFilter, userPrefs.currency, financeSearch, financeSort]);
  const financeOverviewTransactions = useMemo(
    () => sortTransactions(transactions.filter(tx => tx.date?.startsWith(financeMonth)), 'date-desc').slice(0, 4),
    [transactions, financeMonth]
  );

  const recoveryInline = onboardingRequired && !onboardingComplete && onboardingStep === 2 && Boolean(secureSetup?.prepared);
  const recoverySetup = secureSetup && <SecureSetupDialog prepared={secureSetup.prepared} inline={recoveryInline}
    onRecoveryExportStart={beginRecoveryExportActivity}
    recoveryExportResumeReady={recoveryExportResumeReady}
    cancelLabel={onboardingRequired && !onboardingComplete && secureSetup.prepared ? 'Back to recovery options' : undefined}
    onRetryRecoveryExportResume={() => { void resumeRecoveryAfterPicker(); }}
    onDecision={accepted => {
      if (!accepted && recoveryExportReturnPending.current) {
        recoveryExportReturnPending.current = false;
        void CryptoService.cancelPendingRecovery()
          .catch(() => undefined)
          .finally(async () => {
            try { await confirmScreenshotResume(); setActivityResumeGuard(false); } catch { /* Keep screenshots blocked if resume validation fails. */ }
            secureSetupResolver.current?.(false);
          });
      } else secureSetupResolver.current?.(accepted);
    }} />;
  if (recoverySetup && !recoveryInline) return recoverySetup;

  if (recoveryOpen) return <RecoveryDialog onRecover={kit => { setIsLocked(true); biometricAuthenticated.current = false; authCoordinator.resetForBackground(); return recoveryController.recover(kit).then(async () => { setRecoveryOpen(false); setStartupError(''); await initApp(); }); }} onClose={() => setRecoveryOpen(false)} />;

  if (backupPrompt) return <BackupPassphraseDialog purpose={backupPrompt} onComplete={value => backupPassphraseResolver.current?.(value)} />;

  if (!appReady) return <div className="lifeos-page fixed inset-0 flex items-center justify-center px-6" aria-label={startupError ? 'LifeOS could not start' : 'Loading LifeOS'}>{startupError ? <div className="max-w-sm text-center"><h1 className="text-xl font-semibold">LifeOS could not open</h1><p className="mt-2 text-sm text-secondary">{startupError}</p><button className="lifeos-accent-button mt-5 min-h-11 rounded-xl px-5 text-sm font-semibold" onClick={() => { setStartupError(''); void initApp().catch(error => setStartupError(error instanceof Error ? error.message : 'LifeOS could not open local data.')); }}>Try again</button><button className="lifeos-input mt-3 block min-h-11 w-full rounded-xl px-4" onClick={() => { void openRecovery(); }}>Recover encryption key</button></div> : <div className="h-8 w-8 animate-spin rounded-full border-2 lifeos-border" style={{ borderTopColor: 'var(--accent)' }} aria-hidden="true" />}</div>;

  if (firstRecordSecurityOpen) return <FirstRecordSecurityDialog onDecision={choice => {
    void setSensitiveScreenshotState(profileOpen).catch(() => {});
    firstRecordSecurityResolver.current?.(choice);
  }} />;

  if (onboardingRequired && !onboardingComplete && (!isLocked || recoveryInline)) return <Onboarding
    initialName={displayName}
    step={onboardingStep}
    protectionAvailable={biometricAvailability === 'Available'}
    deviceCredentialOnly={deviceCredentialOnly}
    protectionReady={!safeFirstRunBrowse.current}
    recoveryReady={recoveryProvisioned}
    recoveryContent={recoveryInline ? recoverySetup : null}
    notificationsSupported={NotificationService.isSupported()}
    notificationsGranted={notificationDiagnostics.permission === 'granted'}
    notificationsEnabled={notificationsEnabled}
    preciseGranted={notificationDiagnostics.exactAlarm === 'granted'}
    onNotifications={acceptOnboardingNotifications}
    onPrecise={async () => {
      await NotificationService.requestExactAlarmPermission();
      const diagnostics = await refreshNotificationDiagnostics();
      if (diagnostics.exactAlarm === 'granted') await syncNotificationSchedules(tasks, habits, goals, milestones);
    }}
    onNotificationSettings={openNotificationSettings}
    onSaveIdentity={saveOnboardingIdentity}
    onStep={async step => {
      const journey: OnboardingJourney = { ...onboardingJourney, version: 2,
        stage: step === ONBOARDING_NOTIFICATIONS_STEP ? 'notifications' : step === 1 ? 'protection' : 'recovery' };
      await StorageService.settings.set('onboardingStep', step);
      await StorageService.settings.set('onboardingJourney', journey);
      setOnboardingJourney(journey);
      setOnboardingStep(step);
    }}
    onProtect={provisionOnboardingProtection}
    onRecover={() => confirmOnboardingRecovery('')}
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
    <LazyMotion features={domAnimation} strict>
    <div ref={gestureSurfaceElement} className="lifeos-page app-shell" onPointerDownCapture={handleContentPointerDown} onClickCapture={handleContentClickCapture}>
      <span className="lifeos-safe-area-probe" aria-hidden="true" />
      <header data-profile-background className="app-header app-header-shell sticky top-0 z-40 flex items-center justify-between px-4 py-3 sm:px-5">
        <button type="button" id="profile-opener" aria-expanded={profileOpen} aria-controls={profileOpen ? "screen-settings" : undefined} onClick={openProfile} aria-label="Open profile and settings" className="app-profile-button flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition active:scale-95">
          <ProfileAvatar photo={profilePhoto} initial={profileInitial(displayName)} />
        </button>
      </header>

      {!isOnline && (
        <div data-profile-background role="status" aria-live="polite" className="app-content-width px-4 pt-2">
          <div className="lifeos-warning lifeos-panel rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'var(--warning)' }}>
            Offline — LifeOS records remain stored on this device. Internet-dependent services may be unavailable.
          </div>
        </div>
      )}

      {/* Main Container */}
      <main data-profile-background className="app-main">
        <div className="ui-tab-screen-stack">
        {/* VIEW 1: DASHBOARD */}
        <RetainedScreen active={activeTab === 'dashboard'} id="screen-dashboard" {...transitionPropsFor('dashboard')} render={() => (
          <div className="today-sections command-centre" data-testid="today-dashboard">
            <div className="today-heading" style={{ order: 0 }}><div><p className="text-sm font-medium text-muted">{clockNow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2 className="text-xl font-semibold tracking-tight">{greetingForHour(clockNow.getHours(), displayName)}</h2></div><button type="button" onClick={() => setTodayCustomizationOpen(open => !open)} aria-expanded={todayCustomizationOpen} aria-haspopup="dialog" aria-controls="today-customization" className="lifeos-raised min-h-11 rounded-xl px-3 text-xs font-semibold lifeos-accent-text">Customize</button></div>

            {todayCustomizationOpen && createPortal(<div className="ui-sheet-backdrop" onMouseDown={dismissTodayCustomizationBackdrop}>
            <section id="today-customization" role="dialog" aria-modal="true" aria-labelledby="today-customization-title" aria-describedby="today-customization-description" className="today-customization ui-sheet-motion ui-bottom-sheet lifeos-panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border p-4">
              <div className="mb-3"><h3 id="today-customization-title" className="text-sm font-semibold">Make Today yours</h3><p id="today-customization-description" className="mt-1 text-xs text-secondary">Choose which sections appear and arrange their order. Changes save as you make them.</p></div>
              <ul className="today-customization-list">{todayLayout.order.map((id, index) => <li key={id}>
                <label className="today-section-toggle"><input type="checkbox" checked={!todayLayout.hidden.includes(id)} disabled={id === 'focus'} onChange={event => persistTodayLayout(setTodaySectionVisible(todayLayoutRef.current, id, event.target.checked))} /><span>{TODAY_SECTION_LABELS[id]}</span></label>
                <div className="today-order-actions"><button type="button" aria-label={`Move ${TODAY_SECTION_LABELS[id]} up`} disabled={index === 0} onClick={() => persistTodayLayout(moveTodaySection(todayLayoutRef.current, id, -1))}>↑</button><button type="button" aria-label={`Move ${TODAY_SECTION_LABELS[id]} down`} disabled={index === todayLayout.order.length - 1} onClick={() => persistTodayLayout(moveTodaySection(todayLayoutRef.current, id, 1))}>↓</button></div>
              </li>)}</ul>
              <div className="ui-form-actions mt-3"><button type="button" onClick={() => persistTodayLayout(DEFAULT_TODAY_LAYOUT)} className="min-h-11 flex-1 rounded-lg px-2 text-xs font-semibold lifeos-accent-text">Restore default layout</button><button type="button" onClick={closeTodayCustomization} className="lifeos-accent-button min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold">Done</button></div>
            </section></div>, document.body)}

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
                <div><p className="text-[10px] font-bold uppercase tracking-wider lifeos-accent-text">Goals</p><h3 className="text-sm font-semibold">{goals.filter(goal => goal.status === 'In Progress' && !goal.archived).length} active goals</h3></div>
                <button onClick={() => navigateTo('goals')} className="rounded-lg px-2 py-1 text-xs font-semibold lifeos-accent-text" aria-label="Open Goals">View all →</button>
              </div>
              {goals.filter(goal => goal.status === 'In Progress' && !goal.archived).length === 0 ? (
                <div className="today-inline-empty"><p>No active goals yet.</p><button onClick={() => { navigateTo('goals'); openCreateForm('goal'); }} className="min-h-11 font-semibold lifeos-accent-text">Create your first goal</button></div>
              ) : <div className="space-y-3">{goals.filter(goal => goal.status === 'In Progress' && !goal.archived).slice(0, 1).map(goal => {
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
                <span>Net cash flow: <strong className="text-primary tabular-nums">{formatMoney(financeAnalytics.netSavings)}</strong></span>
                <span>Cash-flow margin: <strong className="tabular-nums" style={{ color: financeAnalytics.savingsRate !== null && financeAnalytics.savingsRate < 0 ? 'var(--danger)' : 'var(--accent)' }}>{financeAnalytics.savingsRate === null ? '—' : `${financeAnalytics.savingsRate.toFixed(1)}%`}</strong></span>
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
                  {habits.slice(0, 2).map(h => {
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
                        <button type="button" onClick={event => { taskDetailReturnTabRef.current = 'dashboard'; taskDetailReturnFocusRef.current = event.currentTarget; setPlannerDetailTaskId(t.id); setPlannerSelectedDate(t.dueDate || todayKey); setPlannerFilter('all'); navigateTo('planner'); }} className="today-task-open" aria-label={`Open ${t.title} details`}>
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
        <RetainedScreen active={activeTab === 'plan'} retainInactive id="screen-plan" {...transitionPropsFor('plan')} render={() => <Suspense fallback={<ScreenLoading label="Loading your plan…" />}><div className="space-y-4">{renderPlanNavigation('plan')}<PlanHub onCreate={() => openCreateForm('task')} tasks={tasks} today={todayKey} now={clockNow}
          onOpenTask={(task, trigger) => { taskDetailReturnTabRef.current = 'plan'; taskDetailReturnFocusRef.current = trigger; setPlannerDetailTaskId(task.id); setPlannerSelectedDate(task.dueDate || todayKey); setPlannerFilter(task.dueDate ? 'all' : 'unscheduled'); navigateTo('planner'); }}
          onToggleTask={async task => { await StorageService.tasks.toggleCompleted(task.id, !task.completed); if (!task.completed) await NotificationService.cancelTask(task); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Task updated', 'success'); }}
          /></div></Suspense>} />

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
          goals={goals.filter(goal => goal.status === 'In Progress' && !goal.archived)}
          hasHistory={transactions.length > 0 || habits.length > 0 || goals.length > 0}
          formatMoney={formatMoney}
          onFinance={() => { setFinanceSubtab('analytics'); navigateTo('finance'); }}
          onHabits={() => { setLifeDetail(null); setHabitsSubtab('weekly'); navigateTo('habits'); }}
          onGoals={() => { setLifeDetail(null); setGoalsSubtab('active'); navigateTo('goals'); }}
        /></Suspense>} />

        <RetainedScreen active={activeTab === 'finance'} retainInactive id="screen-finance" {...transitionPropsFor('finance')} render={() => (
          <div ref={moneyPageRef} className="money-page space-y-5" data-detail={financeSubtab}>
            {financeSubtab !== 'overview' && <MoneyDetailHeader section={financeSubtab} month={financeMonth} onMonthChange={setFinanceMonth} onBack={() => { if (financeSubtab === 'projection') { navigateBack(); return; } rememberActiveScroll(); financeSubtabHistory.current = []; setFinanceSubtab('overview'); }} />}

            {/* Money home: recorded cash flow, never an inferred account balance. */}
            {(financeSubtab === 'overview' || financeSubtab === 'monthly') && (
              <MoneyHome
                month={financeMonth}
                monthly={financeSubtab === 'monthly'}
                onMonthly={() => navigateFinanceSubtab('monthly')}
                monthSavings={financeSubtab === 'monthly' ? formatMinorUnits(savingsContributions.filter(row => row.date.startsWith(financeMonth) && (row.currencyCode || userPrefs.currency) === userPrefs.currency).reduce((total, row) => total + (row.amountMinor ? BigInt(row.amountMinor) : decimalToMinorUnits(row.amount, userPrefs.currency)), 0n), userPrefs.currency, userPrefs.locale === 'system' ? undefined : userPrefs.locale) : undefined}
                income={financeAnalytics.totalIncome}
                expenses={financeAnalytics.totalExpenses}
                netCashFlow={financeAnalytics.netSavings}
                budgetRows={financeAnalytics.budgetRows}
                expenseChange={financeAnalytics.expenseChange}
                excludedCurrencyCount={financeAnalytics.excludedCurrencyCount}
                transactions={financeOverviewTransactions}
                formatMoney={formatMoney}
                formatDate={formatDate}
                formatTime={formatTime}
                onMonthChange={setFinanceMonth}
                onAddTransaction={() => openCreateForm('transaction')}
                onTransactions={() => navigateFinanceSubtab('transactions')}
                onBudgets={() => navigateFinanceSubtab('budgets')}
                onSavings={() => navigateFinanceSubtab('savings')}
                onAnalytics={() => navigateFinanceSubtab('analytics')}
                onPlanning={() => navigateFinanceSubtab('planning')}
                onAccounts={() => navigateFinanceSubtab('accounts')}
                legacyCurrency={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale}
                onEditTransaction={row => setTransactionDetailId(row.id)}
              />
            )}

            {financeSubtab === 'accounts' && <MoneyAccounts accounts={financialAccounts} transactions={transactions} transfers={accountTransfers} currencyCode={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale}
              accountDraft={accountFormDraft} onAccountDraftChange={setAccountFormDraft} accountDirty={accountFormDirty} onAccountDirtyChange={setAccountFormDirty} accountSaving={financeWriteBusy} transferDraft={transferFormDraft} onTransferDraftChange={setTransferFormDraft} transferDirty={transferFormDirty} onTransferDirtyChange={setTransferFormDirty}
              autoOpenTransfer={openMoneyTransferOnAccounts} onTransferRequestHandled={() => setOpenMoneyTransferOnAccounts(false)}
              confirmAction={confirmAction}
              onCreateAccount={async input => { await runPreparedFinanceWrite(() => StorageService.accounts.add(input)); }}
              onUpdateAccount={async (id, input) => { await runPreparedFinanceWrite(() => StorageService.accounts.update(id, input)); }}
              onDeleteAccount={async id => { await StorageService.accounts.delete(id); await reloadAllData(); }}
              onCreateTransfer={async input => { await runPreparedFinanceWrite(() => StorageService.accounts.addTransfer(input)); }}
              onUpdateTransfer={async (id, input) => { await runPreparedFinanceWrite(() => StorageService.accounts.updateTransfer(id, input)); }}
              onReverseTransfer={async (id, date) => { await StorageService.accounts.reverseTransfer(id, date); await reloadAllData(); }}
              onDeleteTransfer={async id => { await StorageService.accounts.deleteTransfer(id); await reloadAllData(); }} />}

            {/* Transactions Subtab */}
            {financeSubtab === 'transactions' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    aria-label="Search transactions" placeholder="Search description, category..."
                    value={financeSearch}
                    onChange={(e) => setFinanceSearch(e.target.value)}
                    className="lifeos-input min-h-11 flex-1 rounded-xl px-3 py-2.5 text-xs"
                  />
                  <button onClick={() => openCreateForm('transaction')} className="lifeos-accent-button min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold">+ Add</button>
                </div>
                <button type="button" aria-haspopup="dialog" className="lifeos-raised min-h-11 rounded-xl px-4 text-sm font-semibold" onClick={() => activityFilterDialog.current?.showModal()}>Filters</button>
                <dialog ref={activityFilterDialog} data-activity-filters aria-label="Activity filters" className="plan-filter-sheet lifeos-page" onClick={event => { if (event.target === event.currentTarget) activityFilterDialog.current?.close(); }}>
                <form onSubmit={event => { event.preventDefault(); activityFilterDialog.current?.close(); }}>
                <header className="flex items-center justify-between"><h3 className="type-section-title">Activity filters</h3><button type="button" className="min-h-11 px-3" onClick={() => activityFilterDialog.current?.close()}>Close</button></header>
                <div className="plan-filter-fields">{(['from', 'through', 'min', 'max'] as const).map((key, index) => <label key={key}>{['From date', 'Through date', 'Minimum amount', 'Maximum amount'][index]}<input type={index < 2 ? 'date' : 'number'} min={key === 'through' ? activityRange.from || undefined : index >= 2 ? key === 'max' ? activityRange.min || '0' : '0' : undefined} max={key === 'from' ? activityRange.through || undefined : key === 'min' ? activityRange.max || undefined : undefined} step={index >= 2 ? 'any' : undefined} value={activityRange[key]} onChange={event => setActivityRange(current => ({ ...current, [key]: event.target.value }))} /></label>)}</div><div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-secondary">Month<input aria-label="Transaction month" type="month" value={financeMonth} onChange={e => setFinanceMonth(e.target.value)} className="lifeos-input mt-1 block min-h-11 w-full rounded-lg px-2 py-2 text-xs" /></label><label className="text-[10px] text-secondary">Category<select value={financeCategoryFilter} onChange={e => setFinanceCategoryFilter(e.target.value)} className="lifeos-input mt-1 block min-h-11 w-full rounded-lg px-2 py-2 text-xs"><option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label><label className="text-[10px] text-secondary">Account<select aria-label="Filter transactions by account" value={financeAccountFilter} onChange={e => setFinanceAccountFilter(e.target.value)} className="lifeos-input mt-1 block min-h-11 w-full rounded-lg px-2 py-2 text-xs"><option value="all">All accounts</option><option value="unassigned">Unassigned</option>{financialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}{account.isActive ? "" : " · Archived"}</option>)}</select></label><label className="text-[10px] text-secondary">Currency<select aria-label="Filter transactions by currency" value={financeCurrencyFilter} onChange={e => setFinanceCurrencyFilter(e.target.value)} className="lifeos-input mt-1 block min-h-11 w-full rounded-lg px-2 py-2 text-xs"><option value="all">All currencies</option>{CURRENCY_CODES.map(code => <option key={code} value={code}>{formatCurrencyChoice(code, userPrefs.locale === "system" ? undefined : userPrefs.locale)}</option>)}</select></label></div>

                {/* Filters */}
                <div role="group" aria-label="Filter transactions by type" className="flex flex-wrap gap-2 text-xs pb-1">
                  {(['all', 'income', 'expense', 'transfer'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFinanceTypeFilter(t)}
                      aria-pressed={financeTypeFilter === t}
                      className={`min-h-11 rounded-full px-3 capitalize ${financeTypeFilter === t ? 'lifeos-accent-button font-semibold' : 'lifeos-panel text-secondary border border-[var(--stroke)]'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <label className="flex items-center justify-between text-[10px] text-secondary">Sort<select value={financeSort} onChange={e => setFinanceSort(e.target.value)} className="lifeos-input min-h-11 rounded-lg px-2 py-2 text-xs"><option value="date-desc">Newest first</option><option value="date-asc">Oldest first</option><option value="amount-desc">Largest amount</option></select></label>

                <button type="submit" className="lifeos-accent-button min-h-11 rounded-xl px-4">Show activity</button></form></dialog>
                <div className="money-detail-results"><span role="status">{filteredTransactions.length + filteredTransfers.length} items</span><button type="button" onClick={() => { setFinanceSearch(''); setFinanceCategoryFilter('all'); setFinanceAccountFilter('all'); setFinanceCurrencyFilter('all'); setFinanceTypeFilter('all'); setFinanceSort('date-desc'); setActivityRange({ from: '', through: '', min: '', max: '' }); }}>Clear filters</button></div>
                {/* Transactions List */}
                <div className="space-y-2">
                  {!filteredTransactions.length && !filteredTransfers.length ? (
                    <div className="text-center py-8 text-xs text-muted">No transactions match these filters.</div>
                  ) : (
                    [...new Set([...filteredTransactions.map(row => row.date), ...filteredTransfers.map(row => row.date)])].sort((a, b) => financeSort === 'date-asc' ? a.localeCompare(b) : b.localeCompare(a)).map(date => (
                      <section key={date} className="space-y-2" aria-label={formatDate(date)}><h3 className="type-caption text-secondary">{formatDate(date)}</h3>
                      {filteredTransfers.filter(row => row.date === date).map(row => <article className="transaction-history-item lifeos-panel rounded-xl border px-3 py-2" key={row.id}><div className="transaction-history-main"><button type="button" className="transaction-history-copy" onClick={() => navigateFinanceSubtab('accounts')}><strong>{row.reversalOfId ? 'Transfer reversal' : 'Transfer'}</strong><span>{financialAccounts.find(account => account.id === row.fromAccountId)?.name || 'Archived account'} ? {financialAccounts.find(account => account.id === row.toAccountId)?.name || 'Archived account'}</span>{row.notes && <span>{row.notes}</span>}</button><span className="transaction-history-amount">{formatMinorUnits(BigInt(row.fromAmountMinor), row.fromCurrencyCode, userPrefs.locale === 'system' ? undefined : userPrefs.locale)}</span></div></article>)}
                      {filteredTransactions.filter(row => row.date === date).map(t => (
                      <article key={t.id} className="transaction-history-item lifeos-panel rounded-xl border px-3 py-1">
                        <div className="transaction-history-main">
                          <button type="button" onClick={() => setTransactionDetailId(t.id)} aria-label={`View transaction ${t.description || t.category}`} className="transaction-history-copy">
                            <strong>{t.description || t.category}</strong>
                            <span>{formatDate(t.date)}{t.occurredAt ? ` · ${formatTime(new Date(t.occurredAt))}` : ' · time not recorded'} &bull; {t.category} ({t.paymentMethod || 'Other'}){t.accountId ? ` · ${financialAccounts.find(account => account.id === t.accountId)?.name || 'Archived account'}` : ''}</span>
                          </button>
                          <span className={`transaction-history-amount ${t.type === 'income' ? 'is-income' : 'is-expense'}`}>
                            {t.type === 'income' ? '+' : '−'}{t.amountMinor !== undefined && t.currencyCode ? formatMinorUnits(BigInt(t.amountMinor), t.currencyCode, userPrefs.locale === 'system' ? undefined : userPrefs.locale) : formatMoney(t.amount, t.currencyCode || userPrefs.currency)}
                          </span>
                        </div>
                      </article>
                    ))}</section>))
                  )}
                </div>
              </div>
            )}

            {financeSubtab === 'budgets' && <div className="space-y-3">
              <div className="flex justify-end"><button onClick={() => openCreateForm('budget')} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-sm font-semibold">Add budget</button></div>
              {budgets.some(b => (!b.monthYear || b.monthYear === financeMonth) && b.currencyCode && b.currencyCode !== userPrefs.currency) && <p role="status" className="rounded-xl border border-[var(--stroke)] p-3 text-xs text-secondary">Budgets in another currency are hidden until a dated exchange rate is available.</p>}
              {budgets.filter(b => (!b.monthYear || b.monthYear === financeMonth) && (!b.currencyCode || b.currencyCode === userPrefs.currency)).length === 0 ? <div className="rounded-2xl border border-[var(--stroke)] lifeos-panel py-8 text-center text-sm text-secondary">No budget set for {financeMonth}.</div> : budgets.filter(b => (!b.monthYear || b.monthYear === financeMonth) && (!b.currencyCode || b.currencyCode === userPrefs.currency)).map(b => {
                const budgetCategoryName = b.categoryId ? categories.find(category => category.id === b.categoryId)?.name : undefined;
                const budgetName = b.categoryId ? (budgetCategoryName || 'Unavailable category') : 'Overall budget';
                const categoryMissing = Boolean(b.categoryId && !budgetCategoryName);
                const budgetCurrency = b.currencyCode || userPrefs.currency;
                const carryoverMinor = budgetCarryoverMinor(b, budgets, transactions, categories, budgetCurrency);
                const allocatedMinor = (b.amountMinor && /^(0|[1-9]\d*)$/.test(b.amountMinor) ? BigInt(b.amountMinor) : decimalToMinorUnits(String(b.monthlyAmount), budgetCurrency)) + carryoverMinor;
                const spentTransactions = transactions.filter(tx => tx.type === 'expense' && tx.date?.startsWith(financeMonth) && (!tx.currencyCode || tx.currencyCode === budgetCurrency) && (!b.categoryId || tx.category === budgetCategoryName));
                const spentMinor = spentTransactions.reduce((total, tx) => total + (tx.amountMinor && tx.currencyCode === budgetCurrency && /^(0|[1-9]\d*)$/.test(tx.amountMinor) ? BigInt(tx.amountMinor) : decimalToMinorUnits(String(tx.amount), budgetCurrency)), 0n);
                const budgetStatus = getExactBudgetDisplayStatus(categoryMissing ? undefined : spentMinor, allocatedMinor);
                const budgetLabel = categoryMissing ? 'Usage unavailable' : budgetStatus.percentUsed === null ? 'No monthly limit set' : `${budgetStatus.percentUsed.toFixed(0)}% used`;
                const overByLabel = formatMinorUnits(budgetStatus.overByMinor, budgetCurrency, userPrefs.locale === 'system' ? undefined : userPrefs.locale);
                const remainingAmountLabel = formatMinorUnits(budgetStatus.remainingMinor, budgetCurrency, userPrefs.locale === 'system' ? undefined : userPrefs.locale);
                const overLabel = budgetStatus.percentUsed === null ? `${overByLabel} over plan · no monthly limit` : `${budgetStatus.percentUsed.toFixed(0)}% used · ${overByLabel} over plan`;
                const overAccessibleLabel = budgetStatus.percentUsed === null ? `${overByLabel} over plan with no monthly limit` : `${budgetStatus.percentUsed.toFixed(0)}% used, ${overByLabel} over plan`;
                const amountLabel = categoryMissing ? 'Unavailable' : formatMinorUnits(spentMinor, budgetCurrency, userPrefs.locale === 'system' ? undefined : userPrefs.locale);
                const allocationLabel = formatMinorUnits(allocatedMinor, budgetCurrency, userPrefs.locale === 'system' ? undefined : userPrefs.locale);
                const remainingLabel = categoryMissing ? 'Restore category to track this plan' : budgetStatus.isOver ? 'Above plan' : budgetStatus.percentUsed === null ? 'Set a limit to track remaining' : `${remainingAmountLabel} remaining in plan`;
                return <div key={b.id} className="rounded-2xl border border-[var(--stroke)] lifeos-panel p-4"><div className="flex justify-between text-sm"><strong>{budgetName}</strong><span>{amountLabel} / {allocationLabel}</span></div>{carryoverMinor > 0n && <p className="mt-1 text-xs text-secondary">{formatMinorUnits(carryoverMinor, budgetCurrency, userPrefs.locale === "system" ? undefined : userPrefs.locale)} carried from last month</p>}<div className="lifeos-progress-track mt-3 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${budgetName} usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(budgetStatus.barPercent)} aria-valuetext={budgetStatus.isOver ? overAccessibleLabel : budgetLabel}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${budgetStatus.barPercent}%`, backgroundColor: budgetStatus.isOver ? 'var(--warning)' : undefined }} /></div><div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-secondary"><span>{budgetStatus.isOver ? overLabel : budgetLabel}</span><span>{remainingLabel}</span></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openEditBudget(b)} className="min-h-11 rounded-lg px-3 text-xs font-semibold lifeos-accent-text">Edit budget</button><button aria-label={`Delete ${budgetName}`} onClick={async () => {
                  if (!(await confirmAction({ title: 'Delete this budget?', message: `${budgetName} will be removed. Saved transactions will remain unchanged.`, confirmLabel: 'Delete budget', destructive: true }))) return;
                  try { await StorageService.budgets.delete(b.id); }
                  catch { showToast('Budget deletion could not be confirmed. Refresh before retrying.', 'danger'); return; }
                  setBudgets(current => current.filter(item => item.id !== b.id));
                  try { await reloadAllData(); showToast('Budget plan deleted', 'success'); }
                  catch { showToast('Budget deleted. Reopen Finance to refresh the latest data.', 'info'); }
                }} className="min-h-11 rounded-lg px-3 text-xs text-secondary">Delete plan</button></div></div>;
              })}
            </div>}

            {financeSubtab === 'savings' && <div className="space-y-3">
              <button type="button" onClick={() => navigateFinanceSubtab('projection')} className="money-month-link lifeos-panel">Savings projection <ChevronRight size={16} aria-hidden="true" /></button>
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Savings goals</h3><p className="text-xs text-secondary">Build toward the things you care about</p></div><button onClick={() => openCreateForm('savings')} className="lifeos-accent-button min-h-11 rounded-xl px-3 py-2 text-xs font-semibold">+ Add goal</button></div>
              {savingsGoals.length === 0 ? <div className="rounded-2xl border border-[var(--stroke)] lifeos-panel py-8 text-center text-sm text-secondary">No savings goals yet.</div> : <div className="lifeos-panel rounded-2xl border px-4">{savingsGoals.map(goal => <SavingsGoalProgress key={goal.id} goal={goal} onEditGoal={() => openEditSavingsGoal(goal)} contributions={savingsContributions.filter(item => item.goalId === goal.id)} formatMoney={formatMoney} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale} formatDate={formatDate} onEditContribution={openEditContribution} onDeleteContribution={async contribution => {
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

            {financeSubtab === 'planning' && <div className="space-y-5"><PlannedCashFlow commitments={plannedCommitments} month={financeMonth} currencyCode={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale} /><MoneyPlanning draftState={planningDrafts} transactions={transactions} onDraftStateChange={setPlanningDrafts} saving={financeWriteBusy} commitments={plannedCommitments} rates={manualExchangeRates} accounts={financialAccounts} categories={categories} confirmAction={confirmAction}
              onAddCommitment={async input => { await runPreparedFinanceWrite(() => StorageService.commitments.add(input)); }}
              onUpdateCommitment={async (id, input) => { await runPreparedFinanceWrite(() => StorageService.commitments.update(id, input)); }}
              onRecordOccurrence={async row => { await runPreparedFinanceWrite(() => StorageService.commitments.postOccurrence(row.id, row)); }}
              onDeleteCommitment={async id => { await StorageService.commitments.delete(id); await reloadAllData(); }}
              onAddRate={async input => { await runPreparedFinanceWrite(() => StorageService.exchangeRates.add(input)); }}
              onUpdateRate={async (id, input) => { await runPreparedFinanceWrite(() => StorageService.exchangeRates.update(id, input)); }}
              onDeleteRate={async id => { await StorageService.exchangeRates.delete(id); await reloadAllData(); }} />
              
            </div>}
            {financeSubtab === 'projection' && <Suspense fallback={<ScreenLoading label="Loading savings projection" />}><FinanceProjection currencyCode={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale} /></Suspense>}

            {financeSubtab === 'analytics' && <div className="space-y-4">
              {activeTab === 'finance' && (hasFinanceChartData ? <Suspense fallback={<ScreenLoading label="Loading financial charts…" />}>
                <FinanceCharts analytics={financeAnalytics} theme={theme} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale} formatMoney={formatMoney} month={financeMonth} range={financeAnalyticsRange} onRangeChange={setFinanceAnalyticsRange} />
              </Suspense> : <section className="finance-chart-empty lifeos-panel" aria-label="Financial chart empty state"><strong>No recorded patterns yet</strong><span>Charts appear after you save income or spending. No sample numbers are shown.</span></section>)}
              {(financeAnalytics.largestCategory || financeAnalytics.expenseChange !== null) && <section className="lifeos-panel space-y-2 rounded-2xl border p-4">
                <div className="flex items-center gap-1"><h3 className="type-section-title">What stands out</h3><InfoTip label="Monthly comparison">This compares recorded expenses in the selected month with the preceding month.</InfoTip></div>
                {financeAnalytics.largestCategory && <p className="text-sm"><strong>{financeAnalytics.largestCategory.name}</strong> accounted for {financeAnalytics.largestCategory.percentage.toFixed(1)}% of spending.</p>}
                {financeAnalytics.expenseChange !== null && <p className="text-sm">{financeAnalytics.expenseChange === 0 ? 'Spending matched the previous month.' : 'Spending was ' + Math.abs(financeAnalytics.expenseChange).toFixed(1) + '% ' + (financeAnalytics.expenseChange > 0 ? 'higher' : 'lower') + ' than the previous month.'}</p>}
              </section>}
            </div>}
          </div>
        )} />

        {/* VIEW 3: HABITS */}
        <RetainedScreen active={activeTab === 'habits'} id="screen-habits" {...transitionPropsFor('habits')} render={() => (
          <div className="space-y-4">{renderPlanNavigation('habits')}{lifeDetail?.kind === 'habit' && <button type="button" className="money-back-button" onClick={() => showLifeDetail(null)}><ChevronLeft size={18} aria-hidden="true" />Back to list</button>}
            {!lifeDetail && <div className="life-section-heading">
              <div>
                <h2 className="text-lg font-bold">Habits</h2>
                <p className="text-xs text-secondary">{todayOverview.routinesCompleted} of {todayOverview.routinesDue} done today</p>
              </div>
              <button onClick={() => openCreateForm('habit')} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-xs font-semibold">+ Add habit</button>
            </div>}
            {lifeDetail?.kind === 'habit' && <label className="life-history block text-sm text-secondary">Completion date<input type="date" max={todayKey} value={habitsSelectedDate} onChange={e => { setHabitsSelectedDate(e.target.value); setHistoricalQuantityUnit(''); }} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-2.5 text-sm" /></label>}

            {lifeDetail?.kind === 'habit' && habits.find(item => item.id === lifeDetail.id) && (() => {
              const habit = habits.find(item => item.id === lifeDetail.id)!;
              const stats = getHabitStreaks(habit.id, habitsSelectedDate);
              const weekly = calculateWeeklyHabitRate(habitLogs, habit.id, clockNow, habit.frequency, habit);
              const quantityLog = habitLogs.find(log => log.habitId === habit.id && log.date === habitsSelectedDate && log.quantity !== undefined);
              const quantity = quantityLog?.quantity ?? 0;
              return <section className="lifeos-panel space-y-4 rounded-2xl border p-5" aria-labelledby="habit-detail-title">
                <div><h3 id="habit-detail-title" className="type-page-title safe-wrap">{habit.name}</h3>{habit.description && <p className="mt-1 text-sm text-secondary">{habit.description}</p>}</div>
                <div className="grid grid-cols-2 gap-3"><div className="lifeos-tint rounded-xl p-3"><p className="text-xs text-secondary">Current streak</p><p className="mt-1 text-xl font-semibold">{stats.currentStreak} days</p></div><div className="lifeos-tint rounded-xl p-3"><p className="text-xs text-secondary">This week</p><p className="mt-1 text-xl font-semibold">{weekly.completed}/{weekly.scheduled} · {weekly.rate}%</p></div></div>
                {habit.trackingMode === 'quantity' ? <div className="lifeos-raised rounded-xl p-3"><p className="text-xs text-secondary">{formatDate(habitsSelectedDate)} progress</p><p className="mt-1 text-lg font-semibold tabular-nums">{quantityLog?.quantityUnit ? `${formatHabitQuantity(quantity, quantityLog.quantityUnit)}${quantityLog.quantityUnit === habit.quantityUnit ? ' / ' : ' - target '}${formatHabitQuantity(habit.targetPerDay || 0, habit.quantityUnit)}` : quantityLog ? `${formatHabitQuantity(quantity)} · target ${formatHabitQuantity(habit.targetPerDay || 0, habit.quantityUnit)}` : `0 / ${formatHabitQuantity(habit.targetPerDay || 0, habit.quantityUnit)}`}</p>{quantityLog && !quantityLog.quantityUnit && <div className="mt-3 rounded-xl border border-[var(--stroke)] p-3"><p className="text-xs text-secondary">This older entry has no saved unit. Choose the unit it used before displaying it with a unit.</p><div className="mt-2 flex gap-2"><select aria-label="Historical quantity unit" value={historicalQuantityUnit} onChange={event => setHistoricalQuantityUnit(event.target.value)} className="lifeos-input min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm"><option value="">Choose unit…</option>{[...new Set([habit.quantityUnit, 'glass', 'litre', 'minute', 'page', 'item'].filter(Boolean) as string[])].map(unit => <option key={unit} value={unit}>{unit}</option>)}</select><button type="button" disabled={!historicalQuantityUnit} onClick={async () => { try { await StorageService.habits.setQuantityLogUnit(quantityLog.id, historicalQuantityUnit); setHistoricalQuantityUnit(''); await reloadAllData(); showToast('Historical unit saved', 'success'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not update this entry.', 'danger'); } }} className="lifeos-raised min-h-11 rounded-xl px-3 text-xs font-semibold disabled:opacity-50">Save unit</button></div></div>}<div className="mt-2 flex gap-2"><button type="button" disabled={quantity <= 0} aria-label={`Decrease ${habit.name} quantity`} onClick={() => void handleHabitQuantity(habit, habitsSelectedDate, -1)} className="min-h-11 min-w-14 rounded-xl border border-[var(--stroke)] px-3 text-lg disabled:opacity-50">−</button><button type="button" aria-label={`Add one ${habit.quantityUnit} to ${habit.name}`} onClick={() => void handleHabitQuantity(habit, habitsSelectedDate, 1)} className="lifeos-accent-button min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold">Add 1 {habit.quantityUnit}</button></div></div> : <button type="button" aria-pressed={stats.completedToday} aria-label={`Mark ${habit.name} ${stats.completedToday ? 'incomplete' : 'complete'}`} onClick={() => void handleHabitCompletion(habit.id, habit.name, habitsSelectedDate, stats.completedToday)} className="lifeos-accent-button min-h-12 w-full rounded-xl px-4 text-sm font-semibold">{stats.completedToday ? `Completed on ${formatDate(habitsSelectedDate)} · Undo` : `Mark complete for ${formatDate(habitsSelectedDate)}`}</button>}
                {!isHabitEligible(habit, habitsSelectedDate) && <p role="status" className="text-sm text-secondary">No session scheduled for this date.</p>}
                <button type="button" className="lifeos-raised min-h-11 rounded-xl px-3 text-sm" onClick={async () => {
                  try {
                    const pauses = habit.pauses || [];
                    const last = pauses[pauses.length - 1];
                    const paused = last && !last.through;
                    const yesterday = new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() - 1);
                    const next = paused ? [...pauses.slice(0, -1), ...(last.from < todayKey ? [{ ...last, through: formatLocalDate(yesterday) }] : [])] : [...pauses, { from: todayKey }];
                    await StorageService.habits.update(habit.id, { pauses: next });
                    const rows = await reloadAllData();
                    await syncNotificationSchedules(rows.tasks, rows.habits, rows.goals, rows.milestones);
                  } catch { showToast('Could not confirm the habit change. Refresh Habits before retrying.', 'danger'); }
                }}>{habit.pauses?.some(pause => !pause.through) ? 'Resume habit' : 'Pause habit'}</button>
                <HabitHistory habit={habit} logs={habitLogs} date={habitsSelectedDate} today={todayKey} onSelect={date => { setHabitsSelectedDate(date); setHistoricalQuantityUnit(''); }} formatDate={formatDate} />
                <p className="text-xs text-secondary">Best streak: {stats.longestStreak} days{habit.reminderTime ? ` · Reminder ${habit.reminderTime} local` : ' · No reminder set'}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openEditHabit(habit)} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm font-semibold">Edit habit</button><button type="button" onClick={() => void confirmAction({ title: 'Delete this habit?', message: `“${habit.name}” and its completion history will be removed.`, confirmLabel: 'Delete habit', destructive: true }).then(confirmed => { if (confirmed) void handleHabitDeletion(habit); })} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm text-[var(--danger)]">Delete habit</button></div>
              </section>;
            })()}

            <div className="space-y-2">
              {habits.length === 0 ? (
                <div className="alive-workspace-empty lifeos-panel"><LifeDoodle kind="first-habit" /><p>No habits yet.</p></div>
              ) : (
                habits.filter(h => lifeDetail?.kind !== 'habit').map(h => {
                  const todayStr = todayKey;
                  const logged = h.trackingMode === 'quantity' ? habitLogs.find(log => log.habitId === h.id && log.date === todayStr && log.quantity !== undefined) : undefined;
                  const stats = getHabitStreaks(h.id, todayStr);
                  const weekly = calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency, h);
                  const scheduledToday = isHabitEligible(h, todayStr);
                  const paused = h.pauses?.some(pause => pause.from <= todayStr && !pause.through);
                  const nextCheckIn = !paused && !scheduledToday ? Array.from({ length: 7 }, (_, index) =>
                    formatLocalDate(new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() + index + 1)),
                  ).find(date => isHabitEligible(h, date)) : undefined;
                  const historyDays = Array.from({ length: 7 }, (_, index) => new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() - 6 + index));
                  return (
                      <div key={h.id} className="lifeos-panel rounded-2xl border p-4">
                      <div className="flex items-center gap-3">
                        <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => { setHistoricalQuantityUnit(''); setHabitsSelectedDate(todayKey); showLifeDetail({ kind: 'habit', id: h.id }); }}>
                          <span className="block safe-wrap text-sm font-semibold">{h.name}</span>
                                                    <span className="block text-xs text-secondary">{paused ? 'Paused' : !scheduledToday ? (nextCheckIn ? 'Next check-in ' + formatDate(nextCheckIn) : 'No check-in scheduled') : h.trackingMode === 'quantity' ?
                            (logged?.quantityUnit && logged.quantityUnit !== h.quantityUnit ? formatHabitQuantity(logged.quantity || 0, logged.quantityUnit) :
                              logged && !logged.quantityUnit ? formatHabitQuantity(logged.quantity || 0) :
                              formatHabitQuantity(logged?.quantity || 0, h.quantityUnit) + ' / ' + formatHabitQuantity(h.targetPerDay || 0, h.quantityUnit))
                            : stats.completedToday ? 'Checked in today' : 'Ready to check in'}</span>
                          {stats.currentStreak > 0 && <span className="flex items-center gap-1 text-xs text-secondary">{stats.currentStreak} day streak{stats.currentStreak >= 7 && <LifeDoodle key={Math.floor(stats.currentStreak / 7)} kind="habit-streak" compact />}</span>}
                        </button>
                        {h.trackingMode === 'quantity' ? <button type="button" disabled={!scheduledToday} className="lifeos-raised min-h-11 rounded-xl px-3 text-sm font-semibold" aria-label={`Add one ${h.quantityUnit} to ${h.name}`} onClick={() => void handleHabitQuantity(h, todayStr, 1)}>+1</button>
                          : <button type="button" disabled={!scheduledToday} className="alive-habit-check lifeos-raised min-h-11 rounded-xl px-3 text-sm font-semibold" aria-pressed={stats.completedToday} aria-label={`Mark ${h.name} ${stats.completedToday ? 'incomplete' : 'complete'}`} onClick={() => void handleHabitCompletion(h.id, h.name, todayStr, stats.completedToday)}>{stats.completedToday ? <><Leaf size={16} aria-hidden="true" /> Done</> : 'Check in'}</button>}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-secondary"><span>Weekly completion</span><span className="tabular-nums">{weekly.completed}/{weekly.scheduled} days · {weekly.rate}%</span></div><div role="img" aria-label={`${weekly.completed} of ${weekly.scheduled} scheduled habit days complete this week`} className="mt-1 flex gap-1">{historyDays.map(day => { const dayKey = formatLocalDate(day); const done = habitLogs.some(log => log.habitId === h.id && log.date === dayKey && log.completed); return <span key={dayKey} title={`${dayKey}: ${done ? 'complete' : 'missed'}`} aria-hidden="true" data-checked={done} className="alive-habit-day h-2 flex-1 rounded-full" style={{ backgroundColor: done ? 'var(--success)' : 'var(--surface-raised)' }} />; })}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )} />

        {/* VIEW 4: GOALS */}
        <RetainedScreen active={activeTab === 'goals'} id="screen-goals" {...transitionPropsFor('goals')} render={() => (
          <div className="space-y-4">{renderPlanNavigation('goals')}{lifeDetail?.kind === 'goal' && <button type="button" className="money-back-button" onClick={() => setLifeDetail(null)}><ChevronLeft size={18} aria-hidden="true" />Back to list</button>}
            <div className="flex justify-between items-center"><h2 className="type-section-title">Goals</h2><button onClick={() => openCreateForm('goal')} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-xs font-semibold">+ Add goal</button></div>
            {!lifeDetail && goals.length > 0 && <button type="button" className="min-h-11 text-sm font-semibold lifeos-accent-text" onClick={() => navigateTo('insights')}>Progress insights</button>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['active', 'paused', 'completed', 'archived'] as const).map(tab => <button key={tab} type="button" aria-pressed={goalsSubtab === tab} onClick={() => setGoalsSubtab(tab)} className={`min-h-11 rounded-xl px-2 text-xs capitalize ${goalsSubtab === tab ? 'lifeos-tint lifeos-accent-text font-semibold' : 'lifeos-panel border text-secondary'}`}>{tab}</button>)}</div>
            <select aria-label="Goal category" value={goalsCategoryFilter} onChange={e => setGoalsCategoryFilter(e.target.value)} className="lifeos-input min-h-11 w-full rounded-xl px-3 py-2.5 text-xs"><option value="all">All categories</option>{['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => <option key={category}>{category}</option>)}</select>
            {lifeDetail?.kind === 'goal' && goals.find(item => item.id === lifeDetail.id) && (() => { const goal = goals.find(item => item.id === lifeDetail.id)!; const pct = goalProgress(goal); const rows = milestones.filter(item => item.goalId === goal.id); return <section className="lifeos-panel space-y-4 rounded-2xl border p-5" aria-labelledby="goal-detail-title"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm text-secondary">{goal.category} &middot; {goal.status}</p><h3 id="goal-detail-title" className="type-page-title safe-wrap">{goal.title}</h3>{goal.description && <p className="mt-1 text-sm text-secondary">{goal.description}</p>}</div><span className="rounded-full lifeos-tint px-3 py-1 text-sm font-semibold lifeos-accent-text">{pct}%</span></div><div className="lifeos-progress-track h-3 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${pct}%` }} /></div>{goal.mode !== "milestone" && <p className="text-sm font-medium">{displayGoalMeasure(goal.currentValue, goal.unit)} of {displayGoalMeasure(goal.targetValue, goal.unit)}</p>}<div className="grid grid-cols-2 gap-3 text-xs"><div className="lifeos-tint rounded-xl p-3"><span className="text-secondary">Target date</span><p className="mt-1 font-semibold">{goal.targetDate ? formatDate(goal.targetDate) : "Open-ended"}</p>{goal.targetDate && <p className="text-secondary">{getDaysRemainingText(goal.targetDate)}</p>}</div><div className="lifeos-tint rounded-xl p-3"><span className="text-secondary">Milestones</span><p className="mt-1 font-semibold">{rows.filter(row => row.completed).length} of {rows.length} complete</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openEditGoal(goal)} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm font-semibold">Edit goal</button>{goal.mode !== "milestone" && <button type="button" onClick={() => openGoalProgressForm(goal)} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-sm font-semibold">Update progress</button>}<button type="button" onClick={() => openCreateForm('milestone', goal.id)} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm font-semibold">+ Milestone</button>              {goal.status !== 'Completed' && <button type="button" onClick={() => void changeGoalStatus(goal, goal.status === 'Paused' ? 'In Progress' : 'Paused')} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm">{goal.status === 'Paused' ? 'Resume goal' : 'Pause goal'}</button>}
              <button type="button" className="lifeos-raised min-h-11 rounded-xl px-3 text-sm" onClick={async () => { try { await StorageService.goals.update(goal.id, { archived: !goal.archived }); const rows = await reloadAllData(); await syncNotificationSchedules(rows.tasks, rows.habits, rows.goals, rows.milestones); } catch { showToast("Could not confirm the archive change. Refresh Goals before retrying.", "danger"); } }}>{goal.archived ? "Restore goal" : "Archive goal"}</button>{goal.status !== 'Completed' && <button type="button" onClick={() => void changeGoalStatus(goal, 'Completed')} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm">Complete goal</button>}
              <button type="button" className="lifeos-danger min-h-11 rounded-xl px-4 text-sm" onClick={() => void deleteGoalFromDetails(goal)}>Delete goal</button></div><div><h4 className="text-sm font-semibold">Milestones</h4>{rows.length === 0 ? <p className="mt-2 text-xs text-secondary">No milestones yet.</p> : <ul className="mt-2 divide-y divide-[var(--stroke)]">{rows.map(row => <li key={row.id}><label className="flex min-h-12 cursor-pointer items-center gap-3 py-2"><input type="checkbox" checked={row.completed} onChange={async () => { await StorageService.goals.toggleMilestone(row.id, !row.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} className="h-5 w-5" style={{ accentColor: 'var(--accent)' }} /><span className="min-w-0 flex-1"><span className={`block text-sm ${row.completed ? 'line-through text-secondary' : ''}`}>{row.title}</span>{row.targetDate && <span className="text-xs text-secondary">{formatDate(row.targetDate)} · {getDaysRemainingText(row.targetDate)}</span>}</span>{row.completed && <LifeDoodle kind="goal-milestone" compact />}</label></li>)}</ul>}</div>{(tasks.some(task => task.goalId === goal.id) || habits.some(habit => habit.goalId === goal.id)) && <section aria-label="Linked activity" className="space-y-2"><h4 className="type-section-title">Linked activity</h4><ul className="text-sm text-secondary">{tasks.filter(task => task.goalId === goal.id).map(task => <li key={'task:' + task.id}>{task.title}</li>)}{habits.filter(habit => habit.goalId === goal.id).map(habit => <li key={'habit:' + habit.id}>{habit.name}</li>)}</ul></section>}<AliveDisclosure label="History"><ul className="space-y-2 text-sm text-secondary"><li>Created {formatDate(goal.createdAt.slice(0, 10))}</li>{[...(goal.progressHistory || [])].reverse().map((entry, index) => <li key={index}>{formatDate(entry.at.slice(0, 10))} ? {displayGoalMeasure(entry.value, entry.unit)}</li>)}{goal.updatedAt && <li>Updated {formatDate(goal.updatedAt.slice(0, 10))}</li>}{rows.filter(row => row.completed && row.completedAt).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).map(row =><li key={row.id}>{formatDate((row.completedAt || '').slice(0, 10))} &middot; {row.title}</li>)}</ul></AliveDisclosure></section>; })()}
            {lifeDetail?.kind !== 'goal' && (() => {
              const visibleGoals = goals.filter(goal => (goalsSubtab === 'archived' ? goal.archived : !goal.archived && goal.status === (goalsSubtab === 'active' ? 'In Progress' : goalsSubtab === 'paused' ? 'Paused' : 'Completed')) && (goalsCategoryFilter === 'all' || goal.category === goalsCategoryFilter));
              if (!visibleGoals.length) return <div className="goal-empty-state text-sm text-secondary">{goals.length === 0 && <LifeDoodle kind="first-goal" />}<p>{goalsCategoryFilter !== 'all' ? 'No goals in this category.' : goalsSubtab === 'completed' ? 'No completed goals yet.' : goalsSubtab === 'paused' ? 'No paused goals.' : goalsSubtab === 'archived' ? 'No archived goals.' : 'No active goals yet.'}</p></div>;
              return <div className="goal-list">{visibleGoals.map(g => {
                const pct = goalProgress(g);
                return <article key={g.id} className="lifeos-panel goal-journey-card" data-complete={g.status === 'Completed'}>
                  <button type="button" onClick={() => showLifeDetail({ kind: 'goal', id: g.id })} className="goal-card-open">
                    <span className="min-w-0 safe-wrap"><strong>{g.title}</strong><small>{g.category}{g.targetDate ? ` ? ${formatDate(g.targetDate)}` : ""}</small></span>
                    <span className="goal-percent tabular-nums">{pct}%</span>
                  </button>
                  <div className="lifeos-progress-track h-2 overflow-hidden rounded-full" role="progressbar" aria-label={g.title + ' progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: pct + '%' }} /></div>
                  <p className="text-sm text-secondary safe-wrap">{g.mode === "milestone" ? `${milestones.filter(row => row.goalId === g.id && row.completed).length} of ${milestones.filter(row => row.goalId === g.id).length} milestones` : `${displayGoalMeasure(g.currentValue, g.unit)} / ${displayGoalMeasure(g.targetValue, g.unit)}`} {g.status === 'Completed' && <strong className="goal-completed-label">Completed</strong>}</p>
                </article>;
              })}</div>;
            })()}
          </div>
        )} />

        {/* VIEW 5: PLANNER */}
        <RetainedScreen active={activeTab === 'planner'} id="screen-planner" {...transitionPropsFor('planner')} render={() => (
          <>
          <div className="space-y-4">

            <div className="flex items-end justify-between gap-3"><div><p className="type-eyebrow">PLANNER</p><h2 ref={plannerHeadingRef} tabIndex={-1} className="type-page-title">Tasks by date</h2></div><button onClick={() => openCreateForm('task', undefined, plannerFilter === 'unscheduled' ? undefined : plannerSelectedDate)} className="lifeos-accent-button min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98]">+ Add task</button></div>
            <div className="planner-range-nav" role="group" aria-label="Choose task range" data-no-tab-swipe>
              {(['today', 'tomorrow', 'upcoming', 'unscheduled'] as const).map((range, index) => <button key={range} type="button" aria-pressed={plannerFilter === range || (plannerFilter === 'all' && range === 'today' && plannerSelectedDate === todayKey)} onClick={() => setPlannerFilter(range)}>{index === 2 ? 'Next 7 days' : range[0].toUpperCase() + range.slice(1)}</button>)}
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
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold">{plannerFilter === 'today' ? 'Today' : plannerFilter === 'tomorrow' ? 'Tomorrow' : plannerFilter === 'upcoming' ? 'Upcoming' : plannerFilter === 'unscheduled' ? 'Unscheduled' : selectedPlannerDateLabel}</h3><p className="text-xs text-secondary">{visiblePlannerTasks.length} task{visiblePlannerTasks.length === 1 ? '' : 's'}</p></div></div>
              <details className="planner-filters">
                <summary><Search size={15} aria-hidden="true" />Search and filters</summary>
                <div className="planner-filter-fields"><input aria-label="Search planner tasks" value={plannerSearch} onChange={e => setPlannerSearch(e.target.value)} placeholder="Search tasks" className="lifeos-input min-h-11 w-full rounded-xl px-3 py-2.5 text-sm" />
                  <div className="grid grid-cols-2 gap-2"><select aria-label="Task date or status filter" value={plannerFilter} onChange={e => setPlannerFilter(e.target.value as typeof plannerFilter)} className="lifeos-input min-h-11 rounded-xl px-3 py-2.5 text-xs">{['all', 'today', 'tomorrow', 'upcoming', 'unscheduled', 'pending', 'overdue', 'completed'].map(filter => <option key={filter} value={filter}>{filter === 'all' ? 'Selected day · all' : filter[0].toUpperCase() + filter.slice(1)}</option>)}</select><select aria-label="Task priority filter" value={plannerPriority} onChange={e => setPlannerPriority(e.target.value)} className="lifeos-input min-h-11 rounded-xl px-3 py-2.5 text-xs"><option value="all">All priorities</option>{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></div>
                </div>
              </details>

            {visiblePlannerTasks.length === 0 ? (
              <div className="lifeos-panel rounded-2xl border px-5 py-9 text-center"><div className="lifeos-raised mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-secondary"><CalendarDays size={20} /></div><p className="text-sm font-medium">Nothing planned for this view</p><p className="mt-1 text-xs text-secondary">Choose another day or add a task when you’re ready.</p><button onClick={() => openCreateForm('task', undefined, plannerFilter === 'unscheduled' ? undefined : plannerSelectedDate)} className="lifeos-accent-button mt-4 min-h-11 rounded-xl px-4 text-xs font-semibold">Add a task</button></div>
            ) : (
              <div className="space-y-2">
                {visiblePlannerTasks.map(t => {
                  const status = getTaskStatus(t, clockNow);
                  const dateGroup = upcomingTaskGroups.find(group => group.tasks[0]?.id === t.id);
                  return <React.Fragment key={t.id}>{plannerFilter === 'upcoming' && dateGroup && <h4 className="planner-date-group-title" aria-label={`${dateGroup.label}, ${dateGroup.tasks.length} task${dateGroup.tasks.length === 1 ? '' : 's'}`}>{dateGroup.label}<span>{dateGroup.tasks.length}</span></h4>}<div role="button" tabIndex={0} aria-label={`Open task ${t.title}`} onClick={event => { taskDetailReturnTabRef.current = null; taskDetailReturnFocusRef.current = event.currentTarget; setPlannerDetailTaskId(t.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); taskDetailReturnTabRef.current = null; taskDetailReturnFocusRef.current = event.currentTarget; setPlannerDetailTaskId(t.id); } }} className="lifeos-panel flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3.5 transition hover:border-[var(--accent)]" style={{ borderColor: status === 'Overdue' ? 'var(--danger)' : undefined }}>
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
                        <p className="text-xs text-secondary">{t.dueDate ? `Due ${formatDate(t.dueDate)}` : 'No due date'}{t.dueTime ? ` · ${formatClockTime(t.dueTime)}` : t.dueDate ? ' · end of day' : ''}</p>
                        <div className="mt-1 flex gap-1"><span className="lifeos-raised rounded px-1.5 py-0.5 text-[10px] text-secondary">{t.priority}</span><span className="lifeos-raised rounded px-1.5 py-0.5 text-[10px]" style={{ color: status === 'Overdue' ? 'var(--danger)' : status === 'Completed' ? 'var(--success)' : 'var(--accent)' }}>{status}</span>{t.recurring !== 'None' && <span className="lifeos-raised rounded px-1.5 py-0.5 text-[10px] text-secondary">{t.recurring}</span>}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2"><button onClick={async event => { event.stopPropagation(); if (!(await confirmAction({ title: 'Delete this task?', message: `“${t.title}” will be removed from your plan.`, confirmLabel: 'Delete task', destructive: true }))) return; await NotificationService.cancelTask(t); await StorageService.tasks.delete(t.id); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Task removed', 'info'); }} className="lifeos-danger min-h-11 rounded-lg px-3 text-xs">Delete</button></div>
                  </div></React.Fragment>
                })}
              </div>
            )}
            </section>
          </div>
          </>
        )} />

        </div>
      </main>

        {/* VIEW 6: SETTINGS */}
      <AnimatePresence initial={false}>
        {activeTab === 'planner' && plannerDetailTask && <TaskDetailScreen task={plannerDetailTask} key={plannerDetailTask.id} reducedMotion={interfaceMotion.reducedMotion} status={getTaskStatus(plannerDetailTask, clockNow)} dueLabel={plannerDetailTask.dueDate ? `${formatDate(plannerDetailTask.dueDate)}${plannerDetailTask.dueTime ? ` · ${formatClockTime(plannerDetailTask.dueTime)}` : ' · end of day'}` : 'No due date'} reminderLabel={[!plannerDetailTask.dueAlertDisabled && plannerDetailTask.dueDate && (plannerDetailTask.dueTime || dateOnlyAlertTime) ? 'At due time' : '', plannerDetailTask.reminderLeadMinutes ? plannerDetailTask.reminderLeadMinutes + ' min before' : plannerDetailTask.reminderAt ? formatDateTime(new Date(plannerDetailTask.reminderAt)) : ''].filter(Boolean).join(' / ') || 'No alert'} onBack={closeTaskDetail} onEdit={() => openEditTask(plannerDetailTask)} onDelete={async () => {
              if (!await confirmAction({ title: 'Delete this task?', message: 'This will remove the task and its alerts.', confirmLabel: 'Delete task', destructive: true })) return;
              try {
                await StorageService.tasks.delete(plannerDetailTask.id);
                closeTaskDetail();
                const records = await reloadAllData();
                await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(notificationPreferences, notificationsEnabled));
                showToast('Task removed', 'info');
              } catch { showToast('Could not finish removing the task. Refresh your plan before retrying.', 'danger'); }
            }} onToggle={async () => { await StorageService.tasks.toggleCompleted(plannerDetailTask.id, !plannerDetailTask.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} onSubtasks={async subtasks => { await StorageService.tasks.update(plannerDetailTask.id, { subtasks }); await reloadAllData(); }} reminderContent={developerToolsEnabled && <details className="task-reminder-details"><summary>Reminder help</summary><p className="text-xs text-secondary">Android may delay reminders when the device is idle. LifeOS will not change your task when you check its status.</p>{plannerDetailTask.reminderAt ? <button type="button" onClick={() => void diagnosePlannerTaskReminder(plannerDetailTask)} className="mt-2 min-h-11 rounded-lg px-2 text-xs font-semibold lifeos-accent-text">Check reminder status</button> : <p className="mt-2 text-xs text-secondary">No scheduled reminder is set. Automatic overdue alerts are separate and can be changed in Settings → Notifications.</p>}{taskReminderDiagnostics?.taskReference === plannerDetailTask.id && <ReminderStatusSummary report={taskReminderDiagnostics} reminderAt={plannerDetailTask.reminderAt} />}</details>} />}
      </AnimatePresence>
      {profileOpen && <ProfileDrawer section={profileSection} scrollPositions={profileScroll.current} onBack={backFromProfile} closing={profileClosing} onExited={finishProfileClose} preset={interfaceMotion.preset} reduced={interfaceMotion.reducedMotion} swipeEnabled={userPrefs.swipeNavigationEnabled}>
          <div className="profile-page space-y-5">
            {profileSection === 'home' && <ProfileHome name={displayName} initial={profileInitial(displayName)} developerAllowed={developerToolsEnabled} securityStatus={recoveryProvisioned ? 'Recovery ready' : biometricEnabled ? 'App lock enabled' : 'Review protection'} onNameChange={updateDisplayName} photo={profilePhoto} photoBusy={profilePhotoBusy} photoError={profilePhotoError} onPhotoChange={changeProfilePhoto} onOpen={section => { navigateProfileSection(section); if (section === 'notifications' || section === 'developer') void refreshNotificationDiagnostics(); }} />}

            {profileSection === 'privacy' && <ProfileSubpage title="Privacy & security" onBack={() => navigateProfileSection('home')}>
              <div className="preference-group"><ProfileSettingRow title="App lock" value={biometricEnabled ? 'On' : 'Off'} onClick={() => navigateProfileSection('app-lock')} />
                <ProfileSettingRow title="Recovery" value={recoveryProvisioned ? 'Ready' : 'Not set up'} onClick={() => navigateProfileSection('recovery')} /></div>
            </ProfileSubpage>}
            {profileSection === 'app-lock' && <ProfileSubpage title="App lock" backLabel="Privacy & security" onBack={() => navigateProfileSection('privacy')}>
              <div className="preference-group py-3"><div className="flex items-center gap-2 text-sm font-semibold">Device protection <InfoTip label="Device protection">Android verifies your device credential or biometrics. LifeOS does not store your fingerprint.</InfoTip></div>
              <div className="lifeos-raised flex items-center justify-between gap-2 rounded-xl p-3"><div><p className="text-xs font-medium">Biometric lock</p><p className="mt-1 text-xs text-secondary">{deviceCredentialOnly ? 'Device screen lock available' : biometricAvailability}</p></div><button role="switch" aria-checked={biometricEnabled} onClick={async () => { if (biometricEnabled) { setBiometricEnabled(false); setBiometricVerified(false); setIsLocked(false); await StorageService.settings.set('biometricLockEnabled', false); showToast('Biometric lock disabled', 'success'); return; } const result = await handleEnableBiometric(); if (result.success) showToast('Biometric lock enabled', 'success'); else showToast(result.message || 'Could not enable biometric lock', 'danger'); }} className={`min-h-11 min-w-16 rounded-full px-3 text-xs font-bold ${biometricEnabled ? 'lifeos-accent-button' : 'lifeos-panel border text-secondary'}`}>{biometricEnabled ? 'On' : 'Off'}</button></div>
              {biometricEnabled && <p className="flex items-center gap-1 text-[11px]" style={{ color: biometricVerified ? 'var(--success)' : 'var(--warning)' }}>{biometricVerified ? <ShieldCheck size={14} /> : <Shield size={14} />}{biometricVerified ? 'Biometric verified for this session' : 'Protected; authenticate to unlock'}</p>}

              </div>
            </ProfileSubpage>}
            {profileSection === 'recovery' && <ProfileSubpage title="Recovery" backLabel="Privacy & security" onBack={() => navigateProfileSection('privacy')}>
              <div className="preference-group py-3">
              {onboardingJourney.recoveryName && <p className="text-xs text-secondary">Recovery name: <strong>{onboardingJourney.recoveryName}</strong>. This label cannot restore data without your separate recovery kit.</p>}
              {recoveryProvisioned ? <p className="text-xs text-secondary">Encrypted recovery kit confirmed.</p> : recoveryDeferred ? <div className="lifeos-raised rounded-xl p-3"><p className="text-xs font-medium">Recovery kit not set up</p><p className="mt-1 text-xs text-secondary">Your records remain encrypted on this device. Set up a recovery kit to restore access if this device key is lost.</p><button type="button" onClick={() => void setupRecoveryFromSettings()} className="lifeos-accent-button mt-3 min-h-11 rounded-xl px-4 text-xs font-semibold">Set up recovery kit</button></div> : null}

                {!recoveryProvisioned && !recoveryDeferred && <p className="py-2 text-sm">Set up device protection before preparing a recovery file.</p>}
              </div>
            </ProfileSubpage>}

            {profileSection === 'appearance' && <ProfileSubpage title="Appearance" onBack={() => navigateProfileSection('home')}>
              <section className="lifeos-panel rounded-2xl border p-4 space-y-3" aria-label="Display mode"><h2 className="text-sm font-semibold">Display mode</h2>
              <div className="grid grid-cols-3 gap-2">{([['dark', 'Dark', Moon], ['light', 'Light', Sun], ['system', 'System', Smartphone]] as const).map(([value, label, Icon]) => <button key={value} type="button" aria-pressed={appearance === value} onClick={() => void applyAppearance(value)} className={`lifeos-panel flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-semibold ${appearance === value ? 'lifeos-tint lifeos-accent-text' : 'text-secondary'}`}><Icon size={14} />{label}</button>)}</div>

              </section>
              <div className="preference-group"><ProfileSettingRow title="Themes" value={THEME_CATALOG[visualThemeId].label} onClick={() => navigateProfileSection('themes')} />
                <ProfileSettingRow title="Accent color" value={customAccent ? 'Custom' : 'Theme default'} onClick={() => navigateProfileSection('accent')} />
                <ProfileSettingRow title="Motion" onClick={() => navigateProfileSection('motion')} /></div>
            </ProfileSubpage>}
            {profileSection === 'themes' && <ProfileSubpage title="Themes" backLabel="Appearance" onBack={() => navigateProfileSection('appearance')}>
              <section className="lifeos-panel rounded-2xl border p-4 space-y-3" aria-label="Theme previews">
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

              </section>
            </ProfileSubpage>}
            {profileSection === 'motion' && <ProfileSubpage title="Motion" backLabel="Appearance" onBack={() => navigateProfileSection('appearance')}>
              <MotionPreferences value={interfaceMotion.preset} onChange={interfaceMotion.setPreset} saving={interfaceMotion.saving} error={interfaceMotion.error} reducedMotion={interfaceMotion.reducedMotion} />
            </ProfileSubpage>}
            {profileSection === 'accent' && <ProfileSubpage title="Accent color" backLabel="Appearance" onBack={() => navigateProfileSection('appearance')}>
              <CustomAccentPicker value={customAccent} onChange={color => { void applyCustomAccent(color); }} themeId={themePreviewId || visualThemeId} mode={theme} />
            </ProfileSubpage>}

            {profileSection === 'preferences' && <ProfileSubpage title="Preferences" description="Choose how LifeOS displays dates, amounts and measurements." onBack={() => navigateProfileSection('home')}><ProfilePreferences dateOnlyAlertTime={dateOnlyAlertTime} onDateOnlyAlertTime={async time => {
              try {
                await StorageService.settings.set('dateOnlyAlertTime', time);
                setDateOnlyAlertTime(time);
                if (!await syncNotificationSchedules(tasks, habits, goals, milestones, effectiveNotificationPreferences(notificationPreferences, notificationsEnabled))) showToast('Saved, but Android could not update some alerts.', 'danger');
              } catch { showToast('Could not save alert time.', 'danger'); }
            }} preferences={userPrefs} hasFinancialRecords={transactions.length > 0 || budgets.length > 0 || savingsGoals.length > 0} onChange={(key, value) => { void saveUserPreference(key, value); }} /></ProfileSubpage>}

            {profileSection === 'notifications' && <ProfileSubpage title="Notifications" onBack={() => navigateProfileSection('home')}>
              <section className="preference-group">
                <button type="button" className="preference-row" role="switch" aria-label="All notifications" aria-checked={notificationsEnabled} onClick={() => void setNotificationsMaster(!notificationsEnabled)}><span>All notifications</span><span className="preference-toggle" aria-hidden="true" /></button>
                {(notificationDiagnostics.permission === 'denied' || notificationDiagnostics.appNotifications === 'disabled' || notificationDiagnostics.channel.startsWith('blocked')) ?
                  <ProfileSettingRow title="Notifications blocked by Android" value="Resolve" onClick={() => void openNotificationSettings()} />
                  : notificationsEnabled && notificationDiagnostics.permission === 'granted' && (notificationDiagnostics.exactAlarm !== 'granted' ?
                    <ProfileSettingRow title="Precise reminders are off" value="Enable" onClick={() => void requestExactAlarmAccess()} />
                    : <p className="preference-row">Precise reminders <span className="text-secondary">Enabled</span></p>)}
              </section>
              <section className="preference-group" aria-label="Reminder style">
                <PreferenceChoice label="Notification tone" value={notificationTone} options={NOTIFICATION_TONES.map(tone => [tone, tone[0].toUpperCase() + tone.slice(1)])} onSelect={async value => {
                  const tone = normalizeNotificationTone(value);
                  try {
                    await StorageService.settings.set('notificationTone', tone);
                    setNotificationTone(tone);
                    if (!await syncNotificationSchedules(tasks, habits, goals, milestones)) showToast('Tone saved. Some reminders could not refresh.', 'danger');
                  } catch { showToast('Could not save notification tone.', 'danger'); }
                }} />
                <p className="pb-3 text-sm text-secondary">{reminderCopy('habitReminder', notificationTone, 0).body}</p>
                <ProfileSettingRow title="Sound and vibration" value="Android settings" onClick={() => void openNotificationSettings()} />
              </section>
              <section className="preference-group" aria-label="Notification categories">
                {(Object.keys(notificationLabels) as (keyof NotificationPreferences)[]).map(key => <button type="button" key={key} role="switch" aria-label={notificationLabels[key]} aria-checked={notificationsEnabled && notificationPreferences[key]} disabled={!notificationsEnabled} onClick={() => void toggleNotificationCategory(key)} className="preference-row"><span>{notificationLabels[key]}</span><span className="preference-toggle" aria-hidden="true" /></button>)}
              </section>
            </ProfileSubpage>}

            {developerToolsEnabled && profileSection === 'developer' && <ProfileSubpage title="Developer tools" description="Build diagnostics and isolated demonstration tools." onBack={() => navigateProfileSection('home')}>
                <details className="rounded-xl border border-[var(--stroke)] p-3">
                  <summary className="min-h-11 content-center cursor-pointer text-sm font-semibold">Motion diagnostics</summary>
                  <p className="text-xs text-secondary">Preset {interfaceMotion.preset} · Reduced motion {interfaceMotion.reducedMotion ? 'on' : 'off'} · Decorative motion {document.documentElement.dataset.motionBudget === 'constrained' ? 'limited' : 'full'}</p>
                  {navigationMotion.latest.current && <p className="mt-2 text-xs text-secondary">
                    Last primary transition {Math.round(navigationMotion.latest.current.durationMs)} ms · {navigationMotion.latest.current.interrupted ? 'interrupted' : 'settled'}
                    {navigationMotion.latest.current.p95FrameMs != null && ` · Frame p95 ${navigationMotion.latest.current.p95FrameMs.toFixed(1)} ms · ${navigationMotion.latest.current.overruns} overruns`}
                  </p>}
                </details>
              <section className="lifeos-panel rounded-xl border p-4 space-y-3"><h2 className="text-sm font-semibold">Notification diagnostics</h2>
                <div className="space-y-1 rounded-xl border border-[var(--stroke)] p-3 text-xs text-secondary"><p>Capability: {notificationDiagnostics.capability} · {notificationDiagnostics.platform}</p><p>Build: {notificationDiagnostics.versionName || notificationDiagnostics.build.appVersion} ({notificationDiagnostics.build.commit}) · API {notificationDiagnostics.androidApi ?? 'unknown'}</p><p>Capacitor: {notificationDiagnostics.build.capacitor.core} / {notificationDiagnostics.build.capacitor.localNotifications}</p><p>Android permission: {notificationDiagnostics.permission} · App notifications: {notificationDiagnostics.appNotifications}</p><p>Exact alarms: {notificationDiagnostics.exactAlarm} · Channel: {notificationDiagnostics.channel}</p><p>Pending records: {notificationDiagnostics.pendingCount} · Visible: {notificationDiagnostics.visibleNotificationCount} · IDs {notificationDiagnostics.visibleNotificationIds.join(', ') || 'none'}</p><p>Last schedule: {notificationDiagnostics.lastScheduleAttempt || 'unknown'} · {notificationDiagnostics.lastScheduleResult}</p><p>Last cancellation: {notificationDiagnostics.lastCancellationReason || 'none'} · Last action: {notificationDiagnostics.lastActionEvent ? `${notificationDiagnostics.lastActionEvent.kind}, ${notificationDiagnostics.lastActionEvent.at}` : 'unknown'}</p><p>Last scheduling error: {notificationDiagnostics.lastError || 'none'}</p></div>
                {developerToolsEnabled && notificationDiagnostics.reminderLifecycle.length > 0 && <details className="rounded-xl border border-[var(--stroke)] p-3"><summary className="min-h-11 cursor-pointer text-xs font-semibold">Reminder timeline · no task titles</summary><ol className="mt-2 space-y-2">{notificationDiagnostics.reminderLifecycle.map(item => <li key={item.notificationId} className="border-t border-[var(--stroke)] pt-2 text-[10px] leading-5 text-secondary"><strong>Reminder {item.notificationId}</strong> · {item.deliveryState}<br />Scheduled: {item.reminderAt}<br />Accepted: {item.nativeAcceptedAt || 'not observed'} · Pending: {item.pendingObservedAt || 'not observed'}<br />Android posted: {item.androidPostedAt || 'not observed'} · Receiver event: {item.receiverEventAt || 'not observed'} · Tapped: {item.tappedAt || 'not observed'}</li>)}</ol></details>}
                <div className="grid grid-cols-2 gap-2"><button onClick={async () => { try { const at = await NotificationService.testNotification(); await refreshNotificationDiagnostics(); showToast(`Scheduled test for ${at.toLocaleTimeString()}; check whether it arrives.`, 'success'); } catch (error) { await refreshNotificationDiagnostics(); showToast(error instanceof Error ? error.message : 'Test notification failed', 'danger'); } }} className="lifeos-accent-button min-h-11 rounded-xl px-3 text-xs font-semibold">Schedule test · 10 sec</button><button onClick={async () => { try { const at = await NotificationService.sendImmediateTestNotification(); await refreshNotificationDiagnostics(); showToast(`Immediate test requested for ${at.toLocaleTimeString()}; check whether it arrives.`, 'success'); } catch (error) { await refreshNotificationDiagnostics(); showToast(error instanceof Error ? error.message : 'Immediate test failed', 'danger'); } }} className="lifeos-panel min-h-11 rounded-xl border px-3 text-xs font-semibold">Immediate test</button><button onClick={() => void openNotificationSettings()} className="col-span-2 lifeos-panel min-h-11 rounded-xl border px-3 text-xs font-semibold">Android notification settings</button></div>
                <button onClick={() => void refreshNotificationDiagnostics()} className="min-h-11 w-full rounded-xl border border-[var(--stroke)] text-xs font-medium text-secondary">Refresh diagnostics</button><button onClick={() => void copyNotificationDiagnostics()} className="min-h-11 w-full rounded-xl border border-[var(--stroke)] text-xs font-medium text-secondary">Copy privacy-safe diagnostics</button>
              </section>
<button onClick={async () => { if (!(await confirmAction({ title: 'Reset onboarding for testing?', message: 'Your records will remain untouched. Choices made during onboarding may update your name, appearance, security, and notification preferences.', confirmLabel: 'Restart tour' }))) return; await StorageService.settings.set('onboardingCompleted', false); await StorageService.settings.set('onboardingStarted', true); await StorageService.settings.set('onboardingStep', 0); setOnboardingStep(0); setOnboardingComplete(false); setOnboardingRequired(true); }} className="min-h-11 rounded-xl border border-[var(--stroke)] px-3 text-xs font-medium">Reset onboarding for testing</button>
              <section className="lifeos-panel rounded-xl p-4 space-y-3">
                <h2 className="text-sm font-semibold">Sample data</h2>
                <p className="text-xs text-secondary">Six months of activity for exploring LifeOS. Sample task reminders are silent.</p>
                <button disabled={!isEncryptedStorageActivated() || isLocked} onClick={async () => {
                  if (!await confirmAction({ title: 'Add six months of sample data?', message: 'Sample records will appear alongside records in this Debug workspace. You can remove them here.', confirmLabel: 'Add sample data' })) return;
                  try { await StorageService.backup.seedDemoData(); await reloadAllData(); showToast('Sample data is ready', 'success'); }
                  catch (error) { showToast(error instanceof Error ? error.message : 'Could not add sample data', 'danger'); }
                }} className="lifeos-accent-button min-h-11 w-full rounded-xl px-3 text-sm disabled:opacity-50">Add sample data</button>
                <button disabled={!isEncryptedStorageActivated() || isLocked} onClick={async () => {
                  if (!await confirmAction({ title: 'Remove sample data?', message: 'Removes the sample set and activity linked to its habits and goals.', confirmLabel: 'Remove sample data' })) return;
                  try { await StorageService.backup.removeSampleData(); await reloadAllData(); showToast('Sample data removed', 'success'); }
                  catch (error) { showToast(error instanceof Error ? error.message : 'Could not remove sample data', 'danger'); }
                }} className="lifeos-input min-h-11 w-full rounded-xl px-3 text-sm disabled:opacity-50">Remove sample data</button>
              </section>
            </ProfileSubpage>}

            {profileSection === 'data' && <ProfileSubpage title="Backup & Restore" description="Manage encrypted copies and local records." onBack={() => navigateProfileSection('home')}>
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
            {profileSection === 'about' && <ProfileSubpage title="About LifeOS" onBack={() => navigateProfileSection('home')}>
              <div className="preference-group"><div className="preference-row"><span>Version</span><span className="text-secondary">{packageInfo.version}</span></div>
                <ProfileSettingRow title="Open-source licenses" onClick={() => navigateProfileSection('licenses')} /></div>
            </ProfileSubpage>}
            {profileSection === 'licenses' && <ProfileSubpage title="Open-source licenses" backLabel="About LifeOS" onBack={() => navigateProfileSection('about')}>
              <LicenseText />
            </ProfileSubpage>}
          </div>
      </ProfileDrawer>}

      {transactionDetail && <dialog ref={transactionDetailDialog} data-transaction-details className="transaction-detail-sheet lifeos-page" aria-labelledby="transaction-detail-title" onClose={() => setTransactionDetailId(null)} onClick={event => { if (event.currentTarget === event.target) event.currentTarget.close(); }}>
        <section>
          <header className="flex items-center justify-between gap-3"><h2 id="transaction-detail-title" className="text-xl font-semibold">{transactionDetail.description || transactionDetail.category}</h2><button type="button" className="min-h-11 px-3" onClick={() => transactionDetailDialog.current?.close()}>Close</button></header>
          <strong className="type-display-amount tabular-nums">{transactionDetail.type === 'income' ? '+' : '-'}{transactionDetail.amountMinor != null && transactionDetail.currencyCode ? formatMinorUnits(BigInt(transactionDetail.amountMinor), transactionDetail.currencyCode, userPrefs.locale === 'system' ? undefined : userPrefs.locale) : formatMoney(transactionDetail.amount, transactionDetail.currencyCode)}</strong>
          <dl className="grid grid-cols-2 gap-3"><div><dt className="text-xs text-secondary">Date</dt><dd>{formatDate(transactionDetail.date)}</dd></div><div><dt className="text-xs text-secondary">Category</dt><dd>{transactionDetail.category}</dd></div><div><dt className="text-xs text-secondary">Payment</dt><dd>{transactionDetail.paymentMethod || 'Other'}</dd></div>{transactionDetail.accountId && <div><dt className="text-xs text-secondary">Account</dt><dd>{financialAccounts.find(account => account.id === transactionDetail.accountId)?.name || 'Archived account'}</dd></div>}</dl>
          {transactionDetail.notes && <p className="whitespace-pre-wrap break-words text-sm">{transactionDetail.notes}</p>}
          <div className="flex flex-wrap gap-3"><button type="button" className="lifeos-accent-button min-h-11 flex-1 rounded-xl px-4 font-semibold" onClick={() => { transactionDetailDialog.current?.close(); openEditTransaction(transactionDetail); }}>Edit transaction</button><details className="lifeos-input rounded-xl px-3"><summary className="min-h-11 content-center cursor-pointer">More actions</summary><button type="button" className="block min-h-11 w-full text-left" onClick={() => { transactionDetailDialog.current?.close(); openDuplicateTransaction(transactionDetail); }}>Duplicate</button><button type="button" className="block min-h-11 w-full text-left text-[var(--danger)]" onClick={async () => {
            const id = transactionDetail.id;
            transactionDetailDialog.current?.close();
            if (!await confirmAction({ title: 'Delete this transaction?', message: 'It will be removed from your history.', confirmLabel: 'Delete transaction', destructive: true })) return;
            try { await StorageService.transactions.delete(id); await reloadAllData(); showToast('Transaction deleted', 'info'); }
            catch { showToast('Could not finish deleting the transaction. Refresh before retrying.', 'danger'); }
          }}>Delete transaction</button></details></div>
        </section>
      </dialog>}
      <AnimatePresence initial={false}>
      {createKind && (
        <RecordComposerLayer key={createKind} full={!['contribution', 'milestone', 'goal-progress'].includes(createKind)} dismiss={requestCloseForm}>
          <m.form id="record-dialog"
            initial={createKind === 'task' && !interfaceMotion.reducedMotion ? { transform: 'translate3d(100%,0,0)' } : false}
            animate={createKind === 'task' ? { transform: 'translate3d(0%,0,0)' } : undefined}
            exit={createKind === 'task' && !interfaceMotion.reducedMotion ? { transform: 'translate3d(100%,0,0)', transition: { duration: .27, ease: [.32, 0, .67, 1] } } : undefined}
            transition={createKind === 'task' && !interfaceMotion.reducedMotion ? { type: 'spring', duration: .34, bounce: 0 } : { duration: 0 }}
            onInvalid={event => {
            event.preventDefault();
            const target = event.target as HTMLInputElement;
            const error = event.currentTarget.querySelector('[data-record-validation]');
            if (error) error.textContent = target.validity.valueMissing ? 'Complete the highlighted field.' : 'Check the highlighted value.';
            if (!event.currentTarget.querySelector(':focus:invalid')) requestAnimationFrame(() => { if (target.isConnected) target.focus(); });
          }} onSubmit={saveNewRecord} onChange={() => setCreateFormDirty(true)} role="dialog" aria-modal="true" aria-labelledby="record-form-title" aria-describedby="record-form-description" aria-busy={recordSaving} className={`ui-bottom-sheet lifeos-panel record-composer ${createKind === 'task' ? 'task-composer' : 'ui-sheet-motion'}`} onMouseDown={event => event.stopPropagation()}>
            <div className="record-composer-header mb-4 flex items-center justify-between">
              <h2 id="record-form-title" className="text-lg font-bold">{editingTransactionId ? 'Edit transaction' : editingGoalId ? 'Edit goal' : editingTaskId ? 'Edit task' : editingHabitId ? 'Edit habit' : editingContributionId ? 'Edit savings contribution' : editingSavingsGoalId ? 'Edit savings goal' : createKind === 'budget' ? (editingBudgetId ? 'Edit monthly budget' : 'Set monthly budget') : createKind === 'contribution' ? 'Add savings contribution' : createKind === 'savings' ? (editingSavingsGoalId ? 'Edit savings goal' : 'Add savings goal') : createKind === 'milestone' ? 'Add goal milestone' : createKind === 'goal-progress' ? 'Update goal progress' : createKind === 'task' ? 'Create Task' : `Add ${createKind}`}</h2>
              <button type="button" aria-label="Close" disabled={recordSaving} onClick={requestCloseForm} className="lifeos-panel min-h-11 min-w-11 rounded-lg border text-secondary">{createKind === 'task' ? <ChevronLeft size={22} aria-hidden="true" /> : '✕'}</button>
            </div>
            <p data-record-validation role="alert" className="record-validation text-sm text-[var(--danger)]" />
            <p id="record-form-description" className="sr-only">Enter the record details and save your changes.</p>
            {!['budget', 'contribution', 'goal-progress'].includes(createKind) && <label className={createKind === 'task' ? "task-title-field block text-xs text-secondary" : "mb-3 block text-xs text-secondary"}>
              {createKind === 'transaction' ? 'Merchant or description (optional)' : createKind === 'habit' ? 'Habit name' : createKind === 'goal' || createKind === 'savings' ? 'Goal title' : createKind === 'milestone' ? 'Milestone title' : 'Task title'}
              <input placeholder={createKind === 'task' ? 'What needs to be done?' : undefined} autoFocus={createKind !== 'transaction'} required={createKind !== 'transaction'} maxLength={120} value={createDraft.title || ''} onChange={e => setCreateDraft({ ...createDraft, title: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" />
            </label>}
            {createKind === 'transaction' && <>
              {!editingTransactionId && <button type="button" className="record-transfer-link lifeos-raised min-h-11 w-full rounded-xl text-sm font-semibold" onClick={async () => {
                if (createOperation.current || (createFormDirty && !await confirmAction({ title: 'Discard this transaction draft?', message: 'Transfers use a separate form.', confirmLabel: 'Open transfer', cancelLabel: 'Keep editing' }))) return;
                setCreateKind(null); setCreateFormDirty(false);
                navigateFinanceSubtab('accounts'); setOpenMoneyTransferOnAccounts(true);
              }}>Transfer between accounts</button>}
              <label className="mb-3 block text-xs text-secondary">Type<select value={createDraft.type} onChange={e => {
                const type = e.target.value as 'income' | 'expense';
                const category = categories.find(item => item.type === type)?.name || '';
                setCreateDraft({ ...createDraft, type, category });
              }} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm"><option value="expense">Expense</option><option value="income">Income</option></select></label>
              <label className="mb-3 block text-xs text-secondary">Amount · {createDraft.currencyCode || userPrefs.currency}<input autoFocus={!editingTransactionId} required type="number" min={10 ** -getCurrencyMetadata(createDraft.currencyCode || userPrefs.currency).fractionDigits} step={10 ** -getCurrencyMetadata(createDraft.currencyCode || userPrefs.currency).fractionDigits} inputMode="decimal" value={createDraft.amount} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-secondary">Category<select required={isEncryptedStorageActivated()} value={createDraft.category || ''} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">
                <option value="">Select category</option>
                {createDraft.category && !categories.some(category => category.name === createDraft.category && category.type === createDraft.type) && (
                  <option value={createDraft.category}>Legacy category: {createDraft.category}</option>
                )}
                {categories.filter(category => category.type === createDraft.type).map(category => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select></label>
              {!isEncryptedStorageActivated() && <p className="mb-3 text-sm text-secondary" role="status">Your categories will appear after you protect your first record. Nothing is saved until you choose one.</p>}
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
              <label className="mb-3 block text-xs text-secondary">Progress tracking<select disabled={Boolean(editingHabitId && habitLogs.some(log => log.habitId === editingHabitId))} value={createDraft.trackingMode || 'binary'} onChange={e => setCreateDraft({ ...createDraft, trackingMode: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm"><option value="binary">Completed / not completed</option><option value="quantity">Count a daily quantity</option></select>{editingHabitId && habitLogs.some(log => log.habitId === editingHabitId) && <span className="mt-1 block">Tracking mode is kept so saved check-in history stays unchanged.</span>}</label>
              <label className="mb-3 block text-xs text-secondary">{createDraft.trackingMode === 'quantity' ? 'Daily quantity target' : 'Daily target (optional)'}<input required={createDraft.trackingMode === 'quantity'} type="number" min="0.01" step="any" value={createDraft.targetPerDay || ''} onChange={e => setCreateDraft({ ...createDraft, targetPerDay: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              {createDraft.trackingMode === 'quantity' && <label className="mb-3 block text-xs text-secondary">Unit<input required maxLength={24} value={createDraft.quantityUnit || ''} onChange={e => setCreateDraft({ ...createDraft, quantityUnit: e.target.value })} placeholder="glasses, minutes, pages" className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>}
              <label className="mb-3 block text-xs text-secondary">Reminder time (optional)<input type="time" value={createDraft.reminderTime || ''} onChange={e => setCreateDraft({ ...createDraft, reminderTime: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              {goals.length > 0 && <label className="mb-3 block text-xs text-secondary">Linked goal<select value={createDraft.goalId || ''} onChange={event => setCreateDraft({ ...createDraft, goalId: event.target.value })} className="lifeos-input mt-1 block min-h-11 w-full rounded-xl px-3"><option value="">No linked goal</option>{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>}
              <fieldset className="task-composer-section"><legend className="text-sm font-semibold">Scheduled weekdays</legend><div className="flex flex-wrap gap-2">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, index) => {
                const selected = (createDraft.weekdays || '').split(',').filter(Boolean);
                return <label key={day} className="lifeos-raised flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs"><input type="checkbox" checked={selected.includes(String(index))} onChange={event => setCreateDraft({ ...createDraft, weekdays: (event.target.checked ? [...selected, String(index)] : selected.filter(value => value !== String(index))).join(',') })} />{day}</label>;
              })}</div><label className="mt-2 block text-xs text-secondary">Sessions per week (optional)<input type="number" min="1" max="7" value={createDraft.weeklySessions || ''} onChange={event => setCreateDraft({ ...createDraft, weeklySessions: event.target.value })} className="lifeos-input mt-1 block min-h-11 w-full rounded-xl px-3" /></label>
              <button type="button" className="lifeos-raised mt-2 min-h-11 rounded-xl px-3 text-xs" onClick={() => setCreateDraft({ ...createDraft, trackingMode: 'quantity', quantityUnit: 'minute' })} disabled={Boolean(editingHabitId && habitLogs.some(log => log.habitId === editingHabitId))}>Track duration in minutes</button></fieldset>
              {createDraft.frequency === 'weekly' && <label className="mb-3 block text-xs text-secondary">Reminder weekday<select value={createDraft.reminderWeekday || '2'} onChange={e => setCreateDraft({ ...createDraft, reminderWeekday: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>}
            </>}
            {createKind === 'goal' && <>
              <label className="mb-3 block text-xs text-secondary">Progress type<select value={createDraft.goalMode || 'accumulate'} onChange={e => setCreateDraft({ ...createDraft, goalMode: e.target.value })} className="lifeos-input mt-1 block min-h-11 w-full rounded-xl px-3"><option value="accumulate">Build toward a target</option><option value="reduce">Reduce a value</option><option value="milestone">Complete milestones</option><option value="frequency">Count sessions</option></select></label>
              {createDraft.goalMode === 'reduce' && <label className="mb-3 block text-xs">Starting value<input type="number" min="0" step="any" value={createDraft.baselineValue || ''} onChange={e => setCreateDraft({ ...createDraft, baselineValue: e.target.value })} className="lifeos-input mt-1 block min-h-11 w-full rounded-xl px-3" /></label>}
              <label className="mb-3 block text-xs text-secondary">Category<select value={createDraft.category} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => <option key={category}>{category}</option>)}</select></label>
              {createDraft.goalMode !== "milestone" &&               <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-secondary">Target<input type="number" min="0" step="any" inputMode="decimal" value={createDraft.target} onChange={e => setCreateDraft({ ...createDraft, target: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label><label className="text-xs text-secondary">Current<input type="number" min="0" step="any" inputMode="decimal" value={createDraft.current} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label></div>}
              <label className="mb-3 block text-xs text-secondary">Unit (optional)<input maxLength={20} value={createDraft.unit} onChange={e => setCreateDraft({ ...createDraft, unit: e.target.value })} placeholder="km, books, ₹..." className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <label className="mb-3 block text-xs text-secondary">Priority<select value={createDraft.priority || 'Medium'} onChange={e => setCreateDraft({ ...createDraft, priority: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['Low', 'Medium', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              {editingGoalId && <label className="mb-3 block text-xs text-secondary">Status<select value={createDraft.status || 'In Progress'} onChange={e => setCreateDraft({ ...createDraft, status: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm">{['In Progress', 'Paused', 'Completed'].map(status => <option key={status}>{status}</option>)}</select></label>}
              <label className="mb-3 block text-xs text-secondary">Description (optional)<textarea rows={2} maxLength={500} value={createDraft.description || ''} onChange={e => setCreateDraft({ ...createDraft, description: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
            </>}
            {createKind === 'budget' && <>
              {editingBudgetId && <p className="mb-3 rounded-xl bg-[var(--surface-raised)] p-3 text-xs text-secondary">Editing keeps this plan’s category, month and currency. Create a separate plan to change those details.</p>}
              <label className="mb-3 block text-xs text-secondary">Budget category (optional)<select disabled={Boolean(editingBudgetId)} value={createDraft.categoryId || ''} onChange={e => setCreateDraft({ ...createDraft, categoryId: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm"><option value="">Overall budget</option>{categories.filter(category => category.type === 'expense').map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              {(() => { const code = editingBudgetId ? budgets.find(row => row.id === editingBudgetId)?.currencyCode || userPrefs.currency : userPrefs.currency; const digits = getCurrencyMetadata(code).fractionDigits; return <label className="mb-3 block text-xs text-secondary">Monthly limit · {code}<input required type="number" min={10 ** -digits} step={10 ** -digits} inputMode="decimal" value={createDraft.amount || ''} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>; })()}
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={createDraft.carryover === "yes"} onChange={event => setCreateDraft({ ...createDraft, carryover: event.target.checked ? "yes" : "no" })} /> Carry over unused budget from last month</label>
              <label className="mb-4 block text-xs text-secondary">Month<input disabled={Boolean(editingBudgetId)} required type="month" value={createDraft.month || financeMonth} onChange={e => setCreateDraft({ ...createDraft, month: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
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
            {createKind === 'task' && <TaskComposerOptions draft={createDraft} update={setCreateDraft}
              dateOnlyAlertTime={dateOnlyAlertTime} goals={goals} editing={Boolean(editingTaskId)} dirty={() => setCreateFormDirty(true)} />}
            {['goal', 'savings', 'milestone'].includes(createKind) && <label className="mb-4 block text-xs text-secondary">
              {createKind === 'savings' ? 'Target date' : 'Target date (optional)'}
              <input type="date" required={createKind === 'savings'} value={createDraft.date || ''} onChange={e => setCreateDraft({ ...createDraft, date: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" />
            </label>}
            {editingTransactionId && <button type="button" onClick={async () => { if (!(await confirmAction({ title: 'Delete this transaction?', message: 'This transaction will be removed from your history. This cannot be undone.', confirmLabel: 'Delete transaction', destructive: true }))) return; await StorageService.transactions.delete(editingTransactionId); setCreateKind(null); setCreateFormDirty(false); setEditingTransactionId(null); await reloadAllData(); showToast('Transaction deleted', 'info'); }} className="mb-2 min-h-11 w-full rounded-xl border border-[var(--danger)] px-4 py-2.5 text-sm font-medium text-[var(--danger)]">Delete transaction</button>}
            {editingContributionId && <button type="button" onClick={async () => { if (!(await confirmAction({ title: 'Delete this contribution?', message: 'The contribution will be removed and subtracted from the saved goal total.', confirmLabel: 'Delete contribution', destructive: true }))) return; try { await StorageService.savings.deleteContribution(editingContributionId); setCreateKind(null); setCreateFormDirty(false); setEditingContributionId(null); await reloadAllData(); showToast('Contribution deleted and savings total reconciled', 'success'); } catch (error) { showToast(error instanceof Error ? error.message : 'Contribution could not be deleted safely.', 'danger'); } }} className="mb-2 min-h-11 w-full rounded-xl border border-[var(--danger)] px-4 py-2.5 text-sm font-medium text-[var(--danger)]">Delete contribution</button>}
            <div className="ui-form-actions"><button type="button" disabled={recordSaving} onClick={requestCloseForm} className="lifeos-raised min-h-12 flex-1 rounded-xl text-sm font-semibold">Cancel</button><button type="submit" disabled={recordSaving} className="lifeos-accent-button min-h-12 flex-1 rounded-xl px-3 text-sm font-semibold">{recordSaving ? 'Saving…' : editingTransactionId ? 'Save transaction' : editingGoalId ? 'Save goal' : editingTaskId ? 'Save task' : editingHabitId ? 'Save habit' : editingContributionId ? 'Save contribution' : editingSavingsGoalId ? 'Save savings goal' : editingBudgetId ? 'Save budget' : createKind === 'budget' ? 'Save budget' : createKind === 'contribution' ? 'Save contribution' : createKind === 'goal-progress' ? 'Save progress' : createKind === 'task' ? 'Create Task' : `Save ${createKind}`}</button></div>
          </m.form>
        </RecordComposerLayer>
      )}
      </AnimatePresence>

      {/* Floating Bottom Nav */}
      <nav data-profile-background ref={bottomNavigationRef} aria-label="Main navigation" className="lifeos-nav app-bottom-nav fixed bottom-0 left-0 right-0 z-30 mx-auto border-t px-2 pt-2">
        <div className="app-nav-items alive-nav">
        <m.span className="alive-nav-indicator" aria-hidden="true" initial={false}
          animate={{ x: PRIMARY_NAVIGATION.findIndex(item => item.tab === (primaryDestinationForTab(activeTab) ?? 'dashboard')) * 100 + '%' }}
          transition={interfaceMotion.reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 31 }} />
        {PRIMARY_NAVIGATION.map(({ tab, label, icon }) => {
          const Icon = ({ home: Home, wallet: WalletCards, calendar: CalendarDays })[icon];
          const isSelected = primaryDestinationForTab(activeTab) === tab;
          return (
          <button
            key={tab}
            data-tab={tab}
            onClick={() => {
              if (isSelected) {
                if (activeTab !== tab) { navigateTo(tab); return; }
                if (tab === 'finance' && financeSubtab !== 'overview') { rememberActiveScroll(); financeSubtabHistory.current = []; setFinanceSubtab('overview'); }
                return;
              }
              navigateTo(tab);
            }}
            aria-label={label}
            aria-current={isSelected ? 'page' : undefined}
            className={`nav-item ui-control-feedback flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] leading-none font-medium ${isSelected ? 'lifeos-accent-text font-semibold' : 'text-secondary'}`}
          >
            <Icon size={18} strokeWidth={isSelected ? 2.4 : 1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
          );
        })}
        </div>
      </nav>

      {showExitConfirmation && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-5" role="presentation"><section className="lifeos-panel w-full max-w-sm rounded-2xl border p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="exit-lifeos-title"><h2 id="exit-lifeos-title" className="text-lg font-semibold">Leave LifeOS?</h2><p className="mt-2 text-sm text-secondary">Your changes are saved on this device. You can return anytime.</p><div className="mt-5 flex gap-2"><button autoFocus onClick={() => setShowExitConfirmation(false)} className="lifeos-input min-h-11 flex-1 rounded-xl text-sm font-medium">Stay</button><button onClick={() => void CapacitorApp.exitApp()} className="lifeos-accent-button min-h-11 flex-1 rounded-xl text-sm font-semibold">Exit app</button></div></section></div>}

      {confirmation && <ConfirmationDialog {...confirmation} onCancel={() => settleConfirmation(false)} onConfirm={() => settleConfirmation(true)} />}

      {/* In-app Toast Notification */}
      {toast && (
        <div role="status" aria-live="polite" className={`ui-toast lifeos-raised lifeos-border fixed top-4 left-1/2 z-[75] flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-2xl ${toast.type === 'success' ? 'ui-success-feedback' : ''}`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
    </LazyMotion>
  );
}
