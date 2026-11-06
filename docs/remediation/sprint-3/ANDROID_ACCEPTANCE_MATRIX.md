# Android acceptance matrix and runbook

Base PR #14 `5848a0eb4c887d5c9479208ae282d8a72a228268`. Code / acceptance checkpoint `cd503d8033b40b9ee6957bf876e8bb18d1b8f5f9`; final reports-only commit is the PR head. Stacked target `integration/lifeos-local-consolidation-20261106`. No merge or release.

Status applies to this sprint. Node/service evidence is distinct from actual Android execution.

| Boundary | Executable coverage / next action | Current runtime status |
|---|---|---|
| Initial native locked state / AES-GCM | CryptoAcceptanceTest first two tests: actual Java plugin and Android provider | BLOCKED (no device) |
| Initial Keystore provisioning / strong authentication | BiometricDeviceAcceptanceTest explicit setup on fresh AVD; no encrypted DB activation | BLOCKED |
| Lock/unlock, native key after resume | Real test asserts lock after actual onStop, then genuine native unlock | BLOCKED |
| Activity recreation | Real ActivityScenario.recreate, new plugin locked, existing Keystore wrapper unlock | BLOCKED |
| Concurrent authentication | Synthetic native guard + real pending prompt rejected concurrent call | BLOCKED |
| Prompt cancellation | Real opt-in test requires CANCEL; normal/native sessions remain locked | BLOCKED |
| Nonmatching finger, lockout, enrollment change | Manual actual prompt/device checks; test class does not observe hardware failure events | BLOCKED |
| Session invalidation | Synthetic Java stop generation/zeroing + mandatory actual JS session tests; full UI interaction still needed | Node PASS; Android BLOCKED |
| Recovery KDF/wrong code/proof/quarantine | Synthetic instrumentation uses actual recovery KDF and AES-GCM proof API; Node service simulations pass | Node PASS; Android BLOCKED |
| Missing/invalidation alias + durable rebind | Manual controlled synthetic profile / future dedicated fault-injection test | BLOCKED; no destructive alias operation implemented |
| Encrypted backup creation/restore/legacy/wrong password/malformed/rollback | Existing actual WebCrypto/validator/Dexie mandatory/service tests | Node PASS; real WebView/SAF BLOCKED |
| Notification permission/exact alarm/schedule/cancel/reset | Existing actual service/App-handler synthetic OS tests | Node PASS; real OS BLOCKED |
| Restart/reboot alarms and restored backend | Manual dedicated-device test; no emulator reboot performed | BLOCKED |
| CSV file / spreadsheet literal interpretation | Actual handler bytes and production quoting tests pass; inspect saved file and chosen spreadsheet | Node PASS; SAF/spreadsheet BLOCKED |

## Reproducible native execution

1. Use a dedicated Linux Android SDK/JDK17/Gradle8.2.1 environment, Node20, the exact code commit and reviewed lockfile. CI already defines these build steps. Build in a disposable checkout with inspected `npm ci`, `npm run build`, `npx cap sync android`, then `gradle -p android :app:assembleDebug :app:assembleDebugAndroidTest`. Alternatively download **both debug and AndroidTest APKs from the same exact CI run**. Record source SHA, APK SHA256, certificate, API/WebView and artifact/run IDs. Do not mix the signed release APK with debug instrumentation.
2. Create a fresh disposable Android34 AVD named exactly `lifeos-acceptance-sprint3`. Start without any personal snapshot; enroll only test biometrics/device credential for biometric mode. Never install over a personal LifeOS installation. No toolchain/AVD was installed locally by this sprint.
3. Default synthetic-native mode (seven JUnit methods, no real alias or biometric UI):

```sh
LIFEOS_ACCEPTANCE_SERIAL=emulator-5554 \
LIFEOS_APP_APK=/absolute/path/app-debug.apk \
LIFEOS_TEST_APK=/absolute/path/app-debug-androidTest.apk \
sh scripts/run-android-acceptance.sh
```

4. Use another fresh disposable profile for opt-in real biometric mode (one scenario). Same AVD name requirement; existing package installations are intentionally refused. Run the command above with `LIFEOS_NATIVE_MODE=biometric` added. **ACCEPT setup; wait briefly for concurrent-rejection probe, CANCEL first unlock; ACCEPT next direct unlock, resume unlock, and recreation unlock.** Each prompt times out after90s. No forced authentication response is injected by the test. Capture sanitized status only, never credentials or wrapper/kit values. Test retains its synthetic wrapper/alias and locks it afterward; it does not delete or overwrite existing keys. Default mode never runs this interactive scenario.
5. The runner verifies dedicated emulator identity and absence of both packages before installing; no default-device fallback, package-clear, uninstall or key-reset command. A physical-device run requires a separate reviewed dedicated-profile procedure; this helper deliberately refuses phones. Keep `LOS-003-ANDROID` blocked until actual full boundary evidence is reviewed.

## Manual acceptance still required

- **Authentication/failure:** use a dedicated synthetic installation. Compare native/JS locked state before any protected read; background at every pending prompt/IO phase, cancel, present wrong finger, trigger normal lockout, rotate/recreate, restart/process death. Expect no private hydration while native key unavailable, no successful stale callback, one prompt owner and clear retry/recovery state. Full JS/native encrypted-opening acceptance is gated by LOS-001, not proved by direct-plugin tests.
- **Recovery:** establish only synthetic data/kit in a dedicated test environment once approved provisioning exists. Validate wrong/corrupt/wrong-database kit first (no writes/unlock), quarantine/proof before real rebind, durable restart unlock afterward, and interrupted/failed wrapper persistence. Do not erase aliases in a personal app. Fault injection for missing/invalidated aliases and SharedPreferences durability remains unimplemented; do not claim it from mocked Node tests.
- **Backup:** create synthetic related records; save encrypted backup through SAF; export/restore, legacy consent, wrong password, malformed/orphan records and failed/quota-interrupted restore. Compare counts, relationships and synthetic marker hashes before/after without publishing records or backup bytes. Failed restore must preserve prior snapshot. Current JS tests cover contracts; device file picker/quota/process-kill does not.
- **Notifications:** grant/deny display and exact alarms independently, cancel settings return, schedule synthetic task/habit/milestone, edit/delete/reschedule, reset and verify pending known kinds cleared while unrelated entries retained. Restart/reboot, revoke alarms and repeat. Observe actual delivery times without personal content. Cross-system cancellation/DB-commit atomicity and concurrent reset/reschedule remain separate risks.

Record PASS/FAIL/BLOCKED per row with SHA/device/API/WebView and sanitized expected/actual metadata. Compilation alone cannot change any Android row to PASS.
