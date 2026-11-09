# LifeOS next development plan — 13 November 2026

**Purpose:** A code-specific starting point for the next LifeOS development phase. This plan is based on the current source at PR #36 head `e91f2189bc10d73293b6d47ff3cde1fad54bf428`, the merged baseline `main` at `cc39f1484821a4050f067dd34c0d3e5c9f753d64`, the existing QA artifacts, and the owner's 8:40 physical-device recording. It is a backlog, not a claim that every listed path is fully accepted.

## Starting state and integration record

- PR #26 consolidated PRs #13–#25 and is merged to `main` at `cc39f1484821a4050f067dd34c0d3e5c9f753d64`.
- PR #36 (`feature/lifeos-directed-integration-20261109`, `e91f2189bc10d73293b6d47ff3cde1fad54bf428`) is open and draft, stacked on PR #35. It contains the latest implementation candidate.
- The PR #27–#36 head commits are in PR #36's ancestry. PR #14–#25 heads are ancestors of `main`; PR #13 is already closed/merged. Do not merge historical PRs again or cherry-pick their commits.
- PR #14–#25 remain listed as open even though their exact candidate heads are in `main` through PR #26. Close those only after the final integration is merged, with an explanatory comment. Keep PRs #27–#36 open until their code is in `main`; then close only the fully superseded chain with links to the integration PR.
- The release workflow at run `42678421860` passed its automated checks and signed Android debug build for PR #36. The APK artifact is [LifeOS debug APK from commit e91f2189](https://github.com/PavanKotana18/lifeOS/actions/runs/42678421860/artifacts/13701821464).
- Browser acceptance run `42678421356` passed. In Android emulator run `42678421262`, API 29 recovery preflight passed (1 test), API 29 matrix passed (17), API 34 passed (22), API 35 passed (22), and three API 34 notification-isolation attempts passed (2 each). The separate visual job failed: instrumentation started one test but reported `Process crashed` and 0 completed cases. Its artifact records the LifeOS process exiting because a Google Play Services font-provider dependency died; the emulator launcher also recorded an ANR. Treat this as a blocked visual run pending a repeat, not as a LifeOS assertion pass or confirmed app defect.
- Branch protection for `main` requires the `Automated checks` and `Android debug build` checks and a pull request. It does not waive security or acceptance review. The current PR #36 merge state is `UNSTABLE`; do not infer merge readiness from individual green jobs.
- PR #36 does not introduce a Dexie version change beyond the already merged baseline: `src/db.ts` defines schema version 2, with additive financial tables/indexes; the comments and validation preserve old records without assigning a guessed currency or re-keying them during that version change. No encryption algorithm or backup format change is part of this POA.

### Pull-request inclusion and dependency matrix (checked 10 November 2026)

