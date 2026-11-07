# LifeOS Android test infrastructure

## Baseline and failure diagnosis

Infrastructure work is isolated at `qa/lifeos-android-testing-infrastructure-20261106`, based on PR #17 QA head `3d05b3720863f9d029c3fa6dbeb4387ea62e5496`. Track A PR #18 and all earlier worktrees remain separate.

The logs show two independent issues:

- Run [42256209212](https://github.com/PavanKotana18/lifeOS/actions/runs/42256209212) used the Ubuntu 26.04 hosted image. The runner user lacked read/write access to `/dev/kvm`; `android-emulator-runner` explicitly disabled acceleration and warned that x86_64 emulation might not work. The emulator eventually reached the Gradle script, but only after roughly ten minutes of repeated boot polling.
- The same run then failed `:capacitor-android:compileDebugJavaWithJavac` with `Cannot mutate the dependencies of configuration ':capacitor-android:debugCompileClasspath' after the configuration was resolved.` Its log reports Gradle 9.8.2. AGP is 8.2.1, whose documented minimum/default Gradle is 8.2 and JDK is 17 ([Android AGP 8.2 compatibility](https://developer.android.com/build/releases/agp-8-2-0-release-notes)).
- Run [42262630240](https://github.com/PavanKotana18/lifeOS/actions/runs/42262630240) used PR #17 head `3d05b37`, whose workflow pins Gradle 8.2.1, but it was cancelled during the same KVM-disabled boot loop before reaching build or test execution. It produced no test result.

The [Android emulator runner action](https://github.com/ReactiveCircus/android-emulator-runner/blob/main/action.yml) automatically disables Linux acceleration when it cannot access KVM. GitHub documents enabling `/dev/kvm` permissions for hosted Ubuntu runners ([GitHub Actions hardware-accelerated Android virtualization](https://github.blog/changelog/2024-04-02-github-actions-hardware-accelerated-android-virtualization-now-available/)). This branch applies that permission rule only to the disposable runner VM, pins Ubuntu 24.04, requests acceleration, fails early if `/dev/kvm` is absent, and caps emulator startup at five minutes. Node tests, TypeScript and Vite build plus both APK compilations happen before emulator startup.

## Tool and test inventory

See machine-readable [infrastructure inventory](../qa/testing-infrastructure-inventory.json). Termux has Node/npm, JDK 21 and adb, but no Gradle, wrapper, Android SDK manager, emulator or images. No phone toolchain was installed. CI uses Node 20, Temurin 17, Gradle 8.2.1, AGP 8.2.1 and SDK 34.

The project already has custom Node production-function and fake-IndexedDB integration suites, WP0 regressions, Sentinel, and JUnit 4 / AndroidX instrumentation. It has no Jest/Vitest or React Testing Library setup, no coverage reporter, and no automated accessibility scanner. Those frameworks were not added because existing production integration and native UI testing provide a smaller stack. Existing Selenium visual/journey scripts import Selenium but lack a pinned dependency manifest and are not invoked by `test:all`; they were inspected, not executed.

## Current automated coverage

| Level | Existing evidence | Current status / limitation |
|---|---|---|
| Unit/domain | Node assertion suites and Sentinel | PASS locally: `npm run test:all`; see results below. |
| Data integration | Production Dexie with fake IndexedDB, migrations and WP0 fixtures | PASS locally; synthetic databases only. |
| Security regressions | crypto/recovery/backup/source tests and Sentinel | PASS locally; native interfaces are simulated in Node. |
| Android instrumentation | `LifeOSLaunchSmokeTest`, `CryptoAcceptanceTest`, opt-in `BiometricDeviceAcceptanceTest` | Build/run pending on new workflow. Interactive biometric test is opt-in and not simulated as a pass. |
| Component/UI workflows | No mounted React component harness; one Android Activity/WebView launch smoke | Partial; onboarding, finance, settings, permission and navigation workflows are not end-to-end automated. |
| Accessibility | No TalkBack or scanner assertions | NOT EXECUTED. |
| Physical device | No attached device tested in this mission | NOT VERIFIED. |

The new [coverage matrix](../qa/coverage-matrix.json) distinguishes test existence from execution and records the emulator and accessibility gaps.

## CI design and device matrix

`.github/workflows/android-emulator-qa.yml` now has one shared `build-test-apks` job and an ordered execution path:

1. Pull requests run one API 34 Pixel 6 smoke profile after Node tests, TypeScript, Vite build and app plus test APK compilation.
2. Only after the smoke succeeds, the same workflow run executes the three-profile matrix using the shared APK artifacts; matrix jobs execute sequentially to constrain concurrency and runner usage.

| Profile | API | Emulator hardware profile | RAM / heap | Purpose |
|---|---:|---|---|---|
| Compact / minimum supported | 29 | Nexus 5X | 2 GB / 256 MB | Android 10 native recovery and unsupported-WebView guidance; React/persistence smoke requires Chromium 87+. |
| Standard midrange | 34 | Pixel 6 | 3 GB / 512 MB | Current target SDK and Android runtime permissions. |
| Large / high density | 35 | Pixel 7 Pro | 4 GB / 512 MB | Large display and a newer Android version. |

All use x86_64, two vCPUs and Google APIs images; actual `wm size` and `wm density` are retained per run. Each emulator has a 300-second boot deadline, each instrumentation command an eight-minute timeout, each job a 20-minute ceiling and the matrix is sequential. API 29's current Google APIs image provides Chromium 74, so that profile verifies native recovery and the real native unsupported-WebView message; it does not claim React/persistence acceptance. API 34/35 must pass the real Activity/WebView and IndexedDB persistence case. The synthetic native crypto tests also run through AndroidJUnitRunner on minimum supported API 29. The biometric prompt test remains guarded because the hosted run cannot provide a human acceptance/cancellation action or prove strong biometric enrollment.

The instrumentation runner stores raw runner output, a parsed JUnit XML report, API/screen metrics and (on failure) bounded ADB state, AndroidRuntime errors and screenshot evidence. Failure collection uses per-command timeouts so it cannot keep a failed job alive after emulator shutdown. APK build artifacts are retained one day; test evidence is retained seven days.

## Reproducible setup

Run `npm ci`, `npm run test:all`, `npx --no-install tsc --noEmit`, `npm run build`, `npx cap sync android`, then use JDK 17 and Gradle 8.2.1 to compile `:app:assembleDebug` and `:app:assembleDebugAndroidTest`. The Android folder currently has no Gradle wrapper; CI provisions the pinned Gradle distribution rather than installing Android tooling in Termux. The emulator workflow provisions Android SDK/emulator components on the hosted runner.

The three-profile matrix starts automatically after the PR’s one-device smoke succeeds. If the smoke fails, the matrix is skipped, limiting wasted runner time.

## Local validation on 2026-11-07

- `npm run test:all`: PASS. Existing 96/96 assertions; WP0 self-test 134 checks and all 11 controls; Sentinel 6/6 suites (with individual suite counts in the run log).
- `npx --no-install tsc --noEmit`: PASS.
- `npm run build`: PASS (Vite, 2,230 modules).
- `node scripts/android-instrumentation-to-junit.cjs --self-test`: PASS for synthetic parser fixtures only; it is not Android test evidence.
- Workflow YAML parse, shell syntax and `git diff --check`: PASS.
- No Android Gradle build or emulator tests were run in Termux; those results remain pending until the new PR smoke workflow executes.

## Cost, cleanup and limits

Every PR run targeting the QA baseline uses one hosted build job, one API 34 smoke emulator, then (only after smoke passes) three sequential matrix emulators. The APKs are compiled once and reused across all four emulator profiles. Planning estimate: roughly 35–60 runner-minutes for a successful run, depending on Android SDK/image setup time; the configured job timeouts impose a 100 runner-minute upper bound if every job consumes its full timeout. These are estimates, not measured results. This uses standard GitHub-hosted Linux minutes and no paid device farm; account quota/billing depends on repository plan. The matrix is automatic on PRs because `workflow_dispatch` is unavailable until the workflow exists on the default branch.

No dependencies, production modules, branches, stashes or historical evidence were removed. No global packages or Termux Android SDK components were installed. The Track A PR #18 branch/worktree was not edited. Manufacturer-specific behavior, TalkBack, actual notification delivery/permission interaction, real Keystore/biometric prompts and physical Android devices remain unverified.
