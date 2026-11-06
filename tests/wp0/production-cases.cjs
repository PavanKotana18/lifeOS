'use strict';
const assert = require('node:assert/strict');
const h = require('./production-harness.cjs');

async function usingFixture(fn) {
  const f = await h.fixture();
  try { return await fn(f); } finally { await f.dispose(); }
}
async function seed(f) {
  f.sessionManager.unlock();
  await f.StorageService.categories.getAll();
  await f.StorageService.backup.seedDemoData();
  await f.StorageService.settings.set('wp0Synthetic', true);
  const json = await f.StorageService.backup.exportData();
  const parsed = JSON.parse(json);
  h.equal(f.validateBackupTables(parsed.tables), h.TABLES, 'Actual validator contract');
  for (const table of h.TABLES) h.check(parsed.tables[table].length > 0, `Nonempty fixture ${table}`);
  return json;
}
async function snapshot(f) {
  return Object.fromEntries(await Promise.all(h.TABLES.map(async name =>
    [name, await f.lifeOSDatabase.table(name).toArray()])));
}
const goal = { title: 'WP0 synthetic goal', category: 'Fitness', targetValue: 10,
  currentValue: 0, unit: 'km', startDate: '2026-01-01', targetDate: '2026-12-31',
  priority: 'Medium', status: 'In Progress' };
