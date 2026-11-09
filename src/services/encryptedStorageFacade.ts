import type {
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
  Task,
} from '../types';

import type {
  EncryptedTable,
} from './encryptedRecordCodec';

import type {
  EncryptedRepositories,
  PreparedMutation,
} from './encryptedTransactionCoordinator';
import { sortTransactions } from './domainUtils';
import { decimalToMinorUnits, getCurrencyMetadata, minorUnitsToDecimal } from './financeCore';
import { validateAccountTransfer, validateFinancialAccount, validateManualExchangeRate, validatePlannedCommitment, validatePlannedCommitmentReferences } from './financialAccounting';

function validateMoneyMetadata(value: { currencyCode?: string; amountMinor?: string; amount?: number }): void {
  if (value.currencyCode !== undefined && getCurrencyMetadata(value.currencyCode).code !== value.currencyCode) {
    throw new Error('Currency code must use canonical ISO 4217 capitalization.');
  }
  if (value.amountMinor !== undefined &&
      (typeof value.amountMinor !== 'string' || !/^(0|[1-9]\d*)$/.test(value.amountMinor))) {
    throw new Error('Minor-unit amount must be a non-negative integer string.');
  }
  if (value.amountMinor !== undefined && !value.currencyCode) {
    throw new Error('Minor-unit amount requires an explicit currency.');
  }
  if (value.amountMinor !== undefined && value.currencyCode && value.amount !== undefined &&
      decimalToMinorUnits(value.amount, value.currencyCode) !== BigInt(value.amountMinor)) {
    throw new Error('Major and minor-unit financial amounts do not agree.');
  }
}

export interface EncryptedStorageTransaction {
  run<T>(
    operation: (context: {
      get<T>(table: EncryptedTable, id: string): Promise<T | undefined>;
      getAll<T>(table: EncryptedTable): Promise<T[]>;
      put<T>(table: EncryptedTable, record: T): void;
      add<T>(table: EncryptedTable, record: T): void;
      delete(table: EncryptedTable, id: string): void;
      clear(table: EncryptedTable): void;
    }) => Promise<T>
  ): Promise<T>;
}

export interface EncryptedStorageHelpers {
  createRecordId(prefix: string): string;
  validateTransactionRecord(
    record: Partial<Transaction>,
    requireComplete: boolean
  ): void;
  /** Throws on invalid data; returns validated table names, never error messages. */
  validateBackupTables(tables: unknown): string[];
  getNextRecurringTaskDate(
    task: Task,
    fromDate?: string
  ): string | null;
  getRecurrenceRootId(task: Task): string;
}

const TABLES: EncryptedTable[] = [
  'transactions',
  'categories',
  'budgets',
  'savingsGoals',
  'savingsContributions',
  'financialAccounts',
  'accountTransfers',
  'manualExchangeRates',
  'plannedCommitments',
  'habits',
  'habitLogs',
  'goals',
  'milestones',
  'tasks',
  'settings',
];

const DEFAULT_CATEGORIES: Category[] = [
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
  { id: 'cat_oth_ex', name: 'Other Expenses', type: 'expense', color: '#64748b', isDefault: true },
];

