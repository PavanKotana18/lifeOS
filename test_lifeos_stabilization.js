'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const h = require('./tests/wp0/production-harness.cjs');
require('./scripts/register-ts-test-loader.cjs');
const { sortTransactions } = require('./src/services/domainUtils.ts');
const { buildTransactionUpdate } = require('./src/services/userPreferences.ts');
const { resolveInitialSystemDark } = require('./src/services/systemAppearance.ts');
const { reconcileNotificationOnboardingOnResume } = require('./src/services/notificationOnboarding.ts');

let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`PASS: ${name}`);
}
function fixture(run) {
  return h.fixture().then(async f => {
    try { await run(f); } finally { await f.dispose(); }
  });
}
function financeRows(rows, sort = 'date-desc') {
  return h.bind(h.appFunction('filteredTransactions'), {
    useMemo: callback => callback(), sortTransactions,
    transactions: rows, financeMonth: '2026-11',
    financeTypeFilter: 'all', financeCategoryFilter: 'all', financeSearch: '', financeSort: sort,
  });
}

(async () => {
  await test('Finance Newest First uses date and transaction time with deterministic creation tie-break', () => {
    const rows = [
      { id: 'older', type: 'expense', amount: 10, category: 'Food', description: 'Earlier', paymentMethod: 'Cash', date: '2026-11-06', occurredAt: '2026-11-06T11:00:00.000Z', createdAt: '2026-11-06T10:00:00.000Z' },
      { id: 'equal-later-created', type: 'expense', amount: 12, category: 'Food', description: 'Same time', paymentMethod: 'Cash', date: '2026-11-06', occurredAt: '2026-11-06T12:00:00.000Z', createdAt: '2026-11-06T12:02:00.000Z' },
      { id: 'newer', type: 'expense', amount: 11, category: 'Food', description: 'Later', paymentMethod: 'Cash', date: '2026-11-06', occurredAt: '2026-11-06T12:30:00.000Z', createdAt: '2026-11-06T12:30:00.000Z' },
      { id: 'equal-earlier-created', type: 'expense', amount: 13, category: 'Food', description: 'Same time', paymentMethod: 'Cash', date: '2026-11-06', occurredAt: '2026-11-06T12:00:00.000Z', createdAt: '2026-11-06T12:01:00.000Z' },
      { id: 'legacy-date-only', type: 'expense', amount: 9, category: 'Food', description: 'Legacy', paymentMethod: 'Cash', date: '2026-11-06', createdAt: '2026-11-06T09:00:00.000Z' },
      { id: 'previous-day', type: 'expense', amount: 8, category: 'Food', description: 'Prior day', paymentMethod: 'Cash', date: '2026-11-05', occurredAt: '2026-11-05T23:59:00.000Z', createdAt: '2026-11-05T23:59:00.000Z' },
    ];
    assert.deepEqual(financeRows(rows).map(row => row.id), [
      'newer', 'equal-earlier-created', 'equal-later-created', 'older', 'legacy-date-only', 'previous-day',
    ]);
    assert.deepEqual(financeRows(rows, 'date-asc').map(row => row.id), [
      'previous-day', 'older', 'equal-earlier-created', 'equal-later-created', 'newer', 'legacy-date-only',
    ]);
  });

  await test('Finance create, edit, reload and delete preserve entered local date-time without inventing legacy time', () => fixture(async f => {
    await f.activate();
    await f.StorageService.categories.getAll();
    const older = await f.StorageService.transactions.add({
      type: 'expense', amount: 10, category: 'Food', description: 'Older', date: '2026-11-06',
      paymentMethod: 'Cash', occurredAt: '2026-11-06T10:00:00.000Z',
    });
    const legacy = await f.StorageService.transactions.add({
      type: 'expense', amount: 9, category: 'Food', description: 'Legacy', date: '2026-11-06',
      paymentMethod: 'Cash',
    });
    assert.equal(legacy.occurredAt, undefined, 'Date-only record must keep unknown transaction time');
    const editedTime = '2026-11-06T13:45:00.000Z';
    await f.StorageService.transactions.update(older.id, { occurredAt: editedTime, date: '2026-11-06' });
    const reloaded = await f.StorageService.transactions.getById(older.id);
    assert.equal(reloaded.occurredAt, editedTime);
    const legacyEdit = buildTransactionUpdate({
      type: 'expense', amount: 9, category: 'Food', description: 'Legacy edited',
      dateTime: '', date: legacy.date, preserveUnknownTime: true, paymentMethod: 'Cash',
    });
    assert.equal(Object.hasOwn(legacyEdit, 'occurredAt'), false, 'Editing a date-only row must not infer its time from createdAt');
    await f.StorageService.transactions.update(legacy.id, legacyEdit);
    assert.equal((await f.StorageService.transactions.getById(legacy.id)).occurredAt, undefined);
    await f.StorageService.transactions.delete(legacy.id);
    assert.equal(await f.StorageService.transactions.getById(legacy.id), undefined);
  }));

  await test('System theme cold-start resolves Android appearance before rendering and preserves explicit overrides', async () => {
    const source = fs.readFileSync('android/app/src/main/java/com/lifeos/personal/MainActivity.java', 'utf8');
    assert.match(source, /SystemAppearancePlugin/);
    assert.match(fs.readFileSync('src/main.tsx', 'utf8'), /getInitialSystemAppearance|SystemAppearance/);
    assert.equal(await resolveInitialSystemDark(true, async () => ({ dark: false })), false, 'Native light mode overrides stale WebView dark media state');
    assert.equal(await resolveInitialSystemDark(false, async () => ({ dark: true })), true, 'Native dark mode resolves on cold start');
    assert.equal(await resolveInitialSystemDark(false, async () => { throw new Error('plugin unavailable'); }), false, 'Browser/media fallback remains available');
  });

  await test('Returning from Android permission settings restores protected users without replaying onboarding', () => fixture(async f => {
    const biometricAuthenticated = { current: false };
    const callback = h.bind(h.lifecycleCallback(), {
      ...h.noopSetters(h.lifecycleCallback()),
      disposed: false,
      backupPassphraseResolver: { current: null },
      secureSetupResolver: { current: null },
      sessionManager: { lock() {}, unlock() {}, isUnlocked: () => true, async waitForIdle() {} },
      isEncryptedStorageActivated: () => true,
      setIsLocked() {}, setBiometricVerified() {}, setBiometricMessage() {},
      biometricAuthenticated,
      encryptedSession: { async lock() {}, async open() { f.native.calls.push('biometric'); biometricAuthenticated.current = true; } },
      authCoordinator: { resetForBackground() {} },
      startupComplete: { current: true },
      safeFirstRunBrowse: { current: false },
      setClockNow() {},
      async triggerBiometricAuth() { f.native.calls.push('biometric'); biometricAuthenticated.current = true; return true; },
      async reloadAllData() { return { tasks: [], habits: [], goals: [], milestones: [] }; },
      syncNotificationSchedules: async () => {},
      effectiveNotificationPreferences: value => value,
      DEFAULT_NOTIFICATION_PREFERENCES: f.DEFAULT_NOTIFICATION_PREFERENCES,
      async refreshNotificationDiagnostics() { f.native.calls.push('refreshPermissionDiagnostics'); },
      async confirmScreenshotResume() { f.native.calls.push('screenshot-resume-confirmed'); },
      reconcileNotificationOnboardingOnResume,
      NotificationService: {
        async checkPermission() { f.native.calls.push('checkDisplayPermission'); return 'granted'; },
        async checkExactAlarmPermission() { f.native.calls.push('checkExactAlarmPermission'); return 'granted'; },
      },
      StorageService: { settings: {
        async get(key, fallback) {
          if (key === 'biometricLockEnabled') return true;
          if (key === 'onboardingCompleted') return false;
          if (key === 'onboardingStep') return 3;
          if (key === 'notificationPermissionRequested') return true;
          if (key === 'notificationPreferences') return { taskReminders: true };
          if (key === 'notificationsEnabled') return false;
          return fallback;
        },
        async set(key, value) { f.native.calls.push(`setting:${key}:${value}`); },
      } },
    }, 'let resumeInProgress = false;');
    await callback({ isActive: false });
    await callback({ isActive: true });
    assert.ok(f.native.calls.includes('biometric'), 'Background return must retain biometric authentication');
    assert.ok(f.native.calls.includes('refreshPermissionDiagnostics'), 'Permission diagnostics refresh after return');
    assert.ok(f.native.calls.indexOf('screenshot-resume-confirmed') > f.native.calls.indexOf('biometric'), 'Screenshot resume fence clears only after biometric session restoration');
    assert.ok(!f.native.calls.includes('setting:onboardingStep:4'), 'Permission return does not replay or advance onboarding');
    assert.ok(!f.native.calls.includes('setting:notificationsEnabled:true'), 'Permission return does not silently enable notifications');
  }));

  await test('Missing exact-alarm access keeps contextual reminders enabled with approximate delivery', async () => {
    const persisted = [];
    const sequence = [];
    const askPermission = h.bind(h.appFunction('askNotificationPermission'), {
      notificationPermissionRequested: false,
      setNotificationPermissionRequested: value => sequence.push(`state:${value}`),
      StorageService: { settings: { async set(key, value) { persisted.push([key, value]); sequence.push(`persist:${key}`); } } },
      NotificationService: {
        isSupported: () => true,
        async checkPermission() { sequence.push('check-display'); return 'granted'; },
        async checkExactAlarmPermission() { sequence.push('check-exact'); return 'denied'; },
      },
    });
    const result = await askPermission();
    assert.equal(result.granted, true, 'Android inexact alarm fallback can still schedule reminders');
    assert.equal(result.status, 'approximate');
    assert.ok(!persisted.some(([key]) => key === 'notificationPermissionRequested'), 'Prompt state is never persisted before encryption setup');
    assert.ok(!sequence.includes('open-exact-settings'), 'Exact access does not launch a settings detour');
  });

  console.log(`LIFEOS STABILIZATION: ${passed}/5 passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
