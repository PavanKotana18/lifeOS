'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const InsightsHub = require('./src/components/InsightsHub.tsx').default;
const goal = (id, title, currentValue, targetValue) => ({
  id, title, currentValue, targetValue, category: 'Personal Development', unit: 'pages',
  startDate: '2026-11-01', targetDate: '2026-12-01', priority: 'Medium', status: 'In Progress', createdAt: '2026-11-01T00:00:00.000Z',
});
const noop = () => {};
const baseProps = {
  month: '2026-11', income: 0, expenses: 0, balance: 0, transactionCount: 0,
  completedRoutines: 0, routinesDue: 0, weeklyCompleted: 0, weeklyTotal: 0,
  goals: [], hasHistory: false, formatMoney: value => String(value),
  onFinance: noop, onHabits: noop, onGoals: noop,
};
const emptyMarkup = renderToStaticMarkup(React.createElement(InsightsHub, baseProps));
assert.match(emptyMarkup, /Your insights start here/);
assert.match(emptyMarkup, /Add a transaction, check in to a habit, or set a goal/);
assert.match(emptyMarkup, />Money</);
assert.match(emptyMarkup, />Habits</);
assert.match(emptyMarkup, />Goals</);
const unrelatedHistoryMarkup = renderToStaticMarkup(React.createElement(InsightsHub, { ...baseProps, hasHistory: true }));
assert.match(unrelatedHistoryMarkup, /No patterns to show yet/, 'saved records without supported insight data receive an honest state');
assert.doesNotMatch(unrelatedHistoryMarkup, /Review goal progress/, 'the empty insight state does not route users to nonexistent goal progress');
const markup = renderToStaticMarkup(React.createElement(InsightsHub, {
  ...baseProps, goals: [goal('g1', 'Read more', 5, 10), goal('g2', 'Impossible target', 20, 0)], hasHistory: true,
}));
assert.match(markup, /Goal progress/);
assert.match(markup, /aria-valuenow="50"/);
assert.match(markup, /5 of 10 pages/);
assert.match(markup, /aria-valuenow="0"/, 'zero targets use the production domain rule and do not divide by zero');
assert.equal((markup.match(/role="progressbar"/g) || []).length, 2);
assert.doesNotMatch(markup, /Review goal progress/, 'goal navigation lives in the goal section rather than repeating below it');
console.log('INSIGHTS HUB: real-data summaries, honest empty states and goal progress passed with synthetic records.');