function sortByDate<T extends { date: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

function identity(table: EncryptedTable, row: any): string {
  return table === 'settings' ? row.key : row.id;
}

function reconcileGoal(goal: Goal, milestones: Milestone[]): Goal {
  if (goal.status === 'Paused') return goal;
  const eligible = Number(goal.targetValue) > 0 &&
    Number(goal.currentValue) >= Number(goal.targetValue) &&
    milestones.every(item => item.completed);
  return { ...goal, status: eligible ? 'Completed' :
    (goal.status === 'Completed' ? 'In Progress' : goal.status) };
}

export function createEncryptedStorageFacade(
  repositories: EncryptedRepositories,
  coordinator: EncryptedStorageTransaction,
  helpers: EncryptedStorageHelpers
) {
  const readAll = <T>(table: EncryptedTable) =>
    repositories[table].getAll<T>();

  const get = <T>(table: EncryptedTable, id: string) =>
    repositories[table].get<T>(id);

  const add = async <T extends { id: string }>(
    table: EncryptedTable,
    record: T
  ) => coordinator.run(async ctx => {
    ctx.add(table, record);
    return record;
  });

  const update = async <T extends {
    id: string;
    createdAt?: string;
    updatedAt?: string;
  }>(
    table: EncryptedTable,
    id: string,
    changes: Partial<T>,
    touchUpdatedAt = false
  ) => coordinator.run(async ctx => {
    const existing = await ctx.get<T>(table, id);
    if (!existing) throw new Error(`Record not found: ${id}`);

    const updated = {
      ...existing,
      ...changes,
      id,
      ...(existing.createdAt !== undefined
        ? { createdAt: existing.createdAt }
        : {}),
      ...(touchUpdatedAt
        ? { updatedAt: new Date().toISOString() }
        : {}),
    };

    ctx.put(table, updated);
  });

  const remove = (table: EncryptedTable, id: string) =>
    coordinator.run(async ctx => {
      ctx.delete(table, id);
    });

  async function validateCategory(
    name: string,
    type: 'income' | 'expense',
    existing?: Transaction
  ) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) throw new Error('Choose a transaction category.');

    const categories = await readAll<Category>('categories');
    const match = categories.find(
      item => item.name.trim().toLowerCase() === normalized
    );

    if (match) {
      if (match.name !== name.trim()) {
        throw new Error('Choose the exact category name from the category list.');
      }
      if (match.type !== type) {
        throw new Error('The selected category does not match the transaction type.');
      }
      return;
    }

    if (existing && existing.category === name && existing.type === type) return;

    throw new Error('The selected category does not exist. Choose an available category.');
  }

  const storage = {
    transactions: {
      getAll: async () => sortTransactions(await readAll<Transaction>('transactions')),
      getById: (id: string) => get<Transaction>('transactions', id),

      add: async (input: Omit<Transaction, 'id' | 'createdAt'>) => {
        const record: Transaction = {
          ...input,
          id: helpers.createRecordId('tx'),
          createdAt: new Date().toISOString(),
        };
        helpers.validateTransactionRecord(record, true);

        return coordinator.run(async ctx => {
          const [categories, accounts] = await Promise.all([
            ctx.getAll<Category>('categories'), ctx.getAll<FinancialAccount>('financialAccounts')
          ]);
          const match = categories.find(
            item => item.name.trim().toLowerCase() === record.category.trim().toLowerCase()
          );
          if (!match || match.name !== record.category.trim() || match.type !== record.type) {
            throw new Error('The selected category does not exist or does not match the transaction type.');
          }
          if (record.accountId) {
            const account = accounts.find(row => row.id === record.accountId);
            if (!account || !account.isActive) throw new Error('Choose an active financial account.');
            if (!record.currencyCode || record.currencyCode !== account.currencyCode) throw new Error('An assigned transaction must use the account currency.');
          }
          ctx.add('transactions', record);
          return record;
        });
      },

      update: async (id: string, changes: Partial<Transaction>) =>
        coordinator.run(async ctx => {
          const existing = await ctx.get<Transaction>('transactions', id);
          if (!existing) throw new Error('Transaction not found.');
          const merged = { ...existing, ...changes, id, createdAt: existing.createdAt };
          helpers.validateTransactionRecord(merged, true);
          const [categories, accounts] = await Promise.all([
            ctx.getAll<Category>('categories'), ctx.getAll<FinancialAccount>('financialAccounts')
          ]);
          const match = categories.find(
            item => item.name.trim().toLowerCase() === merged.category.trim().toLowerCase()
          );
          if (
            (!match || match.name !== merged.category.trim() || match.type !== merged.type) &&
            !(existing.category === merged.category && existing.type === merged.type)
          ) {
            throw new Error('The selected category does not exist or does not match the transaction type.');
          }
          if (merged.accountId) {
            const account = accounts.find(row => row.id === merged.accountId);
            if (!account || (!account.isActive && existing.accountId !== merged.accountId)) throw new Error('Choose an active financial account.');
            if (!merged.currencyCode || merged.currencyCode !== account.currencyCode) throw new Error('An assigned transaction must use the account currency.');
          }
          ctx.put('transactions', {
            ...merged,
            updatedAt: new Date().toISOString(),
          });
        }),

      delete: (id: string) => remove('transactions', id),

      filter: async (params: {
        month?: string;
        year?: string;
        category?: string;
        type?: string;
        query?: string;
      }) => {
        let rows = await readAll<Transaction>('transactions');
        if (params.year) rows = rows.filter(row => row.date.startsWith(params.year!));
        if (params.month) rows = rows.filter(row => row.date.substring(5, 7) === params.month);
        if (params.category) rows = rows.filter(row => row.category === params.category);
        if (params.type) rows = rows.filter(row => row.type === params.type);
        if (params.query) {
          const q = params.query.toLowerCase();
          rows = rows.filter(row =>
            row.description.toLowerCase().includes(q) ||
            row.category.toLowerCase().includes(q) ||
            (row.notes || '').toLowerCase().includes(q)
          );
        }
        return sortTransactions(rows);
      },
    },

    categories: {
      getAll: async () => coordinator.run(async ctx => {
        const rows = await ctx.getAll<Category>('categories');
        if (rows.length) return rows;
        for (const category of DEFAULT_CATEGORIES) ctx.add('categories', category);
        return DEFAULT_CATEGORIES;
      }),

      add: async (input: Omit<Category, 'id'>) =>
        add('categories', { ...input, id: helpers.createRecordId('cat') }),

      update: (id: string, changes: Partial<Category>) =>
        coordinator.run(async ctx => {
          const existing = await ctx.get<Category>('categories', id);
          if (!existing) throw new Error('Category not found.');
          if (changes.name !== undefined || changes.type !== undefined) {
            const linked = await ctx.getAll<Transaction>('transactions');
            if (linked.some(tx => tx.category === existing.name)) {
              throw new Error('Cannot change a category linked to transactions.');
            }
          }
          ctx.put('categories', { ...existing, ...changes, id });
        }),

      delete: (id: string) => coordinator.run(async ctx => {
        const category = await ctx.get<Category>('categories', id);
        if (!category) return;
        const [budgets, transactions] = await Promise.all([
          ctx.getAll<Budget>('budgets'),
          ctx.getAll<Transaction>('transactions'),
        ]);
        if (budgets.some(item => item.categoryId === id) ||
            transactions.some(item => item.category === category.name)) {
          throw new Error('Cannot delete a category linked to budgets or transactions.');
        }
        ctx.delete('categories', id);
      }),
    },

    budgets: {
      getAll: () => readAll<Budget>('budgets'),
      getByMonth: async (month: string) =>
        (await readAll<Budget>('budgets')).filter(row => row.monthYear === month),

      upsert: async (input: Omit<Budget, 'id' | 'createdAt'>) =>
        coordinator.run(async ctx => {
          validateMoneyMetadata({ ...input, amount: input.monthlyAmount });
          const rows = await ctx.getAll<Budget>('budgets');
          const existing = rows.find(
            row => row.monthYear === input.monthYear && row.categoryId === input.categoryId
          );
          if (existing) {
            if (existing.currencyCode && input.currencyCode && existing.currencyCode !== input.currencyCode) {
              throw new Error('A budget cannot change currency without explicit reconciliation.');
            }
            const updated = { ...existing, monthlyAmount: input.monthlyAmount,
              ...(input.amountMinor !== undefined ? { amountMinor: input.amountMinor } : {}),
              ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}) };
            ctx.put('budgets', updated);
            return updated;
          }
          const created: Budget = {
            ...input,
            id: helpers.createRecordId('budget'),
            createdAt: new Date().toISOString(),
          };
          ctx.add('budgets', created);
          return created;
        }),

      delete: (id: string) => remove('budgets', id),
    },

    savings: {
      getGoals: () => readAll<SavingsGoal>('savingsGoals'),

      addGoal: async (input: Omit<SavingsGoal, 'id' | 'createdAt'>) => {
        validateMoneyMetadata({ currencyCode: input.currencyCode, amountMinor: input.targetAmountMinor, amount: input.targetAmount });
        validateMoneyMetadata({ currencyCode: input.currencyCode, amountMinor: input.currentAmountMinor, amount: input.currentAmount });
        return add('savingsGoals', {
          ...input,
          id: helpers.createRecordId('sg'),
          createdAt: new Date().toISOString(),
        });
      },

      updateGoal: (id: string, changes: Partial<SavingsGoal>) =>
        update('savingsGoals', id, changes),

      deleteGoal: (id: string) => coordinator.run(async ctx => {
        ctx.delete('savingsGoals', id);
        const contributions = await ctx.getAll<SavingsContribution>('savingsContributions');
        for (const row of contributions) {
          if (row.goalId === id) ctx.delete('savingsContributions', row.id);
        }
      }),

      addContribution: async (
        input: Omit<SavingsContribution, 'id' | 'createdAt'>
      ) => coordinator.run(async ctx => {
        if (!Number.isFinite(input.amount) || input.amount <= 0) {
          throw new Error('Contribution amount must be greater than zero.');
        }
        validateMoneyMetadata({ ...input, amount: input.amount });
        const goal = await ctx.get<SavingsGoal>('savingsGoals', input.goalId);
        if (!goal) throw new Error('Savings goal not found.');
        if (goal.currencyCode && input.currencyCode && goal.currencyCode !== input.currencyCode) {
          throw new Error('Contribution currency must match its savings goal currency.');
        }
        const currencyCode = input.currencyCode || goal.currencyCode;
        if (currencyCode) {
          const addition = input.amountMinor ? BigInt(input.amountMinor) : decimalToMinorUnits(input.amount, currencyCode);
          const current = goal.currentAmountMinor ? BigInt(goal.currentAmountMinor) : decimalToMinorUnits(goal.currentAmount, currencyCode);
          const next = current + addition;
          ctx.put('savingsGoals', {
            ...goal, currencyCode,
            currentAmount: Number(minorUnitsToDecimal(next, currencyCode)),
            currentAmountMinor: next.toString(10),
          });
        } else {
          ctx.put('savingsGoals', { ...goal, currentAmount: goal.currentAmount + input.amount });
        }
        ctx.add('savingsContributions', {
          ...input,
          id: helpers.createRecordId('contrib'),
          createdAt: new Date().toISOString(),
        });
      }),

      updateContribution: async (id: string, changes: Partial<Pick<SavingsContribution, 'amount' | 'amountMinor' | 'currencyCode' | 'date' | 'notes'>>) =>
        coordinator.run(async ctx => {
          validateMoneyMetadata(changes);
          if (changes.amount !== undefined && (!Number.isFinite(changes.amount) || changes.amount <= 0)) throw new Error('Contribution amount must be greater than zero.');
          const existing = await ctx.get<SavingsContribution>('savingsContributions', id);
          if (!existing) return;
          const goal = await ctx.get<SavingsGoal>('savingsGoals', existing.goalId);
          if (!goal) throw new Error('Savings goal missing for contribution.');
          const currencyCode = changes.currencyCode || existing.currencyCode || goal.currencyCode;
          if (goal.currencyCode && currencyCode && goal.currencyCode !== currencyCode) throw new Error('Contribution currency must match its savings goal currency.');
          if (changes.currencyCode && existing.currencyCode && changes.currencyCode !== existing.currencyCode) throw new Error('Changing contribution currency requires an explicit conversion.');
          let updatedGoal: SavingsGoal;
          if (currencyCode) {
            const oldMinor = existing.amountMinor ? BigInt(existing.amountMinor) : decimalToMinorUnits(existing.amount, currencyCode);
            const newAmount = changes.amount ?? existing.amount;
            const newMinor = changes.amountMinor ? BigInt(changes.amountMinor) : decimalToMinorUnits(newAmount, currencyCode);
            const currentMinor = goal.currentAmountMinor ? BigInt(goal.currentAmountMinor) : decimalToMinorUnits(goal.currentAmount, currencyCode);
            const nextMinor = currentMinor - oldMinor + newMinor;
            if (newMinor <= 0n || nextMinor < 0n) throw new Error('Contribution edit would make the savings total invalid.');
            updatedGoal = { ...goal, currencyCode, currentAmountMinor: nextMinor.toString(10), currentAmount: Number(minorUnitsToDecimal(nextMinor, currencyCode)) };
            changes = { ...changes, amount: Number(minorUnitsToDecimal(newMinor, currencyCode)), amountMinor: newMinor.toString(10), currencyCode };
          } else {
            const newAmount = changes.amount ?? existing.amount;
            const next = goal.currentAmount - existing.amount + newAmount;
            if (!Number.isFinite(newAmount) || newAmount <= 0 || next < -1e-9) throw new Error('Contribution edit would make the savings total invalid.');
            updatedGoal = { ...goal, currentAmount: Math.max(0, next) };
          }
          ctx.put('savingsGoals', updatedGoal);
          ctx.put('savingsContributions', { ...existing, ...changes, id, goalId: existing.goalId, createdAt: existing.createdAt });
        }),

      deleteContribution: async (id: string) => coordinator.run(async ctx => {
        const existing = await ctx.get<SavingsContribution>('savingsContributions', id);
        if (!existing) return;
        const goal = await ctx.get<SavingsGoal>('savingsGoals', existing.goalId);
        if (!goal) throw new Error('Savings goal missing for contribution.');
        const currencyCode = existing.currencyCode || goal.currencyCode;
        if (currencyCode) {
          const amountMinor = existing.amountMinor ? BigInt(existing.amountMinor) : decimalToMinorUnits(existing.amount, currencyCode);
          const currentMinor = goal.currentAmountMinor ? BigInt(goal.currentAmountMinor) : decimalToMinorUnits(goal.currentAmount, currencyCode);
          const nextMinor = currentMinor - amountMinor;
          if (nextMinor < 0n) throw new Error('Contribution history does not reconcile with the saved goal amount.');
          ctx.put('savingsGoals', { ...goal, currentAmountMinor: nextMinor.toString(10), currentAmount: Number(minorUnitsToDecimal(nextMinor, currencyCode)) });
        } else {
          const next = goal.currentAmount - existing.amount;
          if (next < -1e-9) throw new Error('Contribution history does not reconcile with the saved goal amount.');
          ctx.put('savingsGoals', { ...goal, currentAmount: Math.max(0, next) });
        }
        ctx.delete('savingsContributions', id);
      }),

      getContributions: async (goalId?: string) =>
        (await readAll<SavingsContribution>('savingsContributions'))
          .filter(row => !goalId || row.goalId === goalId)
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    },

    accounts: {
      getAll: async () => (await readAll<FinancialAccount>('financialAccounts')).sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
      add: async input => {
        validateFinancialAccount(input);
        const record: FinancialAccount = { ...input, name: input.name.trim(), description: input.description?.trim() || undefined,
          id: helpers.createRecordId('acct'), createdAt: new Date().toISOString() };
        await coordinator.run(async ctx => ctx.add('financialAccounts', record));
        return record;
      },
      update: async (id, updates) => coordinator.run(async ctx => {
        const existing = await ctx.get<FinancialAccount>('financialAccounts', id);
        if (!existing) return;
        const updated = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        validateFinancialAccount(updated);
        if (updated.currencyCode !== existing.currencyCode || updated.openingBalanceMinor !== existing.openingBalanceMinor) {
          const [transactions, transfers] = await Promise.all([
            ctx.getAll<Transaction>('transactions'), ctx.getAll<AccountTransfer>('accountTransfers')
          ]);
          const hasActivity = transactions.some(row => row.accountId === id) || transfers.some(row => row.fromAccountId === id || row.toAccountId === id);
          if (hasActivity) {
            if (updated.currencyCode !== existing.currencyCode) throw new Error('An account currency cannot change after it has financial activity. Create another account instead.');
            throw new Error('An opening balance cannot change after account activity exists because that would rewrite historical balances. Keep the account for history and create another account if needed.');
          }
        }
        ctx.put('financialAccounts', { ...updated, name: updated.name.trim(), description: updated.description?.trim() || undefined });
      }),
      archive: async id => coordinator.run(async ctx => {
        const existing = await ctx.get<FinancialAccount>('financialAccounts', id);
        if (existing) ctx.put('financialAccounts', { ...existing, isActive: false, updatedAt: new Date().toISOString() });
      }),
      delete: async id => coordinator.run(async ctx => {
        const existing = await ctx.get<FinancialAccount>('financialAccounts', id);
        if (!existing) return;
        const [transactions, transfers, commitments] = await Promise.all([
          ctx.getAll<Transaction>('transactions'), ctx.getAll<AccountTransfer>('accountTransfers'), ctx.getAll<PlannedCommitment>('plannedCommitments')
        ]);
        if (transactions.some(row => row.accountId === id) || transfers.some(row => row.fromAccountId === id || row.toAccountId === id) || commitments.some(row => row.accountId === id)) {
          throw new Error('This account has financial history. Archive it to keep that history intact.');
        }
        if (BigInt(existing.openingBalanceMinor) !== 0n) throw new Error('This account has a non-zero opening balance. Archive it to preserve that amount.');
        ctx.delete('financialAccounts', id);
      }),
      getTransfers: async accountId => (await readAll<AccountTransfer>('accountTransfers'))
        .filter(row => !accountId || row.fromAccountId === accountId || row.toAccountId === accountId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
      addTransfer: async input => {
        if ((input as AccountTransfer).reversalOfId) throw new Error('Reversals must be created from an existing transfer.');
        const id = input.id || helpers.createRecordId('transfer');
        const createdAt = new Date().toISOString();
        const record: AccountTransfer = { ...input, id, createdAt };
        await coordinator.run(async ctx => {
          const [source, destination] = await Promise.all([
            ctx.get<FinancialAccount>('financialAccounts', record.fromAccountId), ctx.get<FinancialAccount>('financialAccounts', record.toAccountId)
          ]);
          if (!source || !destination) throw new Error('Both transfer accounts must exist.');
          if (!source.isActive || !destination.isActive) throw new Error('Archived accounts cannot be used for new transfers.');
          validateAccountTransfer(record, source, destination);
          ctx.add('accountTransfers', record);
        });
        return record;
      },
      reverseTransfer: async (id, date) => {
        const transferId = helpers.createRecordId('transfer-reversal');
        const createdAt = new Date().toISOString();
        let result: AccountTransfer | undefined;
        await coordinator.run(async ctx => {
          const original = await ctx.get<AccountTransfer>('accountTransfers', id);
          if (!original || original.reversalOfId) throw new Error('Only an original transfer can be reversed.');
          const transfers = await ctx.getAll<AccountTransfer>('accountTransfers');
          if (transfers.some(row => row.reversalOfId === id)) throw new Error('This transfer has already been reversed.');
          const [source, destination] = await Promise.all([
            ctx.get<FinancialAccount>('financialAccounts', original.toAccountId), ctx.get<FinancialAccount>('financialAccounts', original.fromAccountId)
          ]);
          if (!source || !destination) throw new Error('Transfer accounts are unavailable; no reversal was created.');
          const reversal: AccountTransfer = { id: transferId, fromAccountId: original.toAccountId, toAccountId: original.fromAccountId,
            fromAmountMinor: original.toAmountMinor, toAmountMinor: original.fromAmountMinor, fromCurrencyCode: original.toCurrencyCode, toCurrencyCode: original.fromCurrencyCode,
            reversalOfId: original.id, date, notes: `Reversal of ${original.id}`, createdAt };
          validateAccountTransfer(reversal, source, destination);
          ctx.add('accountTransfers', reversal);
          result = reversal;
        });
        if (!result) throw new Error('Transfer reversal was not committed.');
        return result;
      },
      updateTransfer: async (id, updates) => coordinator.run(async ctx => {
        const existing = await ctx.get<AccountTransfer>('accountTransfers', id);
        if (!existing) return;
        const allTransfers = await ctx.getAll<AccountTransfer>('accountTransfers');
        if (existing.reversalOfId || allTransfers.some(row => row.reversalOfId === id)) throw new Error('A reversed transfer is locked to preserve its audit trail. Remove its reversal before editing.');
        const updated = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        const [source, destination] = await Promise.all([
          ctx.get<FinancialAccount>('financialAccounts', updated.fromAccountId), ctx.get<FinancialAccount>('financialAccounts', updated.toAccountId)
        ]);
        if (!source || !destination) throw new Error('Both transfer accounts must exist.');
        validateAccountTransfer(updated, source, destination);
        ctx.put('accountTransfers', updated);
      }),
      deleteTransfer: async id => coordinator.run(async ctx => {
        const existing = await ctx.get<AccountTransfer>('accountTransfers', id);
        if (!existing) return;
        const allTransfers = await ctx.getAll<AccountTransfer>('accountTransfers');
        if (!existing.reversalOfId && allTransfers.some(row => row.reversalOfId === id)) throw new Error('Remove the reversal before deleting the original transfer.');
        ctx.delete('accountTransfers', id);
      }),
    },

    exchangeRates: {
      getAll: async () => (await readAll<ManualExchangeRate>('manualExchangeRates'))
        .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || a.baseCurrencyCode.localeCompare(b.baseCurrencyCode)),
      add: async input => {
        const record: ManualExchangeRate = { ...input, id: helpers.createRecordId('fx'), createdAt: new Date().toISOString() };
        validateManualExchangeRate(record);
        await coordinator.run(async ctx => {
          const rows = await ctx.getAll<ManualExchangeRate>('manualExchangeRates');
          if (rows.some(row => row.baseCurrencyCode === record.baseCurrencyCode && row.quoteCurrencyCode === record.quoteCurrencyCode && row.effectiveDate === record.effectiveDate)) {
            throw new Error('A rate already exists for this currency pair and date. Edit it instead.');
          }
          ctx.add('manualExchangeRates', record);
        });
        return record;
      },
      update: async (id, updates) => coordinator.run(async ctx => {
        const existing = await ctx.get<ManualExchangeRate>('manualExchangeRates', id);
        if (!existing) return;
        const updated = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        validateManualExchangeRate(updated);
        const rows = await ctx.getAll<ManualExchangeRate>('manualExchangeRates');
        if (rows.some(row => row.id !== id && row.baseCurrencyCode === updated.baseCurrencyCode && row.quoteCurrencyCode === updated.quoteCurrencyCode && row.effectiveDate === updated.effectiveDate)) {
          throw new Error('A rate already exists for this currency pair and date.');
        }
        ctx.put('manualExchangeRates', updated);
      }),
      delete: async id => coordinator.run(async ctx => ctx.delete('manualExchangeRates', id)),
    },

    commitments: {
      getAll: async () => (await readAll<PlannedCommitment>('plannedCommitments'))
        .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate) || a.title.localeCompare(b.title)),
      add: async input => {
        const record: PlannedCommitment = { ...input, id: helpers.createRecordId('commitment'), createdAt: new Date().toISOString() };
        validatePlannedCommitment(record);
        await coordinator.run(async ctx => {
          const [accounts, categories] = await Promise.all([ctx.getAll<FinancialAccount>('financialAccounts'), ctx.getAll<Category>('categories')]);
          validatePlannedCommitmentReferences(record, accounts, categories);
          ctx.add('plannedCommitments', record);
        });
        return record;
      },
      update: async (id, updates) => coordinator.run(async ctx => {
        const existing = await ctx.get<PlannedCommitment>('plannedCommitments', id);
        if (!existing) return;
        const updated = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
        validatePlannedCommitment(updated);
        const [accounts, categories] = await Promise.all([ctx.getAll<FinancialAccount>('financialAccounts'), ctx.getAll<Category>('categories')]);
        validatePlannedCommitmentReferences(updated, accounts, categories);
        ctx.put('plannedCommitments', updated);
      }),
      delete: async id => coordinator.run(async ctx => ctx.delete('plannedCommitments', id)),
    },

    habits: {
      getAll: async () =>
        (await readAll<Habit>('habits')).filter(row => !row.archived),

      add: async (input: Omit<Habit, 'id' | 'createdAt'>) =>
        add('habits', {
          ...input,
          id: helpers.createRecordId('habit'),
          createdAt: new Date().toISOString(),
        }),

      update: (id: string, changes: Partial<Habit>) =>
        update('habits', id, changes),

      delete: (id: string) => coordinator.run(async ctx => {
        ctx.delete('habits', id);
        const logs = await ctx.getAll<HabitLog>('habitLogs');
        for (const row of logs) if (row.habitId === id) ctx.delete('habitLogs', row.id);
      }),

      getLogs: async (habitId?: string) => {
        const rows = await readAll<HabitLog>('habitLogs');
        return habitId ? rows.filter(row => row.habitId === habitId) : rows;
      },

      logCompletion: async (habitId: string, date: string, completed: boolean) =>
        coordinator.run(async ctx => {
          const parsedDate = new Date(`${date}T00:00:00.000Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
              Number.isNaN(parsedDate.getTime()) ||
              parsedDate.toISOString().slice(0, 10) !== date) {
            throw new Error('Invalid habit completion date.');
          }
          if (typeof completed !== 'boolean') throw new Error('Invalid completion state.');
          const habit = await ctx.get<Habit>('habits', habitId);
          if (!habit) throw new Error('Habit not found.');

          const logs = await ctx.getAll<HabitLog>('habitLogs');
          const existing = logs.find(row => row.habitId === habitId && row.date === date);
          if (existing) {
            ctx.put('habitLogs', {
              ...existing,
              completed,
              completedAt: completed ? new Date().toISOString() : undefined,
            });
          } else {
            ctx.add('habitLogs', {
              id: helpers.createRecordId('habitlog'),
              habitId,
              date,
              completed,
              completedAt: completed ? new Date().toISOString() : undefined,
            });
          }
        }),
    },

    goals: {
      getAll: () => readAll<Goal>('goals'),
      getAllMilestones: () => readAll<Milestone>('milestones'),

      add: async (input: Omit<Goal, 'id' | 'createdAt'>) =>
        add('goals', {
          ...input,
          id: helpers.createRecordId('goal'),
          createdAt: new Date().toISOString(),
        }),

      update: (id: string, changes: Partial<Goal>) => coordinator.run(async ctx => {
        const existing = await ctx.get<Goal>('goals', id);
        if (!existing) return;
        const milestones = (await ctx.getAll<Milestone>('milestones')).filter(m => m.goalId === id);
        ctx.put('goals', reconcileGoal({ ...existing, ...changes, id,
          createdAt: existing.createdAt, updatedAt: new Date().toISOString() }, milestones));
      }),

      delete: (id: string) => coordinator.run(async ctx => {
        ctx.delete('goals', id);
        const milestones = await ctx.getAll<Milestone>('milestones');
        for (const row of milestones) if (row.goalId === id) ctx.delete('milestones', row.id);
      }),

      getMilestones: async (goalId: string) =>
        (await readAll<Milestone>('milestones')).filter(row => row.goalId === goalId),

      addMilestone: async (input: Omit<Milestone, 'id'>) =>
        coordinator.run(async ctx => {
          if (!(await ctx.get<Goal>('goals', input.goalId))) throw new Error('Milestone goal does not exist.');
          const record = { ...input, id: helpers.createRecordId('milestone') };
          ctx.add('milestones', record);
          return record;
        }),

      toggleMilestone: (id: string, completed: boolean) =>
        coordinator.run(async ctx => {
          const existing = await ctx.get<Milestone>('milestones', id);
          if (!existing) throw new Error('Milestone not found.');
          ctx.put('milestones', {
            ...existing,
            completed,
            completedAt: completed ? new Date().toISOString() : undefined,
          });
          const goal = await ctx.get<Goal>('goals', existing.goalId);
          if (goal) {
            const milestones = (await ctx.getAll<Milestone>('milestones'))
              .filter(m => m.goalId === goal.id);
            const next = reconcileGoal(goal, milestones);
            if (next.status !== goal.status) ctx.put('goals', {
              ...next, updatedAt: new Date().toISOString(),
            });
          }
        }),

      deleteMilestone: (id: string) => remove('milestones', id),
    },

    tasks: {
      getAll: () => readAll<Task>('tasks'),

      add: async (input: Omit<Task, 'id' | 'createdAt'>) =>
        add('tasks', {
          ...input,
          id: helpers.createRecordId('task'),
          createdAt: new Date().toISOString(),
        }),

      update: (id: string, changes: Partial<Task>) =>
        update('tasks', id, changes, true),

      delete: (id: string) => remove('tasks', id),

      toggleCompleted: (id: string, completed: boolean) =>
        coordinator.run(async ctx => {
          const task = await ctx.get<Task>('tasks', id);
          if (!task) throw new Error('Task not found.');
          if (task.completed === completed) return;

          const now = new Date().toISOString();

          if (!completed && task.completed) {
            if (task.spawnedTaskId) {
              const spawned = await ctx.get<Task>('tasks', task.spawnedTaskId);
              if (spawned && !spawned.updatedAt) ctx.delete('tasks', spawned.id);
            }
            ctx.put('tasks', {
              ...task,
              completed: false,
              completedAt: undefined,
              spawnedTaskId: undefined,
              updatedAt: now,
            });
            return;
          }

          if (completed && !task.completed && task.recurring && task.recurring !== 'None') {
            const nextDate = helpers.getNextRecurringTaskDate(task);
            if (nextDate) {
              const rootId = helpers.getRecurrenceRootId(task);
              const nextId = `rec_${rootId}_${nextDate}`;
              const existing = await ctx.get<Task>('tasks', nextId);
              if (!existing) {
                ctx.add('tasks', {
                  ...task,
                  id: nextId,
                  dueDate: nextDate,
                  recurrenceRootId: rootId,
                  completed: false,
                  completedAt: undefined,
                  spawnedTaskId: undefined,
                  createdAt: now,
                  updatedAt: undefined,
                });
              }
              ctx.put('tasks', {
                ...task,
                completed: true,
                completedAt: now,
                spawnedTaskId: nextId,
                updatedAt: now,
              });
              return;
            }
          }

          ctx.put('tasks', {
            ...task,
            completed,
            completedAt: completed ? now : undefined,
            updatedAt: now,
          });
        }),
    },

    settings: {
      get: async <T>(key: string, defaultValue: T): Promise<T> => {
        const row = await get<{ key: string; value: T }>('settings', key);
        return row ? row.value : defaultValue;
      },

      set: async (key: string, value: unknown) =>
        coordinator.run(async ctx => {
          ctx.put('settings', { key, value });
        }),

      delete: async (key: string) =>
        coordinator.run(async ctx => {
          ctx.delete('settings', key);
        }),
    },

    backup: {
      hasData: async () => {
        const rows = await Promise.all(TABLES.map(table => readAll<any>(table)));
        return rows.some(tableRows => tableRows.length > 0);
      },

      // Share the write queue so compound writes cannot interleave table reads.
      // Native decryption remains outside any IndexedDB transaction.
      exportData: async () => coordinator.run(async ctx => {
        const entries = await Promise.all(
          TABLES.map(async table => [table, await ctx.getAll<any>(table)] as const)
        );
        return JSON.stringify({
          version: 1,
          timestamp: new Date().toISOString(),
          tables: Object.fromEntries(entries),
        });
      }),

      importData: async (
        jsonData: string,
        options?: { replaceExisting?: boolean }
      ) => {
        let parsed: any;
        try { parsed = JSON.parse(jsonData); }
        catch { throw new Error('Invalid JSON format'); }
        const tables = parsed?.tables ?? parsed?.data;
        helpers.validateBackupTables(tables);

        const counts: Record<string, number> = {};
        await coordinator.run(async ctx => {
          const current = await Promise.all(TABLES.map(table => ctx.getAll<any>(table)));
          if (current.some(rows => rows.length) && !options?.replaceExisting) {
            throw new Error('Existing data found. Enable replaceExisting to restore this backup.');
          }

          for (const table of TABLES) {
            ctx.clear(table);
            for (const row of tables[table] ?? []) ctx.add(table, row);
            counts[table] = (tables[table] ?? []).length;
          }
        });

        return { success: true, counts };
      },

      clearAll: async () => coordinator.run(async ctx => {
        for (const table of TABLES) ctx.clear(table);
        for (const category of DEFAULT_CATEGORIES) ctx.add('categories', category);
      }),

      seedDemoData: async () => {
        const today = new Date().toISOString().split('T')[0];
        const curMonth = today.substring(0, 7);
        const now = new Date().toISOString();
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString().split('T')[0];

        await coordinator.run(async ctx => {
          const categories = await ctx.getAll<Category>('categories');
          const availableCategories = categories.length
            ? categories
            : DEFAULT_CATEGORIES;

          if (!categories.length) {
            for (const category of DEFAULT_CATEGORIES) {
              ctx.add('categories', category);
            }
          }

          const demoTxs: Omit<Transaction, 'id' | 'createdAt'>[] = [
            { type: 'income', amount: 95000, category: 'Salary', description: 'Tech Consultancy Salary', date: `${curMonth}-01`, paymentMethod: 'Bank Transfer' },
            { type: 'income', amount: 15000, category: 'Freelance', description: 'Web Architecture Sprint', date: `${curMonth}-15`, paymentMethod: 'Net Banking' },
            { type: 'expense', amount: 28000, category: 'Rent', description: 'Apartment Monthly Rent', date: `${curMonth}-02`, paymentMethod: 'UPI' },
            { type: 'expense', amount: 6500, category: 'Food', description: 'Organic Pantry Provisions', date: `${curMonth}-08`, paymentMethod: 'Credit Card' },
            { type: 'expense', amount: 2400, category: 'Utilities', description: 'Fiber Broadband & Power', date: `${curMonth}-12`, paymentMethod: 'UPI' },
            { type: 'expense', amount: 12000, category: 'Investments', description: 'Index Equity SIP', date: `${curMonth}-05`, paymentMethod: 'Bank Transfer' }
          ];

          for (const input of demoTxs) {
            const category = availableCategories.find(
              row => row.name === input.category
            );

            if (!category) {
              throw new Error(`Demo transaction category not found: ${input.category}`);
            }
            if (category.type !== input.type) {
              throw new Error(`Demo transaction category type mismatch: ${input.category}`);
            }

            const record: Transaction = {
              ...input,
              id: helpers.createRecordId('tx'),
              createdAt: now,
            };
            helpers.validateTransactionRecord(record, true);
            ctx.add('transactions', record);
          }

          const budgets = await ctx.getAll<Budget>('budgets');
          const foodCategory = availableCategories.find(
            row => row.id === 'cat_food' && row.type === 'expense'
          );

          if (!foodCategory) {
            throw new Error('Demo budget category not found: cat_food');
          }

          const budgetInputs: Omit<Budget, 'id' | 'createdAt'>[] = [
            { monthlyAmount: 60000, monthYear: curMonth },
            {
              categoryId: foodCategory.id,
              monthlyAmount: 12000,
              monthYear: curMonth,
            },
          ];

          for (const input of budgetInputs) {
            const existing = budgets.find(
              row => row.monthYear === input.monthYear &&
                row.categoryId === input.categoryId
            );
            if (existing) {
              ctx.put('budgets', { ...existing, monthlyAmount: input.monthlyAmount });
            } else {
              ctx.add('budgets', {
                ...input,
                id: helpers.createRecordId('budget'),
                createdAt: now,
              });
            }
          }

          const goal: SavingsGoal = {
            id: helpers.createRecordId('sg'),
            title: 'Emergency Reserve Fund',
            targetAmount: 200000,
            currentAmount: 105000,
            targetDate: '2026-12-31',
            category: 'Financial',
            createdAt: now,
          };
          ctx.add('savingsGoals', goal);
          ctx.add('savingsContributions', {
            id: helpers.createRecordId('contrib'),
            goalId: goal.id,
            amount: 20000,
            date: `${curMonth}-05`,
            notes: 'Monthly savings contribution',
            createdAt: now,
          });

          const habits: Habit[] = [
            { id: helpers.createRecordId('habit'), name: 'Drink 3L Water', frequency: 'daily', color: '#3b82f6', createdAt: now },
            { id: helpers.createRecordId('habit'), name: 'Walk 10,000 steps', frequency: 'daily', color: '#10b981', createdAt: now },
            { id: helpers.createRecordId('habit'), name: 'Read 20 pages', frequency: 'daily', color: '#8b5cf6', createdAt: now },
          ];
          for (const habit of habits) ctx.add('habits', habit);

          const habitLogs: HabitLog[] = [
            { id: helpers.createRecordId('habitlog'), habitId: habits[0].id, date: yesterday, completed: true, completedAt: now },
            { id: helpers.createRecordId('habitlog'), habitId: habits[0].id, date: today, completed: true, completedAt: now },
            { id: helpers.createRecordId('habitlog'), habitId: habits[1].id, date: yesterday, completed: true, completedAt: now },
          ];
          for (const log of habitLogs) ctx.add('habitLogs', log);

          const goalRecord: Goal = {
            id: helpers.createRecordId('goal'),
            title: 'Run Half Marathon (21.1 km)',
            description: 'Prepare endurance for state marathon event',
            category: 'Fitness',
            targetValue: 21.1,
            currentValue: 10.0,
            unit: 'km',
            startDate: '2026-09-01',
            targetDate: '2026-12-31',
            priority: 'High',
            status: 'In Progress',
            createdAt: now,
          };
          ctx.add('goals', goalRecord);

          const milestoneInputs: Omit<Milestone, 'id'>[] = [
            { goalId: goalRecord.id, title: '5km continuous run', completed: true },
            { goalId: goalRecord.id, title: '10km non-stop run', completed: true },
            { goalId: goalRecord.id, title: '15km long trail run', completed: false },
          ];
          for (const input of milestoneInputs) {
            ctx.add('milestones', {
              ...input,
              id: helpers.createRecordId('milestone'),
            });
          }

          const taskInputs: Omit<Task, 'id' | 'createdAt'>[] = [
            { title: 'Quarterly financial audit & mutual fund rebalancing', dueDate: today, priority: 'Urgent', category: 'Finance', recurring: 'None', completed: false },
            { title: '5km recovery jog at neighborhood track', dueDate: today, priority: 'Medium', category: 'Fitness', recurring: 'Daily', completed: true },
            { title: 'Android 16 offline build verification', dueDate: today, priority: 'High', category: 'Career', recurring: 'None', completed: false },
          ];
          for (const input of taskInputs) {
            ctx.add('tasks', {
              ...input,
              id: helpers.createRecordId('task'),
              createdAt: now,
            });
          }
        });
      },
    },
  };

  return Object.freeze(storage);
}
