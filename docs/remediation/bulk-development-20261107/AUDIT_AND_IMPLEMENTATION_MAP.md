# LifeOS bulk development audit and implementation map

Checkpoint: branch `feature/lifeos2-bulk-development-20261107`, based on PR #24 commit `f1a26b199f4db8b7b0f64fd9136f23d6dfebb927`.

## Current architecture

```text
React screens (src/App.tsx + src/components/*)
  → domain/services (financeCore, financeAnalytics, userPreferences, notificationService)
  → IDataStorage facade (StorageService)
  → encrypted repositories / encrypted transaction coordinator
  → Dexie `LifeOS_Database` (IndexedDB)
  → Capacitor plugins and Android native receivers where required
```

Finance screens (`MoneyHome`, `FinanceProjection`, `FinanceCharts`, savings views) are separate components. `financeCore.ts` provides integer minor-unit arithmetic, a versioned offline currency catalog, manual FX conversion helpers and projection math. New financial entries now also retain optional exact minor-unit strings and explicit currency codes. Older entries remain untouched and continue to use the reporting-currency context protected by the existing preference lock. Transactions still support only income and expense; no transfer/account repository exists.

## Verified risks and gaps

| Area | Evidence | Implementation implication |
|---|---|---|
| Profile/settings | `src/App.tsx` is 2,421 lines; Profile, Appearance, notification controls and security actions are rendered in the monolithic settings branch. | Extract focused profile screens while preserving existing callbacks and encrypted settings paths. |
| Navigation | `navigationCatalog.ts` maps the four primary destinations to existing tabs; `tabHistory.ts` owns back history. No horizontal swipe gesture currently exists. | Add one guarded gesture controller that calls the existing navigation function; do not create another route state machine. |
| Financial schema | Dexie remains schema version 1. Financial types now accept optional `amountMinor` and `currencyCode` metadata; raw/encrypted storage and backup validation check paired fields and exact/major consistency. No account or transfer fields/table exist. | Additive fields are safe without a table migration and old backups remain valid. Do not infer currencies for old records. Accounts/transfers still need coordinated schema, encrypted-admission and backup changes. |
| Encrypted storage | `encryptedStorageIntegration.ts` allow-lists encrypted tables and migrates rows with verify-before-replace. Backup validation enumerates known tables. | Any new table needs coordinated changes across Dexie, the encrypted facade, migration, backup validation/import/export and tests. |
| Notification engine | `notificationService.ts` delegates scheduling to Capacitor Local Notifications; Android manifest uses the plugin’s broadcast receivers. | Retain this working path. A second Kotlin scheduler would risk duplicate schedules and needs proof before implementation. |
| Dependencies | React/TypeScript, Dexie 4, Capacitor 6, Recharts and Lucide are already installed. No additional UI/gesture library is required for the requested work. | Avoid dependency changes; use existing components and native pointer/touch events. |
| Tests/CI | Extensive Node, Sentinel, signing, startup, security and Android emulator workflows already exist. | Add focused unit/service contracts and reuse CI; distinguish compile evidence from instrumented execution. |

## Safe implementation order

1. Extract and redesign Profile/Settings with existing persisted preferences and a focused screen model.
2. Add an opt-out horizontal swipe controller integrated with the existing four-tab navigation, plus deterministic gesture tests.
3. Improve Money using existing calculations and storage contracts that do not reinterpret old records (transaction filters/summaries, budgets, savings and projection clarity).
4. Add account/transfer persistence only with a versioned encrypted-schema and backup migration plan and disposable-fixture tests. Old amounts cannot be assigned a guessed currency.
5. Keep the Capacitor notification engine unless native tests establish a specific defect it can safely correct.

This report records repository evidence and a safe implementation map; it is not a claim that the listed gaps have been fixed.

## Implemented in the bulk checkpoint

- `ProfileSettings.tsx` now owns the profile identity landing view and reusable settings subpage shell. App routes appearance, preferences, notifications, privacy/security, data/backup and about independently, while preserving the existing storage/security callbacks.
- The reporting-currency picker now names each supported currency using local `Intl` data and shows the ISO code and symbol. It is disabled once transactions, budgets or savings goals exist because those legacy records do not carry an independent currency. Changing a global formatter in that state would silently relabel historical amounts. Safe per-record currency support remains deferred until encrypted codecs, indexed schema, migration admission and backup import/export can be changed together.
- Swipe navigation is an opt-out preference using the existing tab state/history. The pure gesture resolver handles direction, velocity/threshold, diagonal/vertical rejection, child-tab mapping, and no-wrap edges. App event handling excludes controls, charts, horizontal scrollers, modal/form states, settings and Android system-edge starts.

