# Security release gates

Baseline: PR #20, `5d858ac23b7b6b12c0d473b681ec88769f3dddcc`. Native baseline evidence: https://github.com/PavanKotana18/lifeOS/actions/runs/42279659539 . No physical handset was tested by this session.

## LOS-001: BLOCKED — production persists plaintext

`src/db.ts` initializes `activeStorageTarget` to `rawStorageService`. `src/App.tsx:initApp` does not invoke `activateEncryptedStorage` or `openEncryptedStorageLifecycle`. The WP0 LOS-001 test executes this actual startup function, saves a synthetic transaction, and inspects the raw IndexedDB row. The expected ciphertext contract still fails. Optional biometric UI locking is not encryption at rest. Production records cannot be certified free of sensitive plaintext.

Lifecycle trace:

| Flow | Existing implementation and missing acceptance |
|---|---|
| First install / enrollment | App optional biometric enrollment does not provision the database encryption key. `encryptedStorageLifecycle.ts` can provision and confirm recovery but is not wired to startup or a recovery-code confirmation UI. |
| Unlock / key handling | Protected session controller verifies native key metadata and never replaces a missing alias. Synthetic native tests exercise AES-GCM, lock/key eviction and recovery quarantine. Real strong-biometric prompt acceptance/cancellation is still guarded and skipped in cloud tests. |
| Activation / legacy upgrade | `activateEncryptedStorage` requires native unlock plus confirmed recovery, locks/drains admission, migrates idempotently, verifies native state and switches the storage target. It is not called by the application. Disposable Dexie migration tests do not prove native/WebView upgrade under process termination or quota exhaustion. |
| Restart / process death | Activation flag and target are in memory. Startup blocks existing encrypted records; it does not reconstruct/open the encrypted backend. Automatically calling activation without a resumable provisioning/recovery UI risks stranded data. |
| Background / lock | Existing App/session code closes admission and native key access. Tests cover simulated lifecycle and direct native plugin state; genuine prompt/lifecycle acceptance remains incomplete. |
| Invalidation / recovery | No silent replacement key. Recovery uses a validated envelope, wrong-code rejection, quarantine, record proof and biometric rebind. API 24/34/35 synthetic recovery is verified in baseline CI; invalidation and durable real Keystore rebind are not verified. |
| Backup / restore | Production validator/transactional restore has synthetic Dexie/WebCrypto coverage. Export contracts can produce readable JSON; user-mediated encrypted backup is a separate boundary. Do not claim all exported backups are encrypted. SAF chooser, interrupted native restore/rebind and real upgrade remain unverified. |

No automatic activation was added. This preserves the existing migration and ciphertext-startup protection rather than introducing an unverified switch. The app's current raw startup does **not** satisfy fail-secure encryption requirements. Encryption activation remains release blocking.

Privacy boundaries: theme cache (`lifeos-appearance`) and bootstrap settings are intentionally readable. Raw settings/records are sensitive while LOS-001 remains open. Native wrapped-key preferences are distinct from database records. Source/test inspection is not proof of absence of sensitive values in every runtime log, WebView cache, exported file or OS backup; that forensic verification requires a synthetic fully provisioned installation.

## Release matrix

| Gate | Verdict | Evidence / missing acceptance |
|---|---|---|
| Production encryption | BLOCKED | LOS-001 actual startup persists plaintext; provisioning/restart path missing. |
| Biometric security | BLOCKED | Synthetic race/lock checks pass; interactive strong-biometric test skips explicitly; no genuine enrollment/cancel/rebind result. |
| Data integrity | PASS | Disposable production Dexie/atomicity/migration/restore Node tests; not crash/quota/device acceptance. |
| Backup and recovery | BLOCKED | Native synthetic KDF/proof passes; genuine Keystore rebind and SAF restore incomplete. |
| Notifications | BLOCKED | Node planner/cancel/reset checks pass; current CI does not prove OS delivery, settings return or reboot delivery. User's earlier handset evidence is limited to specific notifications. |
| Offline operation | BLOCKED | Node persistence tests pass; new isolated native WebView IndexedDB recreation test is pending CI; airplane mode/process death not covered. |
| Finance | PASS | Production sorting/storage regression suite; full mounted Android transaction workflow not covered. |
| Theme and UI | BLOCKED | Deterministic startup/preferences Node tests pass; manufacturer cold-launch and visual/override acceptance missing. |
| Android compatibility | PASS | Baseline API 24/34/35 synthetic native tests and launch pass; current added test pending CI. |
| Privacy and permissions | BLOCKED | Plaintext records remain; real permission/reboot/SAF and full runtime data exposure assessment incomplete. |
| Build reproducibility | BLOCKED | Pinned CI builds pass; no Gradle wrapper and no bit-identical artifact reproduction verified. |
| Physical acceptance | NOT TESTED | No physical installation, biometric interaction or personal data used in this session. |

## Required work in order

1. CRITICAL: explicit native provisioning and recovery-code/kit confirmation UX; persist only nonsecret resumable setup state. Do not store the recovery code. No initial key creation when existing state/data is ambiguous.
2. CRITICAL: wire protected startup/restart to encrypted target, with admitted-operation drain and native session generation checks. Test interrupted provisioning/migration, mixed rows, quota failure and retry against disposable fixtures. Verify raw rows contain no sensitive fields.
3. HIGH: genuine biometric setup/cancel/unlock, key invalidation and durable recovery rebind on dedicated disposable hardware/profile. Keep LOS-001 gated until this passes.
4. HIGH: native encrypted backup/restore/SAF interruption and rollback acceptance with synthetic relationships and wrong/corrupt credentials.
5. MEDIUM: notification permission/settings, trigger timestamps, delivered notification evidence, reboot cancellation; cold theme/override and process-death persistence acceptance.

## Device checklist (fresh synthetic installation only)

Record SHA, API, handset, WebView version and observed result per step. Never install over an existing data-bearing installation.

- Enroll strong biometrics; cancel setup/unlock; retry successfully. Expect one prompt owner, no protected record hydration on cancel, genuine authentication before access.
- Background during prompt and DB operation; return; recreate Activity and terminate/relaunch process. Expect stale callbacks rejected, key locked, records preserved, reauthentication required.
- Save recovery kit offline, verify proof, invalidate a synthetic local wrapper only through approved device procedure, recover/rebind with genuine authentication. Wrong code/proof must preserve existing records and stay locked.
- Export/import through SAF; cancel picker, reject wrong passphrase/malformed backup, interrupt restore. Expect unchanged prior data on failure and atomic valid restore.
- Grant/deny notifications and exact alarms; return from settings. Expect onboarding not reset, no duplicate requests, distinct reminder/upcoming/overdue planned timestamps and actual delivery evidence. Pending queue removal alone proves no delivery.
- Launch in system light/dark and explicit overrides, change system mode, resume. Expect correct theme. Create same-day finance entries with different times, edit/restart/delete; expect chronological sorting and preserved legacy unknown time.
- In airplane mode create synthetic records, background/restart and inspect persistence. Inspect raw IndexedDB/native prefs/logs/backup artifacts only in this synthetic profile after encryption is provisioned. Current build is expected to expose plaintext until LOS-001 is fixed.