| PR | Base ← head branch | Head SHA | State / disposition for integration | Test evidence used |
|---|---|---|---|---|
| #2 | `main` ← `feature/antigravity-agent-setup` | `cccde9b90fb4f14b33a6f764aad08b93db45c745` | Open, independent old branch. Its source is not an ancestor of main, but the PR contains an older full-app snapshot. Its earlier authentication/theme/finance paths are superseded by later encrypted-storage, onboarding and notification implementations. Do not merge wholesale; compare only a separately demonstrated missing patch. | Do not treat old PR checks as evidence for current code. Current code is exercised by #36 candidate checks. |
| #13 | `main` ← `fix/lifeos-security-data-sprint1-20261106` | `3e11619d612fc4207bf5972979a8583da069ea3e` | Merged; merge commit `c47ae82fcbf7b868907d452ba710596170ca575f`. Included through main/#26. | Covered again by #26 and #36 candidate suite. |
| #14 | Sprint 1 branch ← local consolidation | `5848a0eb4c887d5c9479208ae282d8a72a228268` | Open draft, head is in main through #26. | Candidate-level current tests, not a claim of a new PR14 rerun. |
| #15 | local consolidation ← Sprint 3 | `0ec1a07fb04572b5dbbcf3f317b742ade7431fce` | Open draft, head is in main through #26. | Candidate-level API matrix and #36 suite. |
| #16 | Sprint 3 ← Sprint 4 | `d186cec4a0df1f488c56e46438aa62d49487065d` | Open draft, head is in main through #26. | Candidate-level current Android checks. |
| #17 | Sprint 4 ← Android QA coverage | `3d05b3720863f9d029c3fa6dbeb4387ea62e5496` | Open draft, head is in main through #26. | Candidate-level current Android checks. |
| #18 | QA coverage ← stabilization | `ead4ffa1dcc3c966c588d4c7c7ae8922078748b7` | Open draft, head is in main through #26. | Candidate-level Node, Sentinel, TypeScript/build. |
| #19 | QA coverage ← QA infrastructure | `95e5942108c1de1dabaec4020fe588dd68b1d5d5` | Open draft, head is in main through #26. | Candidate-level Android workflow evidence. |
| #20 | QA coverage ← PR18/19 integration | `5d858ac23b7b6b12c0d473b681ec88769f3dddcc` | Open draft, head is in main through #26. | Candidate-level Node and Android matrix evidence. |
| #21 | PR18/19 integration ← release gates | `1943b5daecc3d0ee7e3bb7bd52d42502c1d06fae` | Open draft, head is in main through #26. | Candidate-level security preflight and storage tests. |
| #22 | release gates ← encrypted startup | `7650f5ead7d0aa4e0e108eec78faecac4bcd708e` | Open draft, head is in main through #26. | Candidate-level encrypted storage admission/migration tests. |
| #23 | encrypted startup ← functional/security integration | `a8fb1845e6607139a0e3e0b6545ba455572020b4` | Open draft, head is in main through #26. | Candidate-level existing-user and encrypted-record tests. |
| #24 | PR23 integration ← UI2 milestone A | `f1a26b199f4db8b7b0f64fd9136f23d6dfebb927` | Open draft, head is in main through #26. | Candidate-level screen, onboarding, theme and finance tests. |
| #25 | PR24 ← bulk development | `070e6dccf4def89efc113f49bfa25cd98be526f7` | Open draft, head is in main through #26. | Candidate-level finance/accounting, Profile and navigation tests. |
| #26 | `main` ← release candidate | `3a3f72b65bb5830fb7a7bd4a218e02f18b3903ed` | Merged at `cc39f1484821a4050f067dd34c0d3e5c9f753d64`; consolidates #13–#25. | Successful main integration and checks were recorded by GitHub. |
| #27 | `main` ← motion foundations | `f898ebe655b12f58ba29a15da2b93bbeb60a0ea4` | Open draft; head is in PR36 ancestry. | Use current #36 evidence, not assumed historical checks. |
| #28 | #27 ← Today redesign | `e60bf658402f4c67bbf52c75e80a7aeacae163a9` | Open draft; head is in PR36 ancestry. | Current #36 browser/device candidate evidence. |
| #29 | #28 ← Money redesign | `c1d4dbd0758fd90c66d30fe9c1aadea1db462506` | Open draft; head is in PR36 ancestry. | Current #36 finance and browser candidate evidence. |
| #30 | #29 ← Plan redesign | `60f5ab88aad4099f21e4a8de2d3b94143884623d` | Open draft; head is in PR36 ancestry. | Current #36 planner and Android matrix evidence. |
| #31 | #30 ← Life redesign | `11bef3bfc4386a5d55ac00c5cf5570538d58bd10` | Open draft; head is in PR36 ancestry. | Current #36 Life and Android matrix evidence. |
| #32 | #31 ← unified experience | `2160b2e52c1a2c2082cfb8a0e505c607c692d852` | Open draft; head is in PR36 ancestry. | Current #36 product/browser evidence. |
| #33 | UI2 integration candidate ← product refinement | `43dad611d6dee2aa3eaf04b5574e01437b67056e` | Open draft; head is in PR36 ancestry. | Current #36 evidence. |
| #34 | #33 ← UX3 navigation flows | `4c061305bcfd5183da6c97c4104a5fb3899cf10b` | Open draft; appears as a sibling base path to #35 but its head commit is in PR36 ancestry. Its changes are included; do not merge separately. | Current #36 interaction tests; visual Android job remains failed. |
| #35 | #33 ← Phoenix UX | `a4f770458e53d8307cfa79549fe120e9a740628c` | Open draft; direct base of #36 and head is in its ancestry. | Current #36 interaction and emulator tests. |
| #36 | #35 ← directed integration | `e91f2189bc10d73293b6d47ff3cde1fad54bf428` | Open draft; primary integration candidate; includes latest relevant #27–#35 heads. | Run `42678421860` checks/build pass; browser `42678421356` pass; emulator `42678421262` failed only at the separate visual process-crash job while API matrix/preflight jobs passed. |

**Reconciliation rule:** the SHA ancestry check proves the listed heads are included as commits; it does not prove every historical workflow passed or every behavior is accepted. PR #2 is the one open branch outside this chain. Its unique old commits do not justify importing an old application snapshot. After successful final integration only, close stale PRs whose exact change is present or superseded, with references; retain unrelated work until reviewed.

## Priority and work-package order

Start with **P0 security/data integrity** on 13 November, then the focused **P1 usability** work informed by the recording, followed by **P2 design/accessibility** and **P3 architecture/performance**. Every item below specifies a source-backed change, a test, and acceptance evidence. Avoid redesigning stable crypto, recovery, or notification components without a reproduced failure.

## P0 — Security, reliability, and data integrity

### P0.1 Encrypted storage admission and upgrade safety

