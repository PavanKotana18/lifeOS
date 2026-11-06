# Sprint 1 test results

Branch `fix/lifeos-security-data-sprint1-20261106`. Parent / published WP0 commit `370a445f19c843abe42b7d6450d4d521bbb07824`; audited main `d7882d29d68fa45ac026c1da490b80aa910cd0a0`. Tests ran on the uncommitted sprint patch; `evidence/source-sha256.json` identifies exact reviewed bytes. The final source commit is the PR head. No merge or release is performed.

Local Termux/aarch64, Node24.17.0/npm11.17.0. Existing installed dependencies independently copied; no npm install/global toolchain change. Scripts inspected first. Full logs remain in `~/lifeos-remediation-reports/sprint-1/`; compact execution metadata accompanies this report. CI uses Node20 and must be checked separately.

| Phase | Command | Exit / expected |
|---|---|---|
| `npm-test` | `npm test` | 0 / 0 |
| `sentinel` | `npm run test:sentinel` | 0 / 0 |
| `test-all` | `npm run test:all` | 0 / 0 |
| `typecheck` | `npx tsc --noEmit` | 0 / 0 |
| `build` | `npm run build` | 0 / 0 |
| `mandatory` | `node scripts/run-wp0-regressions.cjs --controls --json <external-logs>/mandatory.json` | 0 / 0 |
| `known` | `npm run test:regressions -- --json <external-logs>/known.json` | 0 / 0 |
| `strict` | `npm run test:regressions:strict` | 1 / 1 |
| `final-mandatory` | `node scripts/run-wp0-regressions.cjs --controls --json <external-logs>/mandatory.json` | 0 / 0 |
| `final-known` | `node scripts/run-wp0-regressions.cjs --json <external-logs>/known.json` | 0 / 0 |
| `final-typecheck` | `npx tsc --noEmit` | 0 / 0 |
| `final-build` | `npm run build` | 0 / 0 |
| `final-test-all` | `npm run test:all` | 0 / 0 |
| `final-controls` | `node scripts/run-wp0-regressions.cjs --controls --json <external-logs>/mandatory.json` | 0 / 0 |
| `final-observations` | `node scripts/run-wp0-regressions.cjs --json <external-logs>/known.json` | 0 / 0 |
| `final-ts` | `npx tsc --noEmit` | 0 / 0 |
| `final-web` | `npm run build` | 0 / 0 |

Final `test:all` runs npm test then Sentinel6/6. Four formerly omitted suites remain mandatory16/45/10/7. WP0 policy/inventory/dependency fault-injection tests124 checks;9 mandatory production scenarios pass (see evidence). The new13 focused service tests include one explicitly static Java/config check; other native interfaces are simulated. No mounted React or device pass claimed.

Original expected LOS-002/003/007/008 contracts are preserved and promoted into mandatory selection. New cases cover actual restore failure rollback, recovery service+TS wrapper+GCM proof simulation, App import race and legacy conversion. Actual new recovery UI rendering/file/biometric flow remains unexecuted; tests exercise services and selected App handlers.

Strict observation exit1 is expected from3 unresolved findings and1 blocked Android requirement, not a suppressed harness error. Default observations report KNOWN_DEFECT/BLOCKED explicitly. Earlier checkpoint and final focused reruns are recorded separately; final App auth-state reset and live replacement guard were rechecked by controls/TypeScript/build, with final test:all after the replacement guard.
