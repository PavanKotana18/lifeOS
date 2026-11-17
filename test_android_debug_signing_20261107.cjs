'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const gradle = fs.readFileSync('android/app/build.gradle', 'utf8').replace(/\r\n/g, '\n');
assert.match(gradle, /applicationId "com\.lifeos\.personal"/);
assert.match(gradle, /versionCode lifeosVersionCode[\s\S]*?versionName lifeosVersion/);
for (const key of ['LIFEOS_DEBUG_KEYSTORE_PATH', 'LIFEOS_DEBUG_KEYSTORE_PASSWORD', 'LIFEOS_DEBUG_KEY_ALIAS', 'LIFEOS_DEBUG_KEY_PASSWORD']) {
  assert.ok(gradle.includes(key), `Gradle requires stable debug signing input ${key}`);
}
assert.match(gradle, /debug\s*\{\s*applicationIdSuffix "\.dev"\s*versionNameSuffix "-dev"\s*if \(lifeosDebugSigningReady\)\s*\{\s*signingConfig signingConfigs\.lifeosDebug\s*\}\s*else\s*\{\s*signingConfig = null\s*\}\s*\}/,
  'isolated Dev builds keep their package suffix and only select the existing persistent Dev signer');
assert.match(gradle, /def lifeosDebugSigningReady\s*=\s*\[\s*'LIFEOS_DEBUG_KEYSTORE_PATH',\s*'LIFEOS_DEBUG_KEYSTORE_PASSWORD',\s*'LIFEOS_DEBUG_KEY_ALIAS',\s*'LIFEOS_DEBUG_KEY_PASSWORD'\s*\]\.every/,
  'local Dev signing requires the complete isolated credential set');
assert.match(gradle, /preview\s*\{\s*initWith debug\s*applicationIdSuffix "\.preview"\s*versionNameSuffix "-preview"\s*debuggable true\s*matchingFallbacks = \['debug'\]\s*signingConfig signingConfigs\.lifeosPreview/,
  'preview is a debuggable variant with a distinct package suffix and signer');
for (const key of ['LIFEOS_PREVIEW_KEYSTORE_PATH', 'LIFEOS_PREVIEW_KEYSTORE_PASSWORD', 'LIFEOS_PREVIEW_KEY_ALIAS', 'LIFEOS_PREVIEW_KEY_PASSWORD']) {
  assert.ok(gradle.includes(key), `Preview variant requires isolated signing input ${key}`);
}
assert.match(gradle, /requestsDebug && !lifeosDebugSigningReady[\s\S]*?standard debug signing is disabled/,
  'Dev artifact tasks cannot silently fall back to the shared Android debug key');
assert.match(gradle, /requestsPreview && !lifeosPreviewSigningReady/,
  'preview artifact tasks require the separate preview signer');
assert.match(gradle, /lifeosReleaseSigningReady[\s\S]*?ANDROID_KEYSTORE_PATH[\s\S]*?ANDROID_KEYSTORE_PASSWORD/,
  'release signing remains distinct from local Dev signing');
const previewManifest = fs.readFileSync('android/app/src/preview/AndroidManifest.xml', 'utf8');
const previewStrings = fs.readFileSync('android/app/src/preview/res/values/strings.xml', 'utf8');
assert.match(previewManifest, /android:allowBackup="false"/);
assert.match(previewManifest, /com\.lifeos\.personal\.preview\.SOURCE_COMMIT/);
assert.match(previewStrings, /<string name="app_name">LifeOS Preview<\/string>/);
assert.match(previewStrings, /<string name="package_name">com\.lifeos\.personal\.preview<\/string>/);
const previewBuilder = fs.readFileSync('scripts/build-preview-apk.ps1', 'utf8');
assert.match(previewBuilder, /ConvertFrom-SecureString/,
  'preview signing password is stored DPAPI-encrypted outside the repository');
assert.match(previewBuilder, /-storepass:env/);
assert.match(previewBuilder, /StartsWith\(\$repoPrefix/,
  'preview keystore and password store are rejected if configured inside the repository');
assert.doesNotMatch(previewBuilder, /LIFEOS_DEBUG_KEY_|ANDROID_KEYSTORE_PASSWORD/,
  'preview build helper never reuses Dev or release signing inputs');
assert.match(fs.readFileSync('.gitignore', 'utf8'), /\*\.dpapi/,
  'DPAPI password records are ignored if accidentally created under the repository');
assert.doesNotMatch(fs.readdirSync('android/app').join('\n'), /\.(?:keystore|jks|p12|pfx)$/i,
  'keystore material is not added to the Android project');
console.log('ANDROID SIGNING CONTRACT: Dev signing stays isolated; preview has a separate package, DPAPI-protected key and source marker; release keys remain separate.');
