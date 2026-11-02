const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/services/sessionManager.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;

const loaded = { exports: {} };
vm.runInNewContext(compiled, {
  module: loaded,
  exports: loaded.exports,
  Error,
  Object
});

const { createSessionManager, SessionLockedError } = loaded.exports;
const session = createSessionManager();

let passed = 0;
function check(condition, message) {
  assert.ok(condition, message);
  passed++;
  console.log('PASS:', message);
}

check(session.isUnlocked() === false, 'A new session starts locked');
assert.throws(() => session.assertUnlocked(), error =>
  error.code === 'LIFEOS_SESSION_LOCKED'
);
passed++;
console.log('PASS: Locked session rejects private access');

const firstToken = session.unlock();
check(session.isUnlocked(), 'Explicit unlock opens the session');
check(session.isCurrent(firstToken), 'New session generation is current');
check(session.capture() === firstToken, 'Authenticated session can capture its generation');

const lockedGeneration = session.lock();
check(!session.isUnlocked(), 'Lock immediately closes the session');
check(lockedGeneration > firstToken, 'Lock advances the session generation');
check(!session.isCurrent(firstToken), 'Lock invalidates the previous session token');

const secondToken = session.unlock();
check(secondToken > lockedGeneration, 'Re-authentication creates a fresh generation');
check(session.isCurrent(secondToken), 'Fresh authentication token is accepted');

assert.throws(() => session.assertCurrent(firstToken), error =>
  error.code === 'LIFEOS_SESSION_LOCKED'
);
passed++;
console.log('PASS: Stale authentication token is rejected');

assert.doesNotThrow(() => session.assertCurrent(secondToken));
passed++;
console.log('PASS: Current authenticated token remains valid');

console.log(`SESSION MANAGER CORE TESTS: ${passed}/12 PASSED`);

async function verifyOperationDrain() {
  const isolated = createSessionManager();
  isolated.unlock();

  isolated.beginOperation();
  assert.equal(isolated.getActiveOperationCount(), 1);

  isolated.lock();

  assert.throws(
    () => isolated.beginOperation(),
    error => error.code === 'LIFEOS_SESSION_LOCKED'
  );
  console.log('PASS: Lock immediately rejects new operation leases');

  let drained = false;
  const drain = isolated.waitForIdle().then(() => { drained = true; });

  await Promise.resolve();
  assert.equal(drained, false);
  console.log('PASS: Lock drain waits while an admitted operation is active');

  isolated.endOperation();
  await drain;

  assert.equal(drained, true);
  assert.equal(isolated.getActiveOperationCount(), 0);
  console.log('PASS: Drain resolves after the admitted operation finishes');

  assert.throws(() => isolated.endOperation(), /lease underflow/);
  console.log('PASS: Duplicate lease release is rejected');

  console.log('SESSION OPERATION DRAIN TESTS: 4/4 PASSED');
}

verifyOperationDrain().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
