import ProfileData from './components/ProfileData';
import './styles/profile-centre.css';
import { useTodayCardDrag } from './hooks/useTodayCardDrag';
import { BusyDooBrand } from './components/BusyDooBrand';
import { PlanSectionHeader, PlanSectionEmpty } from './components/PlanSection';
import ProfilePhotoEditor from './components/ProfilePhotoEditor';
import { closeSheet } from './components/sheetMotion';
import { goalProgressPercent, isGoalComplete, validateGoalMeasure } from './services/goalModes';
import { AnimatePresence, LazyMotion, domAnimation } from 'motion/react';
import ComposerShell from './components/ComposerShell';
import Snackbar, { type SnackbarNotice } from './components/Snackbar';
import TransactionDetail from './components/TransactionDetail';
import TaskComposerOptions from './components/TaskComposerOptions';
import { AliveDisclosure } from './components/AliveDisclosure';
import { flushSync } from 'react-dom';
import { getMotionPreset } from './services/interfaceMotion';
import { AppearanceStudio, ThemeStudio } from './components/AppearanceStudio';
import { useInterfaceMotion } from './hooks/useInterfaceMotion';
import MotionPreferences from './components/MotionPreferences';
import SmartImportDialog from './components/SmartImportDialog';
import { useSharedBankAlert } from './hooks/useSharedBankAlert';
import { PossibleImportDuplicateError } from './services/smartImport';
import MoneyDetailHeader from './components/MoneyDetailHeader';
import InfoTip from './components/InfoTip';
import { estimateDragVelocity } from './services/interfaceMotion';
import { useAliveNavigation } from './hooks/useAliveNavigation';
import React, { Suspense, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import packageInfo from '../package.json';
import { Activity, Check, X, Flag, Target, CirclePlus, Layers, ReceiptText, Tag, CalendarDays, SlidersHorizontal, Home, Leaf, Search, Shield, ShieldCheck, WalletCards, UserRound } from 'lucide-react';
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
import { CURRENCY_CODES, DEFAULT_USER_PREFERENCES, buildTransactionUpdate, canonicalUnit, convertMeasurement, formatCurrency, formatDatePreference, formatTimePreference, mergeUserPreferences, resolveSystemDark, formatHabitQuantity, formatHabitProgress, normalizeHabitUnit, type UserPreferences } from './services/userPreferences';
import { createMoneyRecordAmount, decimalToMinorUnits, formatCurrencyChoice, formatMinorUnits, getCurrencyMetadata, minorUnitsToDecimal } from './services/financeCore';
import { buildFinanceAnalytics } from './services/financeAnalytics';
import { getExactBudgetDisplayStatus } from './services/budgetDisplay';
import { buildDuplicateTransactionDraft } from './services/transactionDraft';
import { DEFAULT_TODAY_LAYOUT, moveTodaySection, normalizeTodayLayout, setTodaySectionVisible, TODAY_SECTION_LABELS, type TodayLayout, type TodaySectionId } from './services/todayLayout';
import { groupUpcomingTasks } from './services/taskViews';
import TaskDetailScreen from './components/TaskDetailScreen';
import { applyThemeTokens, DEFAULT_THEME_ID, resolveThemeId, type ThemeId } from './services/themeCatalog';
import { buildCustomAccentOverrides, normalizeCustomAccent } from './services/customAccent';
import CustomAccentPicker from './components/CustomAccentPicker';
import { resolveInitialVisualTheme } from './services/systemAppearance';
import MoneyHome from './components/MoneyHome';
import MoneyAccounts, { buildTransferDraft, type AccountDraft, type TransferDraft } from './components/MoneyAccounts';
import type { QuickTaskDetails } from './components/QuickTaskEntry';
import PlannedCashFlow from './components/PlannedCashFlow';
import MoneyPlanning, { type MoneyPlanningDraftState } from './components/MoneyPlanning';
import { APP_NAME } from './config/appBrand';
import { REPLAY_BUSYDOO_LAUNCH } from './components/BusyDooLaunch';
import AppHeader from './components/AppHeader';
import TransactionSummary from './components/TransactionSummary';
import MoneyPeriod from './components/MoneyPeriod';
import { animateRoute } from './services/aliveMotion';
import LicenseText from './components/LicenseText';
import LifeDoodle from './components/LifeDoodle';
import SavingsGoalProgress from './components/SavingsGoalProgress';
import ConfirmationDialog, { type ConfirmationOptions } from './components/ConfirmationDialog';
import { pickProfilePhoto, PROFILE_PHOTO_SETTING, readProfilePhoto } from './services/profilePhoto';
import { ProfileAvatar, ProfileHome, ProfileSettingRow, ProfileSubpage, PROFILE_TITLES, profileParent, type ProfileSection } from './components/ProfileSettings';
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
import { DEFAULT_DATE_ONLY_ALERT_TIME, taskScheduleError, parseLocalDateTime, buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, formatLocalDate, formatLocalDateTime, getMonthCalendarDays, getTaskStatus, getTasksForDate, getTodayOverview, greetingForHour, habitScheduleOnDate, isHabitEligible, profileInitial, resolveAppearance, resolveBackAction, shouldShowOnboarding, sortTasksByDeadline, sortTransactions, watchSystemTheme } from './services/domainUtils';

const legalDraftEnabled = __BUSYDOO_LEGAL_DRAFT__;
const LegalPrivacyCentre = legalDraftEnabled ? React.lazy(() => import('./components/LegalPrivacyCentre')) : null;
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
  const themeTokens = applyThemeTokens(themeId, theme);
  for (const [name, value] of Object.entries(buildCustomAccentOverrides(normalizeCustomAccent(customAccent), themeId, theme))) {
    document.documentElement.style.setProperty(name, value);
  }
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeTokens.background);
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

function keyboardOwnsViewport() {
  return document.activeElement?.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]), [contenteditable=true]')
    || (window.visualViewport != null && window.innerHeight - window.visualViewport.height > 120 && window.visualViewport.scale === 1);
}

