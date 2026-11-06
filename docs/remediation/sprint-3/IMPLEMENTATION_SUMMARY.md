# Sprint 3 implementation

Base PR #14 `5848a0eb4c887d5c9479208ae282d8a72a228268`. Code / acceptance checkpoint `cd503d8033b40b9ee6957bf876e8bb18d1b8f5f9`; final reports-only commit is the PR head. Stacked target `integration/lifeos-local-consolidation-20261106`. No merge or release.

Bounded implementation plus executable Android acceptance preparation. LOS-001 remains a release blocker; encryption activation stays gated. No claim of complete device acceptance.

- **LOS-010:** actual App CSV handler imports the production TypeScript quoting function explicitly, avoiding the legacy same-name CJS module. Formula-leading text, whitespace/control prefixes and quotes/newlines are handled; existing CSV service APIs remain intact. Original WP0 expected contract is unchanged and now mandatory.
- **LOS-006:** App create/edit handler owns one in-flight save. After a resolved storage write, the form closes before fallible data/notification refresh; the error states that saving succeeded. Pre-commit errors keep the form available for explicit retry. Four focused cases exercise production functions/handler and disposable IndexedDB.
- **Native tests:** seven synthetic instrumentation cases invoke the real Java plugin: initial locked state, AES-GCM/AAD, stop eviction/generation/quarantine clearing, concurrent native guard, unavailable Activity once-only failure, real recovery KDF/wrong code/proof/quarantine and malformed recovery preserving synthetic memory. They never attach to production storage/preferences/aliases.
- **Opt-in real biometric test:** a separate ActivityScenario class uses the real registered plugin, strong BiometricPrompt and Keystore. Fresh named emulator only, explicit opt-in, genuine accept/cancel actions; actual stop/resume and recreation must leave native memory locked until fresh unlock. No forced biometric success, key extraction/deletion or production test hook.
- Guarded runner refuses unspecified devices, other AVDs, physical devices and existing installed packages. Default seven-test synthetic mode and opt-in one-test biometric mode require complete JUnit completion, not just adb exit0.
- CI compiles debug and AndroidTest APKs and uploads separate artifacts. AndroidX core1.5.0/runner1.5.2/ext-junit1.1.5 are test-only dependencies. No native auth policy, manifest/signing/dependency-lock or encryption rollout change.

No emulator/device was connected. Native tests are implemented but runtime BLOCKED, not passed. Local SDK/Gradle absent; GitHub builds are separate compilation evidence. Original worktrees/branches/indexes/stash remain unchanged; only the dedicated Sprint 3 branch was advanced. No personal data, kits or keys in reports.
