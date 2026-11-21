'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { pastedBankAlert, alertFingerprint } = require('./src/services/smartImport.ts');
const parse = text => pastedBankAlert.parse(text);
const message = 'Bank account xxxx1234 debited INR 1,250.20 at Local Cafe on 21/11/2026 Ref 516232012';
const suggestion = parse(message);
assert.equal(suggestion.kind, 'expense');
assert.equal(suggestion.amount, '1250.20');
assert.equal(suggestion.accountHint, '1234');
assert.equal(suggestion.date, '2026-11-21');
assert.equal(suggestion.reference, '516232012');
assert.equal(suggestion.description, 'Local Cafe');
const international = parse('Bank account credited USD 20.25 on 2026-11-21 09:15');
assert.equal(international.kind, 'income');
assert.equal(international.time, '09:15');
for (const [kind, suffix] of [['pending', 'pending'], ['failed', 'failed'], ['refund', 'refund'], ['reversal', 'reversed'], ['transfer', 'fund transfer']]) {
  assert.equal(parse(message + ' ' + suffix).kind, kind);
}
for (const text of [message + ' OTP 123456', message + ' Available balance INR 5000', 'I will send GBP 10', 'Card debited $10.00', 'Card debited INR 1.001']) {
  assert.equal(parse(text).kind, 'unrecognized');
}
(async () => {
  const one = await alertFingerprint(message, suggestion);
  const alternate = message.replace('Local Cafe', 'LOCAL CAFE');
  assert.equal(await alertFingerprint(alternate, parse(alternate)), one);
  assert.equal(one.length, 64);
  console.log('Smart Import parser and import identity checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
