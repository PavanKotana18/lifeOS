# Mission 05: Android Virtual Testing Lab

Date: 2026-11-17 (Asia/Kolkata)  
Branch: `local/lifeos-debug-isolated`

## Recovered and installed state

- Existing Android SDK retained at `C:\Users\kotan\AppData\Local\Android\Sdk`.
- Reused Java 17.0.21, Gradle 8.2.1, Node 22.23.5, platform-tools 37.0.1,
  build-tools 34.0.0, and platform 34.
- Installed Android Emulator 37.2.13 and Google APIs x86_64 API 34 system image
  revision 14. Android 16/API 36 was skipped for this 12 GB host.
- Hardware acceleration check passed: `WHPX(10.0.26200) is installed and
  usable.` No Windows features, BIOS settings, or administrator configuration
  were changed; no reboot was performed.
- Created and registered `LifeOS-QA` at
  `D:\LifeOS-Android-QA\avd\LifeOS-QA.avd`, on the HDD. Settings are 2048 MB
  guest RAM, two cores, 720 × 1280 at 320 dpi, host graphics, and a 2 GB data
  partition. Existing SDK and AVD folders were not moved or removed.
- AVD Manager printed a `devices.xml` diagnostic for the Pixel 2 hardware
  profile while creating the AVD, but returned success; the resulting config,
  API 34 image path, and `emulator -list-avds` registration were verified.

## Results

| Check | Result | Evidence / detail |
|---|---|---|
| Tasks 2.0 regression | PASS | `node test_tasks_2_0.cjs`; view, subtask, persistence, and navigation checks passed. |
| Full JavaScript suite | PASS | `npm test`, exit code 0; repeated by local QA. |
| Sentinel security suite | PASS | `npm run test:sentinel`, exit code 0. |
| TypeScript | PASS | `npx --no-install tsc --noEmit`, exit code 0. |
| Web build | PASS | `npm run build`, exit code 0. |
| Android runner contract | PASS | Simulated ADB only; includes physical-mode refusal before any ADB invocation. |
| Android SDK / AVD setup | PASS | SDK Manager inventory and `emulator -list-avds` confirm API 34 image and `LifeOS-QA`. |
| WHPX acceleration | PASS | Emulator `-accel-check` reports WHPX usable. |
| Emulator boot | BLOCKED | Launcher refused when free RAM was 3.38 GB; most recent reading was 2.12 GB, below its 3.5 GB floor. One earlier startup attempt stopped during ADB daemon initialization and cleaned up its emulator process. No successful boot was observed. |
| Dev APK build | BLOCKED | `local-debug.p12` exists, but the local process lacks the two password variables needed to validate and use it. No APK install was attempted. |
| Native notification instrumentation | BLOCKED | Not executed. No claim is made about scheduled reminders being posted by Android or notification taps. |

The combined local QA report is
`%LOCALAPPDATA%\LifeOS\qa-reports\20261117-204549\report.md`: 8 PASS, 0
FAIL, 5 BLOCKED. Its blockers are emulator selection, signing, APK build,
instrumentation, and OS-posted notification/tap validation.

The API 34 notification test path grants `POST_NOTIFICATIONS` only to the fresh
`com.lifeos.personal.dev` emulator app. The runner validates the selected
`emulator-NNNN` serial, QEMU property, and running AVD name. It does not list
ADB devices or accept physical serials. The production package is never an
install target.

## Hosted alternative and remaining blockers

The existing `.github/workflows/android-emulator-qa.yml` is retained and its
APK identity check now matches the isolated `com.lifeos.personal.dev` debug
variant. Hosted execution requires these repository secrets:

- `LIFEOS_DEBUG_KEYSTORE_BASE64`
- `LIFEOS_DEBUG_KEYSTORE_PASSWORD`
- `LIFEOS_DEBUG_KEY_ALIAS`
- `LIFEOS_DEBUG_KEY_PASSWORD`

The workflow has not been triggered. It requires the branch to be published
and a permitted push or pull request; no commit, push, or PR was made. Local
emulation should resume only when available host RAM is at least 3.5 GB and
the existing Dev signing values are supplied securely to the QA process.

## Evidence paths

- Local QA report and logs: `%LOCALAPPDATA%\LifeOS\qa-reports\20261117-204549\`
- AVD configuration: `D:\LifeOS-Android-QA\avd\LifeOS-QA.avd\config.ini`
- Emulator launch logs: `D:\LifeOS-Android-QA\emulator.stdout.log` and
  `D:\LifeOS-Android-QA\emulator.stderr.log`

No emulator screenshot or device logcat was captured because the AVD never
completed boot. No physical Android device was queried or used.
