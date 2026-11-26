import { animate } from 'motion';
import { getMotionPreset, type MotionPresetId } from './interfaceMotion';
import { buildSpringSettle, readTranslateX } from './springMotion';

export type RoutePose = { x: number; opacity: number };

export const routeSprings = {
  silky: { duration: .30, bounce: .06 },
  snappy: { duration: .24, bounce: .02 },
  oil: { duration: .35, bounce: 0 },
} as const;

export function readRoutePose(element?: HTMLElement | null): RoutePose {
  if (!element) return { x: 0, opacity: 1 };
  const style = getComputedStyle(element);
  return { x: readTranslateX(style.transform), opacity: Number(style.opacity) };
}

/** One animator per mounted surface. Gesture handoffs cancel the prior owner first. */
export function animateRoute(element: HTMLElement, from: RoutePose, to: RoutePose, preset: MotionPresetId, velocity = 0) {
  const translation = (value: number) => `translate3d(${value}px, 0, 0)`;
  const spring = routeSprings[preset];
  const physics = velocity && to.x === 0 ? buildSpringSettle(from.x, velocity, preset) : null;
  return animate(element, {
    transform: physics ? physics.keyframes.map(frame => frame.transform) : [translation(from.x), translation(to.x)],
    opacity: [from.opacity, to.opacity],
  }, {
    transform: physics ? { duration: getMotionPreset(preset).duration / 1000, ease: 'linear' } : { type: 'spring', ...spring },
    opacity: { duration: spring.duration * .82, ease: [.25, .55, .2, 1] },
  });
}
