'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const gradle = fs.readFileSync('android/app/build.gradle', 'utf8').replace(/\r\n/g, '\n');
assert.match(gradle, /applicationId "com\.lifeos\.personal"/);
assert.match(gradle, /versionCode lifeosVersionCode[\s\S]*?versionName lifeosVersion/);
for (const key of ['LIFEOS_DEBUG_KEYSTORE_PATH', 'LIFEOS_DEBUG_KEYSTORE_PASSWORD', 'LIFEOS_DEBUG_KEY_ALIAS', 'LIFEOS_DEBUG_KEY_PASSWORD']) {
  assert.ok(gradle.includes(key), `Gradle requires stable debug signing input ${key}`);
}
assert.match(gradle, /debug\s*\{\s*applicationIdSuffix "\.dev"\s*versionNameSuffix "-dev"\s*if \(!lifeosDebugSigningReady\)\s*\{\s*throw new GradleException\([\s\S]*?\)\s*\}\s*signingConfig signingConfigs\.lifeosDebug\s*\}/,
  'isolated Dev debug builds retain their package suffix and fail without the persistent signing identity');
assert.match(gradle, /def lifeosDebugSigningReady\s*=\s*\[\s*'LIFEOS_DEBUG_KEYSTORE_PATH',\s*'LIFEOS_DEBUG_KEYSTORE_PASSWORD',\s*'LIFEOS_DEBUG_KEY_ALIAS',\s*'LIFEOS_DEBUG_KEY_PASSWORD'\s*\]\.every/,
  'local Dev signing requires the complete isolated credential set');
assert.match(gradle, /lifeosReleaseSigningReady[\s\S]*?ANDROID_KEYSTORE_PATH[\s\S]*?ANDROID_KEYSTORE_PASSWORD/,
  'release signing remains distinct from local Dev signing');
assert.doesNotMatch(fs.readdirSync('android/app').join('\n'), /\.(?:keystore|jks|p12|pfx)$/i,
  'keystore material is not added to the Android project');
console.log('ANDROID SIGNING CONTRACT: local Dev package identity/version are stable; persistent signing is mandatory; release keys are separate and no keystore is committed.');
