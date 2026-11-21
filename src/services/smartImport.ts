import { createMoneyRecordAmount, getCurrencyMetadata, minorUnitsToDecimal } from './financeCore';

export type SmartImportSuggestion =
  | { kind: 'income' | 'expense'; amount: string; currency: string; description?: string; date?: string; time?: string; accountHint?: string; reference?: string }
  | { kind: 'transfer' | 'refund' | 'reversal' | 'failed' | 'pending' | 'unrecognized' };

export interface TransactionAlertProvider {
  parse(text: string): SmartImportSuggestion;
}

const aliases: Record<string, string> = { '₹': 'INR', RS: 'INR', '€': 'EUR', '£': 'GBP' };
const amountPattern = /(?:\b([A-Z]{3})\s+|\b(Rs)\.?\s*|([₹€£])\s*)(\d[\d,]*(?:\.\d+)?)(?![\d.,])/gi;

function validDate(date: string) {
  const parsed = new Date(date + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export const pastedBankAlert: TransactionAlertProvider = {
  parse(input) {
    if (!input.trim() || input.length > 2000 || /\b(?:otp|one[- ]time(?: password| code)?|verification code|promo(?:tion)?|cashback offer|offer expires|avail(?:able)?\.?\s*(?:bal(?:ance)?|limit)|closing balance|never share this code)\b/i.test(input)) return { kind: 'unrecognized' };
    if (!/\b(?:bank|acct|account|a\/c|card|upi|neft|imps|ach)\b/i.test(input)) return { kind: 'unrecognized' };
    if (/\b(?:failed|declined|unsuccessful)\b|\bnot (?:debited|credited|completed)\b/i.test(input)) return { kind: 'failed' };
    if (/\b(?:pending|processing|on hold|initiated)\b/i.test(input)) return { kind: 'pending' };
    if (/\b(?:reversal|reversed)\b/i.test(input)) return { kind: 'reversal' };
    if (/\brefund(?:ed)?\b/i.test(input)) return { kind: 'refund' };
    if (/\b(?:transferred|transfer between|own account transfer|fund transfer)\b/i.test(input)) return { kind: 'transfer' };
    const expense = /\b(?:debited|spent|withdrawn|purchase(?:d)?)\b/i.test(input);
    const income = /\b(?:credited|deposited)\b/i.test(input);
    if (expense === income) return { kind: 'unrecognized' };
    const amounts = [...input.matchAll(amountPattern)].flatMap(match => {
      const marker = (match[1] || match[2] || match[3]).toUpperCase();
      const currency = aliases[marker] || marker;
      const value = match[4];
      if (value.includes(',') && !/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(value)
        && !(currency === 'INR' && /^\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d+)?$/.test(value))) return [];
      try {
        const fraction = (value.split('.')[1] || '').replace(/0+$/, '');
        if (fraction.length > getCurrencyMetadata(currency).fractionDigits) return [];
        const money = createMoneyRecordAmount(value.replace(/,/g, ''), currency);
        return [{ currency: money.currencyCode, amount: minorUnitsToDecimal(BigInt(money.amountMinor), money.currencyCode) }];
      } catch { return []; }
    });
    if (amounts.length !== 1) return { kind: 'unrecognized' };
    const { currency, amount } = amounts[0];
    const iso = /\b(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?![\d:Z+-]))?/i.exec(input);
    const indian = currency === 'INR' && /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/.exec(input);
    const dateText = iso?.[1] || (indian ? [indian[3], indian[2].padStart(2, '0'), indian[1].padStart(2, '0')].join('-') : '');
    const date = validDate(dateText) ? dateText : undefined;
    const time = date && iso?.[2] && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(iso[2]) ? iso[2] : undefined;
    const description = /\b(?:at|merchant[: ])\s*([a-z][a-z0-9 .&'-]{1,45}?)(?=\s+(?:on|ref|using|via)\b|[.;\n]|$)/i.exec(input)?.[1]?.trim();
    const accountHint = /\b(?:a\/c|account|acct|card)\s*(?:(?:ending|no\.?)\s+|[*x]+|\s)*(\d{4})\b/i.exec(input)?.[1];
    const reference = /\b(?:ref(?:erence)?|rrn|utr)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9-]{6,30})\b/i.exec(input)?.[1];
    return { kind: expense ? 'expense' : 'income', amount, currency, description, date, time, accountHint, reference };
  },
};

export async function alertFingerprint(text: string, suggestion: Extract<SmartImportSuggestion, { amount: string }>) {
  const identity = suggestion.reference && suggestion.date
    ? [suggestion.kind, suggestion.currency, suggestion.amount, suggestion.date, suggestion.accountHint || '', suggestion.reference.toUpperCase()].join('|')
    : text.trim().replace(/\s+/g, ' ').toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
