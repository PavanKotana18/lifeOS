import React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageService } from './db';
import { resolveAppearance } from './services/domainUtils';
import { resolveInitialAppearancePreference, resolveInitialSystemDark, resolveInitialVisualTheme } from './services/systemAppearance';
import { applyThemeTokens, DEFAULT_THEME_ID, resolveThemeId } from './services/themeCatalog';
import { Capacitor, registerPlugin } from '@capacitor/core';
import './index.css';
import './styles/approved-composers.css';
import './styles/money-details.css';
import './styles/money-transformation.css';
import './styles/four-tab-transformation.css';
import './styles/interface-motion.css';
import './styles/feather-expressive.css';
import './styles/planning-life-transformation.css';

import BusyDooLaunch, { initialBusyDooLaunch, REPLAY_BUSYDOO_LAUNCH } from './components/BusyDooLaunch';

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
const releaseNativeSplash = () => LaunchExperience.releaseNativeSplash();

function BootstrappedApp({ coldStart }: { coldStart: boolean }) {
  const [launch, setLaunch] = useState<'first' | 'regular' | 'replay' | null>(() => {
    if (!coldStart) return null;
    return initialBusyDooLaunch() ? 'first' : 'regular';
  });
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const replay = () => setLaunch(current => current ?? 'replay');
    window.addEventListener(REPLAY_BUSYDOO_LAUNCH, replay);
    return () => window.removeEventListener(REPLAY_BUSYDOO_LAUNCH, replay);
  }, []);
  useLayoutEffect(() => {
    const app = surface.current;
    if (!launch || !app) return;
    const opener = launch === 'replay' ? document.activeElement : null;
    app.inert = true;
    return () => {
      app.inert = false;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [launch]);

  const finish = () => {
    if (launch === 'first') {
      try { localStorage.setItem('busydoo-harmony-seen', 'yes'); } catch { /* The launch preference is cosmetic. */ }
    }
    setLaunch(null);
  };

  return <React.StrictMode>
    <div ref={surface} className="contents"><App /></div>
    {launch && <BusyDooLaunch key={launch} cinematic={launch !== 'regular'}
      releaseNativeSplash={launch === 'replay' ? undefined : releaseNativeSplash} onFinish={finish} />}
  </React.StrictMode>;
}

const renderApp = (coldStart: boolean) => ReactDOM.createRoot(root).render(<BootstrappedApp coldStart={coldStart} />);

async function bootstrapAppearance() {
  let cachedTheme = DEFAULT_THEME_ID;
  try { cachedTheme = resolveThemeId(localStorage.getItem('lifeos-theme-id')); } catch { /* Cosmetic cache is optional. */ }
  const [themeId, preference] = await Promise.all([
    resolveInitialVisualTheme(() => StorageService.settings.get('visualTheme', cachedTheme === 'busydoo' ? DEFAULT_THEME_ID : cachedTheme), 1500, cachedTheme),
    resolveInitialAppearancePreference(() => StorageService.settings.get('theme', 'system')),
  ]);
  const mediaDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const systemDark = await resolveInitialSystemDark(mediaDark, Capacitor.isNativePlatform()
    ? () => SystemAppearance.getSystemAppearance()
    : undefined);
  const dark = resolveAppearance(preference, systemDark) === 'dark';
  if (Capacitor.isNativePlatform()) (window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark = systemDark;
  document.documentElement.classList.toggle('dark', dark);
  const themeTokens = applyThemeTokens(themeId, dark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeTokens.background);
  try { localStorage.setItem('lifeos-theme-id', themeId); } catch { /* Cosmetic cache is optional. */ }
  try { localStorage.setItem('lifeos-appearance', preference); } catch { /* Cosmetic cache is optional. */ }
}

// The app still starts locked and owns authentication. Appearance errors and
// deadlines never unlock storage, provision keys, or substitute a fake UI root.
void bootstrapAppearance().catch(() => {
  console.warn('BusyDoo could not apply the initial appearance.');
}).finally(() => {
  document.documentElement.dataset.themeReady = 'true';
  void readLaunchInfo().then(info => renderApp(info.coldStart));
});
