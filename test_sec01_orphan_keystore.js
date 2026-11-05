const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const native = fs.readFileSync(
  'android/app/src/main/java/com/lifeos/personal/LifeOSCryptoPlugin.java',
  'utf8'
);

const start = app.indexOf('const pristine =');
assert.notEqual(start, -1, 'Startup pristine-state guard must exist');

const end = app.indexOf('if (!pristine)', start);
assert.notEqual(end, -1, 'Startup guard boundary must exist');

const guard = app.slice(start, end);

assert.match(guard, /!keyState\.recoveryProvisioned/);
assert.match(guard, /!keyState\.unlocked/);
assert.doesNotMatch(
  guard,
  /!keyState\.keystoreAliasPresent/,
  'An orphaned alias must not block safe setup'
);

assert.match(
  app,
  /if \(!keyState\.metadataConsistent \|\| keyState\.recoveryNeedsRebind\)/,
  'Inconsistent metadata and pending recovery must remain blocked'
);

const setupStart = native.indexOf('public void setup(PluginCall call)');
assert.notEqual(setupStart, -1);
const setupEnd = native.indexOf('@PluginMethod\n    public void unlock', setupStart);
assert.notEqual(setupEnd, -1);
const setup = native.slice(setupStart, setupEnd);

assert.match(setup, /getOrCreateMasterKey\(\)/);
assert.match(setup, /existingWrapped != null \|\| existingIv != null/);
assert.match(
  setup,
  /Refusing to replace the existing key/,
  'Existing wrapped database keys must remain protected'
);

console.log('SEC-01 orphaned Keystore alias regression tests: all passed');
