const fs = require('node:fs');
const assert = require('node:assert/strict');

const service = fs.readFileSync('src/services/backupCryptoService.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.match(service, /PBKDF2-HMAC-SHA-256/);
assert.match(service, /iterations:\s*ITERATIONS/);
assert.match(service, /310000/);
assert.match(service, /AES-GCM/);
assert.match(service, /tagLength:\s*128/);
assert.match(service, /additionalData/);
assert.match(service, /crypto\.getRandomValues/);
assert.match(service, /Plaintext backups are not accepted/);
assert.match(service, /TextDecoder\('utf-8',\s*\{\s*fatal:\s*true\s*\}\)/);
assert.match(app, /encryptBackup\(json,\s*passphrase\)/);
assert.match(app, /decryptBackup\(text,\s*passphrase\)/);
assert.match(app, /passphrase !== confirmation/);
assert.match(app, /lifeos-encrypted-backup-/);
assert.match(app, /passphrase-protected encrypted backup/);

console.log('BACKUP CRYPTO SOURCE TESTS: 14/14 PASSED');
