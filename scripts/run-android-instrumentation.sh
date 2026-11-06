#!/usr/bin/env bash
set -euo pipefail

APP_APK=${1:?expected app debug APK path}
TEST_APK=${2:?expected Android instrumentation APK path}
OUT=${3:-qa-emulator-evidence}
SERIAL=${ANDROID_SERIAL:-emulator-5554}
mkdir -p "$OUT"

adb -s "$SERIAL" get-state
{
  printf 'serial=%s\n' "$SERIAL"
  adb -s "$SERIAL" shell getprop ro.build.version.release
  adb -s "$SERIAL" shell getprop ro.build.version.sdk
  adb -s "$SERIAL" shell wm size
  adb -s "$SERIAL" shell wm density
} > "$OUT/device-profile.txt"

adb -s "$SERIAL" install -r "$APP_APK"
adb -s "$SERIAL" install -r "$TEST_APK"
adb -s "$SERIAL" shell pm path com.lifeos.personal
adb -s "$SERIAL" shell pm list instrumentation
adb -s "$SERIAL" logcat -c

set +e
timeout 480s adb -s "$SERIAL" shell am instrument -w -r \
  com.lifeos.personal.test/androidx.test.runner.AndroidJUnitRunner \
  2>&1 | tee "$OUT/instrumentation-output.txt"
pipe_status=("${PIPESTATUS[@]}")
instrumentation_status=${pipe_status[0]}
set -e

node scripts/android-instrumentation-to-junit.cjs \
  "$OUT/instrumentation-output.txt" "$OUT/junit.xml" \
  'LifeOSLaunchSmokeTest#activityCreatesLocalCapacitorWebView'
if [ "$instrumentation_status" -ne 0 ]; then
  exit "$instrumentation_status"
fi
