# Android notification check

Use LifeOS Debug and create a new personal test task. Sample tasks stay silent.

1. In Profile → Developer tools, run the immediate and +10 second tests. Record whether each appeared.
2. Turn on task alerts. Set one task due in two minutes without an early reminder. Set a second due in five minutes and lock the screen.
3. For each test record expected time, receiver time, visible post time, drift, and tap destination. Compare restored records after closing the app normally.
4. Repeat with a separate early alert, then after moving, completing, or deleting a task. A stale alert should not appear.
5. Repeat with precise access off, then enable it through Profile → Notifications. Confirm Android returns to LifeOS and rechecks access. Also test reboot and time zone changes.

The saved pending list is Capacitor storage. A receiver event confirms firing. A visible notification or active OS post confirms posting. Inexact alarms can be delayed, so a late post is different from a missing receiver event.
