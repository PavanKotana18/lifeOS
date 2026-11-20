import { animate } from 'motion';
import type { MotionPresetId } from './interfaceMotion';

export type RoutePose = { x: number; opacity: number };

const springs = {
  silky: { duration: .32, bounce: .08 },
  snappy: { duration: .25, bounce: .04 },
  oil: { duration: .35, bounce: 0 },
} as const;

/** A single transform owner for each retained route during programmatic navigation. */
export function animateRoute(element: HTMLElement, from: RoutePose, to: RoutePose, preset: MotionPresetId) {
  const translation = (value: number) => `translate3d(${value}px, 0, 0)`;
  return animate(element, {
    transform: [translation(from.x), translation(to.x)],
    opacity: [from.opacity, to.opacity],
  }, {
    transform: { type: 'spring', ...springs[preset] },
    opacity: { duration: springs[preset].duration * .82, ease: [.25, .55, .2, 1] },
  });
}
