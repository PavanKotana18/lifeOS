# Overnight engineering checkpoint

Updated: 2026-11-07

## Current state

- Continuation: PR #23, branch `integration/lifeos-functional-security-20261107`, based on PR #22.
- Starting PR #23 head: `cf0e5cf755aa838a40e1fd0320a50e991f7db4bf`.
- Current package A changes are being checkpointed on this branch; no other worktree was edited.
- Original `~/lifeOS` remains untouched with its existing user changes.

## Completed: Android support alignment

- Raised `minSdkVersion` from 24 to 29 (Android 10).
- Changed this branch's mandatory native recovery preflight and compact full-app acceptance profile to API 29; API 34 and API 35 remain.
- Retained the runtime Chromium 87 compatibility check and unsupported-WebView guidance. Android OS level alone does not guarantee a current WebView.
- Updated Android test inventory, coverage matrix and recovery-fixture comment.
- Compatibility inspection: Capacitor Android 6 and installed Capacitor app/notifications plugins declare min SDK 22; app's biometric and cryptographic dependencies support below API 29. No unguarded app API 30+ calls were found. Emulator validation remains pending.
- Current AGP 8.2.1 / Gradle 8.2.1 / compile SDK 34 cannot compile API 36. Google Play currently requires API 36 for new apps submitted from 2026-08-31; this is an outstanding release blocker requiring a separate deliberate toolchain migration. Target SDK remains 34 and was not lowered or changed.

## Tests actually run

- `npm run test:all`: PASS on serial rerun. Includes full existing Node tests, WP0 harness (148 self-checks and all 11 controls), and 6/6 Sentinel suites. Sentinel reports physical SAF as blocked and does not count it as a pass.
- First test attempt was invalidated by WP0 worker timeout while TypeScript/Vite were run concurrently; serial retry passed.
- `npx --no-install tsc --noEmit`: PASS.
- `npm run build`: PASS (Vite; 2,233 modules).
- Android API 29 APK and instrumentation execution: NOT YET RUN locally (Termux has no Gradle/Android SDK); PR CI will provide this evidence.
- PR #23 previous CI: build/test APK job PASS; API 29 native crypto will be newly exercised after push; previous API 34 and API 35 emulator profiles PASS; API 24 full-app profile FAILED because Chromium 69 < app's Chromium 87 requirement. API 24 is now outside the declared OS support floor.

## Known blockers / next work

1. Wait for the focused updated CI result and API 29/34/35 JUnit counts after this checkpoint. Do not infer emulator acceptance from APK compilation.
2. Work package B: inspect concrete gaps in existing encrypted setup/recovery/migration tests and only implement a reproducible security or recovery fix. LOS-001 remains unverified end-to-end until real encrypted at-rest/device evidence.
3. Existing native strong-biometric, key invalidation/rebind and complete recovery-kit export/resume acceptance remain physical/device blockers. Do not weaken key eviction.
4. Update Google Play target API compliance only with a compatible, validated AGP/Gradle/SDK migration; do not silently change signing or target in this checkpoint.

## Uncommitted work

At this checkpoint, the only intended changes are API 29 support/CI/documentation plus this progress file. Record any later package as a separate commit and update this file afterward.
