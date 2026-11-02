const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/services/cryptoService.ts', 'utf8');

for (const field of [
  'keyProvisioned',
  'recoveryProvisioned',
  'unlocked',
  'recoveryNeedsRebind',
  'metadataConsistent',
  'keystoreAliasPresent'
]) {
  assert.match(source, new RegExp(field), `CryptoService must expose ${field}`);
}

assert.match(source, /async getKeyState\(\)/);
assert.match(source, /nativeCrypto\.getKeyState\(\)/);
assert.match(source, /Native encryption returned an invalid key state/);

console.log('CRYPTO KEY STATE API TESTS: 8/8 PASSED');
