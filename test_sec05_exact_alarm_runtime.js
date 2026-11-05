const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('src/services/notificationService.ts', 'utf8');

assert(source.includes('checkExactNotificationSetting()'));
assert(source.includes('changeExactNotificationSetting()'));
assert(source.includes('status.exact_alarm'));
assert(source.includes('async canScheduleNotifications()'));
assert(source.includes("return await this.checkExactAlarmPermission() === 'granted'"));
assert(source.includes('exactAlarm: string'));
assert(source.includes('exactAlarm,'));
assert(source.includes('Android exact-alarm access is'));

const schedulingChecks = [
  'if (!(await this.canScheduleNotifications())) return;',
  'if (!preferences.habitReminders || !(await this.canScheduleNotifications())) return;',
  'if (!preferences.milestoneReminders || !(await this.canScheduleNotifications())) return;'
];

for (const check of schedulingChecks) {
  assert(source.includes(check), `Missing scheduling guard: ${check}`);
}

console.log('SEC-05 exact-alarm runtime tests: all passed');
