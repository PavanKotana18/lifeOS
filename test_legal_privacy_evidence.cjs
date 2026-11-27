
'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { webcrypto, createHash } = require('node:crypto');
const ts = require('typescript');
const { chromium } = require('playwright-core');
const h = require('./tests/wp0/production-harness.cjs');

async function syntheticReset() {
  const f = await h.fixture();
  try {
    const prefs = { ...f.DEFAULT_NOTIFICATION_PREFERENCES, taskReminders: true };
    const task = await f.StorageService.tasks.add({ title: 'Synthetic reset record', dueDate: '2099-02-01', dueTime: '09:00',
      completed: false, recurring: 'None', priority: 'Medium' });
    await f.StorageService.settings.set('onboardingNameDraft', 'Synthetic draft');
    await f.StorageService.settings.set('displayName', 'Synthetic profile');
    await f.StorageService.settings.set('profilePhoto', 'data:image/jpeg;base64,/9j/AA==');
    await f.NotificationService.syncTasks([task], prefs);
    const reminder = [...f.pending.values()].find(item => item.extra?.taskId === task.id);
    assert.ok(reminder);
    const deliveredOnly = { ...reminder, id: reminder.id + 1 };
    f.delivered.set(deliveredOnly.id, deliveredOnly);
    const keyBefore = await f.native.getKeyState();
    const snapshot = await f.StorageService.backup.exportData();
    await f.NotificationService.cancelAllRecordReminders();
    await f.StorageService.backup.clearAll();
    assert.equal((await f.StorageService.tasks.getAll()).length, 0);
    for (const key of ['onboardingNameDraft', 'displayName', 'profilePhoto']) {
      assert.equal(await f.StorageService.settings.get(key, null), null);
      assert.equal(await f.lifeOSDatabase.settings.get(key), undefined);
    }
    assert.equal(f.pending.has(reminder.id), false);
    assert.equal(f.delivered.has(deliveredOnly.id), true);
    assert.equal(typeof localStorage.getItem('lifeos.notificationDiagnostics'), 'string');
    assert.deepEqual(await f.native.getKeyState(), keyBefore);
    assert.ok(snapshot.length > 0, 'Separately captured export is unaffected by local reset');
    console.log('A03 PASS Dexie synthetic reset and simulated notifications/keys. Delivered notification and diagnostic retained; separate export unaffected.');
  } finally { await f.dispose(); }
}

async function receipts() {
  if (!globalThis.crypto) globalThis.crypto = webcrypto;
  require('./scripts/register-ts-test-loader.cjs');
  const { policy, previewTerms, previewReceipt } = require('./src/legal/policyPreview.ts');
  assert.equal(policy.effectiveDate, null);
  assert.equal(policy.supportEmail, null);
  await assert.rejects(previewReceipt(previewTerms.initial, true, false), /Confirm both/);
  await assert.rejects(previewReceipt(previewTerms.initial, false, true), /Confirm both/);
  const one = await previewReceipt(previewTerms.initial, true, true);
  const two = await previewReceipt(previewTerms.updated, true, true);
  assert.equal(one.contentHash, createHash('sha256').update(previewTerms.initial.content).digest('hex'));
  assert.notEqual(one.contentHash, two.contentHash);
  assert.notEqual(one.version, two.version);
  assert.ok(Date.parse(two.acceptedAt) <= Date.now());
  assert.equal(two.example, true);
  console.log('Legal preview PASS both affirmations required; content hashes and versions differ across the example update.');
}

async function syntheticPhoto() {
  const candidate = process.env.BUSYDOO_PRIVACY_BROWSER || path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe');
  const browser = await chromium.launch({ executablePath: candidate, headless: true });
  try {
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    const moduleBody = ts.transpileModule(readFileSync('src/services/profilePhoto.ts', 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const result = await page.evaluate(async code => {
      const exports = {};
      new Function('exports', code)(exports);
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 48, 32);
      const image = atob(canvas.toDataURL('image/jpeg').split(',')[1]);
      const marker = 'Synthetic metadata marker 101';
      const segment = String.fromCharCode(255, 254, 0, marker.length + 2) + marker;
      const injected = image.slice(0, 2) + segment + image.slice(2);
      const photo = new Image();
      photo.src = 'data:image/jpeg;base64,' + btoa(injected);
      await photo.decode();
      const output = exports.encodeProfileCrop(photo, exports.INITIAL_PHOTO_CROP);
      const cropped = new Image();
      cropped.src = output;
      await cropped.decode();
      return { hasInputMetadata: injected.includes(marker), hasOutputMetadata: atob(output.split(',')[1]).includes(marker),
        width: cropped.naturalWidth, height: cropped.naturalHeight };
    }, moduleBody);
    assert.deepEqual(result, { hasInputMetadata: true, hasOutputMetadata: false, width: 32, height: 32 });
    await context.close();
    console.log('A05 PASS offline Chromium canvas re-encode removed synthetic JPEG metadata and did not upscale.');
  } finally { await browser.close(); }
}

(async () => {
  await syntheticReset();
  await receipts();
  await syntheticPhoto();
})().catch(error => { console.error(error); process.exitCode = 1; });
