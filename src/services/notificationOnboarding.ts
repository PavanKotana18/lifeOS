import { DEFAULT_NOTIFICATION_PREFERENCES } from './notificationService';
import type { NotificationPreferences } from '../types';

interface SettingsStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
}
interface PermissionChecks {
  checkPermission(): Promise<string>;
  checkExactAlarmPermission(): Promise<string>;
}

/**
 * Reconcile an onboarding permission flow after returning from Android settings.
 * It only reads grants; it never launches prompts or changes biometric/session state.
 */
export async function reconcileNotificationOnboardingOnResume(
  settings: SettingsStore,
  permissions: PermissionChecks
): Promise<{ advanced: boolean; preferences: NotificationPreferences }> {
  const [completed, step, requestStarted, saved, enabled] = await Promise.all([
    settings.get<boolean>('onboardingCompleted', false),
    settings.get<number>('onboardingStep', 0),
    settings.get<boolean>('notificationPermissionRequested', false),
    settings.get<Partial<NotificationPreferences>>('notificationPreferences', DEFAULT_NOTIFICATION_PREFERENCES),
    settings.get<boolean>('notificationsEnabled', false),
  ]);
  const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...saved };
  if (completed || step !== 3 || !requestStarted || enabled || !Object.values(preferences).some(Boolean)) {
    return { advanced: false, preferences };
  }

  const [display, exactAlarm] = await Promise.all([
    permissions.checkPermission(),
    permissions.checkExactAlarmPermission(),
  ]);
  if (display !== 'granted' || exactAlarm !== 'granted') return { advanced: false, preferences };

  await settings.set('onboardingStep', 4);
  await settings.set('notificationsEnabled', true);
  return { advanced: true, preferences };
}
