'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/components/FinanceCharts.tsx', 'utf8');
assert.equal((source.match(/className="lifeos-panel rounded-2xl border p-4"/g) || []).length, 2, 'both chart cards use the active theme surface');
assert.match(source, /className="lifeos-input min-h-11 rounded-lg/, 'time range control uses semantic input styling and touch sizing');
assert.doesNotMatch(source, /(?:text|bg|border)-(?:slate|gray|zinc|indigo|blue|rose|emerald)-\d+/, 'chart component has no fixed dark/status palette utilities');
assert.match(source, /background: 'var\(--surface\)'[\s\S]*color: 'var\(--ink\)'[\s\S]*borderColor: 'var\(--stroke\)'/, 'chart tooltip uses semantic tokens');
assert.match(source, /Monthly chart data: \{analytics\.periodRows\.map/, 'screen-reader summary is derived from actual chart periods');
assert.match(source, /row\.hasRecords \? `income \$\{formatMoney\(row\.income\)\}, expenses \$\{formatMoney\(row\.expenses\)\}` : 'no saved records'/, 'summary distinguishes recorded zeroes from missing records');
assert.equal((source.match(/fill="var\(--chart-[1-5]\)"/g) || []).length, 1, 'pie series uses semantic chart tokens');
assert.equal((source.match(/role="status"/g) || []).length, 2, 'both chart empty states announce their status');
assert.match(source, /formatMoney\(entry\.amount\)/, 'category amounts remain available as readable text alongside the chart');
assert.match(source, /entry\.percentage\.toFixed\(1\)/, 'percentage shares remain available as readable text alongside the chart');
console.log('FINANCE CHARTS THEME: 9 source-level token, data-summary and empty-state checks passed.');
