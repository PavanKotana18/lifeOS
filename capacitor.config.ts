import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeos.personal',
  appName: 'LifeOS',
  webDir: 'dist',
  loggingBehavior: 'none',
  android: {
    allowMixedContent: false,
    // Keep WebView's field-aware IME connection (numeric, password and composition).
    captureInput: false,
    webContentsDebuggingEnabled: false
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
