export const PRIMARY_NAVIGATION = Object.freeze([
  { tab: 'dashboard', label: 'Today', icon: 'home' },
  { tab: 'finance', label: 'Money', icon: 'wallet' },
  { tab: 'plan', label: 'Plan', icon: 'calendar' },
  { tab: 'life', label: 'Life', icon: 'life' },
] as const);

export const MODULE_CATALOG = Object.freeze([
  { tab: 'habits', title: 'Habits', description: 'Routines, check-ins and consistency over time.', countKey: 'habits' },
  { tab: 'goals', title: 'Goals', description: 'Milestones and personal progress.', countKey: 'goals' },
  { tab: 'planner', title: 'Tasks and planning', description: 'Your agenda, deadlines and reminders.', countKey: 'openTasks' },
  { tab: 'settings', title: 'Profile and settings', description: 'Appearance, privacy, notifications and backups.', countKey: null },
] as const);

export type PrimaryTab = typeof PRIMARY_NAVIGATION[number]['tab'];
export type ModuleTab = typeof MODULE_CATALOG[number]['tab'];
export type MainTab = PrimaryTab | ModuleTab | 'insights';

export function primaryDestinationForTab(tab: MainTab): PrimaryTab | null {
  if (tab === 'dashboard' || tab === 'finance' || tab === 'plan' || tab === 'life') return tab;
  if (tab === 'planner') return 'plan';
  if (tab === 'habits' || tab === 'goals' || tab === 'insights') return 'life';
  return null;
}
