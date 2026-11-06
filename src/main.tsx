import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageService } from './db';
import { resolveAppearance } from './services/domainUtils';
import { resolveInitialSystemDark } from './services/systemAppearance';
import { Capacitor, registerPlugin } from '@capacitor/core';
import './index.css';

const SystemAppearance = registerPlugin<{ getSystemAppearance: () => Promise<{ dark: boolean }> }>('SystemAppearance');

const root = document.getElementById('root')!;
const renderApp = () => ReactDOM.createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
void StorageService.settings.get<'dark' | 'light' | 'system'>('theme', 'system').then(preference => {
  const mediaDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveInitialSystemDark(mediaDark, Capacitor.isNativePlatform()
    ? () => SystemAppearance.getSystemAppearance()
    : undefined).then(systemDark => {
      const dark = resolveAppearance(preference, systemDark) === 'dark';
      (window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark = systemDark;
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#090d16' : '#f8fafc');
      localStorage.setItem('lifeos-appearance', preference);
      document.documentElement.dataset.themeReady = 'true';
      renderApp();
  });
}).catch(error => {
  console.warn('LifeOS theme bootstrap could not read the saved preference; using Android appearance.', error);
  const mediaDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  void resolveInitialSystemDark(mediaDark, Capacitor.isNativePlatform()
    ? () => SystemAppearance.getSystemAppearance()
    : undefined).then(systemDark => {
    (window as Window & { lifeosSystemDark?: boolean }).lifeosSystemDark = systemDark;
    document.documentElement.classList.toggle('dark', systemDark);
    document.documentElement.style.colorScheme = systemDark ? 'dark' : 'light';
    document.documentElement.dataset.themeReady = 'true';
    renderApp();
  });
});
