'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
const workflow = fs.readFileSync('.github/workflows/build-apk.yml', 'utf8');
assert.match(gradle, /applicationId "com\.lifeos\.personal"/);
assert.match(gradle, /versionCode lifeosVersionCode[\s\S]*?versionName lifeosVersion/);
for (const key of ['LIFEOS_DEBUG_KEYSTORE_PATH', 'LIFEOS_DEBUG_KEYSTORE_PASSWORD', 'LIFEOS_DEBUG_KEY_ALIAS', 'LIFEOS_DEBUG_KEY_PASSWORD']) {
  assert.ok(gradle.includes(key), `Gradle requires stable debug signing input ${key}`);
}
assert.match(gradle, /debug\s*\{\s*if \(!lifeosDebugSigningReady\)\s*\{\s*throw new GradleException\([\s\S]*?\)\s*\}\s*signingConfig signingConfigs\.lifeosDebug\s*\}/,
  'debug builds fail explicitly without the persistent signing identity');
assert.match(workflow, /secrets\.LIFEOS_DEBUG_KEYSTORE_BASE64[\s\S]*?secrets\.LIFEOS_DEBUG_KEY_PASSWORD/,
  'CI reads debug keystore material only from GitHub Actions secrets');
assert.match(workflow, /Debug APK signing is mandatory[\s\S]*?exit 1/,
  'CI fails explicitly when any required debug signing secret is missing');
assert.match(workflow, /keytool -list[\s\S]*?Verify debug APK signing identity and package version/,
  'CI validates the keystore and checks the APK signature, package ID and versionCode');
assert.match(workflow, /SHA-256 signer: \$ACTUAL/,
  'CI writes the verified fingerprint to the summary without treating it as shell syntax');
assert.match(workflow, /name: Check Android release signing secrets\s+id: signing\s+if: >-\s+github\.event_name != 'pull_request' &&\s+\(github\.ref == 'refs\/heads\/main' \|\| github\.ref == 'refs\/heads\/develop' \|\| startsWith\(github\.ref, 'refs\/heads\/release\/'\)\)/,
  'signed release packaging is not eligible on feature branches or pull requests');
assert.doesNotMatch(fs.readdirSync('android/app').join('\n'), /\.keystore|\.jks/,
  'keystore material is not added to the Android project');
console.log('ANDROID SIGNING CONTRACT: package identity is stable; versionCode advances; persistent debug signing is secret-gated and no key file is committed.');
