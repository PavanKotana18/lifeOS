export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  /** Exact minor-unit amount for new records; absent on untouched legacy rows. */
  amountMinor?: string;
  /** ISO 4217 identity for new records; absent means legacy currency context. */
  currencyCode?: string;
  /** Optional account assignment; legacy and unassigned transactions remain valid. */
  accountId?: string;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  notes?: string;
  isRecurring?: boolean;
  occurredAt?: string; // ISO instant represented by the user-selected local date/time
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
  amountMinor?: string;
  currencyCode?: string;
  monthYear: string; // YYYY-MM
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetAmountMinor?: string;
  currentAmountMinor?: string;
  currencyCode?: string;
  targetDate: string; // YYYY-MM-DD
  category?: string;
  notes?: string;
  createdAt: string;
}

export interface SavingsContribution {
  id: string;
  goalId: string;
  amount: number;
  amountMinor?: string;
  currencyCode?: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export type FinancialAccountType = 'cash' | 'bank' | 'credit-card' | 'wallet' | 'savings' | 'other';
export interface FinancialAccount {
  id: string;
  name: string;
  type: FinancialAccountType;
  currencyCode: string;
  /** Positive starting asset balance; for a credit card, positive means amount owed. */
  openingBalanceMinor: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AccountTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmountMinor: string;
  toAmountMinor: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  /** Quote currency per one base currency unit. Required for new cross-currency transfers. */
  exchangeRate?: string;
  /** Links an exact counter-entry reversal to the original transfer. */
  reversalOfId?: string;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ManualExchangeRate {
  id: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  /** Quote-major units per one base-major unit. */
  rate: string;
  effectiveDate: string;
  sourceLabel?: string;
  createdAt: string;
  updatedAt?: string;
}

export type CommitmentFrequency = 'weekly' | 'monthly' | 'yearly';
export type CommitmentStatus = 'active' | 'paused';
export interface PlannedCommitment {
  id: string;
  title: string;
  amount: number;
  amountMinor: string;
  currencyCode: string;
  frequency: CommitmentFrequency;
  nextDueDate: string;
  categoryId?: string;
  accountId?: string;
  status: CommitmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
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
  reminderTime?: string; // HH:mm local time
  reminderWeekday?: number; // Capacitor weekday value, Sunday=1 through Saturday=7
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
  description?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm local time
  reminderAt?: string; // ISO instant
  priority: PriorityLevel;
  category?: string;
  notes?: string;
  recurring: RecurrenceType;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  recurrenceRootId?: string;
  spawnedTaskId?: string;
}

export interface NotificationPreferences {
  taskReminders: boolean;
  upcomingDeadlines: boolean;
  overdueAlerts: boolean;
  habitReminders: boolean;
  milestoneReminders: boolean;
}

export interface AppSettings {
  displayName?: string;
  theme: 'dark' | 'light' | 'system';
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  monthlyBudget: number;
  biometricLockEnabled: boolean;
  lockTimeoutMinutes: number;
  notifications?: NotificationPreferences;
}
