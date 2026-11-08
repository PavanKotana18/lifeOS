#!/usr/bin/env bash
set -euo pipefail

APP_APK=${1:?expected app debug APK path}
TEST_APK=${2:?expected Android instrumentation APK path}
OUT=${3:-qa-emulator-evidence}
SERIAL=${ANDROID_SERIAL:-emulator-5554}
TEST_FILTER=${ANDROID_TEST_FILTER:-}
REQUIRED_TEST=${ANDROID_REQUIRED_TEST:-${TEST_FILTER:-LifeOSLaunchSmokeTest#activityCreatesLocalCapacitorWebView}}
EXCLUDED_TESTS_FILE=${ANDROID_TEST_EXCLUSION_FILE:-}
EXPECTED_TESTS=${ANDROID_EXPECTED_TESTS:-unconfigured}
mkdir -p "$OUT"
SAFE_EMULATOR=false

capture_evidence() {
  local result=$?
  trap - EXIT
  set +e
  # A refusal must never collect screenshots/logs from an existing installation
  # or a physical handset. Diagnostics below are limited to the fresh QA AVD.
  if [[ "$SAFE_EMULATOR" != true ]]; then exit "$result"; fi
  timeout 8s adb -s "$SERIAL" shell dumpsys webviewupdate > "$OUT/webview-provider.txt" 2>&1
  timeout 10s adb -s "$SERIAL" logcat -b all -d -v threadtime AndroidRuntime:E System.err:E chromium:E ActivityManager:E ActivityTaskManager:E libc:E DEBUG:E LifeOSAcceptance:I '*:S' > "$OUT/logcat-errors.txt" 2>&1
  if [[ "$result" -ne 0 ]]; then
    {
      printf 'serial=%s\n' "$SERIAL"
      printf 'sdk='; timeout 5s adb -s "$SERIAL" shell getprop ro.build.version.sdk
      printf 'app_pid='; timeout 5s adb -s "$SERIAL" shell pidof com.lifeos.personal
      printf 'instrumentation_pid='; timeout 5s adb -s "$SERIAL" shell pidof com.lifeos.personal.test
      timeout 8s adb -s "$SERIAL" shell ps -A | grep -E 'com\.lifeos\.personal(:|$)|com\.lifeos\.personal\.test' || true
    } > "$OUT/process-state.txt" 2>&1
    sdk=$(timeout 5s adb -s "$SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')
    if [[ "$sdk" =~ ^[0-9]+$ ]] && (( sdk >= 30 )); then
      timeout 8s adb -s "$SERIAL" shell dumpsys activity exit-info com.lifeos.personal > "$OUT/app-exit-info.txt" 2>&1
      timeout 8s adb -s "$SERIAL" shell dumpsys activity exit-info com.lifeos.personal.test > "$OUT/instrumentation-exit-info.txt" 2>&1
    fi
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
SAFE_EMULATOR=true
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

{
  printf 'expected_tests=%s\n' "$EXPECTED_TESTS"
  printf 'include_filter=%s\n' "${TEST_FILTER:-all}"
  printf 'excluded_tests_file=%s\n' "${EXCLUDED_TESTS_FILE:-none}"
  if [[ -n "$EXCLUDED_TESTS_FILE" ]]; then
    test -s "$EXCLUDED_TESTS_FILE"
    cat "$EXCLUDED_TESTS_FILE"
  fi
} > "$OUT/test-inventory.txt"

set +e
instrument_args=(-w -r)
if [[ -n "$TEST_FILTER" ]]; then
  instrument_args=(-e class "$TEST_FILTER" "${instrument_args[@]}")
fi
if [[ -n "$EXCLUDED_TESTS_FILE" ]]; then
  test -s "$EXCLUDED_TESTS_FILE"
  RUNNER_PROCESS_PACKAGE=com.lifeos.personal
  HOST_EXCLUSIONS_FILE=/data/local/tmp/lifeos-test-exclusions.txt
  timeout 10s adb -s "$SERIAL" push "$EXCLUDED_TESTS_FILE" "$HOST_EXCLUSIONS_FILE"
  RUNNER_PROCESS_DATA_DIR=$(timeout 10s adb -s "$SERIAL" shell run-as "$RUNNER_PROCESS_PACKAGE" pwd | tr -d '\r')
  if [[ ! "$RUNNER_PROCESS_DATA_DIR" =~ ^/data/(user/[0-9]+|data)/com\.lifeos\.personal$ ]]; then
    echo "Unexpected instrumentation process data directory: $RUNNER_PROCESS_DATA_DIR" >&2
    exit 1
  fi
  REMOTE_EXCLUDED_TESTS_FILE="$RUNNER_PROCESS_DATA_DIR/files/lifeos-test-exclusions.txt"
  timeout 10s adb -s "$SERIAL" shell run-as "$RUNNER_PROCESS_PACKAGE" mkdir -p "$RUNNER_PROCESS_DATA_DIR/files"
  timeout 10s adb -s "$SERIAL" shell run-as "$RUNNER_PROCESS_PACKAGE" cp "$HOST_EXCLUSIONS_FILE" "$REMOTE_EXCLUDED_TESTS_FILE"
  timeout 10s adb -s "$SERIAL" shell run-as "$RUNNER_PROCESS_PACKAGE" test -r "$REMOTE_EXCLUDED_TESTS_FILE"
  instrument_args+=(-e notTestFile "$REMOTE_EXCLUDED_TESTS_FILE")
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
