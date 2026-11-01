export function buildFinanceAnalytics(transactions: Array<{ date: string; amount: number; type: string; category?: string }>, budgets: Array<{ monthYear?: string; categoryId?: string; monthlyAmount: number }>, month: string, range = 6, categoryRecords: Array<{ id: string; name: string }> = []) {
  const [year, monthNumber] = month.split('-').map(Number);
  const monthDate = new Date(year, monthNumber - 1, 1);
  const count = Math.max(2, range);
  const periods = Array.from({ length: count }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth() - count + 1 + index, 1));
  const periodRows = periods.map(date => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const rows = transactions.filter(tx => tx.date?.startsWith(key));
    return {
      month: date.toLocaleDateString('en', { month: 'short' }), key, hasRecords: rows.length > 0,
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
    name, amount, percentage: totalExpenses ? amount / totalExpenses * 100 : 0,
  }));
  const monthBudgets = budgets.filter(budget => !budget.monthYear || budget.monthYear === month);
  const budgetRows = monthBudgets.map(budget => {
    const categoryName = budget.categoryId
      ? categoryRecords.find(category => category.id === budget.categoryId)?.name
      : undefined;
    const amountSpent = budget.categoryId
      ? (categoryName ? categoryExpenses[categoryName] || 0 : 0)
      : totalExpenses;
    return {
      category: budget.categoryId ? (categoryName || 'Unknown category') : 'Overall',
      allocated: Number(budget.monthlyAmount) || 0,
      spent: amountSpent,
      remaining: (Number(budget.monthlyAmount) || 0) - amountSpent,
    };
  });
  const expenseChange = previous.hasRecords ? ((previous.expenses || 0) === 0 ? (totalExpenses === 0 ? 0 : null) : (totalExpenses - (previous.expenses || 0)) / (previous.expenses || 0) * 100) : null;
  return {
    periodRows, categories, budgetRows, totalIncome, totalExpenses,
    netSavings: totalIncome - totalExpenses,
    savingsRate: totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome * 100 : null,
    expenseChange, previousMonthHasRecords: previous.hasRecords,
    largestCategory: categories[0] || null,
  };
}
