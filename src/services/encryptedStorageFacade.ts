import type {
  Transaction,
  Category,
  Budget,
  SavingsGoal,
  SavingsContribution,
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
          const categories = await ctx.getAll<Category>('categories');
          const match = categories.find(
            item => item.name.trim().toLowerCase() === record.category.trim().toLowerCase()
          );
          if (!match || match.name !== record.category.trim() || match.type !== record.type) {
            throw new Error('The selected category does not exist or does not match the transaction type.');
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
          const categories = await ctx.getAll<Category>('categories');
          const match = categories.find(
            item => item.name.trim().toLowerCase() === merged.category.trim().toLowerCase()
          );
          if (
            (!match || match.name !== merged.category.trim() || match.type !== merged.type) &&
            !(existing.category === merged.category && existing.type === merged.type)
          ) {
            throw new Error('The selected category does not exist or does not match the transaction type.');
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
          const rows = await ctx.getAll<Budget>('budgets');
          const existing = rows.find(
            row => row.monthYear === input.monthYear && row.categoryId === input.categoryId
          );
          if (existing) {
            const updated = { ...existing, monthlyAmount: input.monthlyAmount };
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

      addGoal: async (input: Omit<SavingsGoal, 'id' | 'createdAt'>) =>
        add('savingsGoals', {
          ...input,
          id: helpers.createRecordId('sg'),
          createdAt: new Date().toISOString(),
        }),

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
        const goal = await ctx.get<SavingsGoal>('savingsGoals', input.goalId);
        if (!goal) throw new Error('Savings goal not found.');

        ctx.put('savingsGoals', {
          ...goal,
          currentAmount: goal.currentAmount + input.amount,
        });
        ctx.add('savingsContributions', {
          ...input,
          id: helpers.createRecordId('contrib'),
          createdAt: new Date().toISOString(),
        });
      }),

      getContributions: async (goalId: string) =>
        sortByDate((await readAll<SavingsContribution>('savingsContributions'))
          .filter(row => row.goalId === goalId)),
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
            for (const row of tables[table]) ctx.add(table, row);
            counts[table] = tables[table].length;
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
