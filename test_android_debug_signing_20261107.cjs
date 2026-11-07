'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
const workflow = fs.readFileSync('.github/workflows/build-apk.yml', 'utf8');
assert.match(gradle, /applicationId "com\.lifeos\.personal"/);
assert.match(gradle, /versionCode lifeosVersionCode[\s\S]*?versionName lifeosVersion/);
for (const key of ['LIFEOS_DEBUG_KEYSTORE_PATH', 'LIFEOS_DEBUG_KEYSTORE_PASSWORD', 'LIFEOS_DEBUG_KEY_ALIAS', 'LIFEOS_DEBUG_KEY_PASSWORD']) {
  assert.ok(gradle.includes(key), `Gradle accepts optional stable debug signing input ${key}`);
}
assert.match(gradle, /debug\s*\{\s*if \(lifeosDebugSigningReady\) signingConfig signingConfigs\.lifeosDebug\s*\}/,
  'debug uses a persistent signing identity only when all required signing inputs exist');
assert.match(workflow, /secrets\.LIFEOS_DEBUG_KEYSTORE_BASE64[\s\S]*?secrets\.LIFEOS_DEBUG_KEY_PASSWORD/,
  'CI reads debug keystore material only from GitHub Actions secrets');
assert.match(workflow, /runner-generated Android debug key and may not update/,
  'CI clearly labels ephemeral debug signatures as non-update-stable');
assert.doesNotMatch(fs.readdirSync('android/app').join('\n'), /\.keystore|\.jks/,
  'keystore material is not added to the Android project');
console.log('ANDROID SIGNING CONTRACT: package identity is stable; versionCode advances; persistent debug signing is secret-gated and no key file is committed.');
