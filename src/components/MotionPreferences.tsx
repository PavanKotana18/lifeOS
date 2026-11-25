import { useEffect, useId, useRef } from 'react';
import { Check, Play } from 'lucide-react';
import { animateRoute } from '../services/aliveMotion';
import { MOTION_PRESET_OPTIONS, type MotionPresetId } from '../services/interfaceMotion';

type Props = {
  value: MotionPresetId;
  onChange: (value: MotionPresetId) => void | Promise<boolean>;
  saving?: boolean;
  error?: string | null;
  reducedMotion?: boolean;
  active?: boolean;
};
const descriptions: Record<MotionPresetId, string> = {
  silky: 'Balanced, gentle movement',
  snappy: 'Quick, responsive movement',
  oil: 'Slower, weighted movement',
};

export default function MotionPreferences({ value, onChange, saving = false, error, reducedMotion = false, active = true }: Props) {
  const id = useId();
  const preview = useRef<{ track: HTMLElement; animation?: ReturnType<typeof animateRoute> } | null>(null);
  const reset = () => {
    const current = preview.current;
    preview.current = null;
    current?.animation?.cancel();
    current?.track.removeAttribute('data-demo-at-end');
  };
  useEffect(() => reset, [active, reducedMotion]);
  const play = (control: HTMLElement, preset: MotionPresetId) => {
    reset();
    const track = control.closest('.motion-studio-card')?.querySelector<HTMLElement>('[data-motion-demo]');
    const piece = track?.querySelector<HTMLElement>('.motion-demo-piece');
    if (!active || !track || !piece) return;
    const current: NonNullable<typeof preview.current> = { track };
    preview.current = current;
    const distance = Math.max(0, track.clientWidth - piece.offsetWidth - 2 * piece.offsetLeft);
    const settle = () => {
      if (preview.current !== current) return;
      track.dataset.demoAtEnd = 'true';
      current.animation?.cancel();
      current.animation = undefined;
    };
    if (reducedMotion || !distance) { settle(); return; }
    try {
      current.animation = animateRoute(piece, { x: 0, opacity: 1 }, { x: distance, opacity: 1 }, preset);
      void Promise.resolve(current.animation).then(settle, settle);
    } catch { settle(); }
  };
  return <fieldset className="appearance-studio motion-studio" aria-busy={saving}>
    <legend className="sr-only">Interface motion</legend>
    <div className="motion-studio-grid">
      {MOTION_PRESET_OPTIONS.map(preset => <div key={preset.id} className="motion-studio-card appearance-choice" data-selected={value === preset.id}>
        <label className="motion-studio-select">
          <input type="radio" name={`${id}-motion`} value={preset.id} checked={value === preset.id} disabled={saving}
            onChange={() => { void onChange(preset.id); }} aria-label={preset.label} aria-describedby={`${id}-${preset.id}`} />
          <span><strong>{preset.label}</strong><small id={`${id}-${preset.id}`}>{descriptions[preset.id]}</small></span>
          <Check size={16} aria-hidden="true" />
        </label>
        <div className="motion-studio-demo">
          <div className="motion-demo-track" data-motion-demo={preset.id} aria-hidden="true"><span className="motion-demo-piece" /></div>
          <button type="button" className="motion-preview-button" aria-label={'Preview ' + preset.label} onClick={event => play(event.currentTarget, preset.id)}>
            <Play size={14} aria-hidden="true" />Preview
          </button>
        </div>
      </div>)}
    </div>
    <p role="status" className="text-sm text-secondary" hidden={!saving && !reducedMotion}>{saving ? 'Saving motion preference…' : 'Reduced motion is active on this device.'}</p>
    {error && <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
  </fieldset>;
}
