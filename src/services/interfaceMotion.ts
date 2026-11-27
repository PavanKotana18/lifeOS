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
export function getMotionCssVariables(value: unknown = 'silky', reducedMotion = false): Record<string, string> {
  const preset = getMotionPreset(value);
  const duration = reducedMotion ? 0 : preset.duration;
  const tabDuration = reducedMotion ? 0 : { silky: 220, snappy: 180, oil: 255 }[preset.id];
  return {
    '--interface-motion-duration': `${duration}ms`,
    '--interface-motion-easing': preset.easing,
    '--motion-tab': `${tabDuration}ms`,
    '--motion-ease-tab': preset.easing,
    '--motion-panel': `${reducedMotion ? 0 : Math.round(duration * 0.75)}ms`,
    '--motion-feedback': `${reducedMotion ? 0 : Math.round(duration * 0.35)}ms`,
  };
}

export const MOTION_PREFERENCE_KEY = 'motionPreset';
export const MOTION_CACHE_KEY = 'lifeos-motion-preset';
export type MotionPreferenceState = Readonly<{ preset: MotionPresetId; saving: boolean; error: string | null }>;
type MotionSettings = {
  get: (key: string, fallback: unknown) => Promise<unknown>;
  set: (key: string, value: MotionPresetId) => Promise<unknown>;
};
type MotionCache = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };

/** Cosmetic preference only. Pending storage reads never overwrite a newer choice. */
export function createMotionPreferenceController(settings: MotionSettings, cache?: MotionCache, timeoutMs = 1500) {
  let cached: unknown;
  try { cached = cache?.getItem(MOTION_CACHE_KEY); } catch { /* Optional cache. */ }
  let state: MotionPreferenceState = { preset: normalizeMotionPreset(cached), saving: false, error: null };
  let revision = 0;
  let pending = 0;
  let queue = Promise.resolve();
  let hydration: Promise<void> | undefined;
  const listeners = new Set<(state: MotionPreferenceState) => void>();
  const emit = (patch: Partial<MotionPreferenceState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener(state));
  };
  const cachePreset = (preset: MotionPresetId) => { try { cache?.setItem(MOTION_CACHE_KEY, preset); } catch { /* Database remains authoritative. */ } };
  return {
    getSnapshot: () => state,
    subscribe(listener: (state: MotionPreferenceState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load(): Promise<void> {
      if (hydration) return hydration;
      const startedAt = revision;
      hydration = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = Symbol('timeout');
        try {
          const result = await Promise.race([
            Promise.resolve().then(() => settings.get(MOTION_PREFERENCE_KEY, null)),
            new Promise<typeof timeout>(resolve => { timer = setTimeout(() => resolve(timeout), Math.max(1, Math.min(5000, Number.isFinite(timeoutMs) ? timeoutMs : 1500))); }),
          ]);
          if (result !== timeout && revision === startedAt) {
            const preset = normalizeMotionPreset(result);
            cachePreset(preset);
            emit({ preset });
          }
        } catch { /* Keep safe cached appearance when IndexedDB is unavailable. */ }
        finally { if (timer !== undefined) clearTimeout(timer); }
      })();
      return hydration;
    },
    adoptStored(value: unknown) {
      revision++;
      const preset = normalizeMotionPreset(value);
      cachePreset(preset);
      emit({ preset, error: null });
    },
    async setPreset(value: MotionPresetId): Promise<boolean> {
      if (value !== 'silky' && value !== 'snappy' && value !== 'oil') {
        emit({ error: 'Choose Silky, Snappy or Oil.' });
        return false;
      }
      revision++;
      pending++;
      emit({ saving: true, error: null });
      let succeeded = false;
      const operation = queue.then(async () => {
        try {
          await settings.set(MOTION_PREFERENCE_KEY, value);
          cachePreset(value);
          succeeded = true;
          emit({ preset: value, error: null });
        } catch { emit({ error: 'Could not save motion preference. Try again.' }); }
        finally { pending--; emit({ saving: pending > 0 }); }
      });
      queue = operation.catch(() => {});
      await operation;
      return succeeded;
    },
  };
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
