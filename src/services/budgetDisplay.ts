export interface BudgetDisplayStatus {
  percentUsed: number | null;
  barPercent: number;
  remaining: number;
  overBy: number;
  isOver: boolean;
}

/** Display-only budget context. The remainder is a plan amount, never a cash balance. */
export function getBudgetDisplayStatus(spent: number, allocation: number): BudgetDisplayStatus {
  if (!Number.isFinite(spent) || !Number.isFinite(allocation) || spent < 0 || allocation < 0) {
    return { percentUsed: null, barPercent: 0, remaining: 0, overBy: 0, isOver: false };
  }
  if (allocation === 0) {
    return { percentUsed: null, barPercent: 0, remaining: 0, overBy: 0, isOver: false };
  }
  const percentUsed = Math.round((spent / allocation) * 1000) / 10;
  return {
    percentUsed,
    barPercent: Math.min(100, Math.max(0, percentUsed)),
    remaining: Math.max(0, allocation - spent),
    overBy: Math.max(0, spent - allocation),
    isOver: spent > allocation,
  };
}
