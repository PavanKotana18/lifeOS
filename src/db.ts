import Dexie, { Table } from 'dexie';
import { createSessionManager } from './services/sessionManager';
import { createLifeOSEncryptedRuntime } from './services/encryptedStorageRuntime';
import {
  BOOTSTRAP_SETTING_KEYS,
  type LifeOSRawDatabase,
  type LifeOSDatabaseWithTransactions
} from './services/encryptedStorageIntegration';
import { CryptoService } from './services/cryptoService.ts';
import { convertMinorUnits, decimalToMinorUnits, getCurrencyMetadata, minorUnitsToDecimal } from './services/financeCore';
import { validateAccountTransfer, validateFinancialAccount, validateManualExchangeRate, validatePlannedCommitment, validatePlannedCommitmentReferences } from './services/financialAccounting';
import {
  Transaction,
  Category,
  Budget,
  SavingsGoal,
  SavingsContribution,
  FinancialAccount,
  AccountTransfer,
  ManualExchangeRate,
  PlannedCommitment,
  Habit,
  HabitLog,
  Goal,
  Milestone,
  Task
} from './types';

export class LifeOSDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  savingsGoals!: Table<SavingsGoal, string>;
  savingsContributions!: Table<SavingsContribution, string>;
  financialAccounts!: Table<FinancialAccount, string>;
  accountTransfers!: Table<AccountTransfer, string>;
  manualExchangeRates!: Table<ManualExchangeRate, string>;
  plannedCommitments!: Table<PlannedCommitment, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  goals!: Table<Goal, string>;
  milestones!: Table<Milestone, string>;
  tasks!: Table<Task, string>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor(databaseName = 'LifeOS_Database') {
    super(databaseName);
    this.version(1).stores({
      transactions: 'id, date, category, type, createdAt',
      categories: 'id, type, name',
      budgets: 'id, monthYear, categoryId',
      savingsGoals: 'id, targetDate',
      savingsContributions: 'id, goalId, date',
      habits: 'id, frequency, createdAt',
      habitLogs: 'id, habitId, date, [habitId+date]',
      goals: 'id, category, priority, status, targetDate',
      milestones: 'id, goalId',
      tasks: 'id, dueDate, priority, completed',
      settings: 'key'
    });
    // Add only new tables and non-destructive indexes. No existing record is
    // rewritten, re-keyed, assigned a currency, or moved during this upgrade.
    this.version(2).stores({
      transactions: 'id, date, category, type, createdAt, accountId',
      // Dexie requires the complete target schema in every version. Omitting an
      // existing store here would drop it during upgrade, so preserve every v1
      // store and its indexes explicitly.
      categories: 'id, type, name',
      budgets: 'id, monthYear, categoryId',
      savingsGoals: 'id, targetDate',
      savingsContributions: 'id, goalId, date',
      financialAccounts: 'id, name, type, isActive',
      accountTransfers: 'id, fromAccountId, toAccountId, date',
      manualExchangeRates: 'id, [baseCurrencyCode+quoteCurrencyCode], effectiveDate',
      plannedCommitments: 'id, nextDueDate, status, categoryId, accountId',
      habits: 'id, frequency, createdAt',
      habitLogs: 'id, habitId, date, [habitId+date]',
      goals: 'id, category, priority, status, targetDate',
      milestones: 'id, goalId',
      tasks: 'id, dueDate, priority, completed',
      settings: 'key'
    });
  }
}


// Shared database instance for the existing storage layer and encrypted integration.
export const lifeOSDatabase = new LifeOSDatabase();
const db = lifeOSDatabase;

/** Bootstrap inspection returns ciphertext metadata only, never decrypted records. */
export async function getRecoveryChallenge() {
  for (const table of db.tables) {
    const row = await table.filter((item: any) => item?.__lifeosEncrypted === 1 && item.encrypted).first();
    if (row) return { table: table.name, recordId: table.name === 'settings' ? row.key : row.id,
      schemaVersion: 1, encrypted: row.encrypted };
  }
  return null;
}

export async function hasEncryptedRecords(): Promise<boolean> {
  for (const table of db.tables) {
    if (await table.filter((item: any) => item &&
      (Object.prototype.hasOwnProperty.call(item, '__lifeosEncrypted') ||
       Object.prototype.hasOwnProperty.call(item, 'encrypted'))).first()) return true;
  }
  return false;
}

/** Counts private rows without returning record contents during fresh-install admission. */
export async function hasPrivateRows(): Promise<boolean> {
  const tableCounts = await Promise.all([
    db.transactions.count(), db.categories.count(), db.budgets.count(),
    db.savingsGoals.count(), db.savingsContributions.count(), db.financialAccounts.count(),
    db.accountTransfers.count(), db.manualExchangeRates.count(), db.plannedCommitments.count(), db.habits.count(),
    db.habitLogs.count(), db.goals.count(), db.milestones.count(), db.tasks.count(),
    db.settings.where('key').noneOf([...BOOTSTRAP_SETTING_KEYS]).count(),
  ]);
  return tableCounts.some(count => count > 0);
}

let recordIdSequence = 0;

export function createRecordId(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

  return `${prefix}_${Date.now().toString(36)}_${(recordIdSequence++).toString(36)}_${randomPart}`;
}

export function getRecurrenceRootId(
  task: Pick<Task, 'id' | 'recurrenceRootId'>
): string {
  if (task.recurrenceRootId) return task.recurrenceRootId;

  let rootId = task.id;
  while (rootId.startsWith('rec_')) {
    const match = /^rec_(.+)_\d{4}-\d{2}-\d{2}$/.exec(rootId);
    if (!match) break;
    rootId = match[1];
  }
  return rootId;
}

export function getNextRecurringTaskDate(
  dueDate: string,
  recurring: Task['recurring'],
  todayLocalDate = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })()
): string {
  const parseDate = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error('Invalid recurring task due date');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) throw new Error('Invalid recurring task due date');
    return date;
  };

  const nextDate = parseDate(dueDate);
  const today = parseDate(todayLocalDate);

  const advance = () => {
    if (recurring === 'Daily') {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    } else if (recurring === 'Weekly') {
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
    } else if (recurring === 'Monthly') {
      const originalDay = nextDate.getUTCDate();
      nextDate.setUTCDate(1);
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
      const lastDay = new Date(Date.UTC(
        nextDate.getUTCFullYear(),
        nextDate.getUTCMonth() + 1,
        0
      )).getUTCDate();
      nextDate.setUTCDate(Math.min(originalDay, lastDay));
    } else {
      throw new Error('Unsupported recurrence frequency');
    }
  };

  advance();
  while (nextDate.getTime() <= today.getTime()) advance();

  return [
    nextDate.getUTCFullYear(),
    String(nextDate.getUTCMonth() + 1).padStart(2, '0'),
    String(nextDate.getUTCDate()).padStart(2, '0')
  ].join('-');
}

export function validateTransactionRecord(
  record: Partial<Transaction>,
  requireComplete: boolean
): void {
  if (requireComplete || record.amount !== undefined) {
    if (typeof record.amount !== 'number' || !Number.isFinite(record.amount) || record.amount <= 0) {
      throw new Error('Transaction amount must be a positive finite number');
    }
  }

  if (requireComplete || record.date !== undefined) {
    if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
      throw new Error('Transaction date must use YYYY-MM-DD format');
    }
    const [year, month, day] = record.date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new Error('Transaction date must be a valid calendar date');
    }
  }

  if (requireComplete && record.type !== 'income' && record.type !== 'expense') {
    throw new Error('Transaction type must be income or expense');
  }
  validateMoneyMetadata(record);
  if (record.type !== undefined && record.type !== 'income' && record.type !== 'expense') {
    throw new Error('Transaction type must be income or expense');
  }

  for (const field of ['category', 'description', 'paymentMethod'] as const) {
    const value = record[field];
    if (
      (requireComplete && (typeof value !== 'string' || !value.trim())) ||
      (value !== undefined && (typeof value !== 'string' || !value.trim()))
    ) {
      throw new Error(`Transaction ${field} is required`);
    }
  }
}

function validateMoneyMetadata(record: { currencyCode?: string; amountMinor?: string; amount?: number }): void {
  if (record.currencyCode !== undefined) {
    try {
      const metadata = getCurrencyMetadata(record.currencyCode);
      if (metadata.code !== record.currencyCode) throw new Error('Non-canonical currency code');
    }
    catch { throw new Error('Financial record currency must be a supported ISO 4217 code'); }
  }
  if (record.amountMinor !== undefined &&
    (typeof record.amountMinor !== 'string' || !/^(0|[1-9]\d*)$/.test(record.amountMinor))) {
    throw new Error('Financial record minor-unit amount must be a non-negative integer string');
  }
  if (record.amountMinor !== undefined && !record.currencyCode) {
    throw new Error('Exact minor-unit amount requires an explicit currency code');
  }
  if (record.amountMinor !== undefined && record.currencyCode && record.amount !== undefined &&
      decimalToMinorUnits(record.amount, record.currencyCode) !== BigInt(record.amountMinor)) {
    throw new Error('Major and minor-unit financial amounts do not agree.');
  }
}

async function assertTransactionCategory(
  categoryName: string,
  type: 'income' | 'expense',
  existing?: Transaction
): Promise<void> {
  const normalized = categoryName.trim().toLowerCase();

  if (!normalized) {
    throw new Error('Choose a transaction category.');
  }

  const categories = await db.categories.toArray();
  const matching = categories.find(
    category => category.name.trim().toLowerCase() === normalized
  );

  if (matching) {
    if (matching.name !== categoryName.trim()) {
      throw new Error('Choose the exact category name from the category list.');
    }
    if (matching.type !== type) {
      throw new Error('The selected category does not match the transaction type.');
    }
    return;
  }

  // Allow an unchanged historical category, but not a new reference to it.
  if (existing && existing.category === categoryName && existing.type === type) {
    return;
  }

  throw new Error('The selected category does not exist. Choose an available category.');
}

