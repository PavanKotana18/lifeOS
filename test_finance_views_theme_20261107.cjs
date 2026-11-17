'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const start = app.indexOf('        {/* VIEW 2: FINANCE */}');
const end = app.indexOf('        {/* VIEW 3: HABITS */}', start);
assert.ok(start >= 0 && end > start, 'Finance view boundaries are present');
const finance = app.slice(start, end);
assert.ok(!/\b(?:text|bg|border)-(?:slate|indigo|emerald|amber|rose|sky)-\d{2,3}(?:\/\d+)?\b/.test(finance), 'Finance views use semantic palette tokens');
for (const token of ['lifeos-panel', 'lifeos-input', 'lifeos-accent-button', 'var(--success)', 'var(--danger)', 'var(--warning)', 'var(--accent)']) {
  assert.ok(finance.includes(token), `Finance views use ${token}`);
}
assert.ok(/<MoneyDetailHeader section={financeSubtab}/.test(finance), 'focused Money routes use an accessible title and explicit overview navigation');
assert.ok(/data-detail=\{financeSubtab\}/.test(finance), 'current Money destination drives the focused detail surface');
assert.ok(!/overflow-x-auto[^\n]*financeSubtab/.test(finance), 'Money navigation has no horizontal finance tab strip');
assert.match(finance, /role="progressbar"/);
assert.ok(/filteredTransactions\.map\(t =>/.test(finance));
assert.ok(!finance.includes('text-white'), 'Finance controls use token-provided foregrounds');
console.log('FINANCE VIEWS THEME: 13 source-level palette, navigation and accessibility checks passed.');
