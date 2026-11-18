# Functional recovery audit

Baseline: Debug source 91121b7. The baseline mounted report and screenshots are in
`%LOCALAPPDATA%/LifeOS/checkpoints/full-app-acceptance-2026-11-18T13-39-22-661Z`.
The recovery branch is `recovery/before-functional-reliability` at 93584f4.

| Screen and controls | Handler and durable effect | Failure, refresh, and evidence |
| --- | --- | --- |
| Today and Plan, create or edit task | App record composer validates fields and calls encrypted task add or update. Saves due-alert choice and relative reminder. | Form stays open on write failure. Committed tasks reload and native schedules reconcile. Due-time contract and mounted task journey. |
| Plan, view, search, and filters | PlanHub applies local predicates to the encrypted task list. The dialog stages changes until Apply. | Empty results are announced. Calendar and detail navigation use existing routes. Mounted filter journey. |
| Task detail, completion, edit, subtasks, delete | Encrypted task update, completion, recurrence, or confirmed delete. Reload and reconcile alert IDs. | Native pending is distinct from delivery. Due-time, recurrence and storage suites. |
| Money, period and destinations | MoneyPeriod changes the displayed month. Accounts, Transactions, Budgets, Savings, Insights and Plans reach the existing destination handlers. | Native month input and keyboard are browser-checked where mounted. Calculations use existing exact amounts and locale behavior. |
| Money, transaction, budget and savings composers | App calls transaction, budget, savings and contribution services. Contribution and balance updates are atomic. | Dirty forms confirm discard. Save guards suppress double writes. Encrypted storage, finance suites and mounted creation journeys. |
| Money, accounts, transfers, plans and exchange rates | The shared composer style wraps the existing entity-specific MoneyAccounts and MoneyPlanning callbacks. | Existing validation, retry, confirmation and refresh paths retained. Directed Money and accounting regression suites. |
| Life, habits, quantity and history | Check-ins and quantity actions call encrypted habit and log operations. Stored units remain attached to history. | Reopen, undo and edit use existing handlers. Mounted binary and quantity journeys. |
| Life, goal progress and milestones | Goal detail and composers use goal and milestone handlers and recompute progress after reload. | Numeric and milestone progress remain separate. Mounted goal and atomicity checks. |
| Profile, display name | Encrypted setting via updateDisplayName. | Privacy and profile contracts and mounted reload. |
| Appearance, display mode, themes, accent and motion | Existing preview/apply, theme and motion settings handlers. | Theme, custom accent and motion suites. |
| Preferences, currency, locale, units, formats, week start and swipe | ProfilePreferences calls preference storage. Date-only alert time has a separate setting and schedule reconciliation. | Date-only alerts default off. If enabled, the time is interpreted in the device timezone when scheduled. |
| Notifications, master, categories, precise reminders and Android access | Existing runtime permission and system settings bridges. Master-off and disabled categories remain off during ordinary save. | Native alarm delivery and timing remain unverified. |
| Privacy & Security, lock, biometrics and recovery | Existing Android Keystore and recovery lifecycle. Selecting Back after canceling the picker returns to recovery choices. | Saving is required only to record a confirmed kit. Deferral preserves the protected local key. |
| Backup & Restore | Existing encrypted export, import validation, and confirmation flows. | Sentinel uses disposable backup files. Actual Android file picker needs a device run. |
| About and Developer tools | About links to the bundled MIT notice. Debug tools expose privacy-safe native diagnostics and guarded sample and setup controls. | Synthetic sample round trip and manifest/build verification. |

This is the route and operation inventory. It does not certify each individual
control or provide on-device coverage for every nested screen.

## Short Android check

1. In LifeOS Debug, enable notifications. Use the immediate test in Profile, Developer tools.
2. Create a task due in two minutes with no extra reminder and lock the phone. Note the expected and visible times. Tap the alert from a cold start and confirm the task opens.
3. Create a task due in seven minutes with a five-minute lead. Verify two distinct alerts. Repeat with one task edited, one completed and one deleted.
4. In Developer tools, compare expected time, native queue acceptance, receiver time, OS post time and tap time. Record drift and the permission, precision and channel states.
5. For the extended matrix, repeat after normal process exit, reboot, timezone changes, permission/channel changes and with simultaneous tasks. Do not infer delivery from an accepted alarm.

References: Android AlarmManager guidance, installed Capacitor Local Notifications 6.1.3 MIT code, and architectural review of Tasks.org and Fossify Clock. The receiver journal extends the existing Capacitor receiver and uses numeric IDs and timestamps.
