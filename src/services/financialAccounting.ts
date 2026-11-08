import type { AccountTransfer, Category, FinancialAccount, ManualExchangeRate, PlannedCommitment, Transaction } from '../types';
import { convertMinorUnits, decimalToMinorUnits, getCurrencyMetadata } from './financeCore';

export const isValidLocalDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export function validateFinancialAccount(record: Pick<FinancialAccount, 'name' | 'type' | 'currencyCode' | 'openingBalanceMinor' | 'isActive'>): void {
  if (!record.name.trim()) throw new Error('Account name is required.');
  if (!['cash', 'bank', 'credit-card', 'wallet', 'savings', 'other'].includes(record.type)) throw new Error('Unsupported account type.');
  if (getCurrencyMetadata(record.currencyCode).code !== record.currencyCode) throw new Error('Account currency must be a canonical ISO code.');
  if (!/^(0|[1-9]\d*)$/.test(record.openingBalanceMinor)) throw new Error('Opening balance must be a non-negative exact minor-unit amount.');
  if (typeof record.isActive !== 'boolean') throw new Error('Account active state is invalid.');
}

export function validateAccountTransfer(record: Pick<AccountTransfer, 'fromAccountId' | 'toAccountId' | 'fromAmountMinor' | 'toAmountMinor' | 'fromCurrencyCode' | 'toCurrencyCode' | 'exchangeRate' | 'reversalOfId' | 'date'>, source: FinancialAccount, destination: FinancialAccount): void {
  if (record.fromAccountId === record.toAccountId) throw new Error('Choose two different accounts.');
  if (!isValidLocalDate(record.date)) throw new Error('Transfer date must be a valid local calendar date.');
  if (record.fromCurrencyCode !== source.currencyCode || record.toCurrencyCode !== destination.currencyCode) throw new Error('Transfer currencies must match their accounts.');
  if (!/^[1-9]\d*$/.test(record.fromAmountMinor) || !/^[1-9]\d*$/.test(record.toAmountMinor)) throw new Error('Transfer amounts must be positive exact minor-unit values.');
  const fromAmount = BigInt(record.fromAmountMinor), toAmount = BigInt(record.toAmountMinor);
  if (source.currencyCode === destination.currencyCode) {
    if (fromAmount !== toAmount || record.exchangeRate !== undefined) throw new Error('Same-currency transfers must preserve value and have no exchange rate.');
  } else if (record.reversalOfId) {
    if (record.exchangeRate !== undefined) throw new Error('A linked reversal preserves the original posted amounts and does not accept a new exchange rate.');
  } else if (!record.exchangeRate || convertMinorUnits(fromAmount, source.currencyCode, destination.currencyCode, record.exchangeRate) !== toAmount) {
    throw new Error('Cross-currency transfer requires an explicit rate consistent with both amounts.');
  }
}

export function validateManualExchangeRate(record: Pick<ManualExchangeRate, 'baseCurrencyCode' | 'quoteCurrencyCode' | 'rate' | 'effectiveDate'>): void {
  if (record.baseCurrencyCode === record.quoteCurrencyCode) throw new Error('Choose two different currencies.');
  if (!isValidLocalDate(record.effectiveDate)) throw new Error('Rate date must be a valid calendar date.');
  try { convertMinorUnits(1n, record.baseCurrencyCode, record.quoteCurrencyCode, record.rate); }
  catch { throw new Error('Enter a positive supported-currency rate with up to eight decimal places.'); }
}

export function validatePlannedCommitment(record: Pick<PlannedCommitment, 'title' | 'amount' | 'amountMinor' | 'currencyCode' | 'frequency' | 'nextDueDate' | 'status'>): void {
  if (!record.title.trim()) throw new Error('Commitment name is required.');
  if (!Number.isFinite(record.amount) || record.amount <= 0) throw new Error('Commitment amount must be greater than zero.');
  if (getCurrencyMetadata(record.currencyCode).code !== record.currencyCode || !/^[1-9]\d*$/.test(record.amountMinor) ||
      decimalToMinorUnits(record.amount, record.currencyCode) !== BigInt(record.amountMinor)) throw new Error('Commitment amount and currency metadata do not agree.');
  if (!['weekly', 'monthly', 'yearly'].includes(record.frequency)) throw new Error('Unsupported commitment frequency.');
  if (!isValidLocalDate(record.nextDueDate)) throw new Error('Commitment due date must be a valid calendar date.');
  if (!['active', 'paused'].includes(record.status)) throw new Error('Unsupported commitment state.');
}

export function validatePlannedCommitmentReferences(record: PlannedCommitment, accounts: FinancialAccount[], categories: Category[]): void {
  if (record.accountId && !accounts.some(account => account.id === record.accountId)) throw new Error('Selected account no longer exists.');
  if (record.accountId && !accounts.some(account => account.id === record.accountId && account.currencyCode === record.currencyCode)) throw new Error('Commitment currency must match its selected account.');
  if (record.categoryId && !categories.some(category => category.id === record.categoryId && category.type === 'expense')) throw new Error('Choose an available expense category.');
}

/** Current balances are calculated from the opening balance and posted activity; they are never persisted. */
export function calculateAccountBalances(
  accounts: FinancialAccount[],
  transactions: Transaction[],
  transfers: AccountTransfer[]
): Map<string, bigint> {
  const balances = new Map(accounts.map(account => [account.id, BigInt(account.openingBalanceMinor)]));
  const apply = (id: string | undefined, code: string | undefined, amount: bigint, positiveDirection: boolean) => {
    if (!id) return;
    const account = accounts.find(row => row.id === id);
    if (!account) throw new Error('A financial record references a missing account.');
    if (code && code !== account.currencyCode) throw new Error('Financial record currency differs from its account currency.');
    const isLiability = account.type === 'credit-card';
    const sign = (positiveDirection !== isLiability) ? 1n : -1n;
    balances.set(id, (balances.get(id) || 0n) + sign * amount);
  };
  for (const transaction of transactions) {
    if (!transaction.accountId) continue;
    const amount = transaction.amountMinor && transaction.currencyCode === accounts.find(row => row.id === transaction.accountId)?.currencyCode
      ? BigInt(transaction.amountMinor)
      : decimalToMinorUnits(transaction.amount, transaction.currencyCode || accounts.find(row => row.id === transaction.accountId)!.currencyCode);
    apply(transaction.accountId, transaction.currencyCode, amount, transaction.type === 'income');
  }
  for (const transfer of transfers) {
    apply(transfer.fromAccountId, transfer.fromCurrencyCode, BigInt(transfer.fromAmountMinor), false);
    apply(transfer.toAccountId, transfer.toCurrencyCode, BigInt(transfer.toAmountMinor), true);
  }
  return balances;
}

/** Signed ledger display delta, including the opposite direction of a card liability. */
export function accountActivitySign(account: FinancialAccount, direction: 'income' | 'expense' | 'transfer-in' | 'transfer-out'): '+' | '−' {
  const positiveDirection = direction === 'income' || direction === 'transfer-in';
  const isLiability = account.type === 'credit-card';
  return positiveDirection !== isLiability ? '+' : '−';
}
