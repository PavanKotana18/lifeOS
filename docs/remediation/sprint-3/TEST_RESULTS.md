# Verification evidence

Base PR #14 `5848a0eb4c887d5c9479208ae282d8a72a228268`. Code / acceptance checkpoint `cd503d8033b40b9ee6957bf876e8bb18d1b8f5f9`; final reports-only commit is the PR head. Stacked target `integration/lifeos-local-consolidation-20261106`. No merge or release.

Inspected package/build/test scripts before execution. No local dependency/toolchain installs. Existing dependencies copied independently into the isolated worktree; synthetic fixtures/disposable IndexedDB only. Exact final code SHA is above; full logs are external under `~/lifeos-remediation-reports/sprint-3/`.

| Phase | Command | Exit / expected |
|---|---|---|
| npm-test | `npm test` | 0 / 0 |
| sentinel | `npm run test:sentinel` | 0 / 0 |
| test-all | `npm run test:all` | 0 / 0 |
| typecheck | `npx --no-install tsc --noEmit` | 0 / 0 |
| build | `npm run build` | 1 / 0 |
| mandatory | `node scripts/run-wp0-regressions.cjs --controls --json <external-evidence>/mandatory.json` | 0 / 0 |
| known | `npm run test:regressions -- --json <external-evidence>/known.json` | 0 / 0 |
| strict | `npm run test:regressions:strict` | 1 / 1 |
| diff-check | `git diff --check` | 0 / 0 |
| final-typecheck | `npx --no-install tsc --noEmit` | 0 / 0 |
| final-build | `npm run build` | 0 / 0 |
| final-focused | `node test_sprint3_acceptance.js` | 0 / 0 |
| final-controls | `node scripts/run-wp0-regressions.cjs --controls --json <external-evidence>/mandatory.json` | 0 / 0 |
| final-diff | `git diff --check` | 0 / 0 |
| final-test-all | `npm run test:all` | 0 / 0 |
| checkpoint-typecheck | `npx --no-install tsc --noEmit` | 0 / 0 |
| checkpoint-build | `npm run build` | 0 / 0 |
| checkpoint-controls | `node scripts/run-wp0-regressions.cjs --controls --json <external-evidence>/mandatory.json` | 0 / 0 |
| checkpoint-known | `node scripts/run-wp0-regressions.cjs --json <external-evidence>/known.json` | 0 / 0 |
| native-runner-syntax | `sh -n scripts/run-android-acceptance.sh` | 0 / 0 |
| native-runner-blocked | `sh scripts/run-android-acceptance.sh` | 2 / 2 |
| checkpoint-diff | `git diff --check` | 0 / 0 |

The initial build failed: extensionless CSV import resolved historical `csvExportService.js`, which lacks the new export. Fixed by importing `.ts` explicitly. Final build, focused/mandatory cases, typecheck and complete `test:all` pass after that correction. An early focused fixture also failed because it attempted to mutate the storage Proxy while locked; replaced with an explicitly delayed adapter that calls the actual unlocked production service. Assertions were retained. No failed check is presented as a pass.

Final acceptance:11 mandatory WP0 cases pass, including real handler CSV and reset; four new focused cases pass; all existing suites including the four encrypted suites,13 Sprint 1 service checks, five consolidation cases and Sentinel pass. Harness selftest134 checks. Only LOS-001 remains KNOWN_DEFECT; LOS-003-ANDROID remains BLOCKED. Strict observations intentionally exit1. Wrong passphrase/malformed backup/legacy conversion and transactional restore failure preserve existing synthetic data in existing mandatory/service tests.

`adb devices -l` found no target. Native runner safely returns2 (BLOCKED) without required explicit emulator/APK inputs; no install or device test ran. Native source/test-APK compilation is not instrumentation execution. GitHub job evidence is recorded separately in PR delivery / compact evidence when complete. Local Android build blocked by absent Gradle/SDK; JDK and adb presence alone are insufficient.
