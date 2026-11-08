# WP0 regression results

WP0 only; source base `d7882d29d68fa45ac026c1da490b80aa910cd0a0`, branch `test/wp0-production-regressions-20261106`, isolated worktree `/data/data/com.termux/files/home/lifeos-wp0`. HEAD remains at the base commit: changes are **uncommitted**; no implementation SHA exists. Original branch remains `fix/gemini-vapt-remediation-20261105` at `93f882f317e76998963582d547efa7deb438ad03`. Audit source: `/data/data/com.termux/files/home/lifeos-audit-reports/20261106T111738Z`. Execution on Termux/aarch64, Node24.17.0/npm11.17.0; CI Node20 is configured but not executed remotely. No WP1–WP6 production fixes.

Source HEAD remains main; implementation files uncommitted. known-defects.json records exact production SHA256 values. file-manifest.json identifies the final test infrastructure patch; do not attribute uncommitted code to the base commit.

| Log / phase | Exact command | Exit / expected | Seconds |
|---|---|---|---:|
| `npm-test.log` | `npm test` | 0 / 0 | 15.87 |
| `sentinel.log` | `npm run test:sentinel` | 0 / 0 | 3.57 |
| `test-all.log` | `npm run test:all` | 0 / 0 | 20.14 |
| `typecheck.log` | `npx tsc --noEmit` | 0 / 0 | 4.99 |
| `build.log` | `npm run build` | 0 / 0 | 8.41 |
| `known-defects.log` | `npm run test:regressions -- --json /data/data/com.termux/files/home/lifeos-remediation-reports/wp0/known-defects.json` | 0 / 0 | 8.63 |
| `known-defects-strict.log` | `npm run test:regressions:strict -- --json /data/data/com.termux/files/home/lifeos-remediation-reports/wp0/known-defects-strict.json` | 1 / 1 | 8.62 |
| `diff-check.log` | `git diff --check` | 0 / 0 | 0.05 |
| `final-npm-test.log` | `npm test` | 0 / 0 | 15.71 |
| `final-known-defects.log` | `npm run test:regressions -- --json /data/data/com.termux/files/home/lifeos-remediation-reports/wp0/known-defects.json` | 0 / 0 | 8.93 |
| `final-known-defects-strict.log` | `npm run test:regressions:strict -- --json /data/data/com.termux/files/home/lifeos-remediation-reports/wp0/known-defects-strict.json` | 1 / 1 | 9.24 |

## Known acceptance results

| ID | Category | Checks | Status | Desired / observed |
|---|---|---:|---|---|
| LOS-001 | Production integration / AST-extracted startup; simulated browser/native | 3 | KNOWN_DEFECT | expected {"activated": true, "encrypted": true, "plaintextFieldsAbsent": true}; actual {"activated": false, "encrypted": false, "plaintextFieldsAbsent": false} |
| LOS-002 | Production integration; real validator/facade/coordinator/Dexie; simulated native | 17 | KNOWN_DEFECT | expected {"restored": true}; actual {"restored": false, "reason": "Valid table-name list treated as errors"} |
| LOS-003 | Mocked native lifecycle simulation + actual App callback / encrypted DB | 18 | KNOWN_DEFECT | expected {"nativeKeyAvailable": true, "protectedReloadCompleted": true}; actual {"nativeKeyAvailable": false, "protectedReloadCompleted": false} |
| LOS-007 | Production integration: raw/encrypted goal API parity; simulated native | 4 | KNOWN_DEFECT | expected {"targetReached": "Completed", "prematureCompletion": "In Progress", "lastMilestone": "Completed", "reopenedMilestone": "In Progress", "paused": "Paused"}; actual {"targetReached": "In Progress", "prematureCompletion": "Completed", "lastMilestone": "In Progress", "reopenedMilestone": "In Progress", "paused": "Paused"} |
| LOS-008 | Production integration: raw/encrypted recurrence parity; fixed local clock; simulated native | 16 | KNOWN_DEFECT | expected {"Daily": "2026-11-07", "Weekly": "2026-11-13", "Monthly": "2026-11-28"}; actual {"Daily": "2020-02-01", "Weekly": "2020-02-07", "Monthly": "2020-02-29"} |
| LOS-009 | Mocked native pending-alarm simulation + actual reset handler / Dexie | 19 | KNOWN_DEFECT | expected []; actual ["habitReminder", "milestoneReminder"] |
| LOS-010 | Production AST-extracted export handler; simulated file export/browser | 5 | KNOWN_DEFECT | expected ["'=1+1", "'+1+1", "'-1+1", "'@SUM(1)", "'\t=1+1", "'\r=1+1"]; actual ["=1+1", "+1+1", "-1+1", "@SUM(1)", "\t=1+1", "\r=1+1"] |
| LOS-003-ANDROID | Android instrumentation required | N/A | BLOCKED | Real Activity/Keystore eviction and biometric prompt must run on isolated Android hardware/emulator; Node simulation is not device validation. |

## Passing controls and legacy baseline

CONTROL-INTEGRATION passes20 counted helper checks and direct rejection assertions. It exercises actual production activation and migration rather than stubbing encryptedStorageRuntime. Nonempty data in all11 tables comes from real services and validates through actual validateBackupTables. Real raw restore roundtrip passed; encrypted export returns the same logical relationships. Duplicate add in the second table causes real Dexie rollback with identical ciphertext snapshot afterward. Invalid backup rejection also preserves tables, and wrong-record AAD cannot decrypt.
New mandatory encrypted suites pass: facade16/16, migration45 checks, coordinator10 checks, crypto-session7/7. Their simplified mocks remain classified; the new LOS-002 case exposes the historical helper-return mock mismatch without fixing production. Final harness self-tests121 checks, including four real dependency failure subprocesses and proof timer functions are not substituted for UI setters.
All18 original test entry points passed unchanged. Sentinel6/6 passes on Node, including static/legacy/simulated coverage; it is not a Java/Keystore/SAF device pass. npm test and test:all were run separately as requested; no individual suite duplicated inside one command execution chain. TypeScript and Vite pass with exact production sources from main. No new assertion weakening or source code change.

## Result interpretation / limits

KNOWN_DEFECT means the final acceptance assertion failed on a specifically enumerated scenario after its setup controls passed; it is not a successful production acceptance test. Strict mode leaves those same desired-behavior assertions intact and exits1. The separate LOS-003-ANDROID case is BLOCKED. HARNESS_FAILURE/UNEXPECTED_PASS counts are0. An unexpected error in future can originate in test infrastructure or production and requires triage; it is never silently accepted as a known failure.
LOS-003 deliberately activates the real encrypted runtime in a fixture to isolate the prospective resume contract from LOS-001 (main does not activate it in normal startup). The actual App callback then runs after simulated native key eviction. This does not claim that the original dirty candidate or Java onStop was run. Native biometric prompt, actual lifecycle timing, recovery/invalidation, OS pending/delivered alarm behavior and WebView storage durability remain Android instrumentation required.
LOS-001/009/010 execute AST-extracted actual handlers but not React render/effect/event binding or browser/SAF plumbing. LOS-009 tests reset; replacement-import alarm reconciliation remains follow-up coverage. LOS-002 valid restore is rejected before commit, so consent/valid-import injected-failure tests remain downstream WP2 acceptance work; coordinator rollback control already executes actual commit failure independently. No spreadsheet formula evaluated, malicious payload launched or personal data read.
Final full requested verification used an independent dependency copy; target-only AST-setter hardening then reran npm test, observations and strict mode. No need to rerun unchanged Sentinel/build/type config after the test-only guard. Complete chronological results and prior logs retained.
