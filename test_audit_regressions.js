const fs = require('fs');
const assert = require('assert');

const db = fs.readFileSync('src/db.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

let passed = 0;

function check(condition, message) {
  assert.ok(condition, message);
  passed++;
  console.log('PASS:', message);
}

// F-01: Demo budget must use a seeded category ID.
check(
  db.includes("categoryId: 'cat_food'") &&
  db.includes("id: 'cat_food'"),
  'Demo Food budget references the seeded Food category ID'
);

// F-02: Category selector must be connected to draft state.
check(
  app.includes('Budget category (optional)') &&
  app.includes("value={createDraft.categoryId || ''}") &&
  app.includes("categoryId: e.target.value"),
  'Budget form exposes and stores the selected category ID'
);

// F-02: Form submission must persist the selected category.
check(
  app.includes("const money = createMoneyRecordAmount(value('amount'), userPrefs.currency)") &&
  app.includes("StorageService.budgets.upsert({ categoryId: value('categoryId') || undefined, monthlyAmount: money.amount, amountMinor: money.amountMinor, currencyCode: money.currencyCode, monthYear: value('month') })"),
  'Budget submission persists category, exact minor units, and explicit currency'
);

// F-02: Empty category must retain overall-budget behaviour.
check(
  app.includes('<option value="">Overall budget</option>') &&
  app.includes("categoryId: value('categoryId') || undefined"),
  'Empty category selection continues to create an overall budget'
);

// F-03: Category IDs must resolve through the category list.
check(
  app.includes(
    "categories.find(category => category.id === b.categoryId)?.name"
  ),
  'Category budget resolves its ID to the category display name'
);

// F-03: Spending lookup must use the resolved category name.
check(
  app.includes(
    "financeMetrics.categoryExpenses[budgetCategoryName]"
  ),
  'Category budget spending uses the transaction category name'
);

// F-03: Missing category must not be attributed to overall expenses.
check(
  app.includes(
    "budgetCategoryName ? financeMetrics.categoryExpenses[budgetCategoryName] || 0 : 0"
  ),
  'Missing category reference safely produces zero category spending'
);

// F-03: Overall budget must still use total expenses.
check(
  app.includes(
    "b.categoryId ? (budgetCategoryName ? financeMetrics.categoryExpenses[budgetCategoryName] || 0 : 0) : financeMetrics.totalExpenses"
  ),
  'Overall budget continues to calculate against total expenses'
);

// F-04: Transaction categories must be checked against stored categories.
check(
  db.includes('async function assertTransactionCategory(') &&
  db.includes('The selected category does not match the transaction type.') &&
  db.includes('The selected category does not exist. Choose an available category.'),
  'Transaction storage validates category existence and transaction type'
);

// F-04: Add and update must validate category references atomically.
check(
  db.includes("db.transaction('rw', db.transactions, db.categories") &&
  db.includes('await assertTransactionCategory(tx.category, tx.type);') &&
  db.includes('await assertTransactionCategory(updated.category, updated.type, existing);'),
  'Transaction add and update validate category references within Dexie transactions'
);

// F-04: Category identity changes must protect existing transaction references.
check(
  db.includes('Category is used by existing transactions. Reassign those transactions before changing its name or type.'),
  'Category rename and type changes are blocked while transactions reference the category'
);

// F-04: Category deletion must protect both budget and transaction references.
check(
  db.includes("db.transaction('rw', db.categories, db.budgets, db.transactions") &&
  db.includes('Category is used by existing transactions. Reassign or remove those transactions before deleting it.'),
  'Category deletion is blocked while budgets or transactions reference it'
);

// F-04: New transactions should default to an available expense category.
check(
  app.includes("kind === 'transaction' ? (categories.find(category => category.type === 'expense')?.name || '')"),
  'New transactions default to the first available expense category'
);

// F-04: Transaction category options must be filtered by transaction type.
check(
  app.includes('categories.filter(category => category.type === createDraft.type).map(category => (') &&
  app.includes('<option value="">Select category</option>'),
  'Transaction category dropdown displays only categories matching its type'
);

// F-04: Switching transaction type must select a category of the new type.
check(
  app.includes("const type = e.target.value as 'income' | 'expense';") &&
  app.includes('const category = categories.find(item => item.type === type)?.name || \'\';'),
  'Changing transaction type resets the category to a valid matching category'
);

// F-04: Editing historical transactions must preserve an unavailable legacy category.
check(
  app.includes('Legacy category: {createDraft.category}') &&
  app.includes('!categories.some(category => category.name === createDraft.category && category.type === createDraft.type)'),
  'Transaction edit form preserves unchanged legacy category values'
);

// F-05: Reminder must propagate to generated recurring tasks.
check(
  db.includes('reminderAt: task.reminderAt'),
  'Recurring task creation propagates reminderAt'
);

// Dashboard presents transparent per-domain counts and does not publish an opaque composite score.
check(
  app.includes('getTodayOverview(tasks, habits, habitLogs, todayKey)') &&
  app.includes('Tasks due today') && app.includes('Routines today') &&
  !app.includes('productivityScore') && !app.includes('adherence today'),
  'Dashboard exposes separate task and routine counts without a composite score'
);

// Savings contributions affect goal progress only. They do not represent spending.
check(
  db.includes('async addContribution(contribution)') &&
  !db.includes('linkedExpense') &&
  app.includes('StorageService.savings.addContribution({') &&
  app.includes('amountMinor: money.amountMinor') &&
  !app.includes('paymentMethod: \'Savings transfer\''),
  'New savings contributions update goal progress without creating expense records'
);

// Savings balance and contribution records still share one atomic operation.
check(
  db.includes('db.savingsGoals,') &&
  db.includes('db.savingsContributions,') &&
  db.includes('await db.savingsGoals.update(goal.id, {') &&
  db.includes('await db.savingsContributions.add({'),
  'Savings goal balance and contribution remain atomically persisted'
);

// UI explains that goal progress is not an expense.
check(
  app.includes('Account transfers are not available yet') &&
  !app.includes('Record this contribution as an expense in monthly cash flow'),
  'Savings contribution UI distinguishes saving from spending'
);

console.log(`AUDIT REGRESSION SOURCE TESTS: ${passed}/21 PASSED`);
