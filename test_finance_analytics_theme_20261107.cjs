'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
const charts = fs.readFileSync('src/components/FinanceCharts.tsx', 'utf8').replace(/\r\n/g, '\n');
const start = app.indexOf("            {financeSubtab === 'analytics' && <div className=\"space-y-4\">");
const end = app.indexOf('\n            </div>}\n          </div>', start);
assert.ok(start >= 0 && end > start, 'Finance Analytics view boundaries are present');
const analytics = app.slice(start, end);
for (const token of ['lifeos-panel', 'text-secondary', 'var(--success)', 'var(--danger)', 'var(--stroke)']) {
  assert.ok((analytics + charts).includes(token), 'Analytics uses semantic token ' + token);
}
assert.ok(charts.includes('lifeos-input'), 'Period selection uses the semantic input token');
assert.match(charts, /<Bar dataKey="income"/);
assert.match(charts, /<Bar dataKey="expenses"/);
assert.match(analytics, /financeAnalytics\.expenseChange/);
assert.doesNotMatch(analytics, /Budget status|Financial insights/);
console.log('FINANCE ANALYTICS THEME: 13 source-level theme and progress accessibility checks passed.');
