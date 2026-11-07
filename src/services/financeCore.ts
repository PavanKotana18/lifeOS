/** Versioned currency metadata used by offline financial calculations. */
export const CURRENCY_CATALOG_VERSION = 'lifeos-iso4217-subset-v1';

export interface CurrencyMetadata {
  code: string;
  fractionDigits: 0 | 2 | 3;
}

// The catalog intentionally lists supported codes explicitly. Unknown or
// misspelled codes are rejected instead of silently receiving two decimals.
const currencyRows: CurrencyMetadata[] = [
  ...['AUD','CAD','CHF','CNY','EUR','GBP','HKD','INR','MXN','NZD','SGD','USD','ZAR'].map(code => ({ code, fractionDigits: 2 as const })),
  ...['BIF','CLP','DJF','GNF','ISK','JPY','KMF','KRW','PYG','RWF','UGX','UYI','VND','VUV','XAF','XOF','XPF'].map(code => ({ code, fractionDigits: 0 as const })),
  ...['BHD','IQD','JOD','KWD','LYD','OMR','TND'].map(code => ({ code, fractionDigits: 3 as const })),
];

export const CURRENCY_CATALOG: Readonly<Record<string, CurrencyMetadata>> = Object.freeze(
  Object.fromEntries(currencyRows.map(row => [row.code, Object.freeze(row)]))
);

export function getCurrencyMetadata(code: string): CurrencyMetadata {
  const normalized = String(code || '').toUpperCase();
  const metadata = CURRENCY_CATALOG[normalized];
  if (!metadata) throw new RangeError(`Unsupported currency code: ${normalized || '(empty)'}`);
  return metadata;
}

const pow10 = (digits: number) => 10n ** BigInt(digits);
const MAX_INPUT_DIGITS = 128;

/** Parse decimal text into integer minor units, rounding ties away from zero. */
export function decimalToMinorUnits(value: string | number, currencyCode: string): bigint {
  const { fractionDigits } = getCurrencyMetadata(currencyCode);
  const text = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
  if (!match || text.length > MAX_INPUT_DIGITS) throw new TypeError('Enter a finite decimal monetary amount.');
  const negative = match[1] === '-';
  const whole = match[2];
  const fraction = match[3] || '';
  const exponent = Number(match[4] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > MAX_INPUT_DIGITS) throw new RangeError('Monetary exponent is out of range.');
  const digits = `${whole}${fraction}`;
  let magnitude = BigInt(digits);
  const decimalPlaces = fraction.length - exponent;
  const shift = fractionDigits - decimalPlaces;
  if (shift >= 0) magnitude *= pow10(shift);
  else {
    const divisor = pow10(-shift);
    const quotient = magnitude / divisor;
    const remainder = magnitude % divisor;
    magnitude = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  }
  return negative && magnitude !== 0n ? -magnitude : magnitude;
}

