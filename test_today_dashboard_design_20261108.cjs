'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const start = app.indexOf('        {/* VIEW 1: DASHBOARD */}');
const end = app.indexOf('        {/* VIEW 2: FINANCE */}', start);
assert.ok(start >= 0 && end > start, 'Today screen is present');
const today = app.slice(start, end);

assert.match(today, /data-testid="today-overview"/);
assert.match(today, /todayOverview\.tasksCompleted} of \{todayOverview\.tasksDue\}/, 'focus summarizes task progress without duplicating the routines list');
assert.match(today, /onClick=\{\(\) => openCreateForm\('task'\)\}[^>]*>\+ Task/);
assert.match(today, /today-habit-summary[\s\S]*onClick=\{\(\) => openCreateForm\('habit'\)\}/, 'habit creation is grouped with the habits section');
assert.match(today, /onClick=\{\(\) => \{ setPlannerDetailTaskId\(t\.id\);[\s\S]*aria-label=\{`Open \$\{t\.title\} details`\}/, 'a Today task opens its saved task details');
assert.match(today, /Open Plan/);
assert.match(today, /role="progressbar" aria-label="Today’s tasks complete"/);
assert.match(today, /handleHabitCompletion\(h\.id, h\.name, todayStr, stats\.completedToday\)/, 'habit check-ins still use the existing completion flow');
assert.match(today, /persistTodayLayout\(setTodaySectionVisible/);
assert.match(today, /persistTodayLayout\(moveTodaySection/);
assert.match(app, /tasks\.filter\(task => !task\.completed && task\.dueDate > todayKey\)/, 'the existing upcoming-task definition remains intact');
assert.match(css, /\.today-focus-progress span[^\n]*transition: width 180ms ease-out/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'progress respects the global reduced-motion rule');

console.log('TODAY UI 2.0: 11 dashboard hierarchy, quick action, check-in, customization, and motion checks passed.');
