# WP0 test inventory

WP0 only; source base `d7882d29d68fa45ac026c1da490b80aa910cd0a0`, branch `test/wp0-production-regressions-20261106`, isolated worktree `/data/data/com.termux/files/home/lifeos-wp0`. HEAD remains at the base commit: changes are **uncommitted**; no implementation SHA exists. Original branch remains `fix/gemini-vapt-remediation-20261105` at `93f882f317e76998963582d547efa7deb438ad03`. Audit source: `/data/data/com.termux/files/home/lifeos-audit-reports/20261106T111738Z`. Execution on Termux/aarch64, Node24.17.0/npm11.17.0; CI Node20 is configured but not executed remotely. No WP1–WP6 production fixes.

Categories are explicit per file/case, not claims that every assertion in a mixed suite has the strongest category. The machine-readable inventory is `tests/wp0/test-inventory.json`; mandatory harness self-tests reject missing/unclassified root test files.

| Test source | Category | Limits |
|---|---|---|
| `sentinel/database/database_integrity_tests.js` | Production integration | Actual production Dexie database in fake-indexeddb; no Android WebView. |
| `sentinel/resilience/android_resilience_tests.js` | Mocked native simulation; Unit | Test-side lifecycle bridge and legacy CJS disk-backup fixtures, not App/Java lifecycle. |
| `sentinel/security/crypto_regression_tests.js` | Unit | Legacy CJS crypto/storage fixtures, not shipped Android Keystore path. |
| `sentinel/security/saf_regression_tests.js` | Mocked native simulation; Static/source inspection | Bridge substitute and Java string checks; physical picker BLOCKED. |
| `sentinel/security/security_tests.js` | Unit; Static/source inspection | Legacy cryptoService.js plus manifest/source checks, not native CryptoService.ts. |
| `sentinel/ui/e2e_journeys.py` | Production integration | NOT RUN; browser/device fixture writes/reset; never target personal profile. |
| `sentinel/ui/ui_automation_runner.py` | Production integration | NOT RUN; external browser/device required, must use isolated fixture profile. |
| `sentinel/unit_integration/domain_tests.js` | Unit | src_core_logic.js and CJS CSV helper; App CSV export differs. |
| `sentinel/visual/visual_regression.py` | Production integration | NOT RUN; stored images are not a current test pass. |
| `test_audit_regressions.js` | Static/source inspection | Text assertions and/or test-side simulations; not Java/React runtime coverage. |
| `test_auth_lifecycle.js` | Static/source inspection | Text assertions and/or test-side simulations; not Java/React runtime coverage. |
| `test_backup_export_service.js` | Mocked native simulation | Production TS bridge/coordinator with substitutes; not Keystore/biometric execution. |
| `test_backup_indexeddb.js` | Production integration | Actual selected production functions/Dexie; native crypto may be mocked, no real WebView durability. |
| `test_backup_validation.js` | Production integration | Actual selected production functions/Dexie; native crypto may be mocked, no real WebView durability. |
| `test_crypto_key_state_api.js` | Static/source inspection | Text assertions and/or test-side simulations; not Java/React runtime coverage. |
| `test_crypto_native_source.js` | Static/source inspection | Text assertions and/or test-side simulations; not Java/React runtime coverage. |
| `test_crypto_service.js` | Mocked native simulation | Production TS bridge/coordinator with substitutes; not Keystore/biometric execution. |
| `test_crypto_session_coordinator.js` | Mocked native simulation | Production TS bridge/coordinator with substitutes; not Keystore/biometric execution. |
| `test_db_atomicity.js` | Production integration | Actual selected production functions/Dexie; native crypto may be mocked, no real WebView durability. |
| `test_encrypted_dexie_store.js` | Production integration | Actual selected production functions/Dexie; native crypto may be mocked, no real WebView durability. |
| `test_encrypted_record_codec.js` | Unit | Some unit fixtures duplicate or mock business/data logic; no device assurance. |
| `test_encrypted_storage_facade.js` | Unit | Some unit fixtures duplicate or mock business/data logic; no device assurance. |
| `test_encrypted_storage_migration.js` | Production integration | Actual selected production functions/Dexie; native crypto may be mocked, no real WebView durability. |
| `test_encrypted_transaction_coordinator.js` | Production integration | Actual selected production functions/Dexie; native crypto may be mocked, no real WebView durability. |
| `test_goal_status_ui.js` | Static/source inspection | Text assertions and/or test-side simulations; not Java/React runtime coverage. |
| `test_habit_analytics_wiring.js` | Unit; Static/source inspection | Executes production domainUtils with esbuild; UI wiring portions inspect text. |
| `test_lifeos.js` | Unit | Some unit fixtures duplicate or mock business/data logic; no device assurance. |
| `test_offline_resilience.js` | Static/source inspection | Text assertions and/or test-side simulations; not Java/React runtime coverage. |
| `test_session_manager.js` | Unit | Some unit fixtures duplicate or mock business/data logic; no device assurance. |
| `test_tasks_recurrence.js` | Production integration | Actual selected production functions/Dexie; native crypto may be mocked, no real WebView durability. |
| `test_tasks_recurrence_edges.js` | Production integration | Actual selected production functions/Dexie; native crypto may be mocked, no real WebView durability. |
| `tests/wp0/harness-selftest.cjs` | Unit | Result-policy/completion checks and actual child missing-dependency injection. |
| `tests/wp0/production-cases.cjs` | Production integration; Mocked native simulation | Real modules and AST-extracted handlers, no mounted React/Java; cases separately identified by finding. |

