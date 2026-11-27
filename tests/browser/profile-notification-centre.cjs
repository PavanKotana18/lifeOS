'use strict';

const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { join } = require('node:path');
const { chromium } = require('playwright-core');

async function main() {
  const origin = process.env.LIFEOS_PROFILE_QA_ORIGIN || 'http://127.0.0.1:4317';
  const evidence = process.env.LIFEOS_BROWSER_EVIDENCE_DIR;
  assert.ok(evidence, 'Choose a new local evidence directory.');
  await mkdir(evidence, { recursive: true });
  const executablePath = process.env.LIFEOS_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(12_000);
    const click = name => page.getByRole('button', { name, exact: typeof name === 'string' }).last().click();
    const tab = async name => {
      const tabButton = page.locator('[data-tab="' + name + '"]');
      if (await tabButton.getAttribute('aria-current') !== 'page') await tabButton.click();
      await page.waitForFunction(name => document.querySelector('[data-tab="' + name + '"]')?.getAttribute('aria-current') === 'page', name);
    };
    const section = async id => {
      await page.locator('.profile-page[data-profile-section="' + id + '"]:visible').waitFor();
    };
    const back = async id => {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-app-backButton', { detail: { canGoBack: true } })));
      if (id) await section(id);
    };
    const capture = async file => {
      assert.equal(await page.locator('[data-sensitive-recovery-code],#recovery-code-confirmation').count(), 0);
      await page.screenshot({ path: join(evidence, file + '.png'), fullPage: true, animations: 'disabled' });
    };
    await page.goto(origin + '/tests/browser/index.html?onboarding-auth=success&qa-native-back=enabled');
    try { await page.locator('input[autocomplete="nickname"]').fill('Synthetic review'); }
    catch (error) { console.error(errors, await page.locator('body').innerText()); throw error; }
    await click('Continue');
    await click('Allow notifications');
    await page.getByText('Notifications allowed', { exact: true }).waitFor();
    await click('Enable precise reminders');
    await page.getByText(/Without it, reminders may arrive late/).waitFor();
    await click('Enable precise reminders');
    await page.evaluate(() => {
      sessionStorage.setItem('qa-exact-alarm', 'true');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByText('Precise reminders enabled', { exact: true }).waitFor();
    await click('Continue');
    await click('Not now');
    await click('Review deferral');
    await click('Do this later');
    await page.getByTestId('today-dashboard').waitFor();
    await page.evaluate(async () => {
      const { StorageService, sessionManager, activateEncryptedStorage } = await import('/src/db.ts');
      const { CryptoService } = await import('/src/services/cryptoService.ts');
      const { formatLocalDate } = await import('/src/services/domainUtils.ts');
      await CryptoService.setup();
      await CryptoService.deferRecovery();
      sessionManager.unlock();
      await activateEncryptedStorage();
      const due = new Date(Date.now() - 3 * 60_000);
      const dueTime = String(due.getHours()).padStart(2, '0') + ':' + String(due.getMinutes()).padStart(2, '0');
      for (const title of ['Synthetic task A', 'Synthetic task B']) {
        await StorageService.tasks.add({ title, dueDate: formatLocalDate(due), dueTime, recurring: 'None',
          priority: 'Medium', completed: false });
      }
    });
    await page.reload();
    await page.getByTestId('today-dashboard').waitFor();
    await page.evaluate(async () => {
      const { StorageService } = await import('/src/db.ts');
      const tasks = await StorageService.tasks.getAll();
      const occurrenceAt = new Date(Date.now() - 1000).toISOString();
      const dispatch = (task, id) => window.dispatchEvent(new CustomEvent('qa-notification-tap', { detail: {
        actionId: 'tap', notification: { id, extra: { kind: 'taskSnooze', taskId: task.id, occurrenceAt } },
      } }));
      dispatch(tasks[0], 100); dispatch(tasks[1], 101); dispatch(tasks[1], 101);
    });
    await page.getByText('Synthetic task B', { exact: true }).last().waitFor();
    await tab('dashboard');
    for (const name of ['finance', 'plan', 'settings', 'dashboard']) {
      await tab(name);
      await page.locator('.notification-bell:visible').waitFor();
      assert.equal(await page.locator('.notification-bell:visible').count(), 1);
      if (name === 'finance') assert.equal(await page.locator('.money-period-control:visible').count(), 1);
      await page.locator('.notification-bell').click();
      await page.getByRole('dialog', { name: 'Notification Centre' }).waitFor();
      await back();
      await page.getByRole('dialog', { name: 'Notification Centre' }).waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-tab="' + name + '"]').getAttribute('aria-current'), 'page');
    }
    await tab('settings');
    await section('home');
    await click('Edit name');
    await page.getByLabel('Display name').fill('Synthetic profile');
    await click('Save name');
    await page.getByRole('heading', { name: 'Synthetic profile' }).waitFor();
    const photo = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 120;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#437a67';
      ctx.fillRect(0, 0, 120, 120);
      ctx.fillStyle = '#e2c296';
      ctx.beginPath(); ctx.arc(60, 60, 32, 0, Math.PI * 2); ctx.fill();
      return canvas.toDataURL().split(',')[1];
    });
    await click('Profile photo options');
    const chooser = page.waitForEvent('filechooser');
    await click('Choose photo');
    await (await chooser).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
    const crop = page.getByRole('dialog', { name: 'Crop profile photo' });
    await crop.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('profile-settings-home').locator('img.profile-avatar-image').waitFor();
    assert.equal(await page.evaluate(async () => {
      const { StorageService, lifeOSDatabase } = await import('/src/db.ts');
      const backup = JSON.parse(await StorageService.backup.exportData());
      const stored = await lifeOSDatabase.settings.get('profilePhoto');
      return stored.__lifeosEncrypted === 1 && backup.tables.settings.every(row => row.key !== 'notificationInbox.v1');
    }), true);
    for (const theme of ['light', 'dark']) {
      await click(/^Appearance/);
      await section('appearance');
      await click(/^Themes/);
      await section('themes');
      await click(new RegExp('^' + theme + '$', 'i'));
      await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark, theme === 'dark');
      await capture(theme + '-themes');
      await back('appearance');
      await capture(theme + '-appearance');
      await click(/^Accent color/); await section('accent'); await capture(theme + '-accent'); await back('appearance');
      await click(/^Motion/); await section('motion'); await capture(theme + '-motion'); await back('appearance');
      await back('home');
      await capture(theme + '-profile');
      await click('Edit name'); await capture(theme + '-display-name'); await click('Cancel');
      await click('Profile photo options'); await capture(theme + '-photo-options');
      await click('Edit photo'); await crop.waitFor(); await capture(theme + '-photo-editor');
      await crop.getByRole('button', { name: 'Cancel' }).click();
      for (const [name, id] of [[/^Preferences/, 'preferences'], [/^Notifications/, 'notifications'],
        [/^Money & Imports/, 'money-imports'], [/^Developer tools/, 'developer']]) {
        await page.getByRole('navigation', { name: 'Profile settings' }).getByRole('button', { name }).click();
        await section(id); await capture(theme + '-' + id); await back('home');
      }
      await click(/^Privacy & Security/); await section('privacy'); await capture(theme + '-privacy');
      for (const [label, id] of [[/^App lock/, 'app-lock'], [/^Recovery/, 'recovery'], [/^Legal & Privacy/, 'legal']]) {
        await click(label); await section(id);
        if (id === 'legal') await page.locator('[data-profile-section="legal"]').getByText('Internal draft documents for review. Legal acceptance is disabled.').waitFor();
        await capture(theme + '-' + id); await back('privacy');
      }
      await back('home');
      await click(/^Backup & Restore/); await section('data'); await capture(theme + '-backup-restore');
      await click('Export transactions CSV'); await page.getByRole('alertdialog').waitFor(); await capture(theme + '-csv-warning'); await click('Cancel');
      await click('Erase local records'); await page.getByRole('alertdialog').waitFor(); await capture(theme + '-reset-warning'); await click('Keep my data');
      await back('home');
      await click(/^About/); await section('about'); await capture(theme + '-about');
      await click('Open-source licenses'); await section('licenses'); await capture(theme + '-licenses');
      await back('about'); await back('home');
      await page.locator('.notification-bell').click();
      await page.getByRole('dialog', { name: 'Notification Centre' }).waitFor();
      const inbox = page.getByRole('dialog', { name: 'Notification Centre' });
      await inbox.getByRole('button', { name: 'Mark done for Synthetic task A' }).waitFor();
      await inbox.getByRole('button', { name: 'Mark done for Synthetic task B' }).waitFor();
      await capture(theme + '-notification-centre');
      await click('Settings');
      await page.getByRole('heading', { name: 'Notification settings', exact: true }).waitFor();
      await capture(theme + '-inbox-settings');
      await back(); await page.getByRole('heading', { name: 'Notification Centre' }).waitFor();
      await back(); await page.locator('.notification-bell:focus').waitFor();
    }
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '125%'; });
    await page.locator('.notification-bell').click();
    await page.getByRole('dialog', { name: 'Notification Centre' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await capture('large-text-notification-centre-320');
    await page.getByRole('button', { name: 'Mark all as read' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Mark all as read' }).isEnabled(), true);
    await click('Mark all as read');
    await click('Unread');
    await page.getByText('All caught up', { exact: true }).waitFor();
    await page.reload();
    await page.getByTestId('today-dashboard').waitFor();
    await page.locator('.notification-bell').click();
    await click('Unread');
    await page.getByText('All caught up', { exact: true }).waitFor();
    assert.equal(await page.evaluate(async () => {
      const { lifeOSDatabase } = await import('/src/db.ts');
      const settings = await lifeOSDatabase.settings.toArray();
      return settings.filter(row => row.__lifeosEncrypted === 1)
        .every(row => !JSON.stringify(row).includes('taskSnooze'));
    }), true);
    assert.deepEqual(errors, []);
    console.log('Profile and Notification Centre browser journey passed. Evidence: ' + evidence);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
