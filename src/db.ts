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
    importData(jsonData: string): Promise<{ success: boolean; counts: Record<string, number> }>;
    clearAll(): Promise<void>;
    seedDemoData(): Promise<void>;
  };
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
      const record: Transaction = { ...tx, id, createdAt: new Date().toISOString() };
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
      await db.savingsGoals.delete(id);
      await db.savingsContributions.where('goalId').equals(id).delete();
    },
    async addContribution(contribution) {
      const id = 'sc_' + Date.now();
      await db.savingsContributions.add({ ...contribution, id, createdAt: new Date().toISOString() });
      const goal = await db.savingsGoals.get(contribution.goalId);
      if (goal) {
        await db.savingsGoals.update(goal.id, { currentAmount: (goal.currentAmount || 0) + contribution.amount });
      }
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
      await db.habits.delete(id);
      await db.habitLogs.where('habitId').equals(id).delete();
    },
    async getLogs(habitId) {
      if (habitId) return db.habitLogs.where('habitId').equals(habitId).toArray();
      return db.habitLogs.toArray();
    },
    async logCompletion(habitId, date, completed) {
      const existing = await db.habitLogs.filter(l => l.habitId === habitId && l.date === date).first();
      if (existing) {
        await db.habitLogs.update(existing.id, {
          completed,
          completedAt: completed ? new Date().toISOString() : undefined
        });
      } else {
        const id = 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        await db.habitLogs.add({
          id,
          habitId,
          date,
          completed,
          completedAt: completed ? new Date().toISOString() : undefined
        });
      }
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
      await db.goals.delete(id);
      await db.milestones.where('goalId').equals(id).delete();
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
      const id = 't_' + Date.now();
      const record: Task = { ...task, id, createdAt: new Date().toISOString() };
      await db.tasks.add(record);
      return record;
    },
    async update(id, updates) {
      await db.tasks.update(id, updates);
    },
    async delete(id) {
      await db.tasks.delete(id);
    },
    async toggleCompleted(id, completed) {
      const task = await db.tasks.get(id);
      if (!task) return;
      await db.tasks.update(id, {
        completed,
        completedAt: completed ? new Date().toISOString() : undefined
      });

      // Handle recurrence auto-generation
      if (completed && task.recurring && task.recurring !== 'None') {
        const nextDate = new Date(task.dueDate || new Date());
        if (task.recurring === 'Daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (task.recurring === 'Weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (task.recurring === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);

        const yyyy = nextDate.getFullYear();
        const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextDate.getDate()).padStart(2, '0');

        await db.tasks.add({
          id: 't_' + Date.now() + '_rec',
          title: task.title,
          dueDate: `${yyyy}-${mm}-${dd}`,
          priority: task.priority,
          category: task.category,
          notes: task.notes,
          recurring: task.recurring,
          completed: false,
          createdAt: new Date().toISOString()
        });
      }
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
    async importData(jsonData: string) {
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
        for (const [table, records] of Object.entries(tablesData)) {
          const t = (db as any)[table];
          if (t && Array.isArray(records)) {
            await t.clear();
            for (const r of records) {
              await t.put(r);
            }
            counts[table] = records.length;
          }
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
