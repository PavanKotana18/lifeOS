export type MotionPresetId = 'silky' | 'snappy' | 'oil';
export type MotionSample = { x: number; time: number };

export type MotionPreset = Readonly<{
  id: MotionPresetId;
  label: string;
  duration: number;
  frequency: number;
  dampingRatio: number;
  resistance: number;
  velocityLimit: number;
  easing: string;
}>;

const presets: Record<MotionPresetId, MotionPreset> = {
  silky: { id: 'silky', label: 'Silky', duration: 480, frequency: 28, dampingRatio: 0.8, resistance: 0.72, velocityLimit: 2400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  snappy: { id: 'snappy', label: 'Snappy', duration: 340, frequency: 40, dampingRatio: 0.82, resistance: 0.85, velocityLimit: 2600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  oil: { id: 'oil', label: 'Oil', duration: 500, frequency: 27, dampingRatio: 0.88, resistance: 0.56, velocityLimit: 1800, easing: 'cubic-bezier(0.22, 0.7, 0.25, 1)' },
};
Object.values(presets).forEach(Object.freeze);
Object.freeze(presets);

export const MOTION_PRESET_OPTIONS: ReadonlyArray<MotionPreset> = Object.freeze(Object.values(presets));
export function normalizeMotionPreset(value: unknown): MotionPresetId {
  return value === 'snappy' || value === 'oil' ? value : 'silky';
}
export function getMotionPreset(value: unknown = 'silky'): MotionPreset {
  return presets[normalizeMotionPreset(value)];
}
export function getMotionCssVariables(value: unknown = 'silky'): Record<string, string> {
  const preset = getMotionPreset(value);
  return { '--interface-motion-duration': `${preset.duration}ms`, '--interface-motion-easing': preset.easing };
}

const finite = (value: number): number => Number.isFinite(value) ? value : 0;
const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));

/** Smooth, odd rubber-band response: no jump at zero, finite asymptote. */
export function resistDrag(distancePx: number, viewportWidthPx: number, value: unknown = 'silky'): number {
  const distance = finite(distancePx);
  const width = Number.isFinite(viewportWidthPx) && viewportWidthPx > 0 ? viewportWidthPx : 320;
  const limit = Math.max(48, Math.min(640, width * 0.38));
  return limit * Math.tanh(clamp(distance, 1e7) * getMotionPreset(value).resistance / limit);
}

/** Recent pointer samples in monotonic milliseconds; output is pixels/second. */
export function estimateDragVelocity(samples: ReadonlyArray<MotionSample>, value: unknown = 'silky'): number {
  // Ignore malformed or out-of-order samples rather than inventing elapsed time.
  const valid: MotionSample[] = [];
  for (const sample of samples.slice(-32)) {
    if (!sample || !Number.isFinite(sample.x) || !Number.isFinite(sample.time)) continue;
    if (valid.length && sample.time <= valid[valid.length - 1].time) continue;
    valid.push(sample);
  }
  if (valid.length < 2) return 0;
  const last = valid[valid.length - 1];
  const recent = valid.filter(sample => last.time - sample.time <= 100);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const seconds = (last.time - first.time) / 1000;
  if (seconds < 0.008) return 0;
  return clamp((last.x - first.x) / seconds, getMotionPreset(value).velocityLimit);
}

/** Entry-only motion; caller owns cancellation and reduced-motion detection. */
export function buildInterfaceTransition(direction: 1 | -1, value: unknown = 'silky', reducedMotion = false): {
  keyframes: Array<{ offset: number; transform: string; opacity: number }>;
  duration: number;
  easing: string;
} {
  const preset = getMotionPreset(value);
  const shift = reducedMotion ? 0 : (direction === -1 ? -1 : 1) * 20;
  return {
    keyframes: [
      { offset: 0, transform: `translateX(${shift}px)`, opacity: reducedMotion ? 1 : 0.94 },
      { offset: 1, transform: 'translateX(0px)', opacity: 1 },
    ],
    duration: reducedMotion ? 0 : preset.duration,
    easing: preset.easing,
  };
}
