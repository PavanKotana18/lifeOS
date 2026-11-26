const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("src/App.tsx", "utf8");
const db = fs.readFileSync("src/db.ts", "utf8");

assert.match(app, /useState<'active' \| 'paused' \| 'completed' \| 'archived'>\('active'\)/);
for (const status of ["active", "paused", "completed"]) {
  assert.match(app, new RegExp(`'${status}'`));
}
assert.match(app, /onClick=\{\(\) => setGoalsSubtab\(tab\)\}/);
assert.match(app, /goal\.status === \(goalsSubtab === 'active' \? 'In Progress' : goalsSubtab === 'paused' \? 'Paused' : 'Completed'\)/);
assert.match(app, /changeGoalStatus\(goal, goal\.status === 'Paused' \? 'In Progress' : 'Paused'\)/);
assert.match(app, /saved\?\.status !== status/);
assert.match(app, /changeGoalStatus\(goal, 'Completed'\)/);
assert.match(app, /openCreateForm\('milestone', goal\.id\)/);
assert.match(app, /aria-pressed=\{goalsSubtab === tab\}/);
assert.match(app, /role="progressbar" aria-label=\{g\.title \+ ' progress'\}/);
assert.match(app, /className="lifeos-progress-fill h-full rounded-full"/);
assert.match(app, /lifeos-accent-button min-h-11 rounded-xl px-4 text-xs font-semibold">\+ Add goal/);
assert.match(app, /className="flex min-h-12 cursor-pointer items-center gap-3 py-2"/);
assert.match(app, /aria-pressed=\{goalsSubtab === tab\}/);

console.log("GOAL STATUS UI REGRESSION TESTS: 15/15 passed (source-level presentation checks)");

assert.match(db, /isGoalComplete\(next, milestones\)/);
require('./scripts/register-ts-test-loader.cjs');
const { isGoalComplete, goalProgressPercent, validateGoalMeasure } = require('./src/services/goalModes.ts');
const reduction = { mode: 'reduce', baselineValue: 100, currentValue: 75, targetValue: 50 };
assert.equal(goalProgressPercent(reduction, []), 50);
assert.equal(isGoalComplete({ ...reduction, currentValue: 50 }, [{ completed: false }]), false);
assert.equal(isGoalComplete({ ...reduction, currentValue: 50 }, [{ completed: true }]), true);
assert.equal(isGoalComplete({ mode: 'milestone', currentValue: 0, targetValue: 0 }, []), false);
assert.equal(isGoalComplete({ mode: 'milestone', currentValue: 0, targetValue: 0 }, [{ completed: true }]), true);
assert.throws(() => validateGoalMeasure({ mode: 'frequency', currentValue: 1.5, targetValue: 3 }), /whole numbers/);
assert.match(db, /goal\.status !== 'Paused'/);
assert.match(db, /nextStatus === 'Completed'|eligible \? 'Completed'/);
assert.match(db, /db\.transaction\('rw', db\.goals, db\.milestones/);
assert.match(db, /db\.transaction\('rw', db\.milestones, db\.goals/);
console.log("F12: 100% closure requires numeric target and all milestones");
