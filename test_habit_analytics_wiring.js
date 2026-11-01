const fs = require('fs');
const assert = require('assert');
const esbuild = require('esbuild');

const domainSource = fs.readFileSync('src/services/domainUtils.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

// Execute the actual production TypeScript implementation after transpilation.
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

check(isHabitScheduledOnDate('weekdays', dates.monday), 'Monday scheduled for weekdays');
check(isHabitScheduledOnDate('weekdays', dates.friday), 'Friday scheduled for weekdays');
check(!isHabitScheduledOnDate('weekdays', dates.saturday), 'Saturday excluded from weekdays');
check(!isHabitScheduledOnDate('weekdays', dates.sunday), 'Sunday excluded from weekdays');
check(isHabitScheduledOnDate('weekends', dates.saturday), 'Saturday scheduled for weekends');
check(isHabitScheduledOnDate('weekends', dates.sunday), 'Sunday scheduled for weekends');
check(!isHabitScheduledOnDate('weekends', dates.monday), 'Monday excluded from weekends');
check(isHabitScheduledOnDate('daily', 'not-a-date'), 'Daily frequency remains scheduled independent of weekday');
check(!isHabitScheduledOnDate('weekdays', '2026-02-30'), 'Impossible date rejected');
check(!isHabitScheduledOnDate('weekends', '2026/11/07'), 'Invalid date format rejected');

const weekdayLogs = [
  '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'
].map(date => ({ habitId: 'weekday', date, completed: true }));

const weekdayRate = calculateWeeklyHabitRate(
  weekdayLogs, 'weekday', new Date(2026, 10, 8), 'weekdays'
);
check(
  weekdayRate.completed === 5 && weekdayRate.scheduled === 5 && weekdayRate.rate === 100,
  'Weekday rate uses five scheduled days'
);

const weekendLogs = ['2026-11-07', '2026-11-08']
  .map(date => ({ habitId: 'weekend', date, completed: true }));

const weekendRate = calculateWeeklyHabitRate(
  weekendLogs, 'weekend', new Date(2026, 10, 8), 'weekends'
);
check(
  weekendRate.completed === 2 && weekendRate.scheduled === 2 && weekendRate.rate === 100,
  'Weekend rate uses two scheduled days'
);

const weekdayStreak = calculateStreaks(
  weekdayLogs, 'weekday', '2026-11-09', 'weekdays'
);
check(
  weekdayStreak.currentStreak === 5 && weekdayStreak.longestStreak === 5,
  'Weekday streak crosses Saturday and Sunday'
);

const weekendStreak = calculateStreaks(
  weekendLogs, 'weekend', '2026-11-09', 'weekends'
);
check(
  weekendStreak.currentStreak === 2 && weekendStreak.longestStreak === 2,
  'Weekend streak counts Saturday and Sunday'
);

const weeklyRate = calculateWeeklyHabitRate(
  [{ habitId: 'weekly', date: '2026-11-04', completed: true }],
  'weekly', new Date(2026, 10, 8), 'weekly'
);
check(
  weeklyRate.completed === 1 && weeklyRate.scheduled === 1 && weeklyRate.rate === 100,
  'Weekly frequency accepts one completion in the current calendar week'
);

const priorWeekOnlyRate = calculateWeeklyHabitRate(
  [{ habitId: 'weekly-boundary', date: '2026-11-01', completed: true }],
  'weekly-boundary', new Date(2026, 10, 8), 'weekly'
);
check(
  priorWeekOnlyRate.completed === 0 && priorWeekOnlyRate.rate === 0,
  'Previous Sunday does not count in the new Monday-Sunday week'
);

const nextWeekOnlyRate = calculateWeeklyHabitRate(
  [{ habitId: 'weekly-boundary', date: '2026-11-09', completed: true }],
  'weekly-boundary', new Date(2026, 10, 8), 'weekly'
);
check(
  nextWeekOnlyRate.completed === 0 && nextWeekOnlyRate.rate === 0,
  'Next Monday does not count in the current calendar week'
);

const weeklyStreak = calculateStreaks([
  { habitId: 'weekly-streak', date: '2026-10-26', completed: true },
  { habitId: 'weekly-streak', date: '2026-11-04', completed: true }
], 'weekly-streak', '2026-11-08', 'weekly');
check(
  weeklyStreak.currentStreak === 2 && weeklyStreak.longestStreak === 2,
  'Weekly streak counts consecutive Monday-start weeks'
);

check(
  app.includes(`habits.find(h => h.id === habitId)?.frequency || 'daily'`),
  'App passes frequency into streak calculation'
);
check(
  app.includes('calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency)'),
  'App passes frequency into weekly rate calculation'
);
check(
  app.includes('isHabitScheduledOnDate(h.frequency, todayStr)'),
  'Productivity score respects unscheduled days'
);
check(
  app.includes('{weekly.completed}/{weekly.scheduled} days'),
  'Habit UI displays scheduled-day denominator'
);

// Habit UI write paths must be centralised and surface persistence/refresh failures.
check(
  (app.match(/StorageService\.habits\.logCompletion\(/g) || []).length === 1 &&
  app.includes('const handleHabitCompletion = async'),
  'Habit completion writes are centralised in one UI handler'
);
check(
  app.includes("showToast(error instanceof Error ? error.message : 'Could not update habit completion', 'danger')"),
  'Habit persistence failures are visible to the user'
);
check(
  app.includes('was saved, but the screen could not refresh'),
  'Successful saves with failed UI refresh are reported accurately'
);
check(
  app.includes('was saved, but notification schedules could not refresh'),
  'Notification refresh failures do not misreport the habit save as failed'
);
check(
  app.includes('handleHabitCompletion(h.id, h.name, todayStr, stats.completedToday)'),
  'Dashboard and Habits tab use the shared completion handler'
);
check(
  (app.match(/StorageService\.habits\.delete\(/g) || []).length === 1 &&
  app.includes('const handleHabitDeletion = async'),
  'Habit deletion is centralised in one UI handler'
);
check(
  app.includes("showToast(error instanceof Error ? error.message : 'Could not delete habit', 'danger')"),
  'Habit deletion failures are visible to the user'
);
check(
  app.includes('handleHabitDeletion(h)'),
  'Habits tab uses the shared deletion handler'
);

console.log(`PRODUCTION HABIT ANALYTICS TESTS: ${passed}/30 PASSED`);
if (passed !== 30) process.exitCode = 1;
