# Release Candidate Validation Matrix

Candidate: `integration/lifeos2-release-candidate-20261108`
Pinned base: `d7882d29d68fa45ac026c1da490b80aa910cd0a0`

Status meanings: PASS = executed successfully on the recorded candidate/stage; FAIL = executed and failed; BLOCKED = required environment/evidence unavailable; NOT RUN = not yet executed. Compiled-only tests are not execution passes.

| Gate | Evidence required | Status | Evidence / blocker |
|---|---|---|---|
| Git ancestry and no duplicate integration | Exact PR SHAs, merge parents, stage ancestry | PASS through #25 | #18/#19 join at #20; source histories integrated sequentially through #23, #24, and #25; no duplicate ancestor cherry-picks |
| Candidate isolation | New branch/worktree from pinned main; no prior worktree changed | PASS baseline | Clean candidate at pinned base |
| Per-stage focused tests | Relevant npm contracts after each integrated stage | PASS through #25 | #25 DB atomicity 62; encrypted admission 6/6; encrypted atomicity 8/8; backup validation 23/23; IndexedDB backup 6/6; Money 2 workflows 21; Profile and navigation focused suites pass. Includes v1→v2 preservation and synthetic Amazon/HDFC reversal/undo. See `validation-logs/`. | `npm test` exit 0 after each; simulated/native-source and disposable IndexedDB tests |
| Per-stage TypeScript | `npx tsc --noEmit` after each stage | PASS through #25 | #25 exit 0: `validation-logs/20261108-pr25-typescript.txt` | Exit 0 after each |
| Full npm suite | `npm test` on exact candidate head | PASS through #25 | Expanded suite exit 0: `validation-logs/20261108-pr25-npm-test-final.txt` |
| Sentinel | `npm run test:sentinel` on exact candidate head | PASS through #25 | 6/6 suites; actual 15-table schema v2. SAF runtime uses bridge simulation/source checks; physical document picker remains outstanding |
| Production build | `npm run build` on exact candidate head | PASS through #25 | 2,255 modules, exit 0. Main JS chunk 624.36 kB exceeds 500 kB advisory threshold |
| Dexie v1→v2 upgrade | Legacy records/indexes preserved in disposable database | PASS through #25 | Atomicity suite verifies existing transactions, category/budget links, tasks, profile settings, and empty new finance stores |
| Encrypted migration safety | Existing ciphertext, plaintext legacy rows, retry/interruption/concurrency | PASS in synthetic Node suite; device BLOCKED | Admission, secure-startup, migration and recovery cases pass with simulated native cryptography; installed Android upgrade still required |
| Backup compatibility | Legacy 11-table and current 15-table validation/round-trip/rollback | PASS in Node; Android SAF BLOCKED | Legacy 11-table and current 15-table round trips/rollback covered; picker operation is not device-verified |
| Android SAF backup/restore | Real Android document picker and restore | BLOCKED | Requires emulator/device execution |
| Money 2.0 invariants | Exact balances, liability signs, transfer/reversal/undo, no income inflation | PASS in synthetic suite | 62 DB assertions + 21 Money workflow checks; synthetic Amazon/HDFC values in progress log |
| Android instrumentation API 29 | Full suite; exact expected/executed/pass/fail/skip count | PASS on latest run | Run 42463310143, SHA `b8e7f8a`: 12 expected / 12 executed / 12 passed / 0 failed / 0 skipped / 0 runner errors. Recovery preflight passed 1/1. |
| Android instrumentation API 34 | Full suite; exact expected/executed/pass/fail/skip count | FAIL on latest run | Run 42463310143, SHA `b8e7f8a`: expected 17, executed 17, passed 16, failed 1, skipped 0, runner errors 0. `LocalNotificationBridgeAcceptanceTest#backgroundedSyntheticTaskReminderIsActuallyPosted` failed at line 92: persisted notification row remained visible immediately after the notification appeared. JUnit/logcat/process/memory evidence: `validation-logs/ci-b8e7f8a-api34/`. API34 smoke 17/17 and isolated notification pair 2/2 passed on this SHA, but the full matrix remains a mandatory failure. |
| Android instrumentation API 35 | Full suite including screenshot/lifecycle acceptance | INCOMPLETE on latest run | API35 job was still running when work stopped at the API34 failure. No final test count or pass is claimed for SHA `b8e7f8a`. Prior SHA `e607510` passed 17/17. |
| Notification Android acceptance | Optional reminders, permission behavior, restore and tap route | BLOCKED | On latest SHA, the notification was visibly delivered, but the test then found the persisted pending row still present at its immediate follow-up assertion. Receiver source calls `deleteNotification` after posting; whether this is test observation timing/cross-process SharedPreferences visibility or a cleanup defect is not yet proven. Isolated bridge pair 2/2 and smoke passed. Permission denial/regrant, reboot restoration, tap routes, and physical delivery remain unverified. |
| Profile/navigation acceptance | Settings persistence, swipe guards, fonts, keyboard, accessibility | NOT RUN | Physical acceptance required |
| Debug APK | Exact candidate SHA, package, version, signer fingerprint, artifact integrity | BUILD VERIFIED; candidate blocked | Run 42463310143 on SHA `b8e7f8a` passed package/signing/versionCode validation and uploaded artifact `13611105316`. The full candidate is not accepted because API34 failed. Prior fully verified APK metadata and local hash are recorded under run 42461630864. |
| Installed-data update test | Candidate install over disposable prior build; encrypted data retained | BLOCKED | Physical Android update install required |
| Draft candidate PR | Correct base, draft state, exact candidate SHA | BLOCKED | Latest candidate run 42463310143 failed API34. Do not open a candidate PR until mandatory matrix tests pass on one exact SHA. Physical-device acceptance remains required before merge review. |


