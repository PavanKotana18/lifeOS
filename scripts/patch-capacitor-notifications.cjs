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


const publisher = path.join(path.dirname(manager), 'TimedNotificationPublisher.java');
const receiver = fs.readFileSync(publisher, 'utf8').replace(/\r\n/g, '\n');
if (!receiver.includes('lifeos_alarm_events')) {
  const marker = '        NotificationStorage storage = new NotificationStorage(context);';
  if (!receiver.includes(marker)) throw new Error('Capacitor Android receiver changed.');
  fs.writeFileSync(publisher, receiver.replace('        notification.when = System.currentTimeMillis();', '')
    .replace(marker, [
      '        if (notification == null || notificationManager == null || id == Integer.MIN_VALUE) return;',
      '        long firedAt = System.currentTimeMillis();',
      '        notification.when = firedAt;',
      '        android.content.SharedPreferences events = context.getSharedPreferences("lifeos_alarm_events", Context.MODE_PRIVATE);',
      '        android.content.SharedPreferences.Editor event = events.edit();',
      '        java.util.Map<String, ?> history = events.getAll();',
      '        if (history.size() >= 64 && !history.containsKey(Integer.toString(id))) {',
      '            history.entrySet().stream().filter(row -> row.getValue() instanceof Long)',
      '                .min(java.util.Comparator.comparingLong(row -> (Long) row.getValue()))',
      '                .ifPresent(row -> event.remove(row.getKey()));',
      '        }',
      '        event.putLong(Integer.toString(id), firedAt).apply();',
      marker,
    ].join('\n')).replace(
      '        LocalNotificationsPlugin.fireReceived(notificationJson);\n        notificationManager.notify(id, notification);',
      '        notificationManager.notify(id, notification);\n        if (notificationJson != null) LocalNotificationsPlugin.fireReceived(notificationJson);'
    ));
}

const patchedManager = fs.readFileSync(manager, 'utf8').replace(/\r\n/g, '\n');
if (!patchedManager.includes('LifeOS: reject elapsed schedules before changing any alarm.')) {
  const loop = '        for (LocalNotification localNotification : localNotifications) {';
  const elapsed = '                Logger.error(Logger.tags("LN"), "Scheduled time must be *after* current time", null);\n                return;';
  const cancelFlags = '        int flags = 0;\n        if (android.os.Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {\n            flags = PendingIntent.FLAG_MUTABLE;\n        }\n        PendingIntent pi';
  if (![loop, elapsed, cancelFlags].every(marker => patchedManager.includes(marker))) throw new Error('Capacitor schedule/cancel implementation changed.');
  fs.writeFileSync(manager, patchedManager.replace(loop, [
    '        // LifeOS: reject elapsed schedules before changing any alarm.',
    '        for (LocalNotification entry : localNotifications) {',
    '            LocalNotificationSchedule definition = entry.getSchedule();',
    '            if (definition != null && definition.getAt() != null && definition.getAt().getTime() <= System.currentTimeMillis()) {',
    '                if (call != null) call.reject("Reminder time has already passed");',
    '                return null;',
    '            }',
    '        }',
    loop,
  ].join('\n')).replace(elapsed, '                throw new IllegalArgumentException("Reminder time elapsed during registration");')
    .replace('            buildNotification(notificationManager, localNotification, call);', [
      '            try { buildNotification(notificationManager, localNotification, call); }',
      '            catch (RuntimeException error) {',
      '                if (call != null) call.reject("Android could not register the reminder", error);',
      '                return null;',
      '            }',
    ].join('\n'))
    .replace(cancelFlags, cancelFlags.replace('int flags = 0', 'int flags = PendingIntent.FLAG_NO_CREATE').replace('flags = PendingIntent.FLAG_MUTABLE', 'flags |= PendingIntent.FLAG_MUTABLE'))
    .replace('            alarmManager.cancel(pi);', '            alarmManager.cancel(pi);\n            pi.cancel();'));
}
