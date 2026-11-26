# LifeOS experience reconstruction

The owner-tested source is `de82584e46b9604c9e2d26d81b205c33fce042a6`. Its Debug APK has versionCode 1000004 and SHA-256 `44051754ef78055505706060c51e0815fbd84bdc668d604494d7a04abb20ca67`. The local checkpoint is `checkpoint/experience-reconstruction-input`. This work uses `feature/experience-reconstruction` in `lifeOS-experience-reconstruction`. The observed remote main tip was `20d2a58`. The original `lifeOS` worktree had six unrelated modified test files. Those changes remain in that worktree.

## Screen and conditional route inventory

| Area and route | Screens and controls | Practical verification |
| --- | --- | --- |
| Today / dashboard | Greeting, focus, overdue tasks, task completion and undo, habit check-in, agenda, summaries, empty state, customization and reorder | First launch, completed and overdue task journeys, populated dashboard and customization |
| Money / overview and monthly | Month, income, expenses, net cash flow, monthly summary, budgets, savings contributions, transaction shortcuts, account/savings launch points | Money journey and responsive audit |
| Money / activity | Amounts, account/category/currency/type/date/range filters, sort, clear, select transaction, edit and deletion confirmation | Posted expense, filtering and transaction detail journeys |
| Money / accounts | Balances, add/edit/archive/delete, recent ledger entries, transfers, edit/cancel/reversal | Accounts and transfers journey, finance core and encrypted records tests |
| Money / budgets and savings | Add/edit budget, optional category/carryover, usage, add/edit/archive savings goal, contribution and delete, savings projection | Budget, savings and projection journeys, financial regression tests |
| Money / scheduled | Upcoming, recurring, recorded history, exchange rates, add/edit/record/pause/delete commitment, linked category/account, next due item, forecast | Scheduled records and posting history, commitment regression tests |
| Money / insights | Analytics range, chart regions and tooltips, recorded period information, empty chart | Populated and empty chart, range and responsive journey |
| Plan / tasks | Upcoming, today, unscheduled, completed, overdue, search, filters, add/edit, detail, completion and reopen, subtasks, notifications | Task creation, completion, navigation, filtering and encrypted persistence |
| Plan / planner | Task detail deep links, calendar, selected day, periods, search, overdue filter, reminder help | Timed task and notification fixture journeys |
| Plan / habits | Quantity and checkbox check-in, change date, edit, schedule, tracking, reminders, history, skip, archive | Basic and quantity check-in journeys, habit logic tests |
| Plan / goals | Status and category filters, create/edit, optional deadline, progress, milestone and toggle, pause/resume, archive/remove, history | Goal and milestone journeys and goal state tests |
| Plan / insights | Summary routes reached through task and goal progress, historical movement and empty states | Screen discovery and source inventory |
| Profile / home and appearance | Avatar, name and encrypted photo, Appearance, Themes, Accent, Motion, display font density | Photo persistence, settings and large-text journey |
| Profile / preferences | Currency, dates, locale, time, unit choices, swipe preference | Preferences and permissions coverage |
| Profile / notifications | Permission states, reminder levels, exact alarm help, settings handoff | Browser fixture and notification source tests. Android permission UI requires native testing. |
| Profile / privacy, app lock and recovery | Biometrics, automatic lock, recovery setup, export provider failure and fallback | Secure boot/recovery fixtures. Native credentials and physical WebView are separate. |
| Profile / backup, about and licenses | Encrypted export and restore, confirmations, version and licenses, developer tools with synthetic-data flows | Secure backup, recovery and developer workflows |
| System | Launch, onboarding, startup errors, device authentication, background/foreground, notification-driven navigation, file and photo chooser, permission dialogs, exit | Browser mocks and domain regressions. Platform interactions require native capability. |
| Shared controls | Present and unavailable actions, full-page composers, selection sheets, disclosure triggers, info, confirmation, date/time inputs, nav, empty results and validation | Source enumeration plus rendered state discovery and explicit operation assertions |

## Interaction standards

Use sentence-case Add for new records, Edit for existing records, and Save changes to confirm edits. Recording a transfer or an occurrence and updating existing progress describe their separate ledger operations. Preserve Activity for recorded entries and Scheduled for plans. Optional fields are grouped as Notes and subtasks, Task category, Schedule options, Reminders, Habit notes, or Target date and notes.

Use FeatherHeader and ComposerShell for shared geometry. Use one PreferenceChoice sheet for ordinary selections, with search for catalog-sized choices. Native date, time, biometrics, system permissions, and file and photo picking keep their platform interactions. Existing data records, currency calculations and security boundaries continue to use their original services.

Radix Dialog and React Aria Select were evaluated for focus management and accessible collections. LifeOS already uses a styled modal HTML dialog for settings and task priority. Its top-layer behavior gives the existing browser and WebView dialog stack one place to manage modality, Escape, focus isolation, and custom Android Back routing. Extending it with real buttons and search avoids a second dialog stack. [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) · [React Aria component release notes](https://react-spectrum.adobe.com/v3/releases/2025-10-02.html) · [Modal dialog behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)

## Coverage records

Run `node scripts/audit-action-inventory.cjs . controls.json` for source candidates, computed labels, conditional branches and handlers. Enable `LIFEOS_ACTION_AUDIT=1` in the full browser suite for the actual rendered inventory and actions. It uses disposable synthetic data and suppresses discovery while recovery material is rendered. A source definition, visibility or recorded event alone is insufficient for a verified classification. The audit preserves untested rows explicitly. Baseline source discovery found 448 control definitions, including 42 ordinary HTML selects.
