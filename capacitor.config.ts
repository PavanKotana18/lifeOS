import { APP_NAME } from './src/config/appBrand';
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeos.personal',
  appName: APP_NAME,
  webDir: 'dist',
  loggingBehavior: 'none',
  android: {
    allowMixedContent: false,
    // Keep WebView's field-aware IME connection (numeric, password and composition).
    captureInput: false,
    webContentsDebuggingEnabled: false
  },
  plugins: { LocalNotifications: { smallIcon: 'ic_lifeos_notification', iconColor: '#54785C' } },
  server: {
    androidScheme: 'https'
  }
};

export default config;
