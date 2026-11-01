const fs = require('fs');
const assert = require('assert');

const domain = fs.readFileSync('src/services/domainUtils.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert(domain.includes("frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' = 'daily'"));
assert(domain.includes('isHabitScheduledOnDate(frequency, key)'));
assert(domain.includes("if (frequency === 'weekly')"));
assert(app.includes("habits.find(h => h.id === habitId)?.frequency || 'daily'"));
assert(app.includes('calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency)'));
assert(app.includes('isHabitScheduledOnDate(h.frequency, todayStr)'));
assert(app.includes('{weekly.completed}/{weekly.scheduled} days'));

console.log('PRODUCTION HABIT ANALYTICS WIRING: 7/7 PASSED');