| Current implementation | Problem / target implementation |
|---|---|
| `src/db.ts`: `activateEncryptedStorage()` checks authenticated session, native key state, recovery confirmation/deferral and unlocked status; migrates records; rechecks native state; then changes `activeStorageTarget`. Failure selects the raw target as locked and calls native lock. `src/services/encryptedStorageIntegration.ts`: `migrateLifeOSRecords()` encrypts and opens a copy before a compare-and-replace transaction, skips already encrypted rows, and leaves bootstrap preferences available. `src/services/encryptedRecordCodec.ts` defines encrypted table admission. | Preserve these fail-closed boundaries. Next change should be test-only unless a reproducible bypass exists: map every `StorageService` method to its encrypted table/facade, prove raw sensitive reads and writes reject before activation and during migration, and exercise upgrade/restart paths against disposable IndexedDB. Never call migration “atomic” across Android Keystore and IndexedDB; its row-by-row retry contract is the safety property. |
| **Files/functions:** `src/db.ts` (`LifeOSDatabase` schema versions, `activateEncryptedStorage`, storage facade selection); `src/services/encryptedStorageIntegration.ts` (`createLifeOSEncryptedRepositories`, `migrateLifeOSRecords`); `src/services/encryptedRecordCodec.ts`; `src/services/encryptedDexieStore.ts`; `src/services/cryptoSessionCoordinator.ts` (`createProtectedSessionController`, `unlockEncryptedSession`, `lockEncryptedSession`); `android/app/src/main/java/com/lifeos/personal/LifeOSCryptoPlugin.java` (`setup`, `unlock`, `getKeyState`, `handleOnStop`); `MainActivity.java` (`onResume`, `onPause`, `confirmResumeValidation`). | **Dependencies:** none unless a missing table is found. **Regression risks:** accidental raw-facade access, migration overwriting ciphertext, exposing rows before session activation. **Automated tests:** `test_encryption_admission.js`, `test_secure_startup.js`, `test_encrypted_storage_facade.js`, `test_encrypted_storage_migration.js`, `test_encrypted_transaction_coordinator.js`, `test_encrypted_dexie_store.js`, `test_crypto_key_state_api.js`, Sentinel, Android `CryptoAcceptanceTest`. **Acceptance:** fresh setup, restart, background/resume, cancellation, and existing encrypted database all stay inaccessible until native key validation and migration complete; injected migration interruption resumes without duplicate/lost rows; no plaintext private row is admitted. |

### P0.2 Keystore, biometric lifecycle, and mandatory onboarding

| Current implementation | Problem / target implementation |
|---|---|
| `src/components/Onboarding.tsx` and `src/services/onboardingJourney.ts` represent the required name → protection → recovery journey. `src/App.tsx` persists `onboardingJourney`, `onboardingNameDraft`, and authoritative `displayName`, coordinates setup and dialog results, then gates the private workspace. `LifeOSCryptoPlugin.java` persists setup metadata and authentication policy, reuses only a consistent interrupted first-time alias, and provides biometric/device-credential paths; inconsistent existing key metadata should remain non-destructive. | Test state transitions, not just rendered labels. On each failure/cancel, preserve stage and name, keep private data inaccessible, and provide a retry/recovery path. Existing protected users must hydrate through their established key and must never be routed through first-install provisioning. The app must not mark onboarding complete before recovery proof and encrypted activation. |
| **Files/functions:** `src/components/Onboarding.tsx` (`onSaveIdentity`, protection and recovery actions); `src/services/onboardingJourney.ts` (`INITIAL_ONBOARDING_JOURNEY`, `normalizeOnboardingJourney`); `src/App.tsx` (`saveOnboardingIdentity`, `provisionOnboardingProtection`, `confirmOnboardingRecovery`, startup hydration and onboarding completion); `src/components/SecureSetupDialog.tsx`; `src/services/recoveryService.ts` (`createRecoveryController`); `LifeOSCryptoPlugin.java` (`prepareRecovery`, `confirmRecovery`, `setup`, `authenticate`, `getOrCreateMasterKey`, `handleOnStop`). | **Dependencies:** P0.1. **Regression risks:** prompting an existing user as new, provisioning a replacement key, completing the journey after an unverified recovery code, or blocking forever after authentication cancellation. **Automated tests:** `test_onboarding_journey.cjs`, `test_first_record_security_20261107.cjs`, `test_secure_startup.js`, `test_auth_lifecycle.js`, `test_session_manager.js`, `test_recovery_export_lifecycle.cjs`, `test_crypto_native_source.js`, Android `CryptoAcceptanceTest` on API 29/34/35. **Acceptance:** fresh install reaches Today only after required stages; a restart during each stage resumes safely; existing encrypted records open without reprovisioning; canceled auth saves nothing and retains the draft; first record succeeds after setup with no redundant prompt. |

### P0.3 Recovery kit export, confirmation, and restore

| Current implementation | Problem / target implementation |
|---|---|
| `SecureSetupDialog.tsx` shows the code, copies on card tap, asks for pasted confirmation, and offers complete-kit export. `src/services/recoveryExportLifecycle.ts` tracks a bounded in-memory picker lease; `src/App.tsx` carries pending setup resolution and resume/lock coordination; `src/services/backupExportService.ts` verifies the file save result and bytes; `LifeOSBackupPlugin.java` uses Android's file picker. Recovery code normalization removes harmless whitespace but validates the actual 43-character base64url code. | Retain the current code and envelope unchanged. Prove Android Save As returns to the same recovery stage with a completed-save state, and that cancel/failure/process death cannot falsely enable Continue. An exported file must contain the envelope and code; code copy alone is not a complete backup. Test restore in an isolated synthetic profile and never place secret-bearing screenshots/logs in CI artifacts. |
| **Files/functions:** `src/components/SecureSetupDialog.tsx`; `src/services/recoveryExportLifecycle.ts` (`begin`, `markInactive`, `pendingResume`, `completeResume`); `src/services/recoveryCodeConfirmation.ts` (`normalizeRecoveryCodeInput`, `matchesRecoveryCode`); `src/services/backupExportService.ts` (`exportBackupFile`); `src/services/sensitiveClipboardService.ts`; `src/App.tsx` (`recoveryExportLifecycle`, lifecycle callbacks, setup resolver); `LifeOSBackupPlugin.java` (`saveFile`); `LifeOSCryptoPlugin.java` (`confirmRecovery`, `verifyRecoveryRecord`, `recoverWithSecret`, `rebindLocalKey`). | **Dependencies:** P0.2; native Android document picker. **Regression risks:** false save-success, cancellation of setup, stale callback unlocking storage, code/envelope mismatch, secret leakage to clipboard/history or artifacts. **Automated tests:** `test_recovery_export_lifecycle.cjs`, `test_backup_validation.js`, `test_backup_export_service.js`, `test_crypto_native_source.js`, Android crypto tests. **Physical acceptance:** on API 29+ phone, export a synthetic kit through DocumentsUI, return to same screen, paste the code, continue, restart, then restore in a separate disposable profile. **Acceptance:** no secrets in logs/screenshots; only a verified complete file plus matching code can complete setup; restore proves the original encrypted record; cancellation keeps data/key intact. |

