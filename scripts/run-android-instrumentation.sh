#!/usr/bin/env bash
set -euo pipefail
# Git Bash/MSYS rewrites Android device paths such as /data/local/tmp into
# host paths. Exclude only Android's /data paths so host-side script paths and
# executable lookup still receive normal MSYS conversion.
export MSYS2_ARG_CONV_EXCL=/data

APP_APK=${1:?expected app debug APK path}
TEST_APK=${2:?expected Android instrumentation APK path}
OUT=${3:-qa-emulator-evidence}
SERIAL=${ANDROID_SERIAL:-}
TEST_FILTER=${ANDROID_TEST_FILTER:-}
REQUIRED_TEST=${ANDROID_REQUIRED_TEST:-${TEST_FILTER:-LifeOSLaunchSmokeTest#activityCreatesLocalCapacitorWebView}}
EXCLUDED_TESTS_FILE=${ANDROID_TEST_EXCLUSION_FILE:-}
EXPECTED_TESTS=${ANDROID_EXPECTED_TESTS:-unconfigured}
DEV_PACKAGE=${ANDROID_DEV_PACKAGE:-com.lifeos.personal.dev}
TEST_PACKAGE=${ANDROID_TEST_PACKAGE:-${DEV_PACKAGE}.test}
DEVICE_MODE=${LIFEOS_QA_DEVICE_MODE:-emulator}
PROTECTED_PACKAGE=com.lifeos.personal
mkdir -p "$OUT"
SAFE_DEVICE=false

capture_evidence() {
  local result=$?
  trap - EXIT
  set +e
  # Collect evidence only after the explicit emulator serial has been checked.
  if [[ "$SAFE_DEVICE" != true ]]; then exit "$result"; fi
  timeout 8s adb -s "$SERIAL" shell dumpsys webviewupdate > "$OUT/webview-provider.txt" 2>&1
  timeout 15s adb -s "$SERIAL" logcat -b all -d -v threadtime '*:E' 2>&1 \
    | grep -E 'LifeOSAcceptance|AndroidRuntime|FATAL EXCEPTION|ANR in|Process .* died' \
    | node scripts/sanitize-android-log.cjs > "$OUT/logcat-errors.txt"
  timeout 10s adb -s "$SERIAL" logcat -b all -d -v threadtime ActivityManager:I lmkd:I AndroidRuntime:E '*:S' 2>&1 \
    | grep -E 'ActivityManager|lmkd|AndroidRuntime|LifeOSAcceptance' \
    | node scripts/sanitize-android-log.cjs > "$OUT/platform-process-lifecycle.txt"
  if [[ "$result" -ne 0 ]]; then
    {
      printf 'serial=%s\n' "$SERIAL"
      printf 'sdk='; timeout 5s adb -s "$SERIAL" shell getprop ro.build.version.sdk
      printf 'dev_app_pid='; timeout 5s adb -s "$SERIAL" shell pidof "$DEV_PACKAGE"
      printf 'instrumentation_pid='; timeout 5s adb -s "$SERIAL" shell pidof "$TEST_PACKAGE"
    } > "$OUT/process-state.txt" 2>&1
    sdk=$(timeout 5s adb -s "$SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')
    if [[ "$sdk" =~ ^[0-9]+$ ]] && (( sdk >= 30 )); then
      timeout 8s adb -s "$SERIAL" shell dumpsys activity exit-info "$DEV_PACKAGE" > "$OUT/app-exit-info.txt" 2>&1
      timeout 8s adb -s "$SERIAL" shell dumpsys activity exit-info "$TEST_PACKAGE" > "$OUT/instrumentation-exit-info.txt" 2>&1
      timeout 8s adb -s "$SERIAL" shell dumpsys activity exit-info com.google.android.gms > "$OUT/google-play-services-exit-info.txt" 2>&1
    fi
    timeout 8s adb -s "$SERIAL" shell dumpsys meminfo "$DEV_PACKAGE" > "$OUT/app-memory-info.txt" 2>&1
    timeout 12s adb -s "$SERIAL" shell dumpsys meminfo > "$OUT/system-memory-info.txt" 2>&1
    timeout 8s adb -s "$SERIAL" exec-out screencap -p > "$OUT/failure.png" 2> "$OUT/screenshot-error.txt"
  fi
  exit "$result"
}
trap capture_evidence EXIT

if [[ "$DEVICE_MODE" != emulator ]]; then
  echo 'Refusing device action: this QA runner supports emulator targets only.' >&2
  exit 1
fi
if [[ "$DEVICE_MODE" == emulator && -z "$SERIAL" ]]; then
  SERIAL=emulator-5554
fi
if [[ ! "$SERIAL" =~ ^emulator-[0-9]+$ ]]; then
  echo "Refusing device action: serial must begin with emulator-; physical serials are prohibited (received '$SERIAL')." >&2
  exit 1
fi
if [[ "$(timeout 10s adb -s "$SERIAL" get-state | tr -d '\r')" != device ]]; then
  echo "Refusing device action: selected emulator serial $SERIAL is not online." >&2
  exit 1
fi
qemu=$(timeout 8s adb -s "$SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')
if [[ "$qemu" != '1' ]]; then echo 'Refusing device action: selected target is not an Android emulator.' >&2; exit 1; fi
avd_response=$(timeout 8s adb -s "$SERIAL" emu avd name | tr -d '\r')
avd_name=$(printf '%s\n' "$avd_response" | sed '/^OK$/d; /^[[:space:]]*$/d' | head -n 1)
# Capture the entire list before matching. With pipefail, grep -q can close
# the emulator process pipe early and turn a valid match into a refusal.
EMULATOR_BIN=emulator
sdk_root=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
if [[ -n "$sdk_root" && -x "$sdk_root/emulator/emulator" ]]; then
  EMULATOR_BIN="$sdk_root/emulator/emulator"
elif [[ -n "$sdk_root" && -x "$sdk_root/emulator/emulator.exe" ]]; then
  EMULATOR_BIN="$sdk_root/emulator/emulator.exe"
fi
known_avds=$(timeout 10s "$EMULATOR_BIN" -list-avds | tr -d '\r')
if [[ -z "$avd_name" ]] || ! grep -Fx "$avd_name" <<< "$known_avds" >/dev/null; then
  printf 'Selected emulator AVD response: %s\nRegistered AVDs: %s\n' "$avd_response" "$known_avds" >&2
  echo 'Refusing device action: selected emulator serial does not map to a running AVD known to this SDK.' >&2
  exit 1
fi
existing_package=$(timeout 8s adb -s "$SERIAL" shell pm list packages "$DEV_PACKAGE")
if printf '%s\n' "$existing_package" | grep -Fqx "package:$DEV_PACKAGE"; then
  echo "Refusing to overwrite existing $DEV_PACKAGE on a QA emulator." >&2
  exit 1
fi
SAFE_DEVICE=true
# Verify both APK identities before install. The production application ID is
# never an install target, even when a release APK is accidentally supplied.
if ! command -v aapt >/dev/null || ! command -v apksigner >/dev/null; then
  # Hosted emulator jobs have the SDK installed without build-tools on PATH.
  build_tools_path=''
  for candidate in "$sdk_root"/build-tools/*; do
    if [[ -x "$candidate/aapt" || -x "$candidate/aapt.exe" ]]; then
      build_tools_path=$candidate
      if [[ "${candidate##*/}" == '34.0.0' ]]; then break; fi
    fi
  done
  if [[ -n "$build_tools_path" ]]; then export PATH="$build_tools_path:$PATH"; fi
fi
if ! command -v aapt >/dev/null || ! command -v apksigner >/dev/null; then
  echo 'Refusing APK install: SDK build-tools aapt and apksigner must both be available.' >&2
  exit 1
fi
APP_ID=$(aapt dump badging "$APP_APK" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -n 1)
TEST_ID=$(aapt dump badging "$TEST_APK" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -n 1)
TEST_TARGET=$(aapt dump xmltree "$TEST_APK" AndroidManifest.xml | sed -n 's/.*android:targetPackage[^=]*="\([^"]*\)".*/\1/p' | head -n 1)
if [[ "$APP_ID" != "$DEV_PACKAGE" || "$TEST_ID" != "$TEST_PACKAGE" || "$TEST_TARGET" != "$DEV_PACKAGE" || "$APP_ID" == "$PROTECTED_PACKAGE" ]]; then
  echo "Refusing APK install: expected app=$DEV_PACKAGE and instrumentation target=$DEV_PACKAGE (test APK=$TEST_PACKAGE); found app=$APP_ID test=$TEST_ID target=$TEST_TARGET." >&2
  exit 1
fi
if ! command -v apksigner >/dev/null 2>&1; then
  echo 'Refusing APK install: Android build-tools apksigner is unavailable.' >&2
  exit 1
fi
if ! apksigner verify --print-certs "$APP_APK" > "$OUT/app-signature.txt" 2>&1 || ! apksigner verify --print-certs "$TEST_APK" > "$OUT/test-signature.txt" 2>&1; then
  echo 'Refusing APK install: app or instrumentation APK signature verification failed.' >&2
  exit 1
fi
APP_SIGNER=$(sed -n 's/.*certificate SHA-256 digest: //p' "$OUT/app-signature.txt" | head -n 1 | tr '[:upper:]' '[:lower:]')
TEST_SIGNER=$(sed -n 's/.*certificate SHA-256 digest: //p' "$OUT/test-signature.txt" | head -n 1 | tr '[:upper:]' '[:lower:]')
if [[ -z "$APP_SIGNER" || "$APP_SIGNER" != "$TEST_SIGNER" ]]; then
  echo 'Refusing APK install: app/test APK signing identities do not match or could not be read.' >&2
  exit 1
fi

{
  printf 'app_id=%s\n' "$APP_ID"
  printf 'instrumentation_package=%s\n' "$TEST_ID"
  printf 'instrumentation_target=%s\n' "$TEST_TARGET"
  printf 'app_and_test_signer_sha256=%s\n' "$APP_SIGNER"
} > "$OUT/apk-identity-and-signing.txt"
{
  printf 'serial=%s\n' "$SERIAL"
  adb -s "$SERIAL" shell getprop ro.build.version.release
  adb -s "$SERIAL" shell getprop ro.build.version.sdk
  adb -s "$SERIAL" shell wm size
  adb -s "$SERIAL" shell wm density
} > "$OUT/device-profile.txt"

  # sys.boot_completed alone does not mean Pixel Launcher has finished drawing.
  # Keep failures visible; never dismiss ANR dialogs or force-stop services.
  timeout 45s adb -s "$SERIAL" shell am start -W -a android.intent.action.MAIN -c android.intent.category.HOME > "$OUT/launcher-readiness.txt" 2>&1
  timeout 120s adb -s "$SERIAL" install "$APP_APK"
  timeout 120s adb -s "$SERIAL" install "$TEST_APK"
android_api=$(timeout 8s adb -s "$SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')
if [[ "$android_api" =~ ^[0-9]+$ ]] && (( android_api >= 33 )); then
  # This is a disposable emulator with a fresh Dev package. Grant only the
  # test runtime permission needed to observe a posted notification.
  timeout 10s adb -s "$SERIAL" shell pm grant "$DEV_PACKAGE" android.permission.POST_NOTIFICATIONS
fi
  adb -s "$SERIAL" logcat -c
adb -s "$SERIAL" shell pm path "$DEV_PACKAGE"
adb -s "$SERIAL" shell pm list instrumentation

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
  RUNNER_PROCESS_PACKAGE=$DEV_PACKAGE
  HOST_EXCLUSIONS_FILE=/data/local/tmp/lifeos-test-exclusions.txt
  timeout 10s adb -s "$SERIAL" push "$EXCLUDED_TESTS_FILE" "$HOST_EXCLUSIONS_FILE"
  RUNNER_PROCESS_DATA_DIR=$(timeout 10s adb -s "$SERIAL" shell run-as "$RUNNER_PROCESS_PACKAGE" pwd | tr -d '\r')
  if [[ "$RUNNER_PROCESS_DATA_DIR" != "/data/user/0/$DEV_PACKAGE" && "$RUNNER_PROCESS_DATA_DIR" != "/data/data/$DEV_PACKAGE" ]]; then
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
  "$TEST_PACKAGE/androidx.test.runner.AndroidJUnitRunner" \
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
