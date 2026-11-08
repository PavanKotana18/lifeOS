import { decimalToMinorUnits, minorUnitsToDecimal, sumMinorUnits } from './financeCore';

const toMinorUnits = (value: number, currencyCode: string) => {
  const amount = Number(value);
  return decimalToMinorUnits(Number.isFinite(amount) ? amount : 0, currencyCode);
};
const fromMinorUnits = (amount: bigint, currencyCode: string) => Number(minorUnitsToDecimal(amount, currencyCode));

export function buildFinanceAnalytics(
  transactions: Array<{ date: string; amount: number; amountMinor?: string; currencyCode?: string; type: string; category?: string }>,
  budgets: Array<{ monthYear?: string; categoryId?: string; monthlyAmount: number; amountMinor?: string; currencyCode?: string }>,
  month: string,
  range = 6,
  categoryRecords: Array<{ id: string; name: string }> = [],
  currencyCode = 'INR'
) {
  const compatibleTransaction = (tx: { currencyCode?: string }) => !tx.currencyCode || tx.currencyCode === currencyCode;
  const minorForTransaction = (tx: { amount: number; amountMinor?: string; currencyCode?: string }) =>
    tx.amountMinor !== undefined && tx.currencyCode === currencyCode && /^(0|[1-9]\d*)$/.test(tx.amountMinor)
      ? BigInt(tx.amountMinor)
      : toMinorUnits(tx.amount, currencyCode);
  const [year, monthNumber] = month.split('-').map(Number);
  const monthDate = new Date(year, monthNumber - 1, 1);
  const count = Math.max(2, range);
  const periods = Array.from({ length: count }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth() - count + 1 + index, 1));
  const periodMinorRows = periods.map(date => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const rows = transactions.filter(tx => tx.date?.startsWith(key) && compatibleTransaction(tx));
    return {
      month: date.toLocaleDateString('en', { month: 'short' }), key, hasRecords: rows.length > 0,
      incomeMinor: rows.length ? sumMinorUnits(rows.filter(tx => tx.type === 'income').map(minorForTransaction)) : null,
      expensesMinor: rows.length ? sumMinorUnits(rows.filter(tx => tx.type === 'expense').map(minorForTransaction)) : null,
    };
  });
  const periodRows = periodMinorRows.map(({ incomeMinor, expensesMinor, ...row }) => ({
    ...row,
    income: incomeMinor === null ? null : fromMinorUnits(incomeMinor, currencyCode),
    expenses: expensesMinor === null ? null : fromMinorUnits(expensesMinor, currencyCode),
  }));
  const previous = periodMinorRows[periodMinorRows.length - 2];
  const allCurrentTransactions = transactions.filter(tx => tx.date?.startsWith(month));
  const currentTransactions = allCurrentTransactions.filter(compatibleTransaction);
  const totalIncomeMinor = sumMinorUnits(currentTransactions.filter(tx => tx.type === 'income').map(minorForTransaction));
  const totalExpensesMinor = sumMinorUnits(currentTransactions.filter(tx => tx.type === 'expense').map(minorForTransaction));
  const totalIncome = fromMinorUnits(totalIncomeMinor, currencyCode);
  const totalExpenses = fromMinorUnits(totalExpensesMinor, currencyCode);
  const categoryExpenseMinor: Record<string, bigint> = Object.create(null);
  for (const tx of currentTransactions) {
    if (tx.type !== 'expense') continue;
    const category = tx.category || 'Uncategorized';
    categoryExpenseMinor[category] = (categoryExpenseMinor[category] || 0n) + minorForTransaction(tx);
  }
  // Category names are user data, including names such as "constructor".
  const categoryExpenses: Record<string, number> = Object.create(null);
  for (const [category, amountMinor] of Object.entries(categoryExpenseMinor)) {
    categoryExpenses[category] = fromMinorUnits(amountMinor, currencyCode);
  }
  const categories = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({
    name, amount, percentage: totalExpenses ? amount / totalExpenses * 100 : 0,
  }));
  const monthBudgets = budgets.filter(budget => (!budget.monthYear || budget.monthYear === month) && (!budget.currencyCode || budget.currencyCode === currencyCode));
  const budgetRows = monthBudgets.map(budget => {
    const categoryName = budget.categoryId
      ? categoryRecords.find(category => category.id === budget.categoryId)?.name
      : undefined;
    const allocatedMinor = budget.amountMinor && budget.currencyCode === currencyCode && /^(0|[1-9]\d*)$/.test(budget.amountMinor)
      ? BigInt(budget.amountMinor) : toMinorUnits(budget.monthlyAmount, currencyCode);
    const spentMinor = budget.categoryId
      ? (categoryName ? categoryExpenseMinor[categoryName] || 0n : 0n)
      : totalExpensesMinor;
    return {
      category: budget.categoryId ? (categoryName || 'Unknown category') : 'Overall',
      allocated: fromMinorUnits(allocatedMinor, currencyCode),
      spent: fromMinorUnits(spentMinor, currencyCode),
      remaining: fromMinorUnits(allocatedMinor - spentMinor, currencyCode),
    };
  });
  const previousExpensesMinor = previous.expensesMinor || 0n;
  const expenseChange = previous.hasRecords
    ? (previousExpensesMinor === 0n
      ? (totalExpensesMinor === 0n ? 0 : null)
      : Number((totalExpensesMinor - previousExpensesMinor) * 1_000_000n / previousExpensesMinor) / 10_000)
    : null;
  const netSavingsMinor = totalIncomeMinor - totalExpensesMinor;
  return {
    periodRows, categories, budgetRows, totalIncome, totalExpenses,
    netSavings: fromMinorUnits(netSavingsMinor, currencyCode),
    savingsRate: totalIncomeMinor > 0n ? Number(netSavingsMinor * 1_000_000n / totalIncomeMinor) / 10_000 : null,
    expenseChange, previousMonthHasRecords: previous.hasRecords,
    largestCategory: categories[0] || null,
    excludedCurrencyCount: allCurrentTransactions.length - currentTransactions.length + budgets.filter(b => (!b.monthYear || b.monthYear === month) && b.currencyCode && b.currencyCode !== currencyCode).length,
  };
}