### P0.4 Encrypted backup, import, migration, and rollback

| Current implementation | Problem / target implementation |
|---|---|
| `src/services/backupCryptoService.ts` enforces byte/passphrase limits and authenticated encryption. `src/db.ts` validates backup table contracts, exports/imports supported tables, and coordinates tables in Dexie transactions. `src/services/backupExportService.ts` handles file export. Encrypted records are opened/validated through the current codec and encrypted storage facade. | Keep format compatibility explicit. Add fixture-driven round trips from supported historical versions and corrupted/wrong-passphrase cases; verify failed import leaves a preexisting synthetic database byte-for-byte/logically unchanged. New tables require synchronized schema, encrypted admission, validator, export/import, migration and tests; do not ship a table in only one layer. |
| **Files/functions:** `src/services/backupCryptoService.ts` (`encryptBackup`, `decryptBackup`, size/passphrase validation); `src/db.ts` (`validateBackupTables`, `exportData`, `importData`); `src/services/backupExportService.ts`; `src/services/encryptedStorageIntegration.ts`; `src/services/encryptedRecordCodec.ts`; Android `LifeOSBackupPlugin.java`. | **Dependencies:** P0.1 and P0.3. **Regression risks:** legacy backup rejection, partial replacement, plaintext import into encrypted target, lost references or duplicate rows. **Automated tests:** `test_backup_validation.js`, `test_backup_indexeddb.js`, `test_backup_export_service.js`, `test_db_atomicity.js`, `test_encrypted_atomicity.js`, Sentinel; add fixtures for every accepted schema version and a forced mid-import failure. **Acceptance:** valid current and legacy backups restore in a disposable database; wrong passphrase/malformed/inconsistent encrypted row changes no existing record; count and referential-integrity checks pass after restore. |

### P0.5 Financial invariants and migration compatibility

| Current implementation | Problem / target implementation |
|---|---|
| `src/services/financeCore.ts` converts decimal input to integer minor units using versioned currency metadata, formats locale-aware currency and handles explicit conversion/projection math. `financialAccounting.ts` validates accounts/transfers/rates/commitments and derives balances. `db.ts` version 2 adds accounts, transfers, manual rates and commitments while preserving old untagged transactions; account/transfer/contribution changes use multi-table transactions. `financeAnalytics.ts` aggregates only records compatible with the selected currency and reports exclusions. | Keep legacy currency semantics unchanged. Make reports explain excluded currencies and require explicit dated manual FX for cross-currency totals. Add invariant tests for edits/deletes/reversals, archived-account history, opening balances, savings contribution reconciliation, and import/restore; never infer currency or persist calculated balances as facts. |
| **Files/functions:** `src/services/financeCore.ts` (`decimalToMinorUnits`, `minorUnitsToDecimal`, `convertMinorUnits`, `formatMinorUnits`, projections); `src/services/financialAccounting.ts` (`validateFinancialAccount`, `validateAccountTransfer`, `calculateAccountBalances`); `src/services/financeAnalytics.ts` (`buildFinanceAnalytics`); `src/db.ts` (Dexie `version(2)`, transaction/category/account/rate/commitment repositories, backup validation/import/export); `src/types.ts`; `src/components/MoneyAccounts.tsx`, `MoneyPlanning.tsx`, `MoneyHome.tsx`. | **Dependencies:** P0.4 before schema expansion. **Regression risks:** floating-point drift, transfer double counting, cross-currency summation, orphaned references, changing historical value meaning. **Automated tests:** `test_finance_core_20261107.cjs`, `test_financial_accounting_20261108.cjs`, `test_money2_financial_workflows_20261108.cjs`, `test_db_atomicity.js`, `test_backup_indexeddb.js`, `test_finance_analytics_money_20261107.cjs`. **Acceptance:** exact minor-unit reconciliation holds through create/edit/delete/restore; transfers do not affect income/expense; absent FX never produces a total; pre-v2 fixtures remain unchanged and readable. |

### P0.6 Transaction chronology and duplicate prevention

| Current implementation | Problem / target implementation |
|---|---|
| `src/App.tsx` derives transaction views with `sortTransactions` and uses it for filtered history and recent rows; `userPreferences.ts` builds update records preserving `dateTime` and unknown legacy time semantics. Duplicate entry protections have focused test coverage. | Reconfirm the sort compares full local date-time, then uses deterministic creation/id tie breaks; ensure date-only legacy rows remain “time unknown,” not midnight fabricated as historical fact. Keep IDs and timestamp precision intact during edits and backup import. |
| **Files/functions:** `src/App.tsx` (`filteredTransactions`, recent transaction selector, transaction save/edit); `src/services/userPreferences.ts` (`buildTransactionUpdate`); `src/services/financeCore.ts`; tests `test_transaction_duplicate_20261107.cjs`, `test_transaction_quick_entry_20261107.cjs`, `test_directed_transaction_entry.cjs`, `test_lifeos2_typography_money_20261107.cjs`. | **Dependencies:** P0.5. **Regression risks:** duplicate posting on rapid taps, local/UTC date crossing, loss of date-only meaning. **Acceptance:** same-day newest/oldest ordering uses time; equal timestamps are deterministic; reload/edit/delete preserves order and amount; fast repeated save creates one transaction. |

