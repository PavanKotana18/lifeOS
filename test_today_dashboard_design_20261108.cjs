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
assert.match(today, /onClick=\{\(\) => openCreateForm\('task'\)\}[^>]*>Add task/);
assert.match(today, /data-today-card="habits"[\s\S]*onClick=\{event => openFromToday\('habits', event\.currentTarget\)\}[^>]*>View habits/);
assert.equal((today.match(/>View habits<\/button>/g) || []).length, 1);
assert.match(today, /onClick=\{event => \{ todayOrigin\.current = null; taskDetailReturnTabRef\.current = 'dashboard'; taskDetailReturnFocusRef\.current = event\.currentTarget; setPlannerDetailTaskId\(t\.id\);[\s\S]*aria-label=\{`Open \$\{t\.title\} details`\}/, 'a Today task opens details and retains a visible focus return target');
assert.match(today, /Open Plan/);
assert.match(today, /role="progressbar" aria-label="Today’s tasks complete"/);
assert.match(today, /handleHabitCompletion\(habit\.id, habit\.name, todayKey, completed\)/, 'habit check-ins still use the existing completion flow');
assert.match(today, /handleHabitQuantity\(habit, todayKey, 1\)/, 'quantity routines use the existing exact quantity handler');
assert.match(today, /persistTodayLayout\(setTodaySectionVisible/);
assert.match(today, /persistTodayLayout\(moveTodaySection/);
assert.match(app, /tasks\.filter\(task => !task\.completed && Boolean\(task\.dueDate\) && task\.dueDate > todayKey\)/, 'upcoming excludes completed, undated and non-future tasks');
assert.match(css, /\.today-focus-progress span[^\n]*transition: width 180ms ease-out/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'progress respects the global reduced-motion rule');

console.log('TODAY UI 2.0: 11 dashboard hierarchy, quick action, check-in, customization, and motion checks passed.');
