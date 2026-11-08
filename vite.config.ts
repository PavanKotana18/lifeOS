import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('./package-lock.json', import.meta.url), 'utf8'));
const lockedVersion = (name: string) => lock.packages?.[`node_modules/${name}`]?.version ?? 'unknown';
const buildInfo = {
  appVersion: lock.packages?.['']?.version ?? 'unknown',
  commit: (process.env.GITHUB_SHA || 'local').slice(0, 12),
  buildNumber: process.env.GITHUB_RUN_NUMBER || 'local',
  capacitor: {
    core: lockedVersion('@capacitor/core'),
    cli: lockedVersion('@capacitor/cli'),
    android: lockedVersion('@capacitor/android'),
    localNotifications: lockedVersion('@capacitor/local-notifications'),
    app: lockedVersion('@capacitor/app'),
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { __LIFEOS_BUILD_INFO__: JSON.stringify(buildInfo) },
  build: {
    // Keep the native WebViewCompatibility baseline aligned with emitted syntax.
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
