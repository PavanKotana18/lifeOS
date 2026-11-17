import type { FinancialAccount, Transaction } from '../types';
import { minorUnitsToDecimal } from './financeCore';

/**
 * Copies user-editable transaction details into a fresh entry while retaining
 * the new-entry date/time defaults. A historical date-only record never gains
 * a fabricated timestamp through duplication.
 */
export function buildDuplicateTransactionDraft(
  newEntryDefaults: Record<string, string>,
  transaction: Transaction,
  accounts?: FinancialAccount[],
): Record<string, string> {
  const currencyCode = transaction.currencyCode || newEntryDefaults.currencyCode || '';
  const account = accounts?.find(row => row.id === transaction.accountId);
  const accountId = transaction.accountId && (accounts === undefined ||
    (account?.isActive && account.currencyCode === currencyCode)) ? transaction.accountId : '';
  return {
    ...newEntryDefaults,
    title: transaction.description || '',
    amount: transaction.amountMinor !== undefined && transaction.currencyCode
      ? minorUnitsToDecimal(BigInt(transaction.amountMinor), transaction.currencyCode)
      : String(transaction.amount),
    currencyCode,
    accountId,
    category: transaction.category,
    type: transaction.type,
    paymentMethod: transaction.paymentMethod || 'Other',
    notes: transaction.notes || '',
    isRecurring: transaction.isRecurring ? 'yes' : '',
  };
}
