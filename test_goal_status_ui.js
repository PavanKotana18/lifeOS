const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("src/App.tsx", "utf8");

assert.match(app, /useState<'active' \| 'paused' \| 'completed'>\('active'\)/);
for (const status of ["active", "paused", "completed"]) {
  assert.match(app, new RegExp(`setGoalsSubtab\\('${status}'\\)`));
}
assert.match(app, /goal\.status === \(goalsSubtab === 'active' \? 'In Progress' : goalsSubtab === 'paused' \? 'Paused' : 'Completed'\)/);
assert.match(app, /const nextStatus = goalsSubtab === 'active' \? 'Paused' : 'In Progress'/);
assert.match(app, /nextStatus === 'Paused' \? 'Goal paused' : 'Goal resumed'/);
assert.match(app, /const nextStatus = goalsSubtab === 'completed' \? 'In Progress' : 'Completed'/);
assert.match(app, /goalsSubtab === 'active' && <button onClick=\{\(\) => openCreateForm\('milestone'/);

console.log("GOAL STATUS UI REGRESSION TESTS: 9/9 passed");