// Clean Database Abstraction Layer Interface
export interface IDataStorage {
  transactions: {
    getAll(): Promise<Transaction[]>;
    getById(id: string): Promise<Transaction | undefined>;
    add(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction>;
    update(id: string, updates: Partial<Transaction>): Promise<void>;
    delete(id: string): Promise<void>;
    filter(params: { month?: string; year?: string; category?: string; type?: string; query?: string }): Promise<Transaction[]>;
  };
  categories: {
    getAll(): Promise<Category[]>;
    add(cat: Omit<Category, 'id'>): Promise<Category>;
    update(id: string, updates: Partial<Category>): Promise<void>;
    delete(id: string): Promise<void>;
  };
  budgets: {
    getAll(): Promise<Budget[]>;
    getByMonth(month: string): Promise<Budget[]>;
    upsert(budget: Omit<Budget, 'id' | 'createdAt'>): Promise<Budget>;
    delete(id: string): Promise<void>;
  };
  savings: {
    getGoals(): Promise<SavingsGoal[]>;
    addGoal(goal: Omit<SavingsGoal, 'id' | 'createdAt'>): Promise<SavingsGoal>;
    updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<void>;
    deleteGoal(id: string): Promise<void>;
    addContribution(contribution: Omit<SavingsContribution, 'id' | 'createdAt'>): Promise<void>;
    updateContribution(id: string, changes: Partial<Pick<SavingsContribution, 'amount' | 'amountMinor' | 'currencyCode' | 'date' | 'notes'>>): Promise<void>;
    deleteContribution(id: string): Promise<void>;
    getContributions(goalId?: string): Promise<SavingsContribution[]>;
  };
  habits: {
    getAll(): Promise<Habit[]>;
    add(habit: Omit<Habit, 'id' | 'createdAt'>): Promise<Habit>;
    update(id: string, updates: Partial<Habit>): Promise<void>;
    delete(id: string): Promise<void>;
    getLogs(habitId?: string): Promise<HabitLog[]>;
    logCompletion(habitId: string, date: string, completed: boolean): Promise<void>;
  };
  goals: {
    getAll(): Promise<Goal[]>;
    getAllMilestones(): Promise<Milestone[]>;
    add(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal>;
    update(id: string, updates: Partial<Goal>): Promise<void>;
    delete(id: string): Promise<void>;
    getMilestones(goalId: string): Promise<Milestone[]>;
    addMilestone(milestone: Omit<Milestone, 'id'>): Promise<Milestone>;
    toggleMilestone(id: string, completed: boolean): Promise<void>;
    deleteMilestone(id: string): Promise<void>;
  };
  tasks: {
    getAll(): Promise<Task[]>;
    add(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task>;
    update(id: string, updates: Partial<Task>): Promise<void>;
    delete(id: string): Promise<void>;
    toggleCompleted(id: string, completed: boolean): Promise<void>;
  };
  settings: {
    get<T>(key: string, defaultValue: T): Promise<T>;
    set(key: string, value: any): Promise<void>;
  };
  backup: {
    hasData(): Promise<boolean>;
    exportData(): Promise<string>;
    importData(jsonData: string, options?: { replaceExisting?: boolean }): Promise<{ success: boolean; counts: Record<string, number> }>;
    clearAll(): Promise<void>;
    seedDemoData(): Promise<void>;
  };
  accounts: {
    getAll(): Promise<FinancialAccount[]>;
    add(input: Omit<FinancialAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<FinancialAccount>;
    update(id: string, updates: Partial<Omit<FinancialAccount, 'id' | 'createdAt'>>): Promise<void>;
    archive(id: string): Promise<void>;
    delete(id: string): Promise<void>;
    getTransfers(accountId?: string): Promise<AccountTransfer[]>;
    addTransfer(input: Omit<AccountTransfer, 'id' | 'createdAt' | 'updatedAt' | 'reversalOfId'> & { id?: string }): Promise<AccountTransfer>;
    reverseTransfer(id: string, date: string): Promise<AccountTransfer>;
    updateTransfer(id: string, updates: Partial<Omit<AccountTransfer, 'id' | 'createdAt' | 'reversalOfId'>>): Promise<void>;
    deleteTransfer(id: string): Promise<void>;
  };
  exchangeRates: {
    getAll(): Promise<ManualExchangeRate[]>;
    add(input: Omit<ManualExchangeRate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ManualExchangeRate>;
    update(id: string, updates: Partial<Omit<ManualExchangeRate, 'id' | 'createdAt'>>): Promise<void>;
    delete(id: string): Promise<void>;
  };
  commitments: {
    getAll(): Promise<PlannedCommitment[]>;
    add(input: Omit<PlannedCommitment, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlannedCommitment>;
    update(id: string, updates: Partial<Omit<PlannedCommitment, 'id' | 'createdAt'>>): Promise<void>;
    delete(id: string): Promise<void>;
  };
}


export function validateBackupTables(tablesData: any): string[] {
  const legacyNames = [
    'transactions', 'categories', 'budgets', 'savingsGoals',
    'savingsContributions', 'habits', 'habitLogs', 'goals',
    'milestones', 'tasks', 'settings'
  ];
  const addedNames = ['financialAccounts', 'accountTransfers', 'manualExchangeRates', 'plannedCommitments'];
  const names = [...legacyNames, ...addedNames];

  const fail = (table: string, index: number, field: string): never => {
    throw new Error(`Invalid backup: ${table}[${index}].${field}`);
  };
  const obj = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v: any) => typeof v === 'string' && v.trim().length > 0;
  const optionalString = (r: any, k: string, t: string, i: number) =>
    r[k] !== undefined && r[k] !== null && typeof r[k] !== 'string' ? fail(t, i, k) : undefined;
  const num = (v: any) => typeof v === 'number' && Number.isFinite(v);
  const date = (v: any) => {
    if (typeof v !== 'string' || !/^(\d{4})-(\d{2})-(\d{2})$/.test(v)) return false;
    const [y, m, d] = v.split('-').map(Number);
    const x = new Date(Date.UTC(y, m - 1, d));
    return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
  };
  const month = (v: any) => typeof v === 'string' && /^(\d{4})-(0[1-9]|1[0-2])$/.test(v);
  const time = (v: any) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const instant = (v: any) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
  const requiredString = (r: any, k: string, t: string, i: number) => {
    if (!str(r[k])) fail(t, i, k);
  };
  const requiredNumber = (r: any, k: string, t: string, i: number, min = 0) => {
    if (!num(r[k]) || r[k] < min) fail(t, i, k);
  };
  const requiredDate = (r: any, k: string, t: string, i: number) => {
    if (!date(r[k])) fail(t, i, k);
  };
  const optionalInstant = (r: any, k: string, t: string, i: number) => {
    if (r[k] !== undefined && r[k] !== null && !instant(r[k])) fail(t, i, k);
  };
  const optionalBoolean = (r: any, k: string, t: string, i: number) => {
    if (r[k] !== undefined && r[k] !== null && typeof r[k] !== 'boolean') fail(t, i, k);
  };
  const enumValue = (v: any, allowed: string[]) => typeof v === 'string' && allowed.includes(v);
  const ids: Record<string, Set<string>> = {};
  const unique = (rows: any[], key: string, table: string) => {
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (!obj(r) || !str(r[key])) fail(table, i, key);
      if (seen.has(r[key])) fail(table, i, `duplicate ${key}`);
      seen.add(r[key]);
    });
    return seen;
  };

  if (!obj(tablesData)) throw new Error('Invalid backup tables object');
  for (const name of legacyNames) {
    if (!Array.isArray(tablesData[name])) throw new Error(`Invalid backup: ${name} must be an array`);
    ids[name] = unique(tablesData[name], name === 'settings' ? 'key' : 'id', name);
  }
  for (const name of addedNames) {
    if (tablesData[name] === undefined) tablesData[name] = [];
    if (!Array.isArray(tablesData[name])) throw new Error(`Invalid backup: ${name} must be an array`);
    ids[name] = unique(tablesData[name], name === 'settings' ? 'key' : 'id', name);
  }

  const check = (table: string, fn: (r: any, i: number) => void) =>
    tablesData[table].forEach(fn);

  check('transactions', (r, i) => {
    if (!enumValue(r.type, ['income', 'expense'])) fail('transactions', i, 'type');
    requiredNumber(r, 'amount', 'transactions', i);
    for (const k of ['category', 'description', 'paymentMethod', 'createdAt']) requiredString(r, k, 'transactions', i);
    requiredDate(r, 'date', 'transactions', i);
    optionalString(r, 'notes', 'transactions', i);
    optionalInstant(r, 'occurredAt', 'transactions', i);
    optionalInstant(r, 'updatedAt', 'transactions', i);
    optionalBoolean(r, 'isRecurring', 'transactions', i);
    try { validateMoneyMetadata(r); } catch { fail('transactions', i, 'currency/amountMinor'); }
    optionalString(r, 'accountId', 'transactions', i);
    if (r.accountId && !ids.financialAccounts.has(r.accountId)) fail('transactions', i, 'accountId reference');
  });

  check('financialAccounts', (r, i) => {
    requiredString(r, 'name', 'financialAccounts', i);
    if (!enumValue(r.type, ['cash', 'bank', 'credit-card', 'wallet', 'savings', 'other'])) fail('financialAccounts', i, 'type');
    requiredString(r, 'currencyCode', 'financialAccounts', i);
    try { validateMoneyMetadata({ currencyCode: r.currencyCode, amountMinor: r.openingBalanceMinor }); } catch { fail('financialAccounts', i, 'currency/openingBalanceMinor'); }
    if (typeof r.isActive !== 'boolean') fail('financialAccounts', i, 'isActive');
    requiredString(r, 'createdAt', 'financialAccounts', i);
    optionalString(r, 'description', 'financialAccounts', i);
    optionalInstant(r, 'updatedAt', 'financialAccounts', i);
  });

  check('accountTransfers', (r, i) => {
    requiredString(r, 'fromAccountId', 'accountTransfers', i);
    requiredString(r, 'toAccountId', 'accountTransfers', i);
    if (r.fromAccountId === r.toAccountId) fail('accountTransfers', i, 'accounts must differ');
    const source = tablesData.financialAccounts.find((account: any) => account.id === r.fromAccountId);
    const target = tablesData.financialAccounts.find((account: any) => account.id === r.toAccountId);
    if (!source || !target) fail('accountTransfers', i, 'account reference');
    if (r.fromCurrencyCode !== source.currencyCode || r.toCurrencyCode !== target.currencyCode) fail('accountTransfers', i, 'currency/account mismatch');
    try {
      validateMoneyMetadata({ currencyCode: r.fromCurrencyCode, amountMinor: r.fromAmountMinor });
      validateMoneyMetadata({ currencyCode: r.toCurrencyCode, amountMinor: r.toAmountMinor });
      const fromMinor = BigInt(r.fromAmountMinor), toMinor = BigInt(r.toAmountMinor);
      if (fromMinor <= 0n || toMinor <= 0n) fail('accountTransfers', i, 'amounts must be positive');
      if (r.reversalOfId) {
        if (r.exchangeRate !== undefined) fail('accountTransfers', i, 'reversal exchangeRate');
      } else if (r.fromCurrencyCode === r.toCurrencyCode) {
        if (fromMinor !== toMinor || r.exchangeRate !== undefined) fail('accountTransfers', i, 'same-currency amounts/rate');
      } else if (typeof r.exchangeRate !== 'string' || convertMinorUnits(fromMinor, r.fromCurrencyCode, r.toCurrencyCode, r.exchangeRate) !== toMinor) {
        fail('accountTransfers', i, 'exchangeRate conversion');
      }
    } catch { fail('accountTransfers', i, 'amount/currency/rate'); }
    requiredDate(r, 'date', 'accountTransfers', i);
    requiredString(r, 'createdAt', 'accountTransfers', i);
    optionalString(r, 'notes', 'accountTransfers', i);
    optionalString(r, 'reversalOfId', 'accountTransfers', i);
    optionalInstant(r, 'updatedAt', 'accountTransfers', i);
  });
  const reversedTransferIds = new Set<string>();
  tablesData.accountTransfers.forEach((reversal: any, i: number) => {
    if (!reversal.reversalOfId) return;
    const original = tablesData.accountTransfers.find((row: any) => row.id === reversal.reversalOfId);
    if (!original || original.reversalOfId || reversedTransferIds.has(original.id) ||
        reversal.fromAccountId !== original.toAccountId || reversal.toAccountId !== original.fromAccountId ||
        reversal.fromAmountMinor !== original.toAmountMinor || reversal.toAmountMinor !== original.fromAmountMinor ||
        reversal.fromCurrencyCode !== original.toCurrencyCode || reversal.toCurrencyCode !== original.fromCurrencyCode) {
      fail('accountTransfers', i, 'reversal link or exact counter-entry');
    }
    reversedTransferIds.add(original.id);
  });

  check('manualExchangeRates', (r, i) => {
    requiredString(r, 'baseCurrencyCode', 'manualExchangeRates', i);
    requiredString(r, 'quoteCurrencyCode', 'manualExchangeRates', i);
    if (r.baseCurrencyCode === r.quoteCurrencyCode) fail('manualExchangeRates', i, 'currency pair must differ');
    try { getCurrencyMetadata(r.baseCurrencyCode); getCurrencyMetadata(r.quoteCurrencyCode); convertMinorUnits(1n, r.baseCurrencyCode, r.quoteCurrencyCode, r.rate); }
    catch { fail('manualExchangeRates', i, 'currency/rate'); }
    requiredDate(r, 'effectiveDate', 'manualExchangeRates', i);
    requiredString(r, 'createdAt', 'manualExchangeRates', i);
    optionalString(r, 'sourceLabel', 'manualExchangeRates', i);
    optionalInstant(r, 'updatedAt', 'manualExchangeRates', i);
  });
  const rateKeys = new Set<string>();
  tablesData.manualExchangeRates.forEach((r: any, i: number) => {
    const key = `${r.baseCurrencyCode}|${r.quoteCurrencyCode}|${r.effectiveDate}`;
    if (rateKeys.has(key)) fail('manualExchangeRates', i, 'duplicate currency pair/effectiveDate');
    rateKeys.add(key);
  });

  check('plannedCommitments', (r, i) => {
    requiredString(r, 'title', 'plannedCommitments', i);
    requiredNumber(r, 'amount', 'plannedCommitments', i);
    try { validateMoneyMetadata(r); } catch { fail('plannedCommitments', i, 'currency/amountMinor'); }
    if (!enumValue(r.frequency, ['weekly', 'monthly', 'yearly'])) fail('plannedCommitments', i, 'frequency');
    requiredDate(r, 'nextDueDate', 'plannedCommitments', i);
    if (!enumValue(r.status, ['active', 'paused'])) fail('plannedCommitments', i, 'status');
    requiredString(r, 'createdAt', 'plannedCommitments', i);
    optionalString(r, 'notes', 'plannedCommitments', i);
    optionalString(r, 'categoryId', 'plannedCommitments', i);
    optionalString(r, 'accountId', 'plannedCommitments', i);
    if (r.categoryId && !ids.categories.has(r.categoryId)) fail('plannedCommitments', i, 'categoryId reference');
    if (r.accountId && !ids.financialAccounts.has(r.accountId)) fail('plannedCommitments', i, 'accountId reference');
    optionalInstant(r, 'updatedAt', 'plannedCommitments', i);
  });

  check('categories', (r, i) => {
    for (const k of ['name', 'color']) requiredString(r, k, 'categories', i);
    if (!enumValue(r.type, ['income', 'expense'])) fail('categories', i, 'type');
    optionalString(r, 'icon', 'categories', i);
    optionalBoolean(r, 'isDefault', 'categories', i);
  });

  check('budgets', (r, i) => {
    requiredNumber(r, 'monthlyAmount', 'budgets', i);
    if (!month(r.monthYear)) fail('budgets', i, 'monthYear');
    requiredString(r, 'createdAt', 'budgets', i);
    try { validateMoneyMetadata({ currencyCode: r.currencyCode, amountMinor: r.amountMinor, amount: r.monthlyAmount }); } catch { fail('budgets', i, 'currency/amountMinor'); }
    optionalString(r, 'categoryId', 'budgets', i);
    if (r.categoryId && !ids.categories.has(r.categoryId)) fail('budgets', i, 'categoryId reference');
  });

  check('savingsGoals', (r, i) => {
    requiredString(r, 'title', 'savingsGoals', i);
    requiredNumber(r, 'targetAmount', 'savingsGoals', i);
    requiredNumber(r, 'currentAmount', 'savingsGoals', i);
    requiredDate(r, 'targetDate', 'savingsGoals', i);
    requiredString(r, 'createdAt', 'savingsGoals', i);
    try {
      validateMoneyMetadata({ currencyCode: r.currencyCode, amountMinor: r.targetAmountMinor, amount: r.targetAmount });
      validateMoneyMetadata({ currencyCode: r.currencyCode, amountMinor: r.currentAmountMinor, amount: r.currentAmount });
    } catch { fail('savingsGoals', i, 'currency/amountMinor'); }
    optionalString(r, 'category', 'savingsGoals', i);
    optionalString(r, 'notes', 'savingsGoals', i);
  });

  check('savingsContributions', (r, i) => {
    requiredString(r, 'goalId', 'savingsContributions', i);
    if (!ids.savingsGoals.has(r.goalId)) fail('savingsContributions', i, 'goalId reference');
    requiredNumber(r, 'amount', 'savingsContributions', i);
    requiredDate(r, 'date', 'savingsContributions', i);
    requiredString(r, 'createdAt', 'savingsContributions', i);
    try { validateMoneyMetadata(r); } catch { fail('savingsContributions', i, 'currency/amountMinor'); }
    optionalString(r, 'notes', 'savingsContributions', i);
  });

  check('habits', (r, i) => {
    requiredString(r, 'name', 'habits', i);
    if (!enumValue(r.frequency, ['daily', 'weekdays', 'weekends', 'weekly'])) fail('habits', i, 'frequency');
    requiredString(r, 'color', 'habits', i);
    requiredString(r, 'createdAt', 'habits', i);
    optionalString(r, 'description', 'habits', i);
    optionalString(r, 'icon', 'habits', i);
    optionalBoolean(r, 'archived', 'habits', i);
    if (r.targetPerDay !== undefined && (!num(r.targetPerDay) || r.targetPerDay <= 0)) fail('habits', i, 'targetPerDay');
    if (r.reminderTime !== undefined && !time(r.reminderTime)) fail('habits', i, 'reminderTime');
    if (r.reminderWeekday !== undefined && (!Number.isInteger(r.reminderWeekday) || r.reminderWeekday < 1 || r.reminderWeekday > 7)) fail('habits', i, 'reminderWeekday');
  });

  check('habitLogs', (r, i) => {
    requiredString(r, 'habitId', 'habitLogs', i);
    if (!ids.habits.has(r.habitId)) fail('habitLogs', i, 'habitId reference');
    requiredDate(r, 'date', 'habitLogs', i);
    if (typeof r.completed !== 'boolean') fail('habitLogs', i, 'completed');
    optionalInstant(r, 'completedAt', 'habitLogs', i);
  });
  const habitLogKeys = new Set<string>();
  tablesData.habitLogs.forEach((r: any, i: number) => {
    const key = `${r.habitId}|${r.date}`;
    if (habitLogKeys.has(key)) fail('habitLogs', i, 'duplicate habitId/date');
    habitLogKeys.add(key);
  });

  check('goals', (r, i) => {
    requiredString(r, 'title', 'goals', i);
    if (!enumValue(r.category, ['Financial', 'Fitness', 'Career', 'Education', 'Personal Development', 'Travel', 'Other'])) fail('goals', i, 'category');
    requiredNumber(r, 'targetValue', 'goals', i);
    requiredNumber(r, 'currentValue', 'goals', i);
    requiredDate(r, 'startDate', 'goals', i);
    requiredDate(r, 'targetDate', 'goals', i);
    if (!enumValue(r.priority, ['Low', 'Medium', 'High', 'Urgent'])) fail('goals', i, 'priority');
    if (!enumValue(r.status, ['In Progress', 'Completed', 'Paused'])) fail('goals', i, 'status');
    requiredString(r, 'createdAt', 'goals', i);
    optionalString(r, 'description', 'goals', i);
    optionalString(r, 'unit', 'goals', i);
    optionalInstant(r, 'updatedAt', 'goals', i);
  });

  check('milestones', (r, i) => {
    requiredString(r, 'goalId', 'milestones', i);
    if (!ids.goals.has(r.goalId)) fail('milestones', i, 'goalId reference');
    requiredString(r, 'title', 'milestones', i);
    if (typeof r.completed !== 'boolean') fail('milestones', i, 'completed');
    if (r.targetDate !== undefined) requiredDate(r, 'targetDate', 'milestones', i);
    optionalInstant(r, 'completedAt', 'milestones', i);
  });

  check('tasks', (r, i) => {
    requiredString(r, 'title', 'tasks', i);
    requiredDate(r, 'dueDate', 'tasks', i);
    if (!enumValue(r.priority, ['Low', 'Medium', 'High', 'Urgent'])) fail('tasks', i, 'priority');
    if (!enumValue(r.recurring, ['None', 'Daily', 'Weekly', 'Monthly'])) fail('tasks', i, 'recurring');
    if (typeof r.completed !== 'boolean') fail('tasks', i, 'completed');
    requiredString(r, 'createdAt', 'tasks', i);
    optionalString(r, 'description', 'tasks', i);
    optionalString(r, 'category', 'tasks', i);
    optionalString(r, 'notes', 'tasks', i);
    if (r.dueTime !== undefined && !time(r.dueTime)) fail('tasks', i, 'dueTime');
    optionalInstant(r, 'reminderAt', 'tasks', i);
    optionalInstant(r, 'completedAt', 'tasks', i);
    optionalInstant(r, 'updatedAt', 'tasks', i);
    optionalString(r, 'recurrenceRootId', 'tasks', i);
    optionalString(r, 'spawnedTaskId', 'tasks', i);
  });

  check('settings', (r, i) => {
    if (!str(r.key)) fail('settings', i, 'key');
    if (!Object.prototype.hasOwnProperty.call(r, 'value')) fail('settings', i, 'value');
  });

  return names;
}

const rawStorageService: IDataStorage = {
  transactions: {
    async getAll() {
      return db.transactions.reverse().sortBy('date');
    },
    async getById(id: string) {
      return db.transactions.get(id);
    },
    async add(tx) {
      return db.transaction('rw', db.transactions, db.categories, db.financialAccounts, async () => {
        validateTransactionRecord(tx, true);
        await assertTransactionCategory(tx.category, tx.type);
        if (tx.accountId) {
          const account = await db.financialAccounts.get(tx.accountId);
          if (!account || !account.isActive) throw new Error('Choose an active financial account.');
          if (!tx.currencyCode || tx.currencyCode !== account.currencyCode) throw new Error('An assigned transaction must use the account currency.');
        }
        const id = createRecordId('tx');
        const createdAt = new Date().toISOString();
        const record: Transaction = { ...tx, id, createdAt };
        await db.transactions.add(record);
        return record;
      });
    },
    async update(id, updates) {
      await db.transaction('rw', db.transactions, db.categories, db.financialAccounts, async () => {
        const existing = await db.transactions.get(id);
        if (!existing) return;
        const updated = { ...existing, ...updates };
        validateTransactionRecord(updated, true);
        await assertTransactionCategory(updated.category, updated.type, existing);
        if (updated.accountId) {
          const account = await db.financialAccounts.get(updated.accountId);
          if (!account || (!account.isActive && existing.accountId !== updated.accountId)) throw new Error('Choose an active financial account.');
          if (!updated.currencyCode || updated.currencyCode !== account.currencyCode) throw new Error('An assigned transaction must use the account currency.');
        }
        const safeUpdates = { ...updates };
        delete safeUpdates.id;
        delete safeUpdates.createdAt;
        await db.transactions.update(id, {
          ...safeUpdates,
          updatedAt: new Date().toISOString()
        });
      });
    },
    async delete(id) {
      await db.transactions.delete(id);
    },
    async filter({ month, year, category, type, query }) {
      let collection = db.transactions.toCollection();
      let results = await collection.toArray();

      if (year && !month) {
        results = results.filter(t => t.date && t.date.startsWith(year));
      }
      if (month) {
        results = results.filter(t => t.date && t.date.startsWith(month));
      }
      if (category && category !== 'all') {
        results = results.filter(t => t.category === category);
      }
      if (type && type !== 'all') {
        results = results.filter(t => t.type === type);
      }
      if (query) {
        const q = query.toLowerCase();
        results = results.filter(t =>
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q))
        );
      }
      return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
  },
  categories: {
    async getAll() {
      return db.transaction('rw', db.categories, async () => {
        const cats = await db.categories.toArray();
        if (cats.length > 0) return cats;

        // Seed default categories atomically so concurrent app starts cannot race.
        const defaultCats: Category[] = [
          { id: 'cat_sal', name: 'Salary', type: 'income', color: '#10b981', isDefault: true },
          { id: 'cat_free', name: 'Freelance', type: 'income', color: '#3b82f6', isDefault: true },
          { id: 'cat_int', name: 'Interest', type: 'income', color: '#8b5cf6', isDefault: true },
          { id: 'cat_oth_in', name: 'Other Income', type: 'income', color: '#06b6d4', isDefault: true },
          { id: 'cat_rent', name: 'Rent', type: 'expense', color: '#ef4444', isDefault: true },
          { id: 'cat_food', name: 'Food', type: 'expense', color: '#f59e0b', isDefault: true },
          { id: 'cat_trans', name: 'Transport', type: 'expense', color: '#6366f1', isDefault: true },
          { id: 'cat_shop', name: 'Shopping', type: 'expense', color: '#ec4899', isDefault: true },
          { id: 'cat_util', name: 'Utilities', type: 'expense', color: '#8b5cf6', isDefault: true },
          { id: 'cat_health', name: 'Health', type: 'expense', color: '#14b8a6', isDefault: true },
          { id: 'cat_ent', name: 'Entertainment', type: 'expense', color: '#a855f7', isDefault: true },
          { id: 'cat_edu', name: 'Education', type: 'expense', color: '#0284c7', isDefault: true },
          { id: 'cat_emi', name: 'EMIs', type: 'expense', color: '#f97316', isDefault: true },
          { id: 'cat_inv', name: 'Investments', type: 'expense', color: '#10b981', isDefault: true },
          { id: 'cat_oth_ex', name: 'Other Expenses', type: 'expense', color: '#64748b', isDefault: true }
        ];
        await db.categories.bulkAdd(defaultCats);
        return defaultCats;
      });
    },
    async add(cat) {
      const id = createRecordId('cat');
      const record: Category = { ...cat, id };
      await db.categories.add(record);
      return record;
    },
    async update(id, updates) {
      await db.transaction('rw', db.categories, db.transactions, async () => {
        const existing = await db.categories.get(id);
        if (!existing) return;

        const safeUpdates = { ...updates };
        delete safeUpdates.id;

        const identityChanged =
          (safeUpdates.name !== undefined && safeUpdates.name !== existing.name) ||
          (safeUpdates.type !== undefined && safeUpdates.type !== existing.type);

        if (identityChanged) {
          const linkedTransactions = await db.transactions
            .where('category')
            .equals(existing.name)
            .count();

          if (linkedTransactions > 0) {
            throw new Error(
              'Category is used by existing transactions. Reassign those transactions before changing its name or type.'
            );
          }
        }

        await db.categories.update(id, safeUpdates);
      });
    },
    async delete(id) {
      await db.transaction('rw', db.categories, db.budgets, db.transactions, async () => {
        const category = await db.categories.get(id);
        if (!category) return;

        const linkedBudgets = await db.budgets
          .where('categoryId')
          .equals(id)
          .count();

        if (linkedBudgets > 0) {
          throw new Error(
            'Category is linked to one or more budgets. Remove or reassign those budgets before deleting it.'
          );
        }

        const linkedTransactions = await db.transactions
          .where('category')
          .equals(category.name)
          .count();

        if (linkedTransactions > 0) {
          throw new Error(
            'Category is used by existing transactions. Reassign or remove those transactions before deleting it.'
          );
        }

        await db.categories.delete(id);
      });
    }
  },
  budgets: {
    async getAll() {
      return db.budgets.toArray();
    },
    async getByMonth(month) {
      return db.budgets.filter(b => b.monthYear === month).toArray();
    },
    async upsert(budget) {
    validateMoneyMetadata({ ...budget, amount: budget.monthlyAmount });
      return db.transaction('rw', db.budgets, async () => {
        const existing = await db.budgets
          .filter(b => b.monthYear === budget.monthYear && b.categoryId === budget.categoryId)
          .first();

        if (existing) {
          if (existing.currencyCode && budget.currencyCode && existing.currencyCode !== budget.currencyCode) {
            throw new Error('A budget cannot change currency without explicit reconciliation.');
          }
          const updates = { monthlyAmount: budget.monthlyAmount,
            ...(budget.amountMinor !== undefined ? { amountMinor: budget.amountMinor } : {}),
            ...(budget.currencyCode !== undefined ? { currencyCode: budget.currencyCode } : {}) };
          await db.budgets.update(existing.id, updates);
          return { ...existing, ...updates };
        }

        const record: Budget = {
          ...budget,
          id: createRecordId('b'),
          createdAt: new Date().toISOString()
        };
        await db.budgets.add(record);
        return record;
      });
    },
    async delete(id) {
      await db.budgets.delete(id);
    }
  },
  savings: {
    async getGoals() {
      return db.savingsGoals.toArray();
    },
    async addGoal(goal) {
      validateMoneyMetadata({ currencyCode: goal.currencyCode, amountMinor: goal.targetAmountMinor, amount: goal.targetAmount });
      validateMoneyMetadata({ currencyCode: goal.currencyCode, amountMinor: goal.currentAmountMinor, amount: goal.currentAmount });
      const id = createRecordId('sg');
      const record: SavingsGoal = { ...goal, id, createdAt: new Date().toISOString() };
      await db.savingsGoals.add(record);
      return record;
    },
    async updateGoal(id, updates) {
      const safeUpdates = { ...updates };
      delete safeUpdates.id;
      delete safeUpdates.createdAt;
      await db.savingsGoals.update(id, safeUpdates);
    },
    async deleteGoal(id) {
      await db.transaction('rw', db.savingsGoals, db.savingsContributions, async () => {
        await db.savingsGoals.delete(id);
        await db.savingsContributions.where('goalId').equals(id).delete();
      });
    },
    async addContribution(contribution) {
      if (!Number.isFinite(contribution.amount) || contribution.amount <= 0) {
        throw new Error('Savings contribution amount must be a positive finite number');
      }

      await db.transaction(
        'rw',
        db.savingsGoals,
        db.savingsContributions,
        async () => {
          const goal = await db.savingsGoals.get(contribution.goalId);
          if (!goal) throw new Error('Savings goal not found');

          const currencyCode = contribution.currencyCode || goal.currencyCode;
          if (goal.currencyCode && contribution.currencyCode && goal.currencyCode !== contribution.currencyCode) {
            throw new Error('Contribution currency must match its savings goal currency.');
          }
          validateMoneyMetadata({ currencyCode, amountMinor: contribution.amountMinor, amount: contribution.amount });
          const exactContributionMinor = currencyCode
            ? (contribution.amountMinor ? BigInt(contribution.amountMinor) : decimalToMinorUnits(contribution.amount, currencyCode))
            : null;
          const currentMinor = exactContributionMinor === null ? null :
            (goal.currentAmountMinor ? BigInt(goal.currentAmountMinor) : decimalToMinorUnits(goal.currentAmount, currencyCode!));

          const id = createRecordId('sc');
          const nextMinor = currentMinor === null || exactContributionMinor === null ? null : currentMinor + exactContributionMinor;
          await db.savingsGoals.update(goal.id, nextMinor === null ? {
            currentAmount: (goal.currentAmount || 0) + contribution.amount
          } : {
            currentAmount: Number(minorUnitsToDecimal(nextMinor, currencyCode!)),
            currentAmountMinor: nextMinor.toString(10),
            currencyCode
          });
          await db.savingsContributions.add({
            ...contribution, id, createdAt: new Date().toISOString()
          });
        }
      );
    },
    async updateContribution(id, changes) {
      validateMoneyMetadata(changes);
      if (changes.amount !== undefined && (!Number.isFinite(changes.amount) || changes.amount <= 0)) throw new Error('Contribution amount must be greater than zero.');
      if (changes.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(changes.date)) throw new Error('Contribution date must use YYYY-MM-DD format.');
      await db.transaction('rw', db.savingsGoals, db.savingsContributions, async () => {
        const existing = await db.savingsContributions.get(id);
        if (!existing) return;
        const goal = await db.savingsGoals.get(existing.goalId);
        if (!goal) throw new Error('Savings goal missing for contribution.');
        const currencyCode = changes.currencyCode || existing.currencyCode || goal.currencyCode;
        if (goal.currencyCode && currencyCode && goal.currencyCode !== currencyCode) throw new Error('Contribution currency must match its savings goal currency.');
        if (changes.currencyCode && existing.currencyCode && changes.currencyCode !== existing.currencyCode) throw new Error('Changing contribution currency requires an explicit conversion.');
        let nextGoal: Partial<SavingsGoal>;
        if (currencyCode) {
          const oldMinor = existing.amountMinor ? BigInt(existing.amountMinor) : decimalToMinorUnits(existing.amount, currencyCode);
          const newAmount = changes.amount ?? existing.amount;
          const newMinor = changes.amountMinor ? BigInt(changes.amountMinor) : decimalToMinorUnits(newAmount, currencyCode);
          const currentMinor = goal.currentAmountMinor ? BigInt(goal.currentAmountMinor) : decimalToMinorUnits(goal.currentAmount, currencyCode);
          const nextMinor = currentMinor - oldMinor + newMinor;
          if (nextMinor < 0n) throw new Error('Contribution history does not reconcile with the saved goal amount.');
          nextGoal = { currentAmountMinor: nextMinor.toString(10), currentAmount: Number(minorUnitsToDecimal(nextMinor, currencyCode)), currencyCode };
          changes = { ...changes, amount: Number(minorUnitsToDecimal(newMinor, currencyCode)), amountMinor: newMinor.toString(10), currencyCode };
        } else {
          const newAmount = changes.amount ?? existing.amount;
          const next = goal.currentAmount - existing.amount + newAmount;
          if (!Number.isFinite(newAmount) || newAmount <= 0 || next < -1e-9) throw new Error('Contribution edit would make the savings total invalid.');
          nextGoal = { currentAmount: Math.max(0, next) };
        }
        const safe = { ...changes };
        delete (safe as any).id; delete (safe as any).goalId; delete (safe as any).createdAt;
        await db.savingsGoals.update(goal.id, nextGoal);
        await db.savingsContributions.update(id, safe);
      });
    },
    async deleteContribution(id) {
      await db.transaction('rw', db.savingsGoals, db.savingsContributions, async () => {
        const contribution = await db.savingsContributions.get(id);
        if (!contribution) return;
        const goal = await db.savingsGoals.get(contribution.goalId);
        if (!goal) throw new Error('Savings goal missing for contribution.');
        const currencyCode = contribution.currencyCode || goal.currencyCode;
        if (currencyCode) {
          const amountMinor = contribution.amountMinor ? BigInt(contribution.amountMinor) : decimalToMinorUnits(contribution.amount, currencyCode);
          const currentMinor = goal.currentAmountMinor ? BigInt(goal.currentAmountMinor) : decimalToMinorUnits(goal.currentAmount, currencyCode);
          const nextMinor = currentMinor - amountMinor;
          if (nextMinor < 0n) throw new Error('Contribution history does not reconcile with the saved goal amount.');
          await db.savingsGoals.update(goal.id, { currentAmountMinor: nextMinor.toString(10), currentAmount: Number(minorUnitsToDecimal(nextMinor, currencyCode)) });
        } else {
          const next = goal.currentAmount - contribution.amount;
          if (next < -1e-9) throw new Error('Contribution history does not reconcile with the saved goal amount.');
          await db.savingsGoals.update(goal.id, { currentAmount: Math.max(0, next) });
        }
        await db.savingsContributions.delete(id);
      });
    },
    async getContributions(goalId) {
      const rows = goalId ? await db.savingsContributions.where('goalId').equals(goalId).toArray() : await db.savingsContributions.toArray();
      return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }
  },
  accounts: {
    async getAll() { return (await db.financialAccounts.toArray()).sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)); },
    async add(input) {
      validateFinancialAccount(input);
      const record: FinancialAccount = { ...input, name: input.name.trim(), description: input.description?.trim() || undefined, id: createRecordId('acct'), createdAt: new Date().toISOString() };
      await db.financialAccounts.add(record);
      return record;
    },
    async update(id, updates) {
      await db.transaction('rw', db.financialAccounts, db.transactions, db.accountTransfers, async () => {
        const existing = await db.financialAccounts.get(id);
        if (!existing) return;
        const updated = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        validateFinancialAccount(updated);
        if (updated.currencyCode !== existing.currencyCode || updated.openingBalanceMinor !== existing.openingBalanceMinor) {
          const hasTransactions = await db.transactions.where('accountId').equals(id).count();
          const hasTransfers = await db.accountTransfers.filter(row => row.fromAccountId === id || row.toAccountId === id).count();
          if (hasTransactions || hasTransfers) {
            if (updated.currencyCode !== existing.currencyCode) throw new Error('An account currency cannot change after it has financial activity. Create another account instead.');
            throw new Error('An opening balance cannot change after account activity exists because that would rewrite historical balances. Keep the account for history and create another account if needed.');
          }
        }
        await db.financialAccounts.put({ ...updated, name: updated.name.trim(), description: updated.description?.trim() || undefined });
      });
    },
    async archive(id) { await db.financialAccounts.update(id, { isActive: false, updatedAt: new Date().toISOString() }); },
    async delete(id) {
      await db.transaction('rw', db.financialAccounts, db.transactions, db.accountTransfers, db.plannedCommitments, async () => {
        const hasTransactions = await db.transactions.where('accountId').equals(id).count();
        const hasTransfers = await db.accountTransfers.filter(row => row.fromAccountId === id || row.toAccountId === id).count();
        const hasCommitments = await db.plannedCommitments.where('accountId').equals(id).count();
        if (hasTransactions || hasTransfers || hasCommitments) throw new Error('This account has financial history. Archive it to keep that history intact.');
        const account = await db.financialAccounts.get(id);
        if (account && BigInt(account.openingBalanceMinor) !== 0n) throw new Error('This account has a non-zero opening balance. Archive it to preserve that amount.');
        await db.financialAccounts.delete(id);
      });
    },
    async getTransfers(accountId) {
      return (await db.accountTransfers.toArray()).filter(row => !accountId || row.fromAccountId === accountId || row.toAccountId === accountId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    },
    async addTransfer(input) {
      if ((input as AccountTransfer).reversalOfId) throw new Error('Reversals must be created from an existing transfer.');
      const record: AccountTransfer = { ...input, id: input.id || createRecordId('transfer'), createdAt: new Date().toISOString() };
      await db.transaction('rw', db.financialAccounts, db.accountTransfers, async () => {
        const [source, destination] = await Promise.all([db.financialAccounts.get(record.fromAccountId), db.financialAccounts.get(record.toAccountId)]);
        if (!source || !destination) throw new Error('Both transfer accounts must exist.');
        if (!source.isActive || !destination.isActive) throw new Error('Archived accounts cannot be used for new transfers.');
        validateAccountTransfer(record, source, destination);
        await db.accountTransfers.add(record);
      });
      return record;
    },
    async reverseTransfer(id, date) {
      const record = await db.transaction('rw', db.financialAccounts, db.accountTransfers, async () => {
        const original = await db.accountTransfers.get(id);
        if (!original || original.reversalOfId) throw new Error('Only an original transfer can be reversed.');
        if (await db.accountTransfers.filter(row => row.reversalOfId === id).count()) throw new Error('This transfer has already been reversed.');
        const [source, destination] = await Promise.all([db.financialAccounts.get(original.toAccountId), db.financialAccounts.get(original.fromAccountId)]);
        if (!source || !destination) throw new Error('Transfer accounts are unavailable; no reversal was created.');
        const reversal: AccountTransfer = { id: createRecordId('transfer-reversal'), fromAccountId: original.toAccountId, toAccountId: original.fromAccountId,
          fromAmountMinor: original.toAmountMinor, toAmountMinor: original.fromAmountMinor, fromCurrencyCode: original.toCurrencyCode, toCurrencyCode: original.fromCurrencyCode,
          reversalOfId: original.id, date, notes: `Reversal of ${original.id}`, createdAt: new Date().toISOString() };
        validateAccountTransfer(reversal, source, destination);
        await db.accountTransfers.add(reversal);
        return reversal;
      });
      return record;
    },
    async updateTransfer(id, updates) {
      await db.transaction('rw', db.financialAccounts, db.accountTransfers, async () => {
        const existing = await db.accountTransfers.get(id);
        if (!existing) return;
        const allTransfers = await db.accountTransfers.toArray();
        if (existing.reversalOfId || allTransfers.some(row => row.reversalOfId === id)) throw new Error('A reversed transfer is locked to preserve its audit trail. Remove its reversal before editing.');
        const updated = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        const [source, destination] = await Promise.all([db.financialAccounts.get(updated.fromAccountId), db.financialAccounts.get(updated.toAccountId)]);
        if (!source || !destination) throw new Error('Both transfer accounts must exist.');
        validateAccountTransfer(updated, source, destination);
        await db.accountTransfers.put(updated);
      });
    },
    async deleteTransfer(id) {
      await db.transaction('rw', db.accountTransfers, async () => {
        const existing = await db.accountTransfers.get(id);
        if (!existing) return;
        if (!existing.reversalOfId && await db.accountTransfers.filter(row => row.reversalOfId === id).count()) throw new Error('Remove the reversal before deleting the original transfer.');
        await db.accountTransfers.delete(id);
      });
    }
  },
  exchangeRates: {
    async getAll() { return (await db.manualExchangeRates.toArray()).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || a.baseCurrencyCode.localeCompare(b.baseCurrencyCode)); },
    async add(input) {
      const record: ManualExchangeRate = { ...input, id: createRecordId('fx'), createdAt: new Date().toISOString() };
      validateManualExchangeRate(record);
      await db.transaction('rw', db.manualExchangeRates, async () => {
        const duplicate = await db.manualExchangeRates.where('[baseCurrencyCode+quoteCurrencyCode]').equals([record.baseCurrencyCode, record.quoteCurrencyCode]).filter(row => row.effectiveDate === record.effectiveDate).count();
        if (duplicate) throw new Error('A rate already exists for this currency pair and date. Edit it instead.');
        await db.manualExchangeRates.add(record);
      });
      return record;
    },
    async update(id, updates) {
      await db.transaction('rw', db.manualExchangeRates, async () => {
        const existing = await db.manualExchangeRates.get(id);
        if (!existing) return;
        const updated = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        validateManualExchangeRate(updated);
        const duplicate = await db.manualExchangeRates.where('[baseCurrencyCode+quoteCurrencyCode]').equals([updated.baseCurrencyCode, updated.quoteCurrencyCode]).filter(row => row.id !== id && row.effectiveDate === updated.effectiveDate).count();
        if (duplicate) throw new Error('A rate already exists for this currency pair and date.');
        await db.manualExchangeRates.put(updated);
      });
    },
    async delete(id) { await db.manualExchangeRates.delete(id); }
  },
  commitments: {
    async getAll() { return (await db.plannedCommitments.toArray()).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate) || a.title.localeCompare(b.title)); },
    async add(input) {
      const record: PlannedCommitment = { ...input, id: createRecordId('commitment'), createdAt: new Date().toISOString() };
      validatePlannedCommitment(record);
      await db.transaction('rw', db.plannedCommitments, db.financialAccounts, db.categories, async () => {
        validatePlannedCommitmentReferences(record, await db.financialAccounts.toArray(), await db.categories.toArray());
        await db.plannedCommitments.add(record);
      });
      return record;
    },
    async update(id, updates) {
      await db.transaction('rw', db.plannedCommitments, db.financialAccounts, db.categories, async () => {
        const existing = await db.plannedCommitments.get(id);
        if (!existing) return;
        const updated = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        validatePlannedCommitment(updated);
        validatePlannedCommitmentReferences(updated, await db.financialAccounts.toArray(), await db.categories.toArray());
        await db.plannedCommitments.put(updated);
      });
    },
    async delete(id) { await db.plannedCommitments.delete(id); }
  },
  habits: {
    async getAll() {
      return db.habits.filter(h => !h.archived).toArray();
    },
    async add(habit) {
      const id = createRecordId('h');
      const record: Habit = { ...habit, id, createdAt: new Date().toISOString() };
      await db.habits.add(record);
      return record;
    },
    async update(id, updates) {
      const safeUpdates = { ...updates };
      delete safeUpdates.id;
      delete safeUpdates.createdAt;
      await db.habits.update(id, safeUpdates);
    },
    async delete(id) {
      await db.transaction('rw', db.habits, db.habitLogs, async () => {
        await db.habits.delete(id);
        await db.habitLogs.where('habitId').equals(id).delete();
      });
    },
    async getLogs(habitId) {
      if (habitId) return db.habitLogs.where('habitId').equals(habitId).toArray();
      return db.habitLogs.toArray();
    },
    async logCompletion(habitId, date, completed) {
      if (typeof habitId !== 'string' || !habitId.trim()) {
        throw new Error('Habit ID is required');
      }
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Habit log date must use YYYY-MM-DD format');
      }
      const [year, month, day] = date.split('-').map(Number);
      const parsedDate = new Date(Date.UTC(year, month - 1, day));
      if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
      ) {
        throw new Error('Habit log date must be a valid calendar date');
      }
      if (typeof completed !== 'boolean') {
        throw new Error('Habit completion status must be boolean');
      }

      await db.transaction('rw', db.habits, db.habitLogs, async () => {
        const habit = await db.habits.get(habitId);
        if (!habit) throw new Error('Habit not found');

        const existing = await db.habitLogs
          .where('[habitId+date]')
          .equals([habitId, date])
          .first();

        const completedAt = completed ? new Date().toISOString() : undefined;

        if (existing) {
          await db.habitLogs.update(existing.id, { completed, completedAt });
        } else {
          const id = createRecordId('hl');
          await db.habitLogs.add({ id, habitId, date, completed, completedAt });
        }
      });
    }
  },
  goals: {
    async getAll() {
      return db.goals.toArray();
    },
    async getAllMilestones() {
      return db.milestones.toArray();
    },
    async add(goal) {
      const id = createRecordId('g');
      const record: Goal = { ...goal, id, createdAt: new Date().toISOString() };
      await db.goals.add(record);
      return record;
    },
    async update(id, updates) {
      const safeUpdates = { ...updates };
      delete safeUpdates.id;
      delete safeUpdates.createdAt;

      await db.transaction('rw', db.goals, db.milestones, async () => {
        const current = await db.goals.get(id);
        if (!current) return;

        const next = {
          ...current,
          ...safeUpdates,
          updatedAt: new Date().toISOString()
        };
        const milestones = await db.milestones.where('goalId').equals(id).toArray();
        const eligible =
          Number(next.targetValue) > 0 &&
          Number(next.currentValue) >= Number(next.targetValue) &&
          milestones.every(item => item.completed);

        if (next.status !== 'Paused') {
          next.status = eligible ? 'Completed' :
            (next.status === 'Completed' ? 'In Progress' : next.status);
        }

        await db.goals.put(next);
      });
    },
    async delete(id) {
      await db.transaction('rw', db.goals, db.milestones, async () => {
        await db.goals.delete(id);
        await db.milestones.where('goalId').equals(id).delete();
      });
    },
    async getMilestones(goalId) {
      return db.milestones.where('goalId').equals(goalId).toArray();
    },
    async addMilestone(milestone) {
      const id = createRecordId('m');
      const record: Milestone = { ...milestone, id };
      await db.transaction('rw', db.goals, db.milestones, async () => {
        if (!(await db.goals.get(record.goalId))) throw new Error('Milestone goal does not exist.');
        await db.milestones.add(record);
      });
      return record;
    },
    async toggleMilestone(id, completed) {
      await db.transaction('rw', db.milestones, db.goals, async () => {
        const milestone = await db.milestones.get(id);
        if (!milestone) return;

        await db.milestones.update(id, {
          completed,
          completedAt: completed ? new Date().toISOString() : undefined
        });

        const goal = await db.goals.get(milestone.goalId);
        if (!goal) return;

        const milestones = await db.milestones
          .where('goalId').equals(milestone.goalId).toArray();

        const eligible =
          Number(goal.targetValue) > 0 &&
          Number(goal.currentValue) >= Number(goal.targetValue) &&
          milestones.every(item => item.completed);

        if (goal.status !== 'Paused') {
          const nextStatus = eligible ? 'Completed' :
            (goal.status === 'Completed' ? 'In Progress' : goal.status);

          if (nextStatus !== goal.status) {
            await db.goals.update(goal.id, {
              status: nextStatus,
              updatedAt: new Date().toISOString()
            });
          }
        }
      });
    },
    async deleteMilestone(id) {
      await db.milestones.delete(id);
    }
  },
  tasks: {
    async getAll() {
      return db.tasks.toArray();
    },
    async add(task) {
      const id = createRecordId('t');
      const record: Task = { ...task, id, createdAt: new Date().toISOString() };
      await db.tasks.add(record);
      return record;
    },
    async update(id, updates) {
      const safeUpdates = { ...updates };
      delete safeUpdates.id;
      delete safeUpdates.createdAt;
      await db.tasks.update(id, {
        ...safeUpdates,
        updatedAt: new Date().toISOString()
      });
    },
    async delete(id) {
      await db.tasks.delete(id);
    },
    async toggleCompleted(id, completed) {
      await db.transaction('rw', db.tasks, async () => {
        const task = await db.tasks.get(id);
        if (!task) return;

        if (!completed) {
          if (task.completed) {
            if (task.spawnedTaskId) {
              const spawnedTask = await db.tasks.get(task.spawnedTaskId);
              if (spawnedTask && !spawnedTask.updatedAt) {
                await db.tasks.delete(task.spawnedTaskId);
              }
            }
            await db.tasks.update(id, {
              completed: false,
              completedAt: undefined,
              spawnedTaskId: undefined,
              updatedAt: new Date().toISOString()
            });
          }
          return;
        }

        if (task.recurring && task.recurring !== 'None' && !task.completed) {
          const nextDueDate = getNextRecurringTaskDate(task.dueDate, task.recurring);
          const rootId = getRecurrenceRootId(task);
          const nextTaskId = `rec_${rootId}_${nextDueDate}`;
          const existingOccurrence = await db.tasks.get(nextTaskId);

          if (!existingOccurrence) {
            await db.tasks.add({
              id: nextTaskId,
              title: task.title,
              description: task.description,
              dueDate: nextDueDate,
              dueTime: task.dueTime,
              reminderAt: task.reminderAt,
              priority: task.priority,
              category: task.category,
              notes: task.notes,
              recurring: task.recurring,
              recurrenceRootId: rootId,
              completed: false,
              createdAt: new Date().toISOString()
            });
          }

          await db.tasks.update(id, { spawnedTaskId: nextTaskId });
        }

        if (!task.completed) {
          const now = new Date().toISOString();
          await db.tasks.update(id, {
            completed: true,
            completedAt: now,
            updatedAt: now
          });
        }
      });
    }
  },
  settings: {
    async get<T>(key: string, defaultValue: T): Promise<T> {
      const record = await db.settings.get(key);
      return record ? (record.value as T) : defaultValue;
    },
    async set(key: string, value: any): Promise<void> {
      await db.settings.put({ key, value });
    }
  },
  backup: {
    async hasData() {
      const counts = await Promise.all([
        db.transactions.count(),
        db.categories.count(),
        db.budgets.count(),
        db.savingsGoals.count(),
        db.savingsContributions.count(),
        db.financialAccounts.count(), db.accountTransfers.count(), db.manualExchangeRates.count(), db.plannedCommitments.count(),
        db.habits.count(),
        db.habitLogs.count(),
        db.goals.count(),
        db.milestones.count(),
        db.tasks.count(),
        db.settings.count()
      ]);
      return counts.some(count => count > 0);
    },
    async exportData() {
      const tables = [
        db.transactions, db.categories, db.budgets, db.savingsGoals,
        db.savingsContributions, db.financialAccounts, db.accountTransfers, db.manualExchangeRates, db.plannedCommitments, db.habits, db.habitLogs, db.goals,
        db.milestones, db.tasks, db.settings
      ];
      return db.transaction('r', tables, async () => {
        const exportObj = {
          app: 'LifeOS',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          tables: {
            transactions: await db.transactions.toArray(),
            categories: await db.categories.toArray(),
            budgets: await db.budgets.toArray(),
            savingsGoals: await db.savingsGoals.toArray(),
            savingsContributions: await db.savingsContributions.toArray(),
            financialAccounts: await db.financialAccounts.toArray(),
            accountTransfers: await db.accountTransfers.toArray(),
            manualExchangeRates: await db.manualExchangeRates.toArray(),
            plannedCommitments: await db.plannedCommitments.toArray(),
            habits: await db.habits.toArray(),
            habitLogs: await db.habitLogs.toArray(),
            goals: await db.goals.toArray(),
            milestones: await db.milestones.toArray(),
            tasks: await db.tasks.toArray(),
            settings: await db.settings.toArray()
          }
        };
        return JSON.stringify(exportObj, null, 2);
      });
    },
    async importData(jsonData: string, options: { replaceExisting?: boolean } = {}) {
      let parsed: any;
      try {
        parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      } catch (e) {
        throw new Error('Invalid JSON format');
      }

      if (!parsed || (!parsed.tables && !parsed.data)) {
        throw new Error('Invalid backup schema: missing tables or data object');
      }

      const tablesData = parsed.tables || parsed.data;
      const tableNames = validateBackupTables(tablesData);

      const existingCounts = await Promise.all([
        db.transactions.count(), db.categories.count(), db.budgets.count(), db.savingsGoals.count(), db.savingsContributions.count(),
        db.financialAccounts.count(), db.accountTransfers.count(), db.manualExchangeRates.count(), db.plannedCommitments.count(),
        db.habits.count(), db.habitLogs.count(), db.goals.count(), db.milestones.count(), db.tasks.count(), db.settings.count()
      ]);
      if (existingCounts.some(count => count > 0) && !options.replaceExisting) {
        throw new Error('Existing LifeOS data was found. Confirm replacement before restoring this backup.');
      }
      const counts: Record<string, number> = {};

      await db.transaction('rw', [
        db.transactions,
        db.categories,
        db.budgets,
        db.savingsGoals,
        db.savingsContributions,
        db.financialAccounts, db.accountTransfers, db.manualExchangeRates, db.plannedCommitments,
        db.habits,
        db.habitLogs,
        db.goals,
        db.milestones,
        db.tasks,
        db.settings
      ], async () => {
        const liveCounts = await Promise.all([
          db.transactions.count(), db.categories.count(), db.budgets.count(), db.savingsGoals.count(),
          db.savingsContributions.count(), db.financialAccounts.count(), db.accountTransfers.count(), db.manualExchangeRates.count(), db.plannedCommitments.count(), db.habits.count(), db.habitLogs.count(), db.goals.count(),
          db.milestones.count(), db.tasks.count(), db.settings.count()
        ]);
        if (liveCounts.some(count => count > 0) && !options.replaceExisting) {
          throw new Error('Existing LifeOS data was found. Confirm replacement before restoring this backup.');
        }
        for (const table of tableNames) {
          const records = tablesData[table] as any[];
          await (db as any)[table].clear();
          if (records.length) await (db as any)[table].bulkPut(records);
          const actualCount = await (db as any)[table].count();
          if (actualCount !== records.length) {
            throw new Error(`Restore verification failed for ${table}: expected ${records.length}, found ${actualCount}`);
          }
          counts[table] = actualCount;
        }
      });
      return { success: true, counts };
    },
    async clearAll() {
      const tables = [
        db.transactions, db.categories, db.budgets, db.savingsGoals,
        db.savingsContributions, db.financialAccounts, db.accountTransfers, db.manualExchangeRates, db.plannedCommitments, db.habits, db.habitLogs, db.goals,
        db.milestones, db.tasks, db.settings
      ];
      await db.transaction('rw', tables, async () => {
        for (const table of tables) {
          await table.clear();
        }
      });
      // This parent operation already owns a session lease.
      await rawStorageService.categories.getAll();
    },
        async seedDemoData() {
      // User-initiated optional demo data
      const today = new Date().toISOString().split('T')[0];
      const curMonth = today.substring(0, 7);

      const demoTxs: Omit<Transaction, 'id' | 'createdAt'>[] = [
        { type: 'income', amount: 95000, category: 'Salary', description: 'Tech Consultancy Salary', date: `${curMonth}-01`, paymentMethod: 'Bank Transfer' },
        { type: 'income', amount: 15000, category: 'Freelance', description: 'Web Architecture Sprint', date: `${curMonth}-15`, paymentMethod: 'Net Banking' },
        { type: 'expense', amount: 28000, category: 'Rent', description: 'Apartment Monthly Rent', date: `${curMonth}-02`, paymentMethod: 'UPI' },
        { type: 'expense', amount: 6500, category: 'Food', description: 'Organic Pantry Provisions', date: `${curMonth}-08`, paymentMethod: 'Credit Card' },
        { type: 'expense', amount: 2400, category: 'Utilities', description: 'Fiber Broadband & Power', date: `${curMonth}-12`, paymentMethod: 'UPI' },
        { type: 'expense', amount: 12000, category: 'Investments', description: 'Index Equity SIP', date: `${curMonth}-05`, paymentMethod: 'Bank Transfer' }
      ];
      for (const tx of demoTxs) await rawStorageService.transactions.add(tx);

      await rawStorageService.budgets.upsert({ monthlyAmount: 60000, monthYear: curMonth });
      await rawStorageService.budgets.upsert({ categoryId: 'cat_food', monthlyAmount: 12000, monthYear: curMonth });

      const goal = await rawStorageService.savings.addGoal({
        title: 'Emergency Reserve Fund',
        targetAmount: 200000,
        currentAmount: 85000,
        targetDate: '2026-12-31',
        category: 'Financial'
      });
      await rawStorageService.savings.addContribution({
        goalId: goal.id,
        amount: 20000,
        date: `${curMonth}-05`,
        notes: 'Monthly savings contribution'
      });

      const h1 = await rawStorageService.habits.add({ name: 'Drink 3L Water', frequency: 'daily', color: '#3b82f6' });
      const h2 = await rawStorageService.habits.add({ name: 'Walk 10,000 steps', frequency: 'daily', color: '#10b981' });
      const h3 = await rawStorageService.habits.add({ name: 'Read 20 pages', frequency: 'daily', color: '#8b5cf6' });

      // Add streaks
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      await rawStorageService.habits.logCompletion(h1.id, yesterday, true);
      await rawStorageService.habits.logCompletion(h1.id, today, true);
      await rawStorageService.habits.logCompletion(h2.id, yesterday, true);

      const g = await rawStorageService.goals.add({
        title: 'Run Half Marathon (21.1 km)',
        description: 'Prepare endurance for state marathon event',
        category: 'Fitness',
        targetValue: 21.1,
        currentValue: 10.0,
        unit: 'km',
        startDate: '2026-09-01',
        targetDate: '2026-12-31',
        priority: 'High',
        status: 'In Progress'
      });
      await rawStorageService.goals.addMilestone({ goalId: g.id, title: '5km continuous run', completed: true });
      await rawStorageService.goals.addMilestone({ goalId: g.id, title: '10km non-stop run', completed: true });
      await rawStorageService.goals.addMilestone({ goalId: g.id, title: '15km long trail run', completed: false });

      await rawStorageService.tasks.add({ title: 'Quarterly financial audit & mutual fund rebalancing', dueDate: today, priority: 'Urgent', category: 'Finance', recurring: 'None', completed: false });
      await rawStorageService.tasks.add({ title: '5km recovery jog at neighborhood track', dueDate: today, priority: 'Medium', category: 'Fitness', recurring: 'Daily', completed: true });
      await rawStorageService.tasks.add({ title: 'Android 16 offline build verification', dueDate: today, priority: 'High', category: 'Career', recurring: 'None', completed: false }); }
  }
};

