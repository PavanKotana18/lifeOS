export interface BudgetDisplayStatus {
  percentUsed: number | null;
  barPercent: number;
  remaining: number;
  overBy: number;
  isOver: boolean;
}

export interface ExactBudgetDisplayStatus {
  percentUsed: number | null;
  barPercent: number;
  isOver: boolean;
  remainingMinor: bigint;
  overByMinor: bigint;
}

/** Exact posted-spend comparison; undefined spend means category data is unavailable. */
export function getExactBudgetDisplayStatus(spentMinor: bigint | undefined, allocatedMinor: bigint): ExactBudgetDisplayStatus {
  if (spentMinor === undefined || spentMinor < 0n || allocatedMinor < 0n || allocatedMinor === 0n) {
    return { percentUsed: null, barPercent: 0, isOver: false, remainingMinor: 0n, overByMinor: 0n };
  }
  const tenths = (spentMinor * 1000n + allocatedMinor / 2n) / allocatedMinor;
  const percentUsed = Number(tenths) / 10;
  const remainingMinor = spentMinor < allocatedMinor ? allocatedMinor - spentMinor : 0n;
  const overByMinor = spentMinor > allocatedMinor ? spentMinor - allocatedMinor : 0n;
  return {
    percentUsed,
    barPercent: Math.min(100, Math.max(0, percentUsed)),
    isOver: spentMinor > allocatedMinor,
    remainingMinor,
    overByMinor,
  };
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
