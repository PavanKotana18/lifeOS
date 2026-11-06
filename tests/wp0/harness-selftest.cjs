'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { classify, failsGate } = require('./result-policy.cjs');
const { verifiedCompletion, suites } = require('../../scripts/run-encrypted-tests.cjs');
let count = 0;
function eq(a, b) { assert.deepEqual(a, b); count++; }
eq(classify({ known: true, completed: false, assertions: 1, error: { code: 'WP0_CONTRACT_FAILURE' } }), 'KNOWN_DEFECT');
eq(classify({ known: true, completed: false, assertions: 1, error: { code: 'MODULE_NOT_FOUND' } }), 'HARNESS_FAILURE');
eq(classify({ known: true, completed: true, assertions: 0 }), 'HARNESS_FAILURE');
eq(classify({ known: true, completed: true, assertions: 1 }), 'UNEXPECTED_PASS');
eq(classify({ known: false, completed: true, assertions: 1 }), 'PASS');
eq(failsGate('KNOWN_DEFECT'), false);
eq(failsGate('KNOWN_DEFECT', true), true);
eq(failsGate('BLOCKED', true), true);
eq(failsGate('HARNESS_FAILURE'), true);
eq(failsGate('UNEXPECTED_PASS'), true);
eq(verifiedCompletion(0, 'DONE: 0', /DONE: (\d+)/), false);
eq(verifiedCompletion(0, 'DONE: 1', /DONE: (\d+)/, 7), false);
eq(verifiedCompletion(0, 'DONE: 7', /DONE: (\d+)/, 7), true);
const { noopSetters, appFunction, buttonHandler } = require('./production-harness.cjs');
const substitutions = noopSetters('() => { setAppReady(true); setTimeout(() => {}, 1); }');
eq(typeof substitutions.setAppReady, 'function');
eq(Object.hasOwn(substitutions, 'setTimeout'), false);
assert.throws(() => appFunction('wp0MissingHandler'), /exactly one/); count++;
assert.throws(() => buttonHandler('wp0MissingButton'), /exactly one/); count++;
const inventory = require('./test-inventory.json');
const root = path.resolve(__dirname, '../..');
for (const test of inventory.tests) {
  assert.ok(fs.existsSync(path.join(root, test.path)), `Missing inventoried test ${test.path}`);
  assert.ok(test.categories.length && test.categories.every(c => inventory.categories.includes(c)));
  count += 2;
}
for (const file of fs.readdirSync(root).filter(f => /^test_.*\.js$/.test(f))) {
  assert.ok(inventory.tests.some(t => t.path === file), `Unclassified root test ${file}`); count++;
}
for (const [, pattern] of suites) {
  eq(verifiedCompletion(0, '', pattern), false);
  eq(verifiedCompletion(1, 'PASS', pattern), false);
}
// Real child executions: injected missing runtime dependencies must fail all4
// suites, not silently return PASS or skip. No package installation/removal.
for (const [file, dep] of [
  ['test_encrypted_storage_facade.js', 'esbuild'],
  ['test_encrypted_storage_migration.js', 'typescript'],
  ['test_encrypted_transaction_coordinator.js', 'dexie'],
  ['test_crypto_session_coordinator.js', 'typescript']
]) {
  const code = `const M=require('node:module'),load=M._load; M._load=function(id,...rest){
    if(id===${JSON.stringify(dep)}){const e=new Error('WP0_INJECTED_MISSING_DEPENDENCY');e.code='MODULE_NOT_FOUND';throw e;}
    return load.call(this,id,...rest);};require(${JSON.stringify('./' + file)});`;
  const child = spawnSync(process.execPath, ['-e', code], { cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8', timeout: 30_000 });
  assert.ok(!child.error && child.status !== 0, `${file} incorrectly passed unavailable dependency`);
  assert.match(child.stderr + child.stdout, /WP0_INJECTED_MISSING_DEPENDENCY/);
  count += 2;
}
console.log(`WP0 HARNESS SELFTEST: ${count} checks passed (including missing-dependency fault injection)`);
