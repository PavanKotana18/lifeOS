import { useId } from 'react';
import { MOTION_PRESET_OPTIONS, type MotionPresetId } from '../services/interfaceMotion';

type Props = {
  value: MotionPresetId;
  onChange: (value: MotionPresetId) => void | Promise<boolean>;
  saving?: boolean;
  error?: string | null;
  reducedMotion?: boolean;
};
const descriptions: Record<MotionPresetId, string> = {
  silky: 'Balanced, gentle movement',
  snappy: 'Quick, responsive movement',
  oil: 'Slower, weighted movement',
};

export default function MotionPreferences({ value, onChange, saving = false, error, reducedMotion = false }: Props) {
  const id = useId();
  return <fieldset className="lifeos-raised space-y-3 rounded-xl p-3" aria-describedby={`${id}-help`} aria-busy={saving}>
    <legend className="px-1 text-sm font-semibold">Interface motion</legend>
    <p id={`${id}-help`} className="text-xs leading-relaxed text-secondary">Choose how navigation and panels move. Your device’s reduced-motion setting always takes priority.</p>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {MOTION_PRESET_OPTIONS.map(preset => <label key={preset.id} className="lifeos-panel flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3">
        <input type="radio" name={`${id}-motion`} value={preset.id} checked={value === preset.id} disabled={saving}
          onChange={() => { void onChange(preset.id); }} className="h-4 w-4 accent-[var(--accent)]" />
        <span><span className="block text-sm font-medium">{preset.label}</span><span className="block text-xs text-secondary">{descriptions[preset.id]}</span></span>
      </label>)}
    </div>
    <p role="status" className="text-xs text-secondary">{saving ? 'Saving motion preference…' : reducedMotion ? 'Reduced motion is active on this device.' : 'Applies to navigation and panels on this device.'}</p>
    {error && <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
  </fieldset>;
}
