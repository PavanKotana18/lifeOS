import Dexie, { Table } from 'dexie';
import {
  Transaction,
  Category,
  Budget,
  SavingsGoal,
  SavingsContribution,
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
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  goals!: Table<Goal, string>;
  milestones!: Table<Milestone, string>;
  tasks!: Table<Task, string>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('LifeOS_Database');
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
  }
}

export const db = new LifeOSDatabase();

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
    getContributions(goalId: string): Promise<SavingsContribution[]>;
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
    exportData(): Promise<string>;
    importData(jsonData: string, options?: { replaceExisting?: boolean }): Promise<{ success: boolean; counts: Record<string, number> }>;
    clearAll(): Promise<void>;
    seedDemoData(): Promise<void>;
  };
}


export function validateBackupTables(tablesData: any): string[] {
  const names = [
    'transactions', 'categories', 'budgets', 'savingsGoals',
    'savingsContributions', 'habits', 'habitLogs', 'goals',
    'milestones', 'tasks', 'settings'
  ];

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
  for (const name of names) {
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
    optionalString(r, 'categoryId', 'budgets', i);
    if (r.categoryId && !ids.categories.has(r.categoryId)) fail('budgets', i, 'categoryId reference');
  });

  check('savingsGoals', (r, i) => {
    requiredString(r, 'title', 'savingsGoals', i);
    requiredNumber(r, 'targetAmount', 'savingsGoals', i);
    requiredNumber(r, 'currentAmount', 'savingsGoals', i);
    requiredDate(r, 'targetDate', 'savingsGoals', i);
    requiredString(r, 'createdAt', 'savingsGoals', i);
    optionalString(r, 'category', 'savingsGoals', i);
    optionalString(r, 'notes', 'savingsGoals', i);
  });

  check('savingsContributions', (r, i) => {
    requiredString(r, 'goalId', 'savingsContributions', i);
    if (!ids.savingsGoals.has(r.goalId)) fail('savingsContributions', i, 'goalId reference');
    requiredNumber(r, 'amount', 'savingsContributions', i);
    requiredDate(r, 'date', 'savingsContributions', i);
    requiredString(r, 'createdAt', 'savingsContributions', i);
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
  });

  check('settings', (r, i) => {
    if (!str(r.key)) fail('settings', i, 'key');
    if (!Object.prototype.hasOwnProperty.call(r, 'value')) fail('settings', i, 'value');
  });

  return names;
}

