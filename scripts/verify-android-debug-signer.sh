#!/usr/bin/env bash
set -euo pipefail

apk=${1:?expected a Debug APK}
report=${2:?expected Gradle signing report}
apksigner="${ANDROID_HOME:?Android SDK path is required}/build-tools/34.0.0/apksigner"

# Android Gradle Plugin resolves the Debug keystore location on the build host.
expected="$(awk '
  /^Variant: / { variant = $2 }
  variant == "debug" && /^Config: debug$/ { debug_config = 1 }
  variant == "debug" && /^Alias: / && tolower($2) == "androiddebugkey" { debug_alias = 1 }
  variant == "debug" && /^SHA-256: / { fingerprint = $2 }
  END { if (debug_config && debug_alias) print fingerprint }
' "$report" | tr -d ':' | tr '[:upper:]' '[:lower:]')"
if [[ ! "$expected" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Missing default Android Debug certificate fingerprint in Gradle signing report." >&2
  exit 1
fi

actual="$("$apksigner" verify --print-certs "$apk" | awk -F': ' '/Signer #1 certificate SHA-256 digest:/{print tolower($2)}')"
if [[ "$actual" != "$expected" ]]; then
  echo "Debug APK certificate differs from the Gradle Debug signing identity." >&2
  exit 1
fi
printf '%s\n' "$actual"
