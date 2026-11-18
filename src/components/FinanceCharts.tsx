import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { formatMinorUnits } from '../services/financeCore';

type FinanceAnalytics = ReturnType<typeof import('../services/financeAnalytics').buildFinanceAnalytics>;

interface FinanceChartsProps {
  analytics: FinanceAnalytics;
  theme: 'dark' | 'light';
  locale?: string;
  formatMoney: (amount: number) => string;
  month: string;
  range: 3 | 6 | 12;
  onRangeChange: (range: 3 | 6 | 12) => void;
}

export default function FinanceCharts({
  analytics, theme, locale, formatMoney, month, range, onRangeChange
}: FinanceChartsProps) {
  const tooltipStyle = {
    background: 'var(--surface)',
    color: 'var(--ink)',
    borderColor: 'var(--stroke)',
    borderRadius: 12
  };
  const maxAmount = Math.max(0, ...analytics.periodRows.flatMap(row => [row.income || 0, row.expenses || 0]));
  const axisWidth = Math.min(132, Math.max(54, Math.ceil(Math.max(formatMoney(maxAmount).length, formatMoney(0).length) * 7.5 + 12)));

  return (
    <>
      <section className="lifeos-panel rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Income & expenses</h4>
            <p className="text-xs text-secondary">Posted monthly totals · planned estimates stay separate</p>
          </div>
          <label className="shrink-0 text-[11px] text-secondary">Chart range<select aria-label="Chart range" value={range}
            onChange={event => onRangeChange(Number(event.target.value) as 3 | 6 | 12)}
            className="lifeos-input min-h-11 rounded-lg px-3 py-2 text-xs">
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select></label>
        </div>
        <p className="sr-only">Monthly chart data in posted {analytics.currencyCode}: {analytics.periodRows.map(row => `${row.month}: ${row.hasRecords ? `income ${row.incomeMinor === null ? formatMoney(row.income) : formatMinorUnits(BigInt(row.incomeMinor), analytics.currencyCode, locale)}, expenses ${row.expensesMinor === null ? formatMoney(row.expenses) : formatMinorUnits(BigInt(row.expensesMinor), analytics.currencyCode, locale)}` : 'no saved records'}`).join('; ')}. Planned amounts are excluded.</p>
        {analytics.periodRows.some(row => row.hasRecords) ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.periodRows} margin={{ top: 8, right: 4, left: 4, bottom: 2 }}>
                <CartesianGrid vertical={false} stroke="var(--stroke)" />
                <XAxis dataKey="key" tickFormatter={(_, index) => analytics.periodRows[index]?.month || ''} tick={{ fill: 'var(--ink-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={value => formatMoney(Number(value))} width={axisWidth} tick={{ fill: 'var(--ink-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} />
                {analytics.periodRows.some(row => row.key === month) && <ReferenceArea x1={month} x2={month} fill="var(--accent)" fillOpacity={0.12} strokeOpacity={0} ifOverflow="hidden" />}
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | null, name: string, item: { payload?: { incomeMinor?: string | null; expensesMinor?: string | null } }) => {
                  const exact = name === 'Income' ? item.payload?.incomeMinor : item.payload?.expensesMinor;
                  return [value === null ? 'No records' : exact == null ? formatMoney(value) : formatMinorUnits(BigInt(exact), analytics.currencyCode, locale), name];
                }} labelFormatter={(_, rows) => rows?.[0]?.payload?.key || ''} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div role="status" className="finance-chart-empty"><strong>No monthly pattern yet</strong><span>Record income or spending to see how it changes over time.</span></div>
        )}
        <p className="mt-2 text-[11px] text-secondary">Months without transactions are shown as missing data; a recorded month with zero income or expenses is a real zero.</p>
      </section>

      <section className="lifeos-panel rounded-2xl border p-4">
        <div className="mb-2">
          <h4 className="text-sm font-semibold">Expense categories</h4>
          <p className="text-xs text-secondary">{month} · Posted expenses {formatMinorUnits(BigInt(analytics.totalExpensesMinor), analytics.currencyCode, locale)} · planned amounts excluded</p>
        </div>
        {analytics.categories.length === 0 ? (
          <div role="status" className="finance-chart-empty"><strong>No expense categories for {monthLabel(month)}.</strong><span>Category comparisons appear after you record spending.</span></div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="h-48 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.categories} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                    <Cell fill="var(--chart-1)" />
                    {analytics.categories.slice(1).map((entry, index) => (
                      <Cell key={entry.name} fill={['var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, _name: string, item: { payload?: { amountMinor?: string } }) => item.payload?.amountMinor == null ? formatMoney(value) : formatMinorUnits(BigInt(item.payload.amountMinor), analytics.currencyCode, locale)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="finance-category-list">
              {analytics.categories.map((entry, index) => (
                <div key={entry.name} className="finance-category-row">
                  <div className="finance-category-label"><span className="finance-category-dot" style={{ backgroundColor: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'][index % 5] }} aria-hidden="true" /><strong>{entry.name}</strong><span>{entry.percentage.toFixed(1)}%</span></div>
                  <div className="finance-category-track" role="progressbar" aria-label={`${entry.name} share of expenses`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, entry.percentage))}><span style={{ width: `${Math.min(100, Math.max(0, entry.percentage))}%`, backgroundColor: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'][index % 5] }} /></div>
                  <span className="finance-category-amount">{formatMinorUnits(BigInt(entry.amountMinor), analytics.currencyCode, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function monthLabel(month: string) {
  const date = /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T12:00:00`) : new Date();
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
