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
| Android instrumentation API 29 | Full suite; exact expected/executed/pass/fail/skip count | BLOCKED | API29 recovery preflight PASS: 1 expected, 1 executed, 1 passed, 0 failed/skipped. Full suite did not run because API34 smoke failed first. |
| Android instrumentation API 34 | Full suite; exact expected/executed/pass/fail/skip count | FAIL | Run 42452318984, exact SHA 23051d5. Expected 19; completed 9 (8 pass, 0 fail, 1 skip); 3 parser errors including unexpected process crash while starting backgrounded notification test; the job recorded the emulator offline only after `android-emulator-runner` teardown; this is not evidence that the emulator caused the test crash. Evidence: `validation-logs/ci-api34-failure/`. |
| Android instrumentation API 35 | Full suite including screenshot/lifecycle acceptance | NOT RUN | Matrix gated by API34 smoke failure; screenshot/lifecycle test not device-verified. |
| Notification Android acceptance | Optional reminders, permission behavior, restore and tap route | NOT RUN | No architecture change planned |
| Profile/navigation acceptance | Settings persistence, swipe guards, fonts, keyboard, accessibility | NOT RUN | Physical acceptance required |
| Debug APK | Exact candidate SHA, package, version, signer fingerprint, artifact integrity | BLOCKED for pending candidate commit | Prior run 42452318984 on SHA `23051d5` produced a verified APK (`com.lifeos.personal`, version 1.0.0, signer SHA-256 `735210B06A6088389F5EFADFA630DE42847D5949091C4A146183B579ED7D56A2`, APK SHA-256 `1c98435c4aa8816f19268e5305af01a15f449637a5dec9f800f43b1c5fe78b6e`). A new artifact must be built and verified for the follow-up commit. |
| Installed-data update test | Candidate install over disposable prior build; encrypted data retained | BLOCKED | Physical Android update install required |
| Draft candidate PR | Correct base, draft state, exact candidate SHA | BLOCKED | Not opened: API34 full instrumentation is incomplete and API29/35 matrix results are unavailable. |


## Latest category fixture and local validation update (2026-11-08)

- Exact fixture: default expense category ID `cat_food` (`Food`). The synthetic ₹500 Amazon credit-card expense inserts `category: 'Food'`; the following balance assertion was unreachable when the missing fixture caused the expected referential-integrity rejection. Normal category initialization is now called before transaction fixtures and its result is asserted. No production validator changed. Current post-#25 location: `test_db_atomicity.js:784`; original #22-stage layout: line 571.
- `node test_db_atomicity.js`: PASS, 62 assertions. `npm run test:encrypted`: PASS (18 facade, 58 migration, 10 transaction coordinator, 7 session coordinator assertions). Full `npm test`: PASS, exit 0. Sentinel: 6/6 suites PASS. TypeScript: PASS, exit 0. Production build: PASS, 2,255 modules; nonfatal 624.36 kB bundle warning. Evidence logs: `validation-logs/20261108-final-{npm-test,sentinel,typescript,production-build}.txt`.
- Initial hosted candidate run 42452318984 passed build/security/signing and API29 recovery preflight but failed during API34 notification instrumentation. A narrow follow-up workflow now adds isolated API34 reproduction, preserves pre-teardown process diagnostics, and uses explicit per-API supported-test inventories (12 on API29, 17 on API34/35). These follow-up changes have not yet been pushed or executed. No physical-device test is claimed.


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
- Remote Actions still contains only failed run `42452318984` for SHA `23051d5`. The focused API34 reproduction and all three API full matrices have not run on the follow-up source. Root cause remains unknown. Current decision: **BLOCKED — mandatory validation incomplete**.
