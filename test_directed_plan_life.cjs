'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const PlanHub = require('./src/components/PlanHub.tsx').default;
const LifeHub = require('./src/components/LifeHub.tsx').default;
const InsightsHub = require('./src/components/InsightsHub.tsx').default;
const noop = () => {};
const calls = [];
const task = (id, title, dueDate, dueTime, extra = {}) => ({
  id, title, dueDate, dueTime, createdAt: '2026-11-01T00:00:00.000Z', completed: false,
  priority: 'Medium', recurring: 'None', ...extra,
});
const tasks = [
  task('late', 'Review application', '2026-11-09', '08:00'),
  task('future', 'Call the dentist', '2026-11-11', '10:30'),
  task('open', 'Sort the paperwork', '', undefined),
  task('repeat', 'Water the plants', '2026-11-10', '19:00', { recurring: 'Daily' }),
];
const planProps = {
  tasks, today: '2026-11-09', now: new Date('2026-11-09T09:00:00'),
  onNavigatePlanner: () => calls.push('planner'), onOpenTask: item => calls.push(`task:${item.id}`),
  onToggleTask: noop, onCreateTask: () => calls.push('create-task'),
  onSelectRange: range => calls.push(`range:${range}`), onOpenGoals: () => calls.push('goals'),
};
const planMarkup = renderToStaticMarkup(React.createElement(PlanHub, planProps));
assert.match(planMarkup, /See what’s next, then choose one thing to do/);
assert.match(planMarkup, /Go to a date in your planner/);
assert.match(planMarkup, /role="group" aria-label="Open tasks by date"/);
assert.match(planMarkup, /Overdue · Today/);
assert.match(planMarkup, /Call the dentist/);
assert.doesNotMatch(planMarkup, /2026-11-11/, 'dates are presented in a readable local format rather than raw storage format');
assert.match(planMarkup, /Repeats daily/);
assert.match(planMarkup, /No due date/);
assert.match(planMarkup, /See all tasks in planner/);
assert.doesNotMatch(planMarkup, /Open planner/);
const planElement = PlanHub(planProps);
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (React.isValidElement(node)) {
    visit(node);
    walk(node.props.children, visit);
  } else if (Array.isArray(node)) node.forEach(child => walk(child, visit));
}
function clickButtonContaining(element, text) {
  let button;
  walk(element, node => {
    if (node.type === 'button' && String(node.props.children).includes(text)) button = node;
  });
  assert.ok(button, `button containing ${text} exists`);
  button.props.onClick();
}
clickButtonContaining(planElement, 'Add task');
clickButtonContaining(planElement, 'Tomorrow');
clickButtonContaining(planElement, 'See all tasks');
assert.deepEqual(calls, ['create-task', 'range:tomorrow', 'planner'], 'Plan actions preserve their existing navigation and creation callbacks');
const emptyPlan = renderToStaticMarkup(React.createElement(PlanHub, { ...planProps, tasks: [] }));
assert.match(emptyPlan, /No tasks yet/);
assert.match(emptyPlan, /Start with one thing you want to remember/);

const lifeProps = {
  habits: [
    { id: 'h1', name: 'Walk outside', completedToday: false, currentStreak: 3 },
    { id: 'h2', name: 'Read', completedToday: true, currentStreak: 0 },
  ],
  goals: [{ id: 'g1', title: 'Finish a course', progress: 45, current: '9 pages', target: '20 pages', targetDate: 'Dec 20, 2026', completedMilestones: 1, milestoneCount: 3 }],
  completedRoutines: 1, routinesDue: 2, weeklyCompleted: 4, weeklyTotal: 7,
  onCheckIn: item => calls.push(`check:${item.id}`), onCreateHabit: noop, onCreateGoal: noop,
  onHabits: noop, onGoals: noop, onInsights: noop,
};
const lifeMarkup = renderToStaticMarkup(React.createElement(LifeHub, lifeProps));
assert.match(lifeMarkup, /Habits are things you repeat/);
assert.match(lifeMarkup, /Your routine, at a glance/);
assert.match(lifeMarkup, /1 of 2 check-ins/);
assert.match(lifeMarkup, /4 of 7 routines/);
assert.match(lifeMarkup, /1 of 3 milestones/);
assert.match(lifeMarkup, /Finish a course/);
assert.match(lifeMarkup, /role="progressbar" aria-label="Finish a course progress"/);
assert.doesNotMatch(lifeMarkup, /lazy|failure|behind|missed/i);
const lifeElement = LifeHub(lifeProps);
let checkButton;
walk(lifeElement, node => { if (node.type === 'button' && node.props['aria-label'] === 'Complete Walk outside for today') checkButton = node; });
assert.ok(checkButton, 'each habit keeps a direct, accessible check-in control');
checkButton.props.onClick();
assert.equal(calls.at(-1), 'check:h1', 'habit check-in retains the original callback');
const emptyLife = renderToStaticMarkup(React.createElement(LifeHub, { ...lifeProps, habits: [], goals: [], routinesDue: 0, completedRoutines: 0, weeklyTotal: 0, weeklyCompleted: 0 }));
assert.match(emptyLife, /No routines yet/);
assert.match(emptyLife, /Start with one small habit/);
assert.match(emptyLife, /No goals yet/);
assert.doesNotMatch(emptyLife, /Your routine, at a glance/, 'an empty Life screen does not fabricate zero activity');

const goal = { id: 'g2', title: 'Read more', currentValue: 5, targetValue: 10, category: 'Personal Development', unit: 'pages', startDate: '2026-11-01', targetDate: '2026-12-01', priority: 'Medium', status: 'In Progress', createdAt: '2026-11-01T00:00:00.000Z' };
const insightProps = {
  month: '2026-11', income: 1000, expenses: 650, balance: 350, transactionCount: 4,
  completedRoutines: 1, routinesDue: 2, weeklyCompleted: 4, weeklyTotal: 7,
  goals: [goal], hasHistory: true, formatMoney: amount => `₹${amount}`,
  onFinance: noop, onHabits: noop, onGoals: noop,
};
const insightsMarkup = renderToStaticMarkup(React.createElement(InsightsHub, insightProps));
assert.match(insightsMarkup, /See money, routines, and goals separately/);
assert.match(insightsMarkup, /money/i);
assert.match(insightsMarkup, /Income after expenses/);
assert.match(insightsMarkup, /Habit check-ins/);
assert.match(insightsMarkup, /Goal progress/);
assert.match(insightsMarkup, /4 saved transactions/);
assert.match(insightsMarkup, /₹350/);
assert.doesNotMatch(insightsMarkup, /life score|overall score|prediction/i, 'Insights does not invent a combined score or prediction');
const noData = renderToStaticMarkup(React.createElement(InsightsHub, { ...insightProps, transactionCount: 0, routinesDue: 0, weeklyTotal: 0, goals: [], hasHistory: false }));
assert.match(noData, /Your insights start here/);
assert.match(noData, /Add a transaction, check in to a habit, or set a goal/);
console.log('DIRECTED PLAN, LIFE AND INSIGHTS: task-first routes, readable dates, real-data summaries, accessible check-ins and honest empty states passed.');
