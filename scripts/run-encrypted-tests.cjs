'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const suites = [
  ['test_encrypted_storage_facade.js', /ENCRYPTED STORAGE FACADE: (\d+) PASSED, 0 FAILED/, 16],
  ['test_encrypted_storage_migration.js', /MIGRATION BEHAVIOR TESTS: (\d+) PASSED/, 45],
  ['test_encrypted_transaction_coordinator.js', /ENCRYPTED TRANSACTION COORDINATOR: (\d+) PASSED/, 10],
  ['test_crypto_session_coordinator.js', /CRYPTO SESSION COORDINATOR TESTS: (\d+)\/7 PASSED/, 7]
];
function verifiedCompletion(status, stdout, pattern, minimum = 1) {
  const match = stdout.match(pattern);
  return status === 0 && !!match && Number(match[1]) >= minimum;
}
if (require.main === module) {
  for (const [file, pattern, minimum] of suites) {
    const result = spawnSync(process.execPath, [file], { cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
    process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
    if (result.error || !verifiedCompletion(result.status, result.stdout || '', pattern, minimum)) {
      console.error(`FAIL: ${file}: missing dependencies, failed assertions or missing positive completion count`, result.error?.message || '');
      process.exitCode = 1;
    }
  }
}
module.exports = { suites, verifiedCompletion };
