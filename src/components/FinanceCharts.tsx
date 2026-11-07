import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

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

  return (
    <>
      <section className="lifeos-panel rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Income & expenses</h4>
            <p className="text-xs text-secondary">Monthly totals</p>
          </div>
          <select aria-label="Analytics time range" value={range}
            onChange={event => onRangeChange(Number(event.target.value) as 3 | 6 | 12)}
            className="lifeos-input min-h-11 rounded-lg px-3 py-2 text-xs">
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>
        <p className="sr-only">Monthly chart data: {analytics.periodRows.map(row => `${row.month}: ${row.hasRecords ? `income ${formatMoney(row.income)}, expenses ${formatMoney(row.expenses)}` : 'no saved records'}`).join('; ')}.</p>
        <div className="h-56 w-full">
          {analytics.periodRows.some(row => row.hasRecords) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.periodRows} margin={{ top: 8, right: 4, left: -18, bottom: 2 }}>
                <CartesianGrid vertical={false} stroke="var(--stroke)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--ink-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={value => Number(value).toLocaleString(locale)} tick={{ fill: 'var(--ink-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | null, name: string) => [value === null ? 'No records' : formatMoney(value), name]} labelFormatter={(_, rows) => rows?.[0]?.payload?.key || ''} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div role="status" className="flex h-full items-center justify-center text-center text-sm text-secondary">Add transactions to see monthly trends.</div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-secondary">Months without transactions are shown as missing data; a recorded month with zero income or expenses is a real zero.</p>
      </section>

      <section className="lifeos-panel rounded-2xl border p-4">
        <div className="mb-2">
          <h4 className="text-sm font-semibold">Expense categories</h4>
          <p className="text-xs text-secondary">{month} · {formatMoney(analytics.totalExpenses)} total</p>
        </div>
        {analytics.categories.length === 0 ? (
          <div role="status" className="py-7 text-center text-sm text-secondary">No expense records for this month.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.categories} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                    <Cell fill="var(--chart-1)" />
                    {analytics.categories.slice(1).map((entry, index) => (
                      <Cell key={entry.name} fill={['var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatMoney(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {analytics.categories.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'][index % 5] }} />
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <span className="shrink-0 text-right text-secondary">{formatMoney(entry.amount)} · {entry.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
