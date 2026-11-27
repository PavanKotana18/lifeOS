import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AppHeader({ title, brand, action, back, backLabel = "Back", profile }: {
  title: string;
  brand?: boolean;
  action?: ReactNode;
  back?: () => void;
  backLabel?: string;
  profile?: boolean;
}) {
  return <header data-profile-background={profile ? undefined : true} data-record-background className="app-header app-header-shell primary-masthead sticky top-0 z-40">
    <h1 id="primary-route-title" tabIndex={-1} className={brand ? 'primary-route-title app-wordmark' : 'primary-route-title'}>{title}</h1>
    {action}
    {back && Capacitor.getPlatform() !== 'android' && <button type="button" className="feather-icon-button" aria-label={backLabel} title={backLabel} onClick={back}><X size={20} aria-hidden="true" /></button>}
  </header>;
}
