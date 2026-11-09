#!/usr/bin/env bash
# One shell is essential: emulator-runner executes separate script lines independently.
set -uo pipefail
visual_status=0
ANDROID_TEST_FILTER='com.lifeos.personal.DirectedVisualAcceptanceTest#packagedMandatoryOnboardingScreensAndRestart' ANDROID_REQUIRED_TEST='DirectedVisualAcceptanceTest#packagedMandatoryOnboardingScreensAndRestart' ANDROID_EXPECTED_TESTS=1 bash scripts/run-android-instrumentation.sh android-apks/app-debug.apk android-apks/app-debug-androidTest.apk qa-visual-evidence || visual_status=$?
pull_status=0
# The inner runner writes this only after rejecting physical/existing installations.
if [[ -s qa-visual-evidence/device-profile.txt ]] && [[ "$(adb -s emulator-5554 shell getprop ro.kernel.qemu | tr -d '\r')" == '1' ]]; then
  adb -s emulator-5554 pull /sdcard/Android/data/com.lifeos.personal/files/LifeOS-directed-visual qa-visual-evidence/screenshots || pull_status=$?
else
  pull_status=1
fi
if [[ "$visual_status" -ne 0 ]]; then exit "$visual_status"; fi
exit "$pull_status"
