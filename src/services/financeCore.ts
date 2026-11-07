/** Versioned currency metadata used by offline financial calculations. */
export const CURRENCY_CATALOG_VERSION = 'lifeos-iso4217-snapshot-2026-11-v2';

export interface CurrencyMetadata {
  code: string;
  fractionDigits: 0 | 2 | 3;
}

// Frozen offline snapshot of the 162 ISO currency identifiers available from
// Node 24.17.0 / ICU 78.3 Intl.supportedValuesOf('currency'); minor units come
// from Intl.NumberFormat's resolved currency fraction digits. Keep this data
// versioned so a future refresh is deliberate and legacy values stay stable.
// Unknown or misspelled codes are rejected instead of assuming two decimals.
const currencyRows: CurrencyMetadata[] = [
  ...['AED','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CNY','CRC','CUC','CUP','CVE','CZK','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GTQ','GYD','HKD','HNL','HRK','HTG','ILS','INR','JMD','KES','KGS','KHR','KYD','KZT','LKR','LRD','LSL','MAD','MDL','MKD','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','PAB','PEN','PGK','PHP','PLN','QAR','RON','RSD','RUB','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SRD','SSP','STN','SVC','SZL','THB','TJS','TMT','TOP','TRY','TTD','TWD','TZS','UAH','USD','UYU','UZS','VES','WST','XCD','XCG','XDR','XSU','ZAR','ZMW','ZWG','ZWL'].map(code => ({ code, fractionDigits: 2 as const })),
  ...['AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR','IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR','PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER'].map(code => ({ code, fractionDigits: 0 as const })),
  ...['BHD','JOD','KWD','LYD','OMR','TND'].map(code => ({ code, fractionDigits: 3 as const })),
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
  const groupedWhole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(whole);
  const assemble = (parts: Intl.NumberFormatPart[]) => parts.map(part => {
    if (part.type === 'integer') return groupedWhole;
    if (part.type === 'fraction') return String(fraction).padStart(fractionDigits, '0');
    return part.value;
  }).join('');
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency', currency: currencyCode, minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).formatToParts(negative ? -1n : 1n);
    return assemble(parts);
  } catch {
    // Older Android ICU data may predate a valid code in this frozen catalog.
    // Retain exact localized digits and visibly include the code as a fallback.
    const parts = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
    }).formatToParts(negative ? -1n : 1n);
    return `${currencyCode}\u00a0${assemble(parts)}`;
  }
}

const RATE_DENOMINATOR = 120_000n; // 12 months * 10,000 basis points per 100%.

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('Denominator must be positive.');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return quotient + (remainder * 2n >= denominator ? 1n : 0n);
}

export interface ExchangeRateFreshness {
  ageDays: number;
  freshness: 'current' | 'stale';
}

/** Treats an explicit rate as quote-major units per one base-major unit. */
export function convertMinorUnits(
  amountMinorUnits: bigint,
  fromCurrency: string,
  toCurrency: string,
  rateText: string
): bigint {
  const fromDigits = getCurrencyMetadata(fromCurrency).fractionDigits;
  const toDigits = getCurrencyMetadata(toCurrency).fractionDigits;
  const match = /^(\d{1,9})(?:\.(\d{1,8}))?$/.exec(String(rateText).trim());
  if (!match) throw new TypeError('Enter a positive exchange rate with up to eight decimal places.');
  const fractional = match[2] || '';
  const denominator = pow10(fractional.length);
  const rateNumerator = BigInt(`${match[1]}${fractional}`);
  if (rateNumerator <= 0n) throw new RangeError('Exchange rate must be greater than zero.');
  const negative = amountMinorUnits < 0n;
  const magnitude = negative ? -amountMinorUnits : amountMinorUnits;
  const numerator = magnitude * rateNumerator * pow10(toDigits);
  const divisor = denominator * pow10(fromDigits);
  const quotient = numerator / divisor;
  const remainder = numerator % divisor;
  const rounded = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  return negative && rounded !== 0n ? -rounded : rounded;
}

/** Validate rate dates as UTC calendar dates and label rates older than the chosen age. */
export function assessExchangeRateFreshness(rateDate: string, today: string, maxAgeDays = 7): ExchangeRateFreshness {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Exchange rate dates must use YYYY-MM-DD.');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new TypeError('Exchange rate date is not a valid calendar date.');
    return date.getTime();
  };
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0 || maxAgeDays > 366) throw new RangeError('Maximum exchange-rate age is invalid.');
  const ageMs = parse(today) - parse(rateDate);
  if (ageMs < 0) throw new RangeError('Exchange rate date cannot be in the future.');
  const ageDays = ageMs / 86_400_000;
  return { ageDays, freshness: ageDays <= maxAgeDays ? 'current' : 'stale' };
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
