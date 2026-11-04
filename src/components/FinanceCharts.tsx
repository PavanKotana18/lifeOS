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
    background: theme === 'dark' ? '#111827' : '#fff',
    borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
    borderRadius: 12
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Income & expenses</h4>
            <p className="text-xs text-slate-400">Monthly totals</p>
          </div>
          <select aria-label="Analytics time range" value={range}
            onChange={event => onRangeChange(Number(event.target.value) as 3 | 6 | 12)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs">
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>
        <div className="h-56 w-full">
          {analytics.periodRows.some(row => row.hasRecords) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.periodRows} margin={{ top: 8, right: 4, left: -18, bottom: 2 }}>
                <CartesianGrid vertical={false} stroke={theme === 'dark' ? '#263244' : '#dbe3ed'} />
                <XAxis dataKey="month" tick={{ fill: theme === 'dark' ? '#aebbd0' : '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={value => Number(value).toLocaleString(locale)} tick={{ fill: theme === 'dark' ? '#aebbd0' : '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | null, name: string) => [value === null ? 'No records' : formatMoney(value), name]} labelFormatter={(_, rows) => rows?.[0]?.payload?.key || ''} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">Add transactions to see monthly trends.</div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Months without transactions are shown as missing data; a recorded month with zero income or expenses is a real zero.</p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-2">
          <h4 className="text-sm font-semibold">Expense categories</h4>
          <p className="text-xs text-slate-400">{month} · {formatMoney(analytics.totalExpenses)} total</p>
        </div>
        {analytics.categories.length === 0 ? (
          <div className="py-7 text-center text-sm text-slate-400">No expense records for this month.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.categories} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                    <Cell fill="#4f46e5" />
                    {analytics.categories.slice(1).map((entry, index) => (
                      <Cell key={entry.name} fill={['#0f766e', '#d97706', '#0284c7', '#7c3aed', '#be123c', '#475569'][index % 6]} />
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
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: ['#4f46e5', '#0f766e', '#d97706', '#0284c7', '#7c3aed', '#be123c', '#475569'][index % 7] }} />
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
