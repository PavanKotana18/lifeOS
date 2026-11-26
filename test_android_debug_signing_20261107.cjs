'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const gradle = fs.readFileSync('android/app/build.gradle', 'utf8').replace(/\r\n/g, '\n');
assert.match(gradle, /applicationId "com\.lifeos\.personal"/);
assert.match(gradle, /debug\s*\{\s*applicationIdSuffix "\.debug"\s*versionNameSuffix "-debug"/,
  'standard Debug uses a new isolated package and debug label suffix');
assert.match(fs.readFileSync('android/app/src/debug/res/values/strings.xml', 'utf8'), /<string name="app_name">BusyDoo Debug<\/string>/);
assert.doesNotMatch(gradle, /lifeosDebugSigningReady|LIFEOS_DEBUG_KEYSTORE|\.dev"|\.preview"|buildType.*preview/i,
  'Debug does not require lost Dev credentials and Preview is no longer a build type');
assert.match(gradle, /def lifeosReleaseSigningReady[\s\S]*?ANDROID_KEYSTORE_PATH[\s\S]*?ANDROID_KEYSTORE_PASSWORD/,
  'Release uses only production signing credentials');
assert.match(gradle, /requestsRelease && !lifeosReleaseSigningReady[\s\S]*?debug signing is never used for Release/,
  'Release artifact tasks fail closed when production signing is unavailable');
assert.doesNotMatch(gradle, /signingConfig signingConfigs\.debug/, 'Release never falls back to the Android debug signer');
const workflow = fs.readFileSync('.github/workflows/build-apk.yml', 'utf8');
const emulatorWorkflow = fs.readFileSync('.github/workflows/android-emulator-qa.yml', 'utf8');
const debugFloor = Number(fs.readFileSync('android/debug-version-floor.txt', 'utf8').trim());
assert.ok(Number.isSafeInteger(debugFloor) && debugFloor >= 1000241);
assert.match(gradle, /withBuildType\('debug'\)[\s\S]*?output\.versionCode\.set\(debugVersionCode\)/);
assert.match(workflow, /LIFEOS_ANDROID_DEBUG_BUILD_NUMBER: \$\{\{ github\.run_number \}\}/);
assert.doesNotMatch(emulatorWorkflow, /LIFEOS_ANDROID_DEBUG_BUILD_NUMBER|GITHUB_RUN_NUMBER/);
for (const standardBuild of [workflow, emulatorWorkflow]) {
  assert.match(standardBuild, /dump permissions[\s\S]*?Standard Debug APK declares an SMS permission/);
}
assert.match(workflow, /build_release:[\s\S]*?type: boolean[\s\S]*?default: false/,
  'Release artifact creation is an explicit manual workflow choice');
assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.build_release == true/,
  'push and pull request builds do not create Release artifacts');
assert.equal(fs.existsSync('scripts/build-preview-apk.ps1'), false, 'custom Android Preview build helper is removed');
assert.equal(fs.existsSync('android/app/src/preview/AndroidManifest.xml'), false, 'custom Android Preview source set is removed');
assert.doesNotMatch(fs.readFileSync('package.json', 'utf8'), /build:preview/);
assert.doesNotMatch(gradle, /LIFEOS_PREVIEW_KEYSTORE|LIFEOS_DEBUG_KEYSTORE/,
  'old signing secrets are not required by either standard build type');
assert.doesNotMatch(fs.readdirSync('android/app').join('\n'), /\.(?:keystore|jks|p12|pfx)$/i,
  'signing material is not added to the Android project');
console.log('ANDROID BUILD CONTRACT: isolated BusyDoo Debug package; production-only, manually approved Release; no Preview build path.');
