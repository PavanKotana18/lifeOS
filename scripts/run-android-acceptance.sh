#!/bin/sh
# Explicit disposable emulator only. Never defaults to an attached personal device.
set -eu
if [ -z "${LIFEOS_ACCEPTANCE_SERIAL:-}" ] || [ -z "${LIFEOS_APP_APK:-}" ] || [ -z "${LIFEOS_TEST_APK:-}" ]; then
  echo 'BLOCKED: set LIFEOS_ACCEPTANCE_SERIAL, LIFEOS_APP_APK and LIFEOS_TEST_APK for a fresh lifeos-acceptance-sprint3 AVD.' >&2
  exit 2
fi
command -v adb >/dev/null || { echo 'BLOCKED: adb unavailable' >&2; exit 2; }
[ -f "$LIFEOS_APP_APK" ] && [ -f "$LIFEOS_TEST_APK" ] || { echo 'BLOCKED: APK artifacts missing' >&2; exit 2; }
LIFEOS_AVD_NAME=$(adb -s "$LIFEOS_ACCEPTANCE_SERIAL" shell getprop ro.boot.qemu.avd_name | tr -d '\r')
LIFEOS_IS_EMULATOR=$(adb -s "$LIFEOS_ACCEPTANCE_SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')
[ "$LIFEOS_AVD_NAME" = 'lifeos-acceptance-sprint3' ] && [ "$LIFEOS_IS_EMULATOR" = '1' ] || { echo 'BLOCKED: selected target is not the dedicated disposable AVD' >&2; exit 2; }
# Refuse to update any existing installation, including a previous test run.
LIFEOS_EXISTING_APP=$(adb -s "$LIFEOS_ACCEPTANCE_SERIAL" shell pm path com.lifeos.personal 2>/dev/null || true)
LIFEOS_EXISTING_TEST=$(adb -s "$LIFEOS_ACCEPTANCE_SERIAL" shell pm path com.lifeos.personal.test 2>/dev/null || true)
[ -z "$LIFEOS_EXISTING_APP" ] && [ -z "$LIFEOS_EXISTING_TEST" ] || { echo 'BLOCKED: existing package found; create another fresh disposable AVD profile' >&2; exit 2; }
sha256sum "$LIFEOS_APP_APK" "$LIFEOS_TEST_APK"
adb -s "$LIFEOS_ACCEPTANCE_SERIAL" install -t "$LIFEOS_APP_APK"
adb -s "$LIFEOS_ACCEPTANCE_SERIAL" install -t "$LIFEOS_TEST_APK"
LIFEOS_NATIVE_LOG=$(mktemp "${TMPDIR:-/tmp}/lifeos-native-acceptance.XXXXXX")
adb -s "$LIFEOS_ACCEPTANCE_SERIAL" shell am instrument -w -r -e class com.lifeos.personal.CryptoAcceptanceTest com.lifeos.personal.test/androidx.test.runner.AndroidJUnitRunner > "$LIFEOS_NATIVE_LOG" 2>&1
cat "$LIFEOS_NATIVE_LOG"
if grep -Eq 'FAILURES|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED' "$LIFEOS_NATIVE_LOG"; then exit 1; fi
grep -Eq '^OK \(7 tests\)' "$LIFEOS_NATIVE_LOG" || { echo 'FAIL: missing complete seven-test execution evidence' >&2; exit 1; }
printf 'Synthetic native log retained: %s\n' "$LIFEOS_NATIVE_LOG"
