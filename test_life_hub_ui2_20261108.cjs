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
const LifeHub = require('./src/components/LifeHub.tsx').default;
const noop = () => {};
const props = {
  habits: [
    { id: 'h1', name: 'Walk outside', completedToday: false, currentStreak: 3 },
    { id: 'h2', name: 'Read', completedToday: true, currentStreak: 0 },
  ],
  goals: [{ id: 'g1', title: 'Finish a course', progress: 45, current: '9', target: '20', targetDate: 'Dec 20, 2026', completedMilestones: 1, milestoneCount: 3 }],
  completedRoutines: 1, routinesDue: 2, weeklyCompleted: 4, weeklyTotal: 7,
  onCheckIn: noop, onCreateHabit: noop, onCreateGoal: noop, onHabits: noop, onGoals: noop, onInsights: noop,
};
const markup = renderToStaticMarkup(React.createElement(LifeHub, props));
assert.match(markup, /Daily routines and longer-term goals/);
assert.match(markup, /Walk outside/);
assert.match(markup, /aria-pressed="false" aria-label="Complete Walk outside for today"/);
assert.match(markup, /aria-pressed="true" aria-label="Mark Read incomplete/);
assert.match(markup, /3 day streak/);
assert.match(markup, /Finish a course/);
assert.match(markup, /45%/);
assert.match(markup, /role="progressbar" aria-label="Finish a course progress"/);
assert.match(markup, /1 of 3 milestones/);
assert.match(markup, /Life insights/);
assert.match(markup, /View all habits/);
assert.doesNotMatch(markup, /lazy|failure|behind|missed/i, 'Life copy stays considerate and nonjudgmental');

const empty = renderToStaticMarkup(React.createElement(LifeHub, { ...props, habits: [], goals: [], routinesDue: 0, completedRoutines: 0, weeklyTotal: 0, weeklyCompleted: 0 }));
assert.match(empty, /No routines yet/);
assert.match(empty, /No goals yet/);
assert.match(empty, /Add a goal/);
assert.match(empty, /All goals and milestones/);

const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.match(app, /onCheckIn=\{habit =>[\s\S]*handleHabitCompletion\(original\.id, original\.name, todayKey, habit\.completedToday\)/);
assert.match(app, /onCreateGoal=\{\(\) => openCreateForm\('goal'\)\}/);
assert.match(app, /progress: getGoalProgress\(goal\.currentValue, goal\.targetValue\)/);
console.log('LIFE UI 2.0: daily check-ins, streaks, goal progress/milestones, empty states, and existing handler wiring passed.');