export const StorageService: IDataStorage = {
  transactions: {
    async getAll() {
      return db.transactions.reverse().sortBy('date');
    },
    async getById(id: string) {
      return db.transactions.get(id);
    },
    async add(tx) {
      const id = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const createdAt = new Date().toISOString();
      const record: Transaction = { ...tx, id, createdAt, occurredAt: tx.occurredAt || createdAt };
      await db.transactions.add(record);
      return record;
    },
    async update(id, updates) {
      await db.transactions.update(id, { ...updates, updatedAt: new Date().toISOString() });
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
      const cats = await db.categories.toArray();
      if (cats.length === 0) {
        // Seed default categories only
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
      }
      return cats;
    },
    async add(cat) {
      const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const record: Category = { ...cat, id };
      await db.categories.add(record);
      return record;
    },
    async update(id, updates) {
      await db.categories.update(id, updates);
    },
    async delete(id) {
      await db.categories.delete(id);
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
      const existing = await db.budgets.filter(b => b.monthYear === budget.monthYear && b.categoryId === budget.categoryId).first();
      if (existing) {
        await db.budgets.update(existing.id, { monthlyAmount: budget.monthlyAmount });
        return { ...existing, monthlyAmount: budget.monthlyAmount };
      }
      const id = 'b_' + Date.now();
      const record: Budget = { ...budget, id, createdAt: new Date().toISOString() };
      await db.budgets.add(record);
      return record;
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
      const id = 'sg_' + Date.now();
      const record: SavingsGoal = { ...goal, id, createdAt: new Date().toISOString() };
      await db.savingsGoals.add(record);
      return record;
    },
    async updateGoal(id, updates) {
      await db.savingsGoals.update(id, updates);
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
      await db.transaction('rw', db.savingsGoals, db.savingsContributions, async () => {
        const goal = await db.savingsGoals.get(contribution.goalId);
        if (!goal) throw new Error('Savings goal not found');

        const id = 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        await db.savingsGoals.update(goal.id, {
          currentAmount: (goal.currentAmount || 0) + contribution.amount
        });
        await db.savingsContributions.add({
          ...contribution, id, createdAt: new Date().toISOString()
        });
      });
    },
    async getContributions(goalId) {
      return db.savingsContributions.where('goalId').equals(goalId).reverse().sortBy('date');
    }
  },
  habits: {
    async getAll() {
      return db.habits.filter(h => !h.archived).toArray();
    },
    async add(habit) {
      const id = 'h_' + Date.now();
      const record: Habit = { ...habit, id, createdAt: new Date().toISOString() };
      await db.habits.add(record);
      return record;
    },
    async update(id, updates) {
      await db.habits.update(id, updates);
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
          const id = 'hl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          await db.habitLogs.add({ id, habitId, date, completed, completedAt });
        }
      });
    }
  },
  goals: {
    async getAll() {
      return db.goals.toArray();
    },
    async add(goal) {
      const id = 'g_' + Date.now();
      const record: Goal = { ...goal, id, createdAt: new Date().toISOString() };
      await db.goals.add(record);
      return record;
    },
    async update(id, updates) {
      await db.goals.update(id, { ...updates, updatedAt: new Date().toISOString() });
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
      const id = 'm_' + Date.now();
      const record: Milestone = { ...milestone, id };
      await db.milestones.add(record);
      return record;
    },
    async toggleMilestone(id, completed) {
      await db.milestones.update(id, {
        completed,
        completedAt: completed ? new Date().toISOString() : undefined
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
      const id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const record: Task = { ...task, id, createdAt: new Date().toISOString() };
      await db.tasks.add(record);
      return record;
    },
    async update(id, updates) {
      await db.tasks.update(id, { ...updates, updatedAt: new Date().toISOString() });
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
            await db.tasks.update(id, {
              completed: false,
              completedAt: undefined,
              updatedAt: new Date().toISOString()
            });
          }
          return;
        }

        if (task.recurring && task.recurring !== 'None') {
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.dueDate);
          if (!match) throw new Error('Invalid recurring task due date');

          const year = Number(match[1]);
          const month = Number(match[2]);
          const day = Number(match[3]);
          const nextDate = new Date(Date.UTC(year, month - 1, day));

          if (
            nextDate.getUTCFullYear() !== year ||
            nextDate.getUTCMonth() !== month - 1 ||
            nextDate.getUTCDate() !== day
          ) {
            throw new Error('Invalid recurring task due date');
          }

          if (task.recurring === 'Daily') {
            nextDate.setUTCDate(nextDate.getUTCDate() + 1);
          } else if (task.recurring === 'Weekly') {
            nextDate.setUTCDate(nextDate.getUTCDate() + 7);
          } else if (task.recurring === 'Monthly') {
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

          const nextDueDate = [
            nextDate.getUTCFullYear(),
            String(nextDate.getUTCMonth() + 1).padStart(2, '0'),
            String(nextDate.getUTCDate()).padStart(2, '0')
          ].join('-');

          const nextTaskId = `rec_${task.id}_${nextDueDate}`;
          if (!(await db.tasks.get(nextTaskId))) {
            await db.tasks.add({
              id: nextTaskId,
              title: task.title,
              description: task.description,
              dueDate: nextDueDate,
              dueTime: task.dueTime,
              priority: task.priority,
              category: task.category,
              notes: task.notes,
              recurring: task.recurring,
              completed: false,
              createdAt: new Date().toISOString()
            });
          }
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
    async exportData() {
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
          habits: await db.habits.toArray(),
          habitLogs: await db.habitLogs.toArray(),
          goals: await db.goals.toArray(),
          milestones: await db.milestones.toArray(),
          tasks: await db.tasks.toArray(),
          settings: await db.settings.toArray()
        }
      };
      return JSON.stringify(exportObj, null, 2);
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
        db.habits,
        db.habitLogs,
        db.goals,
        db.milestones,
        db.tasks,
        db.settings
      ], async () => {
        const liveCounts = await Promise.all([
          db.transactions.count(), db.categories.count(), db.budgets.count(), db.savingsGoals.count(),
          db.savingsContributions.count(), db.habits.count(), db.habitLogs.count(), db.goals.count(),
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
      await Promise.all([
        db.transactions.clear(),
        db.categories.clear(),
        db.budgets.clear(),
        db.savingsGoals.clear(),
        db.savingsContributions.clear(),
        db.habits.clear(),
        db.habitLogs.clear(),
        db.goals.clear(),
        db.milestones.clear(),
        db.tasks.clear(),
        db.settings.clear()
      ]);
      // Re-seed default categories
      await StorageService.categories.getAll();
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
      for (const tx of demoTxs) await StorageService.transactions.add(tx);

      await StorageService.budgets.upsert({ monthlyAmount: 60000, monthYear: curMonth });
      await StorageService.budgets.upsert({ categoryId: 'Food', monthlyAmount: 12000, monthYear: curMonth });

      const goal = await StorageService.savings.addGoal({
        title: 'Emergency Reserve Fund',
        targetAmount: 200000,
        currentAmount: 85000,
        targetDate: '2026-12-31',
        category: 'Financial'
      });
      await StorageService.savings.addContribution({
        goalId: goal.id,
        amount: 20000,
        date: `${curMonth}-05`,
        notes: 'Monthly savings contribution'
      });

      const h1 = await StorageService.habits.add({ name: 'Drink 3L Water', frequency: 'daily', color: '#3b82f6' });
      const h2 = await StorageService.habits.add({ name: 'Walk 10,000 steps', frequency: 'daily', color: '#10b981' });
      const h3 = await StorageService.habits.add({ name: 'Read 20 pages', frequency: 'daily', color: '#8b5cf6' });

      // Add streaks
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      await StorageService.habits.logCompletion(h1.id, yesterday, true);
      await StorageService.habits.logCompletion(h1.id, today, true);
      await StorageService.habits.logCompletion(h2.id, yesterday, true);

      const g = await StorageService.goals.add({
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
      await StorageService.goals.addMilestone({ goalId: g.id, title: '5km continuous run', completed: true });
      await StorageService.goals.addMilestone({ goalId: g.id, title: '10km non-stop run', completed: true });
      await StorageService.goals.addMilestone({ goalId: g.id, title: '15km long trail run', completed: false });

      await StorageService.tasks.add({ title: 'Quarterly financial audit & mutual fund rebalancing', dueDate: today, priority: 'Urgent', category: 'Finance', recurring: 'None', completed: false });
      await StorageService.tasks.add({ title: '5km recovery jog at neighborhood track', dueDate: today, priority: 'Medium', category: 'Fitness', recurring: 'Daily', completed: true });
      await StorageService.tasks.add({ title: 'Android 16 offline build verification', dueDate: today, priority: 'High', category: 'Career', recurring: 'None', completed: false });
    }
  }
};
