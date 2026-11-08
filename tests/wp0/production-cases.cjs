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
  await assert.rejects(s.goals.addMilestone({ goalId: 'missing-parent', title: 'Orphan', completed: false }), /does not exist/);
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
  { id: 'SPRINT1-IMPORT-RACE', category: 'Actual App import handler and DB live replacement guard', known: false,
    async run() { await usingFixture(async f => {
      f.sessionManager.unlock();
      const importer = f.load('src/services/backupImportService.ts');
      const codec = f.load('src/services/backupCryptoService.ts');
      let before, replacement, rejected;
      const backup = { ...f.StorageService.backup,
        async hasData() {
          h.equal(await f.StorageService.backup.hasData(), false, 'UI initially sees empty database');
          await f.StorageService.categories.getAll();
          await f.StorageService.transactions.add({ type: 'expense', amount: 1, category: 'Food',
            description: 'Concurrent synthetic write', date: '2026-11-06', paymentMethod: 'Cash' });
          before = await snapshot(f); return false;
        },
        async importData(text, options) {
          replacement = options.replaceExisting;
          try { return await f.StorageService.backup.importData(text, options); }
          catch (error) { rejected = error; throw error; }
        }
      };
      const expression = h.appFunction('importBackupFile');
      await h.bind(expression, { ...f.appDeps(), ...h.noopSetters(expression),
        StorageService: { backup }, backupOperation: { current: false },
        decodeBackupForRestore: importer.decodeBackupForRestore,
        MAX_BACKUP_FILE_BYTES: codec.MAX_BACKUP_FILE_BYTES,
        requestBackupPassphrase: async () => { throw new Error('Legacy import must not request a passphrase'); },
      })({ size: 300, text: async () => JSON.stringify({ tables: Object.fromEntries(h.TABLES.map(t => [t, []])) }) });
      h.equal(replacement, false, 'Empty observation never grants unconfirmed replacement consent');
      h.check(/Confirm replacement/.test(rejected?.message || ''), 'Actual live guard refused replacement');
      h.equal(await snapshot(f), before, 'Concurrent write survives actual UI import attempt');
    }); }
  },
  { id: 'SPRINT1-RECOVERY', category: 'Production recovery/wrapper/DB; native proof AES-GCM SIMULATION', known: false,
    async run() { await usingFixture(async f => {
      await seed(f); await f.activate();
      const before = await snapshot(f);
      const { createRecoveryController } = f.load('src/services/recoveryService.ts');
      const controller = createRecoveryController(f.load('src/services/cryptoService.ts').CryptoService,
        f.sessionManager, f.getRecoveryChallenge);
      const kit = code => JSON.stringify({ product: 'LifeOS', format: 'lifeos-recovery-kit', version: 1,
        recoveryCode: code, envelope: { version: 1, kdf: 'PBKDF2-HMAC-SHA-256', iterations: 600000,
          salt: Buffer.alloc(16).toString('base64'), iv: Buffer.alloc(12).toString('base64'), wrappedKey: Buffer.alloc(48).toString('base64') } });
      const rebinds = () => f.native.calls.filter(c => c === 'rebind').length;
      await assert.rejects(controller.recover(kit('B'.repeat(43))));
      h.equal(rebinds(), 0, 'Wrong simulated key fails actual AAD/GCM proof before rebind');
      h.equal(await snapshot(f), before, 'Wrong kit leaves ciphertext unchanged');
      await controller.recover(kit('A'.repeat(43)));
      h.equal(rebinds(), 1, 'Matching simulated key completed proof before rebind');
      h.equal(f.sessionManager.isUnlocked(), false, 'Recovery never opens JS admission');
      h.equal((await f.native.isUnlocked()).unlocked, false, 'Recovery ends with native key locked');
      h.equal(await snapshot(f), before, 'Successful recovery does not replace database records');
    }); }
  },
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
  { id: 'LOS-002', category: 'Production integration; real validator/facade/coordinator/Dexie; simulated native', known: false,
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
  { id: 'LOS-003', category: 'Mocked native lifecycle simulation + actual App callback / encrypted DB', known: false,
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
  { id: 'SPRINT1-RESTORE', category: 'Production integration; real import rollback/consent/relationships', known: false,
    async run() { await usingFixture(async f => {
      await seed(f); await f.activate();
      const json = await f.StorageService.backup.exportData();
      const before = await snapshot(f);
      await assert.rejects(f.StorageService.backup.importData(json), /Existing data/);
      h.equal(await snapshot(f), before, 'Replacement consent is mandatory and nondestructive');
      const bad = JSON.parse(json); bad.tables.goals = [];
      await assert.rejects(f.StorageService.backup.importData(JSON.stringify(bad), { replaceExisting: true }), /reference/);
      h.equal(await snapshot(f), before, 'Orphaned backup relationships rejected unchanged');
      const fail = () => { throw new Error('SPRINT1_INJECTED_COMMIT_FAILURE'); };
      f.lifeOSDatabase.tasks.hook('creating', fail);
      try {
        await assert.rejects(f.StorageService.backup.importData(json, { replaceExisting: true }), /SPRINT1_INJECTED_COMMIT_FAILURE/);
      } finally { f.lifeOSDatabase.tasks.hook('creating').unsubscribe(fail); }
      h.equal(await snapshot(f), before, 'Actual restore rolled back earlier table writes after later table failure');
      await f.StorageService.backup.importData(JSON.stringify({ data: JSON.parse(json).tables }), { replaceExisting: true });
      h.equal(JSON.parse(await f.StorageService.backup.exportData()).tables, JSON.parse(json).tables,
        'Legacy data alias restored through actual encrypted backend');
      const writes = f.encryptedStorageRuntime.transactionCoordinator.run(async tx => {
        const row = (await tx.getAll('transactions'))[0]; tx.put('transactions', { ...row, amount: 42 });
      });
      const exported = f.StorageService.backup.exportData();
      await writes;
      h.equal(JSON.parse(await exported).tables.transactions.find(t => t.amount === 42)?.amount, 42,
        'Export queued behind admitted write observes committed transaction');
    }); }
  },
  { id: 'LOS-023', category: 'Production integration: WebCrypto, legacy conversion, actual restore', known: false,
    async run() { await usingFixture(async f => {
      const original = await seed(f);
      const crypto = f.load('src/services/backupCryptoService.ts');
      const importer = f.load('src/services/backupImportService.ts');
      const passphrase = 'synthetic-WP2-backup-passphrase';
      let confirmations = 0;
      const options = { requestPassphrase: async () => passphrase,
        confirmLegacy: () => { confirmations++; return true; }, validateTables: f.validateBackupTables };
      const modern = await crypto.encryptBackup(original, passphrase);
      h.equal(await importer.decodeBackupForRestore(modern, options), original, 'Actual encrypted backup codec roundtrip');
      h.equal(confirmations, 0, 'Encrypted format never uses plaintext fallback');
      h.equal(await importer.decodeBackupForRestore(original, { ...options, confirmLegacy: () => false }), null,
        'Legacy conversion requires explicit consent');
      const converted = await importer.decodeBackupForRestore(original, options);
      h.equal(confirmations, 1, 'User explicitly accepted legacy unencrypted file');
      await f.activate();
      await f.StorageService.backup.importData(converted, { replaceExisting: true });
      h.equal(JSON.parse(await f.StorageService.backup.exportData()).tables, JSON.parse(original).tables,
        'Old-main plaintext export restores into actual encrypted runtime');
      h.check((await f.lifeOSDatabase.transactions.toArray()).every(r => r.__lifeosEncrypted === 1 && r.description === undefined),
        'Legacy import never downgrades at-rest backend');
      const snapshotBefore = await snapshot(f);
      await assert.rejects(importer.decodeBackupForRestore(modern, { ...options, requestPassphrase: async () => 'wrong' }), /failed|incorrect|corrupt/i);
      const corrupt = JSON.parse(modern); corrupt.ciphertext = (corrupt.ciphertext[0] === 'A' ? 'B' : 'A') + corrupt.ciphertext.slice(1);
      await assert.rejects(importer.decodeBackupForRestore(JSON.stringify(corrupt), options), /failed|incorrect|corrupt/i);
      h.equal(confirmations, 1, 'Wrong/corrupt encrypted files never fall back to legacy');
      h.equal(await snapshot(f), snapshotBefore, 'Failed decryption made no database changes');
    }); }
  },
  { id: 'LOS-007', category: 'Production integration: raw/encrypted goal API parity; simulated native', known: false,
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
  { id: 'LOS-008', category: 'Production integration: raw/encrypted recurrence parity; fixed local clock; simulated native', known: false,
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
