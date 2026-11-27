import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function FeatherHeader({ title, id, heading: Heading = 'h2', back, action, focusable }: {
  title: ReactNode;
  id?: string;
  heading?: 'h1' | 'h2' | 'h3';
  back?: { label: string; onClick: () => void; disabled?: boolean; dismiss?: boolean };
  action?: ReactNode;
  focusable?: boolean;
}) {
  const showExit = back && (back.dismiss || back.label === 'Close' || Capacitor.getPlatform() !== 'android');
  return <header className="feather-header">
    <div className="feather-header-main">
      <Heading id={id} tabIndex={focusable ? -1 : undefined} className="type-page-title">{title}</Heading>
    </div>
    {(showExit || action) && <div className="feather-header-action feather-header-controls">
      {action}
      {showExit && <button type="button" aria-label={back.label} title={back.label} onClick={back.onClick} disabled={back.disabled} className="feather-icon-button"><X size={20} aria-hidden="true" /></button>}
    </div>}
  </header>;
}
