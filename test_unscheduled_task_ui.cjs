'use strict';
const assert = require('node:assert/strict');
const h = require('./tests/wp0/production-harness.cjs');
const event = { preventDefault() {} };

(async () => {
  const f = await h.fixture();
  try {
    const quick = h.appFunction('addUnscheduledTask');
    const operation = { current: false }, messages = [];
    let writes = 0, refreshes = 0;
    const add = h.bind(quick, {
      quickTaskOperation: operation,
      ensurePrivateStorageBeforeWrite: async () => {},
      StorageService: { tasks: { add: async row => { writes++; return f.StorageService.tasks.add(row); } } },
      reloadAllData: async () => { refreshes++; throw Error('Synthetic refresh failure'); },
      showToast: (message, type) => messages.push({ message, type }),
    });
    await assert.rejects(add('   '), /title/);
    await assert.rejects(add('x'.repeat(201)), /title/);
    assert.equal(writes, 0);
    await assert.doesNotReject(add('  Synthetic unscheduled UI task  '), 'A committed save resolves even if refresh fails, so quick entry clears its draft rather than offering a duplicate retry');
    assert.equal(writes, 1); assert.equal(refreshes, 1); assert.equal(operation.current, false);
    const rows = await f.StorageService.tasks.getAll();
    assert.equal(rows.length, 1); assert.equal(rows[0].title, 'Synthetic unscheduled UI task');
    assert.equal(rows[0].dueDate, undefined); assert.equal(rows[0].reminderAt, undefined);
    const raw = await f.lifeOSDatabase.tasks.get(rows[0].id);
    assert.equal(raw.__lifeosEncrypted, 1); assert.equal(raw.title, undefined);
    assert.match(messages[0].message, /Task saved/); assert.equal(messages[0].type, 'info');
    operation.current = true;
    await assert.rejects(add('Synthetic blocked double submit'), /already being saved/);
    assert.equal(writes, 1); operation.current = false;
    const cancelled = h.bind(quick, {
      quickTaskOperation: operation,
      ensurePrivateStorageBeforeWrite: async () => { throw Error('Security setup cancelled'); },
      StorageService: { tasks: { add: async () => { throw Error('Unexpected write'); } } },
    });
    await assert.rejects(cancelled('Synthetic cancelled task'), /Security setup cancelled/);
    assert.equal(operation.current, false);

    const save = h.appFunction('saveNewRecord');
    function saveHarness(draft, overrides = {}) {
      const state = { setup: 0, permission: 0, writes: [], messages: [], closed: [], operation: { current: false } };
      const handler = h.bind(save, {
        ...h.noopSetters(save), createKind: 'task', createOperation: state.operation,
        createDraft: { title: 'Synthetic form task', priority: 'Medium', recurring: 'None', ...draft },
        editingTaskId: null, editingHabitId: null, editingTransactionId: null, editingGoalId: null, editingContributionId: null,
        ensurePrivateStorageBeforeWrite: async () => { state.setup++; },
        StorageService: { tasks: { add: async row => { state.writes.push(row); return f.StorageService.tasks.add(row); } } },
        notificationsEnabled: false, notificationPreferences: { taskReminders: false },
        askNotificationPermission: async () => { state.permission++; throw Error('Unexpected notification prompt'); },
        reloadAllData: async () => ({ tasks: [], habits: [], goals: [], milestones: [] }),
        effectiveNotificationPreferences: preferences => preferences, syncNotificationSchedules: async () => true,
        setCreateKind: kind => state.closed.push(kind), showToast: message => state.messages.push(message), ...overrides,
      });
      return Object.assign(state, { handler });
    }
    for (const schedule of [{ time: '10:30' }, { reminderAt: '2026-11-19T10:00' }, { recurring: 'Daily' }]) {
      const invalid = saveHarness({ date: '', ...schedule });
      await invalid.handler(event);
      assert.equal(invalid.setup, 0, 'Invalid undated scheduling is rejected before security setup');
      assert.equal(invalid.permission, 0); assert.equal(invalid.writes.length, 0);
      assert.match(invalid.messages[0], /Add a due date/);
      assert.equal(invalid.operation.current, false); assert.deepEqual(invalid.closed, []);
    }
    for (const date of ['', '2026-11-19']) {
      const valid = saveHarness({ date });
      await valid.handler(event);
      assert.equal(valid.writes.length, 1); assert.equal(valid.writes[0].dueDate, date || undefined);
      assert.equal(valid.setup, 1); assert.equal(valid.permission, 0); assert.deepEqual(valid.closed, [null]);
      assert.equal(valid.operation.current, false); assert.equal(valid.messages[0], 'Task added');
    }
    const committed = saveHarness({}, { reloadAllData: async () => { throw Error('Synthetic refresh failure'); } });
    await committed.handler(event);
    assert.equal(committed.writes.length, 1); assert.deepEqual(committed.closed, [null]);
    assert.match(committed.messages[0], /Saved.*do not submit this item again/);

    const open = h.appFunction('openCreateForm');
    let draft;
    const openForm = h.bind(open, {
      ...h.noopSetters(open), setCreateDraft: value => { draft = value; },
      categories: [], financeMonth: '2026-11', userPrefs: { currency: 'INR' },
      formatLocalDate: () => '2026-11-17', formatLocalDateTime: () => '2026-11-17T12:00',
    });
    openForm('task'); assert.equal(draft.date, ''); assert.equal(draft.time, ''); assert.equal(draft.reminderAt, ''); assert.equal(draft.recurring, 'None');
    openForm('task', undefined, '2026-12-01'); assert.equal(draft.date, '2026-12-01');
    openForm('habit'); assert.equal(draft.date, '2026-11-17', 'Other forms retain their existing date default');
    console.log('UNSCHEDULED TASK UI: actual App quick-add, encrypted persistence, validation before prompts, explicit date defaults and committed refresh failure passed. Node handler tests only; native/mounted acceptance not claimed.');
  } finally { await f.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
