# LifeOS Release Candidate Progress

Date: 2026-11-08
Candidate branch: `integration/lifeos2-release-candidate-20261108`
Candidate worktree: `/data/data/com.termux/files/home/lifeos2-release-candidate-20261108`
Pinned `origin/main`: `d7882d29d68fa45ac026c1da490b80aa910cd0a0`

## Safety and ancestry baseline

- Created a new worktree and branch from the pinned main commit. Initial worktree status was clean.
- Existing worktrees, including `~/lifeOS`, `~/lifeos-bulk-20261107`, and `~/lifeos-milestone-a-20261107`, were inspected and left untouched.
- PRs #13–#25 are still OPEN and DRAFT at baseline. PR #25 head is `070e6dccf4def89efc113f49bfa25cd98be526f7`, based on PR #24 head `f1a26b199f4db8b7b0f64fd9136f23d6dfebb927`.
- Verified ancestry: #13 `3e11619`; #14 `5848a0e`; #15 `0ec1a07`; #16 `d186cec`; #17 `3d05b37`; #18 `ead4ffa`; #19 `95e5942`; #20 `5d858ac` (merge commit `d9e405d` joins #18 and #19); #21 `1943b5d`; #22 `7650f5e`; #23 `a8fb184`; #24 `f1a26b1`; #25 `070e6dc`.
- Integration order: #13 → #14 → #15 → #20 → #21 → #22 → #23 → #24 → #25. #20 carries #16–#19; do not integrate those PRs separately.
- Initial findings carried forward: prior API 35 screenshot test failure and incomplete API 29/34/35 smoke evidence; migration/backup native acceptance is not proven by Node tests; #25 previously had automated checks and Debug APK compilation, but instrumentation only compiled.

## Timestamped checkpoints

### 2026-11-08 — baseline and candidate creation
- Inspected repository status, all existing worktree paths and statuses, remote refs, PR metadata, prior audit map, progress log, and PR ancestry.
- Found existing dirty files in several old worktrees. They are unrelated and untouched. Candidate branch/path were available.
- Created this isolated worktree from exact `origin/main` SHA `d7882d29d68fa45ac026c1da490b80aa910cd0a0`.
- Tested: candidate starts clean; current bulk worktree remains on its prior branch and clean.
- Next: integrate #13 and run its focused checks before proceeding.

### Stage #13 — encrypted data foundation
- Source SHA: `3e11619d612fc4207bf5972979a8583da069ea3e`; parent is the pinned main SHA. No ancestor was already integrated.
- Reviewed the changed native crypto lifecycle, storage facade, recovery and backup services, and security tests. No duplicate stage and no merge conflict.
- Merged by preserving source history; candidate merge commit: `c47ae82`.
- Tests: full `npm test` PASS (exit 0); `npx tsc --noEmit` PASS. The crypto/native Android behavior represented by Node tests remains simulated or source-checked.
- Next: inspect and integrate #14.

### Stage #14 — local notification and finance consolidation
- Source SHA: `5848a0eb4c887d5c9479208ae282d8a72a228268`; confirmed #13 is an ancestor, so only #14-specific changes were newly introduced.
- Reviewed the notification scheduling/manifest changes, finance totals, regression runner and added contracts. No duplicate integration and no merge conflict.
- Merged with source history; candidate merge commit: `92440d173fb79c21adebb2695a22561c3425ae5b`.
- Tests: full `npm test` PASS; `npx tsc --noEmit` PASS.
- Next: inspect and integrate #15.

### Stage #15 — Android acceptance scaffold
- Source SHA: `0ec1a07fb04572b5dbbcf3f317b742ade7431fce`; confirmed #14 is an ancestor, with no duplicate stage work.
- Reviewed Android acceptance tests, build configuration, guarded runner, and CSV save changes. No conflict or unexpected deletion.
- Merged with source history; merge commit is recorded in Git ancestry.
- Tests: full `npm test` PASS; `npx tsc --noEmit` PASS. Android instrumentation has not run locally.
- Next: verify #20 merge parents and unique integration changes, then integrate it.

