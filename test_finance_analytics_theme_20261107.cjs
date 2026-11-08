'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const start = app.indexOf("            {financeSubtab === 'analytics' && <div className=\"space-y-4\">");
const end = app.indexOf('\n            </div>}\n          </div>', start);
assert.ok(start >= 0 && end > start, 'Finance Analytics view boundaries are present');
const analytics = app.slice(start, end);
for (const token of ['lifeos-input', 'lifeos-panel', 'text-secondary', 'var(--success)', 'var(--danger)', 'var(--warning)', 'var(--accent)']) {
  assert.ok(analytics.includes(token), `Finance Analytics uses semantic token ${token}`);
}
assert.match(analytics, /role="progressbar" aria-label=\{`\$\{row\.category\} budget used`\}/);
assert.match(analytics, /aria-valuemax=\{100\} aria-valuenow=\{Math\.min\(100, pct\)\}/);
assert.ok(!/\b(?:text|bg|border)-(?:slate|indigo|emerald|amber|rose)-\d{2,3}\b/.test(analytics), 'Finance Analytics avoids fixed palette utilities');
assert.match(analytics, /financeAnalytics\.totalIncome/);
assert.match(analytics, /financeAnalytics\.totalExpenses/);
console.log('FINANCE ANALYTICS THEME: 13 source-level theme and progress accessibility checks passed.');
