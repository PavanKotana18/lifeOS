/**
 * Core Domain Models and Business Logic for LifeOS
 */

// Streak Calculation Engine
function calculateStreaks(habitLogs, targetHabitId, todayStr) {
  // habitLogs: array of { habitId, date: 'YYYY-MM-DD', completed: boolean }
  const completedDates = new Set(
    habitLogs
      .filter(l => l.habitId === targetHabitId && l.completed)
      .map(l => l.date)
  );

  if (completedDates.size === 0) {
    return { currentStreak: 0, longestStreak: 0, completedToday: false };
  }

  const completedToday = completedDates.has(todayStr);

  // Parse all dates and sort ascending
  const sortedDates = Array.from(completedDates).sort();
  
  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = null;

  for (const dStr of sortedDates) {
    const curDate = new Date(dStr + 'T00:00:00');
    if (prevDate) {
      const diffDays = Math.round((curDate - prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak += 1;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    prevDate = curDate;
  }

  // Calculate current streak: check backward from today or yesterday
  let currentStreak = 0;
  let checkDate = new Date(todayStr + 'T00:00:00');
  
  // If not completed today, streak might still be active if completed yesterday
  if (!completedDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const yyyy = checkDate.getFullYear();
    const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
    const dd = String(checkDate.getDate()).padStart(2, '0');
    const checkStr = `${yyyy}-${mm}-${dd}`;

    if (completedDates.has(checkStr)) {
      currentStreak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak, completedToday };
}

// Financial Analytics Engine
function calculateFinanceMetrics(transactions, budgets, currentMonthStr) {
  // currentMonthStr: 'YYYY-MM'
  const monthlyTx = transactions.filter(t => t.date.startsWith(currentMonthStr));
  
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryExpenses = {};

  for (const tx of monthlyTx) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else if (tx.type === 'expense') {
      totalExpenses += amt;
      categoryExpenses[tx.category] = (categoryExpenses[tx.category] || 0) + amt;
    }
  }

  const remainingBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  // Budget calculations
  let totalBudget = 0;
  for (const b of budgets) {
    if (!b.monthYear || b.monthYear === currentMonthStr) {
      totalBudget += Number(b.monthlyAmount) || 0;
    }
  }

  const budgetUtilisation = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
  const remainingBudget = totalBudget - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    remainingBalance,
    savingsRate: Number(savingsRate.toFixed(1)),
    totalBudget,
    budgetUtilisation: Number(budgetUtilisation.toFixed(1)),
    remainingBudget,
    categoryExpenses
  };
}

// Export for node testing
module.exports = {
  calculateStreaks,
  calculateFinanceMetrics
};
