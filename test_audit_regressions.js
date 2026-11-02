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
  app.includes(
    "StorageService.budgets.upsert({ categoryId: value('categoryId') || undefined, monthlyAmount, monthYear: value('month') })"
  ),
  'Budget submission persists the optional category ID'
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

// F-05: Reminder must propagate to generated recurring tasks.
check(
  db.includes('reminderAt: task.reminderAt'),
  'Recurring task creation propagates reminderAt'
);

// F-09: Empty state guard must require both domains to be empty.
check(
  app.includes(
    'if (habits.length === 0 && todayTasks.length === 0) return null;'
  ),
  'Productivity score returns null only when both domains are empty'
);

// F-09: Empty state must not show a misleading percentage.
check(
  app.includes('productivityScore === null') &&
  app.includes('No tasks or habits scheduled today.'),
  'Dashboard displays an explicit empty productivity state'
);

// F-09: Existing score calculation remains present.
check(
  app.includes('return Math.min(100, Math.round(habitWeight + taskWeight));') &&
  app.includes('{productivityScore}% adherence today'),
  'Existing productivity scoring remains active for non-empty days'
);

console.log(`AUDIT REGRESSION SOURCE TESTS: ${passed}/12 PASSED`);