export default function App() {
  const interfaceMotion = useInterfaceMotion();
  // Navigation & Theme State
  const navigationMotion = useAliveNavigation(interfaceMotion.preset, interfaceMotion.reducedMotion);
  const { activeTab, activeTabRef, tabTransition, transitionPropsFor, cancel: cancelTrack } = navigationMotion;
  navigationMotion.measure.current = import.meta.env.DEV;
  const [primaryPrepared, setPrimaryPrepared] = useState(false);
  const profileAdmission = useRef<symbol | null>(null);
  const [profileAdmissionPending, setProfileAdmissionPending] = useState(false);
  const cancelProfileAdmission = () => {
    if (!profileAdmission.current) return false;
    profileAdmission.current = null;
    setProfileAdmissionPending(false);
    return true;
  };
  const releaseGestureCapture = (pointerId?: number) => {
    if (pointerId == null) return;
    const surface = gestureSurfaceElement.current;
    if (surface?.hasPointerCapture?.(pointerId)) {
      try { surface.releasePointerCapture(pointerId); } catch { /* Pointer may already have ended. */ }
    }
  };
  const transitionToTab = (tab: MainTab, direction?: 'left' | 'right', velocity = 0, onCommit?: (from: MainTab, scrollBefore: number) => void) => {
    cancelProfileAdmission();
    const pointerId = swipePointer.current?.pointerId;
    swipePointer.current = null;
    swipeOriginAction.current = null;
    releaseGestureCapture(pointerId);
    const enter = () => {
      if (tab === 'settings') setProfileSection('home');
      navigationMotion.jumpTo(tab, direction, velocity, routeScrollOffset(tab), onCommit);
    };
    if (tab !== 'settings' || Capacitor.getPlatform() !== 'android' || activeTabRef.current === 'settings') {
      enter();
      return;
    }
    const request = Symbol();
    profileAdmission.current = request;
    setProfileAdmissionPending(true);
    void setSensitiveScreenshotState(true).then(() => {
      if (profileAdmission.current !== request) return;
      cancelProfileAdmission();
      if (!backState.current.isLocked) enter();
    }).catch(() => {
      if (profileAdmission.current !== request) return;
      cancelProfileAdmission();
      navigationMotion.endDrag(true);
      showToast('Could not protect Profile. Try again.', 'danger');
    });
  };
  const navigationHistory = useRef<MainTab[]>([]);
  const todayOrigin = useRef<{ destination: MainTab; history: MainTab[]; trigger?: HTMLElement } | null>(null);
  const todayReturnFocus = useRef<HTMLElement | null>(null);
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
  const [profileSection, setProfileSection] = useState<ProfileSection>('home');
  const profileOpen = activeTab === 'settings';
  const profilePage = useRef<HTMLDivElement>(null);
  const previousProfileSection = useRef<ProfileSection | null>(null);
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
  const swipeSamples = useRef<{ x: number; time: number }[]>([]);
  const scrollPositions = useRef<Record<string, number>>({});
  const [theme, setTheme] = useState<'dark' | 'light'>(() => systemDarkPreference() ? 'dark' : 'light');
  const [appearance, setAppearancePreference] = useState<AppearancePreference>('system');
  const appearanceSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const [visualThemeId, setVisualThemeId] = useState<ThemeId>(() => {
    try { return resolveThemeId(localStorage.getItem('lifeos-theme-id')); } catch { return DEFAULT_THEME_ID; }
  });
  const [themePreviewId, setThemePreviewId] = useState<ThemeId | null>(null);
  const [savingVisualTheme, setSavingVisualTheme] = useState(false);
  const visualThemeWrite = useRef(false);
  const [customAccent, setCustomAccent] = useState<string | undefined>(() => {
    try { return normalizeCustomAccent(localStorage.getItem('lifeos-custom-accent')); } catch { return undefined; }
  });
  const customAccentSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [displayName, setDisplayName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [pendingProfilePhoto, setPendingProfilePhoto] = useState<File | string | null>(null);
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState('');
  const profilePhotoOperation = useRef(false);
  const profilePhotoVersion = useRef(0);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
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
  const [taskReminderDiagnostics, setTaskReminderDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [dateOnlyAlertTime, setDateOnlyAlertTime] = useState(DEFAULT_DATE_ONLY_ALERT_TIME);
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
        throw new Error('Recovery setup state changed while BusyDoo was backgrounded. Encrypted data remains protected; restart this step to retry.');
      }
      await unlockEncryptedSession(CryptoService, sessionManager);
      const after = await CryptoService.getKeyState();
      if (!after.metadataConsistent || !after.keyProvisioned || !after.keystoreAliasPresent ||
          after.recoveryNeedsRebind || !after.unlocked || !(await CryptoService.isUnlocked()) ||
          !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) {
        throw new Error('BusyDoo could not verify secure access after returning from the save picker. Your data remains locked.');
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

  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [protectedImportComposer, setProtectedImportComposer] = useState(false);
  const sensitiveScreenshot = activityResumeGuard || smartImportOpen || protectedImportComposer || profileAdmissionPending || profileOpen || tabTransition?.from === 'settings' || isSensitiveScreenshotState({
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
    const result = await BiometricService.authenticate('Unlock BusyDoo', 'Confirm your identity to access your personal data');
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
  const [transferDetailId, setTransferDetailId] = useState<string | null>(null);
  const transferDetail = activeTab === 'finance' ? accountTransfers.find(row => row.id === transferDetailId) : undefined;
  const editableTransferDetail = transferDetail && !transferDetail.reversalOfId
    && !accountTransfers.some(row => row.reversalOfId === transferDetail.id);
  const [transactionDetailId, setTransactionDetailId] = useState<string | null>(null);
  const transactionDetail = activeTab === 'finance' ? transactions.find(row => row.id === transactionDetailId) : undefined;
  const [openMoneyTransferOnAccounts, setOpenMoneyTransferOnAccounts] = useState(false);
  const financeSubtabHistory = useRef<Array<typeof financeSubtab>>([]);
  const [financeMonth, setFinanceMonth] = useState<string>(formatLocalDate(new Date()).substring(0, 7));
  const activityFilterDialog = useRef<HTMLDialogElement>(null);
  const activityFilterTrigger = useRef<HTMLButtonElement>(null);
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
  const [toast, setToast] = useState<SnackbarNotice | null>(null);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationOptions | null>(null);
  const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const [createFormDirty, setCreateFormDirty] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [createKind, setCreateKind] = useState<'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution' | 'milestone' | 'goal-progress' | null>(null);
  const [createDraft, setCreateDraft] = useState<Record<string, string>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editingSavingsGoalId, setEditingSavingsGoalId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const backState = useRef({ createKind, modalContent, plannerDetailTaskId, profileSection, activeTab, financeSubtab, habitsSubtab, goalsSubtab, appReady, onboardingRequired, onboardingComplete, isLocked, showExitConfirmation, accountFormDraft, accountFormDirty, transferFormDraft, transferFormDirty, planningDrafts, todayCustomizationOpen, lifeDetail });
  backState.current = { createKind, modalContent, plannerDetailTaskId, profileSection, activeTab, financeSubtab, habitsSubtab, goalsSubtab, appReady, onboardingRequired, onboardingComplete, isLocked, showExitConfirmation, accountFormDraft, accountFormDirty, transferFormDraft, transferFormDirty, planningDrafts, todayCustomizationOpen, lifeDetail };

  const navigateTo = (tab: MainTab, direction?: 'left' | 'right', velocity = 0) => {
    const current = activeTabRef.current;
    if (current !== 'dashboard' && (direction || primaryDestinationForTab(current) !== primaryDestinationForTab(tab))) {
      todayOrigin.current = null;
      todayReturnFocus.current = null;
    }
    if (activeTabRef.current === tab) { cancelProfileAdmission(); return; }
    transitionToTab(tab, direction, velocity, (previous, scrollBefore) => {
      scrollPositions.current[screenKeyForTab(previous)] = scrollBefore;
      navigationHistory.current = pushTabHistory(navigationHistory.current, previous, tab);
      setShowExitConfirmation(false);
    });
  };

  useEffect(() => {
    if (!appReady || !onboardingComplete || isLocked || primaryPrepared) return;
    let cancelled = false;
    const warmup = window.setTimeout(() => {
      void import('./components/PlanHub').then(() => {
        if (!cancelled) setPrimaryPrepared(true);
      }).catch(() => undefined);
    }, 120);
    return () => { cancelled = true; window.clearTimeout(warmup); };
  }, [appReady, onboardingComplete, isLocked, primaryPrepared]);

  const planPathHandler = useRef<(path: string) => void>(() => undefined);
  planPathHandler.current = path => {
    const destination = resolvePlanPath(path);
    if (!destination) return;
    todayOrigin.current = null;
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

  const renderPlanNavigation = (selected: 'plan' | 'habits' | 'goals' | 'insights') => (
    <header className="plan-destination-header">
      <nav aria-label="Plan destinations" className="plan-destinations feather-segments">
        {([{ tab: 'plan', label: 'Tasks' }, { tab: 'habits', label: 'Habits' }, { tab: 'goals', label: 'Goals' }] as const).map(({ tab, label }) =>
          <button key={tab} type="button" aria-current={selected === tab ? 'page' : undefined} onClick={() => {
            if (tab === selected) return;
            todayOrigin.current = null;
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
      cancelTrack();
      cancelPrimaryGesture('window-resized');
      activeTouchPointers.current.clear();
      swipeSuppressed.current = false;
    };
    const cancelForBackground = () => {
      if (document.visibilityState !== 'visible') {
        cancelTrack();
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
    const cancelForContextMenu = (event: MouseEvent) => {
      cancelPrimaryGesture('context-menu');
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.app-shell, .ui-sheet-backdrop') && !target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-selectable-text], [data-sensitive-recovery-code]'
      )) event.preventDefault();
    };
    window.addEventListener('contextmenu', cancelForContextMenu);
    window.addEventListener('resize', cancelForEnvironmentChange, { passive: true });
    window.visualViewport?.addEventListener('resize', cancelForEnvironmentChange, { passive: true });
    window.addEventListener('blur', cancelForBlur);
    document.addEventListener('visibilitychange', cancelForBackground);
    return () => {
      document.removeEventListener('selectionchange', cancelForSelection);
      window.removeEventListener('contextmenu', cancelForContextMenu);
      window.removeEventListener('resize', cancelForEnvironmentChange);
      window.visualViewport?.removeEventListener('resize', cancelForEnvironmentChange);
      window.removeEventListener('blur', cancelForBlur);
      document.removeEventListener('visibilitychange', cancelForBackground);
    };
  }, [cancelTrack]);

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
    swipeSamples.current = [];

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
      enabled: userPrefs.swipeNavigationEnabled && !todayCards.isDragging(),
      pointerType: event.pointerType,
      settingsScreen: primaryDestinationForTab(activeTab) === null ||
        Boolean((activeTab === 'planner' && plannerDetailTaskId) || ((activeTab === 'habits' || activeTab === 'goals') && lifeDetail)) ||
        (profileOpen && (profileSection !== 'home' || Boolean(document.querySelector('#screen-settings form[data-no-tab-swipe]')))),
      modalOpen: Boolean(createKind || modalContent || confirmation || firstRecordSecurityOpen || secureSetup || showExitConfirmation
        || todayCustomizationOpen || smartImportOpen || profileAdmissionPending || financeDialogOpen
        || document.querySelector('dialog[open]') || keyboardOwnsViewport()),
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
    swipeSamples.current = [{ x: event.clientX, time: performance.now() }];
    swipePointer.current = beginPrimaryGesture({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), viewportWidth: window.innerWidth });
    recordGestureTrace({ event: 'pointerdown', pointerId: event.pointerId, deltaX: 0, deltaY: 0, state: 'pending' }, import.meta.env.DEV);
  };

  const handleContentPointerMove = (event: PointerEvent) => {
    const start = swipePointer.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.viewportWidth !== window.innerWidth) { cancelPrimaryGesture('viewport-changed', event.pointerId); return; }
    const update = updatePrimaryGesture(start, event.pointerId, event.clientX, event.clientY);
    swipePointer.current = update.session;
    swipeSamples.current.push({ x: event.clientX, time: performance.now() });
    if (swipeSamples.current.length > 8) swipeSamples.current.shift();
    recordGestureTrace({ event: 'pointermove', pointerId: event.pointerId, deltaX: update.deltaX, deltaY: update.deltaY, state: update.session.axis }, import.meta.env.DEV);
    if (update.session.axis === 'vertical') { clearGestureDrag(false); return; }
    if (update.session.axis === 'horizontal' && start.axis !== 'horizontal') {
      navigationMotion.beginDrag(routeScrollOffset);
      navigationMotion.moveDrag(update.deltaX);
      // Capture only after horizontal intent is clear. A normal button tap and
      // browser-owned vertical scroll keep their native pointer/click lifecycle.
      try { gestureSurfaceElement.current?.setPointerCapture(event.pointerId); } catch { /* Window tracking remains active if capture is unavailable. */ }
    }
    if (!update.accepted || swipeMoveFrame.current !== null) return;
    swipeMoveFrame.current = window.requestAnimationFrame(() => {
      swipeMoveFrame.current = null;
      const current = swipePointer.current;
      if (current?.pointerId !== start.pointerId || current.axis !== 'horizontal') return;
      navigationMotion.moveDrag(current.latestOffsetX);
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
    const requested = resolvePrimaryGestureEnd(activeTabRef.current, start, event.pointerId, event.clientX, event.clientY, performance.now(), userPrefs.swipeNavigationEnabled);
    const deltaX = event.clientX - start.startX;
    const deltaY = event.clientY - start.startY;
    if (start.axis === 'horizontal') navigationMotion.moveDrag(deltaX);
    const target = requested && navigationMotion.canCommitDrag(requested) ? requested : null;
    const velocity = estimateDragVelocity([...swipeSamples.current, { x: event.clientX, time: performance.now() }], interfaceMotion.preset);
    swipeSamples.current = [];
    recordGestureTrace({ event: 'pointerup', pointerId: event.pointerId, deltaX, deltaY, state: start.axis, decision: target || 'settle-back' }, import.meta.env.DEV);
    swipePointer.current = null;
    if (target) {
      const originAction = swipeOriginAction.current;
      if (shouldSuppressPrimaryGestureClick(start) && originAction) {
        swipeClickSuppression.current = { pointerId: event.pointerId, target: originAction, expiresAt: performance.now() + 500 };
      }
      swipeOriginAction.current = null;
      flushSync(() => navigateTo(target, deltaX < 0 ? 'left' : 'right', velocity));
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
    transitionToTab(destination);
  };

  const navigateBack = () => {
    const state = backState.current;
    if (swipePointer.current) cancelPrimaryGesture('navigation-back');
    if (cancelProfileAdmission()) return;
    navigationMotion.cancelPending();
    if (typeof document !== 'undefined') {
      const contextualInfo = document.querySelector<HTMLDialogElement>('dialog[data-contextual-info="true"][open]');
      if (contextualInfo) { closeSheet(contextualInfo); return; }
      const choices = document.querySelectorAll<HTMLDialogElement>('dialog[data-preference-choice][open]');
      if (choices.length) { closeSheet(choices[choices.length - 1]); return; }
      const profileEditor = document.querySelector<HTMLDialogElement>('dialog[data-profile-editor][open]');
      if (profileEditor) { profileEditor.dispatchEvent(new Event('cancel', { cancelable: true })); return; }
      const transactionOptions = document.querySelector<HTMLDialogElement>('dialog[data-transaction-actions][open]');
      if (transactionOptions) { transactionOptions.close(); return; }
      const scheduledDetail = document.querySelector<HTMLElement>('dialog[data-scheduled-details][open] [data-motion-back]');
      if (scheduledDetail) { scheduledDetail.click(); return; }
      const filterSheet = document.querySelector<HTMLDialogElement>('dialog[data-plan-filters][open],dialog[data-activity-filters][open],dialog[data-transaction-details][open],dialog[data-transfer-details][open],dialog[data-money-period][open],dialog[data-smart-import][open],dialog[data-scheduled-details][open]');
      if (filterSheet) { filterSheet.close(); return; }
    }
    if (confirmationResolver.current) { settleConfirmation(false); return; }
    if (firstRecordSecurityResolver.current) { void setSensitiveScreenshotState(state.activeTab === 'settings').catch(() => undefined); firstRecordSecurityResolver.current(null); return; }
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
    const origin = todayOrigin.current;
    if (origin?.destination === state.activeTab &&
      (state.activeTab !== 'finance' || (state.financeSubtab === 'monthly' && financeSubtabHistory.current.length === 0))) {
      todayOrigin.current = null;
      todayReturnFocus.current = origin.trigger || null;
      rememberActiveScroll();
      if (state.activeTab === 'finance') setFinanceSubtab('overview');
      navigationHistory.current = origin.history;
      transitionToTab('dashboard');
      return;
    }
    if (action === 'close-child-view') {
      if (state.activeTab === 'finance') {
        rememberActiveScroll();
        const previous = popTabHistory(financeSubtabHistory.current, 'overview');
        financeSubtabHistory.current = previous.history;
        setFinanceSubtab(previous.next);
      }
      if (state.activeTab === 'habits') { rememberActiveScroll(); setHabitsSubtab('checklist'); }
      if (state.activeTab === 'goals') { rememberActiveScroll(); setGoalsSubtab('active'); }
      if (state.activeTab === 'settings') navigateProfileSection(profileParent(state.profileSection));
      return;
    }
    const history = popTabHistory(navigationHistory.current, 'dashboard');
    if (history.next === 'dashboard' || action === 'home') todayOrigin.current = null;
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

  // Connectivity is informational only; BusyDoo records remain in local IndexedDB.
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

  const coldStartupAttempt = useRef<Promise<void> | null>(null);

  // Load Initial Settings & Data
  useEffect(() => {
    coldStartupAttempt.current ??= initApp();
    void coldStartupAttempt.current.catch(error => {
      console.error('BusyDoo startup failed.', error);
      setStartupError(error instanceof Error ? error.message : 'BusyDoo could not open local data.');
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
        console.error('BusyDoo resume recovery failed.', error);
      } finally {
        resumeInProgress = false;
        setBiometricAuthActive(false);
      }
    }).then(async listener => {
      if (disposed) await listener.remove();
      else appStateListener = listener;
    }).catch(error => {
      if (!disposed) console.error('BusyDoo app-state listener registration failed.', error);
    });

    return () => {
      disposed = true;
      window.clearInterval(timer);
      if (appStateListener) void appStateListener.remove().catch(error => console.error('BusyDoo app-state listener cleanup failed.', error));
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
      if (!disposed) console.error('BusyDoo back-button listener registration failed.', error);
    });
    return () => {
      disposed = true;
      if (listener) void listener.remove().catch(error => console.error('BusyDoo back-button listener cleanup failed.', error));
    };
  }, []);

  useEffect(() => {
    if (appearance !== 'system') return;
    const update = (resolved: 'dark' | 'light') => { setTheme(resolved); applyDomTheme(resolved, themePreviewId || visualThemeId, customAccent); };
    const nativeTheme = (event: Event) => update((event as CustomEvent<{ dark: boolean }>).detail.dark ? 'dark' : 'light');
    window.addEventListener('lifeos:system-appearance', nativeTheme);
    const stopMedia = Capacitor.isNativePlatform() && typeof (window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark === 'boolean'
      ? () => {}
      : watchSystemTheme(window.matchMedia('(prefers-color-scheme: dark)'), update);
    return () => { stopMedia(); window.removeEventListener('lifeos:system-appearance', nativeTheme); };
  }, [appearance, visualThemeId, themePreviewId, customAccent]);

  useLayoutEffect(() => {
    applyDomTheme(theme, themePreviewId || visualThemeId, customAccent);
  }, [theme, visualThemeId, themePreviewId, customAccent]);

  useLayoutEffect(() => {
    if (themePreviewId && (!profileOpen || profileSection !== 'themes')) setThemePreviewId(null);
  }, [profileOpen, profileSection, themePreviewId]);

  useLayoutEffect(() => {
    const previous = previousProfileSection.current;
    previousProfileSection.current = profileOpen ? profileSection : null;
    const page = profilePage.current;
    if (!profileOpen || !page) return;
    page.querySelector('h1')?.focus({ preventScroll: true });
    if (!previous || previous === profileSection || interfaceMotion.reducedMotion || !page.animate) return;
    const direction = profileParent(previous) === profileSection ? -1 : 1;
    const { duration, easing } = getMotionPreset(interfaceMotion.preset);
    const content = page.querySelector('.profile-settings');
    const animation = content?.animate([{ transform: 'translateX(' + direction * 12 + 'px)', opacity: .9 },
      { transform: 'translateX(0)', opacity: 1 }], { duration: Math.round(duration * .55), easing });
    return () => animation?.cancel();
  }, [profileOpen, profileSection, interfaceMotion.reducedMotion, interfaceMotion.preset]);


  const screenKeyForTab = (tab: MainTab) => screenScrollKey({
    tab,
    financeSubtab,
    profileSection: tab === activeTab ? profileSection : 'home',
    goalsSubtab,
    habitsSubtab,
    detailKey: tab === 'planner' ? plannerDetailTaskId ?? undefined
      : lifeDetail?.kind === (tab === 'habits' ? 'habit' : 'goal') ? lifeDetail.id : undefined,
  });
  const activeScreenKey = screenKeyForTab(activeTab);
  const routeScrollOffset = (tab: MainTab) => scrollPositions.current[screenKeyForTab(tab)] || 0;

  const rememberActiveScroll = () => { scrollPositions.current[activeScreenKey] = window.scrollY; };
  const showLifeDetail = (detail: typeof lifeDetail) => { rememberActiveScroll(); setLifeDetail(detail); };
  const navigateProfileSection = (section: ProfileSection) => {
    if (profileSection === 'themes' && section !== 'themes' && themePreviewId) cancelVisualThemePreview();
    rememberActiveScroll();
    setProfileSection(section);
  };
  const backFromProfile = () => navigateBack();
  const profileBackHandler = useRef(backFromProfile);
  profileBackHandler.current = backFromProfile;
  useEffect(() => {
    if (!profileOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')) return;
      event.preventDefault();
      profileBackHandler.current();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [profileOpen]);
  useLayoutEffect(() => {
    if (profileOpen) document.getElementById("primary-route-title")?.focus({ preventScroll: true });
  }, [profileOpen, profileSection]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollPositions.current[activeScreenKey] || 0);
    root.style.scrollBehavior = previous;
    navigationMotion.alignOutgoingScroll();
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
    cancelProfileAdmission();
    cancelPrimaryGesture('app-locked');
    activeTouchPointers.current.clear();
    swipeSuppressed.current = false;
    swipeClickSuppression.current = null;
    cancelTrack();
  }, [isLocked, cancelTrack]);

  const showToast = (message: string, type: 'info' | 'success' | 'danger' = 'info') => {
    setToast(current => current?.message === message && current.type === type ? current : { message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.type === 'danger' ? 10000 : 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  const [showTodayReorderHint, setShowTodayReorderHint] = useState(() => {
    try { return localStorage.getItem('busydoo-today-reordered') !== 'yes'; } catch { return true; }
  });
  const openFromToday = (destination: 'finance' | 'plan' | 'habits' | 'goals' | 'planner', trigger?: HTMLElement) => {
    todayOrigin.current = { destination, history: navigationHistory.current, trigger };
    if (destination === 'finance') {
      financeSubtabHistory.current = [];
      setFinanceSubtab('monthly');
    }
    if (destination === 'planner') {
      setPlannerDetailTaskId(null);
      taskDetailReturnTabRef.current = null;
      taskDetailReturnFocusRef.current = null;
    }
    if (destination === 'habits' || destination === 'goals') {
      setLifeDetail(null);
      if (destination === 'habits') setHabitsSubtab('checklist');
      else setGoalsSubtab('active');
    }
    navigateTo(destination);
  };
  useLayoutEffect(() => {
    if (activeTab !== 'dashboard' || tabTransition || !todayReturnFocus.current) return;
    const trigger = todayReturnFocus.current;
    todayReturnFocus.current = null;
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  }, [activeTab, tabTransition]);

  const todayCards = useTodayCardDrag(todayLayout.order, activeTab === 'dashboard' && !isLocked && !activityResumeGuard,
    interfaceMotion.reducedMotion, () => cancelPrimaryGesture('today-reorder'), next => {
      if (next.every((id, index) => id === todayLayoutRef.current.order[index])) return;
      persistTodayLayout({ ...todayLayoutRef.current, order: next });
      setShowTodayReorderHint(false);
      try { localStorage.setItem('busydoo-today-reordered', 'yes'); } catch { /* Hint still closes for this session. */ }
    }, (section, trigger) => {
      if (section === 'money') openFromToday('finance', trigger);
      else if (section === 'habits' || section === 'goals') openFromToday(section, trigger);
      else if (section === 'upcoming') { setPlannerFilter('upcoming'); openFromToday('planner', trigger); }
      else openFromToday('plan', trigger);
    }, interfaceMotion.preset);
  const todaySectionStyle = (id: TodaySectionId): React.CSSProperties => ({
    order: 'var(--today-sort-order, ' + (todayLayout.order.indexOf(id) + 2) + ')',
    display: todayLayout.hidden.includes(id) ? 'none' : undefined,
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

  const sharedReviewAvailable = appReady && onboardingComplete && !onboardingRequired && !isLocked &&
    !activityResumeGuard && !biometricAuthActive && !secureSetup && !recoveryOpen &&
    !firstRecordSecurityOpen && !backupPrompt && !backupOperationInProgress;
  const sharedAlert = useSharedBankAlert({
    available: sharedReviewAvailable,
    busy: smartImportOpen || Boolean(createKind || modalContent || confirmation || accountFormDraft ||
      transferFormDraft || plannerDetailTaskId || lifeDetail || todayCustomizationOpen || showExitConfirmation || tabTransition),
    open: () => setSmartImportOpen(true),
  });
  useEffect(() => {
    if (isLocked || (activeTab !== "finance" && !sharedAlert.draft)) setSmartImportOpen(false);
    if (isLocked) sharedAlert.hide();
  }, [isLocked, activeTab, sharedAlert.draft]);
  useEffect(() => {
    if (createKind !== "transaction" || isLocked) setProtectedImportComposer(false);
  }, [createKind, isLocked]);

  const navigateFinanceSubtab = (next: typeof financeSubtab) => {
    if (next === financeSubtab) return;
    rememberActiveScroll();
    financeSubtabHistory.current = pushTabHistory(financeSubtabHistory.current, financeSubtab, next);
    setFinanceSubtab(next);
  };

  const preferenceWrite = useRef(false);
  const [savingProfilePreferences, setSavingProfilePreferences] = useState(false);
  const saveUserPreference = async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    if (preferenceWrite.current) return;
    preferenceWrite.current = true;
    setSavingProfilePreferences(true);
    try {
      const updated = { ...userPrefs, [key]: value };
      await StorageService.settings.set('userPreferences', updated);
      setUserPrefs(updated);
    } catch { showToast('Could not save this preference. Your previous choice is still saved.', 'danger'); }
    finally { preferenceWrite.current = false; setSavingProfilePreferences(false); }
  };

  const initApp = async () => {
    // Bootstrap-safe preferences only.
    const savedTheme = await StorageService.settings.get<AppearancePreference>('theme', 'system');
    // The previous default was cached even when no palette was chosen.
    const paletteFallback = visualThemeId === 'busydoo' ? DEFAULT_THEME_ID : visualThemeId;
    const savedVisualTheme = await resolveInitialVisualTheme(() => StorageService.settings.get('visualTheme', paletteFallback));
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

    const [savedAlertTime, savedTone, lockSetting, availability, completed, started, storedOnboardingJourney, legacyStep] = await Promise.all([
      StorageService.settings.get<string>('dateOnlyAlertTime', DEFAULT_DATE_ONLY_ALERT_TIME),
      StorageService.settings.get('notificationTone', 'warm'),
      StorageService.settings.get<boolean>('biometricLockEnabled', false),
      BiometricService.isAvailable(),
      StorageService.settings.get<boolean>('onboardingCompleted', false),
      StorageService.settings.get<boolean>('onboardingStarted', false),
      StorageService.settings.get<unknown>('onboardingJourney', null),
      StorageService.settings.get<number>('onboardingStep', 0),
    ]);
    setDateOnlyAlertTime(savedAlertTime);
    setNotificationTone(normalizeNotificationTone(savedTone));
    setBiometricEnabled(lockSetting);
    setIsLocked(lockSetting);
    setDeviceCredentialOnly(availability.isAvailable && availability.deviceCredentialAvailable === true && availability.strongBiometricAvailable === false);
    setBiometricAvailability(availability.isAvailable ? 'Available'
      : availability.code === 'NOT_ENROLLED' ? 'Supported, but no device credential is enrolled' : 'Unavailable on this device');
    const normalizedJourney = normalizeOnboardingJourney(storedOnboardingJourney);
    setOnboardingJourney(normalizedJourney);
    const previousVersion = (storedOnboardingJourney as { version?: number } | null)?.version;
    const savedOnboardingStep = resumeOnboardingStep(legacyStep, previousVersion);
    if (!completed && started && savedOnboardingStep !== legacyStep) await StorageService.settings.set('onboardingStep', savedOnboardingStep);

    const [nativeState, hasCiphertext, hasExistingPrivateRows] = await Promise.all([
      CryptoService.getKeyState(), hasEncryptedRecords(), hasPrivateRows(),
    ]);
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
    const [storedCurrency, savedUserPrefs, savedLayout, savedNotificationPreferences, hasRequestedNotifications, savedNotificationsEnabled] = await Promise.all([
      StorageService.settings.get<UserPreferences['currency']>('currency', 'INR'),
      StorageService.settings.get<Partial<UserPreferences>>('userPreferences', {}),
      StorageService.settings.get<unknown>('todayLayout', DEFAULT_TODAY_LAYOUT),
      StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES),
      StorageService.settings.get<boolean>('notificationPermissionRequested', false),
      StorageService.settings.get<boolean | undefined>('notificationsEnabled', undefined),
    ]);
    setUserPrefs(mergeUserPreferences(savedUserPrefs, storedCurrency));
    const onboardingNameDraft = await StorageService.settings.get<string>('onboardingNameDraft', '');
    if (onboardingNameDraft) {
      // The draft is bootstrap-only. Once the native key is active, promote it
      // to the encrypted profile setting before exposing the private workspace.
      await StorageService.settings.set('displayName', onboardingNameDraft);
      await StorageService.settings.delete('onboardingNameDraft');
    }
    setDisplayName(await StorageService.settings.get<string>('displayName', ''));
    const savedTodayLayout = normalizeTodayLayout(savedLayout);
    todayLayoutRef.current = savedTodayLayout;
    setTodayLayout(savedTodayLayout);

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
      setIsLocked(true);
      startupComplete.current = true;
      setAppReady(true);
      return;
    }

    const records = await reloadAllData();
    if (!sessionManager.isUnlocked() || !isEncryptedStorageActivated()) {
      setIsLocked(true);
      startupComplete.current = true;
      setAppReady(true);
      return;
    }
    startupComplete.current = true;
    setAppReady(true);
    void syncNotificationSchedules(
      records.tasks,
      records.habits,
      records.goals,
      records.milestones,
      effectiveNotificationPreferences(
        { ...DEFAULT_NOTIFICATION_PREFERENCES, ...savedNotificationPreferences },
        notificationsEnabledAfterResume
      )
    ).catch(() => {});
  };

  const effectiveNotificationPreferences = (preferences: NotificationPreferences, master = notificationsEnabled): NotificationPreferences => master ? preferences : DEFAULT_NOTIFICATION_PREFERENCES;

  const applyAppearance = async (preference: AppearancePreference) => {
    const save = appearanceSaveQueue.current.then(async () => {
      await StorageService.settings.set('theme', preference);
      setAppearancePreference(preference);
      setTheme(resolveAppearance(preference, systemDarkPreference()));
      try { localStorage.setItem('lifeos-appearance', preference); } catch { /* Settings remain authoritative. */ }
    });
    appearanceSaveQueue.current = save.catch(() => {});
    try { await save; }
    catch { showToast('Could not save display mode. Try again.', 'danger'); }
  };

  const previewVisualTheme = (themeId: ThemeId) => {
    setThemePreviewId(themeId === visualThemeId ? null : themeId);
  };

  const cancelVisualThemePreview = () => {
    setThemePreviewId(null);
  };

  const applyVisualTheme = async () => {
    if (!themePreviewId || visualThemeWrite.current) return;
    visualThemeWrite.current = true;
    setSavingVisualTheme(true);
    try {
      await StorageService.settings.set('visualTheme', themePreviewId);
      setVisualThemeId(themePreviewId);
      try { localStorage.setItem('lifeos-theme-id', themePreviewId); } catch { /* Persistent setting remains authoritative. */ }
      setThemePreviewId(null);
      showToast('Color theme applied', 'success');
    } catch (error) {
      cancelVisualThemePreview();
      showToast(error instanceof Error ? error.message : 'Could not save this theme.', 'danger');
    } finally {
      visualThemeWrite.current = false;
      setSavingVisualTheme(false);
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
          return { granted: false, status, message: 'Notifications remain off. You can allow them later in Notifications in Profile.' };
        }
        // Android owns prior-denial policy. Only request while the native plugin
        // reports a promptable state; never persist an unsafe pre-encryption flag.
        setNotificationPermissionRequested(true);
        await NotificationService.requestPermission();
        status = await NotificationService.checkPermission();
        if (status !== 'granted') {
          return { granted: false, status, message: 'Notifications remain off. You can allow them later in Notifications in Profile.' };
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
    const dateOnlyAlertTime = typeof StorageService.settings.get === 'function' ? await StorageService.settings.get<string>('dateOnlyAlertTime', DEFAULT_DATE_ONLY_ALERT_TIME) : undefined;
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
    const normalized = name.trim().slice(0, 48);
    if (!normalized || /[\u0000-\u001f\u007f-\u009f]/.test(normalized)) throw new Error('Enter a readable display name.');
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

  const saveDateOnlyAlertTime = async (time: string) => {
    if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
    try {
      await StorageService.settings.set('dateOnlyAlertTime', time);
      setDateOnlyAlertTime(time);
      if (!await syncNotificationSchedules(tasks, habits, goals, milestones)) showToast('Saved, but Android could not update some alerts.', 'danger');
    } catch { showToast('Could not save alert time.', 'danger'); }
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
        result = await BiometricService.authenticate('Secure BusyDoo', 'Confirm to enable the app lock');
      }
      if (!result.success) return { success: false, message: result.message || 'Authentication was not completed.' };
      if (!isEncryptedStorageActivated()) sessionManager.unlock();
      await StorageService.settings.set('biometricLockEnabled', true);
      setBiometricEnabled(true); setBiometricVerified(true);
      biometricAuthenticated.current = true;
      authCoordinator.markAuthenticated();
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
        throw new Error('BusyDoo found an existing key that needs recovery. No key was replaced. Open recovery or retry after restoring access.');
      }
      await setSensitiveScreenshotState(true);
      onboardingSetupAuthorized.current = true;
      await encryptedSession.open({ recoveryChoice: 'later' });
      const state = await CryptoService.getKeyState();
      if (!state.metadataConsistent || !state.keyProvisioned || !state.keystoreAliasPresent ||
          !state.unlocked || !state.recoveryDeferred || state.recoveryProvisioned ||
          !sessionManager.isUnlocked() || !isEncryptedStorageActivated()) {
        throw new Error('BusyDoo could not verify encrypted storage. Your records remain locked; please retry.');
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
      showToast('Unlock BusyDoo before setting up a recovery kit.', 'danger');
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
      throw new Error('BusyDoo could not verify the workspace state. No protected records were opened.');
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

  const exportProfileBackup = async () => {
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
        fileName: `busydoo-backup-${formatLocalDate(new Date())}.json`,
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
      console.error('BusyDoo backup export failed.');
      showToast(error instanceof Error ? `Backup export failed: ${error.message}` : 'Backup export failed. Your data was not changed.', 'danger');
    } finally { backupOperation.current = false; setBackupOperationInProgress(false); }
  };

  const exportProfileCsv = async () => {
    if (backupOperation.current) return;
    backupOperation.current = true;
    setBackupOperationInProgress(true);
    try {
      if (!isEncryptedStorageActivated()) { showToast('There are no protected records to export yet.', 'info'); return; }
      const token = sessionManager.capture();
      if (!(await confirmAction({ title: 'Export readable CSV?', message: 'This CSV contains readable financial records. BusyDoo does not encrypt CSV files. Save it somewhere you trust, or cancel and choose Export encrypted backup.', confirmLabel: 'Export CSV', cancelLabel: 'Cancel' }))) return;
      sessionManager.assertCurrent(token);
      const rows = transactions.map(tx => [tx.type, tx.description, tx.amount, tx.category, tx.date, formatLocalDateTime(new Date(tx.occurredAt || tx.createdAt)), tx.paymentMethod || '']);
      const quote = quoteCsvCell;
      const csv = [['type', 'description', 'amount', 'category', 'date', 'entry_time', 'payment_method'], ...rows].map(row => row.map(quote).join(',')).join('\n');

      const result = await exportBackupFile({
        contents: csv,
        fileName: `busydoo-transactions-${formatLocalDate(new Date())}.csv`,
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
    } finally { backupOperation.current = false; setBackupOperationInProgress(false); }
  };

  const refreshProfileIdentity = async () => {
    const [name, photo, prefs, currency] = await Promise.all([
      StorageService.settings.get('displayName', ''),
      StorageService.settings.get<unknown>(PROFILE_PHOTO_SETTING, null),
      StorageService.settings.get<Partial<UserPreferences>>('userPreferences', DEFAULT_USER_PREFERENCES),
      StorageService.settings.get<string>('currency', DEFAULT_USER_PREFERENCES.currency),
    ]);
    profilePhotoVersion.current++;
    setDisplayName(name);
    setProfilePhoto(readProfilePhoto(photo));
    setUserPrefs(mergeUserPreferences(prefs, currency));
  };

  const resetProfileData = async () => {
    if (backupOperation.current) return;
    backupOperation.current = true;
    setBackupOperationInProgress(true);
    let erased = false;
    try {
      if (!(await confirmAction({ title: 'Erase local records?', message: 'This removes local records and stored settings and cancels scheduled record reminders. Already displayed reminders and some diagnostic history may remain. Your device security setup and exported files are kept. Export a backup first if you want to keep your records.', confirmLabel: 'Erase local records', cancelLabel: 'Keep my data', destructive: true }))) return;
      await NotificationService.cancelAllRecordReminders();
      await StorageService.backup.clearAll();
      erased = true;
      await reloadAllData();
      await refreshProfileIdentity();
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      setNotificationsEnabled(false);
      showToast('All personal records erased', 'info');
    } catch {
      showToast(erased ? 'Records were erased. Reopen BusyDoo to refresh the display.' :
        'Reset did not complete. Reminder cleanup must succeed before records are erased.', 'danger');
    } finally { backupOperation.current = false; setBackupOperationInProgress(false); }
  };

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
        confirmLegacy: () => confirmAction({ title: 'Import a legacy backup?', message: 'This older backup is not encrypted. BusyDoo will validate it before restoring. New exports are encrypted.', confirmLabel: 'Validate and continue', cancelLabel: 'Cancel' }),
        validateTables: validateBackupTables,
      });
      if (text === null) return;
      const hasRecords = await StorageService.backup.hasData();
      if (hasRecords && !(await confirmAction({ title: 'Replace existing BusyDoo data?', message: 'Restoring this backup replaces the records currently on this device. Export a backup first if you may need a copy.', confirmLabel: 'Replace and restore', cancelLabel: 'Keep current data', destructive: true }))) return;
      await StorageService.backup.importData(text, { replaceExisting: hasRecords });
      restored = true;
      const records = await reloadAllData();
      await refreshProfileIdentity();
      const prefs = await StorageService.settings.get<NotificationPreferences>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES);
      const master = await StorageService.settings.get<boolean>('notificationsEnabled', Object.values(prefs).some(Boolean));
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...prefs });
      setNotificationsEnabled(master);
      await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(prefs, master));
      showToast('Backup restored successfully', 'success');
    } catch (error) {
      showToast(restored ? 'Backup restored, but the screen could not refresh. Reopen BusyDoo to verify.' : error instanceof Error ? error.message : 'Could not restore this backup', 'danger');
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
          const result = await BiometricService.authenticate('Unlock BusyDoo', 'Use your phone’s secure unlock');
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
    const photoVersion = ++profilePhotoVersion.current;
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
    if (photoVersion === profilePhotoVersion.current) {
      setProfilePhoto(sessionManager.isUnlocked() ? readProfilePhoto(storedPhoto) : null);
    }
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
      console.error('BusyDoo could not save habit completion.', error);
      showToast(error instanceof Error ? error.message : 'Could not update habit completion', 'danger');
      return;
    }

    let records;
    try {
      records = await reloadAllData();
    } catch (error) {
      console.error('Habit was saved, but BusyDoo could not refresh its data.', error);
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
      console.error('BusyDoo could not delete habit.', error);
      showToast(error instanceof Error ? error.message : 'Could not delete habit', 'danger');
      return;
    }

    let records;
    try {
      records = await reloadAllData();
    } catch (error) {
      console.error('Habit was deleted, but BusyDoo could not refresh its data.', error);
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

  const openCreateForm = (kind: 'transaction' | 'habit' | 'goal' | 'task' | 'budget' | 'savings' | 'contribution' | 'milestone' | 'goal-progress', goalId?: string, taskDate?: string, initialTitle = '') => {
    const now = new Date();
    const today = formatLocalDate(now);
    setCreateFormDirty(Boolean(initialTitle));
    setCreateDraft({
      title: initialTitle, amount: '', category: kind === 'transaction' ? (categories.find(category => category.type === 'expense')?.name || '') : kind === 'goal' ? 'Other' : '', date: taskDate || (kind === 'task' || kind === 'goal' ? '' : today), month: financeMonth,
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
    setCreateKind(kind);
  };

  const openEditBudget = (budget: Budget) => {
    setCreateFormDirty(false);
    setEditingBudgetId(budget.id);
    setCreateDraft({ categoryId: budget.categoryId || '', amount: budget.amountMinor && budget.currencyCode ? minorUnitsToDecimal(BigInt(budget.amountMinor), budget.currencyCode) : String(budget.monthlyAmount), month: budget.monthYear, currencyCode: budget.currencyCode || '', carryover: budget.carryover ? 'yes' : '' });
    setCreateKind('budget');
  };

  const openEditTransaction = (transaction: Transaction) => {
    setCreateFormDirty(false);
    setCreateDraft({
      title: transaction.description || '', amount: transaction.amountMinor !== undefined && transaction.currencyCode ? minorUnitsToDecimal(BigInt(transaction.amountMinor), transaction.currencyCode) : String(transaction.amount), category: transaction.category,
      type: transaction.type, paymentMethod: transaction.paymentMethod || 'Other',
      currencyCode: transaction.currencyCode || '', accountId: transaction.accountId || '',
      date: transaction.date,
      dateTime: transaction.occurredAt ? formatLocalDateTime(new Date(transaction.occurredAt)) : '',
      notes: transaction.notes || '', isRecurring: transaction.isRecurring ? 'yes' : '',
    });
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
    setCreateDraft({ title: goal.title, category: goal.category, target: String(target), current: String(current), unit: selectedUnit, goalMode: goal.mode || 'accumulate', baselineValue: goal.baselineValue === undefined ? '' : String(oldUnit && selectedUnit !== oldUnit ? convertMeasurement(goal.baselineValue, oldUnit, selectedUnit) : goal.baselineValue), date: goal.targetDate, startDate: goal.startDate, priority: goal.priority, status: goal.status, description: goal.description || '' });
    setEditingGoalId(goal.id); setEditingTaskId(null); setEditingHabitId(null); setEditingTransactionId(null); setCreateKind('goal');
  };

  const openEditTask = (task: Task) => {
    setCreateFormDirty(false);
    setCreateDraft({
      title: task.title, description: task.description || task.notes || '', date: task.dueDate || '',
      time: task.dueTime || '', dueAlert: task.dueAlertDisabled ? 'off' : 'on', reminderLead: task.reminderLeadMinutes ? String(task.reminderLeadMinutes) : task.reminderAt ? 'legacy' : '', reminderAt: task.reminderAt ? formatLocalDateTime(new Date(task.reminderAt)) : '',
      priority: task.priority, category: task.category || '', goalId: task.goalId && goals.some(goal => goal.id === task.goalId) ? task.goalId : '', recurring: task.recurring || 'None',
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
    setCreateDraft({ title: habit.name, goalId: habit.goalId && goals.some(goal => goal.id === habit.goalId) ? habit.goalId : '', description: habit.description || '', targetPerDay: habit.targetPerDay === undefined ? '' : String(habit.targetPerDay), trackingMode: habit.trackingMode || 'binary', quantityUnit: habit.quantityUnit || '', frequency: habit.frequency, weekdays: habitScheduleOnDate(habit, formatLocalDate(new Date()))?.weekdays.join(',') || '', weeklySessions: String(habitScheduleOnDate(habit, formatLocalDate(new Date()))?.sessionsPerWeek || ''), reminderTime: habit.reminderTime || '', reminderWeekday: String(habit.reminderWeekday || 2) });
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
    try {
      if (remove) {
        if (!await confirmAction({ title: 'Remove profile photo?', message: 'Your profile will use the default avatar.', confirmLabel: 'Remove photo', destructive: true })) return;
        if (!isEncryptedStorageActivated() || !sessionManager.isUnlocked()) throw new Error('Unlock BusyDoo before removing your photo.');
        await StorageService.settings.delete(PROFILE_PHOTO_SETTING);
        profilePhotoVersion.current++;
        setProfilePhoto(null);
      } else {
        const file = await pickProfilePhoto();
        if (file) setPendingProfilePhoto(file);
      }
    } catch { setProfilePhotoError('Could not change your profile photo. Try again.'); }
    finally { profilePhotoOperation.current = false; setProfilePhotoBusy(false); }
  };

  const saveProfilePhoto = async (photo: string) => {
    await ensurePrivateStorageBeforeWrite();
    if (!sessionManager.isUnlocked() || !isEncryptedStorageActivated()) throw new Error('Unlock BusyDoo before saving the crop.');
    await StorageService.settings.set(PROFILE_PHOTO_SETTING, photo);
    profilePhotoVersion.current++;
    setProfilePhoto(photo);
    setPendingProfilePhoto(null);
    showToast('Profile photo saved', 'success');
  };

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
    if (nextTitle.length > 200) throw new Error('Enter a task title of 1 to 200 characters.');
    const issue = taskScheduleError({ ...details, title: nextTitle });
    if (issue) throw new Error(issue);
    if (quickTaskOperation.current) throw new Error('A task is already being saved.');
    quickTaskOperation.current = true;
    try {
      let committed = false;
      await ensurePrivateStorageBeforeWrite();
      const now = new Date();
      const lateIssue = taskScheduleError({ ...details, title: nextTitle }, undefined, now);
      if (lateIssue) throw new Error(lateIssue);
      const reminderAt = details.reminderAt ? new Date(details.reminderAt).toISOString() : undefined;
      await StorageService.tasks.add({ title: nextTitle, dueDate: details.dueDate, dueTime: details.dueTime,
        reminderAt, dateOnlyAlertAnchorAt: details.dueTime ? undefined : now.toISOString(), priority: details.priority || 'Medium', recurring: 'None', completed: false });
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
      if (createKind === 'task') {
        const previous = editingTaskId ? tasks.find(task => task.id === editingTaskId) : undefined;
        const reminderAt = value('reminderLead') === 'legacy' ? value('reminderAt') : undefined;
        const issue = taskScheduleError({ title: value('title'), dueDate: value('date'), dueTime: value('time'), reminderAt }, previous);
        if (issue) throw new Error(issue);
      }
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
        if (existingTransaction && !existingTransaction.currencyCode && !value('currencyCode')) throw new Error('Choose the original currency for this historical transaction.');
        const preserveUnknownTime = !value('dateTime') && Boolean(createDraft.importFingerprint || (existingTransaction && !existingTransaction.occurredAt));
        const values = { ...buildTransactionUpdate({ type: value('type') as 'income' | 'expense', amount: value('amount'), currencyCode: (value('currencyCode') || existingTransaction?.currencyCode || (!editingTransactionId ? userPrefs.currency : undefined)) as typeof CURRENCY_CODES[number] | undefined, category: value('category'), description: value('title'), dateTime: value('dateTime'), date: preserveUnknownTime ? value('date') || existingTransaction?.date : existingTransaction?.date, preserveUnknownTime, paymentMethod: value('paymentMethod'), notes: value('notes'), isRecurring: value('isRecurring') === 'yes' }), accountId: Object.prototype.hasOwnProperty.call(createDraft, 'accountId') ? value('accountId') || undefined : existingTransaction?.accountId };
        const accountId = values.accountId;
        if (existingTransaction?.occurredAt && value('dateTime') === formatLocalDateTime(new Date(existingTransaction.occurredAt))) {
          values.occurredAt = existingTransaction.occurredAt;
        }
        if (accountId && !financialAccounts.some(account => account.id === accountId && account.isActive && account.currencyCode === (values.currencyCode || existingTransaction?.currencyCode || userPrefs.currency))) throw new Error('Choose an active account with the same currency as this transaction.')
        if (editingTransactionId) await StorageService.transactions.update(editingTransactionId, values);
        else if (createDraft.importFingerprint) {
          const imported = { ...values, importFingerprint: createDraft.importFingerprint };
          const options = { historicalFingerprints: value('historicalImportFingerprints').split(' ').filter(Boolean) };
          try { await StorageService.transactions.add(imported, options); }
          catch (error) {
            if (!(error instanceof PossibleImportDuplicateError)) throw error;
            const separate = await confirmAction({
              title: 'Record a separate transaction?',
              message: 'A similar transaction is already recorded. Save this only if it is a separate payment.',
              confirmLabel: 'Save separate transaction',
            });
            if (!separate || backState.current.isLocked || !sessionManager.isUnlocked()) return;
            await StorageService.transactions.add(imported, { ...options, allowPossibleDuplicate: true });
          }
        } else await StorageService.transactions.add(values);
      } else if (createKind === 'habit') {
        const targetPerDay = value('targetPerDay') ? Number(value('targetPerDay')) : undefined;
        if (targetPerDay !== undefined && (!Number.isFinite(targetPerDay) || targetPerDay <= 0)) throw new Error('Habit target must be greater than zero.');
        const trackingMode = value('trackingMode') === 'quantity' ? 'quantity' : 'binary';
        const existingHabit = editingHabitId ? habits.find(habit => habit.id === editingHabitId) : undefined;
        if (editingHabitId && habitLogs.some(log => log.habitId === editingHabitId) && trackingMode !== (existingHabit?.trackingMode || 'binary')) throw new Error('Tracking mode cannot change after check-in history exists. Create another habit to use a different tracking mode.');
        if (trackingMode === 'quantity' && (!targetPerDay || !value('quantityUnit').trim())) throw new Error('Quantity tracking needs a daily target and unit.');
        const goalId = value('goalId');
        if (goalId && !goals.some(goal => goal.id === goalId)) throw new Error('Choose an available goal.');
        const weekdays = value('weekdays').split(',').filter(Boolean).map(Number).sort((a, b) => a - b);
        const sessionsPerWeek = value('weeklySessions') ? Number(value('weeklySessions')) : undefined;
        const today = formatLocalDate(new Date());
        const effectiveDate = value('habitScheduleFrom') || today;
        const effective = existingHabit && habitScheduleOnDate(existingHabit, effectiveDate);
        if ((sessionsPerWeek !== undefined && (!Number.isInteger(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > weekdays.length))
          || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Choose enough scheduled weekdays for the weekly target.');
        const revised = weekdays.length > 0 && (effectiveDate !== today || effective?.weekdays.join(',') !== weekdays.join(',') || effective?.sessionsPerWeek !== sessionsPerWeek);
        if (revised && effectiveDate < today) throw new Error('Choose today or a future date for the schedule revision.');
        const schedule = revised ? [...(existingHabit?.schedule || []).filter(row => row.from !== effectiveDate), { from: effectiveDate, weekdays, sessionsPerWeek }]
          .sort((left, right) => left.from.localeCompare(right.from)) : existingHabit?.schedule;
        const habit: Partial<Habit> = { goalId: goalId || undefined, name: value('title'), description: value('description') || undefined, frequency: existingHabit?.schedule?.length ? existingHabit.frequency : value('frequency') as Habit['frequency'], ...(schedule ? { schedule } : {}), color: existingHabit?.color || '#6366f1', targetPerDay, trackingMode, quantityUnit: trackingMode === 'quantity' ? normalizeHabitUnit(value('quantityUnit')) : undefined, reminderTime: value('reminderTime') || undefined, reminderWeekday: value('frequency') === 'weekly' ? Number(value('reminderWeekday')) : undefined };
        if (editingHabitId) await StorageService.habits.update(editingHabitId, habit);
        else await StorageService.habits.add({ ...habit, name: habit.name!, frequency: habit.frequency!, color: habit.color! });
      } else if (createKind === 'budget') {
        const code = editingBudgetId ? budgets.find(row => row.id === editingBudgetId)?.currencyCode : userPrefs.currency;
        if (!code) throw new Error('This budget has no saved currency and cannot be edited safely.');
        const money = createMoneyRecordAmount(value('amount'), code);
        await StorageService.budgets.upsert({ categoryId: value('categoryId') || undefined, monthlyAmount: money.amount, amountMinor: money.amountMinor, currencyCode: money.currencyCode, monthYear: value('month'), carryover: value('carryover') === 'yes' });
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
        if (goal.mode === 'milestone') throw new Error('Update milestones to record progress for this goal.');
        validateGoalMeasure({ ...goal, currentValue });
        await StorageService.goals.update(goal.id, { currentValue });
      } else if (createKind === 'goal') {
        const mode = (value('goalMode') || 'accumulate') as NonNullable<Goal['mode']>;
        let targetValue = mode === 'milestone' ? 0 : Number(value('target'));
        let currentValue = mode === 'milestone' ? 0 : Number(value('current'));
        let baselineValue = mode === 'reduce' ? Number(value('baselineValue')) : undefined;
        if (!Number.isFinite(targetValue) || targetValue < 0 || (targetValue === 0 && mode !== 'reduce' && mode !== 'milestone') ||
          !Number.isFinite(currentValue) || currentValue < 0) throw new Error('Enter a valid goal target and progress.');
        let goalUnit = mode === 'frequency' ? 'sessions' : mode === 'milestone' ? '' : value('unit');
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
          unit: goalUnit || undefined, startDate: value('startDate') || value('date') || formatLocalDate(new Date()), targetDate: value('date'),
          priority: value('priority') as Goal['priority'], status: (value('status') || 'In Progress') as Goal['status'],
        };
        validateGoalMeasure(goalFields);
        if (editingGoalId) await StorageService.goals.update(editingGoalId, goalFields);
        else await StorageService.goals.add(goalFields);
      } else {
        const reminderAt = value('reminderLead') === 'legacy' && value('reminderAt') ? new Date(value('reminderAt')).toISOString() : undefined;
        const reminderLeadMinutes = value('reminderLead') && value('reminderLead') !== 'legacy' ? Number(value('reminderLead') === 'custom' ? value('reminderCustom') : value('reminderLead')) : undefined;
        const previousTask = editingTaskId ? tasks.find(task => task.id === editingTaskId) : undefined;
        const now = new Date();
        const dueDate = value('date');
        const dueTime = value('time');
        const scheduleChanged = !previousTask || dueDate !== (previousTask.dueDate || '') || dueTime !== (previousTask.dueTime || '');
        const scheduleError = taskScheduleError({ title: value('title'), dueDate, dueTime, reminderAt }, previousTask, now);
        if (scheduleError) throw new Error(scheduleError);
        if (reminderLeadMinutes && (scheduleChanged || reminderLeadMinutes !== previousTask?.reminderLeadMinutes)) {
          const due = parseLocalDateTime(dueDate, dueTime || dateOnlyAlertTime);
          if (!due || +due - reminderLeadMinutes * 60_000 <= +now) throw new Error('Choose an extra reminder that is still in the future.');
        }
        const goalId = value('goalId');
        if (goalId && !goals.some(goal => goal.id === goalId)) throw new Error('Choose an available goal.');
        const subtasks = editingTaskId ? [] : value('subtasks').split('\n').map(title => title.trim()).filter(Boolean);
        if (subtasks.length > 25 || subtasks.some(title => title.length > 160)) throw new Error('Use up to 25 subtasks with 160 characters each.');
        const taskUpdates: Partial<Task> = {
          goalId: goalId || undefined,
          ...(subtasks.length ? { subtasks: subtasks.map(title => ({ id: globalThis.crypto.randomUUID(), title, completed: false, createdAt: new Date().toISOString() })) } : {}),
          title: value('title'), description: value('description') || undefined, notes: value('description') || undefined,
          dueDate: dueDate || undefined, dueTime: dueTime || undefined, reminderAt,
          dateOnlyAlertAnchorAt: dueDate && !dueTime ? scheduleChanged ? now.toISOString() : previousTask?.dateOnlyAlertAnchorAt : undefined, reminderLeadMinutes, dueAlertDisabled: value('dueAlert') === 'off',
          priority: value('priority') as Task['priority'], category: value('category') || undefined,
          recurring: (value('recurring') || 'None') as Task['recurring'],
        };
        if (editingTaskId) {
          const previous = tasks.find(task => task.id === editingTaskId);
          const scheduled = previous?.recurrenceScheduledDate || previous?.dueDate;
          const keepSeries = scheduled && taskUpdates.dueDate && previous?.recurring === taskUpdates.recurring && taskUpdates.recurring !== 'None';
          taskUpdates.recurrenceScheduledDate = keepSeries ? scheduled : undefined;
          taskUpdates.recurrenceAnchorDay = keepSeries ? previous?.recurrenceAnchorDay ?? Number(scheduled.slice(-2)) : undefined;
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
  const financeAnalytics = useMemo(() => buildFinanceAnalytics(transactions, budgets, financeMonth, financeAnalyticsRange, categories, userPrefs.currency), [transactions, budgets, financeMonth, financeAnalyticsRange, categories, userPrefs.currency]);
  const hasFinanceChartData = financeAnalytics.periodRows.some(row => row.hasRecords) || financeAnalytics.categories.length > 0;

  // Habit Streak Calculation Helper
  const getHabitStreaks = (habitId: string, targetDate: string) => {
    const habit = habits.find(row => row.id === habitId);
    const stats = calculateStreaks(habitLogs, habitId, targetDate, habit?.frequency || 'daily', habit);
    return { ...stats, totalCount: new Set(habitLogs.filter(log => log.habitId === habitId && log.completed).map(log => log.date)).size };
  };

  const todayKey = formatLocalDate(clockNow);
  const todayOverview = useMemo(
    () => getTodayOverview(tasks, habits, habitLogs, todayKey),
    [tasks, habits, habitLogs, todayKey]
  );
  const routineDueToday = (habit: Habit) => (habit.frequency !== 'weekly' || Boolean(habitScheduleOnDate(habit, todayKey))) && isHabitEligible(habit, todayKey);
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
      if (status === 'Completed' && !isGoalComplete(goal, milestones.filter(item => item.goalId === goal.id))) {
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

  const goalProgress = (goal: Goal) => goalProgressPercent(goal, milestones.filter(row => row.goalId === goal.id));
  const goalProgressLabel = (goal: Goal) => {
    if (goal.mode === 'milestone') {
      const related = milestones.filter(row => row.goalId === goal.id);
      return `${related.filter(row => row.completed).length} of ${related.length} milestones complete`;
    }
    const current = displayGoalMeasure(goal.currentValue, goal.unit);
    const target = displayGoalMeasure(goal.targetValue, goal.unit);
    return goal.mode === 'reduce' ? `${current} now, target ${target}` : `${current} of ${target}`;
  };
  const editingLegacyDateOnly = Boolean(createKind === 'transaction' && editingTransactionId
    && !transactions.find(tx => tx.id === editingTransactionId)?.occurredAt);
  const matchesActivityDate = (date: string) => Boolean(date) && (activityRange.from || activityRange.through
    ? (!activityRange.from || date >= activityRange.from) && (!activityRange.through || date <= activityRange.through)
    : date.startsWith(financeMonth));
  const matchesActivityAmount = (minor: string | undefined, amount: number, currency: string) => {
    if (!activityRange.min && !activityRange.max) return true;
    try {
      const value = minor === undefined ? decimalToMinorUnits(String(amount), currency) : BigInt(minor);
      return (!activityRange.min || value >= decimalToMinorUnits(activityRange.min, currency))
        && (!activityRange.max || value <= decimalToMinorUnits(activityRange.max, currency));
    } catch { return false; }
  };
  const filteredTransactions = useMemo(() => sortTransactions(transactions.filter(tx => {
    const query = financeSearch.trim().toLowerCase();
    const haystack = `${tx.description || ''} ${tx.category || ''} ${tx.notes || ''} ${tx.paymentMethod || ''}`.toLowerCase();
    return matchesActivityDate(tx.date) && ((!activityRange.min && !activityRange.max) || (tx.currencyCode && matchesActivityAmount(tx.amountMinor, tx.amount, tx.currencyCode)))
      && (financeTypeFilter === 'all' || tx.type === financeTypeFilter)
      && (financeCategoryFilter === 'all' || tx.category === financeCategoryFilter)
      && (financeAccountFilter === 'all' || (financeAccountFilter === 'unassigned' ? !tx.accountId : tx.accountId === financeAccountFilter))
      && (financeCurrencyFilter === 'all' || tx.currencyCode === financeCurrencyFilter)
      && (!query || haystack.includes(query));
  }), financeSort as 'date-asc' | 'date-desc' | 'amount-desc'),
  [transactions, financeMonth, activityRange, financeTypeFilter, financeCategoryFilter, financeAccountFilter, financeCurrencyFilter, userPrefs.currency, financeSearch, financeSort]);
  const filteredTransfers = financeTypeFilter === 'all' || financeTypeFilter === 'transfer'
    ? accountTransfers.filter(row => {
      const query = financeSearch.trim().toLowerCase();
      const names = financialAccounts.filter(account => account.id === row.fromAccountId || account.id === row.toAccountId).map(account => account.name);
      return matchesActivityDate(row.date) && financeCategoryFilter === 'all'
        && (financeAccountFilter === 'all' || financeAccountFilter === row.fromAccountId || financeAccountFilter === row.toAccountId)
        && (((financeCurrencyFilter === 'all' || financeCurrencyFilter === row.fromCurrencyCode)
          && matchesActivityAmount(row.fromAmountMinor, 0, row.fromCurrencyCode))
          || ((financeCurrencyFilter === 'all' || financeCurrencyFilter === row.toCurrencyCode)
          && matchesActivityAmount(row.toAmountMinor, 0, row.toCurrencyCode)))
        && (!query || [row.notes, ...names, 'transfer'].some(value => value?.toLowerCase().includes(query)));
    }) : [];
  const transactionResultCount = filteredTransactions.length + filteredTransfers.length;
  const transactionDateGroups = financeSort === 'amount-desc' && (filteredTransactions.length || filteredTransfers.length)
    ? [null]
    : [...new Set([...filteredTransactions, ...filteredTransfers].map(row => row.date))]
    .sort((a, b) => financeSort === 'date-asc' ? a.localeCompare(b) : b.localeCompare(a));
  const hasTransactionFilters = Boolean(financeSearch.trim()) || financeTypeFilter !== 'all' || financeCategoryFilter !== 'all'
    || financeAccountFilter !== 'all' || financeCurrencyFilter !== 'all' || financeSort !== 'date-desc' || Object.values(activityRange).some(Boolean);

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

  if (!appReady) return <div className="lifeos-page fixed inset-0 flex items-center justify-center px-6" aria-label={startupError ? 'BusyDoo could not start' : 'Loading BusyDoo'}>{startupError ? <div className="max-w-sm text-center"><div className="mb-4"><BusyDooBrand /></div><h1 className="text-xl font-semibold">BusyDoo could not open</h1><p className="mt-2 text-sm text-secondary">{startupError}</p><button className="lifeos-accent-button mt-5 min-h-11 rounded-xl px-5 text-sm font-semibold" onClick={() => { setStartupError(''); void initApp().catch(error => setStartupError(error instanceof Error ? error.message : 'BusyDoo could not open local data.')); }}>Try again</button><button className="lifeos-input mt-3 block min-h-11 w-full rounded-xl px-4" onClick={() => { void openRecovery(); }}>Recover access</button></div> : <div role="status" className="grid justify-items-center" aria-label="Opening BusyDoo"><BusyDooBrand /></div>}</div>;

  if (firstRecordSecurityOpen) return <FirstRecordSecurityDialog onDecision={choice => {
    void setSensitiveScreenshotState(profileAdmissionPending || profileOpen).catch(() => {});
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
        <BusyDooBrand className="mb-5" />
        <h2 className="text-2xl font-bold mb-2">BusyDoo is locked</h2>
        <p className="text-sm text-secondary mb-8 max-w-xs">Confirm your identity to open your records.</p>
        <button
          onClick={triggerBiometricAuth}
          className="lifeos-accent-button min-h-12 w-full max-w-xs rounded-xl px-6 py-3.5 font-semibold active:scale-95 transition"
        >
          {biometricMessage ? 'Try again' : 'Unlock'}
        </button>
          <button className="lifeos-input mt-3 min-h-11 rounded-xl px-4" onClick={() => { void openRecovery(); }}>Recover access</button>
        {biometricMessage && <p role="status" className="lifeos-warning mt-4 max-w-xs text-sm">{biometricMessage}</p>}
      </div>
    );
  }

  const primarySection = primaryDestinationForTab(activeTab);
  const todayBack = todayOrigin.current?.destination === activeTab;
  const sectionTitle = profileOpen ? PROFILE_TITLES[profileSection] : PRIMARY_NAVIGATION.find(item => item.tab === primarySection)?.label;

  return (
    <LazyMotion features={domAnimation} strict>
    <div ref={gestureSurfaceElement} className="lifeos-page app-shell feather-expressive" data-reduced={interfaceMotion.reducedMotion} onPointerDownCapture={handleContentPointerDown} onClickCapture={handleContentClickCapture}>
      <span className="lifeos-safe-area-probe" aria-hidden="true" />
      <AppHeader profile={profileOpen} title={primarySection === 'dashboard' ? APP_NAME : sectionTitle || APP_NAME} brand={primarySection === 'dashboard'}
        back={profileOpen && profileSection !== 'home' ? backFromProfile : todayBack && activeTab !== 'finance' ? navigateBack : undefined}
        backLabel={todayBack && activeTab !== 'finance' ? 'Back to Today' : profileSection === 'home' ? 'Back from profile' : 'Back to ' + PROFILE_TITLES[profileParent(profileSection)]}
        action={activeTab === 'finance' && financeSubtab === 'overview' && <MoneyPeriod label="Money" month={financeMonth} onChange={setFinanceMonth} />} />

      {!isOnline && (
        <div data-profile-background role="status" aria-live="polite" className="app-content-width px-4 pt-2">
          <div className="lifeos-warning lifeos-panel rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'var(--warning)' }}>
            Offline — BusyDoo records remain stored on this device. Internet-dependent services may be unavailable.
          </div>
        </div>
      )}

      {sharedReviewAvailable && sharedAlert.needsStorage && !smartImportOpen &&
        <div className="app-content-width px-4 pt-2">
          <button type="button" className="feather-secondary" onClick={async () => {
            try { await ensurePrivateStorageBeforeWrite(); sharedAlert.recheck(); }
            catch { showToast('Shared alert review is paused. Unlock BusyDoo to continue.', 'info'); }
          }}>Review shared alert</button>
          <button type="button" className="feather-secondary" onClick={sharedAlert.discard}>Dismiss shared alert</button>
        </div>}

      {/* Main Container */}
      <main data-record-background className={profileOpen && profileSection !== 'home' ? 'app-main profile-main' : 'app-main'}>
        <div className="ui-tab-viewport"><div className="ui-tab-screen-stack" ref={navigationMotion.attachStage}>
        {/* VIEW 1: DASHBOARD */}
        <RetainedScreen active={activeTab === 'dashboard'} retainInactive id="screen-dashboard" {...transitionPropsFor('dashboard')} render={() => (
          <div className="today-sections command-centre" data-testid="today-dashboard" {...todayCards.handlers}>
            <div className="today-heading" style={{ order: 0 }}><div><p className="text-sm font-medium text-muted">{clockNow.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><p className="today-greeting font-semibold tracking-tight">{greetingForHour(clockNow.getHours(), displayName)}</p>
              {showTodayReorderHint && <p className="today-reorder-hint">Touch and hold a card to rearrange.</p>}</div><button type="button" onClick={() => setTodayCustomizationOpen(open => !open)} aria-expanded={todayCustomizationOpen} aria-haspopup="dialog" aria-controls="today-customization" aria-label="Today layout" className="feather-icon-button"><SlidersHorizontal size={19} aria-hidden="true" /></button></div>

            {todayCustomizationOpen && createPortal(<div className="ui-sheet-backdrop today-customization-layer" onMouseDown={dismissTodayCustomizationBackdrop}>
            <section id="today-customization" role="dialog" aria-modal="true" aria-labelledby="today-customization-title" aria-describedby="today-customization-description" className="today-customization ui-sheet-motion ui-bottom-sheet lifeos-panel">
              <div className="today-customization-heading"><h3 id="today-customization-title" className="text-sm font-semibold">Make Today yours</h3><p id="today-customization-description" className="mt-1 text-xs text-secondary">Choose which sections appear and arrange their order. Changes save as you make them.</p></div>
              <div className="today-customization-scroll"><ul className="today-customization-list">{todayLayout.order.map((id, index) => <li key={id}>
                <label className="today-section-toggle"><input type="checkbox" checked={!todayLayout.hidden.includes(id)} disabled={id === 'focus'} onChange={event => persistTodayLayout(setTodaySectionVisible(todayLayoutRef.current, id, event.target.checked))} /><span>{TODAY_SECTION_LABELS[id]}</span></label>
                <div className="today-order-actions"><button type="button" aria-label={`Move ${TODAY_SECTION_LABELS[id]} up`} disabled={index === 0} onClick={() => persistTodayLayout(moveTodaySection(todayLayoutRef.current, id, -1))}>Up</button><button type="button" aria-label={`Move ${TODAY_SECTION_LABELS[id]} down`} disabled={index === todayLayout.order.length - 1} onClick={() => persistTodayLayout(moveTodaySection(todayLayoutRef.current, id, 1))}>Down</button></div>
              </li>)}</ul></div>
              <div className="ui-form-actions today-customization-actions"><button type="button" onClick={() => persistTodayLayout(DEFAULT_TODAY_LAYOUT)} className="min-h-11 flex-1 rounded-lg px-2 text-xs font-semibold lifeos-accent-text">Restore default layout</button><button type="button" onClick={closeTodayCustomization} className="lifeos-accent-button min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold">Done</button></div>
            </section></div>, document.body)}

            {/* Keep the first panel focused: one useful progress cue and fast ways to act. */}
            <section className="today-focus lifeos-panel rounded-2xl border p-4" data-today-card="focus" tabIndex={-1} style={todaySectionStyle('focus')} aria-labelledby="today-overview-title" data-testid="today-overview">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="today-overview-title" className="today-summary-title">Due today</h3>
                  {todayOverview.tasksDue > 0 ? <p className="today-summary-copy"><strong className="tabular-nums">{todayOverview.tasksCompleted} of {todayOverview.tasksDue}</strong> tasks complete</p>
                    : <p className="today-summary-copy">Nothing due today.</p>}
                </div>
                <div className="today-quick-actions" aria-label="Quick add">
                  <button type="button" onClick={() => openCreateForm('task')} className="feather-primary">Add task</button>
                </div>
              </div>
              {todayOverview.tasksDue > 0 && <div className="today-focus-progress mt-3" role="progressbar" aria-label="Today’s tasks complete" aria-valuemin={0} aria-valuemax={todayOverview.tasksDue} aria-valuenow={todayOverview.tasksCompleted}><span style={{ width: `${Math.min(100, (todayOverview.tasksCompleted / todayOverview.tasksDue) * 100)}%` }} /></div>}
              {tasks.some(task => getTaskStatus(task, clockNow) === 'Overdue') && <button type="button" className="today-attention-link" onClick={event => { setPlannerFilter('overdue'); openFromToday('planner', event.currentTarget); }}>Review overdue tasks </button>}
            </section>

            {/* Active Goals Summary */}
            <section className="today-section-goals lifeos-panel rounded-2xl border p-4" data-today-card="goals" tabIndex={-1} style={todaySectionStyle('goals')}>
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-wider lifeos-accent-text">Goals</p><h3 className="text-sm font-semibold">{goals.filter(goal => goal.status === 'In Progress' && !goal.archived).length} active goals</h3></div>
                <button onClick={event => openFromToday('goals', event.currentTarget)} className="rounded-lg px-2 py-1 text-xs font-semibold lifeos-accent-text" aria-label="Open Goals">View all</button>
              </div>
              {goals.filter(goal => goal.status === 'In Progress' && !goal.archived).length === 0 ? (
                <div className="today-inline-empty"><p>No active goals yet.</p><button onClick={event => { openFromToday('goals', event.currentTarget); openCreateForm('goal'); }} className="min-h-11 font-semibold lifeos-accent-text">Create your first goal</button></div>
              ) : <div className="space-y-3">{goals.filter(goal => goal.status === 'In Progress' && !goal.archived).slice(0, 1).map(goal => {
                const progress = goalProgress(goal);
                return <button key={goal.id} onClick={event => openFromToday('goals', event.currentTarget)} className="lifeos-raised block min-h-11 w-full rounded-xl p-3 text-left">
                  <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{goal.title}</span><span className="shrink-0 text-xs font-bold lifeos-accent-text">{progress}%</span></div>
                  <div className="lifeos-progress-track my-2 h-1.5 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} /></div>
                  <div className="flex justify-between gap-2 text-[10px] text-secondary"><span>{goalProgressLabel(goal)}</span><span>{formatDate(goal.targetDate)} · {getDaysRemainingText(goal.targetDate)}</span></div>
                </button>;
              })}</div>}
            </section>

            {/* Financial Overview Card */}
            <div className="today-money-summary today-section-money lifeos-panel rounded-2xl border p-4" data-today-card="money" tabIndex={-1} style={todaySectionStyle('money')}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="type-section-title">Money this month</h3>
                <button onClick={event => openFromToday('finance', event.currentTarget)} className="min-h-11 text-xs lifeos-accent-text font-semibold">See breakdown</button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="p-3 rounded-xl lifeos-raised">
                  <p className="text-xs text-secondary">Income</p>
                  <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: 'var(--success)' }}>{formatMinorUnits(BigInt(financeAnalytics.totalIncomeMinor), userPrefs.currency, userPrefs.locale === 'system' ? undefined : userPrefs.locale)}</p>
                </div>
                <div className="p-3 rounded-xl lifeos-raised">
                  <p className="text-xs text-secondary">Expenses</p>
                  <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: 'var(--danger)' }}>{formatMinorUnits(BigInt(financeAnalytics.totalExpensesMinor), userPrefs.currency, userPrefs.locale === 'system' ? undefined : userPrefs.locale)}</p>
                </div>
              </div>
              <div className="flex justify-between gap-3 text-xs text-secondary">
                <span>Net cash flow: <strong className="text-primary tabular-nums">{formatMinorUnits(BigInt(financeAnalytics.netSavingsMinor), userPrefs.currency, userPrefs.locale === 'system' ? undefined : userPrefs.locale)}</strong></span>
                <div className="inline-flex items-center gap-1">Cash-flow margin <strong className="tabular-nums" style={{ color: financeAnalytics.savingsRate !== null && financeAnalytics.savingsRate < 0 ? 'var(--danger)' : 'var(--accent)' }}>{financeAnalytics.savingsRate === null ? '—' : `${financeAnalytics.savingsRate.toFixed(1)}%`}</strong><InfoTip label="Cash-flow margin" /></div>
              </div>
            </div>

            <section className="today-habit-summary" data-today-card="habits" tabIndex={-1} style={todaySectionStyle("habits")} aria-labelledby="today-routines-title">
              <h3 id="today-routines-title" className="today-summary-title">Daily routines</h3>
              {todayOverview.routinesDue > 0 && <>
                <p className="today-summary-copy"><strong className="tabular-nums">{todayOverview.routinesCompleted} of {todayOverview.routinesDue}</strong> complete today</p>
                <div className="today-focus-progress today-routine-progress" role="progressbar" aria-label="Daily routines complete"
                  aria-valuemin={0} aria-valuemax={todayOverview.routinesDue} aria-valuenow={todayOverview.routinesCompleted}>
                  <span style={{ width: Math.min(100, todayOverview.routinesCompleted / todayOverview.routinesDue * 100) + '%' }} />
                </div>
              </>}
              {habits.length === 0 ? <p className="today-routines-empty">Your habits will appear here.</p> :
                <ul className="today-routine-list">{habits.filter(habit => routineDueToday(habit)).slice(0, 3).map(habit => {
                  const completed = getHabitStreaks(habit.id, todayKey).completedToday;
                  const quantity = habit.trackingMode === "quantity";
                  const log = quantity ? habitLogs.find(row => row.habitId === habit.id && row.date === todayKey && row.quantity !== undefined) : undefined;
                  const increment = formatHabitQuantity(1, habit.quantityUnit);
                  const status = quantity ? formatHabitProgress(log?.quantity, log?.quantityUnit, habit.targetPerDay || 0, habit.quantityUnit)
                    : completed ? 'Completed today' : 'Not done yet';
                  return <li key={habit.id} className="today-routine-row">
                    {!quantity && <button type="button" className="today-routine-toggle" aria-pressed={completed}
                      aria-label={completed ? 'Undo completion for ' + habit.name : 'Complete ' + habit.name}
                      onClick={() => void handleHabitCompletion(habit.id, habit.name, todayKey, completed)}>
                      <span>{completed && <Check size={15} aria-hidden="true" />}</span>
                    </button>}
                    <div className="today-routine-copy"><strong>{habit.name}</strong><small>{status}</small></div>
                    {quantity && <button type="button" className="today-routine-add" aria-label={'Add ' + increment + ' to ' + habit.name}
                      onClick={() => void handleHabitQuantity(habit, todayKey, 1)}>Add {increment}</button>}
                  </li>;
                })}</ul>}
              {habits.length > 0 && !habits.some(habit => routineDueToday(habit)) && <p className="today-routines-empty">No routines scheduled for today.</p>}
              <button type="button" className="today-summary-action" onClick={event => openFromToday('habits', event.currentTarget)}>View habits</button>
            </section>
            <section className="today-upcoming-section lifeos-panel rounded-2xl border p-4" data-today-card="upcoming" tabIndex={-1} style={todaySectionStyle('upcoming')} aria-labelledby="today-upcoming-title">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">NEXT</p><h3 id="today-upcoming-title" className="mt-1 text-sm font-semibold">Coming up</h3></div><button type="button" onClick={event => { setPlannerFilter('upcoming'); openFromToday('planner', event.currentTarget); }} className="min-h-11 rounded-xl px-2 text-xs font-semibold lifeos-accent-text">View plan</button></div>
              {dashboardUpcomingTasks.length === 0 ? <p className="today-inline-empty">No upcoming tasks. Add a date to a task to plan ahead.</p> : <ul className="space-y-2">{dashboardUpcomingTasks.map(task => <li key={task.id}><button type="button" onClick={event => { setPlannerSelectedDate(task.dueDate); setPlannerFilter('all'); openFromToday('planner', event.currentTarget); }} className="lifeos-raised flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left"><span className="min-w-0"><strong className="block truncate text-sm font-medium">{task.title}</strong><span className="block text-xs text-secondary">{formatDate(task.dueDate)}{task.dueTime ? ` · ${formatClockTime(task.dueTime)}` : ''}</span></span><span className="shrink-0 text-xs font-medium text-secondary">{task.priority}</span></button></li>)}</ul>}
            </section>

            {/* Pending Tasks */}
            <section className="today-agenda lifeos-panel rounded-2xl border p-4" data-today-card="agenda" tabIndex={-1} style={todaySectionStyle('agenda')} aria-labelledby="today-agenda-title">
              <div className="today-summary-header">
                <h3 id="today-agenda-title" className="today-summary-title">Your tasks</h3>
                <button type="button" onClick={event => openFromToday('plan', event.currentTarget)} className="today-summary-action">Open Plan</button>
              </div>
              {dashboardTasks.length === 0 ? (
                <p className="today-summary-copy">No tasks to show.</p>
              ) : (
                <div className="space-y-2">
                  {dashboardTasks.map(t => {
                    const status = getTaskStatus(t, clockNow);
                    return <div key={t.id} className={`today-task-row ui-interactive-row${status === 'Overdue' ? ' is-overdue' : ''}`}>
                        <label className="today-task-check plan-hub-task-check" aria-label={`Mark ${t.title} ${t.completed ? 'incomplete' : 'complete'}`}>
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
                          />
                          <svg className="alive-task-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9" pathLength="1" /></svg>
                        </label>
                        <button type="button" onClick={event => { todayOrigin.current = null; taskDetailReturnTabRef.current = 'dashboard'; taskDetailReturnFocusRef.current = event.currentTarget; setPlannerDetailTaskId(t.id); setPlannerSelectedDate(t.dueDate || todayKey); setPlannerFilter('all'); navigateTo('planner'); }} className="today-task-open" aria-label={`Open ${t.title} details`}>
                          <span className={`today-task-title${t.completed ? ' is-complete' : ''}`}>{t.title}</span>
                          <span className="today-task-meta">
                            {t.dueDate !== todayKey && <span>{formatDate(t.dueDate)}</span>}
                            <span>{t.dueTime ? formatClockTime(t.dueTime) : 'End of day'}</span>
                            {status === 'Overdue' && <strong className="today-task-overdue">Overdue</strong>}
                            {t.priority && <span className="today-task-priority" data-priority={t.priority}>{t.priority} priority</span>}
                          </span>
                        </button>
                    </div>
                  })}
                </div>
              )}
            </section>
          </div>
        )} />

        {/* VIEW 2: FINANCE */}
        <RetainedScreen active={activeTab === 'plan'} retainInactive prepare={primaryPrepared} id="screen-plan" {...transitionPropsFor('plan')} render={() => <Suspense fallback={<ScreenLoading label="Loading your plan…" />}><div className="feather-plan-page">{renderPlanNavigation('plan')}<PlanHub onCreate={() => openCreateForm('task')} onQuickCreate={title => openCreateForm('task', undefined, undefined, title)} tasks={tasks} today={todayKey} now={clockNow}
          onOpenTask={(task, trigger) => { taskDetailReturnTabRef.current = 'plan'; taskDetailReturnFocusRef.current = trigger; setPlannerDetailTaskId(task.id); setPlannerSelectedDate(task.dueDate || todayKey); setPlannerFilter(task.dueDate ? 'all' : 'unscheduled'); navigateTo('planner'); }}
          onToggleTask={async task => { await StorageService.tasks.toggleCompleted(task.id, !task.completed); if (!task.completed) await NotificationService.cancelTask(task); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); showToast('Task updated', 'success'); }}
          /></div></Suspense>} />

        <RetainedScreen active={activeTab === 'insights'} id="screen-insights" {...transitionPropsFor('insights')} render={() => <Suspense fallback={<ScreenLoading label="Loading your insights…" />}><div className="space-y-4">{renderPlanNavigation('insights')}<InsightsHub
          month={financeMonth}
          exactCashFlow={[financeAnalytics.totalIncomeMinor, financeAnalytics.totalExpensesMinor, financeAnalytics.netSavingsMinor]} currency={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale}
          income={financeAnalytics.totalIncome}
          expenses={financeAnalytics.totalExpenses}
          balance={financeAnalytics.netSavings}
          transactionCount={financeAnalytics.transactionCount}
          completedRoutines={todayOverview.routinesCompleted}
          routinesDue={todayOverview.routinesDue}
          weeklyCompleted={todayOverview.weeklyRoutinesCompleted}
          weeklyTotal={todayOverview.weeklyRoutinesTotal}
          goals={goals.filter(goal => goal.status === 'In Progress' && !goal.archived)} progressForGoal={goalProgress}
          hasHistory={transactions.length > 0 || habits.length > 0 || goals.length > 0}
          formatMoney={formatMoney}
          onFinance={() => { setFinanceSubtab('analytics'); navigateTo('finance'); }}
          onHabits={() => { setLifeDetail(null); setHabitsSubtab('weekly'); navigateTo('habits'); }}
          onGoals={() => { setLifeDetail(null); setGoalsSubtab('active'); navigateTo('goals'); }}
        /></div></Suspense>} />

        <RetainedScreen active={activeTab === 'finance'} retainInactive id="screen-finance" prepare={primaryPrepared} {...transitionPropsFor('finance')} render={() => (
          <div ref={moneyPageRef} className="money-page space-y-5" data-detail={financeSubtab}>
            {financeSubtab !== 'overview' && <MoneyDetailHeader section={financeSubtab} month={financeMonth} onMonthChange={setFinanceMonth} fromToday={todayBack && financeSubtab === 'monthly'}
                onBack={() => { if (todayBack || financeSubtab === 'projection') { navigateBack(); return; } rememberActiveScroll(); financeSubtabHistory.current = []; setFinanceSubtab('overview'); }} />}

            {/* Money home: recorded cash flow, never an inferred account balance. */}
            {(financeSubtab === 'overview' || financeSubtab === 'monthly') && (
              <MoneyHome
                showHeader={false}
                month={financeMonth}
                monthly={financeSubtab === 'monthly'}
                onMonthly={() => navigateFinanceSubtab('monthly')}
                monthSavings={financeSubtab === 'monthly' ? formatMinorUnits(savingsContributions.filter(row => row.date.startsWith(financeMonth) && row.currencyCode === userPrefs.currency).reduce((total, row) => total + (row.amountMinor ? BigInt(row.amountMinor) : decimalToMinorUnits(row.amount, userPrefs.currency)), 0n), userPrefs.currency, userPrefs.locale === 'system' ? undefined : userPrefs.locale) : undefined}
                exactCashFlow={[financeAnalytics.totalIncomeMinor, financeAnalytics.totalExpensesMinor, financeAnalytics.netSavingsMinor]}
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

            {financeSubtab === 'accounts' && <MoneyAccounts reduced={interfaceMotion.reducedMotion} accounts={financialAccounts} transactions={transactions} transfers={accountTransfers} currencyCode={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale}
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
              <div className="transaction-workspace">
                <TransactionSummary transactions={transactions} month={financeMonth} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale} />
                <div className="transaction-actions">
                  <button type="button" onClick={() => openCreateForm("transaction")} className="feather-primary transaction-add" data-testid="money-add-transaction">Add transaction</button>
                </div>
                <div className="transaction-import-actions" role="group" aria-label="Import transactions">
                  <button type="button" onClick={async () => {
                    try { await setSensitiveScreenshotState(true); setSmartImportOpen(true); }
                    catch { showToast("Could not open Smart Import securely.", "danger"); }
                  }}>Import alert</button>
                </div>
                <div className="transaction-toolbar">
                  <input
                    type="search"
                    aria-label="Search transactions" placeholder="Search transactions"
                    value={financeSearch}
                    onChange={(e) => setFinanceSearch(e.target.value)}
                    className="lifeos-input min-h-11 flex-1 rounded-xl px-3 py-2.5 text-xs"
                  />
                  <button type="button" ref={activityFilterTrigger} aria-haspopup="dialog" className="lifeos-raised min-h-11 rounded-xl px-4 text-sm font-semibold" onClick={() => activityFilterDialog.current?.showModal()}>Filters</button>
                </div>
                <dialog ref={activityFilterDialog} data-activity-filters aria-label="Transaction filters" className="plan-filter-sheet lifeos-page" onClose={() => activityFilterTrigger.current?.focus()} onClick={event => { if (event.target === event.currentTarget) activityFilterDialog.current?.close(); }}>
                <form onSubmit={event => { event.preventDefault(); activityFilterDialog.current?.close(); }}>
                <header className="flex items-center justify-between"><h3 className="type-section-title">Transaction filters</h3><button type="button" className="min-h-11 px-3" onClick={() => activityFilterDialog.current?.close()}>Close</button></header>
                <div className="plan-filter-fields">{(['from', 'through', 'min', 'max'] as const).map((key, index) => <label key={key}>{['From date', 'Through date', 'Minimum amount', 'Maximum amount'][index]}<input type={index < 2 ? 'date' : 'number'} min={key === 'through' ? activityRange.from || undefined : index >= 2 ? key === 'max' ? activityRange.min || '0' : '0' : undefined} max={key === 'from' ? activityRange.through || undefined : key === 'min' ? activityRange.max || undefined : undefined} step={index >= 2 ? 'any' : undefined} value={activityRange[key]} onChange={event => setActivityRange(current => ({ ...current, [key]: event.target.value }))} /></label>)}</div><div className="grid grid-cols-2 gap-2"><div className="text-[10px] text-secondary"><PreferenceChoice variant="field" label="Category" value={financeCategoryFilter} searchable
                options={[["all", "All categories"], ...(categories.map(category => [String(category.name), category.name] as const))]} onSelect={e => setFinanceCategoryFilter(e)} /></div><div className="text-[10px] text-secondary"><PreferenceChoice variant="field" label="Filter transactions by account" value={financeAccountFilter} searchable
                options={[["all", "All accounts"], ["unassigned", "Unassigned"], ...(financialAccounts.map(account => [String(account.id), String(account.name) + String(account.isActive ? "" : " · Archived")] as const))]} onSelect={e => setFinanceAccountFilter(e)} /></div><div className="text-[10px] text-secondary"><PreferenceChoice variant="field" label="Filter transactions by currency" value={financeCurrencyFilter} searchable
                options={[["all", "All currencies"], ...(CURRENCY_CODES.map(code => [String(code), formatCurrencyChoice(code, userPrefs.locale === "system" ? undefined : userPrefs.locale)] as const))]} onSelect={e => setFinanceCurrencyFilter(e)} /></div></div>

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
                <div className="flex items-center justify-between text-[10px] text-secondary"><PreferenceChoice variant="field" label="Sort" value={financeSort}
                options={[["date-desc", "Newest first"], ["date-asc", "Oldest first"], ["amount-desc", "Largest first"]]} onSelect={e => setFinanceSort(e)} /></div>

                <button type="submit" className="lifeos-accent-button min-h-11 rounded-xl px-4">Show transactions</button></form></dialog>
                <div className="money-detail-results" hidden={!hasTransactionFilters}><span role="status">{transactionResultCount} {transactionResultCount === 1 ? "result" : "results"}</span>{hasTransactionFilters && <button type="button" onClick={() => { setFinanceSearch(''); setFinanceCategoryFilter('all'); setFinanceAccountFilter('all'); setFinanceCurrencyFilter('all'); setFinanceTypeFilter('all'); setFinanceSort('date-desc'); setActivityRange({ from: '', through: '', min: '', max: '' }); }}>Clear filters</button>}</div>
                {/* Transactions List */}
                <div className="transaction-timeline">
                  {!transactionDateGroups.length ? (
                    <p className="money-empty-action">{transactions.length || accountTransfers.length ? 'No transactions match these filters.' : 'No transactions this month.'}</p>
                  ) : (
                    transactionDateGroups.map(date => <section className="transaction-day" key={date ?? "all"} aria-label={date ? formatDate(date) : "Sorted transactions"}>
                      {date && <h3 className="transaction-day-heading">{formatDate(date)}</h3>}
                      {filteredTransfers.filter(row => !date || row.date === date).map(row => {
                        const locale = userPrefs.locale === 'system' ? undefined : userPrefs.locale;
                        const from = financialAccounts.find(account => account.id === row.fromAccountId)?.name || 'Archived account';
                        const to = financialAccounts.find(account => account.id === row.toAccountId)?.name || 'Archived account';
                        return <article className="transaction-history-item" key={row.id}>
                          <button type="button" onClick={() => setTransferDetailId(row.id)} className="transaction-entry">
                            <span className="transaction-icon" aria-hidden="true"><Layers size={18} /></span>
                            <span className="transaction-copy"><strong>{row.reversalOfId ? 'Transfer reversal' : 'Transfer'}</strong><small>{from} to {to}</small></span>
                            <span className="transaction-value"><strong>{formatMinorUnits(BigInt(row.fromAmountMinor), row.fromCurrencyCode, locale)}</strong><small>{row.fromCurrencyCode === row.toCurrencyCode ? row.fromCurrencyCode : 'To ' + formatMinorUnits(BigInt(row.toAmountMinor), row.toCurrencyCode, locale)}</small></span>
                          </button>
                        </article>;
                      })}
                      {filteredTransactions.filter(row => !date || row.date === date).map(t => (
                        <article key={t.id} className="transaction-history-item">
                          <button type="button" onClick={() => setTransactionDetailId(t.id)} aria-label={'View ' + (t.type === 'income' ? 'income' : 'expense') + ' transaction ' + (t.description || t.category)} className="transaction-entry">
                            <span className={'transaction-icon is-' + t.type} aria-hidden="true">{t.type === 'income' ? <CirclePlus size={18} /> : <ReceiptText size={18} />}</span>
                            <span className="transaction-copy"><strong>{t.description || t.category}</strong><small>{[!date && formatDate(t.date), t.category !== t.description && t.category, t.accountId && (financialAccounts.find(account => account.id === t.accountId)?.name || 'Archived account'), t.occurredAt && formatTime(new Date(t.occurredAt))].filter(Boolean).join(' · ')}</small></span>
                            <span className={'transaction-value is-' + t.type}><strong>{t.type === 'income' ? '+' : '−'}{t.amountMinor !== undefined && t.currencyCode ? formatMinorUnits(BigInt(t.amountMinor), t.currencyCode, userPrefs.locale === 'system' ? undefined : userPrefs.locale) : t.currencyCode ? formatMoney(t.amount, t.currencyCode) : t.amount}</strong><small>{t.type === 'income' ? 'Income' : 'Expense'} &middot; {t.currencyCode || 'Currency unknown'}</small></span>
                          </button>
                        </article>
                      ))}
                    </section>)
                  )}
                </div>
              </div>
            )}

            {financeSubtab === 'budgets' && <div className="space-y-3">
              <div className="flex justify-end"><button onClick={() => openCreateForm('budget')} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-sm font-semibold">Add budget</button></div>
              {budgets.some(b => (!b.monthYear || b.monthYear === financeMonth) && !b.currencyCode) && <p role="status" className="rounded-xl border p-3 text-xs text-secondary">Historical budgets without a saved currency are preserved and excluded from totals.</p>}
              {budgets.some(b => (!b.monthYear || b.monthYear === financeMonth) && b.currencyCode && b.currencyCode !== userPrefs.currency) && <p role="status" className="rounded-xl border border-[var(--stroke)] p-3 text-xs text-secondary">Budgets in another currency are hidden until a dated exchange rate is available.</p>}
              {budgets.filter(b => (!b.monthYear || b.monthYear === financeMonth) && b.currencyCode === userPrefs.currency).length === 0 ? <div className="rounded-2xl border border-[var(--stroke)] lifeos-panel py-8 text-center text-sm text-secondary">No budget set for {financeMonth}.</div> : budgets.filter(b => (!b.monthYear || b.monthYear === financeMonth) && b.currencyCode === userPrefs.currency).map(b => {
                const budgetCategoryName = b.categoryId ? categories.find(category => category.id === b.categoryId)?.name : undefined;
                const budgetName = b.categoryId ? (budgetCategoryName || 'Unavailable category') : 'Overall budget';
                const categoryMissing = Boolean(b.categoryId && !budgetCategoryName);
                const budgetCurrency = b.currencyCode || userPrefs.currency;
                const totals = financeAnalytics.budgetRows.find(row => row.id === b.id);
                if (!totals) return null;
                const allocatedMinor = BigInt(totals.allocatedMinor);
                const spentMinor = BigInt(totals.spentMinor);
                const budgetStatus = getExactBudgetDisplayStatus(categoryMissing ? undefined : spentMinor, allocatedMinor);
                const budgetLabel = categoryMissing ? 'Usage unavailable' : budgetStatus.percentUsed === null ? 'No monthly limit set' : `${budgetStatus.percentUsed.toFixed(0)}% used`;
                const overByLabel = formatMinorUnits(budgetStatus.overByMinor, budgetCurrency, userPrefs.locale === 'system' ? undefined : userPrefs.locale);
                const remainingAmountLabel = formatMinorUnits(budgetStatus.remainingMinor, budgetCurrency, userPrefs.locale === 'system' ? undefined : userPrefs.locale);
                const overLabel = budgetStatus.percentUsed === null ? `${overByLabel} over plan · no monthly limit` : `${budgetStatus.percentUsed.toFixed(0)}% used · ${overByLabel} over plan`;
                const overAccessibleLabel = budgetStatus.percentUsed === null ? `${overByLabel} over plan with no monthly limit` : `${budgetStatus.percentUsed.toFixed(0)}% used, ${overByLabel} over plan`;
                const amountLabel = categoryMissing ? 'Unavailable' : formatMinorUnits(spentMinor, budgetCurrency, userPrefs.locale === 'system' ? undefined : userPrefs.locale);
                const allocationLabel = formatMinorUnits(allocatedMinor, budgetCurrency, userPrefs.locale === 'system' ? undefined : userPrefs.locale);
                const remainingLabel = categoryMissing ? 'Restore category to track this plan' : budgetStatus.isOver ? 'Above plan' : budgetStatus.percentUsed === null ? 'Set a limit to track remaining' : `${remainingAmountLabel} remaining in plan`;
                return <div key={b.id} className="rounded-2xl border border-[var(--stroke)] lifeos-panel p-4"><div className="flex justify-between text-sm"><strong>{budgetName}</strong><span>{amountLabel} / {allocationLabel}</span></div>
                  {totals.carryoverUnavailable && <p className="text-xs text-secondary">Carryover unavailable because last month has records without a saved currency.</p>}
                  {totals.carryoverMinor !== '0' && <p className="text-xs text-secondary">{formatMinorUnits(BigInt(totals.carryoverMinor), budgetCurrency)} carried from last month</p>}
                  <div className="lifeos-progress-track mt-3 h-2 overflow-hidden rounded-full" role="progressbar" aria-label={`${budgetName} usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(budgetStatus.barPercent)} aria-valuetext={budgetStatus.isOver ? overAccessibleLabel : budgetLabel}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${budgetStatus.barPercent}%`, backgroundColor: budgetStatus.isOver ? 'var(--warning)' : undefined }} /></div><div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-secondary"><span>{budgetStatus.isOver ? overLabel : budgetLabel}</span><span>{remainingLabel}</span></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openEditBudget(b)} className="min-h-11 rounded-lg px-3 text-xs font-semibold lifeos-accent-text">Edit budget</button><button aria-label={`Delete ${budgetName}`} onClick={async () => {
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
              <button type="button" onClick={() => navigateFinanceSubtab('projection')} className="money-month-link lifeos-panel">View savings projection</button>
              <div className="flex items-center justify-between"><div><div className="flex items-center gap-1"><h3 className="font-semibold">Savings goals</h3><InfoTip label="Savings contributions" /></div><p className="text-xs text-secondary">Build toward the things you care about</p></div><button onClick={() => openCreateForm('savings')} className="lifeos-accent-button min-h-11 rounded-xl px-3 py-2 text-xs font-semibold">Add goal</button></div>
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
                  catch { showToast('BusyDoo could not confirm the deletion. Refresh Savings before retrying.', 'danger'); return; }
                  setSavingsGoals(current => current.filter(item => item.id !== goal.id));
                  try { await reloadAllData(); showToast('Savings goal deleted', 'success'); }
                  catch { showToast('Goal deleted. Reopen Savings to refresh the latest data.', 'info'); }
                }} />)}</div>}
            </div>}

            {financeSubtab === 'planning' && <div className="feather-scheduled-layout"><MoneyPlanning draftState={planningDrafts} reduced={interfaceMotion.reducedMotion} transactions={transactions} onDraftStateChange={setPlanningDrafts} saving={financeWriteBusy} commitments={plannedCommitments} rates={manualExchangeRates} accounts={financialAccounts} categories={categories} confirmAction={confirmAction}
              onAddCommitment={async input => { await runPreparedFinanceWrite(() => StorageService.commitments.add(input)); }}
              onUpdateCommitment={async (id, input) => { await runPreparedFinanceWrite(() => StorageService.commitments.update(id, input)); }}
              onRecordOccurrence={async row => { await runPreparedFinanceWrite(() => StorageService.commitments.postOccurrence(row.id, row)); }}
              onDeleteCommitment={async id => { await StorageService.commitments.delete(id); await reloadAllData(); }}
              onAddRate={async input => { await runPreparedFinanceWrite(() => StorageService.exchangeRates.add(input)); }}
              onUpdateRate={async (id, input) => { await runPreparedFinanceWrite(() => StorageService.exchangeRates.update(id, input)); }}
              onDeleteRate={async id => { await StorageService.exchangeRates.delete(id); await reloadAllData(); }} />
              <div className="feather-scheduled-summary"><PlannedCashFlow commitments={plannedCommitments} month={financeMonth} currencyCode={userPrefs.currency} locale={userPrefs.locale === 'system' ? undefined : userPrefs.locale} /></div>

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
          <div className="feather-plan-page">{renderPlanNavigation('habits')}{lifeDetail?.kind === 'habit' && Capacitor.getPlatform() !== 'android' && <button type="button" className="feather-icon-button" aria-label="Close habit details" onClick={() => showLifeDetail(null)}><X size={20} aria-hidden="true" /></button>}
            {!lifeDetail && <><PlanSectionHeader id="plan-habits-title" title="Habits" topic="Habit consistency" action="Add habit" onAdd={() => openCreateForm('habit')} />
              {habits.length > 0 && <p className="feather-plan-summary">{todayOverview.routinesCompleted} of {todayOverview.routinesDue} done today</p>}</>}
            {lifeDetail?.kind === 'habit' && <label className="life-history block text-sm text-secondary">Completion date<input type="date" max={todayKey} value={habitsSelectedDate} onChange={e => { setHabitsSelectedDate(e.target.value); setHistoricalQuantityUnit(''); }} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-2.5 text-sm" /></label>}

            {lifeDetail?.kind === 'habit' && habits.find(item => item.id === lifeDetail.id) && (() => {
              const habit = habits.find(item => item.id === lifeDetail.id)!;
              const stats = getHabitStreaks(habit.id, habitsSelectedDate);
              const weekly = calculateWeeklyHabitRate(habitLogs, habit.id, clockNow, habit.frequency, habit);
              const quantityLog = habitLogs.find(log => log.habitId === habit.id && log.date === habitsSelectedDate && log.quantity !== undefined);
              const quantity = quantityLog?.quantity ?? 0;
              return <section className="lifeos-panel feather-plan-detail rounded-2xl border" aria-labelledby="habit-detail-title">
                <div><h3 id="habit-detail-title" className="type-page-title safe-wrap">{habit.name}</h3>{habit.description && <p className="mt-1 text-sm text-secondary">{habit.description}</p>}</div>
                <div className="grid grid-cols-2 gap-3"><div className="lifeos-tint rounded-xl p-3"><p className="text-xs text-secondary">Current streak</p><p className="mt-1 text-xl font-semibold">{stats.currentStreak} days</p></div><div className="lifeos-tint rounded-xl p-3"><p className="text-xs text-secondary">This week</p><p className="mt-1 text-xl font-semibold">{weekly.completed}/{weekly.scheduled} · {weekly.rate}%</p></div></div>
                {habit.trackingMode === 'quantity' ? <div className="lifeos-raised rounded-xl p-3"><p className="text-xs text-secondary">{formatDate(habitsSelectedDate)} progress</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatHabitProgress(quantityLog?.quantity, quantityLog?.quantityUnit, habit.targetPerDay || 0, habit.quantityUnit)}</p>{quantityLog && !quantityLog.quantityUnit && <div className="mt-3 rounded-xl border border-[var(--stroke)] p-3"><p className="text-xs text-secondary">This older entry has no saved unit. Choose the unit it used before displaying it with a unit.</p><div className="feather-habit-row mt-2"><select aria-label="Historical quantity unit" value={historicalQuantityUnit} onChange={event => setHistoricalQuantityUnit(event.target.value)} className="lifeos-input min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm"><option value="">Choose unit…</option>{[...new Set([habit.quantityUnit, 'glass', 'litre', 'minute', 'page', 'item'].filter(Boolean) as string[])].map(unit => <option key={unit} value={unit}>{unit}</option>)}</select><button type="button" disabled={!historicalQuantityUnit} onClick={async () => { try { await StorageService.habits.setQuantityLogUnit(quantityLog.id, historicalQuantityUnit); setHistoricalQuantityUnit(''); await reloadAllData(); showToast('Historical unit saved', 'success'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not update this entry.', 'danger'); } }} className="lifeos-raised min-h-11 rounded-xl px-3 text-xs font-semibold disabled:opacity-50">Save unit</button></div></div>}<div className="mt-2 flex gap-2"><button type="button" disabled={quantity <= 0} aria-label={`Decrease ${habit.name} quantity`} onClick={() => void handleHabitQuantity(habit, habitsSelectedDate, -1)} className="min-h-11 min-w-14 rounded-xl border border-[var(--stroke)] px-3 text-lg disabled:opacity-50">−</button><button type="button" aria-label={`Add one ${habit.quantityUnit} to ${habit.name}`} onClick={() => void handleHabitQuantity(habit, habitsSelectedDate, 1)} className="lifeos-accent-button min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold">Add 1 {habit.quantityUnit}</button></div></div> : <button type="button" aria-pressed={stats.completedToday} aria-label={`Mark ${habit.name} ${stats.completedToday ? 'incomplete' : 'complete'}`} onClick={() => void handleHabitCompletion(habit.id, habit.name, habitsSelectedDate, stats.completedToday)} className="lifeos-accent-button min-h-12 w-full rounded-xl px-4 text-sm font-semibold">{stats.completedToday ? `Completed on ${formatDate(habitsSelectedDate)} · Undo` : `Mark complete for ${formatDate(habitsSelectedDate)}`}</button>}
                {!isHabitEligible(habit, habitsSelectedDate) && <p role="status" className="text-sm text-secondary">No session scheduled for this date.</p>}
                {habit.schedule?.filter(revision => revision.from > todayKey).map(revision =>
                  <p key={revision.from} className="text-sm text-secondary">Schedule changes on {formatDate(revision.from)}</p>)}
                {habit.reminderTime && habit.schedule?.some(revision => revision.from > todayKey) &&
                  <p className="text-xs text-secondary">BusyDoo refreshes the next 35 days of reminders when you reopen the app.</p>}
                <button type="button" className="lifeos-raised min-h-11 rounded-xl px-3 text-sm" onClick={async () => {
                  const pauses = habit.pauses || [];
                  const active = pauses.find(pause => !pause.through && pause.from <= todayKey);
                  const yesterday = new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() - 1);
                  const next = active ? pauses.flatMap(pause => pause !== active ? [pause] : pause.from < todayKey ? [{ ...pause, through: formatLocalDate(yesterday) }] : []) : [...pauses, { from: todayKey }];
                  try {
                    await StorageService.habits.update(habit.id, { pauses: next });
                    const records = await reloadAllData();
                    await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
                  } catch { showToast('Could not confirm the habit schedule change.', 'danger'); }
                }}>{habit.pauses?.some(pause => !pause.through && pause.from <= todayKey) ? 'Resume habit' : 'Pause habit'}</button>
                <HabitHistory habit={habit} logs={habitLogs} date={habitsSelectedDate} today={todayKey} onSelect={date => { setHabitsSelectedDate(date); setHistoricalQuantityUnit(''); }} formatDate={formatDate} />
                <p className="text-xs text-secondary">Best streak: {stats.longestStreak} days{habit.reminderTime ? ` · Reminder ${habit.reminderTime} local` : ' · No reminder set'}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openEditHabit(habit)} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm font-semibold">Edit habit</button><button type="button" onClick={() => void confirmAction({ title: 'Delete this habit?', message: `“${habit.name}” and its completion history will be removed.`, confirmLabel: 'Delete habit', destructive: true }).then(confirmed => { if (confirmed) void handleHabitDeletion(habit); })} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm text-[var(--danger)]">Delete habit</button></div>
              </section>;
            })()}

            <div className="space-y-2">
              {habits.length === 0 ? (
                <PlanSectionEmpty illustration="first-habit" title="No habits yet"><p>Add a routine you want to build.</p></PlanSectionEmpty>
              ) : (
                habits.filter(h => lifeDetail?.kind !== 'habit').map(h => {
                  const todayStr = todayKey;
                  const logged = h.trackingMode === 'quantity' ? habitLogs.find(log => log.habitId === h.id && log.date === todayStr && log.quantity !== undefined) : undefined;
                  const stats = getHabitStreaks(h.id, todayStr);
                  const weekly = calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency, h);
                  const historyDays = Array.from({ length: 7 }, (_, index) => new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate() - 6 + index));
                  return (
                      <div key={h.id} className="lifeos-panel feather-plan-card">
                      <div className="feather-habit-row">
                        <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => { setHistoricalQuantityUnit(''); setHabitsSelectedDate(todayKey); showLifeDetail({ kind: 'habit', id: h.id }); }}>
                          <span className="feather-plan-record-title safe-wrap">{h.name}</span>
                          <span className="feather-plan-record-meta">{h.trackingMode === 'quantity' ?
                            formatHabitProgress(logged?.quantity, logged?.quantityUnit, h.targetPerDay || 0, h.quantityUnit)
                            : stats.completedToday ? 'Checked in today' : 'Ready to check in'}</span>
                          {stats.currentStreak > 0 && <span className="flex items-center gap-1 text-xs text-secondary">{stats.currentStreak} day streak{stats.currentStreak >= 7 && <LifeDoodle key={Math.floor(stats.currentStreak / 7)} kind="habit-streak" compact />}</span>}
                        </button>
                        {h.trackingMode === 'quantity' ? <button type="button" className="lifeos-raised min-h-11 rounded-xl px-3 text-sm font-semibold" aria-label={`Add one ${h.quantityUnit} to ${h.name}`} onClick={() => void handleHabitQuantity(h, todayStr, 1)}>Record {formatHabitQuantity(1, h.quantityUnit)}</button>
                          : <button type="button" className="lifeos-raised min-h-11 rounded-xl px-3 text-sm font-semibold" aria-pressed={stats.completedToday} aria-label={`Mark ${h.name} ${stats.completedToday ? 'incomplete' : 'complete'}`} onClick={() => void handleHabitCompletion(h.id, h.name, todayStr, stats.completedToday)}>{stats.completedToday ? 'Done' : 'Check in'}</button>}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-secondary"><span>Weekly completion</span><span className="tabular-nums">{weekly.completed}/{weekly.scheduled} days · {weekly.rate}%</span></div><div role="img" aria-label={`${weekly.completed} of ${weekly.scheduled} scheduled habit days complete this week`} className="mt-1 flex gap-1">{historyDays.map(day => { const dayKey = formatLocalDate(day); const done = habitLogs.some(log => log.habitId === h.id && log.date === dayKey && log.completed); return <span key={dayKey} title={`${dayKey}: ${done ? 'complete' : 'missed'}`} aria-hidden="true" data-checked={done} className="alive-habit-day h-2 flex-1 rounded-full" style={{ backgroundColor: done ? 'var(--success)' : 'var(--surface-raised)' }} />; })}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )} />

        {/* VIEW 4: GOALS */}
        <RetainedScreen active={activeTab === 'goals'} id="screen-goals" {...transitionPropsFor('goals')} render={() => (
          <div className="feather-plan-page">{renderPlanNavigation('goals')}{lifeDetail?.kind === 'goal' && Capacitor.getPlatform() !== 'android' && <button type="button" className="feather-icon-button" aria-label="Close goal details" onClick={() => setLifeDetail(null)}><X size={20} aria-hidden="true" /></button>}
            <PlanSectionHeader id="plan-goals-title" title="Goals" topic="Goal progress" action="Add goal" onAdd={() => openCreateForm('goal')} />
            {!lifeDetail && goals.length > 0 && <button type="button" className="min-h-11 text-sm font-semibold lifeos-accent-text" onClick={() => navigateTo('insights')}>Progress insights</button>}
            <div className="feather-plan-segments" role="group" aria-label="Goal status">{(['active', 'paused', 'completed', 'archived'] as const).map(tab => <button key={tab} type="button" aria-pressed={goalsSubtab === tab} onClick={() => setGoalsSubtab(tab)} className="capitalize">{tab}</button>)}</div>
            <select aria-label="Goal category" value={goalsCategoryFilter} onChange={e => setGoalsCategoryFilter(e.target.value)} className="lifeos-input feather-plan-filter"><option value="all">All categories</option>{['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => <option key={category}>{category}</option>)}</select>
            {lifeDetail?.kind === 'goal' && goals.find(item => item.id === lifeDetail.id) && (() => { const goal = goals.find(item => item.id === lifeDetail.id)!; const pct = goalProgress(goal); const rows = milestones.filter(item => item.goalId === goal.id); return <section className="lifeos-panel feather-plan-detail rounded-2xl border" aria-labelledby="goal-detail-title"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm text-secondary">{goal.category} &middot; {goal.status}</p><h3 id="goal-detail-title" className="type-page-title safe-wrap">{goal.title}</h3>{goal.description && <p className="mt-1 text-sm text-secondary">{goal.description}</p>}</div><span className="rounded-full lifeos-tint px-3 py-1 text-sm font-semibold lifeos-accent-text">{pct}%</span></div><div className="lifeos-progress-track h-3 overflow-hidden rounded-full" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: `${pct}%` }} /></div><p className="text-sm font-medium">{goalProgressLabel(goal)}</p><div className="grid grid-cols-2 gap-3 text-xs"><div className="lifeos-tint rounded-xl p-3"><span className="text-secondary">Target date</span><p className="mt-1 font-semibold">{goal.targetDate ? formatDate(goal.targetDate) : 'Open-ended'}</p><p className="text-secondary">{getDaysRemainingText(goal.targetDate)}</p></div><div className="lifeos-tint rounded-xl p-3"><span className="text-secondary">Milestones</span><p className="mt-1 font-semibold">{rows.filter(row => row.completed).length} of {rows.length} complete</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openEditGoal(goal)} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm font-semibold">Edit goal</button>{goal.mode !== 'milestone' && <button type="button" onClick={() => openGoalProgressForm(goal)} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-sm font-semibold">Update progress</button>}<button type="button" onClick={() => openCreateForm('milestone', goal.id)} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm font-semibold">Add milestone</button>              {goal.status !== 'Completed' && <button type="button" onClick={() => void changeGoalStatus(goal, goal.status === 'Paused' ? 'In Progress' : 'Paused')} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm">{goal.status === 'Paused' ? 'Resume goal' : 'Pause goal'}</button>}
              {goal.status !== 'Completed' && <button type="button" onClick={() => void changeGoalStatus(goal, 'Completed')} className="lifeos-raised min-h-11 rounded-xl px-4 text-sm">Complete goal</button>}
              <button type="button" className="lifeos-raised min-h-11 rounded-xl px-4 text-sm" onClick={async () => {
                try {
                  await StorageService.goals.update(goal.id, { archived: !goal.archived });
                  const records = await reloadAllData();
                  await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones);
                } catch {
                  showToast('Could not confirm the archive change. Refresh Goals before retrying.', 'danger');
                }
              }}>{goal.archived ? 'Restore goal' : 'Archive goal'}</button>
              <button type="button" className="lifeos-danger min-h-11 rounded-xl px-4 text-sm" onClick={() => void deleteGoalFromDetails(goal)}>Delete goal</button></div><div><h4 className="text-sm font-semibold">Milestones</h4>{rows.length === 0 ? <p className="mt-2 text-xs text-secondary">No milestones yet.</p> : <ul className="mt-2 divide-y divide-[var(--stroke)]">{rows.map(row => <li key={row.id}><label className="flex min-h-12 cursor-pointer items-center gap-3 py-2"><input type="checkbox" checked={row.completed} onChange={async () => { await StorageService.goals.toggleMilestone(row.id, !row.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} className="h-5 w-5" style={{ accentColor: 'var(--accent)' }} /><span className="min-w-0 flex-1"><span className={`block text-sm ${row.completed ? 'line-through text-secondary' : ''}`}>{row.title}</span>{row.targetDate && <span className="text-xs text-secondary">{formatDate(row.targetDate)} · {getDaysRemainingText(row.targetDate)}</span>}</span></label></li>)}</ul>}</div>{(tasks.some(task => task.goalId === goal.id) || habits.some(habit => habit.goalId === goal.id)) && <section aria-label="Linked activity" className="space-y-2">
              <h4 className="type-section-title">Linked activity</h4><p className="text-sm text-secondary">Record goal progress separately.</p><ul className="text-sm text-secondary">
                {tasks.filter(task => task.goalId === goal.id).map(task => <li key={'task:' + task.id}>{task.title}</li>)}
                {habits.filter(habit => habit.goalId === goal.id).map(habit => <li key={'habit:' + habit.id}>{habit.name}</li>)}
              </ul></section>}<details className="border-t border-[var(--stroke)]"><summary className="min-h-11 content-center cursor-pointer text-sm font-semibold">History</summary><ul className="space-y-2 text-sm text-secondary"><li>Created {formatDate(goal.createdAt.slice(0, 10))}</li>{[...(goal.progressHistory || [])].reverse().map((entry, index) => <li key={entry.at + ':' + index}>{formatDate(entry.at.slice(0, 10))} &middot; {displayGoalMeasure(entry.value, entry.unit)}</li>)}{goal.updatedAt && <li>Updated {formatDate(goal.updatedAt.slice(0, 10))}</li>}{rows.filter(row => row.completed && row.completedAt).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).map(row =><li key={row.id}>{formatDate((row.completedAt || '').slice(0, 10))} &middot; {row.title}</li>)}</ul></details></section>; })()}
            {lifeDetail?.kind !== 'goal' && (() => {
              const visibleGoals = goals.filter(goal => (
                goalsSubtab === 'archived' ? goal.archived : !goal.archived &&
                  goal.status === (goalsSubtab === 'active' ? 'In Progress' : goalsSubtab === 'paused' ? 'Paused' : 'Completed')
              ) && (goalsCategoryFilter === 'all' || goal.category === goalsCategoryFilter));
              if (!visibleGoals.length) return <PlanSectionEmpty illustration="first-goal" title={goalsCategoryFilter !== 'all' ? 'No goals in this category' : goalsSubtab === 'completed' ? 'No completed goals yet' : goalsSubtab === 'paused' ? 'No paused goals' : goalsSubtab === 'archived' ? 'No archived goals' : 'No active goals yet'} />;
              return <div className="goal-list">{visibleGoals.map(g => {
                const pct = goalProgress(g);
                return <article key={g.id} className="lifeos-panel goal-journey-card" data-complete={g.status === 'Completed'}>
                  <button type="button" onClick={() => showLifeDetail({ kind: 'goal', id: g.id })} className="goal-card-open">
                    <span className="min-w-0 safe-wrap"><strong className="feather-plan-record-title">{g.title}</strong><small className="feather-plan-record-meta">{g.category}{g.targetDate && <> &middot; {formatDate(g.targetDate)}</>}</small></span>
                    <span className="goal-percent tabular-nums">{pct}%</span>
                  </button>
                  <div className="lifeos-progress-track h-2 overflow-hidden rounded-full" role="progressbar" aria-label={g.title + ' progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="lifeos-progress-fill h-full rounded-full" style={{ width: pct + '%' }} /></div>
                  <p className="text-sm text-secondary safe-wrap">{goalProgressLabel(g)} {g.status === 'Completed' && <strong className="goal-completed-label">Completed</strong>}</p>
                </article>;
              })}</div>;
            })()}
          </div>
        )} />

        {/* VIEW 5: PLANNER */}
        <RetainedScreen active={activeTab === 'planner'} id="screen-planner" {...transitionPropsFor('planner')} render={() => (
          <>
            <AnimatePresence>{plannerDetailTask && <TaskDetailScreen key={plannerDetailTask.id} reducedMotion={interfaceMotion.reducedMotion} task={plannerDetailTask} status={getTaskStatus(plannerDetailTask, clockNow)} dueLabel={plannerDetailTask.dueDate ? `${formatDate(plannerDetailTask.dueDate)}${plannerDetailTask.dueTime ? ` · ${formatClockTime(plannerDetailTask.dueTime)}` : ' · end of day'}` : 'No due date'} reminderLabel={[!plannerDetailTask.dueAlertDisabled && plannerDetailTask.dueDate && (plannerDetailTask.dueTime || dateOnlyAlertTime) ? 'At due time' : '', plannerDetailTask.reminderLeadMinutes ? plannerDetailTask.reminderLeadMinutes + ' min before' : plannerDetailTask.reminderAt ? formatDateTime(new Date(plannerDetailTask.reminderAt)) : ''].filter(Boolean).join(' / ') || 'No alert'} onBack={closeTaskDetail} onEdit={() => openEditTask(plannerDetailTask)} onDelete={async () => {
              if (!await confirmAction({ title: 'Delete this task?', message: 'This will remove the task and its alerts.', confirmLabel: 'Delete task', destructive: true })) return;
              try {
                await StorageService.tasks.delete(plannerDetailTask.id);
                closeTaskDetail();
                const records = await reloadAllData();
                await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones, effectiveNotificationPreferences(notificationPreferences, notificationsEnabled));
                showToast('Task removed', 'info');
              } catch { showToast('Could not finish removing the task. Refresh your plan before retrying.', 'danger'); }
            }} onToggle={async () => { await StorageService.tasks.toggleCompleted(plannerDetailTask.id, !plannerDetailTask.completed); const records = await reloadAllData(); await syncNotificationSchedules(records.tasks, records.habits, records.goals, records.milestones); }} onSubtasks={async subtasks => { await StorageService.tasks.update(plannerDetailTask.id, { subtasks }); await reloadAllData(); }} reminderContent={developerToolsEnabled && <details className="task-reminder-details"><summary>Reminder help</summary><p className="text-xs text-secondary">Android may delay reminders when the device is idle. BusyDoo will not change your task when you check its status.</p>{plannerDetailTask.reminderAt ? <button type="button" onClick={() => void diagnosePlannerTaskReminder(plannerDetailTask)} className="mt-2 min-h-11 rounded-lg px-2 text-xs font-semibold lifeos-accent-text">Check reminder status</button> : <p className="mt-2 text-xs text-secondary">No scheduled reminder is set. Automatic overdue alerts are separate and can be changed in Notifications in Profile.</p>}{taskReminderDiagnostics?.taskReference === plannerDetailTask.id && <ReminderStatusSummary report={taskReminderDiagnostics} reminderAt={plannerDetailTask.reminderAt} />}</details>} />}</AnimatePresence>
          <div className="space-y-4">

            <div className="flex items-end justify-between gap-3"><div><p className="type-eyebrow">PLANNER</p><h2 ref={plannerHeadingRef} tabIndex={-1} className="type-page-title">Tasks by date</h2></div><button onClick={() => openCreateForm('task', undefined, plannerFilter === 'unscheduled' ? undefined : plannerSelectedDate)} className="lifeos-accent-button min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98]">Add task</button></div>
            <div className="planner-range-nav" role="group" aria-label="Choose task range" data-no-tab-swipe>
              {(['today', 'tomorrow', 'upcoming', 'unscheduled'] as const).map((range, index) => <button key={range} type="button" aria-pressed={plannerFilter === range || (plannerFilter === 'all' && range === 'today' && plannerSelectedDate === todayKey)} onClick={() => setPlannerFilter(range)}>{index === 2 ? 'Next 7 days' : range[0].toUpperCase() + range.slice(1)}</button>)}
            </div>
            <details className="planner-calendar-disclosure" data-no-tab-swipe>
              <summary><span>Calendar</span><span>{plannerDisplayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></summary>
            <section className="lifeos-panel rounded-2xl border p-3.5 shadow-sm" aria-label="Monthly task calendar" data-no-tab-swipe>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="refinement-period"><button aria-label="Previous month" onClick={() => setPlannerDisplayedMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="min-h-11 min-w-11 rounded-lg text-secondary transition hover:bg-[var(--surface-raised)] active:scale-95">Previous</button><h3 className="min-w-0 text-center text-sm font-semibold">{plannerDisplayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button aria-label="Next month" onClick={() => setPlannerDisplayedMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="min-h-11 min-w-11 rounded-lg text-secondary transition hover:bg-[var(--surface-raised)] active:scale-95">Next</button></div>
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
                  <div className="grid grid-cols-2 gap-2"><PreferenceChoice variant="field" label="Task date or status filter" value={plannerFilter}
                options={[...(['all', 'today', 'tomorrow', 'upcoming', 'unscheduled', 'pending', 'overdue', 'completed'].map(filter => [String(filter), filter === 'all' ? 'Selected day · all' : filter[0].toUpperCase() + filter.slice(1)] as const))]} onSelect={e => setPlannerFilter(e as typeof plannerFilter)} /><PreferenceChoice variant="field" label="Task priority filter" value={plannerPriority}
                options={[["all", "All priorities"], ...(['Low', 'Medium', 'High', 'Urgent'].map(priority => [String(priority), priority] as const))]} onSelect={e => setPlannerPriority(e)} /></div>
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

        {/* VIEW 6: SETTINGS */}
        <RetainedScreen active={profileOpen} retainInactive prepare={primaryPrepared} id="screen-settings" {...transitionPropsFor("settings")} render={() => (
          <div className="profile-track-page" role="region" aria-label="Profile and settings" data-android-profile={Capacitor.getPlatform() === "android" || undefined}>
            <div className="profile-track-preview" aria-hidden="true"><p>Appearance</p><p>Preferences</p><p>Notifications</p><p>Money &amp; Imports</p><p>Privacy &amp; security</p></div>
          <div ref={profilePage} className="profile-page" data-profile-section={profileSection}>
            {profileSection === 'home' && <ProfileHome sharedHeader onBack={backFromProfile} name={displayName} initial={profileInitial(displayName)} developerAllowed={developerToolsEnabled} securityStatus={recoveryProvisioned ? 'Recovery ready' : biometricEnabled ? 'App lock enabled' : 'Review protection'} onNameChange={updateDisplayName} photo={profilePhoto} photoBusy={profilePhotoBusy} photoError={profilePhotoError} onPhotoChange={changeProfilePhoto} onEditPhoto={() => { if (profilePhoto) setPendingProfilePhoto(profilePhoto); }} onOpen={section => { navigateProfileSection(section); if (section === 'notifications' || section === 'developer') void refreshNotificationDiagnostics(); }} />}

            {profileSection === 'privacy' && <ProfileSubpage embedded title="Privacy & security" description="Manage device protection and recovery." onBack={() => navigateProfileSection('home')}>
              <div className="flex items-center gap-2">Device protection <InfoTip label="Device protection" /></div>
              <div className="preference-group"><ProfileSettingRow title="App lock" value={biometricEnabled ? 'On' : 'Off'} onClick={() => navigateProfileSection('app-lock')} />
                <ProfileSettingRow title="Recovery" value={recoveryProvisioned ? 'Ready' : 'Not set up'} onClick={() => navigateProfileSection('recovery')} />
                {legalDraftEnabled && developerToolsEnabled && <ProfileSettingRow title="Legal & Privacy" value="Draft" onClick={() => navigateProfileSection('legal')} />}</div>
            </ProfileSubpage>}
            {LegalPrivacyCentre && developerToolsEnabled && profileSection === 'legal' &&
              <ProfileSubpage embedded title="Legal & Privacy" description="Internal draft documents for review. Legal acceptance is disabled." backLabel="Privacy & security" onBack={() => navigateProfileSection('privacy')}>
                <Suspense fallback={<ScreenLoading label="Opening legal documents" />}>
                  <LegalPrivacyCentre onData={() => navigateProfileSection('data')} onNotices={() => navigateProfileSection('licenses')} />
                </Suspense>
              </ProfileSubpage>}
            {profileSection === 'app-lock' && <ProfileSubpage embedded title="App lock" description="Use the device credential or biometrics to verify access on this device." backLabel="Privacy & security" onBack={() => navigateProfileSection('privacy')}>
              <div className="preference-group py-3"><div className="flex items-center gap-2 text-sm font-semibold">Device protection <InfoTip label="Device protection">Android verifies your device credential or biometrics. BusyDoo does not store your fingerprint.</InfoTip></div>
              <div className="lifeos-raised flex items-center justify-between gap-2 rounded-xl p-3"><div><p className="text-xs font-medium">Biometric lock</p><p className="mt-1 text-xs text-secondary">{deviceCredentialOnly ? 'Device screen lock available' : biometricAvailability}</p></div><button role="switch" aria-checked={biometricEnabled} onClick={async () => { if (biometricEnabled) { try {
                await StorageService.settings.set('biometricLockEnabled', false);
                setBiometricEnabled(false); setBiometricVerified(false); showToast('Biometric lock disabled', 'success');
              } catch { showToast('Could not change app lock. Your previous choice is still saved.', 'danger'); } return; } const result = await handleEnableBiometric(); if (result.success) showToast('Biometric lock enabled', 'success'); else showToast(result.message || 'Could not enable biometric lock', 'danger'); }} className={`min-h-11 min-w-16 rounded-full px-3 text-xs font-bold ${biometricEnabled ? 'lifeos-accent-button' : 'lifeos-panel border text-secondary'}`}>{biometricEnabled ? 'On' : 'Off'}</button></div>
              {biometricEnabled && <p className="flex items-center gap-1 text-[11px]" style={{ color: biometricVerified ? 'var(--success)' : 'var(--warning)' }}>{biometricVerified ? <ShieldCheck size={14} /> : <Shield size={14} />}{biometricVerified ? 'Biometric verified for this session' : 'Protected; authenticate to unlock'}</p>}

              </div>
            </ProfileSubpage>}
            {profileSection === 'recovery' && <ProfileSubpage embedded title="Recovery" backLabel="Privacy & security" onBack={() => navigateProfileSection('privacy')}>
              <p className="text-sm text-secondary">Keep your recovery file and backup passphrase safe. Without the information needed to unlock your records, BusyDoo may be unable to restore them.</p>
              <div className="preference-group py-3">
              {onboardingJourney.recoveryName && <p className="text-xs text-secondary">Recovery name: <strong>{onboardingJourney.recoveryName}</strong>. This label cannot restore data without your separate recovery kit.</p>}
              {recoveryProvisioned ? <p className="text-xs text-secondary">Encrypted recovery kit confirmed.</p> : recoveryDeferred ? <div className="lifeos-raised rounded-xl p-3"><p className="text-xs font-medium">Recovery kit not set up</p><p className="mt-1 text-xs text-secondary">Your records remain encrypted on this device. Set up a recovery kit to restore access if this device key is lost.</p><button type="button" onClick={() => void setupRecoveryFromSettings()} className="lifeos-accent-button mt-3 min-h-11 rounded-xl px-4 text-xs font-semibold">Set up recovery kit</button></div> : null}

                {!recoveryProvisioned && !recoveryDeferred && <p className="py-2 text-sm">Set up device protection before preparing a recovery file.</p>}
              </div>
            </ProfileSubpage>}

            {profileSection === 'appearance' && <ProfileSubpage embedded title="Appearance" description="Preview and personalize BusyDoo without changing your records." onBack={() => navigateProfileSection('home')}>
              <AppearanceStudio theme={visualThemeId} mode={appearance} accent={customAccent}
                motion={interfaceMotion.preset} onOpen={navigateProfileSection} />
            </ProfileSubpage>}
            {profileSection === 'themes' && <ProfileSubpage embedded title="Themes" description="Try a palette before applying it. Display mode follows your selection." backLabel="Appearance" onBack={() => navigateProfileSection('appearance')}>
              <ThemeStudio current={visualThemeId} preview={themePreviewId} appearance={appearance} resolved={theme}
                saving={savingVisualTheme} onAppearance={value => void applyAppearance(value)} onPreview={previewVisualTheme}
                onApply={() => void applyVisualTheme()} onCancel={cancelVisualThemePreview} />
            </ProfileSubpage>}
            {profileSection === 'motion' && <ProfileSubpage embedded title="Motion" description="Preview the movement style. Your device reduced-motion preference takes priority." backLabel="Appearance" onBack={() => navigateProfileSection('appearance')}>
              <MotionPreferences value={interfaceMotion.preset} onChange={interfaceMotion.setPreset} saving={interfaceMotion.saving} error={interfaceMotion.error} reducedMotion={interfaceMotion.reducedMotion} />
            </ProfileSubpage>}
            {profileSection === 'accent' && <ProfileSubpage embedded title="Accent color" description="Preview an accent with readable text and controls." backLabel="Appearance" onBack={() => navigateProfileSection('appearance')}>
              <CustomAccentPicker value={customAccent} onChange={color => { void applyCustomAccent(color); }} themeId={themePreviewId || visualThemeId} mode={theme} />
            </ProfileSubpage>}

            {profileSection === 'preferences' && <ProfileSubpage embedded title="Preferences" description="Choose how BusyDoo displays dates, amounts and measurements." onBack={() => navigateProfileSection('home')}>
              <ProfilePreferences preferences={userPrefs} saving={savingProfilePreferences}
                hasFinancialRecords={!!(transactions.length || budgets.length || savingsGoals.length || savingsContributions.length ||
                  financialAccounts.length || accountTransfers.length || plannedCommitments.length)}
                onChange={(key, value) => { void saveUserPreference(key, value); }} />
            </ProfileSubpage>}

            {profileSection === 'notifications' && <ProfileSubpage embedded title="Notifications" onBack={() => navigateProfileSection('home')}>
              <section className="preference-group">
                <button type="button" className="preference-row" role="switch" aria-label="All notifications" aria-checked={notificationsEnabled} onClick={() => void setNotificationsMaster(!notificationsEnabled)}><span>All notifications</span><span className="preference-toggle" aria-hidden="true" /></button>
                {(notificationDiagnostics.permission === 'denied' || notificationDiagnostics.appNotifications === 'disabled' || notificationDiagnostics.channel.startsWith('blocked')) ?
                  <ProfileSettingRow title="Notifications blocked by Android" value="Resolve" onClick={() => void openNotificationSettings()} />
                  : notificationsEnabled && notificationDiagnostics.permission === 'granted' && (notificationDiagnostics.exactAlarm !== 'granted' ?
                    <ProfileSettingRow title="Precise reminders are off" value="Enable" onClick={() => void requestExactAlarmAccess()} />
                    : <p className="preference-row">Precise reminders <span className="text-secondary">Enabled</span></p>)}
              </section>
              <section className="preference-group" aria-label="Reminder timing">
                <div className="preference-row"><label htmlFor="date-only-alert-time">Date-only task alerts</label>
                  <input className="lifeos-input min-h-11 rounded-lg px-2" id="date-only-alert-time" type="time" value={dateOnlyAlertTime || ''} onChange={event => void saveDateOnlyAlertTime(event.target.value)} /></div>
                {!dateOnlyAlertTime ? <p className="profile-detail">Off. Tasks with their own time still follow their reminder settings.</p> :
                  <button type="button" className="feather-secondary" onClick={() => void saveDateOnlyAlertTime('')}>Turn off date-only alerts</button>}
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

            {developerToolsEnabled && profileSection === 'developer' && <ProfileSubpage embedded title="Developer tools" description="Build diagnostics and isolated demonstration tools." onBack={() => navigateProfileSection('home')}>
              <section className="lifeos-panel rounded-xl border p-4 space-y-3"><h2 className="text-sm font-semibold">Notification diagnostics</h2>
                <div className="space-y-1 rounded-xl border border-[var(--stroke)] p-3 text-xs text-secondary"><p>Capability: {notificationDiagnostics.capability} · {notificationDiagnostics.platform}</p><p>Build: {notificationDiagnostics.versionName || notificationDiagnostics.build.appVersion} ({notificationDiagnostics.build.commit}) · API {notificationDiagnostics.androidApi ?? 'unknown'}</p><p>Capacitor: {notificationDiagnostics.build.capacitor.core} / {notificationDiagnostics.build.capacitor.localNotifications}</p><p>Android permission: {notificationDiagnostics.permission} · App notifications: {notificationDiagnostics.appNotifications}</p><p>Exact alarms: {notificationDiagnostics.exactAlarm} · Channel: {notificationDiagnostics.channel}</p><p>Pending records: {notificationDiagnostics.pendingCount} · Visible: {notificationDiagnostics.visibleNotificationCount} · IDs {notificationDiagnostics.visibleNotificationIds.join(', ') || 'none'}</p><p>Last schedule: {notificationDiagnostics.lastScheduleAttempt || 'unknown'} · {notificationDiagnostics.lastScheduleResult}</p><p>Last cancellation: {notificationDiagnostics.lastCancellationReason || 'none'} · Last action: {notificationDiagnostics.lastActionEvent ? `${notificationDiagnostics.lastActionEvent.kind}, ${notificationDiagnostics.lastActionEvent.at}` : 'unknown'}</p><p>Last scheduling error: {notificationDiagnostics.lastError || 'none'}</p></div>
                {developerToolsEnabled && notificationDiagnostics.reminderLifecycle.length > 0 && <details className="rounded-xl border border-[var(--stroke)] p-3"><summary className="min-h-11 cursor-pointer text-xs font-semibold">Reminder timeline · no task titles</summary><ol className="mt-2 space-y-2">{notificationDiagnostics.reminderLifecycle.map(item => <li key={item.notificationId} className="border-t border-[var(--stroke)] pt-2 text-[10px] leading-5 text-secondary"><strong>Reminder {item.notificationId}</strong> · {item.deliveryState}<br />Scheduled: {item.reminderAt}<br />Accepted: {item.nativeAcceptedAt || 'not observed'} · Pending: {item.pendingObservedAt || 'not observed'}<br />Android posted: {item.androidPostedAt || 'not observed'} · Receiver event: {item.receiverEventAt || 'not observed'} · Tapped: {item.tappedAt || 'not observed'}</li>)}</ol></details>}
                <div className="grid grid-cols-2 gap-2"><button onClick={async () => { try { const at = await NotificationService.testNotification(); await refreshNotificationDiagnostics(); showToast(`Scheduled test for ${at.toLocaleTimeString()}; check whether it arrives.`, 'success'); } catch (error) { await refreshNotificationDiagnostics(); showToast(error instanceof Error ? error.message : 'Test notification failed', 'danger'); } }} className="lifeos-accent-button min-h-11 rounded-xl px-3 text-xs font-semibold">Schedule test · 10 sec</button><button onClick={async () => { try { const at = await NotificationService.sendImmediateTestNotification(); await refreshNotificationDiagnostics(); showToast(`Immediate test requested for ${at.toLocaleTimeString()}; check whether it arrives.`, 'success'); } catch (error) { await refreshNotificationDiagnostics(); showToast(error instanceof Error ? error.message : 'Immediate test failed', 'danger'); } }} className="lifeos-panel min-h-11 rounded-xl border px-3 text-xs font-semibold">Immediate test</button><button onClick={() => void openNotificationSettings()} className="col-span-2 lifeos-panel min-h-11 rounded-xl border px-3 text-xs font-semibold">Android notification settings</button></div>
                <button onClick={() => void refreshNotificationDiagnostics()} className="min-h-11 w-full rounded-xl border border-[var(--stroke)] text-xs font-medium text-secondary">Refresh diagnostics</button><button onClick={() => void copyNotificationDiagnostics()} className="min-h-11 w-full rounded-xl border border-[var(--stroke)] text-xs font-medium text-secondary">Copy privacy-safe diagnostics</button>
              </section>
<button onClick={async () => { if (!(await confirmAction({ title: 'Reset onboarding for testing?', message: 'Your records will remain untouched. Choices made during onboarding may update your name, appearance, security, and notification preferences.', confirmLabel: 'Restart tour' }))) return; await StorageService.settings.set('onboardingCompleted', false); await StorageService.settings.set('onboardingStarted', true); await StorageService.settings.set('onboardingStep', 0); setOnboardingStep(0); setOnboardingComplete(false); setOnboardingRequired(true); }} className="min-h-11 rounded-xl border border-[var(--stroke)] px-3 text-xs font-medium">Reset onboarding for testing</button>
              <section className="lifeos-panel rounded-xl p-4 space-y-3">
                <h2 className="text-sm font-semibold">Sample data</h2>
                <p className="text-xs text-secondary">Six months of activity for exploring BusyDoo. Sample task reminders are silent.</p>
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

            {profileSection === 'data' && <ProfileSubpage embedded title="Backup & Restore" description="Manage encrypted copies and local records." onBack={() => navigateProfileSection('home')}>
              <ProfileData busy={backupOperationInProgress} onBackup={() => void exportProfileBackup()} onRestore={file => void importBackupFile(file)}
                onCsv={() => void exportProfileCsv()} onReset={() => void resetProfileData()} />
            </ProfileSubpage>}
            {profileSection === 'money-imports' && <ProfileSubpage embedded title="Money &amp; Imports" onBack={() => navigateProfileSection('home')}>
              <p className="text-sm text-secondary">Paste a bank alert or share it from another Android app to review the transaction before saving it.</p>
              <button type="button" className="feather-primary" onClick={async () => {
                try { await setSensitiveScreenshotState(true); setSmartImportOpen(true); }
                catch { showToast('Could not open Smart Import securely.', 'danger'); }
              }}>Import alert</button>
            </ProfileSubpage>}
            {profileSection === 'about' && <ProfileSubpage embedded title="About BusyDoo" description="Find the installed version and software notices." onBack={() => navigateProfileSection('home')}>
              <div className="preference-group"><div className="preference-row"><span>Version</span><span className="text-secondary">{packageInfo.version}</span></div>
                <ProfileSettingRow title="Replay A Life in Harmony" onClick={() => window.dispatchEvent(new Event(REPLAY_BUSYDOO_LAUNCH))} />
                <ProfileSettingRow title="Open-source licenses" onClick={() => navigateProfileSection('licenses')} /></div>
            </ProfileSubpage>}
            {profileSection === 'licenses' && <ProfileSubpage embedded title="Open-source licenses" description="Read notices packaged with BusyDoo." backLabel="About BusyDoo" onBack={() => navigateProfileSection('about')}>
              <LicenseText title="Web libraries and Inter font" source="./licenses/web-and-font.txt" />
              <LicenseText title="Android libraries" source="./licenses/android.txt" />
            </ProfileSubpage>}
          </div>
          </div>
        )} />
        </div></div>
      </main>

      {transactionDetail && <TransactionDetail key={transactionDetail.id}
        kind={transactionDetail.type} title={transactionDetail.description || transactionDetail.category}
        amount={(transactionDetail.type === 'income' ? '+' : '−') + (transactionDetail.amountMinor != null && transactionDetail.currencyCode
          ? formatMinorUnits(BigInt(transactionDetail.amountMinor), transactionDetail.currencyCode, userPrefs.locale === 'system' ? undefined : userPrefs.locale)
          : transactionDetail.currencyCode ? formatMoney(transactionDetail.amount, transactionDetail.currencyCode) : String(transactionDetail.amount))}
        currency={transactionDetail.currencyCode || 'Currency unknown'}
        context={[
          ['Date', formatDate(transactionDetail.date)],
          ['Time', transactionDetail.occurredAt ? formatTime(new Date(transactionDetail.occurredAt)) : 'Time not recorded'],
          ['Category', transactionDetail.category],
          ['Payment', transactionDetail.paymentMethod || 'Other'],
          ['Account', transactionDetail.accountId ? financialAccounts.find(account => account.id === transactionDetail.accountId)?.name || 'Archived account' : 'Unassigned'],
        ]}
        notes={transactionDetail.notes}
        onClose={() => setTransactionDetailId(null)}
        primaryLabel="Edit transaction" onPrimary={() => openEditTransaction(transactionDetail)}
        onDuplicate={() => openDuplicateTransaction(transactionDetail)}
        onDelete={async () => {
          const id = transactionDetail.id;
          if (!await confirmAction({ title: 'Delete this transaction?', message: 'It will be removed from your history.', confirmLabel: 'Delete transaction', destructive: true })) return;
          try { await StorageService.transactions.delete(id); await reloadAllData(); showToast('Transaction deleted', 'info'); }
          catch { showToast('Could not finish deleting the transaction. Refresh before retrying.', 'danger'); }
        }}
      />}
      {transferDetail && <TransactionDetail key={transferDetail.id} kind="transfer"
        title={transferDetail.reversalOfId ? 'Transfer reversal' : 'Transfer'}
        amount={formatMinorUnits(BigInt(transferDetail.fromAmountMinor), transferDetail.fromCurrencyCode)}
        currency={transferDetail.fromCurrencyCode}
        context={[
          ['Date', formatDate(transferDetail.date)],
          ['From', financialAccounts.find(account => account.id === transferDetail.fromAccountId)?.name || 'Archived account'],
          ['To', financialAccounts.find(account => account.id === transferDetail.toAccountId)?.name || 'Archived account'],
          ['Received', formatMinorUnits(BigInt(transferDetail.toAmountMinor), transferDetail.toCurrencyCode)],
        ]}
        notes={transferDetail.reversalOfId ? undefined : transferDetail.notes}
        onClose={() => setTransferDetailId(null)} primaryLabel={editableTransferDetail ? 'Edit transfer' : 'Manage transfers'} onPrimary={() => {
          navigateFinanceSubtab('accounts');
          if (editableTransferDetail) {
            setTransferFormDirty(false);
            setTransferFormDraft(buildTransferDraft(transferDetail));
          }
        }}
      />}
      {smartImportOpen && <SmartImportDialog initialText={sharedAlert.draft?.text} onTextConsumed={sharedAlert.releaseText} onDismiss={() => {
        setSmartImportOpen(false); sharedAlert.finish();
      }}
        onReview={(suggestion, fingerprint, historical) => {
          setSmartImportOpen(false);
          setProtectedImportComposer(true);
          sharedAlert.finish();
          openCreateForm("transaction");
          setCreateFormDirty(true);
          setCreateDraft(draft => ({ ...draft, importFingerprint: fingerprint, historicalImportFingerprints: historical.join(" "), title: suggestion.description || "",
            type: suggestion.kind, amount: suggestion.amount, currencyCode: suggestion.currency, category: "",
            date: suggestion.date || "", importTime: suggestion.time || "",
            dateTime: suggestion.date && suggestion.time ? suggestion.date + "T" + suggestion.time : "" }));
        }} onTransfer={() => { setSmartImportOpen(false); sharedAlert.finish(); navigateTo("finance"); navigateFinanceSubtab("accounts"); setOpenMoneyTransferOnAccounts(true); }} />}
      <AnimatePresence>
      {createKind && (
        <ComposerShell key={createKind} id="record-dialog" descriptionId="record-form-description"
          title={editingTransactionId ? 'Edit transaction' : editingGoalId ? 'Edit goal' : editingTaskId ? 'Edit task' : editingHabitId ? 'Edit habit' : editingContributionId ? 'Edit savings contribution' : editingSavingsGoalId ? 'Edit savings goal' : createKind === 'budget' ? (editingBudgetId ? 'Edit monthly budget' : 'Set monthly budget') : createKind === 'contribution' ? 'Add savings contribution' : createKind === 'savings' ? (editingSavingsGoalId ? 'Edit savings goal' : 'Add savings goal') : createKind === 'milestone' ? 'Add goal milestone' : createKind === 'goal-progress' ? 'Update goal progress' : `Add ${createKind}`}
          submitLabel={editingTransactionId ? 'Save transaction' : editingGoalId ? 'Save goal' : editingTaskId ? 'Save task' : editingHabitId ? 'Save habit' : editingContributionId ? 'Save contribution' : editingSavingsGoalId ? 'Save savings goal' : editingBudgetId ? 'Save budget' : createKind === 'budget' ? 'Save budget' : createKind === 'contribution' ? 'Save contribution' : createKind === 'goal-progress' ? 'Save progress' : `Save ${createKind}`}
          mode={['contribution', 'milestone', 'goal-progress'].includes(createKind) ? 'sheet' : 'page'}
          saving={recordSaving} reduced={interfaceMotion.reducedMotion} dismiss={requestCloseForm} footerDismissOnly={createKind === 'transaction'}
          submitDisabled={createKind === 'task' && Boolean(taskScheduleError({
            title: createDraft.title, dueDate: createDraft.date, dueTime: createDraft.time,
            reminderAt: createDraft.reminderLead === 'legacy' ? createDraft.reminderAt : undefined,
          }, tasks.find(task => task.id === editingTaskId), clockNow))}
          onSubmit={saveNewRecord} onChange={() => setCreateFormDirty(true)} onChoiceChange={() => setCreateFormDirty(true)}>
            <p id="record-form-description" className="sr-only">Enter the record details and save your changes.</p>
            {!['budget', 'contribution', 'goal-progress', 'transaction'].includes(createKind) && <label className="feather-composer-lead">
              {createKind === 'habit' ? 'Habit name' : createKind === 'goal' || createKind === 'savings' ? 'Goal title' : createKind === 'milestone' ? 'Milestone title' : 'Task title'}
              <input placeholder={createKind === 'task' ? 'What needs to be done?' : createKind === 'habit' ? 'What would you like to build?' : createKind === 'goal' ? 'What would you like to achieve?' : undefined} required maxLength={120} value={createDraft.title || ''} onChange={e => setCreateDraft({ ...createDraft, title: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" />
            </label>}
            {createKind === 'transaction' && <>
              <label className="feather-composer-lead">Amount · {createDraft.currencyCode || userPrefs.currency}<input required type="number" min={10 ** -getCurrencyMetadata(createDraft.currencyCode || userPrefs.currency).fractionDigits} step={10 ** -getCurrencyMetadata(createDraft.currencyCode || userPrefs.currency).fractionDigits} inputMode="decimal" value={createDraft.amount} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <div className="task-quick-actions" role="group" aria-label="Transaction options">
              <PreferenceChoice variant="quick" icon={<Layers size={18} aria-hidden="true" />} label="Type" value={createDraft.type}
                options={[["expense", "Expense"], ["income", "Income"]]} onSelect={e => {
                const type = e as 'income' | 'expense';
                const category = categories.find(item => item.type === type)?.name || '';
                setCreateDraft({ ...createDraft, type, category });
              }} />
              <PreferenceChoice variant="quick" icon={<Tag size={18} aria-hidden="true" />} label="Category" required={isEncryptedStorageActivated()} value={createDraft.category || ''} searchable
                options={[["", "Select category"], ...(createDraft.category && !categories.some(category => category.name === createDraft.category && category.type === createDraft.type)
                  ? [[createDraft.category, 'Legacy category: ' + createDraft.category] as const] : []), ...(categories.filter(category => category.type === createDraft.type).map(category => (
                  [String(category.name), category.name] as const
                )))]} onSelect={e => setCreateDraft({ ...createDraft, category: e })} />
              </div>
                <div className="transaction-composer-account"><PreferenceChoice variant="field" label="Account (optional)" value={createDraft.accountId || ''} searchable
                  options={[["", "Unassigned"], ...(financialAccounts.filter(account => account.isActive || account.id === createDraft.accountId).map(account => [
                    account.id, account.name + ' · ' + account.currencyCode + (account.isActive ? '' : ' · Archived'),
                  ] as const))]} onSelect={e => { const account = financialAccounts.find(row => row.id === e); setCreateDraft({ ...createDraft, accountId: e, ...(account ? { currencyCode: account.currencyCode } : {}) }); }} /></div>
              <label className="block text-xs text-secondary">Merchant or description<input maxLength={120} value={createDraft.title || ''} onChange={event => setCreateDraft({ ...createDraft, title: event.target.value })} className="lifeos-input mt-1 min-h-11 w-full rounded-xl px-3" /></label>
              {!isEncryptedStorageActivated() && <p className="mb-3 text-sm text-secondary" role="status">Your categories will appear after you protect your first record. Nothing is saved until you choose one.</p>}
              {(createDraft.importFingerprint || editingLegacyDateOnly) && <label className="block text-xs text-secondary">Transaction date<input type="date" required value={createDraft.date || ""} onChange={event => {
                const date = event.target.value;
                setCreateDraft({ ...createDraft, date, dateTime: date && createDraft.importTime ? date + 'T' + createDraft.importTime : '' });
              }} className="lifeos-input mt-1 min-h-11 w-full rounded-xl px-3" /></label>}
                <label className="mb-1 block text-xs text-secondary">Transaction date and time{editingLegacyDateOnly && <span className="mt-1 block text-secondary">Time is optional.</span>}<input required={!editingLegacyDateOnly && !createDraft.importFingerprint} type="datetime-local" value={createDraft.dateTime || ''} onChange={event => {
                  const dateTime = event.target.value;
                  setCreateDraft({ ...createDraft, dateTime, ...((createDraft.importFingerprint || editingLegacyDateOnly) && {
                    date: dateTime.slice(0, 10) || createDraft.date, importTime: dateTime.slice(11),
                  }) });
                }} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <AliveDisclosure label="Payment, currency & notes" defaultOpen={Boolean(editingTransactionId && !createDraft.currencyCode)}>
                <p className="mb-3 text-xs text-secondary">Changing the reporting currency does not convert saved records.</p>
                <div className="mb-3 block text-xs text-secondary"><PreferenceChoice variant="field" label="Currency" value={createDraft.currencyCode || (editingTransactionId ? '' : userPrefs.currency)} searchable
                options={[...(CURRENCY_CODES.map(code => [String(code), formatCurrencyChoice(code, userPrefs.locale === 'system' ? undefined : userPrefs.locale)] as const))]} onSelect={e => setCreateDraft({ ...createDraft, currencyCode: e, accountId: financialAccounts.some(account => account.id === createDraft.accountId && account.currencyCode === e) ? createDraft.accountId : '' })} /></div>
                <label className="mb-3 block text-xs text-secondary">Payment method<input maxLength={50} value={createDraft.paymentMethod || ''} onChange={e => setCreateDraft({ ...createDraft, paymentMethod: e.target.value })} placeholder="Other" className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <label className="mb-3 block text-xs text-secondary">Notes<textarea rows={2} maxLength={500} value={createDraft.notes || ''} onChange={e => setCreateDraft({ ...createDraft, notes: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <label className="mb-3 flex min-h-11 items-center gap-2 text-xs text-secondary"><input type="checkbox" checked={createDraft.isRecurring === 'yes'} onChange={e => setCreateDraft({ ...createDraft, isRecurring: e.target.checked ? 'yes' : '' })} />Recurring transaction</label>
              {!editingTransactionId && <button type="button" className="record-transfer-link lifeos-raised min-h-11 w-full rounded-xl text-sm font-semibold" onClick={async () => {
                if (createOperation.current || (createFormDirty && !await confirmAction({ title: 'Discard this transaction draft?', message: 'Transfers use a separate form.', confirmLabel: 'Open transfer', cancelLabel: 'Keep editing' }))) return;
                setCreateKind(null); setCreateFormDirty(false);
                navigateTo('finance'); navigateFinanceSubtab('accounts'); setOpenMoneyTransferOnAccounts(true);
              }}>Transfer between accounts</button>}
              </AliveDisclosure>
            </>}
            {createKind === 'habit' && <>
              <div className="task-quick-actions" role="group" aria-label="Habit options">
              <PreferenceChoice variant="quick" icon={<CalendarDays size={18} aria-hidden="true" />} label="How often?" value={createDraft.frequency || 'daily'}
                options={[['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['weekly', 'Weekly']]}
                onSelect={frequency => setCreateDraft(draft => ({ ...draft, frequency }))} />
              <PreferenceChoice variant="quick" icon={<Activity size={18} aria-hidden="true" />} label="Progress tracking" value={createDraft.trackingMode || 'binary'}
                disabled={Boolean(editingHabitId && habitLogs.some(log => log.habitId === editingHabitId))}
                disabledHint="Tracking mode is kept for saved check-ins"
                options={[['binary', 'Completed / not completed'], ['quantity', 'Count a daily quantity']]}
                onSelect={trackingMode => setCreateDraft(draft => ({ ...draft, trackingMode }))} />
              </div>
              <label className="mb-3 block text-xs text-secondary">{createDraft.trackingMode === 'quantity' ? 'Daily quantity target' : 'Daily target (optional)'}<input required={createDraft.trackingMode === 'quantity'} type="number" min="0.01" step="any" value={createDraft.targetPerDay || ''} onChange={e => setCreateDraft({ ...createDraft, targetPerDay: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              {createDraft.trackingMode === 'quantity' && <label className="mb-3 block text-xs text-secondary">Unit<input required maxLength={24} value={createDraft.quantityUnit || ''} onChange={e => setCreateDraft({ ...createDraft, quantityUnit: e.target.value })} placeholder="glasses, minutes, pages" className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>}
              <AliveDisclosure label="Schedule options">
                <fieldset className="task-composer-section"><legend className="text-sm font-semibold">Scheduled weekdays</legend>
                  <div className="flex flex-wrap gap-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                    const selected = (createDraft.weekdays || '').split(',').filter(Boolean);
                    return <label key={day} className="flex min-h-11 items-center gap-1 px-2 text-sm"><input type="checkbox" checked={selected.includes(String(index))}
                      onChange={event => setCreateDraft(current => ({ ...current, weekdays: (event.target.checked ? [...selected, String(index)] : selected.filter(value => value !== String(index))).sort().join(',') }))} />{day}</label>;
                  })}</div>
                  <label className="block text-sm">Effective date<input type="date" min={todayKey} value={createDraft.habitScheduleFrom || ''} onChange={event => setCreateDraft(current => ({ ...current, habitScheduleFrom: event.target.value }))} className="lifeos-input block min-h-11" /></label>
                  <label className="block text-sm">Sessions per week (optional)<input type="number" min="1" max="7" value={createDraft.weeklySessions || ''} onChange={event => setCreateDraft(current => ({ ...current, weeklySessions: event.target.value }))} className="lifeos-input block min-h-11" /></label>
                  <button type="button" className="lifeos-raised mt-2 min-h-11 rounded-xl px-3 text-xs"
                    disabled={Boolean(editingHabitId && habitLogs.some(log => log.habitId === editingHabitId))}
                    onClick={() => { setCreateFormDirty(true); setCreateDraft(current => ({ ...current, trackingMode: 'quantity', quantityUnit: 'minute' })); }}>Track duration in minutes</button>
                </fieldset>
              </AliveDisclosure>
              <AliveDisclosure label="Reminders">
              <label className="mb-3 block text-xs text-secondary">Reminder time (optional)<input type="time" value={createDraft.reminderTime || ''} onChange={e => setCreateDraft({ ...createDraft, reminderTime: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                {createDraft.frequency === 'weekly' && <PreferenceChoice variant="field" label="Reminder weekday" value={createDraft.reminderWeekday || '2'}
                  options={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => [String(index + 1), day])}
                  onSelect={reminderWeekday => setCreateDraft(current => ({ ...current, reminderWeekday }))} />}
              </AliveDisclosure>
              <AliveDisclosure label="Habit notes">
              {goals.length > 0 && <PreferenceChoice variant="field" label="Linked goal" value={goals.some(goal => goal.id === createDraft.goalId) ? createDraft.goalId : ''}
                options={[[ '', 'No linked goal' ], ...goals.map(goal => [goal.id, goal.title] as const)]}
                onSelect={goalId => setCreateDraft(current => ({ ...current, goalId }))} />}
              <label className="mb-3 block text-xs text-secondary">Description (optional)<textarea rows={2} maxLength={300} value={createDraft.description || ''} onChange={e => setCreateDraft({ ...createDraft, description: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              </AliveDisclosure>
            </>}
            {createKind === 'goal' && <>
              <div className="task-quick-actions" role="group" aria-label="Goal options">
                <PreferenceChoice variant="quick" icon={<Target size={18} aria-hidden="true" />} label="Progress type" value={createDraft.goalMode || 'accumulate'}
                  disabled={Boolean(editingGoalId)} disabledHint="Progress type is kept for existing goals"
                  options={[['accumulate', 'Build toward a target'], ['reduce', 'Reduce a value'], ['milestone', 'Complete milestones'], ['frequency', 'Count sessions']]}
                  onSelect={goalMode => setCreateDraft(current => ({ ...current, goalMode, ...(goalMode === 'frequency' ? { unit: '' } : {}) }))} />
                <PreferenceChoice variant="quick" icon={<Flag size={18} aria-hidden="true" />} label="Priority" value={createDraft.priority || 'Medium'}
                  options={['Low', 'Medium', 'High', 'Urgent'].map(priority => [priority, priority])}
                  onSelect={priority => setCreateDraft(current => ({ ...current, priority }))} />
              </div>
              {createDraft.goalMode === 'reduce' && <label className="block text-sm">Starting value
                <input required type="number" min="0" step="any" value={createDraft.baselineValue || ''} onChange={event => setCreateDraft(current => ({ ...current, baselineValue: event.target.value }))} className="lifeos-input block min-h-11 w-full rounded-xl px-3" />
              </label>}
              {createDraft.goalMode !== 'milestone' && <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-xs text-secondary">Target<input required type="number" min={createDraft.goalMode === 'reduce' ? '0' : createDraft.goalMode === 'frequency' ? '1' : '0.01'} step={createDraft.goalMode === 'frequency' ? '1' : 'any'} inputMode="decimal" value={createDraft.target} onChange={e => setCreateDraft({ ...createDraft, target: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label><label className="text-xs text-secondary">Current<input type="number" min="0" step="any" inputMode="decimal" value={createDraft.current} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label></div>}
              <label className="mb-3 block text-xs text-secondary">Unit (optional)<input maxLength={20} value={createDraft.unit} onChange={e => setCreateDraft({ ...createDraft, unit: e.target.value })} placeholder="km, books, ₹..." className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <AliveDisclosure label={editingGoalId ? 'Category and status' : 'Goal category'}>
                <PreferenceChoice variant="field" label="Category" value={createDraft.category || 'Other'} searchable
                  options={['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'].map(category => [category, category])}
                  onSelect={category => setCreateDraft(current => ({ ...current, category }))} />
                {editingGoalId && <PreferenceChoice variant="field" label="Status" value={createDraft.status || 'In Progress'}
                  options={['In Progress', 'Paused', 'Completed'].map(status => [status, status])}
                  onSelect={status => setCreateDraft(current => ({ ...current, status }))} />}
              </AliveDisclosure>
              <AliveDisclosure label="Target date and notes">
                <label className="block text-xs text-secondary">Target date<input type="date" value={createDraft.date || ''} onChange={event => setCreateDraft(current => ({ ...current, date: event.target.value }))} className="lifeos-input mt-1 min-h-11 w-full rounded-xl px-3" /></label>
                <label className="mb-3 block text-xs text-secondary">Description<textarea rows={2} maxLength={500} value={createDraft.description || ''} onChange={event => setCreateDraft(current => ({ ...current, description: event.target.value }))} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              </AliveDisclosure>
            </>}
            {createKind === 'budget' && <>
              {editingBudgetId && <p className="mb-3 rounded-xl bg-[var(--surface-raised)] p-3 text-xs text-secondary">Editing keeps this plan’s category, month and currency. Create a separate plan to change those details.</p>}
              <div className="mb-3 block text-xs text-secondary"><PreferenceChoice variant="field" label="Budget category (optional)" disabled={Boolean(editingBudgetId)} value={createDraft.categoryId || ''} searchable
                options={[["", "Overall budget"], ...(categories.filter(category => category.type === 'expense').map(category => [String(category.id), category.name] as const))]} onSelect={e => setCreateDraft({ ...createDraft, categoryId: e })} /></div>
              {(() => { const code = editingBudgetId ? budgets.find(row => row.id === editingBudgetId)?.currencyCode || userPrefs.currency : userPrefs.currency; const digits = getCurrencyMetadata(code).fractionDigits; return <label className="mb-3 block text-xs text-secondary">Monthly limit · {code}<input required type="number" min={10 ** -digits} step={10 ** -digits} inputMode="decimal" value={createDraft.amount || ''} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>; })()}
              <label className="mb-4 block text-xs text-secondary">Month<input disabled={Boolean(editingBudgetId)} required type="month" value={createDraft.month || financeMonth} onChange={e => setCreateDraft({ ...createDraft, month: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={createDraft.carryover === 'yes'}
                onChange={event => setCreateDraft(current => ({ ...current, carryover: event.target.checked ? 'yes' : '' }))} />Carry over unused budget from last month</label>
            </>}
            {createKind === 'savings' && <>
              <div className="composer-field-grid">
                <label className="text-xs text-secondary">Target amount · {userPrefs.currency}<input required type="number" min={10 ** -getCurrencyMetadata(userPrefs.currency).fractionDigits} step={10 ** -getCurrencyMetadata(userPrefs.currency).fractionDigits} inputMode="decimal" value={createDraft.target || ''} onChange={e => setCreateDraft({ ...createDraft, target: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <label className="block text-xs text-secondary">Target date
                <input type="date" required value={createDraft.date || ''} onChange={e => setCreateDraft({ ...createDraft, date: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" />
                </label>
              </div>
              <AliveDisclosure label="Savings options">
                {!editingSavingsGoalId && <label className="text-xs text-secondary">Already saved<input type="number" min="0" step={10 ** -getCurrencyMetadata(userPrefs.currency).fractionDigits} inputMode="decimal" value={createDraft.current} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>}
              <label className="mb-3 block text-xs text-secondary">Category (optional)<input maxLength={40} value={createDraft.category || ''} onChange={e => setCreateDraft({ ...createDraft, category: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
              </AliveDisclosure>
            </>}
            {createKind === 'contribution' && <>
              {editingContributionId ? <p className="mb-3 text-xs text-secondary">Savings goal · {savingsGoals.find(goal => goal.id === createDraft.goalId)?.title || 'Unavailable'}</p> : <div className="mb-3 block text-xs text-secondary"><PreferenceChoice variant="field" label="Savings goal" required value={createDraft.goalId || ''} searchable
                options={[...(savingsGoals.map(goal => [String(goal.id), goal.title] as const))]} onSelect={e => setCreateDraft({ ...createDraft, goalId: e })} /></div>}
              {(() => { const contributionCurrency = savingsContributions.find(item => item.id === editingContributionId)?.currencyCode || savingsGoals.find(goal => goal.id === createDraft.goalId)?.currencyCode || userPrefs.currency; const digits = getCurrencyMetadata(contributionCurrency).fractionDigits; return <label className="mb-3 block text-xs text-secondary">Amount · {contributionCurrency}<input required type="number" min={10 ** -digits} step={10 ** -digits} inputMode="decimal" value={createDraft.amount || ''} onChange={e => setCreateDraft({ ...createDraft, amount: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>; })()}
              <label className="mb-3 block text-xs text-secondary">Note (optional)<input maxLength={100} value={createDraft.notes || ''} onChange={e => setCreateDraft({ ...createDraft, notes: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>
                <p className="mb-3 rounded-xl bg-[var(--surface-raised)] p-3 text-xs leading-relaxed text-secondary">A contribution updates this savings goal only; it does not record a cash movement or reduce expense and budget totals. If money moves between tracked accounts, record that separately as a transfer.</p>
            </>}
            {createKind === 'milestone' && <div className="mb-3 block text-xs text-secondary"><PreferenceChoice variant="field" label="Goal" required value={createDraft.goalId || ''} searchable
                options={[...(goals.map(goal => [String(goal.id), goal.title] as const))]} onSelect={e => setCreateDraft({ ...createDraft, goalId: e })} /></div>}
            {createKind === 'goal-progress' && <><div className="mb-3 block text-xs text-secondary"><PreferenceChoice variant="field" label="Goal" required value={createDraft.goalId || ''} searchable
                options={[...(goals.map(goal => [String(goal.id), goal.title] as const))]} onSelect={e => setCreateDraft({ ...createDraft, goalId: e })} /></div><label className="mb-4 block text-xs text-secondary">Current progress<input required type="number" min="0" step="any" inputMode="decimal" value={createDraft.current || ''} onChange={e => setCreateDraft({ ...createDraft, current: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label></>}
            {createKind === 'task' && <TaskComposerOptions draft={createDraft} update={setCreateDraft}
              dateOnlyAlertTime={dateOnlyAlertTime} alertsEnabled={notificationsEnabled && notificationPreferences.taskReminders} goals={goals} editing={Boolean(editingTaskId)} dirty={() => setCreateFormDirty(true)} />}
            {(createKind === 'goal' || createKind === 'savings' || createKind === 'milestone' || createKind === 'contribution') && <label className="mb-4 block text-xs text-secondary">{createKind === 'savings' ? 'Target date' : createKind === 'contribution' ? 'Date' : 'Target date (optional)'}<input type="date" required={createKind === 'savings' || createKind === 'contribution'} value={createDraft.date || ''} onChange={e => setCreateDraft({ ...createDraft, date: e.target.value })} className="lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm" /></label>}
            {editingTransactionId && <button type="button" onClick={async () => { if (!(await confirmAction({ title: 'Delete this transaction?', message: 'This transaction will be removed from your history. This cannot be undone.', confirmLabel: 'Delete transaction', destructive: true }))) return; await StorageService.transactions.delete(editingTransactionId); setCreateKind(null); setCreateFormDirty(false); setEditingTransactionId(null); await reloadAllData(); showToast('Transaction deleted', 'info'); }} className="mb-2 min-h-11 w-full rounded-xl border border-[var(--danger)] px-4 py-2.5 text-sm font-medium text-[var(--danger)]">Delete transaction</button>}
            {editingContributionId && <button type="button" onClick={async () => { if (!(await confirmAction({ title: 'Delete this contribution?', message: 'The contribution will be removed and subtracted from the saved goal total.', confirmLabel: 'Delete contribution', destructive: true }))) return; try { await StorageService.savings.deleteContribution(editingContributionId); setCreateKind(null); setCreateFormDirty(false); setEditingContributionId(null); await reloadAllData(); showToast('Contribution deleted and savings total reconciled', 'success'); } catch (error) { showToast(error instanceof Error ? error.message : 'Contribution could not be deleted safely.', 'danger'); } }} className="mb-2 min-h-11 w-full rounded-xl border border-[var(--danger)] px-4 py-2.5 text-sm font-medium text-[var(--danger)]">Delete contribution</button>}
        </ComposerShell>
      )}
      </AnimatePresence>

      {/* Floating Bottom Nav */}
      <nav data-no-tab-swipe data-record-background data-reduced={interfaceMotion.reducedMotion} ref={bottomNavigationRef} aria-label="Main navigation" className="lifeos-nav app-bottom-nav fixed bottom-0 left-0 right-0 z-30 mx-auto border-t px-2 pt-2">
        <div className="app-nav-items alive-nav">
        <span ref={navigationMotion.indicator} className="alive-nav-indicator" aria-hidden="true"
          style={{ transform: 'var(--track-indicator, translate3d(' + Math.max(0, PRIMARY_NAVIGATION.findIndex(({ tab }) => tab === primaryDestinationForTab(activeTab))) * 100 + '%,0,0))' }} />
        {PRIMARY_NAVIGATION.map(({ tab, label, icon }) => {
          const Icon = ({ home: Home, wallet: WalletCards, calendar: CalendarDays, profile: UserRound })[icon];
          const isSelected = primaryDestinationForTab(activeTab) === tab;
          return (
          <button
            key={tab}
            data-tab={tab}
            id={tab === "settings" ? "profile-opener" : undefined}
            onClick={() => {
              todayOrigin.current = null;
              todayReturnFocus.current = null;
              if (isSelected) {
                navigationMotion.cancelPending();
                if (activeTab !== tab) { navigateTo(tab); return; }
                if (tab === 'finance' && financeSubtab !== 'overview') { rememberActiveScroll(); financeSubtabHistory.current = []; setFinanceSubtab('overview'); }
                if (tab === 'settings' && profileSection !== 'home') navigateProfileSection('home');
                return;
              }
              navigateTo(tab);
            }}
            aria-label={label}
            aria-current={isSelected ? 'page' : undefined}
            className="nav-item ui-control-feedback flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] leading-none font-medium"
          >
            {tab === 'settings' && profilePhoto ? <span className="nav-profile-avatar" aria-hidden="true"><ProfileAvatar photo={profilePhoto} initial={profileInitial(displayName)} /></span>
              : <Icon size={18} strokeWidth={isSelected ? 2.4 : 1.8} aria-hidden="true" />}
            <span>{label}</span>
          </button>
          );
        })}
        </div>
      </nav>

      {showExitConfirmation && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-5" role="presentation"><section className="lifeos-panel w-full max-w-sm rounded-2xl border p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="exit-lifeos-title"><h2 id="exit-lifeos-title" className="text-lg font-semibold">Leave BusyDoo?</h2><p className="mt-2 text-sm text-secondary">Your changes are saved on this device. You can return anytime.</p><div className="mt-5 flex gap-2"><button autoFocus onClick={() => setShowExitConfirmation(false)} className="lifeos-input min-h-11 flex-1 rounded-xl text-sm font-medium">Stay</button><button onClick={() => void CapacitorApp.exitApp()} className="lifeos-accent-button min-h-11 flex-1 rounded-xl text-sm font-semibold">Exit app</button></div></section></div>}

      {confirmation && <ConfirmationDialog {...confirmation} onCancel={() => settleConfirmation(false)} onConfirm={() => settleConfirmation(true)} />}

      {profileOpen && pendingProfilePhoto && !activityResumeGuard && <ProfilePhotoEditor source={pendingProfilePhoto} onCancel={() => setPendingProfilePhoto(null)} onSave={saveProfilePhoto} />}
      <AnimatePresence>{toast && <Snackbar notice={toast} key="app-snackbar" onDismiss={() => setToast(null)} reduced={interfaceMotion.reducedMotion} />}</AnimatePresence>
    </div>
    </LazyMotion>
  );
}
