import { getMotionPreset, type MotionPresetId } from './interfaceMotion';

export type SpringSettle = {
  keyframes: Array<{ offset: number; transform: string }>;
  duration: number;
};

const finite = (value: number): number => Number.isFinite(value) ? value : 0;
const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));
const transformFor = (value: number): string => `translateX(${Math.abs(value) < 0.0005 ? 0 : Number(value.toFixed(3))}px)`;

/**
 * Analytic underdamped spring, sampled for Web Animations with linear easing.
 * It is reserved for releasing a cancelled drag, not for deciding navigation.
 * The caller is responsible for honoring prefers-reduced-motion.
 */
export function buildSpringSettle(startOffsetPx: number, initialVelocityPxPerSecond = 0, presetId: MotionPresetId = 'silky'): SpringSettle {
  const start = clamp(finite(startOffsetPx), 640);
  if (Math.abs(start) < 0.001) {
    return { duration: 0, keyframes: [{ offset: 0, transform: 'translateX(0px)' }, { offset: 1, transform: 'translateX(0px)' }] };
  }
  const spring = offsetSpring(start, initialVelocityPxPerSecond, presetId);
  return { duration: spring.duration, keyframes: spring.values.map((value, index) => ({
    offset: index / 30, transform: transformFor(value),
  })) };
}

function offsetSpring(start: number, initialVelocity: number, presetId: MotionPresetId) {
  const preset = getMotionPreset(presetId);
  const velocity = clamp(finite(initialVelocity), Math.min(preset.velocityLimit, Math.abs(start) * 10));
  const duration = preset.duration;
  const decay = preset.dampingRatio * preset.frequency;
  const damped = preset.frequency * Math.sqrt(1 - preset.dampingRatio ** 2);
  const term = (velocity + decay * start) / damped;
  const values = Array.from({ length: 31 }, (_, index) => {
    const time = index / 30 * duration / 1000;
    const position = Math.exp(-decay * time) * (start * Math.cos(damped * time) + term * Math.sin(damped * time));
    return index === 30 ? 0 : clamp(position, Math.abs(start) * 1.15);
  });
  return { duration, values };
}

export function buildCardSpring(x: number, y: number, vx: number, vy: number, preset: MotionPresetId, scale: number) {
  const horizontal = offsetSpring(x, vx, preset);
  const vertical = offsetSpring(y, vy, preset);
  const lift = offsetSpring(scale - 1, 0, preset);
  const samples = horizontal.values.map((left, index) => ({ x: left, y: vertical.values[index] }));
  return {
    duration: horizontal.duration,
    samples,
    frames: samples.map((sample, index) => ({
      transform: `translate3d(${sample.x}px, ${sample.y}px, 0) scale(${1 + lift.values[index]})`,
    })),
  };
}

/** Read only the horizontal translation from a computed CSS transform. */
export function readTranslateX(transform: string): number {
  if (typeof transform !== 'string' || transform.trim() === '' || transform.trim() === 'none') return 0;
  const input = transform.trim();
  const matrix = /^matrix(3d)?\(([^)]+)\)$/i.exec(input);
  if (matrix) {
    const values = matrix[2].split(',').map(value => Number(value.trim()));
    const expectedLength = matrix[1] ? 16 : 6;
    if (values.length !== expectedLength || values.some(value => !Number.isFinite(value))) return 0;
    return finite(values[matrix[1] ? 12 : 4]);
  }
  const decimal = '([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?)';
  const translate = new RegExp(`^translateX\\(\\s*${decimal}px\\s*\\)$`, 'i').exec(input);
  if (translate) return finite(Number(translate[1]));
  const translate3d = /^translate3d\(([^)]+)\)$/i.exec(input);
  if (!translate3d) return 0;
  const lengths = translate3d[1].split(',').map(value => value.trim());
  const pixels = new RegExp(`^${decimal}px$`, 'i');
  if (lengths.length !== 3 || lengths.some(value => value !== '0' && !pixels.test(value))) return 0;
  const values = lengths.map(value => parseFloat(value));
  return values.every(Number.isFinite) ? values[0] : 0;
}
