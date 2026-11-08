import React from 'react';

/** Original LifeOS growth-loop mark, drawn locally so it works offline. */
export function LifeOSMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 108 108" fill="none" aria-hidden="true" focusable="false">
    <path d="M75 26C60 15 38 20 27 36 15 53 21 76 38 85c14 8 32 2 40-12" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M50 64c1-17 13-28 32-30 0 19-11 31-32 30Z" fill="currentColor" />
    <path d="M51 63c7-9 16-17 27-24" stroke="var(--brand-mark-vein, var(--surface))" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

export function LifeOSBrand({ className = '', markClassName = '' }: { className?: string; markClassName?: string }) {
  return <span className={`lifeos-brand ${className}`}>
    <LifeOSMark className={markClassName} />
    <span className="lifeos-brand-word">LifeOS</span>
  </span>;
}

export function LifeOSLaunchReveal({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return <div className={`lifeos-launch-reveal${reducedMotion ? ' is-reduced-motion' : ''}`} role="status" aria-label="LifeOS is opening" aria-live="polite">
    <div className="lifeos-launch-lockup">
      <div className="lifeos-launch-mark"><LifeOSMark /></div>
      <div className="lifeos-launch-word">LifeOS</div>
      <div className="lifeos-launch-caption">A little more in sync, every day</div>
    </div>
  </div>;
}
