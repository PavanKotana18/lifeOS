export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  notes?: string;
  isRecurring?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
  isDefault?: boolean;
}

export interface Budget {
  id: string;
  categoryId?: string; // Optional: category-specific or overall monthly budget
  monthlyAmount: number;
  monthYear: string; // YYYY-MM
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  category?: string;
  notes?: string;
  createdAt: string;
}

export interface SavingsContribution {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'weekly';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  icon?: string;
  color: string;
  targetPerDay?: number;
  createdAt: string;
  archived?: boolean;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
}

export type GoalCategory = 'Financial' | 'Fitness' | 'Career' | 'Education' | 'Personal Development' | 'Travel' | 'Other';
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent';
export type GoalStatus = 'In Progress' | 'Completed' | 'Paused';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  targetValue: number;
  currentValue: number;
  unit?: string;
  startDate: string; // YYYY-MM-DD
  targetDate: string; // YYYY-MM-DD
  priority: PriorityLevel;
  status: GoalStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  targetDate?: string;
  completed: boolean;
  completedAt?: string;
}

export type RecurrenceType = 'None' | 'Daily' | 'Weekly' | 'Monthly';

export interface Task {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  priority: PriorityLevel;
  category?: string;
  notes?: string;
  recurring: RecurrenceType;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  monthlyBudget: number;
  biometricLockEnabled: boolean;
  lockTimeoutMinutes: number;
}
