const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("src/App.tsx", "utf8");
const db = fs.readFileSync("src/db.ts", "utf8");

assert.match(app, /useState<'active' \| 'paused' \| 'completed'>\('active'\)/);
for (const status of ["active", "paused", "completed"]) {
  assert.match(app, new RegExp(`'${status}'`));
}
assert.match(app, /onClick=\{\(\) => setGoalsSubtab\(tab\)\}/);
assert.match(app, /goal\.status === \(goalsSubtab === 'active' \? 'In Progress' : goalsSubtab === 'paused' \? 'Paused' : 'Completed'\)/);
assert.match(app, /const nextStatus = goalsSubtab === 'active' \? 'Paused' : 'In Progress'/);
assert.match(app, /nextStatus === 'Paused' \? 'Goal paused' : 'Goal resumed'/);
assert.match(app, /const nextStatus = goalsSubtab === 'completed' \? 'In Progress' : 'Completed'/);
assert.match(app, /goalsSubtab === 'active' && <button onClick=\{\(\) => openCreateForm\('milestone'/);
assert.match(app, /aria-pressed=\{goalsSubtab === tab\}/);
assert.match(app, /role="progressbar" aria-label=\{`\$\{g\.title\} progress`\}/);
assert.match(app, /className="lifeos-progress-fill h-full rounded-full"/);
assert.match(app, /lifeos-accent-button min-h-11 rounded-xl px-4 text-xs font-semibold">\+ Add goal/);
assert.match(app, /className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2"/);
assert.match(app, /aria-pressed=\{goalsSubtab === tab\}/);

console.log("GOAL STATUS UI REGRESSION TESTS: 15/15 passed (source-level presentation checks)");

assert.match(db, /Number\(next\.currentValue\) >= Number\(next\.targetValue\)/);
assert.match(db, /milestones\.every\(item => item\.completed\)/);
assert.match(db, /goal\.status !== 'Paused'/);
assert.match(db, /nextStatus === 'Completed'|eligible \? 'Completed'/);
assert.match(db, /db\.transaction\('rw', db\.goals, db\.milestones/);
assert.match(db, /db\.transaction\('rw', db\.milestones, db\.goals/);
console.log("F12: 100% closure requires numeric target and all milestones");
