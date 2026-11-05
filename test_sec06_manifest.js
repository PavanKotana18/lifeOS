const fs = require('fs');
const assert = require('assert');

const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
assert(
  !/<uses-permission\b[^>]*android:name=["']android\.permission\.INTERNET["']/.test(manifest),
  'SEC-06 failed: app manifest explicitly declares INTERNET'
);
console.log('SEC-06 manifest regression test: passed');
