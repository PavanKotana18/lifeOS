'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const { buildDuplicateTransactionDraft } = require('./src/services/transactionDraft.ts');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const defaults = { title: '', amount: '', category: 'Food', type: 'expense', date: '2026-11-07', dateTime: '2026-11-07T13:45', paymentMethod: 'Other', notes: '', isRecurring: '' };
const original = { id: 'synthetic-old-id', createdAt: '2020-01-01T00:00:00.000Z', type: 'income', amount: 1250.5,
  category: 'Salary', description: 'Contract work', date: '2024-04-03', occurredAt: '2024-04-03T08:15:00.000Z',
  paymentMethod: 'Bank transfer', notes: 'Quarterly invoice', isRecurring: true };
const draft = buildDuplicateTransactionDraft(defaults, original);
assert.equal(draft.title, 'Contract work');
assert.equal(draft.amount, '1250.5');
assert.equal(draft.category, 'Salary');
assert.equal(draft.type, 'income');
assert.equal(draft.paymentMethod, 'Bank transfer');
assert.equal(draft.notes, 'Quarterly invoice');
assert.equal(draft.isRecurring, 'yes');
assert.equal(draft.date, defaults.date, 'duplicate gets the current new-entry date');
assert.equal(draft.dateTime, defaults.dateTime, 'duplicate gets the current new-entry time, not source history');
assert.equal(Object.hasOwn(draft, 'id'), false);
assert.equal(Object.hasOwn(draft, 'createdAt'), false);

const legacy = { id: 'legacy-id', createdAt: '2010-01-01T00:00:00.000Z', type: 'expense', amount: 20, category: 'Food', description: '', date: '2012-03-04' };
const legacyDraft = buildDuplicateTransactionDraft(defaults, legacy);
assert.equal(legacyDraft.dateTime, defaults.dateTime, 'date-only legacy transaction does not synthesize its historic time');
assert.equal(legacyDraft.title, '', 'blank description remains blank');
assert.match(app, /openDuplicateTransaction/);
assert.match(app, /Duplicate transaction/);
assert.match(app, /Delete transaction/);
assert.match(app, /if \(!\(await confirmAction\(\{ title: 'Delete this transaction\?'/,
  'transaction deletion uses the shared accessible confirmation before mutating storage');
assert.match(app, /StorageService\.transactions\.delete\(editingTransactionId\)/,
  'the existing transaction delete action remains connected after confirmation');
assert.doesNotMatch(app, /window\.confirm\(/,
  'native browser confirmations are not used for app-level transaction actions');
console.log('TRANSACTION DUPLICATE: 17 service and UI contracts passed with synthetic records.');
