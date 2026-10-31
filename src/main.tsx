import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StorageService } from './db';
import './index.css';

const root = document.getElementById('root')!;
const renderApp = () => ReactDOM.createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
void StorageService.settings.get<'dark' | 'light' | 'system'>('theme', 'system').then(preference => {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#090d16' : '#f8fafc');
  localStorage.setItem('lifeos-appearance', preference);
  document.documentElement.dataset.themeReady = 'true';
  renderApp();
}).catch(error => {
  console.warn('LifeOS theme bootstrap could not read the saved preference; using Android appearance.', error);
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themeReady = 'true';
  renderApp();
});
