'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const { DEFAULT_TODAY_LAYOUT, normalizeTodayLayout, setTodaySectionVisible, moveTodaySection } = require('./src/services/todayLayout.ts');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.deepEqual(DEFAULT_TODAY_LAYOUT.order, ['focus', 'money', 'agenda', 'habits', 'upcoming', 'goals']);
assert.deepEqual(DEFAULT_TODAY_LAYOUT.hidden, ['goals'], 'empty goals panel is hidden by default');
assert.deepEqual(normalizeTodayLayout({ order: ['money', 'money', 'unknown'], hidden: ['focus', 'goals', 'goals', 'bad'] }), {
  order: ['money', 'focus', 'agenda', 'habits', 'upcoming', 'goals'], hidden: ['goals'],
}, 'saved order is deduplicated, validated and completed with missing sections; focus remains visible');
const visibleGoals = setTodaySectionVisible(DEFAULT_TODAY_LAYOUT, 'goals', true);
assert.deepEqual(visibleGoals.hidden, []);
assert.equal(setTodaySectionVisible(DEFAULT_TODAY_LAYOUT, 'focus', false), DEFAULT_TODAY_LAYOUT, 'required focus section cannot be hidden');
assert.deepEqual(moveTodaySection(DEFAULT_TODAY_LAYOUT, 'agenda', -1).order, ['focus', 'agenda', 'money', 'habits', 'upcoming', 'goals']);
assert.deepEqual(moveTodaySection(DEFAULT_TODAY_LAYOUT, 'focus', -1), DEFAULT_TODAY_LAYOUT, 'move at first boundary is a no-op');
assert.deepEqual(moveTodaySection(DEFAULT_TODAY_LAYOUT, 'goals', 1), DEFAULT_TODAY_LAYOUT, 'move at last boundary is a no-op');
const protectedOpen = app.indexOf('await encryptedSession.open()');
const layoutRead = app.indexOf("get<unknown>('todayLayout'");
assert.ok(protectedOpen >= 0 && layoutRead > protectedOpen, 'private Today layout loads only after encrypted session startup');
assert.match(app, /StorageService\.settings\.set\('todayLayout'/);
assert.match(app, /aria-controls="today-customization"/);
assert.match(app, /Move \$\{TODAY_SECTION_LABELS\[id\]\} up/);
assert.match(app, /Restore default layout/);
assert.match(app, /tasks\.filter\(task => !task\.completed && task\.dueDate > todayKey\)/, 'Coming up excludes completed and non-future tasks');
assert.match(app, /setPlannerSelectedDate\(task\.dueDate\); setPlannerFilter\('all'\); navigateTo\('planner'\)/, 'Upcoming task opens Planner on its saved date');
console.log('TODAY LAYOUT: 15 ordering, visibility, persistence-boundary and UI contracts passed.');
