import type { Transaction } from '../types';
import { decimalToMinorUnits, formatMinorUnits } from '../services/financeCore';
import InfoTip from './InfoTip';

type Props = { transactions: Transaction[]; month: string; locale?: string };

export default function TransactionSummary({ transactions, month, locale }: Props) {
  const totals = new Map<string, { income: bigint; expense: bigint }>();
  let unknownCurrency = 0;
  for (const row of transactions) {
    if (!row.date?.startsWith(month)) continue;
    const currency = row.currencyCode;
    if (!currency) { unknownCurrency++; continue; }
    const amount = row.amountMinor == null ? decimalToMinorUnits(row.amount, currency) : BigInt(row.amountMinor);
    const total = totals.get(currency) ?? { income: 0n, expense: 0n };
    total[row.type] += amount;
    totals.set(currency, total);
  }
  return <section className="transaction-summary" aria-label="Money movement this month">
    <div className="transaction-summary-heading"><h2 className="type-section-title">Monthly totals</h2><InfoTip label="Money in and out">Money in is recorded income. Money out is recorded expenses. If you earn 100 and spend 30, BusyDoo shows 100 in and 30 out. Transfers and planned items are separate. Each currency has its own totals.</InfoTip></div>
    {!totals.size && <p className="text-sm text-secondary">No recorded activity with a known currency.</p>}
    {unknownCurrency > 0 && <p className="text-xs text-secondary">{unknownCurrency} {unknownCurrency === 1 ? "transaction has" : "transactions have"} an unknown currency and are excluded from these totals.</p>}
    {[...totals].sort(([left], [right]) => left.localeCompare(right)).map(([currency, total]) =>
      <div key={currency}>
      {totals.size > 1 && <h3 className="currency-summary-heading">{currency}</h3>}
      <dl className="transaction-summary-grid" aria-label={currency}>
        <div><dt>Money in</dt><dd>{formatMinorUnits(total.income, currency, locale)}</dd></div>
        <div><dt>Money out</dt><dd>{formatMinorUnits(total.expense, currency, locale)}</dd></div>
      </dl></div>)}
  </section>;
}
