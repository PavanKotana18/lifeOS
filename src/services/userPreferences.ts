import { CURRENCY_CATALOG, createMoneyRecordAmount, decimalToMinorUnits, formatMinorUnits } from './financeCore';

export type CurrencyCode = string;
export const CURRENCY_CODES: readonly CurrencyCode[] = Object.freeze(Object.keys(CURRENCY_CATALOG).sort());
export type DistanceUnit = 'km' | 'mi';
export type SpeedUnit = 'km/h' | 'm/s' | 'mph';
export type VolumeUnit = 'L' | 'mL' | 'US gal' | 'Imp gal';

export interface UserPreferences {
  currency: CurrencyCode;
  distance: DistanceUnit;
  speed: SpeedUnit;
  volume: VolumeUnit;
  dateFormat: 'DMY' | 'MDY' | 'YMD';
  firstDayOfWeek: 'monday' | 'sunday';
  timeFormat: '12h' | '24h';
  locale: 'system' | 'en-IN' | 'en-US' | 'en-GB' | 'de-DE';
  swipeNavigationEnabled: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  currency: 'INR', distance: 'km', speed: 'km/h', volume: 'L',
  dateFormat: 'DMY', firstDayOfWeek: 'monday', timeFormat: '12h', locale: 'system',
  swipeNavigationEnabled: true,
};

export const resolveSystemDark = (nativeValue: boolean | undefined, mediaValue: boolean) => typeof nativeValue === 'boolean' ? nativeValue : mediaValue;

export function mergeUserPreferences(saved: Partial<UserPreferences>, legacyCurrency: string): UserPreferences {
  const safe = { ...DEFAULT_USER_PREFERENCES };
  const options: Partial<Record<keyof UserPreferences, string[]>> = {
    currency: [...CURRENCY_CODES], distance: ['km', 'mi'], speed: ['km/h', 'm/s', 'mph'],
    volume: ['L', 'mL', 'US gal', 'Imp gal'], dateFormat: ['DMY', 'MDY', 'YMD'],
    firstDayOfWeek: ['monday', 'sunday'], timeFormat: ['12h', '24h'], locale: ['system', 'en-IN', 'en-US', 'en-GB', 'de-DE'],
  };
  for (const key of [...Object.keys(options), 'swipeNavigationEnabled'] as Array<keyof UserPreferences>) {
    const value = saved[key];
    if (key === 'swipeNavigationEnabled') {
      if (typeof value === 'boolean') safe.swipeNavigationEnabled = value;
      continue;
    }
    if (typeof value === 'string' && options[key]?.includes(value)) (safe as any)[key] = value;
  }
  if (!saved.currency && options.currency.includes(legacyCurrency)) safe.currency = legacyCurrency;
  return safe;
}

export function getNumberLocale(_currency: CurrencyCode, locale: UserPreferences['locale']) {
  return locale === 'system' ? undefined : locale;
}

export function formatCurrency(value: number, currency: CurrencyCode, locale: UserPreferences['locale'] = 'system') {
  const amount = Number.isFinite(value) ? value : 0;
  return formatMinorUnits(decimalToMinorUnits(amount, currency), currency, getNumberLocale(currency, locale));
}

const unitToCanonical: Record<string, { dimension: 'distance' | 'speed' | 'volume'; factor: number; canonical: string }> = {
  km: { dimension: 'distance', factor: 1, canonical: 'km' },
  mi: { dimension: 'distance', factor: 1.609344, canonical: 'km' },
  mile: { dimension: 'distance', factor: 1.609344, canonical: 'km' },
  miles: { dimension: 'distance', factor: 1.609344, canonical: 'km' },
  'km/h': { dimension: 'speed', factor: 1 / 3.6, canonical: 'm/s' },
  'm/s': { dimension: 'speed', factor: 1, canonical: 'm/s' },
  mph: { dimension: 'speed', factor: 0.44704, canonical: 'm/s' },
  L: { dimension: 'volume', factor: 1, canonical: 'L' },
  l: { dimension: 'volume', factor: 1, canonical: 'L' },
  mL: { dimension: 'volume', factor: 0.001, canonical: 'L' },
  'US gal': { dimension: 'volume', factor: 3.785411784, canonical: 'L' },
  'Imp gal': { dimension: 'volume', factor: 4.54609, canonical: 'L' },
};

const getUnitDefinition = (unit: string) => Object.prototype.hasOwnProperty.call(unitToCanonical, unit)
  ? unitToCanonical[unit] : undefined;

export const canonicalUnit = (unit: string) => getUnitDefinition(unit)?.canonical || unit;

export function convertMeasurement(value: number, from: string, to: string) {
  if (!Number.isFinite(value)) throw new Error('Measurement must be a finite number.');
  const source = getUnitDefinition(from);
  const target = getUnitDefinition(to);
  if (!source || !target || source.dimension !== target.dimension) {
    if (from === to) return value;
    throw new Error(`Cannot convert ${from} to ${to}.`);
  }
  return value * source.factor / target.factor;
}

export function formatDatePreference(date: Date, format: UserPreferences['dateFormat']) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return format === 'MDY' ? `${month}/${day}/${year}` : format === 'YMD' ? `${year}-${month}-${day}` : `${day}/${month}/${year}`;
}

export function formatTimePreference(date: Date, preference: UserPreferences['timeFormat'], locale: UserPreferences['locale'] = 'system') {
  return new Intl.DateTimeFormat(locale === 'system' ? undefined : locale, {
    hour: 'numeric', minute: '2-digit', hour12: preference === '12h',
  }).format(date);
}

export function buildTransactionUpdate(fields: { type: 'income' | 'expense'; amount: number | string; currencyCode?: CurrencyCode; category: string; description: string; dateTime: string; date?: string; preserveUnknownTime?: boolean; paymentMethod: string; notes?: string; isRecurring?: boolean }) {
  const inputAmount = String(fields.amount).trim();
  const amount = Number(inputAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
  let exactAmount: ReturnType<typeof createMoneyRecordAmount> | undefined;
  if (fields.currencyCode) {
    exactAmount = createMoneyRecordAmount(inputAmount, fields.currencyCode);
    if (!exactAmount.amount) throw new Error('The amount is below the smallest unit of this currency.');
  }
  const date = fields.dateTime ? new Date(fields.dateTime) : null;
  if (date && Number.isNaN(date.getTime())) throw new Error('Choose a valid transaction date and time.');
  if (!date && (!fields.preserveUnknownTime || !fields.date)) throw new Error('Choose a valid transaction date and time.');
  return {
    type: fields.type, amount: exactAmount?.amount ?? amount, ...(exactAmount ? { amountMinor: exactAmount.amountMinor, currencyCode: exactAmount.currencyCode } : {}), category: fields.category.trim(), description: fields.description.trim(),
    date: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : fields.date!,
    ...(date ? { occurredAt: date.toISOString() } : {}), paymentMethod: fields.paymentMethod.trim() || 'Other',
    notes: fields.notes?.trim() || undefined, isRecurring: Boolean(fields.isRecurring),
  };
}
