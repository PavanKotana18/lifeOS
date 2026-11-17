'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
require('./scripts/register-ts-test-loader.cjs');
const { advanceCommitmentDate } = require('./src/services/commitmentRecurrence.ts');

const cases = [
  ['2026-01-31', 'monthly', undefined, '2026-02-28'],
  ['2026-02-28', 'monthly', '2026-01-31', '2026-03-31'],
  ['2026-03-31', 'monthly', '2026-01-31', '2026-04-30'],
  ['2026-04-30', 'monthly', '2026-01-31', '2026-05-31'],
  ['2028-01-31', 'monthly', undefined, '2028-02-29'],
  ['2028-02-29', 'monthly', '2028-01-31', '2028-03-31'],
  ['2026-12-30', 'monthly', undefined, '2027-01-30'],
  ['2026-02-28', 'monthly', undefined, '2026-03-28'],
  ['2024-02-29', 'yearly', undefined, '2025-02-28'],
  ['2025-02-28', 'yearly', '2024-02-29', '2026-02-28'],
  ['2027-02-28', 'yearly', '2024-02-29', '2028-02-29'],
  ['2099-02-28', 'yearly', '2096-02-29', '2100-02-28'],
  ['2399-02-28', 'yearly', '2396-02-29', '2400-02-29'],
  ['2026-12-28', 'weekly', undefined, '2027-01-04'],
  ['2028-02-25', 'weekly', undefined, '2028-03-03'],
  ['2026-03-06', 'weekly', undefined, '2026-03-13'],
  ['2026-10-30', 'weekly', undefined, '2026-11-06'],
];
for (const [date, frequency, anchor, expected] of cases) {
  assert.equal(advanceCommitmentDate(date, frequency, anchor), expected, `${date} ${frequency} anchor=${anchor}`);
}
for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01', '0000-01-01', '2026-01-01T00:00:00Z', '', null]) {
  assert.throws(() => advanceCommitmentDate(date, 'monthly'), /valid local calendar date/);
}
assert.throws(() => advanceCommitmentDate('2026-01-31', 'monthly', '2026-02-30'), /valid local calendar date/);
assert.throws(() => advanceCommitmentDate('2026-01-31', 'daily'), /Unsupported commitment frequency/);
for (const [date, frequency] of [['9999-12-31', 'monthly'], ['9999-12-31', 'weekly'], ['9999-01-01', 'yearly']]) {
  assert.throws(() => advanceCommitmentDate(date, frequency), /supported calendar range/);
}

// Exercise actual helper code in separate processes, rather than changing the
// current process timezone after Date internals may already have cached it.
const timezoneProbe = `require('./scripts/register-ts-test-loader.cjs'); const f=require('./src/services/commitmentRecurrence.ts').advanceCommitmentDate; process.stdout.write(JSON.stringify([f('2026-03-06','weekly'),f('2026-10-30','weekly'),f('2026-02-28','monthly','2026-01-31')]));`;
for (const timezone of ['Asia/Kolkata', 'America/New_York', 'Pacific/Auckland', 'UTC']) {
  const actual = execFileSync(process.execPath, ['-e', timezoneProbe], {
    cwd: __dirname, env: { ...process.env, TZ: timezone }, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  assert.deepEqual(JSON.parse(actual), ['2026-03-13', '2026-11-06', '2026-03-31'], timezone);
}
console.log('COMMITMENT RECURRENCE: calendar boundaries, stable anchors, invalid inputs, overflow and timezone invariance passed.');
