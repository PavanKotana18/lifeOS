import { readTranslateX } from './springMotion';

export type RoutePose = { x: number; opacity: number };

export function readRoutePose(element?: HTMLElement | null): RoutePose {
  if (!element) return { x: 0, opacity: 1 };
  const style = getComputedStyle(element);
  return { x: readTranslateX(style.transform), opacity: Number(style.opacity) };
}
