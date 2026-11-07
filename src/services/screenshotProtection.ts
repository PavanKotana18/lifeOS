import { Capacitor, registerPlugin } from '@capacitor/core';

interface ScreenshotProtectionNativePlugin {
  setSensitive(options: { sensitive: boolean }): Promise<void>;
  confirmResume(): Promise<void>;
}

export interface SensitiveScreenshotState {
  appReady: boolean;
  onboardingRequired: boolean;
  onboardingComplete: boolean;
  secureSetupOpen: boolean;
  recoveryOpen: boolean;
  backupPassphraseOpen: boolean;
  backupOperationInProgress: boolean;
  locked: boolean;
  biometricAuthenticationInProgress: boolean;
}

const nativeProtection = registerPlugin<ScreenshotProtectionNativePlugin>('ScreenCaptureProtection');

/** Conservatively protects every startup, credential, recovery, and auth surface. */
export function isSensitiveScreenshotState(state: SensitiveScreenshotState): boolean {
  return !state.appReady
    || (state.onboardingRequired && !state.onboardingComplete)
    || state.secureSetupOpen
    || state.recoveryOpen
    || state.backupPassphraseOpen
    || state.backupOperationInProgress
    || state.locked
    || state.biometricAuthenticationInProgress;
}

/** Native starts secure and rejects missing state; non-Android platforms need no window flag. */
export async function setSensitiveScreenshotState(sensitive: boolean): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await nativeProtection.setSensitive({ sensitive });
}

/** Clears the native post-resume fence only after session restoration succeeds. */
export async function confirmScreenshotResume(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await nativeProtection.confirmResume();
}
