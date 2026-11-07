'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const finance = require('./src/services/financeCore.ts');

assert.equal(finance.CURRENCY_CATALOG_VERSION, 'lifeos-iso4217-snapshot-2026-11-v2');
assert.equal(Object.keys(finance.CURRENCY_CATALOG).length, 162);
assert.equal(finance.getCurrencyMetadata('inr').fractionDigits, 2);
assert.equal(finance.getCurrencyMetadata('AED').fractionDigits, 2);
assert.equal(finance.getCurrencyMetadata('XCG').fractionDigits, 2);
assert.equal(finance.getCurrencyMetadata('AFN').fractionDigits, 0);
assert.equal(finance.getCurrencyMetadata('JPY').fractionDigits, 0);
assert.equal(finance.getCurrencyMetadata('KWD').fractionDigits, 3);
assert.throws(() => finance.getCurrencyMetadata('XYZ'), /Unsupported currency/);
assert.equal(finance.convertMinorUnits(100n, 'USD', 'INR', '83.125'), 8313n);
assert.equal(finance.convertMinorUnits(-100n, 'USD', 'INR', '83.125'), -8313n);
assert.equal(finance.convertMinorUnits(100n, 'USD', 'JPY', '1.5'), 2n);
assert.throws(() => finance.convertMinorUnits(100n, 'USD', 'INR', '0'), /greater than zero/);
assert.throws(() => finance.convertMinorUnits(100n, 'USD', 'INR', '83.123456789'), /up to eight decimal places/);
assert.deepEqual(finance.assessExchangeRateFreshness('2026-10-24', '2026-10-31'), { ageDays: 7, freshness: 'current' });
assert.deepEqual(finance.assessExchangeRateFreshness('2026-10-23', '2026-10-31'), { ageDays: 8, freshness: 'stale' });
assert.throws(() => finance.assessExchangeRateFreshness('2026-11-01', '2026-10-31'), /cannot be in the future/);
assert.throws(() => finance.assessExchangeRateFreshness('2026-02-30', '2026-10-31'), /valid calendar date/);

assert.equal(finance.decimalToMinorUnits('0.10', 'USD'), 10n);
assert.equal(finance.decimalToMinorUnits('0.20', 'USD'), 20n);
assert.equal(finance.decimalToMinorUnits('1.005', 'USD'), 101n); // ties away from zero
assert.equal(finance.decimalToMinorUnits('-1.005', 'USD'), -101n);
assert.equal(finance.decimalToMinorUnits('1.5', 'JPY'), 2n);
assert.equal(finance.decimalToMinorUnits('1.2345', 'KWD'), 1235n);
assert.equal(finance.decimalToMinorUnits('1e3', 'USD'), 100000n);
assert.equal(finance.minorUnitsToDecimal(-123456n, 'INR'), '-1234.56');
assert.equal(finance.minorUnitsToDecimal(123456n, 'JPY'), '123456');
assert.equal(finance.serializeMinorUnits(900719925474099312345n), '900719925474099312345');
assert.equal(finance.sumMinorUnits([10n, 20n, 900719925474099312345n]), 900719925474099312375n);
assert.equal(finance.subtractMinorUnits(finance.addMinorUnits(10n, 20n), 5n), 25n);
assert.throws(() => finance.sumMinorUnits([1n, 2]), /BigInt/);
assert.throws(() => finance.decimalToMinorUnits('NaN', 'USD'), /finite decimal/);
assert.throws(() => finance.decimalToMinorUnits('1.00', 'XXX'), /Unsupported currency/);

const exactLarge = 900719925474099312345n;
const formattedLarge = finance.formatMinorUnits(exactLarge, 'USD', 'en-US');
assert.match(formattedLarge, /9,007,199,254,740,993,123\.45/);
assert.equal(finance.formatMinorUnits(12345678n, 'INR', 'en-IN'), '₹1,23,456.78');
assert.equal(finance.formatMinorUnits(-123n, 'JPY', 'ja-JP'), '-￥123');
const originalNumberFormat = Intl.NumberFormat;
try {
  Intl.NumberFormat = function(locale, options) {
    if (options?.style === 'currency' && options.currency === 'XCG') throw new RangeError('simulated older Android ICU currency data');
    return new originalNumberFormat(locale, options);
  };
  const fallbackCurrency = finance.formatMinorUnits(12345n, 'XCG', 'en-US');
  assert.ok(fallbackCurrency.startsWith('XCG'), 'unknown-to-runtime currency symbols retain the code');
  assert.match(fallbackCurrency, /123\.45/, 'older ICU fallback preserves exact localized monetary digits');
} finally {
  Intl.NumberFormat = originalNumberFormat;
}

const noReturn = finance.projectSavings({
  startingMinorUnits: 5000n, monthlyContributionMinorUnits: 10000n, months: 12,
  annualReturnBasisPoints: 0, annualInflationBasisPoints: 0,
});
assert.equal(noReturn.projectedMinorUnits, 125000n);
assert.equal(noReturn.contributedMinorUnits, 125000n);
assert.equal(noReturn.growthMinorUnits, 0n);
assert.equal(noReturn.realProjectedMinorUnits, 125000n);

const compound = finance.projectSavings({
  startingMinorUnits: 100000n, monthlyContributionMinorUnits: 0n, months: 12,
  annualReturnBasisPoints: 1200, annualInflationBasisPoints: 300,
});
assert.equal(compound.projectedMinorUnits, 112684n);
assert.ok(compound.realProjectedMinorUnits < compound.projectedMinorUnits);
assert.equal(compound.contributedMinorUnits, 100000n);

const stepped = finance.projectSavings({
  startingMinorUnits: 0n, monthlyContributionMinorUnits: 10000n, months: 12,
  annualReturnBasisPoints: 0, annualInflationBasisPoints: 0,
  contributionStepUpMonths: 6, contributionStepUpBasisPoints: 1000,
});
assert.equal(stepped.contributedMinorUnits, 126000n);
assert.equal(stepped.projectedMinorUnits, 126000n);

const scenarioInputs = {
  startingMinorUnits: 100000n, monthlyContributionMinorUnits: 10000n, months: 36,
  annualReturnBasisPoints: 500, annualInflationBasisPoints: 300,
};
const scenarioA = finance.projectSavings(scenarioInputs);
const scenarioB = finance.projectSavings({ ...scenarioInputs, annualReturnBasisPoints: 700 });
assert.ok(scenarioB.projectedMinorUnits > scenarioA.projectedMinorUnits);
assert.equal(scenarioA.contributedMinorUnits, scenarioB.contributedMinorUnits);
const longDeflation = finance.projectSavings({
  startingMinorUnits: 1n, monthlyContributionMinorUnits: 0n, months: 1200,
  annualReturnBasisPoints: 0, annualInflationBasisPoints: -119999,
});
assert.ok(longDeflation.realProjectedMinorUnits > 0n);

for (const input of [
  { startingMinorUnits: -1n, monthlyContributionMinorUnits: 0n, months: 12, annualReturnBasisPoints: 0, annualInflationBasisPoints: 0 },
  { startingMinorUnits: 0n, monthlyContributionMinorUnits: 0n, months: 0, annualReturnBasisPoints: 0, annualInflationBasisPoints: 0 },
  { startingMinorUnits: 0n, monthlyContributionMinorUnits: 0n, months: 12, annualReturnBasisPoints: -120000, annualInflationBasisPoints: 0 },
]) assert.throws(() => finance.projectSavings(input));

console.log('FINANCE CORE: 53 assertions passed; calculations use integer minor units and synthetic inputs only.');
