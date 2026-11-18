# Notification engineering research — 2026-11-18

This is source review, not evidence that a reminder appeared on an Android device.

## Sources examined

| Project | Revision examined | License | Relevant Android implementation |
| --- | --- | --- | --- |
| [Capacitor Local Notifications](https://github.com/ionic-team/capacitor-local-notifications) | Installed `@capacitor/local-notifications` **6.1.3**; upstream tag `@capacitor/local-notifications@6.1.3`, source commit [`74b70a60766f0db11b85e911f99c9b59fbabdd08`](https://github.com/ionic-team/capacitor-plugins/commit/74b70a60766f0db11b85e911f99c9b59fbabdd08) | MIT | Capacitor Android plugin; the currently installed 6.x release is the compatibility target. Reviewed Android implementation includes `LocalNotificationManager`, `LocalNotificationRestoreReceiver`, `TimedNotificationPublisher`, `NotificationStorage`, and `LocalNotificationsPlugin`. |
| [Tasks.org](https://github.com/tasks/tasks) | `main` at [`0bd6ea2330916dd2c66f637f37d7aa9158db6e77`](https://github.com/tasks/tasks/commit/0bd6ea2330916dd2c66f637f37d7aa9158db6e77), 2026-11-18 | GPL-3.0 | Android task app with a current `main` commit on the review date. Reviewed `WorkManagerImpl`, `NotificationSchedulerWork`, `NotificationReceiver`, `SystemEventReceiver`, `ScheduleExactAlarmsPermissionReceiver`, manifest receivers, and permissions. |
| [Fossify Clock](https://github.com/FossifyOrg/Clock) | `main` at [`4f2b697ddd8efa3fb66d6ff45171f0c2d6f1897e`](https://github.com/FossifyOrg/Clock/commit/4f2b697ddd8efa3fb66d6ff45171f0c2d6f1897e), 2026-11-18 | GPL-3.0 | Android clock app with a current `main` commit on the review date. Reviewed `AlarmController`, `Context.setupAlarmClock`, `RescheduleAlarmsReceiver`, and Android manifest. |
| Android platform | Official AlarmManager guide and Android permission APIs, reviewed 2026-11-18 | Android SDK terms | `AlarmManager`, `NotificationManager`, notification channels, `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` |

The installed app uses `@capacitor/android` 6.2.3, `@capacitor/local-notifications` 6.1.3, Gradle 8.2.1 and Android Gradle Plugin 8.2.1. No Capacitor major-version upgrade was attempted.

Maintenance and Android support here describe the exact snapshot inspected on 2026-11-18, not a promise of future support. The Capacitor plugin is the app's installed Android dependency; the Tasks.org and Fossify revisions were current repository commits observed on the review date.

## Findings

### Capacitor Local Notifications 6.1.3

- `schedule()` persists each scheduled notification JSON in plugin `SharedPreferences`, then creates an Android `PendingIntent` and registers it with `AlarmManager`. It does not use JavaScript timers as the scheduler.
- A one-time `Date` schedule uses an RTC alarm. With exact-alarm capability it uses `setExactAndAllowWhileIdle()` when `allowWhileIdle` is true. Without exact-alarm capability it uses `setAndAllowWhileIdle()` for that case, or a plain inexact `set()` otherwise. The API result means registration was accepted; it does not prove notification delivery.
- `LocalNotificationRestoreReceiver` listens for `BOOT_COMPLETED`, `LOCKED_BOOT_COMPLETED` and `QUICKBOOT_POWERON`, reloads the plugin's saved notification rows, and schedules them again. It does not subscribe to `TIME_SET` or `TIMEZONE_CHANGED`.
- `cancel()` cancels the notification ID's pending alarm and visible notification, then deletes the saved plugin row. The ID is also the `PendingIntent` request code, so the caller must keep IDs stable and detect collisions.
- `LocalNotificationManager` creates a default channel and supports named channels. Android channel importance and visibility are controlled by the app and the user can later mute a channel.
- `requestPermissions()` handles Android 13+ `POST_NOTIFICATIONS`. `changeExactNotificationSetting()` is a separate Android system-settings flow for exact alarms. Version 6 does not automatically open exact-alarm settings just because `schedule()` is called.
- The system receiver can fire when the WebView process is not alive. A force-stopped package, OEM background restrictions, revoked permissions and muted channels remain outside the scheduling call's guarantee.
- MIT permits reuse with its license and copyright notices retained. LifeOS already depends on this plugin; no plugin source was copied or modified.

### Tasks.org

- Current source separates scheduled reminder timing from notification rendering. `WorkManagerImpl` registers eligible times with `AlarmManager.setExactAndAllowWhileIdle()` and hands delivery work to WorkManager; `NotificationSchedulerWork` rebuilds channels and refreshes notifications.
- The manifest declares `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` and `RECEIVE_BOOT_COMPLETED`; receivers handle reboot, package replacement, exact-permission state changes and notification scheduling.
- This is a broad task application with encrypted sync and multiple platform modules. Its GPL-3.0 distribution obligations make copying implementation code into LifeOS's distribution inappropriate without a deliberate GPL compliance decision. No source was copied.

### Fossify Clock

- `Context.setupAlarmClock()` uses `AlarmManagerCompat.setAlarmClock()` for user-visible clock alarms and `setExactAndAllowWhileIdle()` for the upcoming-alarm dismissal notification. `AlarmController` cancels and rebuilds alarms from persisted alarm records.
- `RescheduleAlarmsReceiver` rebuilds alarms after reboot, package replacement, quick boot, wall-clock changes and timezone changes.
- This design serves a true alarm-clock product, including its user-visible alarm-clock status. It is not suitable as a direct model for ordinary LifeOS task reminders. Its source is GPL-3.0; no source was copied.

### Official Android APIs

- `AlarmManager` operates outside the app process lifetime. Inexact alarms can be deferred; on Android 12+ ordinary inexact alarms may be delivered within an hour of their target, with further delay under Doze or battery-saving restrictions.
- `SCHEDULE_EXACT_ALARM` is special app access. LifeOS declares it and checks its state. It does not declare `USE_EXACT_ALARM` and does not use an alarm-clock exemption.
- Android 13+ requires runtime `POST_NOTIFICATIONS` permission before ordinary notifications can appear. Channel state and application-level notification state are independent gates.

## LifeOS fit and decision

The installed Capacitor plugin is the narrowest compatible scheduler for this Capacitor 6 app. It already supplies native alarm registration, reboot recovery, cancellation, channels and permission APIs. Replacing it with Task.org or Fossify would add GPL obligations and a much larger native surface without evidence that the plugin API is the current delivery failure. No additional library was adopted.

The app's explicit task reminder schedules request idle-aware alarms; exact-alarm access selects exact delivery where Android permits it. When access is unavailable, the app reports approximate timing and retains the saved reminder. Upcoming-deadline alerts use a less aggressive inexact path. Notification content remains generic so task names are not exposed on a lock screen.

Wall-clock and timezone changes are rechecked when LifeOS resumes and its current task schedule is reconciled. The plugin itself does not re-map an already registered RTC instant on timezone change. A reminder saved as an ISO instant retains that instant; date-only deadline reminders are recomputed on app resume. A device test is still required to verify this behavior on supported Android versions.

## Confirmed root cause and remaining evidence

- **Confirmed before this branch's fix:** `DEFAULT_NOTIFICATION_PREFERENCES` set every category to `false`, and completing the one-step welcome did not request `POST_NOTIFICATIONS`. A new user could finish onboarding with every schedule disabled unless they found a settings switch or explicitly enabled a reminder while creating a task.
- **Fixed in this branch:** the first successful welcome requests Android notification permission once after the main screen becomes visible. Category defaults are saved only after grant. Existing saved preferences are left unchanged. Exact-alarm access is offered separately when reminder categories are enabled; denial is described as approximate timing.
- **Confirmed from source:** the native plugin falls back to an inexact alarm when exact access is unavailable; a successful schedule call or a pending row is not proof of a visible notification.
- **Not established:** the owner's reported missed notification's device permission state, channel state, exact-alarm state, OEM background policy, actual firing time, or cause. No physical phone was accessed and no emulator was started in this work.

The required real-device cases remain **NOT RUN**. The current debug build is source/package verified only; notification delivery is not claimed as reliable.
