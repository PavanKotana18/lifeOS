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
| Android instrumentation API 29 | Full suite; exact expected/executed/pass/fail/skip count | BLOCKED on latest SHA | Full matrix passed 12/12 on prior SHA `565f69d`; latest SHA `d7767f2` passed API29 recovery preflight only, then API34 smoke failed before the matrix could start. |
| Android instrumentation API 34 | Full suite; exact expected/executed/pass/fail/skip count | FAIL on latest SHA | Run 42460350359, SHA `d7767f2`: expected 17; 9 completed, all 9 passed, 0 assertion failures/skips, 3 runner errors. App process exited because its Google Play services FontsProvider dependency had died. Exit info shows app RSS 642 MB and Chromium tile-memory warnings; memory pressure is plausible but not confirmed as the provider’s cause. Evidence: `validation-logs/ci-api34-final-run.log` and `validation-logs/ci-api34-final-smoke-evidence/`. Prior SHA `565f69d` passed all 17. |
| Android instrumentation API 35 | Full suite including screenshot/lifecycle acceptance | NOT RUN on latest SHA | Matrix gated by the API34 smoke failure. Prior SHA `565f69d` passed 17/17, but the latest candidate SHA has no API35 execution. |
| Notification Android acceptance | Optional reminders, permission behavior, restore and tap route | PARTIAL on latest SHA | Run 42460350359: isolated background reminder passed 1/1. In full API34 smoke, 9 tests completed then the app process exited while the registered-plugin scheduling test was starting; no assertion failure was recorded. New two-test isolated reproduction is prepared locally but not yet hosted. Permission flows, reboot restoration, tap routes, and physical delivery remain device acceptance. |
| Profile/navigation acceptance | Settings persistence, swipe guards, fonts, keyboard, accessibility | NOT RUN | Physical acceptance required |
| Debug APK | Exact candidate SHA, package, version, signer fingerprint, artifact integrity | PASS on latest SHA; full release candidate blocked | Run 42460350359 build job passed APK package/signing and new run-specific versionCode assertion on SHA `d7767f2`; matrix did not pass. Artifact is not treated as release accepted until mandatory instrumentation gates pass. |
| Installed-data update test | Candidate install over disposable prior build; encrypted data retained | BLOCKED | Physical Android update install required |
| Draft candidate PR | Correct base, draft state, exact candidate SHA | BLOCKED | Latest candidate SHA failed API34 smoke. Do not open a draft PR until the failed gate is resolved and all API matrices pass on one exact SHA. |


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
- Current decision remains **BLOCKED**. Do not create a candidate PR or claim API29/34/35 acceptance for the current candidate SHA until one exact candidate SHA completes every required matrix with zero unexplained skips/errors.


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