### P0.7 Reminders, delivery evidence, and action routing

| Current implementation | Problem / target implementation |
|---|---|
| `src/services/notificationService.ts` uses Capacitor Local Notifications, schedules task reminders with `allowWhileIdle`, records requested/accepted/pending/native-receiver/visible/tapped states, distinguishes pending from delivered and only cancels owned IDs. `domainUtils.ts` derives reminder/deadline plans. `NotificationTapLaunchPlugin.java` holds cold-start actions and `MainActivity.onNewIntent()` captures new intents; App handles pending action IDs after startup/session gates. | Keep task reminder, deadline and overdue alert as separate kinds. Add native acceptance proving a persisted task makes it into the pending queue and does not get canceled by a later sync; test delete/complete/edit, reboot/timezone changes and tap after lock/cold launch. Pending disappearance must remain “unconfirmed”, not “delivered.” Do not add a second scheduler unless an observed Capacitor failure is isolated and the replacement has parity and rollback. |
| **Files/functions:** `src/services/notificationService.ts` (`NotificationService`, schedule reconciliation, `diagnoseTaskReminder`, permission/channel/pending/delivered diagnostics); `src/services/domainUtils.ts` (task reminder/deadline planning); `src/App.tsx` (task persistence and post-commit sync, action listener and auth-gated route); `NotificationTapLaunchPlugin.java`; `MainActivity.java` (`onNewIntent`); `AndroidManifest.xml`; existing `LocalNotificationBridgeAcceptanceTest`, `NotificationTapLaunchAcceptanceTest`. | **Dependencies:** encrypted startup available without exposing task details. **Regression risks:** duplicate alarms, missed reminders, unauthorized task disclosure, changing overdue semantics. **Automated tests:** `test_notification_delivery_pipeline.cjs`, `test_tasks_recurrence_edges.js`, `test_secure_startup.js`, Android notification isolation and tap launch suites on API 29/34/35. **Physical acceptance:** schedule a task reminder 20–30 minutes ahead, normally close LifeOS, verify actual reminder (not overdue alert), tap while unlocked and locked, verify destination after authentication. Record OEM battery policy only if observed. |

### P0.8 Lifecycle, local persistence, and error handling

| Current implementation | Problem / target implementation |
|---|---|
| `MainActivity` owns resume/pause lock callbacks, sensitive-screen flag, splash release and notification intents; `cryptoSessionCoordinator.ts` serializes session operations; `App.tsx` owns startup hydration, retained screens and large application state. Existing task and finance persistence use `StorageService`. | Add a small lifecycle acceptance matrix for app background, swipe-away, OS process death, force-stop (which suppresses alarms until manually relaunched), reboot, screen lock, save picker and biometric prompt. Preserve stored drafts/scroll position only when they contain no secret, and clear secret-bearing transient state on dismissal/lock. Keep platform limitations explicit. |
| **Files/functions:** `MainActivity.java`; `ScreenCaptureProtectionPlugin.java`; `LifeOSCryptoPlugin.java`; `src/services/cryptoSessionCoordinator.ts`; `src/services/uiNavigation.ts` (`retainedScreenTransitionState`, `screenScrollKey`); `src/App.tsx` lifecycle effects and action queue; `src/hooks/useRecordDialog.ts`. | **Dependencies:** P0.1–P0.3. **Tests:** `test_auth_lifecycle.js`, `test_session_manager.js`, `test_recovery_export_lifecycle.cjs`, `test_android_startup.js`, `test_recovery_export_lifecycle.cjs`, Android `CryptoAcceptanceTest`, `LocalPersistenceAcceptanceTest`, `ScreenshotProtectionAcceptanceTest`. **Acceptance:** process loss locks private content, no Recent Apps disclosure, no lost committed rows; a resumable form draft remains unsaved until explicit commit. |

## P1 — Product architecture and task-specific usability

These items come from the owner's recording. Items 1–10 are directly visible presentation/interaction concerns. Item 11 (restoring scroll position and drafts) is a risk raised by the recording and still needs targeted reproduction; it is not yet a confirmed persistence defect. Item 12 is a cross-screen acceptance need, not a claim of a broken backend.

### P1.1 Today: actionable daily overview

- **Current → target:** `App.tsx` renders a Today dashboard from tasks, habits, finance and goals, and `todayLayout.ts` persists section ordering/visibility. Keep the data sources; reduce duplicate cards, prioritize due/overdue actions, and collapse empty sections by default with clear customization.
- **Files/functions:** `src/App.tsx` Today selector/rendering (`dashboardUpcomingTasks`, Today task/agenda handlers); `src/services/todayLayout.ts`; `src/components/PlanHub.tsx`; `src/components/LifeHub.tsx`.
- **Exact changes:** derive a compact view model once per day, show only supported local facts, make every summary navigate to its source, retain persisted show/hide/reorder controls, and render useful empty-state actions. Do not add unsupported streak/score claims.
- **Tests/acceptance:** `test_dashboard_summary_20261107.cjs`, `test_today_layout_20261107.cjs`, `test_today_dashboard_design_20261108.cjs`, `test_plan_hub_schedule_20261107.cjs`; screen-reader walkthrough and small/large phone review. Verify no duplicate task count and correct local-day rollover.