/**
 * Separately constructed encrypted runtime.
 *
 * Construction does not provision keys, unlock encryption, migrate records,
 * or replace the active StorageService.
 */
export const encryptedStorageRuntime = createLifeOSEncryptedRuntime(
  db as unknown as LifeOSRawDatabase & LifeOSDatabaseWithTransactions,
  {
    createRecordId,
    validateTransactionRecord,
    validateBackupTables,
    getNextRecurringTaskDate: (task, fromDate) =>
      getNextRecurringTaskDate(task.dueDate, task.recurring, fromDate),
    getRecurrenceRootId,
  }
);


/**
 * Application-level authorization guard.
 *
 * Only explicitly allowlisted bootstrap settings are readable while locked.
 * All other StorageService operations require an authenticated session.
 *
 * This is not a cryptographic boundary: direct IndexedDB access remains
 * possible to code executing inside a compromised WebView.
 */
export const sessionManager = createSessionManager();

/**
 * Active storage target. Raw storage remains active until explicit,
 * successful encrypted migration.
 */
let activeStorageTarget: IDataStorage = rawStorageService;
let encryptedStorageActivated = false;

/**
 * Migrate existing records and activate encrypted storage.
 *
 * The native key must already be unlocked and the user must have either
 * confirmed recovery-kit setup or explicitly deferred it during first setup.
 * This function never provisions a key or falls back to raw storage after
 * migration failure.
 */
