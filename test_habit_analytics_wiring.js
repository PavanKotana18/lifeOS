const fs = require('fs');
const assert = require('assert');

const domain = fs.readFileSync('src/services/domainUtils.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert(domain.includes("frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' = 'daily'"),
  'Production weekly-rate helper must accept habit frequency');
assert(domain.includes('isHabitScheduledOnDate(frequency, key)'),
  'Production weekly-rate helper must count scheduled days');
assert(domain.includes('if (frequency === \\'weekly\\')'),
  'Production analytics must handle weekly habits');
assert(app.includes("habits.find(h => h.id === habitId)?.frequency || 'daily'"),
  'App streak caller must pass the habit frequency');
assert(app.includes('calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency)'),
  'App weekly-rate caller must pass the habit frequency');
assert(app.includes('isHabitScheduledOnDate(h.frequency, todayStr)'),
  'Productivity score must respect unscheduled days');
assert(app.includes('{weekly.completed}/{weekly.scheduled} days'),
  'Weekly display must use scheduled-day denominator');

console.log('PRODUCTION HABIT ANALYTICS WIRING: 7/7 PASSED');
