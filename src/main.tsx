import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageService } from './db';
import { resolveAppearance } from './services/domainUtils';
import { resolveInitialAppearancePreference, resolveInitialSystemDark, resolveInitialVisualTheme } from './services/systemAppearance';
import { applyThemeTokens, DEFAULT_THEME_ID, resolveThemeId } from './services/themeCatalog';
import { Capacitor, registerPlugin } from '@capacitor/core';
import './index.css';

const SystemAppearance = registerPlugin<{ getSystemAppearance: () => Promise<{ dark: boolean }> }>('SystemAppearance');

const root = document.getElementById('root')!;
const renderApp = () => ReactDOM.createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);

async function bootstrapAppearance() {
  let cachedTheme = DEFAULT_THEME_ID;
  try { cachedTheme = resolveThemeId(localStorage.getItem('lifeos-theme-id')); } catch { /* Cosmetic cache is optional. */ }
  const [themeId, preference] = await Promise.all([
    resolveInitialVisualTheme(() => StorageService.settings.get('visualTheme', cachedTheme)),
    resolveInitialAppearancePreference(() => StorageService.settings.get('theme', 'system')),
  ]);
  const mediaDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const systemDark = await resolveInitialSystemDark(mediaDark, Capacitor.isNativePlatform()
    ? () => SystemAppearance.getSystemAppearance()
    : undefined);
  const dark = resolveAppearance(preference, systemDark) === 'dark';
  (window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark = systemDark;
  document.documentElement.classList.toggle('dark', dark);
  applyThemeTokens(themeId, dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101712' : '#FAFAF7');
  try { localStorage.setItem('lifeos-theme-id', themeId); } catch { /* Cosmetic cache is optional. */ }
  try { localStorage.setItem('lifeos-appearance', preference); } catch { /* Cosmetic cache is optional. */ }
}

// The app still starts locked and owns authentication. Appearance errors and
// deadlines never unlock storage, provision keys, or substitute a fake UI root.
void bootstrapAppearance().catch(() => {
  console.warn('LifeOS could not apply the initial appearance.');
}).finally(() => {
  document.documentElement.dataset.themeReady = 'true';
  renderApp();
});
