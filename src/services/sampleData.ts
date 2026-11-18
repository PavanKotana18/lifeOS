import type { Budget, Goal, Habit, HabitLog, Milestone, PlannedCommitment, SavingsContribution, SavingsGoal, Task, Transaction } from '../types';
import { formatLocalDate } from './domainUtils';

const prefix = 'lifeos-demo-v2:';
export const isSampleRecord = (id: string) => id.startsWith(prefix);
const id = (kind: string, key: string | number) => prefix + kind + ':' + key;
const currencyCode = 'INR';
const minor = (amount: number) => String(amount * 100);
const expenses = [
  ['Apartment rent', 'cat_rent', 26500, 1, 0],
  ['Market groceries', 'cat_food', 6200, 4, 3700],
  ['Electricity and water', 'cat_util', 1450, 8, 1350],
  ['Home internet and mobile', 'cat_util', 1499, 9, 0],
  ['Metro and cabs', 'cat_trans', 1900, 11, 2800],
  ['Dinner with friends', 'cat_food', 1450, 13, 2400],
  ['Clothes and home supplies', 'cat_shop', 1600, 16, 5800],
  ['Cinema and streaming', 'cat_ent', 660, 18, 1800],
  ['Pharmacy and checkup', 'cat_health', 470, 20, 1700],
  ['Train and weekend travel', 'cat_trans', 1700, 23, 6900],
] as const;
const taskNames = ['File rent receipts', 'Book a dental checkup', 'Renew metro pass', 'Send the design draft', 'Plan the weekend trip', 'Review savings contributions'];

