# LifeOS QA coverage and emulator workflow

Baseline: Sprint 4 PR #16 head `d186cec4a0df1f488c56e46438aa62d49487065d`; PRs #13–#16 are open, stacked and unmerged. This isolated QA branch adds coverage/reporting only; no production fixes or encryption activation.

`coverage-matrix.json` separates existing test presence from execution. Termux execution on this branch: `npm run test:all`, `npx --no-install tsc --noEmit`, `npm run build`, WP0 mandatory controls and `git diff --check` passed. Strict known-observation mode remains expected nonzero for LOS-001. Native tests have not executed locally; no emulator/device is attached. Previous PR #16 Actions compiled the AndroidTest APK but did not execute it.

New `.github/workflows/android-emulator-qa.yml` boots a fresh API34 emulator, runs the actual Activity/WebView smoke test and existing synthetic Java crypto tests using `connectedDebugAndroidTest`, and requires JUnit XML upload. On failure it captures AndroidRuntime/System.err errors and a screenshot from the disposable emulator. The opt-in real BiometricPrompt test uses JUnit assumption unless the explicit argument is supplied; CI does not fake enrollment or authenticate.

Reported finance newest-first behavior is reproducible from App logic: comparator sorts date strings only, ignoring transaction time; no change made at this QA-only stage. Cold-launch theme, settings-return reauthentication, notification reminder-vs-deadline history, delivery timing and scheduling races remain hypotheses pending deterministic or emulator evidence. Notification pending count is not treated as delivery evidence. LOS-001 remains release-blocking.

Actual Android 16 observation supplied by user: test notification appeared; pending count changed; one `Task Overdue` notification arrived one minute after its deadline. This supports at least one overdue delivery and does not establish failure of distinct task reminder/upcoming-deadline types. No raw screenshot, identifiers or personal record is included here.
