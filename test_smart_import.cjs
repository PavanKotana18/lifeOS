'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { pastedBankAlert, alertFingerprint, historicalAlertFingerprints } = require('./src/services/smartImport.ts');
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
for (const text of [message + ' OTP 123456', 'Bank account available balance INR 5000', 'I will send GBP 10',
  'Card debited $10.00', 'Card debited INR 1.001', 'Bank account pre-approved loan INR 50000. Apply now',
  message + '\u202E', message + '\0', ' ' .repeat(2001) + message, 'Card debited 12,34.56 USD']) {
  assert.equal(parse(text).kind, 'unrecognized');
}
assert.equal(parse(message + ' Available balance INR 5000').amount, '1250.20');
assert.equal(parse(message + ' and credited INR 400.').kind, 'ambiguous');
assert.equal(parse(message + ' EUR 400.').kind, 'ambiguous');
assert.equal(parse(message + ' Available balance INR 5000. Card debited INR 500.').kind, 'ambiguous');
for (const [text, kind, amount, date, time] of [
  ['UPI: Paid Rs.25.30 at Corner Store on 21-Nov-26 7:05 PM. UPI Ref 123456780021', 'expense', '25.30', '2026-11-21', '19:05'],
  ['UPI payment received INR 300 from demo@bank. UTR 123456780022', 'income', '300.00'],
  ['A/c XX1122 debited ₹1,20,640.57 via NEFT on 31/02/2026.', 'expense', '120640.57'],
  ['Card *2244 spent US$42.25 at Music Shop.', 'expense', '42.25'],
  ['ATM withdrawal 1000 INR on 2026-11-21T18:51:20 from account XX1122.', 'expense', '1000.00', '2026-11-21', '18:51'],
  ['Card purchased JPY 1500.', 'expense', '1500'],
  ['Card debited KWD 3.125.', 'expense', '3.125'],
  ['Card purchase of EUR 10.05 declined.', 'failed', '10.05'],
  ['Card authorization for GBP 42.00 pending.', 'pending', '42.00'],
  ['Card purchase EUR 5 authorization only.', 'pending', '5.00'],
  ['Bank refunded INR 58.24 to account XX1122.', 'refund', '58.24'],
  ['Bank account debit INR 500 reversed.', 'reversal', '500.00'],
  ['Own account transfer INR 1800 received.', 'transfer', '1800.00'],
  ['[AX-EXAMPLEBANK] UPI DR INR 45.50 at Market Lane on 2026-11-21 UPI Ref 123456789012', 'expense', '45.50', '2026-11-21'],
  ['UPI CR INR 320.00 from example@upi UTR 123456789015', 'income', '320.00'],
  ['Example Bank: Account XX1122 credited INR 40000 salary on 21/11/2026', 'income', '40000.00', '2026-11-21'],
  ['Example Bank: Card XX2200 charged INR 25.00 annual fee', 'expense', '25.00'],
]) {
  const result = parse(text);
  assert.equal(result.kind, kind, text);
  const details = result.details || result;
  assert.equal(details.amount, amount, text);
  assert.equal(details.date, date, text);
  assert.equal(details.time, time, text);
}
assert.equal(parse('Example Bank: Account XX1122 credited INR 40000 salary').description, 'Salary');
assert.equal(parse('Example Bank: Account XX1122 credited INR 100').description, undefined);
assert.equal(parse('Example Bank: Card XX2200 charged INR 25.00 annual fee').bankHint, 'Example Bank');
(async () => {
  const one = await alertFingerprint(message, suggestion);
  const alternate = message.replace('Local Cafe', 'LOCAL CAFE');
  assert.equal(await alertFingerprint(alternate, parse(alternate)), one);
  const shared = message.replace('xxxx1234', '').replace('Local Cafe', 'LOCAL CAFE');
  assert.equal(await alertFingerprint(shared, parse(shared)), one);
  const unlinked = message.replace('516232012', '516232093');
  assert.notEqual(await alertFingerprint(unlinked, parse(unlinked)), one);
  const { createHash } = require('node:crypto');
  const legacy = createHash('sha256').update('expense|INR|1250.20|2026-11-21|1234|516232012').digest('hex');
  assert.ok((await historicalAlertFingerprints(message, suggestion)).includes(legacy));
  assert.equal(one.length, 64);
  console.log('Smart Import parser and import identity checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
