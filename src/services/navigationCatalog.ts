export const PRIMARY_NAVIGATION = Object.freeze([
  { tab: 'dashboard', label: 'Today', icon: 'home' },
  { tab: 'explore', label: 'Explore', icon: 'compass' },
  { tab: 'plan', label: 'Plan', icon: 'calendar' },
  { tab: 'insights', label: 'Insights', icon: 'insights' },
] as const);

export const MODULE_CATALOG = Object.freeze([
  { tab: 'finance', title: 'Money', description: 'Transactions, budgets, savings and planning.', countKey: 'transactions' },
  { tab: 'habits', title: 'Habits', description: 'Routines, check-ins and consistency over time.', countKey: 'habits' },
  { tab: 'goals', title: 'Goals', description: 'Milestones and personal progress.', countKey: 'goals' },
  { tab: 'planner', title: 'Tasks and planning', description: 'Your agenda, deadlines and reminders.', countKey: 'openTasks' },
  { tab: 'settings', title: 'Profile and settings', description: 'Appearance, privacy, notifications and backups.', countKey: null },
] as const);

export type PrimaryTab = typeof PRIMARY_NAVIGATION[number]['tab'];
export type ModuleTab = typeof MODULE_CATALOG[number]['tab'];
export type MainTab = PrimaryTab | ModuleTab;
