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
import './styles/money-details.css';
import './styles/money-transformation.css';
import './styles/four-tab-transformation.css';
import './styles/interface-motion.css';
import './styles/feather-expressive.css';
import './styles/planning-life-transformation.css';

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
    let frame = 0;
    let finishing = false;
    let handoff: Animation | undefined;
    let fade: Animation | undefined;
    let fallback: number | undefined;
    let disposed = false;
    const finishIfReady = () => {
      if (!elapsed || !ready || finishing) return;
      finishing = true;
      frame = window.requestAnimationFrame(() => {
        const cover = document.querySelector<HTMLElement>('.lifeos-launch-reveal');
        const mark = cover?.querySelector<HTMLElement>('.lifeos-launch-mark');
        const destination = document.querySelector<HTMLElement>('[data-launch-destination] .lifeos-onboarding-mark');
        if (reducedMotion || !cover?.animate || !mark || !destination) { setShowReveal(false); return; }
        const source = mark.getBoundingClientRect();
        const target = destination.getBoundingClientRect();
        if (!source.width || !target.width) { setShowReveal(false); return; }
        const x = target.left + target.width / 2 - source.left - source.width / 2;
        const y = target.top + target.height / 2 - source.top - source.height / 2;
        handoff = mark.animate([{ transform: 'none' }, { transform: 'translate(' + x + 'px,' + y + 'px) scale(' + (target.width / source.width) + ')' }],
          { duration: 280, easing: 'cubic-bezier(.22,.68,.26,1)', fill: 'forwards' });
        fade = cover.animate([{ opacity: 1 }, { opacity: 1, offset: .62 }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
        const complete = () => { if (!disposed) setShowReveal(false); };
        void fade.finished.then(complete, complete);
        fallback = window.setTimeout(complete, 360);
      });
    };
    const onReady = () => { ready = true; finishIfReady(); };
    window.addEventListener('lifeos:startup-ready', onReady);
    const timer = window.setTimeout(() => { elapsed = true; finishIfReady(); }, reducedMotion ? 0 : 850);
    finishIfReady();
    return () => {
      disposed = true;
      window.clearTimeout(timer); window.clearTimeout(fallback); window.cancelAnimationFrame(frame);
      handoff?.cancel(); fade?.cancel();
      window.removeEventListener('lifeos:startup-ready', onReady);
    };
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
