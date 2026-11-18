'use strict';

// Targeted adaptations to Capacitor Local Notifications 6.1.3 (MIT).
// The upstream source and copyright notice remain in the installed dependency.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../node_modules/@capacitor/local-notifications');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '6.1.3') throw new Error('Review LifeOS Android alarm changes before upgrading Capacitor Local Notifications.');
const manager = path.join(root, 'android/src/main/java/com/capacitorjs/plugins/localnotifications/LocalNotificationManager.java');
const source = fs.readFileSync(manager, 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {');
const end = source.indexOf('\n    public void cancel(PluginCall call)', start);
if (!source.includes('LifeOS: permission may change between check and registration.')) {
  if (start < 0 || end < 0) throw new Error('Capacitor Android alarm implementation changed.');
  const replacement = [
    '        // LifeOS: permission may change between check and registration.',
    '        boolean allowIdle = schedule.allowWhileIdle();',
    '        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {',
    '            try {',
    '                if (allowIdle) {',
    '                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent);',
    '                } else {',
    '                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, trigger, pendingIntent);',
    '                }',
    '                return;',
    '            } catch (SecurityException denied) {',
    '                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) throw denied;',
    '            }',
    '        }',
    '        if (allowIdle) {',
    '            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent);',
    '        } else {',
    '            alarmManager.set(AlarmManager.RTC_WAKEUP, trigger, pendingIntent);',
    '        }',
    '    }',
    '',
  ].join('\n');
  fs.writeFileSync(manager, source.slice(0, start) + replacement + source.slice(end));
}
