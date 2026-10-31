export interface BiometricAvailability {
  isAvailable: boolean;
  biometricsSupported: boolean;
  code: string;
}

export interface BiometricAuthResult {
  success: boolean;
  errorCode?: number;
  message?: string;
}

export const BiometricService = {
  async isAvailable(): Promise<BiometricAvailability> {
    try {
      const cap = (window as any).Capacitor;
      if (cap && cap.isPluginAvailable && cap.isPluginAvailable('BiometricAuth')) {
        const result = await cap.Plugins.BiometricAuth.isAvailable();
        return result;
      }
    } catch (e) {
      console.warn('Native biometric availability check error:', e);
    }
    // Web / non-Android environment
    return {
      isAvailable: false,
      biometricsSupported: false,
      code: 'WEB_PLATFORM'
    };
  },

  async authenticate(title = 'Unlock LifeOS', subtitle = 'Verify your identity to proceed'): Promise<BiometricAuthResult> {
    try {
      const cap = (window as any).Capacitor;
      if (cap && cap.isPluginAvailable && cap.isPluginAvailable('BiometricAuth')) {
        const result = await cap.Plugins.BiometricAuth.authenticate({ title, subtitle });
        return result;
      }
    } catch (e: any) {
      console.error('Native biometric authentication failed:', e);
      return { success: false, message: e.message || 'Authentication error' };
    }
    return { success: false, message: 'Native biometrics not available on this platform' };
  }
};
