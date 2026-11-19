import type { Budget, Transaction } from '../types';
import { decimalToMinorUnits } from './financeCore';

/** Add only the preceding month?s unused base limit for the same category and currency. */
export function budgetCarryoverMinor(budget: Budget, budgets: Budget[], transactions: Transaction[], categories: { id: string; name: string }[], currency: string): bigint {
  if (!budget.carryover || !/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.monthYear)) return 0n;
  const [year, month] = budget.monthYear.split('-').map(Number);
  const previousKey = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
  const previous = budgets.find(row => row.monthYear === previousKey && row.categoryId === budget.categoryId && (row.currencyCode || currency) === currency);
  const category = categories.find(item => item.id === budget.categoryId);
  if (!previous || (budget.categoryId && !category)) return 0n;
  const limit = previous.amountMinor && previous.currencyCode === currency ? BigInt(previous.amountMinor) : decimalToMinorUnits(String(previous.monthlyAmount), currency);
  const spent = transactions.filter(row => row.type === 'expense' && row.date.startsWith(previousKey) && (row.currencyCode || currency) === currency && (!category || row.category === category.name))
    .reduce((total, row) => total + (row.amountMinor !== undefined && row.currencyCode === currency ? BigInt(row.amountMinor) : decimalToMinorUnits(String(row.amount), currency)), 0n);
  return spent < limit ? limit - spent : 0n;
}

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
