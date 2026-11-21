import { CURRENCY_CATALOG, createMoneyRecordAmount, getCurrencyMetadata, minorUnitsToDecimal } from './financeCore';

type AlertDetails = {
  amount: string; currency: string; description?: string; date?: string;
  time?: string; accountHint?: string; reference?: string;
};

export type SmartImportSuggestion =
  | ({ kind: 'income' | 'expense' } & AlertDetails)
  | { kind: 'transfer' | 'refund' | 'reversal' | 'failed' | 'pending' | 'ambiguous' | 'unrecognized'; details?: AlertDetails };

export interface TransactionAlertProvider {
  parse(text: string): SmartImportSuggestion;
}

export interface ImportDuplicateOptions {
  historicalFingerprints?: readonly string[];
  allowPossibleDuplicate?: boolean;
}

export class PossibleImportDuplicateError extends Error {
  constructor() { super('A similar transaction is already recorded.'); }
}

const aliases: Record<string, string> = { '₹': 'INR', RS: 'INR', '€': 'EUR', '£': 'GBP', 'US$': 'USD' };
const currencyCodes = Object.keys(CURRENCY_CATALOG).join('|');
const number = String.raw`\d+(?:,\d+)*(?:\.\d+)?`;
const amountPattern = new RegExp(String.raw`(?:\b(` + currencyCodes +
  String.raw`)\b[ \t]*|\b(Rs)\.?[ \t]*|([₹€£]|US\$)[ \t]*)(` + number +
  String.raw`)(?![\d,]|\.\d)|(?<![\d.,-])\b(` + number + String.raw`)[ \t]+(` + currencyCodes + String.raw`)\b`, 'gi');
const moneyContext = /\b(?:bank|acct|account|a\/c|card|upi|neft|imps|ach|atm|rtgs|vpa)\b/i;
const excluded = /\b(?:otp|one[- ]time(?: password| code)?|verification code|never share this code|promo(?:tion)?|cashback offer|offer expires|pre[- ]?approved loan|loan offer|apply (?:today|now|for a loan)|claim your reward)\b/i;
const unsafe = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]|[\uD800-\uDFFF]/u;
const balance = /\b(?:avail(?:able)?\.?\s*(?:bal(?:ance)?|limit)|avl\.?\s*bal(?:ance)?|(?:closing|current|account)\s+balance|balance\s+(?:available|remaining))\b/i;
const months = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

function suppliedDateTime(input: string, currency: string) {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})(?=\b|T\d)/.exec(input);
  const named = /\b(\d{1,2})[ -]([a-z]{3})[ -](\d{4}|\d{2})\b/i.exec(input);
  const numeric = currency === 'INR' && /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})\b/.exec(input);
  const month = named ? months.indexOf(named[2].toLowerCase()) + 1 : 0;
  const year = iso?.[1] || (month && named ? named[3] : numeric ? numeric[3] : '');
  const dateText = year ? [
    year.length === 2 ? '20' + year : year,
    (iso?.[2] || (month ? String(month) : numeric ? numeric[2] : '')).padStart(2, '0'),
    (iso?.[3] || ((month && named ? named[1] : numeric ? numeric[1] : '')).padStart(2, '0')),
  ].join('-') : '';
  const parsed = new Date(dateText + 'T12:00:00Z');
  const date = Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateText ? dateText : undefined;
  const clock = /\b(?:at\s+)?(\d{1,2}):([0-5]\d)(?::[0-5]\d)?(?:\s*(am|pm)\b)?(?![\d:Z+-])/i.exec(input.replace(/(\d{4}-\d{2}-\d{2})T(?=\d)/g, '$1 '));
  const hour = clock ? Number(clock[1]) : -1;
  const period = clock?.[3]?.toLowerCase();
  const localHour = !period ? hour : hour >= 1 && hour <= 12 ? hour % 12 + (period === 'pm' ? 12 : 0) : -1;
  const time = clock && localHour >= 0 && localHour < 24 ? String(localHour).padStart(2, '0') + ':' + clock[2] : undefined;
  return { date, time };
}

function extractAmounts(input: string) {
  return [...input.matchAll(amountPattern)].flatMap(match => {
    const marker = (match[1] || match[2] || match[3] || match[6]).toUpperCase();
    const currency = aliases[marker] || marker;
    const value = match[4] || match[5];
    let digits: number;
    try { digits = getCurrencyMetadata(currency).fractionDigits; }
    catch { return []; }
    if ((value.includes(',') && !/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(value) &&
        !(currency === 'INR' && /^\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d+)?$/.test(value))) ||
        (value.split('.')[1] || '').replace(/0+$/, '').length > digits) return [null];
    try {
      const money = createMoneyRecordAmount(value.replace(/,/g, ''), currency);
      return [{ currency: money.currencyCode, amount: minorUnitsToDecimal(BigInt(money.amountMinor), money.currencyCode) }];
    } catch { return [null]; }
  });
}

