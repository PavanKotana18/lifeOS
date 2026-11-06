# LOS-001 fail-closed checkpoint — BLOCKED, not release ready

Base PR #21: 1943b5daecc3d0ee7e3bb7bd52d42502c1d06fae. No existing worktree or draft branch was changed.

## Implemented

The production storage proxy previously required only an unlocked JavaScript session and selected rawStorageService by default. Optional-biometric startup unlocked that session without invoking encrypted provisioning or migration. Every sensitive namespace (including private settings, backup/export/import/reset and retained method references) now refuses invocation until encryptedStorageActivated is true, and revokes the session. The five existing public bootstrap settings remain accessible. The check is unconditional, including unsupported browser/native environments; there is no raw fallback. Existing plaintext remains on disk but is not exposed through the application facade.

Migration now decrypts and compares each prepared encrypted copy before replacing its legacy row, and authenticates previously encrypted rows on retry. Native operations occur outside IndexedDB transactions. Failed verification retains the original plaintext row. Activation now also rejects recovery quarantine discovered during its final native-state check.

Focused tests execute the actual production storage proxy and migration against disposable IndexedDB, with a synthetic AES-GCM native adapter. They cover inactive access, actual startup rejection, required recovery metadata, preserved legacy rows, corrupt-copy rejection/retry, cancellation and missing aliases. These are not Keystore/biometric device tests.

## Deliberately incomplete and release blocking

This patch does NOT complete Phase 3 provisioning UX or wire automatic activation into production startup. The existing encryptedStorageLifecycle coordinator is not a reviewed resumable end-user provisioning UI. No first-install key is provisioned by this patch. With encryption inactive, existing startup now reports the secure-storage error and stays locked. This intentionally prevents normal application use in this draft checkpoint; it is not a release candidate.

Required continuation: explicit initial biometric provisioning, recovery kit export/confirmation with secrets kept only in memory, recoverable interruption states derived from authoritative native metadata, and protected restart activation. Test background/process termination at every key/metadata/migration boundary before enabling it. Missing/inconsistent aliases must never trigger replacement key creation. Native provisioning and IndexedDB writes are not one atomic operation.

Migration still relies on quiesced application access and the shared repository queue. The latest-row check and write are separate operations; multi-tab/concurrent raw database writers and storage quota/process-death acceptance need further engineering. Existing plaintext upgrades therefore remain BLOCKED for automatic startup rollout despite focused single-context verification. Direct raw Dexie access and a compromised WebView are outside the proxy authorization boundary; this patch does not claim erasure of existing plaintext, logs, caches or exports.

## Validation and compatibility

Local focused admission tests: 6/6. Encrypted suites: passed (facade, migration, transaction coordinator, session coordinator). TypeScript and Vite production build passed. Existing npm test:all FAILS at test_backup_indexeddb: that legacy fixture stubs encryption unavailable but expects raw facade export. It is not a passing regression result. WP0 harness inventory was updated for the new test; mandatory controls currently report 1 PASS and 10 HARNESS_FAILURE because their raw-seeding/legacy access assumptions now hit the closed boundary. These failures are not waived or classified as expected passing results. Other raw-backend fixtures/WP0 assumptions must be migrated to authenticated encrypted fixtures or explicitly tested as legacy internals; do not fake activation or remove the new guard to make them pass.

The dedicated CI workflow runs focused security tests/build/native recovery separately from existing regressions, so legacy fixture failures remain visible without preventing native compilation/acceptance. It runs only the API24 recovery preflight, not another full matrix. Existing PR #21 API24 UI failure and API34 crash remain unrelated open release blockers.

LOS-001 verdict: BLOCKED. The new-write/read exposure through the inactive facade is addressed; secure end-user provisioning, restart activation, validated upgrade and full application regression compatibility are outstanding. No claim of physical-device validation, signing readiness or encryption activation is made.
