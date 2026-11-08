'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { classify, failsGate } = require('../tests/wp0/result-policy.cjs');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const ids = ['LOS-001'];
const mandatory = ['LOS-010', 'LOS-009', 'CONTROL-INTEGRATION', 'LOS-002', 'LOS-003', 'LOS-007', 'LOS-008', 'SPRINT1-RESTORE', 'SPRINT1-RECOVERY', 'SPRINT1-IMPORT-RACE', 'LOS-023'];
if (args[0] === '--worker') {
  // Require inside worker: any load failure exits nonzero without a success report.
  const h = require('../tests/wp0/production-harness.cjs');
  const { cases } = require('../tests/wp0/production-cases.cjs');
  const test = cases.find(t => t.id === args[1]);
  if (!test) throw new Error('Unknown regression case');
  (async () => {
    let error, completed = false;
    try { await test.run(); completed = true; }
    catch (e) { error = { code: e.code || 'UNEXPECTED_ERROR', message: e.message,
      ...(e.code === 'WP0_CONTRACT_FAILURE' ? { expected: e.expected, actual: e.actual } : { stack: e.stack }) }; }
    const result = { id: test.id, category: test.category, assertions: h.assertions(),
      status: classify({ known: test.known, completed, assertions: h.assertions(), error }), ...(error ? { error } : {}) };
    console.log('WP0_RECORD=' + JSON.stringify(result));
    if (failsGate(result.status)) process.exitCode = 1;
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const allowed = new Set(['--controls', '--strict', '--json']);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`Unknown option ${args[i]}`);
    if (args[i] === '--json' && !args[++i]) throw new Error('--json requires a path');
  }
  const selected = args.includes('--controls') ? mandatory : ids;
  const results = [];
  for (const id of selected) {
    const child = spawnSync(process.execPath, [__filename, '--worker', id],
      { cwd: root, encoding: 'utf8', timeout: 45_000, maxBuffer: 4 * 1024 * 1024 });
    const records = (child.stdout || '').split('\n').filter(line => line.startsWith('WP0_RECORD='));
    let result;
    try {
      if (records.length !== 1 || child.error || child.signal) throw new Error('Worker did not complete successfully');
      result = JSON.parse(records[0].slice('WP0_RECORD='.length));
      if (result.id !== id || !Number.isInteger(result.assertions) || result.assertions <= 0
        || !['PASS', 'KNOWN_DEFECT', 'UNEXPECTED_PASS', 'HARNESS_FAILURE'].includes(result.status)
        || child.status !== (failsGate(result.status) ? 1 : 0)) throw new Error('Invalid worker report');
    } catch (error) {
      result = { id, status: 'HARNESS_FAILURE', reason: error.message,
        stdout: child.stdout, stderr: child.stderr, exit: child.status, spawnError: child.error?.message };
    }
    results.push(result);
    console.log(`${result.status}: ${id} (${result.assertions || 0} checks)`);
    if (result.error) console.log(JSON.stringify(result.error, null, 2));
    if (result.status === 'HARNESS_FAILURE') console.error(JSON.stringify(result, null, 2));
  }
  if (!args.includes('--controls')) results.push({ id: 'LOS-003-ANDROID', status: 'BLOCKED',
    category: 'Android instrumentation required',
    reason: 'Real Activity/Keystore eviction and biometric prompt must run on isolated Android hardware/emulator; Node simulation is not device validation.' });
  let sha;
  try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { sha = 'UNAVAILABLE'; }
  const productionFiles = ['src/App.tsx', 'src/db.ts', 'src/services/notificationService.ts',
    'src/services/cryptoService.ts', 'src/services/encryptedStorageFacade.ts'];
  const report = { sourceCommit: sha, time: new Date().toISOString(), node: process.version,
    productionSha256: Object.fromEntries(productionFiles.map(file => [file,
      require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])),
    policy: 'Known acceptance failures are visible/non-blocking; harness errors and unexpected passes fail. --strict also fails known defects and blocked checks.', results };
  const j = args.indexOf('--json');
  if (j >= 0) { const dest = path.resolve(args[j + 1]); fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(report, null, 2) + '\n'); }
  console.log(JSON.stringify({ summary: results.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}) }));
  console.log('Known-defect observations are NOT passing release acceptance. See docs/testing/WP0.md.');
  if (results.some(r => failsGate(r.status, args.includes('--strict')))) process.exitCode = 1;
}
