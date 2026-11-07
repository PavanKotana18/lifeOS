'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');
for (const screen of ['FinanceCharts', 'FinanceProjection', 'LifeHub', 'PlanHub', 'InsightsHub']) {
  assert.match(app, new RegExp(`const ${screen} = React\\.lazy\\(\\(\\) => import\\('./components/${screen}'\\)\\)`), `${screen} is loaded as a split screen chunk`);
}
assert.match(app, /function ScreenLoading\(\{ label \}: \{ label: string \}\)/);
assert.match(app, /role="status" aria-live="polite"/);
for (const label of ['Loading your life overview…', 'Loading your plan…', 'Loading your insights…', 'Loading financial planning…', 'Loading financial charts…']) {
  assert.ok(app.includes(label), `accessible loading state is present: ${label}`);
}
console.log('LAZY SCREEN LOADING: 12 source-level chunk and loading-state checks passed.');