### Stage #20 — parallel QA and stabilization integration
- Source SHA: `5d858ac23b7b6b12c0d473b681ec88769f3dddcc`. Its ancestry includes #15 and the merge commit that joins #18 and #19. No separate merge of #16–#19 was performed.
- Reviewed the unique API 24 fixture, instrumentation parser/runner, emulator workflow, notification startup and compatibility changes. No conflict or unexpected deletion.
- Merged with source history; PR #20's join commit and both parallel heads are in candidate ancestry.
- Tests: full `npm test` PASS; `npx tsc --noEmit` PASS.
- Next: inspect #21 security gate changes and integrate them.

### Stage #21 — security release gates
- Source SHA: `1943b5daecc3d0ee7e3bb7d6452d42502c1d06fae`; verified #20 ancestry and inspected its persistence acceptance test, report parser, and emulator workflow change.
- Found a CI policy gap in the inherited workflow: smoke and matrix assertions check nonzero cases/failures, but do not reject skipped tests or require a fixed expected suite count. The report parser detects incomplete runner completion but treats skips as report data.
- Local checks: full `npm test` PASS; `npx tsc --noEmit` PASS.
- Candidate integration: #21 is in the branch; emulator policy will be tightened after PR source integration.
- Next: inspect/integrate #22 and test the fail-closed encrypted access path.

### Stage #22 — STOP: mandatory regression failure
- Source SHA: `7650f5ead7d0aa4e0e108eec78faecac4bcd708e`; verified #21 is an ancestor. Candidate merge commit: `da91974`.
- The stage adds the fail-closed inactive-storage guard and an admission regression. No merge conflict or source deletion occurred.
- Mandatory `npm test` FAILS immediately in `test_backup_indexeddb.js`: `Encrypted storage is not ready. Complete secure provisioning and recovery setup before opening private data.` The fixture stubs native key provisioning as unavailable, then calls the guarded production `StorageService.backup.exportData()` as if raw access were active. No data-loss assertion ran to completion; no TypeScript check was run after the failed suite.
- This matches the explicit #22 handoff: raw-backend assumptions in old tests must be separated from production encrypted-facade tests. Read-only comparison shows #23 changes this fixture to use `rawStorageService` under a documented legacy-internals-only label, while production admission/security behavior is tested separately. That is a plausible safe fix, but it has not been integrated or tested on this candidate.
- STOP condition honored: no PR #23 or later stage was integrated. No security guard was weakened, no test was removed, and no failure was waived.
- Next safe step after review: apply the documented fixture boundary correction without changing production admission behavior; run the complete suite and TypeScript; inspect any remaining WP0 raw-access assumptions. Resume later PR integration only after those gates pass.

### Stop-state preservation
- Candidate branch was pushed without force to `origin/integration/lifeos2-release-candidate-20261108`; local and remote head match at `0118e6f4484c3e09b7ad0ce634253587dd0e647c`.
- Pinned `origin/main` remains `d7882d29d68fa45ac026c1da490b80aa910cd0a0`. PR #25 remains OPEN/DRAFT with the same base/head SHAs.
- `git diff --check` across the candidate range passes. No candidate Actions run was triggered; no emulator workflow targets this new branch yet.
- No candidate PR was opened because this is an incomplete, failed-gate checkpoint, not a validated release candidate. No Debug APK exists for this exact candidate SHA.
- Stop decision: BLOCKED at #22. Do not integrate #23–#25 until the legacy backup fixture is correctly separated from the guarded production facade and the full mandatory suite passes.