## New production scenarios

| Finding / case | Executed production boundary | Substituted boundary / classification |
|---|---|---|
| CONTROL-INTEGRATION | Actual validator, StorageService, activation, migration, encrypted facade/codec/coordinator, Dexie roundtrip/rollback and AAD tamper rejection | Disposable fake-indexeddb; simulated native Node AES-GCM |
| LOS-001 | Exact AST-selected initApp, actual storage write/raw inspection | Browser theme/setters/availability; not mounted React |
| LOS-002 | Actual11-table services export, actual validator, activated import contract and unchanged-state check | Native crypto bridge only simulated; validator never stubbed |
| LOS-003 | Actual registered appStateChange callback, real session leases/reload/decryption | Native onStop key eviction simulated; actual Java/Activity remains Android instrumentation required |
| LOS-007 | Same raw and activated-encrypted goal/milestone mutations including pause/reopen/ineligible completion | Fixed process clock; native crypto simulated |
| LOS-008 | Same raw and encrypted Daily/Weekly/Monthly overdue completion, linked next IDs/idempotency | Fixed local date2026-11-06, Asia/Kolkata; native crypto simulated |
| LOS-009 | Exact reset button handler, actual DB clear/reload and notification scheduling | Native pending-store/permissions and window.confirm simulated |
| LOS-010 | Exact CSV button handler, captured export payload; leading=,+,-,@,tab,CR; literal comma/quote/newline control | File export/browser substituted; no formula or spreadsheet executed |
| LOS-003-ANDROID | None executed | Android instrumentation required; explicitly BLOCKED |

## Integrity of test inputs

The helper compiles production modules from this checkout and resolves real relative TS dependencies with a per-worker module cache. Only native package interfaces are overridden. AST handlers execute original source expressions; source selectors must find exactly one node and syntactic/transpile diagnostics must be clear. Setters and DOM helpers substitute UI effects only. No test copies dirty App into the worktree. No real database, browser storage or Android credentials are accessed.
The four older encrypted suites retain simplified mocks and are now mandatory: facade16 tests, migration45 checks, coordinator10 checks, crypto-session7 tests. They are not falsely reclassified as complete native/backup integration. Missing dependencies are fatal, not skips. New real-runtime contracts expose what those mocks miss.
Node simulation does not prove Java threading, native authentication, power-loss durability, React effect/DOM mounting, OS alarm delivery or screenshot/lockscreen privacy. Those limits remain in the Android plan. Existing Sentinel legacy CJS crypto tests do not exercise native cryptoService.ts. No coverage percentage claimed.
