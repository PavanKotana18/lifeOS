'use strict';
const assert = require('node:assert/strict');
const h = require('./tests/wp0/production-harness.cjs');

(async () => {
  const f = await h.fixture();
  let passed = 0;
  const check = (condition, message) => {
    assert.ok(condition, message);
    passed++;
    console.log('PASS:', message);
  };
  try {
    // fixture.activate uses a process-local synthetic key and actual production
    // Dexie/encrypted-storage code. It is not Android Keystore evidence.
    await f.activate();
    const category = await f.StorageService.categories.add({
      name: 'Encrypted atomicity test', type: 'expense', color: '#123456'
    });
    const goal = await f.StorageService.savings.addGoal({
      title: 'Encrypted atomicity goal', targetAmount: 1000, currentAmount: 100,
      targetDate: '2027-01-01'
    });
    const rawGoal = await f.lifeOSDatabase.savingsGoals.get(goal.id);
    check(rawGoal.__lifeosEncrypted === 1 && rawGoal.title === undefined && rawGoal.currentAmount === undefined,
      'Provisioned private records are ciphertext-only in IndexedDB');

    // Lock both layers, then verify a protected read is rejected before any
    // encryption/decryption or key setup operation occurs.
    await f.native.lock();
    f.sessionManager.lock();
    const stateBefore = await f.native.getKeyState();
    const eventStart = f.native.calls.length;
    await assert.rejects(
      f.StorageService.categories.getAll(),
      error => error && error.code === 'LIFEOS_SESSION_LOCKED'
    );
    const events = f.native.calls.slice(eventStart);
    const stateAfter = await f.native.getKeyState();
    check(!f.sessionManager.isUnlocked() && !stateAfter.unlocked,
      'Private access is denied while the authenticated session and native key are locked');
    check(!events.some(event => ['setup', 'encrypt', 'decrypt', 'rebind'].includes(event)) &&
      stateBefore.keyProvisioned === stateAfter.keyProvisioned &&
      stateBefore.recoveryProvisioned === stateAfter.recoveryProvisioned &&
      stateBefore.keystoreAliasPresent === stateAfter.keystoreAliasPresent,
      'Rejected locked access does not invoke crypto, provision a key, or change key metadata');

    // Resume through the production session controller, which authenticates the
    // pre-existing synthetic key before reopening the already-active facade.
    const controller = f.appDeps().encryptedSession;
    await controller.open();
    check(f.native.calls.includes('unlock') && f.sessionManager.isUnlocked(),
      'Private session reopens only after the native authentication path succeeds');
    check((await f.StorageService.categories.getAll()).some(row => row.id === category.id),
      'Authenticated session can read provisioned encrypted records');

    const goalBefore = await f.StorageService.savings.getGoals();
    const contributionsBefore = await f.StorageService.savings.getContributions(goal.id);
    const transactionsBefore = await f.StorageService.transactions.getAll();
    const failEncryptedCommit = () => { throw new Error('Injected encrypted transaction failure'); };
    f.lifeOSDatabase.transactions.hook('creating').subscribe(failEncryptedCommit);
    try {
      await assert.rejects(
        f.StorageService.savings.addContribution(
          { goalId: goal.id, amount: 50, date: '2026-11-08' },
          { type: 'expense', amount: 50, category: category.name,
            description: 'Encrypted atomic rollback fixture', date: '2026-11-08',
            paymentMethod: 'Cash' }
        ),
        /Injected encrypted transaction failure/
      );
    } finally {
      f.lifeOSDatabase.transactions.hook('creating').unsubscribe(failEncryptedCommit);
    }
    assert.deepEqual(await f.StorageService.savings.getGoals(), goalBefore);
    assert.deepEqual(await f.StorageService.savings.getContributions(goal.id), contributionsBefore);
    assert.deepEqual(await f.StorageService.transactions.getAll(), transactionsBefore);
    const goalAfterFailure = await f.lifeOSDatabase.savingsGoals.get(goal.id);
    check(goalAfterFailure.__lifeosEncrypted === 1 && goalAfterFailure.currentAmount === undefined &&
      (await f.StorageService.savings.getGoals()).find(row => row.id === goal.id)?.currentAmount === 100,
      'Injected encrypted multi-table failure rolls back without plaintext fallback or partial goal update');
    check((await f.StorageService.savings.getContributions(goal.id)).length === 0 &&
      !(await f.StorageService.transactions.getAll()).some(row => row.description === 'Encrypted atomic rollback fixture'),
      'Encrypted contribution and linked transaction both remain absent after rollback');

    await Promise.all([
      f.StorageService.savings.addContribution({ goalId: goal.id, amount: 40, date: '2026-11-08' }),
      f.StorageService.savings.addContribution({ goalId: goal.id, amount: 60, date: '2026-11-08' })
    ]);
    const finalGoal = (await f.StorageService.savings.getGoals()).find(row => row.id === goal.id);
    check(finalGoal.currentAmount === 200 &&
      (await f.StorageService.savings.getContributions(goal.id)).length === 2,
      'Concurrent encrypted contributions serialize without losing either update');

    console.log(`ENCRYPTED SESSION ATOMICITY: ${passed}/8 passed; synthetic native adapter, production facade/Dexie exercised.`);
  } finally {
    await f.dispose();
  }
})().catch(error => {
  console.error('ENCRYPTED SESSION ATOMICITY FAILED:', error);
  process.exitCode = 1;
});
