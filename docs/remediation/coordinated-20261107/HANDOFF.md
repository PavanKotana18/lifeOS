# Coordinated implementation checkpoint

Base: PR #22, `7650f5ead7d0aa4e0e108eec78faecac4bcd708e`. Three agents implemented independently and concurrently in separate worktrees. Only completed commits were merged into the new integration branch; existing drafts and original worktrees were preserved.

## Workstream ownership and integrated commits

| Track | Branch / worktree suffix | Commit | Scope |
|---|---|---|---|
| Security | `ws/security-functional-20261107` / `lifeos-ws-security-20261107` | `328a9e960ee487551e1f4d169a9c027f6c6af7dc` | App startup, secure setup/recovery UI, storage/session/migration services and security fixture reconciliation |
| Android | `ws/android-quality-20261107` / `lifeos-ws-android-20261107` | `35f7fbaaec1fe367f40362d051a537cbacc10d2a` | Native compatibility/lifecycle, theme startup, instrumentation and startup regressions |
| Product | `ws/product-quality-20261107` / `lifeos-ws-product-20261107` | `f5e1e83decb77228599f6616bee54c41d8d65e4a` | Finance category aggregation and custom unit conversion regressions |
| Integration | `integration/lifeos-functional-security-20261107` / `lifeos-ws-integration-20261107` | See PR head | Package/CI wiring, final reviews, stale-read regression, reports |

All worktrees are under `/data/data/com.termux/files/home/`. There are no separate implementation PRs; one consolidated draft targets PR #22.

## Shared contracts

- Private facade access requires active encrypted storage and a current authenticated operation lease. Five bootstrap preferences remain readable without private storage. No plaintext fallback, including unsupported native/browser environments.
- The native key state and durable ciphertext determine setup versus recovery. Missing/inconsistent keys or orphan aliases never authorize replacement-key provisioning.
- Initial setup requires foreground consent, genuine native biometric setup, complete recovery-kit safekeeping and code reentry before migration. Recovery secrets are held only in the mounted dialog/native pending state. Backgrounding cancels pending UI and key access.
- Initial recovery kit uses foreground manual safekeeping; Android SAF export during this step is deliberately unavailable because opening a picker evicts pending native state. User must preserve the complete kit, not only its code. A reviewed authenticated export/resume flow is future work.
- Native encryption and decrypt verification run outside IndexedDB transactions. Legacy compare-and-replace runs inside one transaction; interruption retains verified ciphertext or the original row, retry verifies existing ciphertext. This does not make Keystore provisioning and IndexedDB globally atomic.
- Activation and final unlock recheck epoch/generation after native awaits. A background lock cannot be reversed by stale completion or return delayed private plaintext.
- Native and App updates retain `FLAG_SECURE`, registration of `SystemAppearance`, deterministic finance date-time sorting and notification onboarding reconciliation.

## Functional changes

Security: protected startup now provisions explicitly or unlocks an existing key, resumes recovery setup without replacement, migrates before hydration and reopens the encrypted target after restart. Recovery success returns through protected startup. A parallel review reproduced a final-native-await race; a gated regression now verifies stale success is rejected. Legacy raw-algorithm fixtures use explicit test-only raw exports, while mandatory production facade/IndexedDB tests exercise real encrypted activation. No production test bypass was added.

Product: categories such as `__proto__`, `constructor` and `toString` retain accurate chart/budget totals. Custom goal units cannot resolve inherited JavaScript properties into invalid conversions. Three production-function tests failed before these fixes and pass after them. App's matching summary accumulator uses a null-prototype map too.

Android: appearance bridge/preference waits are bounded and optional cache failures cannot prevent rendering. The build declares Chromium 87; older/unknown engines display native update guidance instead of a silent blank screen. This is a compatibility failure state, not full-app acceptance. Strict React-root/persistence tests still fail on unsupported engines. Native test assertions are marshalled off the UI thread, and phase/runtime metadata is captured for diagnosis. Prior API34 process-crash cause was not established from the available artifacts; a code fix is not proof of runtime acceptance.

## Verification design

`npm run test:all` now includes the new admission, secure startup, appearance, product and simulated ADB-runner contracts once each. The inventory distinguishes real production JS/Dexie paths from mocked native boundaries. Additional integration coverage verifies a delayed decrypted result cannot escape after session revocation.

One coordinated workflow compiles reusable debug and instrumentation APKs after Node/TypeScript/Vite validation, runs the full synthetic native crypto class on a fresh API24 AVD, then runs a sequential API24/34/35 matrix. The matrix requires successful rendered-application/persistence acceptance; an update-message test or skipped case cannot substitute for it. No redundant API34 smoke job is included.

The runner refuses physical devices/existing LifeOS installations. Bounded WebView/provider, phase logcat and failure screenshot capture occurs before emulator shutdown, only after verifying a fresh QA emulator. Post-action metadata does not overwrite live evidence. ADB contracts are simulations and are labelled accordingly. JUnit rejects missing/partial counts, abnormal termination, runner crashes and absent required passing cases. APK/JUnit evidence is retained seven days. Current run links and actual per-profile counts are recorded in the draft PR description.

## Release gates and remaining acceptance

| Gate | Assessment / next requirement |
|---|---|
| LOS-001 production JS wiring | Implemented with synthetic native AES-GCM + actual App/Dexie regressions. Do not declare end-to-end PASS without genuine provisioning/restart/at-rest device evidence. |
| Biometric + recovery | BLOCKED: actual strong enrollment, cancel, lockout, invalidation, durable rebind and complete recovery-kit handling on a disposable profile remain required. |
| Migration/data integrity | Production transaction/verification/retry tests required to pass in Node; real storage-quota/process-kill/native interruption acceptance remains required. |
| Android7/factory WebView | Unsupported engines show an explicit native update state. Full app is BLOCKED until a compatible WebView is present; Android API alone is not evidence of runtime compatibility. |
| Android14 recreation | Instrumentation now reports assertions/phase evidence; actual integrated CI result must determine acceptance. |
| Notifications | Production permission-return/planning/reset regressions retained; actual delivery, exact alarms and reboot still require native acceptance. Queue removal is not delivery proof. |
| Finance/habits/planner/goals | Existing production/domain regressions retained plus label/unit fixes. No complete mounted workflow or manufacturer-specific coverage claimed. |
| Theme/UI | Bounded cold-start regressions and native compatibility tests added; physical appearance/accessibility acceptance remains required. |
| Offline | Synthetic persistence/recreation automation exists; airplane mode and process-death encrypted persistence still need acceptance. |
| Privacy | No credentials, personal records or real recovery material used. Plaintext upgrades retire rows only after verified encrypted copies; device logs/caches/export/privacy checks remain required. |
| Build | Debug artifacts only. No signing change, release upload or merge. |
| Release readiness | BLOCKED until critical native/storage acceptance above passes. |

## Next batch

1. Complete genuine biometric setup/confirmation, restart, key invalidation/recovery/rebind and encrypted at-rest inspection using a dedicated synthetic Android profile. Preserve failures as blockers.
2. Implement an authenticated recovery-kit export/resume protocol before offering SAF during initial provisioning. Never retain plaintext secrets or disable key eviction to make it convenient.
3. Use integrated provider/phase evidence to diagnose any remaining Android14 recreation failure and validate updated WebView on Android7. Retest only affected profiles after demonstrated fixes.
4. Automate OS notification delivery/permission/boot and SAF encrypted restore cancellation/rollback acceptance; perform physical accessibility and manufacturer checks separately.
