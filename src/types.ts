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
  /** Hash of the confirmed import identity. Raw alerts are never persisted. */
  importFingerprint?: string;
  commitmentId?: string;
  commitmentOccurrenceDate?: string;
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
  carryover?: boolean;
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

export type CommitmentFrequency = 'once' | 'weekly' | 'monthly' | 'yearly';
export type CommitmentStatus = 'active' | 'paused' | 'recorded';
export interface PlannedCommitment {
  /** Missing on legacy plans means expense. */
  type?: TransactionType;
  recurrenceAnchorDate?: string;
  lastPostedDate?: string;
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
  schedule?: { from: string; weekdays: number[]; sessionsPerWeek?: number }[];
  pauses?: { from: string; through?: string }[];
  goalId?: string;
  id: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  icon?: string;
  color: string;
  targetPerDay?: number;
  trackingMode?: 'binary' | 'quantity';
  quantityUnit?: string;
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
  quantity?: number;
  /** Unit recorded with this quantity; absent on legacy rows with unknown units. */
  quantityUnit?: string;
  completedAt?: string;
}

export type GoalCategory = 'Financial' | 'Fitness' | 'Career' | 'Education' | 'Personal Development' | 'Travel' | 'Other';
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent';
export type GoalStatus = 'In Progress' | 'Completed' | 'Paused';

export interface GoalProgressEntry {
  at: string;
  value: number;
  unit?: string;
}

export type GoalMode = 'accumulate' | 'reduce' | 'milestone' | 'frequency';

export interface Goal {
  mode?: GoalMode;
  baselineValue?: number;
  archived?: boolean;
  progressHistory?: GoalProgressEntry[];
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

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Task {
  goalId?: string;
  id: string;
  title: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD; absent means unscheduled
  dueTime?: string; // HH:mm local time
  reminderAt?: string; // Previously saved absolute reminder
  reminderLeadMinutes?: number;
  dueAlertDisabled?: boolean;
  dateOnlyAlertAnchorAt?: string;
  priority: PriorityLevel;
  category?: string;
  notes?: string;
  recurring: RecurrenceType;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  recurrenceRootId?: string;
  recurrenceAnchorDay?: number;
  recurrenceScheduledDate?: string;
  spawnedTaskId?: string;
  /** Optional child checklist stored inside the same encrypted task record. */
  subtasks?: TaskSubtask[];
}

export interface NotificationPreferences {
  taskReminders: boolean;
  notesReminders?: boolean;
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
