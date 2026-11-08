import { PRIMARY_NAVIGATION, primaryDestinationForTab, type MainTab, type PrimaryTab } from './navigationCatalog';

export interface SwipeGestureSample {
  deltaX: number;
  deltaY: number;
  durationMs: number;
  startedOnInteractive: boolean;
  startedAtSystemEdge: boolean;
  startedInHorizontalControl: boolean;
  enabled: boolean;
}

/** Pure gesture gate. It never wraps and only targets the existing primary nav state. */
export function resolvePrimarySwipe(currentTab: MainTab, sample: SwipeGestureSample): PrimaryTab | null {
  if (!sample.enabled || sample.startedOnInteractive || sample.startedAtSystemEdge || sample.startedInHorizontalControl) return null;
  const x = sample.deltaX;
  const y = sample.deltaY;
  const distance = Math.abs(x);
  const vertical = Math.abs(y);
  const duration = Math.max(1, sample.durationMs);
  const fastSwipe = distance >= 36 && distance / duration >= 0.55;
  if (vertical > 64 || distance < (fastSwipe ? 36 : 68) || distance < vertical * 1.45) return null;

  const current = primaryDestinationForTab(currentTab);
  if (!current) return null;
  const index = PRIMARY_NAVIGATION.findIndex(item => item.tab === current);
  const targetIndex = index + (x < 0 ? 1 : -1);
  return PRIMARY_NAVIGATION[targetIndex]?.tab || null;
}