## Notification architecture decision

The current production path already uses Capacitor Local Notifications, whose Android implementation owns scheduled alarms and manifest receivers; the app also has native lifecycle/tap integration. This work adds no competing AlarmManager scheduler. A second scheduler would create duplicate IDs, competing cancellation and reboot ownership without evidence that the existing engine lacks native ownership. Real delivery/reboot behavior remains a device acceptance item.

## Verification at this checkpoint

- Full `npm test` completed without a reported failing command; the visible chain included all WP0/security/storage/finance/navigation and Android-runner simulations.
- `npm run test:sentinel`: 6 suites passed, 0 failed. SAF Android document-picker execution is not covered by this CLI result; Sentinel explicitly marks it device-blocked.
- Focused navigation, Profile, settings accessibility, finance core and analytics checks passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed; Vite retained its existing advisory that the main JavaScript chunk exceeds 500 kB.
- `git diff --check` passed.
- Local Android build/device execution is unavailable in this Termux worktree: no Android SDK variables or connected ADB device, and no checked-in Gradle wrapper. Hosted CI is the Android compilation path.

`ProfilePreferences.tsx` now owns the display/unit/currency/navigation controls as a reusable presentation component; `App.tsx` supplies the existing encrypted settings write callback and record-aware currency lock.

Currency-picker labels are memoized per selected locale, so search filters reuse labels instead of repeatedly constructing currency-format data on each keystroke.

## Finance continuation checkpoint — 2026-11-08

- New transactions, budgets, savings goals and contributions carry explicit currency identity and exact integer minor-unit strings. Major-unit numeric fields remain for compatibility with existing UI, backups and consumers; the write boundary checks they round-trip to the same minor units.
- Existing records without currency metadata are not rewritten or guessed. The global reporting currency remains protected from changes while financial records exist. Explicitly tagged records in another currency are omitted from reporting-currency totals with an explanation; no rate is fabricated.
- Savings contribution history is visible per goal and supports edit/delete. Both raw IndexedDB and encrypted storage update the goal total and contribution in one atomic mutation. Mismatched currencies and unreconciled negative totals are rejected.
- No Dexie version change or new encrypted table was introduced. Old backup rows remain accepted; optional currency/exact amount metadata is validated when present.
- Limits: accounts/opening balances/transfers, persisted manual FX rates, planned commitments, and dedicated Accounts pages are not implemented. These need a coordinated financial model and versioned encrypted backup contract; this checkpoint does not claim those features.

## Verified completion matrix — 2026-11-08

**Scope source:** The repository has no separate overnight requirements specification. The original scope is captured in the initial audit, dated entries in `OVERNIGHT_PROGRESS.md`, and the active mission requirements. This matrix reflects current source, tests, hosted CI, and user-reported device checks. Earlier implementation-map statements are baseline observations and are superseded where later commits added functionality.

