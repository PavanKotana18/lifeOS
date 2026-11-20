'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/components/FinanceCharts.tsx', 'utf8');
assert.equal((source.match(/className="lifeos-panel rounded-2xl border p-4"/g) || []).length, 2, 'both chart cards use the active theme surface');
assert.match(source, /<PreferenceChoice variant="field" label="Time period"/, "time range uses the shared field");
const choices = fs.readFileSync("src/styles/feather-expressive.css", "utf8");
assert.match(choices, /\.choice-trigger\s*\{[^}]*min-height: var\(--feather-control-height\)/, "the shared choice field uses the touch target token");
assert.doesNotMatch(source, /(?:text|bg|border)-(?:slate|gray|zinc|indigo|blue|rose|emerald)-\d+/, 'chart component has no fixed dark/status palette utilities');
assert.match(source, /background: 'var\(--surface\)'[\s\S]*color: 'var\(--ink\)'[\s\S]*borderColor: 'var\(--stroke\)'/, 'chart tooltip uses semantic tokens');
assert.match(source, /Monthly chart data in \{analytics\.currencyCode\}: \{analytics\.periodRows\.map/, 'screen-reader summary identifies the reporting currency and derives values from actual posted chart periods');
assert.match(source, /row\.hasRecords \? `income \$\{row\.incomeMinor === null \? formatMoney\(row\.income\) : formatMinorUnits\(BigInt\(row\.incomeMinor\), analytics\.currencyCode, locale\)\}, expenses/, 'summary formats exact minor units and distinguishes recorded zeroes from missing records');
assert.equal((source.match(/fill="var\(--chart-[1-5]\)"/g) || []).length, 1, 'pie series uses semantic chart tokens');
assert.equal((source.match(/role="status"/g) || []).length, 2, 'both chart empty states announce their status');
assert.match(source, /formatMinorUnits\(BigInt\(entry\.amountMinor\), analytics\.currencyCode, locale\)/, 'category amounts use exact minor units and explicit currency alongside the chart');
assert.match(source, /Planned amounts are excluded/, 'chart explanation explicitly separates posted values from planned amounts');
assert.match(source, /entry\.percentage\.toFixed\(1\)/, 'percentage shares remain available as readable text alongside the chart');
console.log('FINANCE CHARTS THEME: 9 source-level token, data-summary and empty-state checks passed.');