### P1.2 Money: one clear everyday path, advanced tools secondary

- **Observed:** Money navigation is fragmented; everyday actions compete with advanced financial tools; cards repeat information and some regions feel empty. Selectors are long, and the recording describes a form/bottom-sheet-heavy flow. These are UX findings, not proof that accounting services are wrong.
- **Current → target:** `MoneyHome.tsx` owns the overview and a “More tools” accordion routes to Transactions, Accounts, Budgets, Savings, Reports and Planning; `App.tsx` owns `financeSubtab` and form state. Keep the existing working destinations and calculation services, but make cash flow the first summary, provide prominent expense/income/transfer quick actions, and place FX/projection tools under a deliberate “Planning” or “More” destination.
- **Files/functions:** `src/components/MoneyHome.tsx`; `src/components/MoneyAccounts.tsx`; `src/components/MoneyPlanning.tsx`; `src/components/FinanceCharts.tsx`; `src/components/FinanceProjection.tsx`; `src/App.tsx` (`financeSubtab`, `filteredTransactions`, record create/edit/save); `src/hooks/useRecordDialog.ts`.
- **Exact changes:** replace the accordion-as-primary-navigation with a compact, persistent in-screen destination selector; keep primary four-tab navigation unchanged; retain quick entry (type, amount, category) and move optional account/date/note/merchant fields behind progressive disclosure; shorten category/currency selection with searchable, grouped controls; keep drafts until explicit save/discard; show account balances separately from period cash flow and never label a budget remainder “available balance.”
- **Dependencies:** P0.5 must remain green. **Regression risks:** destination state resets, keyboard hides fields, accidental destructive actions, stale chart filters. **Tests:** `test_directed_money.cjs`, `test_directed_forms.cjs`, `test_directed_transaction_entry.cjs`, `test_money2_financial_workflows_20261108.cjs`, finance core/analytics suites, browser acceptance. **Acceptance:** create/edit/delete income, expense and transfer; chart and totals reconcile with exact transaction list; returning from a selector restores the correct screen and draft.

### P1.3 Plan: quick capture and progressive task detail

- **Current → target:** `PlanHub.tsx` surfaces upcoming tasks and uses `onCreateTask`; the full task form is owned by `App.tsx` and the shared record dialog. Make title the first required field and allow quick save, with date/time, priority, reminder, recurrence and note fields expanded only when selected.
- **Files/functions:** `src/components/PlanHub.tsx`; `src/App.tsx` (`openCreateForm`, task `createKind`, save handler around `StorageService.tasks.add/update`, reminder sync); `src/hooks/useRecordDialog.ts`; `src/services/domainUtils.ts`.
- **Exact changes:** add an explicit quick-create path that keeps title and selected date draft on cancellation/navigation; progressively reveal optional fields; use native date/time picker with theme continuity where Capacitor permits; keep a due date independent of optional reminder; preserve reminder validation/scheduling after the database commit.
- **Tests:** `test_directed_planning.cjs`, `test_plan_hub_schedule_20261107.cjs`, recurrence edge and notification pipeline suites; browser keyboard/back/cancel flows. **Acceptance:** title-only task saves; interrupted form returns intact; reminder remains off unless chosen; date/time and recurrence persist across restart.

### P1.4 Life: precise habit and goal progress

- **Current → target:** `LifeHub.tsx` provides habit check-ins, weekly progress, goals and milestones; analytics are calculated in existing domain/service code. Improve density and language without merging habit and goal models or presenting composite productivity scores.
- **Files/functions:** `src/components/LifeHub.tsx`; `src/App.tsx` habit/goal handlers; `src/services/domainUtils.ts`; `src/services/financeAnalytics.ts` only for finance-related life insight if appropriate.
- **Exact changes:** one-tap habit check-in with date-specific state and undo/status; clear streak/weekly period labels; goal milestones shown as concrete progress and next action; hide unavailable comparisons when history is insufficient.
- **Tests:** `test_life_hub_ui2_20261108.cjs`, `test_habit_analytics_wiring.js`, `test_tasks_recurrence_edges.js`, `test_goal_status_ui.js`. **Acceptance:** timezone boundary and duplicate check-in tests; edit/delete reconciles goal totals; no praise/scoring without data.

## P2 — Visual design, accessibility, and interaction quality

### P2.1 Shared design tokens and density

- **Current → target:** `src/services/themeCatalog.ts` defines coordinated light/dark palettes, `App.tsx` hydrates saved appearance/theme and applies CSS variables, and `src/index.css` contains shared tokens and screen styles. Consolidate repeated one-off sizing/colors into a small token set and use it consistently; retain all user-selected palettes.
- **Files/functions:** `src/services/themeCatalog.ts` (`THEME_CATALOG`, `getThemeTokens`, `applyThemeTokens`); `src/App.tsx` theme hydration/application; `src/index.css` semantic variables, typography and screen components; `ProfilePreferences.tsx` and appearance screen.
- **Exact changes:** define type scale, 4/8px spacing, common surface/card density and 44–48dp interaction minimums with CSS custom properties; reduce repetitive card borders; set supportive copy no smaller than readable on phone; align light/dark native status/navigation bars with WebView tokens. Do not replace the user's theme on hydration failure; surface a recoverable preference error and preserve stored values.
- **Tests:** `test_theme_catalog_20261107.cjs`, `test_app_shell_theme_20261107.cjs`, `test_finance_views_theme_20261107.cjs`, `test_settings_ui_accessibility_20261107.cjs`; browser snapshots at compact 360dp, standard 393dp and large 430dp, plus 130%/200% text zoom. **Acceptance:** no clipped text/buttons or horizontal overflow; WCAG AA text contrast; theme remains selected through cold restart and system light/dark change.