| Requirement | Implemented functionality | Missing functionality | Known defects / limits | Test coverage / evidence | Physical-device verification needed | Status |
|---|---|---|---|---|---|---|
| Profile landing and destinations | Profile, Appearance, Preferences, Notifications, Privacy & Security, Data & Backup, About have separate destinations and back navigation. | Screen-reader and runtime visual review. | No known functional defect from source/test audit. | `test_profile_settings_20261108.cjs`, `test_settings_ui_accessibility_20261107.cjs`, PR #25 CI. | Yes: screen reader, narrow Android layout. | PARTIAL |
| Preferences and theme persistence | Existing saved callbacks, locale/units/date/time, currency safety lock, theme preview/apply/default and swipe opt-out. | Runtime restart review for all controls. | Reporting currency is intentionally locked while legacy financial rows have no per-record currency. | Profile/theme suites, encrypted settings behavior, TypeScript/build. | Yes: verify after restart and theme rendering. | PARTIAL |
| Notification preferences, privacy/security, backup, About | Existing permission/prompt flow, privacy controls, biometric/recovery controls, encrypted backup export/restore and explanations remain in Profile. | Real Android permissions, biometric, document picker and recovery lifecycle. | Notification architecture is unchanged; native behavior is not proven by local simulation. | `npm test`, Sentinel; PR CI compiled instrumentation APK only. | Yes: permission, biometric, SAF picker, restore. | BLOCKED |
| Account lifecycle and safeguards | Add/edit/archive/restore/delete; history and nonzero opening balance prevent unsafe deletion; opening amount/currency lock after activity. | None identified in reviewed workflow. | Balance is derived, not stored. | `test_db_atomicity.js` (54 assertions), encrypted facade (18), Money workflow and backup round trip. | Yes: account editor and safeguards. | COMPLETE |
| Bank, cash, credit-card accounting; opening/history | Opening amounts are not income; card purchases/payments have correct signs; opening values cannot silently change after activity. | Device usability check. | No statement reconciliation/import. | Financial accounting and database atomicity tests. | Yes: sample bank/cash/card entries. | COMPLETE |
| Income and expense entry | Explicit amount/currency, account assignment, category, edit/delete, search, sort and filters. | Keyboard/IME and compact-screen review. | Legacy untagged transactions retain their existing reporting-currency context. | Full `npm test`, Money and transaction quick-entry regressions. | Yes: numeric keyboard, edit, search, filters. | PARTIAL |
| Transfers, edit/delete/reversal/undo | Separate transfer records; edit/delete; linked exact reversal; original preserved; undo restores original; duplicate reversal and unsafe edits are blocked. | None in service contract identified. | Reversal copy needed improvement and CSV exposed internal IDs; fixed in this continuation with new assertions. | Migration/atomicity, encrypted facade, backup round trip, Money workflow; user reports ₹3,000 reversal, balance restoration, undo/reactivation and unrelated ₹5,000 preservation PASSED on device. | Updated confirmation copy still needs device review. | COMPLETE |
| Multi-currency and precision | Tagged new entries; integer minor units; explicit cross-currency transfer amounts/rates; conversions must reconcile; no automatic rate fetching. | Automatic dated conversion for analytics/projections. | Unlike currencies remain separate instead of silently combining. | Finance core, database validation, workflow, backup and encrypted storage tests. | Yes: currency/rate entry and display. | PARTIAL |
| Budgets and savings | Budget creation/display/overspend, savings goals and contribution edit/delete with atomic total updates. | Device review. | Unsupported currency comparisons are omitted with an explanation. | Budget, savings, Money, backup and full regression suites. | Yes: create/edit/contribute and restart. | COMPLETE |
| Planned bills / commitments | Add/edit/delete/pause/resume, optional account/category, explicit amount/currency/date/frequency. Never posts an expense automatically. | Occurrence advancement, reminders and mark-paid shortcut. | Plans do not alter actual balances or spending. | Migration/atomicity, Money planning render, backup round trip. | Yes: confirm plans remain separate from actual entries. | PARTIAL |
| Financial analytics and projections | Minor-unit income/expense analytics, category trends, savings projections with assumptions, per-account balances. | Currency-aware consolidated analytics/projections. | Cross-currency figures are excluded rather than fabricated. | Analytics, finance-core, projections and dashboard regression suites. | Yes: compare summaries with known entries. | PARTIAL |
| Transaction history and discovery | Search, date/category/account/currency filters, date/amount sorting and empty state. Transfers have separate Accounts history. | Richer sorting and transfer-history filters. | CSV omits internal transaction IDs, verified by regression. | Filtering/stabilization tests and WP0 LOS-010 (6 checks). | Yes: compact layout and filter interaction. | PARTIAL |
| Backup and restore compatibility | v2 adds stores without rewriting legacy rows; old 11-table backups remain accepted; new 15-table backups validate references and reversals and restore atomically. | Android SAF picker/import/export acceptance. | Browser fallback depends on runtime capabilities. | `test_backup_validation.js`, `test_backup_indexeddb.js` (6 assertions), migration/atomicity, encrypted tests, Sentinel. | Yes: actual Android export and restore. | PARTIAL |
| Money visual redesign | Overview and subpages, account cards, forms, summaries, empty states, semantic styling, accessibility labels and clearer terminology. | Human visual/usability review across device sizes. | Existing Vite large-main-chunk advisory; no source defect identified in audit. | Money UI/theme/workflow tests, Sentinel, build and hosted CI. | Yes: all Money screens, IME and narrow layouts. | PARTIAL |
| Swipe between Today, Money, Plan, Life | Existing tab state/history; persisted opt-out; thresholds and guards for diagonal motion, controls, charts, dialogs and Android system edge; no wrapping. | Gesture feel and Android back-edge interaction. | No defect identified in pure gesture resolver. | `test_navigation_gestures_20261108.cjs`, Profile preference test, full suite. | Yes: swipe/scroll/forms/charts/edge-back and toggle after restart. | PARTIAL |
| Node regressions, Sentinel, TypeScript, build | Full final `npm test` exited 0; Sentinel 6/6 exited 0; `npx tsc --noEmit` and `npm run build` pass after final changes. | None for these local automated checks. | Vite reports main JS chunk 624.36 kB (over 500 kB advisory). Sentinel marks physical SAF picker as blocked, separately from its passing service contracts. | Final reruns on this continuation; WP0 controls 11/11. | Native SAF remains device-only. | COMPLETE |
| Android CI and signed Debug APK | Exact continuation head `2a8bf8af9346e1332d98c68f5d2d0b55615f10de` passed run `42445435389`; Debug signer/package/version checks and instrumentation APK compilation passed; release signing/upload skipped. | Instrumentation APK execution and physical install/acceptance. | No local Android SDK/wrapper; no physical device use claimed. | [Hosted run 42445435389](https://github.com/PavanKotana18/lifeOS/actions/runs/42445435389); Debug artifact `13602918525`; instrumentation artifact `13603003281`. | Yes: install APK and execute acceptance checklist. | PARTIAL |
| PR/release safety | PR #25 is OPEN and draft, targeting the milestone branch; feature refs skip release signing/upload. | None requested. | PR #24 and original `~/lifeOS` remain out of scope. | `gh pr view 25`, PR description, branch guard and repository status. | No. | COMPLETE |

**Status meaning:** COMPLETE means implementation and automated contract evidence exist for the stated workflow. PARTIAL means core implementation exists with a documented functional limit or missing user/device review. BLOCKED means proof depends on Android behavior unavailable in this Termux session. NOT STARTED would mean no implementation exists; none of the audited top-level groups is wholly unstarted. Physical acceptance remains separate from code completion.

## Physical-device acceptance checklist

1. Install the Debug APK from run `42445435389`; verify package update/launch, unlock, and existing encrypted records remain readable.
2. Open every Profile destination. Change theme, locale, units, date/time formats and swipe preference; force-stop/relaunch and confirm each saved value. Check TalkBack labels and focus order.
3. From Data & Backup, export a backup with the Android document picker, cancel a second export, and restore a disposable compatible backup. Confirm success/cancel messages and that failed restore leaves existing records unchanged.
4. Create cash, bank and credit-card accounts with opening amounts. Add income, an expense and a card payment; confirm opening amounts do not appear as income, card purchases increase amount owed, and edits cannot rewrite starting balances after activity. Archive a referenced account and verify history remains.
5. Preserve the already user-confirmed transfer checks: reverse the ₹3,000 transfer, verify both balances, undo the reversal, confirm the original transfer is active again, and confirm the unrelated ₹5,000 transfer is untouched. On this APK, read the confirmation copy and verify account names/date/amount are clear and no internal ID is shown.
6. Record a cross-currency transfer with an explicit manual rate. Verify both entered amounts and account balances; enter a rate/amount pair that does not reconcile and confirm it is rejected. Confirm unlike currencies remain separate in summary totals.
7. Create/edit a budget and savings goal, add/edit/delete a contribution, then restart and confirm saved totals. Add a planned bill and verify it remains a plan without creating an expense or changing account balances.
8. Search and filter transaction history by month, category, account and currency; change sort order; inspect empty results and transaction CSV output. Check amount fields use the numeric keyboard and remain visible above the keyboard.
9. Swipe Today → Money → Plan → Life in both directions. Repeat while vertically scrolling, over a chart, inside forms/dialogs and from Android's back-gesture edge. Turn swipe off, restart, and confirm buttons still navigate and the setting stays off.
10. Review Money overview, account cards/history, transaction entry, transfers, budgets, savings, planning and analytics at narrow phone width and larger text size. Confirm no technical IDs, clipped controls or misleading mixed-currency totals.
11. Verify notification preference changes and existing notification behavior without an unsolicited permission prompt. Exercise granted/denied permission, biometric cancel/success, recovery flow and backup import only with a disposable test profile/device.
