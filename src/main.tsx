import React from 'react';
import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageService } from './db';
import { resolveAppearance } from './services/domainUtils';
import { resolveInitialAppearancePreference, resolveInitialSystemDark, resolveInitialVisualTheme } from './services/systemAppearance';
import { applyThemeTokens, DEFAULT_THEME_ID, resolveThemeId } from './services/themeCatalog';
import { Capacitor, registerPlugin } from '@capacitor/core';
import './index.css';
import { LifeOSLaunchReveal } from './components/LifeOSBrand';

const SystemAppearance = registerPlugin<{ getSystemAppearance: () => Promise<{ dark: boolean }> }>('SystemAppearance');
const LaunchExperience = registerPlugin<{
  getLaunchInfo: () => Promise<{ coldStart: boolean }>;
  releaseNativeSplash: () => Promise<void>;
}>('LaunchExperience');

const root = document.getElementById('root')!;
function readLaunchInfo(): Promise<{ coldStart: boolean }> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve({ coldStart: false });
  return new Promise(resolve => {
    const fallback = () => {
      void LaunchExperience.releaseNativeSplash().catch(() => {});
      resolve({ coldStart: false });
    };
    const timeout = window.setTimeout(fallback, 700);
    LaunchExperience.getLaunchInfo().then(
      info => { window.clearTimeout(timeout); resolve({ coldStart: info.coldStart === true }); },
      () => { window.clearTimeout(timeout); fallback(); },
    );
  });
}
function BootstrappedApp({ coldStart }: { coldStart: boolean }) {
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [showReveal, setShowReveal] = useState(coldStart);
  useEffect(() => {
    if (!coldStart) return;
    // This effect runs after React committed the same branded cover under the
    // native splash, preventing a blank WebView handoff.
    void LaunchExperience.releaseNativeSplash().catch(() => {});
    let elapsed = false;
    let ready = (window as Window & { lifeosStartupReady?: boolean }).lifeosStartupReady === true;
    const finishIfReady = () => { if (elapsed && ready) setShowReveal(false); };
    const onReady = () => { ready = true; finishIfReady(); };
    window.addEventListener('lifeos:startup-ready', onReady);
    const timer = window.setTimeout(() => { elapsed = true; finishIfReady(); }, reducedMotion ? 0 : 1600);
    finishIfReady();
    return () => { window.clearTimeout(timer); window.removeEventListener('lifeos:startup-ready', onReady); };
  }, [coldStart, reducedMotion]);
  return <React.StrictMode><App />{showReveal && <LifeOSLaunchReveal reducedMotion={reducedMotion} />}</React.StrictMode>;
}

const renderApp = (coldStart: boolean) => ReactDOM.createRoot(root).render(<BootstrappedApp coldStart={coldStart} />);

async function bootstrapAppearance() {
  let cachedTheme = DEFAULT_THEME_ID;
  try { cachedTheme = resolveThemeId(localStorage.getItem('lifeos-theme-id')); } catch { /* Cosmetic cache is optional. */ }
  const [themeId, preference] = await Promise.all([
    resolveInitialVisualTheme(() => StorageService.settings.get('visualTheme', cachedTheme), 1500, cachedTheme),
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
  void readLaunchInfo().then(info => renderApp(info.coldStart));
});
