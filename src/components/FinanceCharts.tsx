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
        {analytics.periodRows.some(row => row.hasRecords) ? (
          <div className="h-56 w-full">
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
          </div>
        ) : (
          <div role="status" className="finance-chart-empty"><strong>No monthly pattern yet</strong><span>Record income or spending to see how it changes over time.</span></div>
        )}
        <p className="mt-2 text-[11px] text-secondary">Months without transactions are shown as missing data; a recorded month with zero income or expenses is a real zero.</p>
      </section>

      <section className="lifeos-panel rounded-2xl border p-4">
        <div className="mb-2">
          <h4 className="text-sm font-semibold">Expense categories</h4>
          <p className="text-xs text-secondary">{month} · {formatMoney(analytics.totalExpenses)} total</p>
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatMoney(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="finance-category-list">
              {analytics.categories.map((entry, index) => (
                <div key={entry.name} className="finance-category-row">
                  <div className="finance-category-label"><span className="finance-category-dot" style={{ backgroundColor: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'][index % 5] }} aria-hidden="true" /><strong>{entry.name}</strong><span>{entry.percentage.toFixed(1)}%</span></div>
                  <div className="finance-category-track" role="progressbar" aria-label={`${entry.name} share of expenses`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, entry.percentage))}><span style={{ width: `${Math.min(100, Math.max(0, entry.percentage))}%`, backgroundColor: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'][index % 5] }} /></div>
                  <span className="finance-category-amount">{formatMoney(entry.amount)}</span>
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