### PR #22 blocker resolution attempt — STOP at second mandatory test failure
- Re-read the saved matrix/progress and independently reproduced the original exact failure before changing the fixture: `node test_backup_indexeddb.js` exited 1 at line 122 with `Encrypted storage is not ready...`. Setup stubs native state as not provisioned/unlocked, activates only the JS session for backup assertions, and routes a legacy raw-Dexie rollback test through the guarded production facade.
- Fixed only `test_backup_indexeddb.js`: the test-only transpiled module now exposes `rawStorageService` under the explicit name `legacyStorageService`; the test documents that it covers raw legacy internals only. No production source/guard changed. Independent result: 5/5 IndexedDB rollback/preservation assertions PASS.
- Focused checks passed: `test:encryption-admission` 6/6; encrypted facade 16/16; migration behavior 45; encrypted transaction coordinator 10; crypto session coordinator 7/7; CryptoService 24/24; key-state API 8/8; auth lifecycle 10/10; backup validation 19/19; backup export 18/18.
- Next focused check failed: `node test_db_atomicity.js` at line 108 expected `LIFEOS_SESSION_LOCKED`, but the same unprovisioned fixture is rejected earlier by the active security boundary with `Encrypted storage is not ready...`. The test has a native-key stub fixed to false and does not activate encrypted storage; it also uses the production facade for subsequent raw atomicity setup. This is a second test-harness/expectation mismatch; no production data was modified.
- Read-only inspection of #23 shows its `test_db_atomicity.js` patch switches to raw storage and removes the first 124 lines containing session guard/bootstrap checks. Do not copy that removal without replacing the guard coverage. A safe follow-up must keep explicit fail-closed production-boundary tests, test session-lock behavior under an active synthetic encrypted runtime (or a narrow focused contract), and use raw-only access for legacy database atomicity cases.
- Mandatory focused gate failed, so no full npm suite, Sentinel, TypeScript, build, PR #23 integration, Android workflow, or later stage was run after this failure.
- Stop decision: BLOCKED at #22. Candidate code now contains only the passing legacy backup fixture correction; the separate `test_db_atomicity.js` issue remains unresolved. Do not integrate #23 until the full mandatory suite passes.

### Latest recovery checkpoint
- The test-only backup correction and this stop record were pushed at commit `576db04651641a0cf1aeb507b6607b10392d7787`.
- `test_backup_indexeddb.js` independently passes 5/5. The next focused mandatory test still fails at `test_db_atomicity.js:108`; no more suites were run after it. Candidate remains blocked and PR #23–#25 remain unintegrated.

### Atomicity fixture separation attempt — STOP at focused failure
- Starting state was the pushed candidate SHA `6375688860235bd1dd09b38a627af50aa4ed2169`; main remains pinned at `d7882d29d68fa45ac026c1da490b80aa910cd0a0`.
- Reworked `test_db_atomicity.js` to keep production-facade assertions for pre-provisioning denial, relocking, blocked writes/backup, bootstrap theme access, and JS-session-only bypass. Its domain/transaction checks now use the explicit legacy raw service, while preserving rollback and concurrent-write assertions.
- Added a separate synthetic encrypted-session test for active-session lock, authenticated re-open, ciphertext-only rows, encrypted multi-table rollback, and concurrent contributions. Extended admission coverage to check native key state remains unchanged when the facade blocks access. Wired both focused security tests into `npm test`.
- Focused command stopped in `node test_db_atomicity.js` with `The selected category does not exist. Choose an available category.` Stack: `assertTransactionCategory` in transpiled source line 180; transaction callback line 393. The stack does not identify which raw transaction insertion called it, so the category source is not yet isolated. Exact failure is saved in `validation-logs/20261108-test-db-atomicity-failure.txt`.
- The failure is not yet explained; no more test commands ran in this checkpoint. The new encrypted-session test and revised admission test have NOT RUN. Full npm, Sentinel, TypeScript, build, PR #23–#25 integration and Android gates remain NOT RUN.
- STOP condition honored. No source production guard changed, no PR after #22 integrated, and the local failed-gate changes are not pushed.
- Next safe step: identify the exact raw transaction insertion that triggers category validation and inspect its category rows at that point, without weakening validation. Resume broader tests and later PR integration only after the focused test passes.

