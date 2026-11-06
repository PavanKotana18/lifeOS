#!/usr/bin/env bash
set -euo pipefail

APP_APK=${1:?expected app debug APK path}
TEST_APK=${2:?expected Android instrumentation APK path}
OUT=${3:-qa-emulator-evidence}
SERIAL=${ANDROID_SERIAL:-emulator-5554}
TEST_FILTER=${ANDROID_TEST_FILTER:-}
REQUIRED_TEST=${ANDROID_REQUIRED_TEST:-${TEST_FILTER:-LifeOSLaunchSmokeTest#activityCreatesLocalCapacitorWebView}}
mkdir -p "$OUT"

capture_evidence() {
  local result=$?
  trap - EXIT
  set +e
  timeout 8s adb -s "$SERIAL" shell dumpsys webviewupdate > "$OUT/webview-provider.txt" 2>&1
  timeout 8s adb -s "$SERIAL" logcat -d -v threadtime AndroidRuntime:E System.err:E chromium:E LifeOSAcceptance:I '*:S' > "$OUT/logcat-errors.txt" 2>&1
  if [[ "$result" -ne 0 ]]; then
    timeout 8s adb -s "$SERIAL" exec-out screencap -p > "$OUT/failure.png" 2> "$OUT/screenshot-error.txt"
    timeout 5s adb devices -l > "$OUT/adb-devices.txt" 2>&1
  fi
  exit "$result"
}
trap capture_evidence EXIT

timeout 10s adb -s "$SERIAL" get-state
if [[ "$(timeout 8s adb -s "$SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')" != '1' ]]; then
  echo 'Refusing APK installation: this runner requires a disposable emulator.' >&2
  exit 1
fi
existing_package=$(timeout 8s adb -s "$SERIAL" shell pm list packages com.lifeos.personal)
if [[ -n "$existing_package" ]]; then
  echo 'Refusing to overwrite an existing LifeOS installation; create a fresh AVD.' >&2
  exit 1
fi
{
  printf 'serial=%s\n' "$SERIAL"
  adb -s "$SERIAL" shell getprop ro.build.version.release
  adb -s "$SERIAL" shell getprop ro.build.version.sdk
  adb -s "$SERIAL" shell wm size
  adb -s "$SERIAL" shell wm density
} > "$OUT/device-profile.txt"

timeout 120s adb -s "$SERIAL" install "$APP_APK"
timeout 120s adb -s "$SERIAL" install "$TEST_APK"
adb -s "$SERIAL" shell pm path com.lifeos.personal
adb -s "$SERIAL" shell pm list instrumentation
adb -s "$SERIAL" logcat -c

set +e
instrument_args=(-w -r)
if [[ -n "$TEST_FILTER" ]]; then
  instrument_args=(-e class "$TEST_FILTER" "${instrument_args[@]}")
fi
timeout 480s adb -s "$SERIAL" shell am instrument "${instrument_args[@]}" \
  com.lifeos.personal.test/androidx.test.runner.AndroidJUnitRunner \
  2>&1 | tee "$OUT/instrumentation-output.txt"
pipe_status=("${PIPESTATUS[@]}")
instrumentation_status=${pipe_status[0]}
set -e

node scripts/android-instrumentation-to-junit.cjs \
  "$OUT/instrumentation-output.txt" "$OUT/junit.xml" \
  "$REQUIRED_TEST"
if [ "$instrumentation_status" -ne 0 ]; then
  exit "$instrumentation_status"
fi
