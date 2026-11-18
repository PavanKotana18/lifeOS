# LifeOS Android notification check

This is a manual, user-controlled check for the isolated **LifeOS Debug** app. Run it only when you choose on your own Android phone. No ADB, remote access, release build, or change to the existing `.dev` / `.preview` apps is needed. Keep the test tasks generic; their titles are not intended to appear in notifications.

Record the Android version, device model, app source commit, APK SHA-256, notification permission, reminder channel state, and exact-alarm access state. A schedule being accepted or listed as pending is not proof that Android displayed it.

## Permission and channel setup

1. Install the `com.lifeos.personal.debug` APK using the phone's normal user-controlled install flow. Confirm the launcher label is **LifeOS Debug**.
2. Start fresh onboarding, enter a name, complete biometric and recovery setup or take the explicit deferrals, and verify Today appears. Tap **Enable notifications** on the opt-in sheet and record the Android result. Also run a separate denial pass if you want to verify the denial path; then enable notifications later from LifeOS and record whether Android offers a retry.
3. In Android app settings, record whether notifications are allowed and whether the LifeOS reminder channel is enabled, visible, and audible. Do not change settings until after noting the initial state.
4. In the LifeOS reminder settings, record exact-alarm access. If denied, create one reminder and confirm the app reports approximate timing. Grant special access only if you choose to test that separate path; return to LifeOS and confirm it rechecks the state.

## Timing and lifecycle passes

For each row, record the task's chosen local trigger time, the time shown in LifeOS, the observed notification time (or **not observed**), and the resulting delivery status. Keep the screen locked where specified. Do not count a vanished pending row as a fired notification.

| Pass | Action | Record |
| --- | --- | --- |
| Immediate | Use Profile ? Developer tools to send the immediate test notification. |
| +2, +5, +10 minutes | Create individual reminders at those offsets; leave LifeOS foregrounded for the first pass. | Trigger time, native accepted/pending status, visible notification time, tap result. |
| Background | Schedule a reminder about five minutes ahead; background the app and lock the screen. | Trigger and observed time, lock-screen privacy, title/body shown, tap destination. |
| Process stopped | Schedule about five minutes ahead, then normally dismiss LifeOS from Recents without force-stopping it. | Whether it appears and the measured drift. |
| Edit | Move a pending reminder to a new time. | Old trigger does not appear; new trigger appears once. |
| Cancel / complete | Cancel one reminder, then complete another task with a reminder. | Neither canceled nor completed reminder appears. |
| Close together | Schedule two reminders a minute apart, then test two at the same instant. | Both distinct reminders appear once, with the correct task destination after each tap. |
| Recurring task | Save a recurring task with a reminder and complete one occurrence. | Next occurrence has one reminder at its saved time; no duplicate. |
| Reboot | Schedule a reminder several minutes ahead, restart the phone, then unlock it. | Whether the reminder is restored and observed at the expected time. |
| Time change | Change timezone while a future reminder is pending; restore your original timezone afterward. | The intended local-time behavior and observed drift. |
| Cold-start tap | Close LifeOS normally, tap a still-active reminder, and unlock if prompted. | Whether the correct task opens after app startup and secure unlock. |
| Channel and display permission | Disable the reminders channel and then re-enable it. Repeat with Android notification permission. | Record settings, whether a future test can post, and recovered timing. |
| Exact access | Repeat the background timing pass with exact access granted, then denied if desired. | Actual firing time and drift in each state. |

Use the app's diagnostic timeline to record **requested**, **native accepted**, **pending observed**, **Android posted/receiver event**, **tapped**, **cancelled**, **failed**, or **delivery unconfirmed**. Compare Android's displayed notification history with those entries. A scheduling result alone is not a delivery pass.

## Result sheet

Mark each case **PASS**, **FAIL**, **BLOCKED**, or **NOT RUN**. For every observed notification, record `observed time − intended trigger time` as the drift. Include denied permissions, muted channels, battery restrictions, and Android settings state as observations. Avoid screenshots containing private task data.

An emulator/automated build or source-level test does not replace these device observations. Until the owner runs and records these cases, real-device reminder delivery remains **NOT RUN**.