export const pastedBankAlert: TransactionAlertProvider = {
  parse(raw) {
    if (!raw.trim() || raw.length > 2000 || unsafe.test(raw) || excluded.test(raw)) return { kind: 'unrecognized' };
    // A balance or available credit amount is a separate field in many genuine alerts.
    const balanceIndex = raw.search(balance);
    const input = balanceIndex < 0 ? raw : raw.slice(0, balanceIndex);
    if (!moneyContext.test(input)) return { kind: 'unrecognized' };
    if (balanceIndex >= 0 && /\b(?:debited|credited|withdrawn|purchased|paid|received|reversed|refunded)\b/i.test(raw.slice(balanceIndex))) return { kind: 'ambiguous' };

    const amounts = extractAmounts(input);
    const explicitAmount = amounts.length === 1 ? amounts[0] : null;
    const merchant = /\b(?:at|merchant\s*:|paid to|sent to|received from|credited by|to vpa|from vpa|from(?=\s+[a-z0-9._-]+@))\s*([a-z][a-z0-9@._ &'-]{1,59}?)(?=\s+(?:on|ref(?:erence)?|rrn|utr|using|via|at \d)\b|[;,\r\n]|\.\s|\.?$)/i.exec(input)?.[1]?.trim();
    const description = merchant && !/^(?:a\/c|account|acct|card)\b/i.test(merchant) ? merchant : undefined;
    const accountHint = /\b(?:a\/c|account|acct|card)\s*(?:(?:ending(?: in)?|no\.?)\s*|[*x•-]+|\s)*(\d{4})\b/i.exec(input)?.[1];
    const reference = /\b(?:upi\s*(?:ref|id)|(?:txn|transaction)\s*(?:ref|id)|ref(?:erence)?|rrn|utr)\s*(?:no\.?|number)?\s*[:#-]?\s*([a-z0-9][a-z0-9-]{5,29})\b/i.exec(input)?.[1];
    const details = explicitAmount ? { ...explicitAmount, ...suppliedDateTime(input, explicitAmount.currency), description, accountHint, reference } : undefined;
    if (/\b(?:reversal|reversed|rolled back)\b/i.test(input)) return { kind: 'reversal', details };
    if (/\brefund(?:ed)?\b/i.test(input)) return { kind: 'refund', details };
    if (/\b(?:failed|declined|unsuccessful|cancelled)\b|\bnot (?:paid|debited|credited|completed|successful|transferred)\b/i.test(input)) return { kind: 'failed', details };
    if (/\b(?:pending|processing|on hold|initiated|pre[- ]?auth(?:ori[sz]ation)?|auth(?:ori[sz]ation)? only|amount blocked|amount held|temporarily held|will be (?:debited|credited))\b/i.test(input) ||
        (/\bauthori[sz](?:ed|ation)\b/i.test(input) && !/\b(?:debited|credited|posted|settled)\b/i.test(input))) return { kind: 'pending', details };
    if (/\b(?:transfer between|own account transfer|internal transfer|funds? transfer|transferred)\b/i.test(input)) return { kind: 'transfer', details };

    const expense = /\b(?:debited|spent|withdrawn|withdrawal|purchase(?:d)?|paid(?: to| via| using)?|sent to)\b/i.test(input);
    const income = /\b(?:credited|deposited|received)\b/i.test(input);
    if (!expense && !income) return { kind: 'unrecognized' };
    if ((expense && income) || amounts.length > 1) return { kind: 'ambiguous' };
    if (!details) return { kind: 'unrecognized' };
    return { kind: expense ? 'expense' : 'income', ...details };
  },
};

export async function alertFingerprint(text: string, suggestion: Extract<SmartImportSuggestion, { amount: string }>) {
  const { reference, date, kind, currency, amount } = suggestion;
  const strongReference = reference && /^[a-z0-9-]{10,}$/i.test(reference);
  return digestIdentity(reference && (strongReference || date) ?
    ['ref-v2', kind, currency, amount, strongReference ? '' : date, reference.toUpperCase()].join('|') : normalizeAlert(text));
}

function normalizeAlert(text: string) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function historicalAlertFingerprints(text: string, suggestion: Extract<SmartImportSuggestion, { amount: string }>) {
  const { reference, date, kind, currency, amount, accountHint } = suggestion;
  const rawIdentity = digestIdentity(normalizeAlert(text));
  // Match records created by vc1000009 without migrating the encrypted ledger.
  return reference && date ? Promise.all([
    rawIdentity, digestIdentity([kind, currency, amount, date, accountHint || '', reference.toUpperCase()].join('|')),
  ]) : [await rawIdentity];
}

async function digestIdentity(identity: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
