import type { MainTab } from './navigationCatalog';

export type ScreenLocation = {
  tab: MainTab;
  financeSubtab?: string;
  profileSection?: string;
  goalsSubtab?: string;
  habitsSubtab?: string;
};

export type RetainedScreenTransition = 'prepare' | 'running' | null;

export function retainedScreenTransitionState(
  active: boolean,
  phase: RetainedScreenTransition,
): 'enter-prepare' | 'entering' | 'active' | 'inactive' {
  if (!active) return 'inactive';
  return phase === 'prepare' ? 'enter-prepare' : phase === 'running' ? 'entering' : 'active';
}

/** Keep scroll memory distinct for nested destinations that share a primary tab. */
export function screenScrollKey(location: ScreenLocation): string {
  if (location.tab === 'finance') return `finance:${location.financeSubtab || 'overview'}`;
  if (location.tab === 'settings') return `settings:${location.profileSection || 'home'}`;
  if (location.tab === 'goals') return `goals:${location.goalsSubtab || 'active'}`;
  if (location.tab === 'habits') return `habits:${location.habitsSubtab || 'checklist'}`;
  return location.tab;
}

export function readMotionDuration(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
