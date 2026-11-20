import type { MotionPresetId } from './interfaceMotion';
import type { RoutePose } from './aliveMotion';

const timing = {
  silky: { ms: 330, frequency: 5.2 },
  snappy: { ms: 260, frequency: 6.1 },
  oil: { ms: 360, frequency: 4.8 },
} as const;

const decay = (progress: number, frequency: number) => 1 - (1 + progress * frequency) * Math.exp(-progress * frequency);

// Sample one critically damped spring. All participants use the same rate of travel.
const profiles = Object.fromEntries(Object.entries(timing).map(([preset, { ms, frequency }]) => [
  preset, {
    ms,
    easing: 'linear(' + Array.from({ length: 25 }, (_, index) =>
      (decay(index / 24, frequency) / decay(1, frequency)).toFixed(5),
    ).join(',') + ')',
  },
])) as Record<MotionPresetId, { ms: number; easing: string }>;

type Surface = { element: HTMLElement; from: RoutePose; to: RoutePose; unit?: 'px' | '%' };

export function playPrimaryTransition(surfaces: Surface[], preset: MotionPresetId): Animation[] {
  const { ms, easing } = profiles[preset];
  if (surfaces.some(({ element }) => typeof element.animate !== 'function')) return [];
  const supportedEasing = CSS.supports('animation-timing-function', easing) ? easing : 'cubic-bezier(.22,.7,.22,1)';
  const animations = surfaces.map(({ element, from, to, unit = 'px' }) => {
    const frames = [from, to].map(pose => ({
      transform: `translate3d(${pose.x}${unit},0,0)`,
      opacity: pose.opacity,
    }));
    return element.animate(frames, { duration: ms, easing: supportedEasing, fill: 'both' });
  });
  // Set the start after creating all effects. The compositor can advance them together.
  const start = document.timeline.currentTime;
  if (start != null) for (const animation of animations) animation.startTime = start;
  return animations;
}