## Latest category fixture and local validation update (2026-11-08)

- Exact fixture: default expense category ID `cat_food` (`Food`). The synthetic ₹500 Amazon credit-card expense inserts `category: 'Food'`; the following balance assertion was unreachable when the missing fixture caused the expected referential-integrity rejection. Normal category initialization is now called before transaction fixtures and its result is asserted. No production validator changed. Current post-#25 location: `test_db_atomicity.js:784`; original #22-stage layout: line 571.
- `node test_db_atomicity.js`: PASS, 62 assertions. `npm run test:encrypted`: PASS (18 facade, 58 migration, 10 transaction coordinator, 7 session coordinator assertions). Full `npm test`: PASS, exit 0. Sentinel: 6/6 suites PASS. TypeScript: PASS, exit 0. Production build: PASS, 2,255 modules; nonfatal 624.36 kB bundle warning. Evidence logs: `validation-logs/20261108-final-{npm-test,sentinel,typescript,production-build}.txt`.
- Initial hosted candidate run 42452318984 passed build/security/signing and API29 recovery preflight but failed during API34 notification instrumentation. A narrow follow-up workflow now adds isolated API34 reproduction, preserves pre-teardown process diagnostics, and uses explicit per-API supported-test inventories (12 on API29, 17 on API34/35). These follow-up changes have not yet been pushed or executed. No physical-device test is claimed.

## Latest API 34 evidence and diagnostic follow-up (2026-11-08)

