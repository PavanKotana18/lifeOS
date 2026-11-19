'use strict';
const assert = require('node:assert/strict');
const h = require('./tests/wp0/production-harness.cjs');

(async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const queues = new Map();
  const locks = { request(name, options, callback) {
    const operation = typeof options === 'function' ? options : callback;
    const previous = queues.get(name) || Promise.resolve();
    const current = previous.then(() => operation({ name, mode: 'exclusive' }));
    queues.set(name, current.catch(() => undefined));
    return current;
  } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  const f = await h.fixture();
  let restarted;
  let passed = 0;
  const check = (condition, label) => { assert.ok(condition, label); passed++; console.log('PASS:', label); };
  try {
    await f.activate();
    const expense = await f.StorageService.categories.add({ name: 'Synthetic recurring expense', type: 'expense', color: '#345678' });
    const income = await f.StorageService.categories.add({ name: 'Synthetic recurring income', type: 'income', color: '#345678' });
    const account = await f.StorageService.accounts.add({ name: 'Synthetic wallet', type: 'cash', currencyCode: 'USD', openingBalanceMinor: '0', isActive: true });
    const input = (changes = {}) => ({ title: 'Synthetic recurring plan', type: 'expense', amount: 12.34, amountMinor: '1234', currencyCode: 'USD', frequency: 'monthly', nextDueDate: '2020-01-31', categoryId: expense.id, status: 'active', ...changes });
    const planById = async id => (await f.StorageService.commitments.getAll()).find(row => row.id === id);
    const rawState = async () => Object.fromEntries(await Promise.all(h.TABLES.map(async table =>
      [table, await f.lifeOSDatabase.table(table).toArray()])));
    const refuseWithoutMutation = async (plan, expected, message) => {
      const before = await rawState();
      await assert.rejects(f.StorageService.commitments.postOccurrence(plan.id, expected), message);
      assert.deepEqual(await rawState(), before, 'A refused occurrence must leave both ciphertext tables unchanged');
      passed++;
    };

    const monthly = await f.StorageService.commitments.add(input({ notes: 'Synthetic private note' }));
    check((await f.StorageService.transactions.getAll()).length === 0, 'A new plan is not posted financial activity');
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => f.StorageService.commitments.postOccurrence(monthly.id, monthly)));
    check(new Set(concurrent.map(row => row.id)).size === 1, 'Concurrent confirmations return one durable occurrence identity');
    check((await f.StorageService.transactions.getAll()).length === 1, 'Concurrent confirmation posts exactly one transaction');
    const posted = concurrent[0];
    assert.equal(posted.type, 'expense'); assert.equal(posted.category, expense.name);
    assert.equal(posted.amountMinor, '1234'); assert.equal(posted.currencyCode, 'USD');
    assert.equal(posted.accountId, undefined); assert.equal(posted.date, '2020-01-31');
    assert.equal(posted.commitmentId, monthly.id); assert.equal(posted.commitmentOccurrenceDate, '2020-01-31');
    assert.equal(posted.occurredAt, undefined, 'Calendar-only planned activity does not invent a transaction time');
    assert.equal(posted.notes, 'Synthetic private note');
    const afterJanuary = await planById(monthly.id);
    assert.equal(afterJanuary.nextDueDate, '2020-02-29');
    assert.equal(afterJanuary.recurrenceAnchorDate, '2020-01-31');
    assert.equal(afterJanuary.lastPostedDate, '2020-01-31');
    check((await f.StorageService.commitments.postOccurrence(monthly.id, monthly)).id === posted.id, 'Retrying a recorded confirmation returns the original transaction');
    await f.StorageService.commitments.postOccurrence(monthly.id, afterJanuary);
    check((await planById(monthly.id)).nextDueDate === '2020-03-31', 'Clamped February occurrence retains the January 31 recurrence anchor');
    const rawPosted = await f.lifeOSDatabase.transactions.get(posted.id);
    const rawPlan = await f.lifeOSDatabase.plannedCommitments.get(monthly.id);
    check(rawPosted.__lifeosEncrypted === 1 && rawPlan.__lifeosEncrypted === 1 && rawPosted.amount === undefined && rawPosted.commitmentId === undefined && rawPlan.title === undefined && rawPlan.lastPostedDate === undefined,
      'Both occurrence transaction and recurrence history are ciphertext-only at rest');

    const salary = await f.StorageService.commitments.add(input({ title: 'Synthetic salary', type: 'income', categoryId: income.id, amount: 25.6, amountMinor: '2560', accountId: account.id, frequency: 'weekly', nextDueDate: '2020-02-01' }));
    const salaryPosted = await f.StorageService.commitments.postOccurrence(salary.id, salary);
    check(salaryPosted.type === 'income' && salaryPosted.category === income.name && salaryPosted.accountId === account.id && salaryPosted.amountMinor === '2560', 'Income occurrences preserve matching category, exact amount and optional account');
    assert.equal((await planById(salary.id)).nextDueDate, '2020-02-08');

    globalThis.navigator.locks = undefined;
    try {
      const withoutLocks = await f.StorageService.commitments.add(input({ title: 'Synthetic unsupported locking' }));
      await refuseWithoutMutation(withoutLocks, withoutLocks, /Web Locks|cross.tab|cross-context|unavailable|not support/i);
    } finally { globalThis.navigator.locks = locks; }

    const paused = await f.StorageService.commitments.add(input({ status: 'paused' }));
    await refuseWithoutMutation(paused, paused, /Resume/);
    const future = await f.StorageService.commitments.add(input({ nextDueDate: '9998-01-01' }));
    await refuseWithoutMutation(future, future, /not due/);
    const noCategory = await f.StorageService.commitments.add(input({ categoryId: undefined }));
    await refuseWithoutMutation(noCategory, noCategory, /Choose a category/);
    const temporaryCategory = await f.StorageService.categories.add({ name: 'Synthetic removed category', type: 'expense', color: '#345678' });
    const missingCategory = await f.StorageService.commitments.add(input({ categoryId: temporaryCategory.id }));
    await f.lifeOSDatabase.categories.delete(temporaryCategory.id); // Synthetic corrupted-reference fixture only.
    await refuseWithoutMutation(missingCategory, missingCategory, /available category/);
    const inactive = await f.StorageService.commitments.add(input({ accountId: account.id }));
    await f.StorageService.accounts.archive(account.id);
    await refuseWithoutMutation(inactive, inactive, /active account/);
    const edited = await f.StorageService.commitments.add(input());
    await f.StorageService.commitments.update(edited.id, { title: 'Synthetic amended title' });
    await refuseWithoutMutation(edited, edited, /changed/);
    await refuseWithoutMutation(edited, { ...edited, id: 'incorrect-confirmation-id' }, /Review the current/);
    await refuseWithoutMutation({ id: 'nonexistent-plan' }, { id: 'nonexistent-plan' }, /no longer exists/);

    const rollback = await f.StorageService.commitments.add(input({ title: 'Synthetic rollback plan' }));
    const beforeFailure = await rawState();
    let hookReached = false;
    const failPlanUpdate = (_changes, key) => { if (key === rollback.id) { hookReached = true; throw new Error('Injected encrypted recurrence update failure'); } };
    f.lifeOSDatabase.plannedCommitments.hook('updating').subscribe(failPlanUpdate);
    try {
      await assert.rejects(f.StorageService.commitments.postOccurrence(rollback.id, rollback), /Injected encrypted recurrence update failure/);
    } finally {
      f.lifeOSDatabase.plannedCommitments.hook('updating').unsubscribe(failPlanUpdate);
    }
    check(hookReached, 'Rollback fault injection reaches the actual encrypted plan update');
    assert.deepEqual(await rawState(), beforeFailure, 'Transaction insertion and plan advance roll back together');
    await f.StorageService.commitments.postOccurrence(rollback.id, rollback);
    check((await f.StorageService.transactions.getAll()).filter(row => row.commitmentId === rollback.id).length === 1, 'A failed atomic post remains safely retryable');

    // Retiring/deleting a transaction must not make the already-confirmed
    // occurrence eligible for another write.
    await f.StorageService.transactions.delete(posted.id);
    await refuseWithoutMutation(monthly, monthly, /already recorded/);
    // Remove the intentionally corrupted plan before checking a valid backup.
    await f.StorageService.commitments.delete(missingCategory.id);
    const once = await f.StorageService.commitments.add(input({ title: 'One-time repair', frequency: 'once' }));
    const oneTimePosts = await Promise.all(Array.from({ length: 3 }, () => f.StorageService.commitments.postOccurrence(once.id, once)));
    const onceAfter = await planById(once.id);
    check(new Set(oneTimePosts.map(row => row.id)).size === 1 && !oneTimePosts[0].isRecurring, 'One-time confirmation records exactly one non-recurring transaction');
    check(onceAfter.status === 'recorded' && onceAfter.nextDueDate === once.nextDueDate, 'A recorded one-time plan never advances into another occurrence');
    const backup = await f.StorageService.backup.exportData();
    const backupRows = JSON.parse(backup).tables;
    check(backupRows.plannedCommitments.some(row => row.lastPostedDate) && backupRows.transactions.some(row => row.commitmentOccurrenceDate), 'Backup export includes durable plan and occurrence history');
    const rejectMalformedBackup = async (label, mutate) => {
      const malformed = JSON.parse(backup);
      mutate(malformed.tables);
      const before = await rawState();
      await assert.rejects(f.StorageService.backup.importData(JSON.stringify(malformed), { replaceExisting: true }), /Invalid backup/);
      assert.deepEqual(await rawState(), before, 'Invalid replacement backup must not mutate any encrypted table');
      check(true, label);
    };
    const salaryTransaction = tables => tables.transactions.find(row => row.id === salaryPosted.id);
    const salaryPlan = tables => tables.plannedCommitments.find(row => row.id === salary.id);
    await rejectMalformedBackup('A transaction provenance ID without its occurrence date is rejected atomically', tables => {
      delete salaryTransaction(tables).commitmentOccurrenceDate;
    });
    await rejectMalformedBackup('A second transaction ID cannot repeat an existing commitment/date tuple', tables => {
      tables.transactions.push({ ...salaryTransaction(tables), id: 'synthetic-duplicate-occurrence-id' });
    });
    await rejectMalformedBackup('Surviving plans must retain last-posted history for linked transactions', tables => {
      delete salaryPlan(tables).lastPostedDate;
    });
    await rejectMalformedBackup('Backup last-posted history cannot precede its latest linked transaction', tables => {
      salaryPlan(tables).lastPostedDate = '2020-01-31';
    });
    await rejectMalformedBackup('Backup next due date must follow all recorded occurrence history', tables => {
      salaryPlan(tables).nextDueDate = salaryPlan(tables).lastPostedDate;
    });
    await rejectMalformedBackup('Backup plan type must match its selected category type', tables => {
      salaryPlan(tables).categoryId = expense.id;
    });
    await rejectMalformedBackup('Recorded history cannot discard its recurrence anchor in a replacement backup', tables => {
      delete salaryPlan(tables).recurrenceAnchorDate;
    });
    await f.StorageService.backup.importData(backup, { replaceExisting: true });
    check((await planById(once.id)).status === 'recorded' &&
      (await f.StorageService.commitments.postOccurrence(once.id, once)).id === oneTimePosts[0].id,
      'Backup restores one-time recording status and durable retry identity');
    check((await f.StorageService.commitments.postOccurrence(salary.id, salary)).id === salaryPosted.id, 'Backup round-trip retains idempotent confirmation identity');

    f.sessionManager.lock(); await f.sessionManager.waitForIdle();
    const beforeLocked = await rawState();
    await assert.rejects(f.StorageService.commitments.postOccurrence(salary.id, salary), error => error?.code === 'LIFEOS_SESSION_LOCKED');
    assert.deepEqual(await rawState(), beforeLocked);
    check(true, 'Locked sessions cannot post or even retrieve an idempotent occurrence');
    await f.activate();
    restarted = await f.restart();
    await f.native.unlock();
    restarted.sessionManager.unlock(); await restarted.activateEncryptedStorage();
    check((await restarted.StorageService.commitments.postOccurrence(salary.id, salary)).id === salaryPosted.id, 'Actual encrypted runtime restart retains durable idempotency');
    const restartedPlan = (await restarted.StorageService.commitments.getAll()).find(row => row.id === salary.id);
    assert.equal(restartedPlan.nextDueDate, '2020-02-08');
    assert.equal(restartedPlan.lastPostedDate, '2020-02-01');

    // These storage facades came from different production module loaders and
    // therefore have independent module-local transaction queues. Shared Web
    // Locks, rather than one facade's in-memory queue, must serialize them.
    f.sessionManager.unlock();
    await f.lifeOSDatabase.open();
    const crossRealm = await restarted.StorageService.commitments.add(input({ title: 'Synthetic cross-context occurrence' }));
    const crossPosts = await Promise.all([
      f.StorageService.commitments.postOccurrence(crossRealm.id, crossRealm),
      restarted.StorageService.commitments.postOccurrence(crossRealm.id, crossRealm),
    ]);
    check(crossPosts[0].id === crossPosts[1].id && (await restarted.StorageService.transactions.getAll()).filter(row => row.commitmentId === crossRealm.id).length === 1,
      'Independent encrypted storage runtimes post one occurrence through the shared lock');
    const changing = await restarted.StorageService.commitments.add(input({ title: 'Synthetic plan before concurrent edit' }));
    const transactionsBeforeRace = await restarted.StorageService.transactions.getAll();
    const edit = f.StorageService.commitments.update(changing.id, { title: 'Synthetic updated plan' });
    const post = restarted.StorageService.commitments.postOccurrence(changing.id, changing);
    await edit;
    await assert.rejects(post, /changed/);
    assert.deepEqual(await restarted.StorageService.transactions.getAll(), transactionsBeforeRace);
    check(true, 'A cross-context plan edit invalidates the stale confirmation before any posting');

    const deleting = await restarted.StorageService.commitments.add(input({ title: 'Synthetic deleted before confirmation' }));
    const transactionsBeforeDelete = await restarted.StorageService.transactions.getAll();
    const deletion = f.StorageService.commitments.delete(deleting.id);
    const deletedPost = assert.rejects(restarted.StorageService.commitments.postOccurrence(deleting.id, deleting), /no longer exists/);
    await Promise.all([deletion, deletedPost]);
    assert.deepEqual(await restarted.StorageService.transactions.getAll(), transactionsBeforeDelete);
    check(!(await restarted.StorageService.commitments.getAll()).some(row => row.id === deleting.id), 'Cross-context plan deletion cannot race a stale post into an orphan transaction');

    const clearing = await restarted.StorageService.commitments.add(input({ title: 'Synthetic cleared before confirmation' }));
    const reset = f.StorageService.backup.clearAll();
    const clearedPost = assert.rejects(restarted.StorageService.commitments.postOccurrence(clearing.id, clearing), /no longer exists/);
    await Promise.all([reset, clearedPost]);
    check((await restarted.StorageService.transactions.getAll()).length === 0 && (await restarted.StorageService.commitments.getAll()).length === 0,
      'Cross-context backup reset prevents stale confirmations from resurrecting cleared financial data');
    console.log(`COMMITMENT OCCURRENCES: ${passed} checks passed with synthetic production encrypted-storage fixtures; native interfaces simulated.`);
  } finally {
    if (restarted) { restarted.sessionManager.lock(); await restarted.sessionManager.waitForIdle(); restarted.lifeOSDatabase.close(); }
    await f.dispose();
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
