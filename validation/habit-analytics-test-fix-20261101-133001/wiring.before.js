const fs = require('fs');
const assert = require('assert');
const esbuild = require('esbuild');

const domainSource = fs.readFileSync('src/services/domainUtils.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

// Transpile the actual production TypeScript source; do not test a JS mirror.
const compiled = esbuild.transformSync(domainSource, {
  loader: 'ts',
  format: 'cjs',
  target: 'node18'
}).code;

const productionModule = { exports: {} };
new Function('module', 'exports', compiled)(
  productionModule,
  productionModule.exports
);

const {
  isHabitScheduledOnDate,
  calculateWeeklyHabitRate,
  calculateStreaks
} = productionModule.exports;

let passed = 0;
function check(condition, message) {
  assert(condition, message);
  passed++;
  console.log(`PASS: ${message}`);
}

const dates = {
  monday: '2026-11-02',
  friday: '2026-11-06',
  saturday: '2026-11-07',
  sunday: '2026-11-08'
};

// Production scheduling helper: real calendar dates.
check(isHabitScheduledOnDate('weekdays', dates.monday), 'Monday is scheduled for weekdays');
check(isHabitScheduledOnDate('weekdays', dates.friday), 'Friday is scheduled for weekdays');
check(!isHabitScheduledOnDate('weekdays', dates.saturday), 'Saturday is not scheduled for weekdays');
check(!isHabitScheduledOnDate('weekdays', dates.sunday), 'Sunday is not scheduled for weekdays');
check(isHabitScheduledOnDate('weekends', dates.saturday), 'Saturday is scheduled for weekends');
check(isHabitScheduledOnDate('weekends', dates.sunday), 'Sunday is scheduled for weekends');
check(!isHabitScheduledOnDate('weekends', dates.monday), 'Monday is not scheduled for weekends');
check(isHabitScheduledOnDate('daily', 'not-a-date'), 'Daily frequency remains scheduled independent of weekday');
check(!isHabitScheduledOnDate('weekdays', '2026-02-30'), 'Impossible calendar date is rejected');
check(!isHabitScheduledOnDate('weekends', '2026/11/07'), 'Incorrect date format is rejected');

// Weekday rate: five completed weekdays, excluding weekend days.
const weekdayLogs = ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']
  .map(date => ({ habitId: 'weekday', date, completed: true }));
const weekdayRate = calculateWeeklyHabitRate(
  weekdayLogs, 'weekday', new Date(2026, 10, 8), 'weekdays'
);
check(weekdayRate.completed === 5 && weekdayRate.scheduled === 5 && weekdayRate.rate === 100,
  'Weekday completion rate uses five scheduled days');

// Weekend rate: two completed weekend days.
const weekendLogs = ['2026-11-07','2026-11-08']
  .map(date => ({ habitId: 'weekend', date, completed: true }));
const weekendRate = calculateWeeklyHabitRate(
  weekendLogs, 'weekend', new Date(2026, 10, 8), 'weekends'
);
check(weekendRate.completed === 2 && weekendRate.scheduled === 2 && weekendRate.rate === 100,
  'Weekend completion rate uses two scheduled days');

// Streaks skip unscheduled days, but not scheduled days.
const weekdayStreak = calculateStreaks(weekdayLogs, 'weekday', '2026-11-09', 'weekdays');
check(weekdayStreak.currentStreak === 5 && weekdayStreak.longestStreak === 5,
  'Weekday streak crosses Saturday and Sunday');
const weekendStreak = calculateStreaks(weekendLogs, 'weekend', '2026-11-09', 'weekends');
check(weekendStreak.currentStreak === 2 && weekendStreak.longestStreak === 2,
  'Weekend streak counts Saturday and Sunday');

// Weekly frequency: one completion in rolling seven days and consecutive ISO weeks.
const weeklyRate = calculateWeeklyHabitRate(
  [{ habitId: 'weekly', date: '2026-11-04', completed: true }],
  'weekly', new Date(2026, 10, 8), 'weekly'
);
check(weeklyRate.completed === 1 && weeklyRate.scheduled === 1 && weeklyRate.rate === 100,
  'Weekly frequency accepts one completion in rolling seven days');

const weeklyStreak = calculateStreaks([
  { habitId: 'weekly-streak', date: '2026-10-26', completed: true },
  { habitId: 'weekly-streak', date: '2026-11-04', completed: true }
], 'weekly-streak', '2026-11-08', 'weekly');
check(weeklyStreak.currentStreak === 2 && weeklyStreak.longestStreak === 2,
  'Weekly streak counts consecutive Monday-start weeks');

// App wiring assertions.
check(app.includes("habits.find(h => h.id === habitId)?.frequency || 'daily''),
  'App passes habit frequency into streak calculation');
check(app.includes('calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency)'),
  'App passes habit frequency into weekly rate calculation');
check(app.includes('isHabitScheduledOnDate(h.frequency, todayStr)'),
  'Productivity score respects unscheduled days');
check(app.includes('{weekly.completed}/{weekly.scheduled} days'),
  'Habit UI displays the actual scheduled-day denominator');

console.log(`PRODUCTION HABIT ANALYTICS TESTS: ${passed}/20 PASSED`);