### PR #22 fixture repair and verification — pre-#23 gate passed
- Exact category failure traced to `RawStorageService.transactions.add` at `test_db_atomicity.js:571` (valid insertion; it moved from line 562 after adding a fixture assertion), with category `Food`. At that point no default categories existed: the test had directly inserted then deleted its earlier savings test category, while the regular default seeding happened later at line 648. The normal `categories.getAll()` setup creates `cat_food` (`Food`, `expense`). Added this normal seeding call and asserted that exact row before transaction validation. No production validator changed. `node test_db_atomicity.js`: 38 assertions PASS; includes raw rollback/concurrency and separate pre-provision guard checks.
- The full suite then exposed additional stale test harnesses that used the production encrypted facade after only calling `sessionManager.unlock()`. Corrected those test-only setups to explicitly activate the synthetic encrypted runtime where production-facade behavior is under test; domain-only recurrence and parity checks use the explicitly exposed raw service. Added WP0 classification for `test_encrypted_atomicity.js`; changed reminder fixture to create a valid encrypted goal/milestone through normal APIs; corrected legacy backup import to explicitly confirm plaintext legacy import; updated restore assertion to accept the service's actual nondestructive `Existing data` rejection wording. No production security or data validation code changed.
- Focused results: encryption admission 6/6; encrypted session atomicity 8/8; IndexedDB restore atomicity 5/5; backup validation 19/19; backup export 18/18; encrypted migration behavior 45; encrypted transaction coordinator 10; crypto session coordinator 7/7; CryptoService 24/24; key-state API 8/8; authentication lifecycle 10/10; recurrence 14/14; recurrence edges 9/9; stabilization 5/5; WP0 controls 11/11. `test_db_atomicity.js` 38 assertions PASS.
- Complete `npm test`: PASS, explicit exit 0 (`validation-logs/20261108-npm-test-final-pre23.txt`). Sentinel: 6/6 suites PASS (`validation-logs/20261108-sentinel.txt`); its SAF tests are simulated/source checks and physical Android document-picker use remains unverified. `npx tsc --noEmit`: PASS. `npm run build`: PASS (2,232 modules, Vite production build).
- PR ancestry rechecked from fetched GitHub refs: PR #23/#24/#25 all share merge-base `7650f5ead7d0aa4e0e108eec78faecac4bcd708e` (#22 source); PR #23 head is `a8fb1845e6607139a0e3e0b6545ba455572020b4`, #24 head `f1a26b199f4db8b7b0f64fd9136f23d6dfebb927`, #25 head `070e6dccf4def89efc113f49bfa25cd98be526f7`. #24 descends from #23 and #25 from #24. Candidate still ends at merge #22 while these checks ran; next: stage #23 only, inspect changed files and validate it before #24.

### PR #23 — integrated and validated
- Source SHA `a8fb1845e6607139a0e3e0b6545ba455572020b4`; merge base is #22 SHA `7650f5ead7d0aa4e0e108eec78faecac4bcd708e`. PR #24 and #25 are descendants, not extra commits to cherry-pick here.
- Dry-run found conflicts in package/test harness files changed by both the #22 fixes and #23. Manually retained the production admission and encrypted atomicity coverage, `cat_food` fixture, and raw-only separation while preserving #23’s additional product tests, secure fixture lifecycle, screenshot resume coverage, first-start setup, and Android inventory. No conflicting production cryptography, migration, backup, or finance code was manually selected.
- Focused #23 checks PASS: atomicity 38, admission 6/6, encrypted atomicity 8/8, IndexedDB backup 5/5, recurrence 14/14, recurrence edges 9/9, stabilization 5/5, WP0 controls 11/11.
- Full expanded `npm test` PASS, exit 0 (`validation-logs/20261108-pr23-npm-test.txt`); TypeScript PASS, exit 0 (`validation-logs/20261108-pr23-typescript.txt`); production build PASS, 2,243 modules (`validation-logs/20261108-pr23-production-build.txt`). Build has a nonfatal main JavaScript chunk slightly over 500 kB.
- Next: commit the #23 merge, then inspect and stage #24 independently.