### P2.2 Category/currency selection, native picker continuity, and charts

- **Current → target:** Money forms use long options and Android native date/time UI can appear visually darker than the app; `FinanceCharts.tsx` provides current chart views using Recharts. Improve selection and chart legibility without changing stored records or inventing data.
- **Files/functions:** Money form components in `src/App.tsx`; `MoneyHome.tsx`; `FinanceCharts.tsx`; `financeCore.ts` formatting; theme tokens in `index.css`; native theme configuration only if an actual picker mismatch is reproduced.
- **Exact changes:** searchable currency/category selection with name/code/symbol and selected state; maintain `amountMinor` precision; chart labels/legend use semantic palette, accessible textual summaries and honest zero/missing-data states; use native picker only when it preserves date/time semantics and handle cancel explicitly.
- **Tests:** `test_finance_charts_theme_20261107.cjs`, `test_lifeos2_typography_money_20261107.cjs`, `test_directed_transaction_entry.cjs`; browser and Android UI tests. **Acceptance:** no fake series or unsupported comparisons; every chart has accessible summary and scale labels; date/time values survive picker cancellation and save.

### P2.3 Primary swipe and back gesture acceptance

- **Current → target:** `navigationGestures.ts` recognizes a horizontal gesture from eligible content, rejects vertical/interactive/edge/multitouch starts and avoids wrapping; App calls the existing tab navigation and preserves tab state/history. Keep this single state machine.
- **Files/functions:** `src/services/navigationGestures.ts` (`primaryGestureStartBlockReason`, `shouldStartPrimaryGesture`, `beginPrimaryGesture`, `updatePrimaryGesture`, `resolvePrimaryGestureEnd`, `resolvePrimarySwipe`); `src/services/uiNavigation.ts`; `src/App.tsx` pointer handlers and `tabHistory.ts` integration; `test_directed_gestures.cjs`, `test_navigation_gestures_20261108.cjs`.
- **Exact changes:** only adjust gesture thresholds after test-device traces; add cases for accessibility touch exploration, chart drag, Android edge-back, pointer cancellation and reduced-motion animation. Do not intercept text selection, inputs, sliders, charts or modal surfaces.
- **Acceptance:** physical-device gesture test Today↔Money↔Plan↔Life in both directions, no wrap; vertical scrolling and system Back remain native; reduced-motion opt-out has no slide transition; no tab changes during nested interaction.

## P3 — Architecture, performance, and test quality

### P3.1 Reduce `App.tsx` incrementally

- **Current:** `src/App.tsx` is 3,238 lines and owns top-level navigation, profile/onboarding, startup/security state, task/finance save callbacks, notification lifecycle and many screen render branches. It imports dedicated Money, Plan, Life and Profile components, but much orchestration remains in the root.
- **Target:** extract one state owner at a time; avoid a wholesale rewrite. First move notification action/lifecycle into a hook/controller with an explicit interface; then profile/onboarding orchestration; then domain-specific task and finance commands. Keep `App.tsx` the composition root.
- **Files/functions:** `src/App.tsx`; new focused hooks under `src/hooks/`; existing service boundaries in `src/services/notificationService.ts`, `cryptoSessionCoordinator.ts`, `uiNavigation.ts`; components remain presentation-focused.
- **Dependencies/risks:** preserve stable callback identities and retained screen state; avoid effects firing twice or stale closures. **Tests:** run full Node suite, Sentinel, browser acceptance after each extraction; add controller unit tests before moving code. **Acceptance:** no changed externally visible behavior; no new direct `db` access in components; TypeScript and focused lifecycle tests pass at each step.

### P3.2 Database access and domain boundaries

- **Current:** `src/db.ts` owns Dexie schema, validation, repositories, atomic financial operations, backup import/export and encrypted storage selection. UI uses `StorageService` for records and domain helpers for calculations.
- **Target:** split by bounded responsibilities only after contract tests exist: schema/validation, repository operations, backup codec/orchestration, and encrypted activation. Keep one database instance and one admission boundary. Components must never import Dexie tables directly.
- **Files:** `src/db.ts`; `src/services/encryptedStorageIntegration.ts`; `src/services/backupCryptoService.ts`; `src/services/financialAccounting.ts`; `src/types.ts`.
- **Tests/acceptance:** existing `test_db_atomicity.js`, `test_encrypted_atomicity.js`, backup fixtures and encrypted-facade suites must pass unchanged before/after; add contract tests ensuring new tables appear in schema, encryption allowlist, backup validation, import/export and cleanup together. No migration runs in production without interruption/retry and old-backup fixtures.

### P3.3 Performance and browser reliability

