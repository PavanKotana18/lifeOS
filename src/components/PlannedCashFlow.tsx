import { useMemo } from 'react';
import type { PlannedCommitment } from '../types';
import { formatMinorUnits } from '../services/financeCore';
import { buildPlannedCashFlow } from '../services/plannedCashFlow';
import InfoTip from './InfoTip';

type Props = { commitments: PlannedCommitment[]; month: string; currencyCode: string; locale?: string };

export default function PlannedCashFlow({ commitments, month, currencyCode, locale }: Props) {
  const preview = useMemo(() => buildPlannedCashFlow(commitments, month, currencyCode), [commitments, month, currencyCode]);
  const money = (amount: bigint) => formatMinorUnits(amount, currencyCode, locale);
  return <section className="lifeos-panel rounded-2xl border p-4 sm:p-5" aria-labelledby="planned-cash-flow-title">
    <header className="flex items-center gap-2"><h3 id="planned-cash-flow-title" className="type-section-title">Expected cash flow</h3><InfoTip label="Expected cash flow">This estimate includes active commitments in the selected month. Paused plans are excluded. Cash flow changes only after you record an occurrence.</InfoTip></header>
    {!preview.valid ? <p role="status" className="mt-3 text-sm text-secondary">{preview.error}</p> : <>
      {preview.incomplete && <div role="status" className="lifeos-raised mt-3 rounded-xl p-3 text-sm">
        <strong>Preview incomplete.</strong> Totals below include only evaluable occurrences. {preview.invalidPlanCount > 0 && <span>{preview.invalidPlanCount} invalid plan{preview.invalidPlanCount === 1 ? '' : 's'} could not be included. </span>}
        {(preview.truncatedPlanCount > 0 || preview.unexaminedPlanCount > 0) && <span>A calculation limit was reached; review old or numerous plans before relying on this preview.</span>}
      </div>}
      <dl className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Planned totals">
        <div className="lifeos-raised rounded-xl p-3"><dt className="text-xs text-secondary">Expected income</dt><dd className="mt-1 font-semibold tabular-nums">{money(preview.incomeMinor)}</dd></div>
        <div className="lifeos-raised rounded-xl p-3"><dt className="text-xs text-secondary">Expected expenses</dt><dd className="mt-1 font-semibold tabular-nums">{money(preview.expenseMinor)}</dd></div>
        <div className="lifeos-raised rounded-xl p-3"><dt className="text-xs text-secondary">Expected net cash flow</dt><dd className="mt-1 font-semibold tabular-nums">{money(preview.netMinor)}</dd></div>
      </dl>
      {preview.excludedCurrencyCount > 0 && <p role="status" className="mt-3 text-xs text-secondary">{preview.excludedCurrencyCount} active plan{preview.excludedCurrencyCount === 1 ? '' : 's'} with occurrences in another currency {preview.excludedCurrencyCount === 1 ? 'is' : 'are'} excluded. No exchange rate has been assumed.</p>}
      {preview.rows.length > 0 ? <details className="mt-2"><summary className="min-h-11 content-center cursor-pointer text-sm font-semibold">Expected occurrences</summary><div role="region" aria-label="Planned occurrence details" tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-left text-xs"><caption className="mb-2 text-left text-secondary">Expected occurrences for {month}, {currencyCode}. Amounts are estimates, not recorded activity.</caption>
          <thead><tr className="border-b border-[var(--stroke)]"><th scope="col" className="p-2">Plan</th><th scope="col" className="p-2">Type</th><th scope="col" className="p-2">Due dates</th><th scope="col" className="p-2 text-right">Planned amount</th></tr></thead>
          <tbody>{preview.rows.map(row => <tr key={row.planId} className="border-b border-[var(--stroke)]"><th scope="row" className="p-2 font-medium">{row.title}</th><td className="p-2">{row.type === 'income' ? 'Income' : 'Expense'}</td><td className="p-2">{row.dates.map((date, index) => <span key={date}>{index > 0 ? ', ' : ''}<time dateTime={date}>{date}</time></span>)}</td><td className="p-2 text-right tabular-nums">{money(row.totalMinor)}</td></tr>)}</tbody>
        </table>
      </div></details> : <p className="mt-4 text-sm text-secondary">{preview.incomplete ? 'No evaluable planned occurrences were found in this preview.' : `No active planned occurrences in ${currencyCode} for this period.`}</p>}
    </>}
  </section>;
}
