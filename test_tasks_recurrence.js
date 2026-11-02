require('fake-indexeddb/auto');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const assert = require('assert');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, 'src/db.ts'), 'utf8') + '\n\n// Test-only access to the raw Dexie instance.\nexport { db };\n';
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const loaded = new Module(path.join(__dirname, 'src/db.recurrence.cjs'), module);
  loaded.filename = path.join(__dirname, 'src/db.recurrence.cjs');
  loaded.paths = module.paths;
  const sessionSource = fs.readFileSync(
    path.join(__dirname, 'src/services/sessionManager.ts'),
    'utf8'
  );

  const sessionCompiled = ts.transpileModule(sessionSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const sessionLoaded = new Module(
    path.join(__dirname, 'src/services/sessionManager.cjs'),
    module
  );
  sessionLoaded.filename = path.join(__dirname, 'src/services/sessionManager.cjs');
  sessionLoaded.paths = module.paths;
  sessionLoaded._compile(sessionCompiled, sessionLoaded.filename);

  const originalModuleLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (
      request === './services/sessionManager' &&
      parent &&
      parent.filename === loaded.filename
    ) {
      return sessionLoaded.exports;
    }
    return originalModuleLoad.apply(this, arguments);
  };

  try {
    loaded._compile(compiled, loaded.filename);
  } finally {
    Module._load = originalModuleLoad;
  }

  const { db, StorageService, sessionManager } = loaded.exports;
  sessionManager.unlock();
  await db.open();
  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };
  const add = (id, dueDate, recurring) => db.tasks.add({
    id, title: id, dueDate, priority: 'Medium',
    recurring, completed: false, createdAt: '2026-11-01T00:00:00.000Z'
  });

  try {
    await add('daily', '2026-11-01', 'Daily');
    await StorageService.tasks.toggleCompleted('daily', true);
    check(
      (await db.tasks.get('rec_daily_2026-11-02'))?.dueDate === '2026-11-02',
      'Daily recurrence creates the next day occurrence'
    );

    await add('parallel', '2026-11-03', 'Daily');
    await Promise.all([
      StorageService.tasks.toggleCompleted('parallel', true),
      StorageService.tasks.toggleCompleted('parallel', true),
      StorageService.tasks.toggleCompleted('parallel', true)
    ]);
    check(
      await db.tasks.where('id').equals('rec_parallel_2026-11-04').count() === 1,
      'Concurrent completion creates exactly one occurrence'
    );

    await StorageService.tasks.toggleCompleted('parallel', false);
    await StorageService.tasks.toggleCompleted('parallel', true);
    check(
      await db.tasks.where('id').equals('rec_parallel_2026-11-04').count() === 1,
      'Uncomplete and re-complete does not duplicate the occurrence'
    );

    await add('month-end', '2027-01-31', 'Monthly');
    await StorageService.tasks.toggleCompleted('month-end', true);
    check(
      (await db.tasks.get('rec_month-end_2027-02-28'))?.dueDate === '2027-02-28',
      'Monthly recurrence clamps January 31 to February 28'
    );

    await add('weekly', '2026-11-01', 'Weekly');
    await StorageService.tasks.toggleCompleted('weekly', true);
    check(
      Boolean(await db.tasks.get('rec_weekly_2026-11-08')),
      'Weekly recurrence advances seven calendar days'
    );

    await add('failure', '2026-11-10', 'Daily');
    const failCreate = (_key, obj) => {
      if (obj?.id === 'rec_failure_2026-11-11') throw new Error('Injected insert failure');
    };
    db.tasks.hook('creating').subscribe(failCreate);
    try {
      await assert.rejects(StorageService.tasks.toggleCompleted('failure', true));
    } finally {
      db.tasks.hook('creating').unsubscribe(failCreate);
    }
    check(
      (await db.tasks.get('failure')).completed === false &&
      !(await db.tasks.get('rec_failure_2026-11-11')),
      'Failed occurrence creation rolls back original completion'
    );

    await add('once', '2026-11-12', 'None');
    const count = await db.tasks.count();
    await StorageService.tasks.toggleCompleted('once', true);
    check(
      (await db.tasks.get('once')).completed &&
      await db.tasks.count() === count,
      'Non-recurring task completes without creating another task'
    );

    console.log(`RECURRENCE TESTS: ${passed}/7 PASSED`);
  } finally {
    await db.delete();
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
