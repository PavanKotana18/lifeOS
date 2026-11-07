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

Finance screens (`MoneyHome`, `FinanceProjection`, `FinanceCharts`, savings views) are already separate components. `financeCore.ts` provides integer minor-unit arithmetic, a versioned offline currency catalog, manual FX inputs and projection math. These are useful foundations; the persisted ledger still uses `number` amounts and has no explicit per-record currency or account identity. Transactions currently support only income and expense. No transfer/account repository exists.

## Verified risks and gaps

| Area | Evidence | Implementation implication |
|---|---|---|
| Profile/settings | `src/App.tsx` is 2,421 lines; Profile, Appearance, notification controls and security actions are rendered in the monolithic settings branch. | Extract focused profile screens while preserving existing callbacks and encrypted settings paths. |
| Navigation | `navigationCatalog.ts` maps the four primary destinations to existing tabs; `tabHistory.ts` owns back history. No horizontal swipe gesture currently exists. | Add one guarded gesture controller that calls the existing navigation function; do not create another route state machine. |
| Financial schema | Dexie declares only schema version 1. `Transaction` has a floating-point `amount`, type income/expense, and no currency/account field. | Do not infer currencies for old records. Defer schema expansion until encrypted codecs, migration and backup contracts can be upgraded and tested together. |
| Encrypted storage | `encryptedStorageIntegration.ts` allow-lists encrypted tables and migrates rows with verify-before-replace. Backup validation enumerates known tables. | Any new table needs coordinated changes across Dexie, the encrypted facade, migration, backup validation/import/export and tests. |
| Notification engine | `notificationService.ts` delegates scheduling to Capacitor Local Notifications; Android manifest uses the plugin’s broadcast receivers. | Retain this working path. A second Kotlin scheduler would risk duplicate schedules and needs proof before implementation. |
| Dependencies | React/TypeScript, Dexie 4, Capacitor 6, Recharts and Lucide are already installed. No additional UI/gesture library is required for the requested work. | Avoid dependency changes; use existing components and native pointer/touch events. |
| Tests/CI | Extensive Node, Sentinel, signing, startup, security and Android emulator workflows already exist. | Add focused unit/service contracts and reuse CI; distinguish compile evidence from instrumented execution. |

## Safe implementation order

1. Extract and redesign Profile/Settings with existing persisted preferences and a focused screen model.
2. Add an opt-out horizontal swipe controller integrated with the existing four-tab navigation, plus deterministic gesture tests.
3. Improve Money using existing calculations and storage contracts that do not reinterpret old records (transaction filters/summaries, budgets, savings and projection clarity).
4. Only add persisted accounts, transfer records or explicit currency fields after a versioned encrypted-schema and backup migration plan passes disposable-fixture tests. Old amounts cannot be assigned a guessed currency.
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