- Latest completed hosted run at inspection: [42460350359](https://github.com/PavanKotana18/lifeOS/actions/runs/42460350359), exact candidate SHA `d7767f215701376e0479ec9c7c93cf1bf0799177`. Build/test/signing and the explicit APK versionCode check passed. API29 recovery preflight passed 1/1; the isolated background reminder passed 1/1.
- API34 smoke expected 17 unattended tests. Nine completed and all nine passed; zero assertion failures and zero JUnit skips, but three runner errors followed when the app process exited as the registered-plugin scheduling test was starting. API29 and API35 full matrices were skipped because API34 smoke is a required dependency. This is an incomplete mandatory run and blocks the candidate.
- The saved `ApplicationExitInfo` identifies the app exit as `DEPENDENCY DIED`, caused by a dependency on `com.google.android.gms/.fonts.provider.FontsProvider` in a dying Google Play services process. It records app RSS 642 MB / PSS 577 MB. Chromium also logged tile-memory-limit warnings. This confirms the immediate dependency-death exit reported by Android; it does not establish why the provider process died or prove memory pressure was the cause. The instrumentation package has no corresponding exit record in the saved output.
- Evidence is retained under `validation-logs/ci-api34-final-smoke-evidence/` and the run log `validation-logs/ci-api34-final-run.log`. The independent API34 isolated test from this run covered the background reminder only; it did not exercise the registered-plugin test.
- Current local diagnostic-only changes (not yet pushed): capture all error-level logcat buffers, Google Play services exit history, and system/app memory snapshots on emulator failure; exercise both notification bridge tests in sequence in the isolated API34 job and require both names in JUnit. Production app code and security behavior are unchanged. Local runner contract and full npm, Sentinel, TypeScript, and production-build gates passed after these changes. The new hosted reproduction has not run yet.
- At this checkpoint, the current candidate was **BLOCKED** pending a hosted rerun. The later exact-SHA results below supersede that interim status.

## Hosted candidate validation 42461630864 — automated gates passed

- Exact branch head: `e607510093a8ad605daee6de83d6888bec63bfd7`. Full workflow: [42461630864](https://github.com/PavanKotana18/lifeOS/actions/runs/42461630864). All workflow jobs completed successfully.
- Build job on this exact SHA passed full `npm test`, Sentinel (6/6 suites), TypeScript, production build, Android app/instrumentation APK compile, stable Debug signing, and direct APK `versionCode` validation against the run-specific formula.
- API29: 12 expected / 12 executed / 12 passed / 0 failed / 0 skipped / 0 runner errors; recovery preflight 1/1.
- API34: isolated notification pair 2/2, smoke 17/17, full matrix 17/17; all zero failures, skips, and runner errors.
- API35: 17 expected / 17 executed / 17 passed / 0 failed / 0 skipped / 0 runner errors, including screenshot/lifecycle coverage.
- APK artifact: [signed Debug APK, artifact 13609942410](https://github.com/PavanKotana18/lifeOS/actions/runs/42461630864/artifacts/13609942410). Downloaded file SHA-256 equals the CI hash. Package `com.lifeos.personal`, version `1.0.0`, versionCode `1000021`, signing certificate SHA-256 `735210B06A6088389F5EFADFA630DE42847D5949091C4A146183B579ED7D56A2`, APK SHA-256 `2257415b8e47eea5c15231b058b9eb0cd99f67ae4e8037c87e5d1aa848395ea2`.
- The earlier API34 run 42460350359 ended after 9/17 tests and reported the application was terminated because its Google Play services FontsProvider dependency process died. The new two-test notification reproduction, full API34 smoke, and full API34 matrix all passed. The immediate OS-reported termination reason is known; the reason the provider process died remains unknown. No app-process or security defect was established, and the prior event is retained as an intermittent CI/environment risk rather than claimed fixed by a confirmed root cause.
- No physical-device acceptance or installed-data update test has occurred. A final documentation-only commit and rerun are still required to bind the completed report to the exact candidate SHA before opening a draft PR.

## Latest candidate run 42463310143 — BLOCKED at API34 matrix

- Exact head: `b8e7f8a8b73a55921e219b2aab54e464a5455af9`. The build job and API29 recovery preflight passed. API29 matrix passed 12/12, with zero failures, skips, or runner errors. API34 isolated notification pair passed 2/2 and full smoke passed 17/17.
- API34 matrix JUnit expected/executed 17; 16 passed, 1 failed, 0 skipped, 0 runner errors. Failure: `LocalNotificationBridgeAcceptanceTest#backgroundedSyntheticTaskReminderIsActuallyPosted`, `android/app/src/androidTest/java/com/lifeos/personal/LocalNotificationBridgeAcceptanceTest.java:92`, assertion text `Capacitor receiver must retire the persisted pending row after posting`.
- The thrown assertion is `assertFalse(savedIds.contains(id))`; because it failed, `contains(id)` was true in the test's read at that moment. This conflicts with the description that the ID was absent; the actual JUnit outcome is authoritative. The native receiver source calls `notificationManager.notify(...)` and then `storage.deleteNotification(...)`; the latter uses `SharedPreferences.Editor.apply()`. This suggests a possible observation/process-boundary issue, but the available failure output does not prove that; a real cleanup defect has not been ruled out. Do not weaken or remove the assertion.
- Android process exit info shows the app was force-stopped after instrumentation completion, not a dependency-death crash. The complete captured output has no app assertion stack other than the failed test assertion. Evidence is retained in `validation-logs/ci-b8e7f8a-api34/`.
- API35 later completed successfully in the same run: 17/17 passed, zero failures, skips, or runner errors (JUnit retained in the `lifeos-android-qa-large-api35` run artifact). This does not clear the API34 failure. The workflow is not considered passing. No PR was opened. No physical device was tested.
- Safe next step: fix the test’s readback to observe the notification store from the app/plugin process, or use a bounded wait that still fails if the row does not disappear; first establish whether the row persists in the app process. Then run that notification test focused and re-run API34 instrumentation. Do not proceed to release/PR until a complete exact-SHA API29/34/35 run passes with exact counts and zero skips/errors.

## Notification persistence contract review and repeated isolation plan

- `NotificationStorage.getSavedNotificationIds()` represents stored scheduled notifications, and `LocalNotificationsPlugin.getPending()` reads the same store. For a one-shot notification, `TimedNotificationPublisher.onReceive()` posts it and then deletes its stored row; repeating cron notifications are rescheduled instead. The test’s expectation that the delivered one-shot ID leaves the pending list is consistent with the receiver’s intended behavior.
- Android documents `SharedPreferences.Editor.apply()` as updating the calling process’s in-memory preferences immediately and writing to disk asynchronously; `SharedPreferences` instances are process-local. The JUnit record proves the test-side read contained the ID, but does not establish which process served the read or whether the receiver’s delete had already run. The process/race hypothesis remains unverified; no production change is justified yet.
- The two-method isolated notification sequence passed once on SHA `b8e7f8a`, while the full API34 matrix failed at the cleanup assertion. The candidate workflow is being adjusted to run that unchanged sequence three times on separate fresh API34 emulators before smoke/matrix jobs. No assertion is changed, no fixed sleep is added, and no production or security code is altered.


## Hosted Android run 42452318984 — BLOCKED

- Exact head SHA: `23051d5feaf28547a630e34e06913f6d34246d12`; Actions run: https://github.com/PavanKotana18/lifeOS/actions/runs/42452318984.
- Node suite, Sentinel, TypeScript, production build, Android APK build, stable Debug signing verification, and API29 recovery preflight all passed.
- Signed APK metadata: package `com.lifeos.personal`, version `1.0.0`, signer SHA-256 `735210B06A6088389F5EFADFA630DE42847D5949091C4A146183B579ED7D56A2`, APK SHA-256 `1c98435c4aa8816f19268e5305af01a15f449637a5dec9f800f43b1c5fe78b6e`.
- API29 preflight: 1 expected, 1 executed, 1 passed, 0 failed, 0 skipped.
- API34 full smoke failed before completion. Its JUnit summary expected 19, completed 9, with 8 passed, 0 assertion failures, 1 skipped, and 3 completion/parser errors. It stopped while beginning `LocalNotificationBridgeAcceptanceTest#backgroundedSyntheticTaskReminderIsActuallyPosted`; raw runner output says `Process crashed`. The workflow captured ADB-offline only after emulator teardown, so the root cause remains unresolved; saved evidence: `validation-logs/ci-api34-failure/`.
- The skip is the explicit opt-in interactive biometric test; the suite must report it separately from unattended mandatory tests without hiding a skip. API29/34/35 full matrix is incomplete (API29 and API35 not run; API34 incomplete).
- Decision: BLOCKED. Do not create candidate PR or claim device acceptance. Next safe step is a focused API34 reproduction with live emulator log capture and a corrected partition for human-opt-in biometric acceptance, followed by a complete zero-skip mandatory matrix.


## Phase 3 integration reconciliation

Pinned baseline is `d7882d29d68fa45ac026c1da490b80aa910cd0a0`; candidate branch and remote HEAD are both `23051d5feaf28547a630e34e06913f6d34246d12`. The baseline is an ancestor. GitHub comparison against PR #25 source branch `feature/lifeos2-bulk-development-20261107` reports candidate ahead 22, behind 0. Every PR #13–25 source SHA is an ancestor of the candidate. **INTEGRATION COMPLETE**; no PR was re-integrated. Merge result tree comparisons found no production-path delta from the corresponding PR/source second parent.

| PR | Source head SHA | Candidate inclusion | Focused evidence | Status |
|---:|---|---|---|---|
| 13 | `3e11619d612fc4207bf5972979a8583da069ea3e` | Merge `c47ae82f`; ancestry | encrypted startup, recovery, legacy data | INTEGRATED |
| 14 | `5848a0eb4c887d5c9479208ae282d8a72a228268` | Merge `92440d17`; ancestry | local consolidation and preservation | INTEGRATED |
| 15 | `0ec1a07fb04572b5dbbcf3f317b742ade7431fce` | Merge `36b11a1b`; ancestry | Android acceptance scaffold | INTEGRATED |
| 16 | `d186cec4a0df1f488c56e46438aa62d49487065d` | Inherited through #20 source ancestry | release-candidate verification | INTEGRATED |
| 17 | `3d05b3720863f9d029c3fa6dbeb4387ea62e5496` | Inherited through #20 source ancestry | emulator matrix and runner | INTEGRATED |
| 18 | `ead4ffa1dcc3c966c588d4c7c7ae8922078748b7` | Parallel head joined in #20 | finance sorting and Android return flow | INTEGRATED |
| 19 | `95e5942108c1de1dabaec4020fe588dd68b1d5d5` | Parallel head joined in #20 | `scripts/test-android-runner.cjs` | INTEGRATED |
| 20 | `5d858ac23b7b6b12c0d473b681ec88769f3dddcc` | Merge `5949074e`; carries #16–19 | runner and emulator acceptance | INTEGRATED |
| 21 | `1943b5daecc3d0ee7e3bb7bd52d42502c1d06fae` | Merge `4ac85b95`; ancestry | persistence and security release gates | INTEGRATED |
| 22 | `7650f5ead7d0aa4e0e108eec78faecac4bcd708e` | Merge `da919745`; ancestry | admission, atomicity, migration | INTEGRATED |
| 23 | `a8fb1845e6607139a0e3e0b6545ba455572020b4` | Merge `7119cb63`; ancestry | secure startup and regressions | INTEGRATED |
| 24 | `f1a26b199f4db8b7b0f64fd9136f23d6dfebb927` | Merge `0938a41f`; ancestry | savings accounting and UI contracts | INTEGRATED |
| 25 | `070e6dccf4def89efc113f49bfa25cd98be526f7` | Merge `dfac7193`; ancestry | Money accounts/transfers and profile | INTEGRATED |

PR #18 and #19 were not merged a second time; their source heads are ancestors of PR #20. PR #16/#17 likewise enter through the #20 chain.

## API 34 failure diagnosis and inventory policy

The recorded fact is that AndroidJUnitRunner emitted `Process crashed` while the backgrounded notification-delivery test was active. The report contains no test assertion failure or Java exception stack. The workflow’s later failure step ran after the emulator action had terminated the AVD, then overwrote its earlier logcat output. Therefore the post-cleanup ADB-offline state cannot distinguish app-process, instrumentation-process, notification bridge, lifecycle, or runner failure. No crash source is yet proven.

The next candidate workflow first runs `LocalNotificationBridgeAcceptanceTest#backgroundedSyntheticTaskReminderIsActuallyPosted` alone on API 34 and captures process exit data/logcat before emulator teardown. The full suite remains gated on that test. The interactive biometric test requires explicit user opt-in and is listed as not run on unattended AVDs; it remains required physical-device acceptance. API29’s captured WebView provider is Chromium 74, below the app’s Chromium 87 minimum. Its deterministic AVD inventory excludes seven WebView-dependent/interactive cases while retaining native recovery/security and unsupported-engine guidance. Expected counts are API29: 12, API34: 17, API35: 17; each run must have exact execution count and zero skips/failures/errors.

## iQOO Neo 9 Pro (Android 16) physical-device checklist

Record date, app version, APK SHA-256, Android version, and outcome for each item. Use synthetic personal/financial records.

1. Fresh install; complete onboarding; verify display name persists after restart.
2. Grant or deny notifications; verify task creation works either way and reminder categories remain optional.
3. Create the first private record; verify secure setup and contextual recovery choice appear only as designed.
4. Defer recovery; create another private record and restart; verify no repeated blocking recovery prompt.
5. Verify encrypted records persist after force-close/restart and are unavailable while locked.
6. Enroll biometric protection; verify unlock, background relock, explicit relock, and successful next unlock.
7. Schedule a synthetic reminder; verify actual delivery at the expected time with permission allowed and denied behavior.
8. Open reminder taps from foreground, background, and cold start; verify safe routing after authentication.
9. Verify Money accounts/opening balances, ₹500 card expense, ₹5,000 and ₹3,000 transfers, reversal/undo, and unchanged unrelated transfer.
10. Export a backup using Android’s document picker; restore into a disposable profile and verify records and encryption protections.
11. Install the candidate APK over an older disposable install; verify package/signature continuity and preservation of encrypted existing data.
12. Change theme, currency, and font scale; restart and verify persistence.
13. Check Today/Money/Plan/Life navigation, swipe exclusions, system back, keyboard-open forms, large text, labels, and accessibility focus.

No physical-device item is marked passed until observed and recorded on that phone.


## Phase 3 local gates after diagnostic harness changes

All commands below ran on source candidate `23051d5feaf28547a630e34e06913f6d34246d12`; only runner/workflow, exclusion inventory, and validation documentation changed.

| Gate | Result | Evidence |
|---|---|---|
| Database atomicity / Money accounts, transfers, reversals | PASS, 62 assertions | `validation-logs/phase3-db-atomicity.log` |
| Encrypted admission | PASS, 6/6 | `validation-logs/phase3-encryption-admission.log` |
| Encrypted-session atomicity | PASS, 8/8 | `validation-logs/phase3-encrypted-atomicity.log` |
| Encrypted facade / migration / coordinator / session | PASS, 18 + 58 + 10 + 7 checks | `validation-logs/phase3-encrypted-migration.log` |
| Backup validation / IndexedDB atomic restore | PASS, 23/23 + 6/6 | `validation-logs/phase3-backup-validation.log`, `phase3-backup-indexeddb.log` |
| Finance minor units / analytics / Money workflows | PASS, 56 + 13 + 21 assertions | `validation-logs/phase3-finance-core.log`, `phase3-finance-analytics.log`, `phase3-money-workflows.log` |
| Profile / navigation | PASS; navigation 14 checks | `validation-logs/phase3-profile.log`, `phase3-navigation.log` |
| Android runner test harness contract | PASS; ADB simulated only | Included in full npm log; no emulator claim |
| Full `npm test` | PASS, exit 0 | `validation-logs/phase3-full-npm-test.log` |
| Sentinel | PASS, 6/6 suites | `validation-logs/phase3-sentinel.log` |
| TypeScript | PASS, exit 0 | `validation-logs/phase3-typescript.log` |
| Production build | PASS, 2,255 modules; advisory bundle-size warning | `validation-logs/phase3-production-build.log` |

The current follow-up workflow is not yet hosted-validated. It runs the failed API34 notification test in isolation first, records pre-teardown process/log evidence, excludes only explicitly non-applicable or human-interactive cases, and enforces exact counts with zero JUnit skips/errors: 12 tests on API29, 17 on API34, and 17 on API35. API29 exclusions are tied to the observed WebView 74 provider, below LifeOS’s supported Chromium 87 boundary; compatibility guidance and native crypto/recovery tests remain in the run. Interactive biometric setup/unlock remains a physical test, reported NOT RUN until observed on the target device.

## Phase 3 latest local validation checkpoint

- Local source is based on candidate SHA `23051d5feaf28547a630e34e06913f6d34246d12`; the working tree contains only Android QA harness/workflow, inventory, and validation documentation changes. No production app code or database schema changed.
- Full `npm test` completed successfully, including all registered suites and the simulated ADB runner contracts. Sentinel passed all 6 suites; TypeScript and production build exited 0 (2,255 modules; advisory bundle-size warning).
- Android test declaration audit found 19 methods. Every exclusion entry maps to a declared test; API29 calculates 12 unattended cases and API34/35 calculate 17. The Android runner simulation passed all four contract scenarios; it is not emulator execution.
- Workflow YAML parsing, `git diff --check`, and `bash -n scripts/run-android-instrumentation.sh` passed. Candidate PR trigger now includes `main`; matrix validation rejects JUnit runner errors explicitly.
- Actions run [42457299565](https://github.com/PavanKotana18/lifeOS/actions/runs/42457299565) on SHA `5a3ac3f87aa15a8420234ea709f24bd25c4f15d4`: build, Node, Sentinel, TypeScript, production build, signer check, API29 recovery preflight (1/1), isolated notification test (1/1), and API34 smoke (17/17, all passing with zero skips/errors) succeeded. API29 matrix instrumentation itself completed 12/12, all passed, 0 skipped. The job failed afterward because the runner wrapper still required the deliberately excluded API29 WebView launch smoke. We canceled the remaining matrix jobs after that failed gate; API35 remains incomplete.
- The current local workflow fix assigns a required test per API matrix: native crypto provisioning denial on API29 and launch smoke on API34/35. The local source has not yet run hosted. Current decision remains **BLOCKED — mandatory validation incomplete**.
- Local checks after that change: full `npm test` exit 0; four simulated ADB runner contracts passed; workflow YAML parsed; shell syntax and diff checks passed. Sentinel, TypeScript, and production build passed on the preceding runner-only revision and will rerun in hosted CI for the next SHA.

## Hosted matrix and artifact verification — run 42458584267

- Exact SHA `565f69d7f3836d849be9e9c1e20379dc2d1df6f2`; workflow conclusion `success`.
- API29: 12 expected / 12 executed / 12 passed / 0 failed / 0 skipped / 0 runner errors. API34: 17/17/17/0/0/0. API35: 17/17/17/0/0/0. API34 full smoke also 17/17, and isolated background reminder 1/1. Interactive biometric remains explicitly excluded from unattended runs and unverified on the physical target.
- Build job’s npm tests, Sentinel, TypeScript, production build, APK compilation, and signing verification all passed. Sentinel reports 6/6 suites. The WebView chunk warning is advisory.
- Downloaded Debug APK artifact [13608687330](https://github.com/PavanKotana18/lifeOS/actions/artifacts/13608687330), package `com.lifeos.personal`, version name `1.0.0`, signer SHA-256 `735210B06A6088389F5EFADFA630DE42847D5949091C4A146183B579ED7D56A2`. SHA-256 of downloaded APK: `50bf49778bb0561a6d99e137c9947a792c970f143751ac0f763885f6e96d15ed`; this matches the SHA printed by the hosted `aapt`/`sha256sum` verification step. Candidate SHA is the workflow head shown above.
- Workflow run number was 19. Gradle derives versionCode from `1.0.0` plus run number (expected `1000019`), but this run’s log only printed versionName. A new check now verifies versionCode directly from APK badging and the formula; a new hosted run is required for that final metadata gate.
- No physical-device acceptance occurred. No draft candidate PR has been opened yet.
- On that correction’s local source: `npm test` exit 0; Sentinel 6/6; TypeScript exit 0; production build exit 0 (2,255 modules, advisory bundle warning); shell syntax, diff checks, and four simulated ADB runner scenarios passed. These results do not establish Android execution. Candidate remains blocked until the corrected file path works on hosted API34 and API29/34/35 full inventories complete.