async function goalOutcomes(s) {
  const read = async id => (await s.goals.getAll()).find(g => g.id === id).status;
  const a = await s.goals.add(goal);
  await s.goals.update(a.id, { currentValue: 10 });
  const targetReached = await read(a.id);
  const b = await s.goals.add(goal);
  await s.goals.update(b.id, { status: 'Completed' });
  const prematureCompletion = await read(b.id);
  const c = await s.goals.add({ ...goal, currentValue: 10 });
  const m = await s.goals.addMilestone({ goalId: c.id, title: 'WP0 milestone', completed: false });
  await s.goals.toggleMilestone(m.id, true);
  const lastMilestone = await read(c.id);
  await s.goals.toggleMilestone(m.id, false);
  const reopenedMilestone = await read(c.id);
  const d = await s.goals.add({ ...goal, status: 'Paused' });
  await s.goals.update(d.id, { currentValue: 10 });
  return { targetReached, prematureCompletion, lastMilestone, reopenedMilestone, paused: await read(d.id) };
}
async function recurrenceOutcomes(s) {
  const result = {};
  for (const recurring of ['Daily', 'Weekly', 'Monthly']) {
    const task = await s.tasks.add({ title: `WP0 ${recurring}`, dueDate: '2020-01-31',
      priority: 'Medium', category: 'General', recurring, completed: false });
    await s.tasks.toggleCompleted(task.id, true);
    const tasks = await s.tasks.getAll();
    const source = tasks.find(t => t.id === task.id);
    const next = tasks.find(t => t.id === source.spawnedTaskId);
    h.check(next && !next.completed, 'Actual backend must create linked next occurrence');
    await s.tasks.toggleCompleted(task.id, true);
    h.equal((await s.tasks.getAll()).length, tasks.length, 'Completion remains idempotent');
    result[recurring] = next.dueDate;
  }
  return result;
}
// Small test parser: assertions below also test quoting/newlines. It does not evaluate formulas.
function parseCsv(csv) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && ch === ',') { row.push(cell); cell = ''; }
    else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  assert.equal(quoted, false, 'Unbalanced CSV quotes');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const cases = [
  { id: 'CONTROL-INTEGRATION', category: 'Production integration + mocked native simulation', known: false,
    async run() { await usingFixture(async f => {
      await assert.rejects(f.StorageService.transactions.getAll(), /locked/i);
      const original = await seed(f);
      await f.StorageService.backup.importData(original, { replaceExisting: true });
      h.equal(JSON.parse(await f.StorageService.backup.exportData()).tables, JSON.parse(original).tables,
        'Raw restore exercises actual validator and Dexie');
      await f.activate();
      const rows = await f.lifeOSDatabase.transactions.toArray();
      h.check(rows.every(r => r.__lifeosEncrypted === 1 && r.amount === undefined && r.description === undefined),
        'Explicitly activated production runtime seals stored fields');
      const exported = JSON.parse(await f.StorageService.backup.exportData());
      h.equal(exported.tables, JSON.parse(original).tables, 'Actual encrypted facade decrypts every domain');
      const before = await snapshot(f);
      const repositories = f.encryptedStorageRuntime.repositories;
      const first = (await repositories.transactions.getAll())[0];
      const category = (await repositories.categories.getAll())[0];
      await assert.rejects(f.encryptedStorageRuntime.transactionCoordinator.run(async tx => {
        tx.put('transactions', { ...first, amount: 999 });
        tx.add('categories', category); // Real duplicate primary key fails second table commit.
      }), /Constraint|already exists/i);
      h.equal(await snapshot(f), before, 'Actual prepared multi-table commit rolled back');
      const bad = structuredClone(exported); bad.tables.transactions[0].amount = -1;
      await assert.rejects(f.StorageService.backup.importData(JSON.stringify(bad), { replaceExisting: true }), /Invalid backup/);
      h.equal(await snapshot(f), before, 'Invalid backup does not change ciphertext');
      const row = rows[0];
      await assert.rejects(f.load('src/services/cryptoService.ts').CryptoService
        .decryptRecord('transactions', 'wrong-record', 1, row.encrypted));
      h.check(f.native.calls.includes('encrypt') && f.native.calls.includes('decrypt'), 'Real TS wrapper uses simulated native API');
    }); }
  },
  { id: 'LOS-001', category: 'Production integration / AST-extracted startup; simulated browser/native', known: true,
    async run() { await usingFixture(async f => {
      const init = h.appFunction('initApp');
      const deps = { ...f.appDeps(), ...h.noopSetters(init) };
      // Executes the real startup function, not a hand-written call to session.unlock().
      await h.bind(init, deps)();
      h.check(f.sessionManager.isUnlocked(), 'Actual optional-lock startup admitted session');
      const tx = await f.StorageService.transactions.add({ type: 'expense', amount: 12.34,
        category: 'Food', description: 'WP0 SYNTHETIC', date: '2026-11-06', paymentMethod: 'Cash' });
      const stored = await f.lifeOSDatabase.transactions.get(tx.id);
      h.contract({ activated: f.isEncryptedStorageActivated(), encrypted: stored.__lifeosEncrypted === 1,
        plaintextFieldsAbsent: stored.description === undefined && stored.amount === undefined },
      { activated: true, encrypted: true, plaintextFieldsAbsent: true });
    }); }
  },
  { id: 'LOS-002', category: 'Production integration; real validator/facade/coordinator/Dexie; simulated native', known: true,
    async run() { await usingFixture(async f => {
      await seed(f); await f.activate();
      const json = await f.StorageService.backup.exportData();
      h.equal(f.validateBackupTables(JSON.parse(json).tables), h.TABLES, 'Backup valid before acceptance assertion');
      const before = await snapshot(f);
      try { await f.StorageService.backup.importData(json, { replaceExisting: true }); }
      catch (error) {
        if (!/^Invalid backup: transactions, categories, budgets,/.test(error.message)) throw error;
        h.equal(await snapshot(f), before, 'Rejected restore preserved all11 ciphertext tables');
        h.contract({ restored: false, reason: 'Valid table-name list treated as errors' }, { restored: true });
      }
      h.equal(JSON.parse(await f.StorageService.backup.exportData()).tables, JSON.parse(json).tables,
        'Accepted restore must roundtrip exact logical relationships');
    }); }
  },
  { id: 'LOS-003', category: 'Mocked native lifecycle simulation + actual App callback / encrypted DB', known: true,
    async run() { await usingFixture(async f => {
      await seed(f); await f.activate();
      const deps = f.appDeps(), errors = [];
      const realReload = deps.reloadAllData; let reloads = 0;
      deps.reloadAllData = async () => { const result = await realReload(); reloads++; return result; };
      deps.console = { error: (...args) => errors.push(String(args[1]?.message || args[0])) };
      const expression = h.lifecycleCallback();
      const cb = h.bind(expression, { ...deps, ...h.noopSetters(expression) },
        'let disposed = false; let resumeInProgress = false;');
      await cb({ isActive: false });
      h.equal(f.sessionManager.isUnlocked(), false, 'Actual background callback closes JS admission');
      f.native.onStop(); // Android is unavailable: explicit simulated DEK eviction, never a Java pass.
      h.equal((await f.native.isUnlocked()).unlocked, false, 'Simulated onStop evicts key');
      await cb({ isActive: true });
      h.check(errors.every(e => e === 'SIMULATED_NATIVE_KEY_LOCKED'), 'Unexpected lifecycle error is a harness failure');
      h.contract({ nativeKeyAvailable: (await f.native.isUnlocked()).unlocked,
        protectedReloadCompleted: reloads > 0 }, { nativeKeyAvailable: true, protectedReloadCompleted: true });
    }); }
  },
  { id: 'LOS-007', category: 'Production integration: raw/encrypted goal API parity; simulated native', known: true,
    async run() { await usingFixture(async f => {
      f.sessionManager.unlock();
      const expected = await goalOutcomes(f.StorageService);
      h.equal(expected, { targetReached: 'Completed', prematureCompletion: 'In Progress',
        lastMilestone: 'Completed', reopenedMilestone: 'In Progress', paused: 'Paused' }, 'Raw goal semantics independently checked');
      await f.StorageService.backup.clearAll(); await f.activate();
      const actual = await goalOutcomes(f.StorageService);
      h.contract(actual, expected);
    }); }
  },
  { id: 'LOS-008', category: 'Production integration: raw/encrypted recurrence parity; fixed local clock; simulated native', known: true,
    async run() { await usingFixture(async f => {
      f.sessionManager.unlock();
      const expected = await recurrenceOutcomes(f.StorageService);
      h.check(Object.values(expected).every(date => date > '2026-11-06'), 'Raw next dates must be after fixed local today');
      await f.StorageService.backup.clearAll(); await f.activate();
      h.contract(await recurrenceOutcomes(f.StorageService), expected);
    }); }
  },
  { id: 'LOS-009', category: 'Mocked native pending-alarm simulation + actual reset handler / Dexie', known: true,
    async run() { await usingFixture(async f => {
      await seed(f);
      const s = f.StorageService, ns = f.NotificationService;
      const habit = (await s.habits.getAll())[0];
      await s.habits.update(habit.id, { reminderTime: '09:00' });
      const milestones = await s.goals.getAllMilestones();
      await f.lifeOSDatabase.milestones.update(milestones[0].id, { targetDate: '2026-12-01', completed: false });
      const enabled = Object.fromEntries(Object.keys(f.DEFAULT_NOTIFICATION_PREFERENCES).map(k => [k, true]));
      await ns.syncHabits(await s.habits.getAll(), enabled);
      await ns.syncMilestones(await s.goals.getAll(), await s.goals.getAllMilestones(), enabled);
      h.check([...f.pending.values()].some(n => n.extra.kind === 'habitReminder'), 'Real service scheduled fixture habit');
      h.check([...f.pending.values()].some(n => n.extra.kind === 'milestoneReminder'), 'Real service scheduled fixture milestone');
      f.pending.set(-7, { id: -7, extra: { kind: 'unrelated-fixture' } });
      const expression = h.buttonHandler('Clear All Application Data');
      await h.bind(expression, f.appDeps())();
      h.equal(await f.lifeOSDatabase.habits.count(), 0, 'Actual reset cleared habit data');
      h.equal(await f.lifeOSDatabase.milestones.count(), 0, 'Actual reset cleared milestone data');
      h.check(f.pending.has(-7), 'Unrelated native alarm must be retained');
      const remaining = [...f.pending.values()].filter(n => n.extra?.kind !== 'unrelated-fixture').map(n => n.extra.kind);
      h.contract([...new Set(remaining)].sort(), []);
    }); }
  },
  { id: 'LOS-010', category: 'Production AST-extracted export handler; simulated file export/browser', known: true,
    async run() { await usingFixture(async f => {
      const expression = h.buttonHandler('Export transactions CSV');
      const payloads = ['=1+1', '+1+1', '-1+1', '@SUM(1)', '\t=1+1', '\r=1+1'];
      const descriptions = [...payloads, 'literal, "quotes"\nsecond line'];
      let contents;
      await h.bind(expression, { ...f.appDeps(),
        transactions: descriptions.map((description, i) => ({ id: `wp0-${i}`, type: 'expense',
          description, amount: 1, category: 'Food', date: '2026-11-06',
          createdAt: '2026-11-06T06:30:00.000Z', paymentMethod: 'Cash' })),
        async exportBackupFile(options) { contents = options.contents; return { status: 'saved', bytesWritten: Buffer.byteLength(contents) }; }
      })();
      h.check(typeof contents === 'string', 'Actual UI export must invoke file bridge');
      const rows = parseCsv(contents), column = rows[0].indexOf('description');
      h.check(column >= 0 && rows.length === descriptions.length + 1, 'CSV header and row counts');
      h.equal(rows.at(-1)[column], descriptions.at(-1), 'Literal commas/quotes/newlines survive production export');
      h.contract(rows.slice(1, -1).map(r => r[column]), payloads.map(p => "'" + p));
    }); }
  }
];
module.exports = { cases, parseCsv };