export function createSampleData(anchor = new Date()) {
  let randomState = 20261118;
  const variation = (range: number) => {
    randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
    return range === 0 ? 0 : randomState % range;
  };
  const months = Array.from({ length: 6 }, (_, index) => formatLocalDate(new Date(anchor.getFullYear(), anchor.getMonth() - 5 + index, 1)).slice(0, 7));
  const today = formatLocalDate(anchor);
  const start = months[0] + '-01';
  const createdAt = start + 'T09:00:00.000Z';
  const timestamp = (date: string) => date + 'T09:00:00.000Z';
  const offset = (days: number) => new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + days);
  const transactions: Transaction[] = [];
  const budgets: Budget[] = [];
  const tasks: Task[] = [];
  const habitLogs: HabitLog[] = [];
  const savingsContributions: SavingsContribution[] = [];

  const addTransaction = (title: string, category: string, amount: number, date: string, type: Transaction['type']) => {
    if (date > today) return;
    transactions.push({ id: id('transaction', transactions.length), type, category, description: title,
      amount, amountMinor: minor(amount), currencyCode, date, paymentMethod: type === 'income' ? 'Bank Transfer' : 'UPI', createdAt: timestamp(date) });
  };

  for (const [index, month] of months.entries()) {
    addTransaction('Monthly salary', 'cat_sal', 135000 + (index >= 3 ? 6500 : 0), month + '-01', 'income');
    if (index % 2 === 0) addTransaction('Freelance design work', 'cat_free', 11000 + variation(12000), month + '-12', 'income');
    for (const [title, category, base, day, spread] of expenses) {
      addTransaction(title, category, base + variation(spread), month + '-' + String(day).padStart(2, '0'), 'expense');
    }
    const monthlyAmount = index % 2 === 0 ? 7200 : 14500;
    budgets.push({ id: id('budget', month), monthlyAmount, amountMinor: minor(monthlyAmount), currencyCode, monthYear: month, categoryId: 'cat_food', createdAt });
    const date = month + '-01';
    const amount = 12000 + variation(5500);
    savingsContributions.push({ id: id('contribution', month), goalId: id('savings', 0), amount, amountMinor: minor(amount), currencyCode, date, createdAt: timestamp(date) });
    tasks.push({ id: id('task', month), title: taskNames[index], dueDate: date, recurring: 'None', priority: 'Medium', completed: true, completedAt: timestamp(date), createdAt: timestamp(date) });
  }

  const future = offset(3);
  future.setHours(17, 30);
  tasks.push(
    { id: id('task', 'overdue'), title: 'Replace water filter', dueDate: formatLocalDate(offset(-2)), recurring: 'None', priority: 'High', completed: false, createdAt },
    { id: id('task', 'unscheduled'), title: 'Sort old photographs', recurring: 'None', priority: 'Low', completed: false, createdAt },
    { id: id('task', 'future'), title: 'Pick up groceries', dueDate: formatLocalDate(future), dueTime: '18:00', reminderAt: future.toISOString(), recurring: 'Weekly', priority: 'Medium', completed: false, createdAt,
      subtasks: [{ id: id('subtask', 0), title: 'Check pantry', completed: true, createdAt }, { id: id('subtask', 1), title: 'Make a shopping list', completed: false, createdAt }] }
  );

  const habits: Habit[] = [
    { id: id('habit', 0), name: 'Drink water', frequency: 'daily', color: '#3b82f6', trackingMode: 'quantity', targetPerDay: 2, quantityUnit: 'L', createdAt },
    { id: id('habit', 1), name: 'Read before bed', frequency: 'daily', color: '#6b7e58', trackingMode: 'binary', createdAt },
    { id: id('habit', 2), name: 'Walk after lunch', frequency: 'weekdays', color: '#8b5cf6', trackingMode: 'binary', createdAt },
  ];
  for (const day = new Date(start + 'T12:00:00'); formatLocalDate(day) <= today; day.setDate(day.getDate() + 1)) {
    const date = formatLocalDate(day);
    const quantity = [0.75, 1.25, 1.75, 2, 2, 2.25][variation(6)];
    if (variation(9) !== 0) habitLogs.push({ id: id('log-water', date), habitId: habits[0].id, date, quantity, quantityUnit: 'L', completed: quantity >= 2, ...(quantity >= 2 ? { completedAt: timestamp(date) } : {}) });
    for (const [index, habit] of habits.entries()) {
      if (!index || (index === 2 && (day.getDay() === 0 || day.getDay() === 6))) continue;
      if (variation(index + 3) !== 0) habitLogs.push({ id: id('log-' + index, date), habitId: habit.id, date, completed: true, completedAt: timestamp(date) });
    }
  }

  const goals: Goal[] = [
    { id: id('goal', 0), title: 'Run a half marathon', category: 'Fitness', currentValue: 14, targetValue: 21.1, unit: 'km', startDate: start, targetDate: formatLocalDate(offset(55)), priority: 'Medium', status: 'In Progress', createdAt },
    { id: id('goal', 1), title: 'Finish the photography course', category: 'Education', currentValue: 8, targetValue: 8, unit: 'lessons', startDate: start, targetDate: today, priority: 'Low', status: 'Completed', createdAt },
  ];
  const milestones: Milestone[] = [
    { id: id('milestone', 0), goalId: goals[0].id, title: 'Run 5 km continuously', completed: true, completedAt: timestamp(months[1] + '-01') },
    { id: id('milestone', 1), goalId: goals[0].id, title: 'Finish a 10 km route', completed: true, completedAt: timestamp(months[3] + '-01') },
    { id: id('milestone', 2), goalId: goals[0].id, title: 'Run 18 km at an easy pace', completed: false },
    { id: id('milestone', 3), goalId: goals[1].id, title: 'Submit the final photo essay', completed: true, completedAt: timestamp(today) },
  ];
  const currentAmount = savingsContributions.reduce((sum, row) => sum + row.amount, 0);
  const savingsGoals: SavingsGoal[] = [{ id: id('savings', 0), title: 'Emergency fund', targetAmount: 240000, targetAmountMinor: minor(240000), currentAmount, currentAmountMinor: minor(currentAmount), currencyCode, targetDate: formatLocalDate(offset(160)), createdAt }];
  const plannedCommitments: PlannedCommitment[] = [
    { id: id('bill', 0), title: 'Home internet', type: 'expense', amount: 999, amountMinor: minor(999), currencyCode, frequency: 'monthly', nextDueDate: formatLocalDate(offset(8)), categoryId: 'cat_util', status: 'active', createdAt },
    { id: id('bill', 1), title: 'Apartment rent', type: 'expense', amount: 26500, amountMinor: minor(26500), currencyCode, frequency: 'monthly', nextDueDate: formatLocalDate(offset(14)), categoryId: 'cat_rent', status: 'active', createdAt },
  ];
  return { transactions, budgets, tasks, habits, habitLogs, goals, milestones, savingsGoals, savingsContributions, plannedCommitments };
}