export async function activateEncryptedStorage(): Promise<void> {
  if (encryptedStorageActivated) return;

  if (!sessionManager.isUnlocked()) {
    throw new Error('LifeOS session must be authenticated before encrypted storage activation.');
  }

  // Native Android Keystore state is authoritative; never trust an in-memory
  // activation flag or silently fall back to plaintext storage after restart.
  const keyState = await CryptoService.getKeyState();

  if (!keyState.metadataConsistent || keyState.recoveryNeedsRebind) {
    throw new Error('Encryption metadata is inconsistent. Recover or rebind the encryption key before opening LifeOS data.');
  }

  if (!keyState.keyProvisioned || !keyState.keystoreAliasPresent) {
    throw new Error('The LifeOS encryption key is not available in Android Keystore.');
  }

  if (!keyState.recoveryProvisioned && !keyState.recoveryDeferred) {
    throw new Error('Recovery protection has not been confirmed or explicitly deferred. Encrypted storage remains locked.');
  }

  if (!keyState.unlocked || !(await CryptoService.isUnlocked())) {
    throw new Error('The native encryption key is locked. Authenticate before activating encrypted storage.');
  }

  const migrationGeneration = sessionManager.lock();
  await sessionManager.waitForIdle();

  try {
    // Migration is idempotent and resumes partially migrated databases.
    await encryptedStorageRuntime.migrateExistingRecords();

    // Recheck the native key before switching the application storage target.
    const verifiedState = await CryptoService.getKeyState();
    if (
      !verifiedState.metadataConsistent ||
      verifiedState.recoveryNeedsRebind ||
      !verifiedState.keyProvisioned ||
      (!verifiedState.recoveryProvisioned && !verifiedState.recoveryDeferred) ||
      !verifiedState.keystoreAliasPresent ||
      !verifiedState.unlocked ||
      !(await CryptoService.isUnlocked())
    ) {
      throw new Error('Native encryption state changed during migration. Storage activation was blocked.');
    }

    if (sessionManager.getGeneration() !== migrationGeneration) {
      throw new Error('Encrypted migration expired after app lock. Retry in the foreground.');
    }
    activeStorageTarget = encryptedStorageRuntime.storage as IDataStorage;
    encryptedStorageActivated = true;
    sessionManager.unlock();
  } catch (error) {
    // Fail closed. Do not leave the native key available after failed migration.
    activeStorageTarget = rawStorageService;
    encryptedStorageActivated = false;
    sessionManager.lock();

    try {
      await CryptoService.lock();
    } catch {
      // Preserve the original migration/activation error.
    }

    throw error;
  }
}
export function isEncryptedStorageActivated(): boolean {
  return encryptedStorageActivated;
}


