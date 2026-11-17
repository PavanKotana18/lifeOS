'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, 'src/services/commitmentWriteLock.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function isolatedContext(locks) {
  const context = { exports: {} };
  if (locks !== undefined) context.navigator = { locks };
  vm.runInNewContext(compiled, context, { filename: 'commitmentWriteLock.cjs' });
  return context.exports.withCommitmentWriteLock;
}

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

function fifoLockManager() {
  let tail = Promise.resolve();
  const requests = [];
  return {
    requests,
    request(name, callback) {
      requests.push(name);
      const result = tail.then(() => callback({ name, mode: 'exclusive' }));
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

(async () => {
  const manager = fifoLockManager();
  const tabA = isolatedContext(manager);
  const tabB = isolatedContext(manager);
  assert.notEqual(tabA, tabB, 'writers must execute independently loaded helper modules');
  const entered = deferred();
  const releasePost = deferred();
  const events = [];
  let plan = { due: '2026-11-01', title: 'Synthetic plan' };
  const post = tabA(async () => {
    const before = { ...plan };
    events.push('post-read');
    entered.resolve();
    // Simulate asynchronous encryption before an atomic occurrence commit.
    await releasePost.promise;
    plan = { ...before, due: '2026-12-01' };
    events.push('post-commit');
    return 'posted';
  }, true);
  await entered.promise;
  const edit = tabB(async () => {
    events.push('edit-read');
    assert.equal(plan.due, '2026-12-01', 'other context must read the committed post state');
    plan = { ...plan, title: 'Edited after posting' };
    events.push('edit-commit');
    return 'edited';
  });
  await Promise.resolve();
  assert.deepEqual(events, ['post-read'], 'edit must wait through post encryption and commit');
  releasePost.resolve();
  assert.deepEqual(await Promise.all([post, edit]), ['posted', 'edited']);
  assert.deepEqual(events, ['post-read', 'post-commit', 'edit-read', 'edit-commit']);
  assert.deepEqual(plan, { due: '2026-12-01', title: 'Edited after posting' });
  assert.deepEqual(manager.requests, ['lifeos-encrypted-storage-writes', 'lifeos-encrypted-storage-writes']);

  // A failure must release the lock, propagate, and allow a queued context in.
  await assert.rejects(tabA(async () => { throw new Error('synthetic encryption failure'); }, true), /synthetic encryption failure/);
  assert.equal(await tabB(async () => 'lock released', true), 'lock released');

  const unavailable = isolatedContext();
  let writes = 0;
  await assert.rejects(unavailable(async () => { writes += 1; }, true), /does not support safe recurring posting/);
  assert.equal(writes, 0, 'unsupported posting must fail before any write operation');
  assert.equal(await unavailable(async () => { writes += 1; return 'legacy planning'; }), 'legacy planning');
  assert.equal(writes, 1, 'legacy planning CRUD keeps its explicit fallback');
  await assert.rejects(unavailable(async () => { throw new Error('legacy write failure'); }), /legacy write failure/);

  const denied = isolatedContext({ request: async () => { throw new Error('lock permission denied'); } });
  for (const requireCrossContext of [false, true]) {
    await assert.rejects(denied(async () => { writes += 1; }, requireCrossContext), /lock permission denied/);
  }
  assert.equal(writes, 1, 'a rejected lock request must never retry the operation unlocked');
  console.log('COMMITMENT WRITE LOCK: independent-context post/edit serialization, failure release, unsupported posting refusal and no unlocked retry passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
