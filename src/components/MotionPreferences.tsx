import { useEffect, useId, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { getMotionPreset, MOTION_PRESET_OPTIONS, type MotionPresetId } from '../services/interfaceMotion';
import { ProfileButton, ProfileGroup } from './ProfileSettings';

const descriptions: Record<MotionPresetId, string> = {
  silky: 'Balanced movement with gentle settling',
  snappy: 'A quicker response with a shorter settle',
  oil: 'Slower, more weighted movement',
};

export default function MotionPreferences({ value, onChange, saving = false, error, reducedMotion = false, active = true }: {
  value: MotionPresetId; onChange: (value: MotionPresetId) => void | Promise<boolean>;
  saving?: boolean; error?: string | null; reducedMotion?: boolean; active?: boolean;
}) {
  const id = useId();
  const demo = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const [previewed, setPreviewed] = useState<MotionPresetId>();
  const stop = () => { animations.current.forEach(animation => animation.cancel()); animations.current = []; };
  useEffect(() => stop, [active, reducedMotion]);
  const play = (preset: MotionPresetId) => {
    stop();
    setPreviewed(preset);
    if (!active || !demo.current || reducedMotion) return;
    const { duration, easing } = getMotionPreset(preset);
    const starting = ['translateX(28%)', 'translateY(8px) scale(.96)', 'translateY(100%)'];
    animations.current = [...demo.current.children].flatMap((element, index) => element.animate ? [
      element.animate([{ transform: starting[index], opacity: .35 }, { transform: 'none', opacity: 1 }],
        { duration: Math.round(duration * [1, .6, .75][index]), delay: index * 65, easing, fill: 'backwards' })
    ] : []);
  };
  return <>
    <ProfileGroup title="Try the movement" variant="feature" topic="Motion and reduced motion" description="Preview a page, a card and a sheet together.">
      <div ref={demo} className="profile-motion-preview" aria-hidden="true">
        <header>Today</header><div className="motion-demo-card">Weekly plan</div><div className="motion-demo-sheet">Task options</div>
      </div>
      <p aria-live="polite" className="profile-description">{reducedMotion ? 'Reduced motion is active. Previews show the settled layout.' :
        previewed ? getMotionPreset(previewed).label + ' preview' : 'Choose Preview beside a preset.'}</p>
    </ProfileGroup>
    <ProfileGroup title="Motion preset" variant="plain" description="Your selection saves immediately.">
      <div className="profile-motion-grid" role="radiogroup" aria-label="Interface motion" aria-busy={saving}>
        {MOTION_PRESET_OPTIONS.map(preset => <div key={preset.id} className="profile-motion-card" data-selected={value === preset.id || undefined}>
          <label className="profile-motion-select">
            <input type="radio" name={id} value={preset.id} checked={value === preset.id} disabled={saving}
              onChange={() => void onChange(preset.id)} aria-label={preset.label} />
            <span><strong>{preset.label}</strong><small>{descriptions[preset.id]}</small></span>
          </label>
          <div className="profile-actions"><ProfileButton aria-label={'Preview ' + preset.label} onClick={() => play(preset.id)}>
            <Play size={16} aria-hidden="true" />Preview
          </ProfileButton></div>
        </div>)}
      </div>
      {saving && <p role="status" className="profile-description">Saving motion preference…</p>}
      {error && <p role="alert" className="profile-error">{error}</p>}
    </ProfileGroup>
  </>;
}