- **Current:** directed screens use lazy/retained navigation and screen state; production Vite build at PR36 succeeds. Previous build evidence showed the main chunk near Vite's 500 kB advisory threshold in older commits; current commit should be measured rather than assumed.
- **Target:** measure startup, tab transition, transaction-list rendering and large IndexedDB restore with synthetic data. Only split a screen or memoize where a profile shows a real bottleneck. Keep offline mode and local fonts/assets.
- **Files:** `src/App.tsx`, Vite configuration, `MoneyHome.tsx`, `FinanceCharts.tsx`, data selectors and browser harness `tests/browser/*`.
- **Tests/acceptance:** build-size report, 500/5,000 transaction synthetic fixture, browser cold-start and tab-switch trace; check no unhandled promise or console errors. Don't add telemetry or network dependencies. Android performance claims require emulator/device timing evidence with build SHA recorded.

### P3.4 UI and native acceptance reliability

- **Current:** `tests/browser/acceptance.py` and `onboarding.py` drive a rendered web app; Android QA compiles signed app/test APKs and executes API 29/34/35 suites. Run `42678421262` visual job died after starting `DirectedVisualAcceptanceTest`; app exit evidence says dependency died (`com.google.android.gms.persistent` font provider), and the launcher recorded an input-dispatch ANR. No app Java exception was captured in the artifact. This run does not identify an application defect or prove visual acceptance.
- **Target:** rerun the single visual acceptance job on a fresh hosted runner, preserve app/runner exit info and JUnit, and reduce nonessential system-app contention only if evidence proves resource pressure. Keep it failing when zero tests execute. Do not weaken the test count, `FLAG_SECURE`, authentication, or screenshots of protected secrets.
- **Files:** `.github/workflows/android-emulator-qa.yml`; `android/app/src/androidTest/java/com/lifeos/personal/DirectedVisualAcceptanceTest.java`; `scripts/run-directed-android-visual.sh`; `scripts/android-instrumentation-to-junit.cjs`; `android/app/src/androidTest/java/com/lifeos/personal/WebViewTestSupport.java`.
- **Tests/acceptance:** exact visual test executes one test case, creates sanitized visual evidence for non-secret screens, retains FLAG_SECURE on onboarding/recovery, and reports JUnit `tests > 0`; API29/34/35 suites remain zero-failure/zero-skip. Separately, test the actual Android document picker and recovery continuation on a physical device. A compiled test APK is not execution evidence.

## Owner-recording findings to carry forward

| Recording observation | Status and next action |
|---|---|
| 1. Money destinations feel fragmented. | Visually observed. P1.2 consolidates the everyday path while retaining working destinations. |
| 2. Many actions depend on forms and bottom sheets. | Visually observed. P1.2/P1.3 use quick capture and progressive disclosure; do not remove advanced fields. |
| 3. Category and currency selectors are long. | Visually observed. P2.2 adds search/grouping without changing currency semantics. |
| 4. Information density varies between screens. | Visually observed. P2.1 establishes shared density and spacing. |
| 5. Native date/time picker dark mode differs from the app. | Visually observed. Reproduce on Android before changing native theme; P2.2. |
| 6. Cards feel repetitive. | Visually observed. Replace repeated card containers with screen-specific hierarchy; preserve accessible grouping. |
| 7. Some screens have large empty regions. | Visually observed. P1/P2 responsive layout pass, especially empty states and compact phones. |
| 8. Supporting text is small. | Visually observed. P2.1 verifies text scale and Android 130%/200% font scaling. |
| 9. Advanced tools compete with everyday actions. | Visually observed. P1.2 moves FX/projections to secondary planning destinations. |
| 10. Charts look basic. | Visually observed. P2.2 improves labels, accessible summaries, interaction and scale; no decorative/fabricated data. |
| 11. Scroll position and form drafts may not restore. | Technical risk from the recording, not confirmed defect. Reproduce with route, picker, background and process-recreation tests before implementation. |
| 12. Responsive behavior and accessibility need consistency. | Cross-screen acceptance requirement. Verify compact/large phone and large text, not a known data-layer defect. |

## Suggested first development session on 13 November

1. Fetch and verify `main`, PR #36, and the integration candidate head; check whether the visual Android job or recovery-picker evidence changed since this plan was committed.
2. Resolve the visual job's process-death evidence with one isolated rerun; do not rerun the full API matrix unless source changed.
3. Run focused encrypted migration, recovery export, backup restore and first-record tests on the current exact SHA. Require physical SAF picker confirmation for the fix that preserves the recovery screen across Android Save As.
4. Close any proven P0 gaps with synthetic data and one reviewable change at a time.
5. Start P1.2 Money usability with a narrow transaction quick-entry walkthrough and data-backed overview; keep the P0 accounting suites as hard regression gates.
6. Do not begin a broad UI redesign until security and recovery acceptance are recorded, and do not merge/release while any encryption/data-loss gate is unverified.

## Definition of a safe next-phase checkpoint

- Candidate source SHA and APK source SHA match and are recorded.
- `npm test`, `npm run test:sentinel`, `npx tsc --noEmit`, and `npm run build` pass on that SHA.
- Android debug APK is signed with the established certificate and carries the expected package/version.
- API 29/34/35 executed test counts and results are retained; no test is silently skipped.
- Recovery export/save-picker, encrypted migration/restore, and existing-user upgrade have real evidence or are explicitly marked blocked.
- Physical-device checks are not inferred from CI/emulator results.
- PR review, required branch-protection checks, and owner authorization are respected before any merge or release.
