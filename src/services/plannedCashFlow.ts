import type { PlannedCommitment } from '../types';
import { advanceCommitmentDate } from './commitmentRecurrence';
import { getCurrencyMetadata } from './financeCore';
import { validatePlannedCommitment } from './financialAccounting';

export const PLANNED_CASH_FLOW_LIMITS = Object.freeze({ plans: 200, stepsPerPlan: 1000, totalSteps: 10000 });

export interface PlannedCashFlowRow {
  planId: string;
  title: string;
  type: 'income' | 'expense';
  dates: string[];
  occurrenceCount: number;
  totalMinor: bigint;
}

export interface PlannedCashFlowPreview {
  month: string;
  currencyCode: string;
  valid: boolean;
  error?: string;
  rows: PlannedCashFlowRow[];
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  occurrenceCount: number;
  excludedCurrencyCount: number;
  invalidPlanCount: number;
  truncatedPlanCount: number;
  unexaminedPlanCount: number;
  incomplete: boolean;
}

/**
 * Expand unrecorded active plans into a bounded calendar-month preview.
 * This is a read-only estimate: it never posts, catches up or mutates a plan.
 * All amounts and sums remain integer minor units in one explicit currency.
 */
export function buildPlannedCashFlow(
  commitments: readonly PlannedCommitment[],
  month: string,
  currencyCode: string,
): PlannedCashFlowPreview {
  const result: PlannedCashFlowPreview = {
    month, currencyCode, valid: true, rows: [], incomeMinor: 0n, expenseMinor: 0n,
    netMinor: 0n, occurrenceCount: 0, excludedCurrencyCount: 0,
    invalidPlanCount: 0, truncatedPlanCount: 0, unexaminedPlanCount: 0, incomplete: false,
  };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 100) {
    return { ...result, valid: false, incomplete: true, error: 'Choose a valid calendar month to preview planned cash flow.' };
  }
  try {
    if (getCurrencyMetadata(currencyCode).code !== currencyCode) throw new Error('Non-canonical currency');
  } catch {
    return { ...result, valid: false, incomplete: true, error: 'Choose a supported currency to preview planned cash flow.' };
  }

  const firstDay = `${month}-01`;
  // All recurrence dates are validated; a lexical upper bound also covers
  // February and shorter months without local/UTC timezone conversions.
  const lastDayBound = `${month}-31`;
  let totalSteps = 0;
  for (let index = 0; index < commitments.length; index++) {
    if (index >= PLANNED_CASH_FLOW_LIMITS.plans || totalSteps >= PLANNED_CASH_FLOW_LIMITS.totalSteps) {
      result.unexaminedPlanCount = commitments.length - index;
      break;
    }
    const plan = commitments[index];
    if (plan.status === 'paused' || plan.status === 'recorded') continue;
    try {
      validatePlannedCommitment(plan);
      let due = plan.nextDueDate;
      const anchor = plan.recurrenceAnchorDate || due;
      const dates: string[] = [];
      let steps = 0;
      while (due <= lastDayBound) {
        if (steps >= PLANNED_CASH_FLOW_LIMITS.stepsPerPlan || totalSteps >= PLANNED_CASH_FLOW_LIMITS.totalSteps) {
          result.truncatedPlanCount++;
          break;
        }
        steps++;
        totalSteps++;
        if (due >= firstDay) dates.push(due);
        // Monthly/yearly plans occur at most once in this selected month.
        if (plan.frequency === 'once' || (due >= firstDay && plan.frequency !== 'weekly')) break;
        // There can be no representable weekly occurrence after this date.
        if (due.startsWith('9999-12-') && Number(due.slice(-2)) + 7 > 31) break;
        const next = advanceCommitmentDate(due, plan.frequency, anchor);
        if (next <= due) throw new Error('Plan recurrence did not advance.');
        due = next;
      }
      if (!dates.length) continue;
      if (plan.currencyCode !== currencyCode) {
        result.excludedCurrencyCount++;
        continue;
      }
      const totalMinor = BigInt(plan.amountMinor) * BigInt(dates.length);
      const type = plan.type || 'expense';
      result.rows.push({ planId: plan.id, title: plan.title, type, dates, occurrenceCount: dates.length, totalMinor });
      result.occurrenceCount += dates.length;
      if (type === 'income') result.incomeMinor += totalMinor;
      else result.expenseMinor += totalMinor;
    } catch {
      result.invalidPlanCount++;
    }
  }
  result.rows.sort((a, b) => a.dates[0].localeCompare(b.dates[0]) || a.title.localeCompare(b.title));
  result.netMinor = result.incomeMinor - result.expenseMinor;
  result.incomplete = result.invalidPlanCount > 0 || result.truncatedPlanCount > 0 || result.unexaminedPlanCount > 0;
  return result;
}