const READ_OPERATIONS: Record<string, Set<string>> = {
  transactions: new Set(['getAll', 'getById', 'filter']),
  categories: new Set(['getAll']),
  budgets: new Set(['getAll', 'getByMonth']),
  savings: new Set(['getGoals', 'getContributions']),
  habits: new Set(['getAll', 'getLogs']),
  goals: new Set(['getAll', 'getAllMilestones', 'getMilestones']),
  tasks: new Set(['getAll']),
  settings: new Set(['get']),
  backup: new Set(['hasData', 'exportData'])
};

function protectStorage<T extends object>(namespace = ''): T {
  const resolveTarget = (): object => {
    const segments = namespace ? namespace.split('.') : [];
    let current: object = activeStorageTarget as object;

    for (const segment of segments) {
      const next = Reflect.get(current, segment, current);
      if (!next || (typeof next !== 'object' && typeof next !== 'function')) {
        throw new Error(`Storage namespace unavailable: ${namespace}`);
      }
      current = next as object;
    }

    return current;
  };

  return new Proxy({} as T, {
    get(_proxyTarget, property) {
      const object = resolveTarget();
      const value = Reflect.get(object, property, object);

      if (value && typeof value === 'object') {
        const childNamespace = namespace
          ? `${namespace}.${String(property)}`
          : String(property);
        return protectStorage(childNamespace);
      }

      if (typeof value !== 'function') return value;

      return async (...args: unknown[]) => {
        const isBootstrapSetting =
          namespace === 'settings' &&
          (property === 'get' || property === 'set') &&
          typeof args[0] === 'string' &&
          BOOTSTRAP_SETTING_KEYS.has(args[0]);

        // Session authorization alone never permits access to the legacy
        // plaintext backend. This also covers callbacks retained by the UI.
        if (!isBootstrapSetting && !encryptedStorageActivated) {
          sessionManager.lock();
          throw new Error('Encrypted storage is not ready. Complete secure provisioning before opening private data.');
        }

        const token = isBootstrapSetting
          ? null
          : sessionManager.beginOperation();

        try {
          // Resolve again at invocation time so calls use the active backend.
          const currentObject = resolveTarget();
          const currentMethod = Reflect.get(
            currentObject,
            property,
            currentObject
          );

          if (typeof currentMethod !== 'function') {
            throw new Error(`Storage operation unavailable: ${String(property)}`);
          }

          const result = await Reflect.apply(
            currentMethod,
            currentObject,
            args
          );

          const isRead =
            typeof property === 'string' &&
            READ_OPERATIONS[namespace]?.has(property) === true;

          // Prevent private reads from returning stale data after lock.
          if (token !== null && isRead) {
            sessionManager.assertCurrent(token);
          }

          return result;
        } finally {
          if (token !== null) sessionManager.endOperation();
        }
      };
    }
  });
}

export const StorageService: IDataStorage = protectStorage();