export function minorUnitsToDecimal(minorUnits: bigint, currencyCode: string): string {
  const { fractionDigits } = getCurrencyMetadata(currencyCode);
  const negative = minorUnits < 0n;
  const magnitude = negative ? -minorUnits : minorUnits;
  const divisor = pow10(fractionDigits);
  const whole = magnitude / divisor;
  if (fractionDigits === 0) return `${negative ? '-' : ''}${whole}`;
  const fraction = String(magnitude % divisor).padStart(fractionDigits, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function serializeMinorUnits(minorUnits: bigint): string {
  return minorUnits.toString(10);
}

export function addMinorUnits(left: bigint, right: bigint): bigint { return left + right; }
export function subtractMinorUnits(left: bigint, right: bigint): bigint { return left - right; }
export function sumMinorUnits(values: Iterable<bigint>): bigint {
  let total = 0n;
  for (const value of values) {
    if (typeof value !== 'bigint') throw new TypeError('Minor-unit sums require integer BigInt values.');
    total += value;
  }
  return total;
}

/** Locale formatting that keeps the amount exact even beyond Number precision. */
export function formatMinorUnits(minorUnits: bigint, currencyCode: string, locale = 'en-IN'): string {
  const { fractionDigits } = getCurrencyMetadata(currencyCode);
  const negative = minorUnits < 0n;
  const magnitude = negative ? -minorUnits : minorUnits;
  const divisor = pow10(fractionDigits);
  const whole = magnitude / divisor;
  const fraction = magnitude % divisor;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency', currency: currencyCode, minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const parts = formatter.formatToParts(negative ? -1n : 1n);
  const groupedWhole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(whole);
  return parts.map(part => {
    if (part.type === 'integer') return groupedWhole;
    if (part.type === 'fraction') return String(fraction).padStart(fractionDigits, '0');
    return part.value;
  }).join('');
}

const RATE_DENOMINATOR = 120_000n; // 12 months * 10,000 basis points per 100%.

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('Denominator must be positive.');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return quotient + (remainder * 2n >= denominator ? 1n : 0n);
}

export interface SavingsProjectionInput {
  startingMinorUnits: bigint;
  monthlyContributionMinorUnits: bigint;
  months: number;
  /** Annual nominal rate in basis points; 750 means 7.50%. */
  annualReturnBasisPoints: number;
  /** Annual inflation in basis points; 300 means 3.00%. */
  annualInflationBasisPoints: number;
  contributionStepUpMonths?: number;
  /** Contribution increase in basis points; 1000 means 10%. */
  contributionStepUpBasisPoints?: number;
}

export interface SavingsProjection {
  projectedMinorUnits: bigint;
  realProjectedMinorUnits: bigint;
  contributedMinorUnits: bigint;
  growthMinorUnits: bigint;
}

/**
 * End-of-month contributions and nominal APR/12 compounding. Every currency
 * amount remains integer minor units; monthly interest rounds half up.
 * Inflation is also applied monthly at annual rate/12 and is an estimate.
 */
export function projectSavings(input: SavingsProjectionInput): SavingsProjection {
  const { startingMinorUnits, monthlyContributionMinorUnits, months } = input;
  const stepMonths = input.contributionStepUpMonths || 0;
  const stepBps = input.contributionStepUpBasisPoints || 0;
  const { annualReturnBasisPoints: returnBps, annualInflationBasisPoints: inflationBps } = input;
  if (startingMinorUnits < 0n || monthlyContributionMinorUnits < 0n) throw new RangeError('Savings amounts cannot be negative.');
  if (!Number.isInteger(months) || months < 1 || months > 1200) throw new RangeError('Projection duration must be between 1 and 1200 months.');
  if (!Number.isInteger(returnBps) || returnBps <= -120_000 || returnBps > 1_000_000) throw new RangeError('Annual return must be greater than -100% and no more than 10,000%.');
  if (!Number.isInteger(inflationBps) || inflationBps <= -120_000 || inflationBps > 1_000_000) throw new RangeError('Annual inflation must be greater than -100% and no more than 10,000%.');
  if (stepMonths !== 0 && (!Number.isInteger(stepMonths) || stepMonths < 1 || stepMonths > 1200)) throw new RangeError('Contribution step-up interval is invalid.');
  if (!Number.isInteger(stepBps) || stepBps < 0 || stepBps > 1_000_000) throw new RangeError('Contribution step-up is invalid.');

  const returnNumerator = RATE_DENOMINATOR + BigInt(returnBps);
  const inflationNumerator = RATE_DENOMINATOR + BigInt(inflationBps);
  let balance = startingMinorUnits;
  let contribution = monthlyContributionMinorUnits;
  let contributed = startingMinorUnits;
  for (let month = 1; month <= months; month++) {
    balance = divideHalfUp(balance * returnNumerator, RATE_DENOMINATOR) + contribution;
    contributed += contribution;
    if (stepMonths > 0 && month % stepMonths === 0 && month < months) {
      contribution = divideHalfUp(contribution * BigInt(10_000 + stepBps), 10_000n);
    }
  }
  // Keep the inflation ratio as exact integer powers. Rounding an index each
  // month can underflow to zero for high-deflation, long-horizon scenarios.
  const real = divideHalfUp(
    balance * (RATE_DENOMINATOR ** BigInt(months)),
    (inflationNumerator ** BigInt(months))
  );
  return {
    projectedMinorUnits: balance,
    realProjectedMinorUnits: real,
    contributedMinorUnits: contributed,
    growthMinorUnits: balance - contributed,
  };
}
