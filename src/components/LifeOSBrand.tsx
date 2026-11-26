import { useState } from 'react';
import { BUSYDOO } from '../services/busydooBrand';

const lettering = [
  'M6 13h24c12 0 18 6 18 15 0 7-4 11-9 13 7 2 12 7 12 15 0 11-8 18-21 18H6zm12 10v14h10c5 0 8-2 8-7s-3-7-8-7zm0 24v17h11c6 0 10-3 10-9s-4-8-10-8z',
  'M57 31h12v25c0 6 3 9 8 9 6 0 9-4 9-11V31h12v43H87v-6c-3 5-8 7-14 7-10 0-16-6-16-17z',
  'M107 61c5 4 11 6 17 6 4 0 7-2 7-4 0-3-3-4-9-5-11-2-17-6-17-14 0-9 7-14 18-14 7 0 14 2 19 5l-4 8c-4-3-10-4-15-4-4 0-6 1-6 4 0 2 2 3 8 5 11 2 18 5 18 14 0 9-7 14-19 14-8 0-16-2-21-6z',
  'M145 31h13l10 29 9-29h13l-16 45c-4 11-10 15-21 15h-3V81h3c5 0 7-2 9-7z',
  'M194 13h22c20 0 31 12 31 30 0 19-11 31-31 31h-22zm12 11v39h9c13 0 19-7 19-20 0-12-6-19-19-19z',
] as const;

// The two o's lean together. Their squared shoulders and offset counters
// distinguish the compact mark at launcher and notification sizes.
const firstO = 'M271 30c12 0 21 8 21 22s-8 23-21 23c-13 0-21-8-21-22 0-13 8-23 21-23zm1 10c-6 0-10 5-10 13 0 7 3 12 9 12s9-5 9-13c0-7-3-12-8-12z';
const secondO = 'M318 30c13 0 21 9 21 23 0 13-8 22-21 22-12 0-21-8-21-22 0-13 8-23 21-23zm0 10c-6 0-9 5-9 13 0 7 3 12 9 12s10-5 10-12c0-8-4-13-10-13z';

export function BusyDooWordmark({ className = '', motion = 'static' }: {
  className?: string;
  motion?: 'static' | 'cinematic' | 'quick';
}) {
  return <svg className={`busydoo-wordmark ${className}`} data-wordmark-motion={motion}
    viewBox="0 0 345 96" role="img" aria-label={BUSYDOO.name} focusable="false">
    <g fill="currentColor" fillRule="evenodd">
      {lettering.map((path, index) => <path key={path} className={index === 4 ? 'busydoo-letter-d' : 'busydoo-letter-base'} d={path} />)}
      <path className="busydoo-letter-o busydoo-letter-o-first" d={firstO} />
      <path className="busydoo-letter-o busydoo-letter-o-second" d={secondO} />
    </g>
  </svg>;
}

export function LifeOSMark({ className = '' }: { className?: string }) {
  return <svg className={`busydoo-compact-mark ${className}`} viewBox="0 0 108 108"
    aria-hidden="true" focusable="false">
    <g fill="currentColor" fillRule="evenodd" transform="translate(-153.8 17.2) scale(.705)">
      <path d={firstO} /><path d={secondO} />
    </g>
  </svg>;
}

export function LifeOSBrand({ className = '', markClassName = '' }: { className?: string; markClassName?: string }) {
  return <span className={`lifeos-brand ${className}`}>
    <BusyDooWordmark className={markClassName} />
  </span>;
}

export function LifeOSLaunchReveal({ reducedMotion = false, cinematic = true }: { reducedMotion?: boolean; cinematic?: boolean }) {
  return <div className={`lifeos-launch-reveal${reducedMotion ? ' is-reduced-motion' : ''}`}
    role="status" aria-label={`${BUSYDOO.name} is opening`} aria-live="polite">
    <div className="lifeos-launch-lockup" aria-hidden="true">
      <BusyDooWordmark className="lifeos-launch-mark" motion={reducedMotion ? 'static' : cinematic ? 'cinematic' : 'quick'} />
      {cinematic && <p className="lifeos-launch-caption">{BUSYDOO.tagline}</p>}
    </div>
  </div>;
}

export function BusyDooBrandMoment() {
  const [replay, setReplay] = useState(0);
  return <div className="busydoo-brand-moment">
    <div className="busydoo-brand-stage">
      <BusyDooWordmark key={replay} motion={replay ? 'cinematic' : 'static'} />
      <p>{BUSYDOO.tagline}</p>
    </div>
    <button className="feather-secondary" type="button" onClick={() => setReplay(value => value + 1)}>Replay wordmark</button>
  </div>;
}
