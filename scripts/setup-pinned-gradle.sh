#!/usr/bin/env bash
# Official Gradle 8.13 bytes via GitHub's asset API. This avoids the failing
# distribution redirect used by setup-gradle without changing the toolchain.
set -euo pipefail
: "${RUNNER_TEMP:?GitHub runner temporary directory required}"
: "${GITHUB_PATH:?GitHub PATH file required}"
DIST_DIR="$RUNNER_TEMP/lifeos-gradle-8.13"
mkdir -p "$DIST_DIR"
gh api repos/gradle/gradle-distributions/releases/assets/232373824 \
  -H 'Accept: application/octet-stream' > "$DIST_DIR/gradle.zip"
printf '%s  %s\n' '20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78' "$DIST_DIR/gradle.zip" | sha256sum --check --strict
unzip -q "$DIST_DIR/gradle.zip" -d "$DIST_DIR"
printf '%s\n' "$DIST_DIR/gradle-8.13/bin" >> "$GITHUB_PATH"
"$DIST_DIR/gradle-8.13/bin/gradle" --version
