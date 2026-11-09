#!/usr/bin/env bash
# Official Gradle 8.2.1 bytes via GitHub's asset API. This avoids the failing
# distribution redirect used by setup-gradle without changing the toolchain.
set -euo pipefail
: "${RUNNER_TEMP:?GitHub runner temporary directory required}"
: "${GITHUB_PATH:?GitHub PATH file required}"
DIST_DIR="$RUNNER_TEMP/lifeos-gradle-8.2.1"
mkdir -p "$DIST_DIR"
gh api repos/gradle/gradle-distributions/releases/assets/127723481 \
  -H 'Accept: application/octet-stream' > "$DIST_DIR/gradle.zip"
printf '%s  %s\n' '03ec176d388f2aa99defcadc3ac6adf8dd2bce5145a129659537c0874dea5ad1' "$DIST_DIR/gradle.zip" | sha256sum --check --strict
unzip -q "$DIST_DIR/gradle.zip" -d "$DIST_DIR"
printf '%s\n' "$DIST_DIR/gradle-8.2.1/bin" >> "$GITHUB_PATH"
"$DIST_DIR/gradle-8.2.1/bin/gradle" --version
