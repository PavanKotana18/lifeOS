# WP0 handoff — ready for review, stop before WP1/WP2

WP0 only; source base `d7882d29d68fa45ac026c1da490b80aa910cd0a0`, branch `test/wp0-production-regressions-20261106`, isolated worktree `/data/data/com.termux/files/home/lifeos-wp0`. HEAD remains at the base commit: changes are **uncommitted**; no implementation SHA exists. Original branch remains `fix/gemini-vapt-remediation-20261105` at `93f882f317e76998963582d547efa7deb438ad03`. Audit source: `/data/data/com.termux/files/home/lifeos-audit-reports/20261106T111738Z`. Execution on Termux/aarch64, Node24.17.0/npm11.17.0; CI Node20 is configured but not executed remotely. No WP1–WP6 production fixes.

## Review location / commands

Worktree `/data/data/com.termux/files/home/lifeos-wp0`; original repository `/data/data/com.termux/files/home/lifeOS` must remain untouched. Branch `test/wp0-production-regressions-20261106`; no commits created or pushed, no PR. Reports/logs `/data/data/com.termux/files/home/lifeos-remediation-reports/wp0`. Review `git -C /data/data/com.termux/files/home/lifeos-wp0 status --short`, diff package.json/workflow and the new scripts/tests/docs. `git diff` alone omits untracked new files; use WP0_CHANGED_FILES.md and file-manifest.json as review inventory. Do not assume tests exist in the original checkout.

Reproduce from isolated worktree:

```sh
npm test
npm run test:sentinel
npm run test:all
npx tsc --noEmit
npm run build
npm run test:regressions -- --json test-results/wp0-known-defects.json
npm run test:regressions:strict
```

The final command is expected to exit1 for unresolved acceptance defects/device BLOCKED status. Default observation exit0 means expected defects were observed, not fixed. Never use the private --worker mode as a release gate. Use an independent installed dependency tree or fresh reviewed npm ci in an authorized environment, and disposable TMPDIR for Sentinel. No global installation needed for current Termux checks. Node20 remote CI compatibility is unexecuted; local Node24 verification passed.

## Production issues now guarded

| ID | Evidence from new tests | Next implementation package |
|---|---|---|
| LOS-001 | Actual App init + StorageService writes raw private fields | WP3 activation after WP1/WP2 acceptance; do not wire early |
| LOS-002 | Actual valid11-table backup rejected by actual facade using actual validator | WP2 validator result contract; then valid-import consent/rollback/relationships |
| LOS-003 | Actual App resume callback leaves simulated native key unavailable despite real encrypted backend | WP1 native lifecycle; actual Android Activity/Keystore verification still BLOCKED |
| LOS-007 | Raw goal completion eligibility differs from encrypted backend, including milestone/paused cases | WP2 shared transactional goal transitions |
| LOS-008 | Daily/Weekly/Monthly encrypted next dates stay in2020 instead of after fixed2026 local today | WP2 actual recurrence helper/adapter parity |
| LOS-009 | Actual reset clears DB but simulated OS retains habit/milestone alarms; unrelated preserved | WP4 full managed notification reconciliation; replacement-import/device follow-up |
| LOS-010 | Actual CSV button preserves6 formula-leading payloads while literal quoting works | WP4 production CSV integration |

## WP1 preparation (not authorized here)

Read native thread/lifecycle/recovery findings and WP0_ANDROID_TEST_PLAN. Preserve current original dirty openProtectedSession work; inspect it against main/candidate, never overwrite or blindly copy. Tests here are based on freshly verified main, so candidate-only Java/App changes are not validated by these passes. Implement actual bridge/Activity instrumentation in a disposable build environment as planned; inspect cancellation/deferred-main-thread/stale-generation states. Do not weaken biometric checks or replace missing-key states with automatic new-key generation. Actual invalidation/recovery is missing UX and outside WP0.

The LOS-003 simulation intentionally forces encrypted activation so resume can be tested independently from main's unwired startup. Node AES-GCM is an interface substitute, not Keystore evidence. Keep the separate real Android case BLOCKED until evidence exists.

## WP2 preparation (not authorized here)

Start with LOS-002 contract: actual validateBackupTables throws on bad input and returns table names for valid input, not error strings. Keep actual helper wiring in tests. Once valid encrypted import is reachable, add consent replacement, injected mid-commit restore failure rollback, nonempty relationships and legacy-main upgrade validation. Existing coordinator rollback/AAD controls must remain green. Unify raw/encrypted goal/recurrence semantics; do not change expectations to preserve known defects. Verify quota/process-death durability on Android; fake-indexeddb cannot establish it.

## Promoting a fix / CI policy

A case marked known=true must produce KNOWN_DEFECT only for its final desired-behavior mismatch. Fixing it yields UNEXPECTED_PASS (nonzero), intentionally requiring review. Set its known flag false, add it to mandatory --controls selection in run-wp0-regressions.cjs (or a dedicated mandatory acceptance list), remove it from the known observation list, and retain the original correct expectation. Update docs/inventory and run mandatory tests plus strict observations for remaining cases. Do not remove the separate Android requirement merely because Node passes. New extraction errors from refactoring are HARNESS_FAILURE and require migrating the test to the actual new production controller, never copying old App behavior into tests.

Four older encrypted suites now execute by default with dependency/completion guards. They still contain simplified mocks; do not use their16/45/10/7 passes to retire LOS-002/007/008 without the actual-runtime test. Sentinel legacy CJS tests remain labelled; no production crypto path was replaced in WP0.

## Preservation and remaining limits

Original baseline matches audit exactly, no intervening changes found. Original branch/HEAD and141tracked hashes/status/untracked paths match after work; backup directory untouched. New local worktree/branch metadata is the only authorized original Git metadata addition. No production source/config/dependencies/lock changes; no commit/push/PR/merge. Initial shared dependency runs retained separately; final runs use independent copy to keep build writes isolated.

No actual native build, fresh install reproducibility, Android instrumentation, mounted React UI, OS alarm delivery/permission transitions, browser/SAF file behavior, recovery/invalidation or personal data tests. Exact setup and acceptance requirements are in Android plan. All requested local supported checks pass;7 desired-behavior defects remain,1 real-device check blocked,0 harness failures. This completes WP0 infrastructure, not release remediation. Wait for user review/authorization before any production fix or commit.
