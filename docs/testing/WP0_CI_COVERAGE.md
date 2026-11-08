# WP0 CI execution coverage

WP0 only; source base `d7882d29d68fa45ac026c1da490b80aa910cd0a0`, branch `test/wp0-production-regressions-20261106`, isolated worktree `/data/data/com.termux/files/home/lifeos-wp0`. HEAD remains at the base commit: changes are **uncommitted**; no implementation SHA exists. Original branch remains `fix/gemini-vapt-remediation-20261105` at `93f882f317e76998963582d547efa7deb438ad03`. Audit source: `/data/data/com.termux/files/home/lifeos-audit-reports/20261106T111738Z`. Execution on Termux/aarch64, Node24.17.0/npm11.17.0; CI Node20 is configured but not executed remotely. No WP1–WP6 production fixes.

## Mandatory chain

`package.json:scripts.test` preserves the18 original root Node entry points, then calls `npm run test:encrypted` and `npm run test:wp0`. `test:encrypted` executes the following once per default command through `scripts/run-encrypted-tests.cjs`:

| Suite | Required completion floor | Failure policy |
|---|---:|---|
| test_encrypted_storage_facade.js |16 passing cases and0 failed | Nonzero exit, missing summary or partial/zero count fails |
| test_encrypted_storage_migration.js |45 passing checks | Same |
| test_encrypted_transaction_coordinator.js |10 passing checks | Same |
| test_crypto_session_coordinator.js |7/7 passing tests | Same |

All4 scripts require real dependencies and production code before assertions. Existing helper mocks remain explicitly classified. `tests/wp0/harness-selftest.cjs` actually launches each suite with one required package made unavailable by a test-only child Module loader; all4 must exit nonzero with the injected error. It also checks zero/partial completion rejection, non-suppression of exceptions, unexpected-pass failure and inventory completeness. No package was removed or installed for fault injection.

`test:wp0` runs harness self-tests plus CONTROL-INTEGRATION. This control exercises actual raw restore, actual encrypted activation and logical export, real multi-table rollback on duplicate primary key, invalid-backup unchanged state and AAD mismatch rejection. Native operations are simulated; production TS modules are real.

`test:all` remains `npm test && npm run test:sentinel`. Existing workflow Automated checks calls npm test once and Sentinel once; none of the4 encrypted suites are separately duplicated in YAML. Running npm test and test:all separately for this mission repeats them intentionally across requested verification commands, not within one pipeline execution. Fault-injection subprocesses stop at missing imports, rather than rerunning full suites.

## Explicit known-defect observations

Workflow `.github/workflows/build-apk.yml` adds `Observe known production defects (not release acceptance)` after npm test, invoking `npm run test:regressions -- --json test-results/wp0-known-defects.json`. It uploads the JSON in an `if: always()` artifact step,30-day retention. `test-results/` was already ignored. There is no catch-all continue-on-error or shell suppression.

The command returns zero only when every configured acceptance case is either a documented KNOWN_DEFECT or PASS where allowed, and the separate device case remains explicitly BLOCKED. A KNOWN_DEFECT is permitted only for a tagged final acceptance mismatch on one of the seven listed findings. Any other exception, missing dependency, failed setup assertion, malformed/empty worker result, timeout or extraction drift is HARNESS_FAILURE and exits nonzero. A known case that starts passing is UNEXPECTED_PASS and also fails, forcing promotion into mandatory acceptance rather than silently accepting a stale allowlist.

Strict mode `npm run test:regressions:strict` executes unchanged acceptance assertions and returns nonzero for known defects or BLOCKED device validation. The observation mode is non-blocking for those known production defects, so it does not make existing mandatory CI permanently red. Its zero exit is NOT a release pass. Seven defect details and Android BLOCKED status are visible in logs/artifact; future fixes must retire the allowance and keep their assertions in a mandatory suite. Source Git SHA plus production content hashes identify every report.

## Scope and verification limits

Only test/script/documentation and test-workflow changes. No production source, Android config, dependency versions or package-lock edits. No remote push/workflow execution; YAML parsed read-only using existing PyYAML; removing the two added steps yields exactly the baseline workflow structure. Initial optional Node yaml parser was unavailable; no dependency installed. Node execution path tested locally. The local test/** branch is outside current push filters; future authorized PRs targeting main/develop/testing or workflow_dispatch can run checks. Existing workflow's mutable Action tags/signing/SDK concerns remain WP5. Independent node_modules copy in isolated worktree used for final checks; no fresh npm ci or global install. Native instrumentation deliberately remains blocked.
