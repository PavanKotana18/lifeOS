import type { Transaction } from '../types';

/**
 * Copies user-editable transaction details into a fresh entry while retaining
 * the new-entry date/time defaults. A historical date-only record never gains
 * a fabricated timestamp through duplication.
 */
export function buildDuplicateTransactionDraft(
  newEntryDefaults: Record<string, string>,
  transaction: Transaction,
): Record<string, string> {
  return {
    ...newEntryDefaults,
    title: transaction.description || '',
    amount: String(transaction.amount),
    category: transaction.category,
    type: transaction.type,
    paymentMethod: transaction.paymentMethod || 'Other',
    notes: transaction.notes || '',
    isRecurring: transaction.isRecurring ? 'yes' : '',
  };
}