### PR #24 — integrated and validated
- Source SHA `f1a26b199f4db8b7b0f64fd9136f23d6dfebb927`, based on PR #23 head `a8fb1845e6607139a0e3e0b6545ba455572020b4`. The stage adds notification lifecycle and Android signing contracts, interaction and interface refinements, and the savings accounting correction.
- Resolved the #24 atomicity test overlap by preserving the newer rule that savings contributions do not create expenses. Raw fixture now preserves an older Investments expense while recording a contribution; encrypted test injects an actual encrypted contribution-table failure and verifies goal/contribution rollback, unchanged transaction history, and concurrent-write correctness. The initial obsolete assertion failure and correction are saved in `validation-logs/20261108-pr24-initial-fixture-failure.txt`.
- `test_db_atomicity.js`: 39 assertions PASS, including normal `cat_inv` and `cat_food` setup, savings history, rollback, and concurrent writes. Encrypted atomicity 8/8 PASS. Full expanded `npm test` PASS, exit 0 (`validation-logs/20261108-pr24-npm-test.txt`); TypeScript PASS (`20261108-pr24-typescript.txt`); production build PASS, 2,249 modules (`20261108-pr24-production-build.txt`). Nonfatal Vite chunk-size warning remains.
- Next: commit this #24 stage, then inspect #25 source changes and merge ancestry.

### PR #25 — integrated and validated
- Source SHA `070e6dccf4def89efc113f49bfa25cd98be526f7`; merge base is #24 head `f1a26b199f4db8b7b0f64fd9136f23d6dfebb927`. The #25 branch supplied encrypted account, transfer, savings, commitment, profile, backup, and navigation additions plus their tests.
- Resolved the only merge overlaps in package/test aggregation by retaining the #25 Money/account and schema-upgrade coverage, adding the separate encrypted-session atomicity test to the complete npm chain, and asserting normal `categories.getAll()` creates exactly `cat_food` before transactions use it. No production conflicts were manually overridden.
- `test_db_atomicity.js`: 62 assertions PASS. This includes version 1 to 2 upgrade data preservation, account opening-balance safeguards, card liabilities, exact minor units, no transfer-as-income/expense behavior, explicit FX, transfer reversal/undo, and the synthetic Amazon/HDFC scenario. The ₹5,000 unrelated transfer remains unchanged through reversal/undo of ₹3,000; cash-flow history changes only for the ₹500 card expense.
- Focused tests PASS: encryption admission 6/6; encrypted session atomicity 8/8; backup validation 23/23; IndexedDB backup 6/6; Money 2 workflows 21; Profile routes/settings; navigation gestures 14.
- Expanded full `npm test` PASS, exit 0 (`validation-logs/20261108-pr25-npm-test-final.txt`); TypeScript PASS, exit 0 (`...pr25-typescript.txt`); Sentinel 6/6 suites PASS with actual 15-table schema v2 (`...pr25-sentinel.txt`); production build PASS, 2,255 modules (`...pr25-production-build.txt`). Build warns that the main JavaScript bundle is 624.36 kB, above Vite's 500 kB advisory threshold.
- Remaining gates are candidate-specific Android instrumentation/API 29, 34, 35, CI/APK signing verification, and physical-device acceptance. No emulator or device pass is claimed yet.


