'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const h = require('./tests/wp0/production-harness.cjs');
require('./scripts/register-ts-test-loader.cjs');
const { decimalToMinorUnits } = require('./src/services/financeCore.ts');
const source = ts.createSourceFile('MoneyPlanning.tsx', fs.readFileSync('src/components/MoneyPlanning.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'saveCommitment') handler = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(handler);
const js = ts.transpileModule(`const save = ${handler};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const bind = values => new Function(...Object.keys(values), `${js};return save;`)(...Object.values(values));
(async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let tail = Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(name, operation) {
    const result = tail.then(() => operation()); tail = result.catch(() => {}); return result;
  } } } });
  const f = await h.fixture();
  try {
    const category = await f.StorageService.categories.add({ name: 'Synthetic recurring edit', type: 'expense', color: '#456789' });
    const create = { title: 'Synthetic paused plan', amount: 10, amountMinor: '1000', currencyCode: 'USD', frequency: 'monthly', nextDueDate: '2020-01-31', categoryId: category.id, status: 'paused' };
    const plan = await f.StorageService.commitments.add(create);
    const inputs = [], errors = [];
    const draft = { id: plan.id, title: 'Edited while paused', amount: '12.34', currency: 'USD', frequency: 'monthly', date: plan.nextDueDate, categoryId: category.id, accountId: '', notes: '' };
    const common = { saving: false, decimalToMinorUnits, setCommitment: () => {}, setCommitmentDirty: () => {}, setError: error => errors.push(error),
      onAddCommitment: async input => inputs.push(input),
      onUpdateCommitment: async (id, input) => { inputs.push(input); await f.StorageService.commitments.update(id, input); },
    };
    await bind({ ...common, commitment: draft })({ preventDefault() {} });
    assert.equal(Object.hasOwn(inputs[0], 'status'), false, 'Ordinary edits never overwrite the latest pause state');
    const edited = (await f.StorageService.commitments.getAll()).find(row => row.id === plan.id);
    assert.equal(edited.status, 'paused'); assert.equal(edited.amountMinor, '1234'); assert.equal(edited.title, draft.title);
    await assert.rejects(f.StorageService.commitments.postOccurrence(plan.id, edited), /Resume/);
    await f.StorageService.commitments.update(plan.id, { status: 'active' });
    const resumed = (await f.StorageService.commitments.getAll()).find(row => row.id === plan.id);
    assert.equal((await f.StorageService.commitments.postOccurrence(plan.id, resumed)).amountMinor, '1234');
    const other = await f.StorageService.commitments.add({ ...create, status: 'active' });
    const openDraft = { ...draft, id: other.id };
    await f.StorageService.commitments.update(other.id, { status: 'paused' });
    await bind({ ...common, commitment: openDraft })({ preventDefault() {} });
    assert.equal((await f.StorageService.commitments.getAll()).find(row => row.id === other.id).status, 'paused', 'A pause made after draft opening survives saving');
    await bind({ ...common, commitment: { ...draft, id: undefined } })({ preventDefault() {} });
    assert.equal(inputs.at(-1).status, 'active', 'Only newly created plans start active');
    assert.ok(errors.every(error => error === ''));
    console.log('PLAN EDIT: actual save handler preserves latest paused state, exact amount, explicit resume and new-plan defaults through encrypted storage.');
  } finally {
    await f.dispose(); if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
