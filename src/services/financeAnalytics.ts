export interface FinancialInsight {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'positive' | 'warning' | 'alert';
  type: 'budget' | 'category' | 'trend' | 'savings';
}

export interface MonthOverMonthComparison {
  hasPriorRecords: boolean;
  currentIncome: number;
  previousIncome: number;
  incomeDelta: number;
  incomeChangePct: number | null;
  currentExpenses: number;
  previousExpenses: number;
  expenseDelta: number;
  expenseChangePct: number | null;
  currentSavings: number;
  previousSavings: number;
  savingsDelta: number;
}

export interface BudgetStatusItem {
  category: string;
  allocated: number;
  spent: number;
  remaining: number;
  utilizationPct: number;
  status: 'normal' | 'approaching' | 'exceeded';
}

export interface BudgetStatusSummary {
  totalAllocated: number;
  totalSpent: number;
  remaining: number;
  utilizationPct: number;
  status: 'no_budget' | 'under_budget' | 'approaching_limit' | 'exceeded';
  items: BudgetStatusItem[];
}

export function buildFinanceAnalytics(
  transactions: Array<{ date: string; amount: number; type: string; category?: string }>,
  budgets: Array<{ monthYear?: string; categoryId?: string; monthlyAmount: number }>,
  month: string,
  range = 6
) {
  const [year, monthNumber] = month.split('-').map(Number);
  const monthDate = new Date(year, monthNumber - 1, 1);
  const count = Math.max(2, range);
  const periods = Array.from({ length: count }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth() - count + 1 + index, 1));
  const periodRows = periods.map(date => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const rows = transactions.filter(tx => tx.date?.startsWith(key));
    return {
      month: date.toLocaleDateString('en', { month: 'short' }),
      key,
      hasRecords: rows.length > 0,
      income: rows.length ? rows.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount || 0), 0) : null,
      expenses: rows.length ? rows.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount || 0), 0) : null,
    };
  });

  const current = periodRows[periodRows.length - 1];
  const previous = periodRows[periodRows.length - 2];
  const currentTransactions = transactions.filter(tx => tx.date?.startsWith(month));
  const totalIncome = current.income || 0;
  const totalExpenses = current.expenses || 0;

  const categoryExpenses = currentTransactions.filter(tx => tx.type === 'expense').reduce<Record<string, number>>((acc, tx) => {
    const category = tx.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + Number(tx.amount || 0);
    return acc;
  }, {});

  const categories = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({
    name,
    amount,
    percentage: totalExpenses ? amount / totalExpenses * 100 : 0,
  }));

  const monthBudgets = budgets.filter(budget => !budget.monthYear || budget.monthYear === month);
  let totalAllocatedBudget = 0;

  const budgetRows: BudgetStatusItem[] = monthBudgets.map(budget => {
    const allocated = Number(budget.monthlyAmount) || 0;
    totalAllocatedBudget += allocated;
    const spent = budget.categoryId ? categoryExpenses[budget.categoryId] || 0 : totalExpenses;
    const remaining = allocated - spent;
    const utilizationPct = allocated > 0 ? (spent / allocated) * 100 : 0;
    let status: 'normal' | 'approaching' | 'exceeded' = 'normal';
    if (allocated > 0) {
      if (spent >= allocated) status = 'exceeded';
      else if (utilizationPct >= 80) status = 'approaching';
    }
    return {
      category: budget.categoryId || 'Overall budget',
      allocated,
      spent,
      remaining,
      utilizationPct,
      status,
    };
  });

  const totalBudgetSpent = budgetRows.reduce((sum, b) => sum + b.spent, 0);
  const totalBudgetUtilization = totalAllocatedBudget > 0 ? (totalExpenses / totalAllocatedBudget) * 100 : 0;
  const overallBudgetStatus: 'no_budget' | 'under_budget' | 'approaching_limit' | 'exceeded' =
    totalAllocatedBudget === 0
      ? 'no_budget'
      : totalExpenses >= totalAllocatedBudget
        ? 'exceeded'
        : totalBudgetUtilization >= 80
          ? 'approaching_limit'
          : 'under_budget';

  const budgetSummary: BudgetStatusSummary = {
    totalAllocated: totalAllocatedBudget,
    totalSpent: totalExpenses,
    remaining: totalAllocatedBudget - totalExpenses,
    utilizationPct: totalBudgetUtilization,
    status: overallBudgetStatus,
    items: budgetRows,
  };

  const priorIncome = previous.income ?? 0;
  const priorExpenses = previous.expenses ?? 0;
  const priorSavings = priorIncome - priorExpenses;
  const currentSavings = totalIncome - totalExpenses;

  const expenseChange = previous.hasRecords
    ? (priorExpenses === 0
        ? (totalExpenses === 0 ? 0 : null)
        : (totalExpenses - priorExpenses) / priorExpenses * 100)
    : null;

  const incomeChange = previous.hasRecords
    ? (priorIncome === 0
        ? (totalIncome === 0 ? 0 : null)
        : (totalIncome - priorIncome) / priorIncome * 100)
    : null;

  const monthOverMonth: MonthOverMonthComparison = {
    hasPriorRecords: previous.hasRecords,
    currentIncome: totalIncome,
    previousIncome: priorIncome,
    incomeDelta: totalIncome - priorIncome,
    incomeChangePct: incomeChange,
    currentExpenses: totalExpenses,
    previousExpenses: priorExpenses,
    expenseDelta: totalExpenses - priorExpenses,
    expenseChangePct: expenseChange,
    currentSavings,
    previousSavings: priorSavings,
    savingsDelta: currentSavings - priorSavings,
  };

  const netSavings = currentSavings;
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome * 100 : null;
  const priorSavingsRate = previous.hasRecords && priorIncome > 0 ? (priorIncome - priorExpenses) / priorIncome * 100 : null;

  // Generate deterministic, data-backed financial insights
  const insights: FinancialInsight[] = [];

  // 1. Budget warnings and alerts
  for (const b of budgetRows) {
    if (b.status === 'exceeded') {
      insights.push({
        id: `budget-exceeded-${b.category}`,
        title: `${b.category} budget exceeded`,
        description: `Spending of ${b.spent.toLocaleString()} has exceeded the allocated limit of ${b.allocated.toLocaleString()} by ${(b.spent - b.allocated).toLocaleString()} (${b.utilizationPct.toFixed(0)}% used).`,
        severity: 'alert',
        type: 'budget',
      });
    } else if (b.status === 'approaching') {
      insights.push({
        id: `budget-approaching-${b.category}`,
        title: `${b.category} budget approaching limit`,
        description: `${b.utilizationPct.toFixed(0)}% of the ${b.allocated.toLocaleString()} budget has been spent. ${b.remaining.toLocaleString()} remains available.`,
        severity: 'warning',
        type: 'budget',
      });
    }
  }

  // 2. Highest spending category insight
  if (categories.length > 0 && totalExpenses > 0) {
    const top = categories[0];
    if (top.percentage >= 50) {
      insights.push({
        id: 'category-dominant',
        title: `High concentration in ${top.name}`,
        description: `${top.name} accounts for ${top.percentage.toFixed(1)}% of all expenses this month (${top.amount.toLocaleString()}).`,
        severity: 'warning',
        type: 'category',
      });
    } else {
      insights.push({
        id: 'category-highest',
        title: `Top spending category: ${top.name}`,
        description: `${top.name} represents your largest monthly expense at ${top.amount.toLocaleString()} (${top.percentage.toFixed(1)}% of total expenses).`,
        severity: 'info',
        type: 'category',
      });
    }
  }

  // 3. Month-over-month trend insights (only when sufficient prior data exists)
  if (previous.hasRecords) {
    if (expenseChange !== null) {
      if (expenseChange <= -10) {
        insights.push({
          id: 'trend-expense-reduction',
          title: 'Spending decreased significantly',
          description: `Total expenses dropped by ${Math.abs(expenseChange).toFixed(1)}% compared to ${previous.month} (saved ${(priorExpenses - totalExpenses).toLocaleString()}).`,
          severity: 'positive',
          type: 'trend',
        });
      } else if (expenseChange >= 15) {
        insights.push({
          id: 'trend-expense-increase',
          title: 'Spending increased this month',
          description: `Expenses increased by ${expenseChange.toFixed(1)}% compared to ${previous.month} (an additional ${(totalExpenses - priorExpenses).toLocaleString()}).`,
          severity: 'warning',
          type: 'trend',
        });
      }
    }

    if (savingsRate !== null && priorSavingsRate !== null) {
      const rateDelta = savingsRate - priorSavingsRate;
      if (rateDelta >= 5) {
        insights.push({
          id: 'savings-rate-improved',
          title: 'Savings rate improved',
          description: `Your savings rate increased from ${priorSavingsRate.toFixed(1)}% to ${savingsRate.toFixed(1)}% (+${rateDelta.toFixed(1)}% improvement).`,
          severity: 'positive',
          type: 'savings',
        });
      } else if (rateDelta <= -10) {
        insights.push({
          id: 'savings-rate-declined',
          title: 'Savings rate declined',
          description: `Your savings rate fell from ${priorSavingsRate.toFixed(1)}% to ${savingsRate.toFixed(1)}% (${rateDelta.toFixed(1)}% decrease).`,
          severity: 'warning',
          type: 'savings',
        });
      }
    }
  }

  return {
    periodRows,
    categories,
    budgetRows,
    budgetSummary,
    monthOverMonth,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    expenseChange,
    previousMonthHasRecords: previous.hasRecords,
    largestCategory: categories[0] || null,
    insights,
  };
}