### Category fixture repair and final local candidate gates — 2026-11-08
- Root cause: the transaction validation lookup uses the category name `Food`, and the matching normal expense category has ID `cat_food`. The test reached a valid transaction insertion before the normal default category setup had seeded that row; the validator in `src/db.ts` correctly rejected the missing reference. The affected transaction is the synthetic ₹500 Amazon card expense (`category: 'Food'`; currently `test_db_atomicity.js:784` after #25 integration; the original failing location in the #22 test layout was line 571). Its following balance assertion could not run because insertion threw.
- Test-only repair: initialize default categories via `StorageService.categories.getAll()` before any transaction fixture and assert that the returned set contains `cat_food` / `Food` / `expense`. Production category validation and foreign-key checks are unchanged. Raw IndexedDB atomicity remains isolated from production encrypted-session admission checks; encrypted session rollback/lock behavior remains in `test_encrypted_atomicity.js` and admission/startup suites.
- Re-run results on the integrated candidate source: `node test_db_atomicity.js` PASS, 62 assertions; `npm run test:encrypted` PASS (encrypted facade 18; migration 58; transaction coordinator 10; crypto session 7); complete `npm test` PASS, exit 0 (`validation-logs/20261108-final-npm-test.txt`); Sentinel 6/6 suites PASS (`validation-logs/20261108-final-sentinel.txt`); TypeScript PASS, exit 0 (`validation-logs/20261108-final-typescript.txt`); production build PASS, 2,255 modules (`validation-logs/20261108-final-production-build.txt`). Bundle-size advisory remains nonfatal.
- Candidate Android workflow update: now runs on the candidate branch, captures npm/Sentinel/TypeScript/build logs, requires the stable Debug signing secrets, checks package/version and expected Debug certificate SHA-256, and uploads the signed Debug APK by candidate SHA. Instrumentation checks require exactly 19 declared test cases, zero failures and zero skips on each full API 29/34/35 matrix run; API 29 recovery preflight still requires exactly one test. Screenshot protection lifecycle test remains included. YAML parses successfully; local Android instrumentation has not executed.
- At that checkpoint, candidate-specific emulator runs and physical-device acceptance were pending. The signed APK identity was later verified by the hosted run recorded below.


### Hosted Android validation stop — 2026-11-08
- Candidate commit `23051d5feaf28547a630e34e06913f6d34246d12` was pushed fast-forward only; pinned `origin/main` remains `d7882d29d68fa45ac026c1da490b80aa910cd0a0`. PR #13–#25 source history is integrated in dependency order.
- GitHub Actions run `42452318984` (candidate-specific Android emulator QA) executed on that exact SHA: npm test, Sentinel, TypeScript, production build, APK packaging, stable signer and API 29 recovery preflight all PASS. API 29 preflight JUnit: 1 expected / 1 executed / 1 passed / 0 failed / 0 skipped.
- Signed Debug APK PASS: package `com.lifeos.personal`, version `1.0.0`, certificate SHA-256 `735210B06A6088389F5EFADFA630DE42847D5949091C4A146183B579ED7D56A2` (matches the required identity), APK SHA-256 `1c98435c4aa8816f19268e5305af01a15f449637a5dec9f800f43b1c5fe78b6e`. Artifact is run-specific and linked in the final report.
- API 34 full smoke run FAIL/BLOCKED. Expected 19 cases; JUnit completed 9 total (8 passed, 0 assertion failures, 1 skipped), plus 3 runner completion errors. Instrumentation terminated with `INSTRUMENTATION_RESULT: shortMsg=Process crashed.` while starting `LocalNotificationBridgeAcceptanceTest#backgroundedSyntheticTaskReminderIsActuallyPosted`; The failure step recorded `emulator-5554` offline only after the emulator action had run its `Terminate Emulator` cleanup. That post-cleanup state does not establish an emulator crash. No pre-teardown exception, tombstone, or process-exit reason was preserved, so app, instrumentation, test lifecycle, and runner cause remain undetermined.
- The one skip was `BiometricDeviceAcceptanceTest#actualSetupCancelConcurrentResumeRecreateAndUnlock`, whose source explicitly requires opt-in `lifeosRealBiometricAcceptance=yes` for human biometric prompts. The 19-test zero-skip inventory incorrectly counts this opt-in test as unattended. It is now listed explicitly in a not-run inventory for automated AVD runs and remains a required physical-device acceptance, never counted as a pass. The API34 job still has an independent incomplete-runner failure.
- Because API34 smoke failed, the full API 29/34/35 matrix did not run. API 35 screenshot/lifecycle remains NOT RUN. Candidate draft PR was not created. No main/PR branch changed and no further integration or tests were attempted after this stop. Full API34 evidence is retained in `validation-logs/ci-api34-failure/`; API29 preflight evidence is in `validation-logs/ci-api29-preflight/`.
- Safe next action: investigate the notification test/emulator process exit with a focused API34 run that captures logcat before device loss; adjust CI selection so unattended tests exclude only the explicit opt-in biometric case and report its manual status separately. Then rerun the complete matrix with expected counts corrected; do not call this candidate ready until API29/34/35 all complete without mandatory skips.


### Phase 3 independent history and Android diagnosis — 2026-11-08
- Candidate worktree confirmed at `/data/data/com.termux/files/home/lifeos2-release-candidate-20261108`, branch `integration/lifeos2-release-candidate-20261108`, HEAD and origin branch both `23051d5feaf28547a630e34e06913f6d34246d12`. `origin/main` remains exactly `d7882d29d68fa45ac026c1da490b80aa910cd0a0`; baseline is an ancestor. GitHub comparison against PR #25 source branch `feature/lifeos2-bulk-development-20261107`: ahead 22, behind 0. All current PR source heads #13–25 are candidate ancestors. #18/#19 are joined through #20; no duplicate PR merges. Comparing each integration merge tree to its PR/source second parent found no production-path deltas. INTEGRATION COMPLETE; no PRs re-integrated.
- Termux has `adb` but `adb devices -l` is empty, `ANDROID_HOME` is unset, and no emulator executable is available; local API34 reproduction is not possible here.
- Re-read full GitHub run 42452318984 and its artifact. It reports `INSTRUMENTATION_RESULT: shortMsg=Process crashed.` immediately after starting `LocalNotificationBridgeAcceptanceTest#backgroundedSyntheticTaskReminderIsActuallyPosted`; expected 19, completed 9 (8 pass, 0 assertion failures, 1 skip), 10 uncompleted and 3 parser completion errors. Saved logcat lacked a crash stack. GitHub job logs show `android-emulator-runner` called its Terminate Emulator cleanup after the command failed; the later capture recorded an offline AVD. Thus emulator-offline is post-cleanup evidence, not proof of the crash source. No app/test/instrumentation process exit reason was captured; root cause remains unresolved.
- API29 preflight reported WebView Chromium 74.0.3729.185, while app minimum is 87. The API29 inventory therefore explicitly excludes seven WebView-dependent cases and the human-interactive biometric test; it retains native crypto/recovery and compatibility warning coverage (12 deterministic unattended tests). API34/35 inventory explicitly excludes the human-interactive biometric test and the unsupported-engine update-message case (not applicable on a supported WebView), leaving 17 unattended tests. These are documented exclusions, not skipped passes; the biometric workflow remains physical-device-only.
- Narrow diagnostic workflow changes now run the failing notification test alone on API34 before full smoke, preserve pre-shutdown logcat and app/instrumentation exit-info, and avoid overwriting it after emulator cleanup. Each matrix uses a recorded exclusion file and exact expected count; full gates still require zero JUnit skips and zero runner errors. Local runner contract simulation passes; it is not device evidence.
- New/changed files at this checkpoint: `.github/workflows/android-emulator-qa.yml`, `scripts/run-android-instrumentation.sh`, `scripts/test-android-runner.cjs`, two API exclusion lists, and these progress/validation records. No production application code changed. These diagnostics have not yet been pushed or run in GitHub Actions.


### Phase 3 local gate rerun and follow-up matrix — 2026-11-08
- Sequential local gates passed: DB atomicity 62; encrypted admission 6; encrypted session atomicity 8; encrypted facade/migration/coordinator/session 18+58+10+7; backup validation/restore 23+6; finance core/analytics/Money 56+13+21; Profile/navigation; full npm test exit 0; Sentinel 6/6; TypeScript exit 0; production build 2,255 modules. Logs are in `validation-logs/phase3-*.log`. Existing Vite bundle-size warning remains advisory.
- `scripts/test-android-runner.cjs`: PASS in its simulated ADB contract, including exclusion-file push and preservation of pre-teardown crash evidence. This is not Android execution.
- Test inventory is based on 19 declared Android methods. API29 explicitly runs 12 supported tests; seven method-level exclusions correspond to an observed Chromium 74 provider below the app’s Chromium 87 support boundary and the interactive biometric test. API34/35 run 17 supported unattended cases; they exclude the interactive biometric case and the unsupported-engine update-message case, which is applicable on API29 instead. All runs still require exact counts, 0 JUnit skips, 0 failures, and 0 runner errors.
- Follow-up workflow adds an isolated API34 run of the exact background-notification method before the full suite. The instrumentation script records filtered test inventory and captures process exit-info, logcat and device state in its pre-teardown exit handler; later workflow diagnostics preserve rather than overwrite that capture. Official AndroidJUnitRunner supports method-level `notTestFile` exclusions. No production app code changed.
- Candidate source/CI changes and reports remain local at this checkpoint; the remote still points at `23051d5feaf28547a630e34e06913f6d34246d12`. Next: review the complete diff, commit and fast-forward push candidate-only diagnostics, then inspect the new hosted run. Do not open a candidate PR unless all automated gates pass.


### Phase 3 latest verification update — 2026-11-08
- The full `npm test` rerun completed with exit 0. It includes the 62-assertion database atomicity set, encrypted admission/session suites, migration/backup and financial reversal scenarios, profile/navigation checks, and the ADB runner simulation. The first invocation under Termux `sh` rejected `set -o pipefail` before starting tests; the successful run was rerun under Bash.
- Sentinel: 6/6 suites passed, exit 0. TypeScript: exit 0. Production build: 2,255 modules, exit 0; the existing bundle-size advisory remains.
- Android test inventory check found exactly 19 declared test methods; all exclusion rows map to real tests; computed API29/API34/API35 counts are 12/17/17. `node scripts/test-android-runner.cjs` passed 4 simulated ADB scenarios; this is not Android execution.
- Hardened candidate validation: the workflow now also triggers for a draft PR targeting `main`, prints runner-error counts, and fails explicitly on JUnit runner errors. A static contract now catches stale API exclusion entries or count drift.
- The old run 42452318984 is still the only hosted candidate run; API34 crash root cause remains unconfirmed. No new APK or matrix result exists yet. Current decision: BLOCKED until the exact follow-up commit passes hosted API29/34/35 gates and its APK is verified.


### Phase 3 hosted run 42455377267 — test harness path failure
- Candidate SHA `316433057a3c9b20cf1b19458fd02930042661bc`: hosted npm, Sentinel, TypeScript, production build, APK compilation/signing, and API29 native-recovery preflight passed. API29 preflight ran 1/1 with no skips.
- API34 isolated `backgroundedSyntheticTaskReminderIsActuallyPosted` passed 1/1. This is real hosted emulator execution, not physical-device acceptance.
- API34 full suite did not start: AndroidJUnitRunner failed during setup with `EACCES (Permission denied)` reading `/sdcard/Download/lifeos-test-exclusions.txt`. Captured stack identifies `RunnerArgs.parseTestFile`; JUnit has 0 tests and 1 runner error. The full suite failure is a confirmed test-harness shared-storage permission bug. The original run 42452318984 had a separate incomplete runner event with no captured cause; its root cause remains unknown.
- API29 full matrix and API35 matrix were skipped because API34 smoke is a required dependency. Evidence is saved under `validation-logs/ci-api34-followup-run.log` and `validation-logs/ci-api34-followup-smoke-evidence/`.
- Small harness correction underway: copy the exclusion list from `/data/local/tmp` into the test APK’s private files directory with `run-as`, check readability, and give AndroidJUnitRunner that private path. No production code changed. Candidate remains BLOCKED pending a successful hosted rerun and complete API matrix.


### Phase 3 hosted run 42456412518 — runner package path correction needed
- Candidate SHA `aa330de7f9b1267fe5e746ba3a23592667a2ac27`: hosted build, full npm, Sentinel, TypeScript, production build, APK signing check, and API29 recovery preflight passed. Recovery preflight was 1/1. Isolated API34 background reminder passed 1/1.
- API34 full suite again stopped before test discovery, now with `ENOENT` for `/data/user/0/com.lifeos.personal.test/files/lifeos-test-exclusions.txt`. Runner test data was staged into the instrumentation package, but process-exit information identifies the runner process as `com.lifeos.personal`; that process cannot see the other package’s private directory. JUnit count is 0, with a runner setup error. Full suite did not execute.
- API29 full and API35 matrix jobs were skipped by the API34 dependency. Evidence is in `validation-logs/ci-api34-private-exclusions-run.log` and `validation-logs/ci-api34-private-exclusions-smoke-evidence/`.
- Next correction puts the exclusions file in the app package’s own private files directory, which matches the runner process recorded by Android. On the current source, `npm test` exited 0, Sentinel 6/6, TypeScript 0, production build 2,255 modules/exit 0, shell syntax and four simulated runner contracts passed. The hosted correction remains mandatory. The original 42452318984 partial instrumentation crash remains unexplained separately.
