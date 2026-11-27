'use strict';

const assert = require('node:assert/strict');
const premium = process.env.LIFEOS_PREMIUM_PROFILE === '1';
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
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', acceptDownloads: true });
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
      if (premium) {
        const toast = page.locator('.snackbar-close:visible');
        if (await toast.isVisible() && !await page.locator('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]').count()) {
          await toast.click();
          await toast.waitFor({ state: 'hidden' });
        }
        if (!/custom-preview|tone-preview|theme-preview|reduced-viewport/.test(file)) await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.screenshot({ path: join(evidence, file + '.png'), fullPage: !premium, animations: 'disabled' });
    };
    const geometry = async () => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow');
      const outside = await page.locator('[data-profile-section]:visible').evaluateAll(elements => elements.some(root =>
        [...root.querySelectorAll('.profile-row,.profile-group,.profile-identity-card')].some(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
        })));
      assert.equal(outside, false, 'Profile controls stay inside the viewport');
    };
    await page.goto(origin + '/tests/browser/index.html?onboarding-auth=success&qa-native-back=enabled');
    try { await page.locator('input[autocomplete="nickname"]').fill('Synthetic review', { timeout: 30_000 }); }
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
    await page.waitForFunction(async () => {
      const { isEncryptedStorageActivated, sessionManager } = await import('/src/db.ts');
      return isEncryptedStorageActivated() && sessionManager.isUnlocked();
    });
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
      if (premium) {
        const storedBefore = await page.evaluate(async () => (await import('/src/db.ts')).StorageService.settings.get('visualTheme', null));
        await click('Preview Ocean Mist');
        await page.getByRole('heading', { name: 'Previewing Ocean Mist' }).waitFor();
        await capture(theme + '-theme-preview');
        await click('Cancel preview');
        assert.equal(await page.evaluate(async () => (await import('/src/db.ts')).StorageService.settings.get('visualTheme', null)), storedBefore);
      }
      await capture(theme + '-themes');
      await back('appearance');
      await capture(theme + '-appearance');
      await click(/^Accent color/); await section('accent'); await capture(theme + '-accent');
      if (premium) {
        const hex = page.getByLabel('Hex color');
        await hex.fill('#bad');
        await page.getByRole('alert').getByText(/six hex digits/).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Apply accent' }).isEnabled(), false);
        await hex.fill('#ABCDEF');
        await capture(theme + '-accent-custom-preview');
      }
      await back('appearance');
      await click(/^Motion/); await section('motion');
      if (premium) {
        await click('Preview Snappy');
        await page.getByText(/Reduced motion is active/).waitFor();
        if (!await page.getByRole('radio', { name: 'Snappy' }).isChecked()) await page.getByRole('radio', { name: 'Snappy' }).click();
        await page.waitForFunction(async () => (await (await import('/src/db.ts')).StorageService.settings.get('motionPreset', '')) === 'snappy');
      }
      await capture(theme + '-motion'); await back('appearance');
      await back('home');
      await capture(theme + '-profile');
      await click('Edit name'); await capture(theme + '-display-name'); await click('Cancel');
      await click('Profile photo options'); await capture(theme + '-photo-options');
      await click('Edit photo'); await crop.waitFor(); await capture(theme + '-photo-editor');
      await crop.getByRole('button', { name: 'Cancel' }).click();
      for (const [name, id] of [[/^Preferences/, 'preferences'], [/^Notifications/, 'notifications'],
        [/^Money & Imports/, 'money-imports'], [/^Developer tools/, 'developer']]) {
        await page.getByRole('navigation', { name: 'Profile settings' }).getByRole('button', { name }).click();
        await section(id); await capture(theme + '-' + id);
        if (premium && id === 'preferences') {
          const choose = async (label, value) => {
            await click(new RegExp('^' + label));
            await page.getByRole('dialog', { name: label, exact: true }).getByRole('option', { name: value, exact: true }).click();
            await page.getByRole('dialog', { name: label, exact: true }).waitFor({ state: 'hidden' });
          };
          await click(/^Currency/);
          await page.getByRole('searchbox', { name: 'Search currencies' }).fill('USD');
          await capture(theme + '-currency-choice');
          await back();
          await page.getByRole('dialog', { name: 'Currency', exact: true }).waitFor({ state: 'hidden' });
          await choose('Date format', 'YYYY-MM-DD');
          await page.waitForFunction(async () => (await (await import('/src/db.ts')).StorageService.settings.get('userPreferences', {})).dateFormat === 'YMD');
          if (theme === 'light') {
            await page.evaluate(async () => {
              const { lifeOSDatabase } = await import('/src/db.ts');
              const reject = (_changes, key) => { if (key === 'userPreferences') throw new Error('Synthetic preference write failure'); };
              lifeOSDatabase.settings.hook('updating', reject);
              window.undoSyntheticWriteFailure = () => lifeOSDatabase.settings.hook('updating').unsubscribe(reject);
            });
            await choose('Date format', 'MM/DD/YYYY');
            await page.getByText(/Could not save this preference/).waitFor();
            await page.evaluate(() => window.undoSyntheticWriteFailure());
            assert.equal(await page.evaluate(async () => (await (await import('/src/db.ts')).StorageService.settings.get('userPreferences', {})).dateFormat), 'YMD');
          }
          await click('About Currency restrictions');
          await page.getByRole('dialog', { name: 'Currency restrictions' }).waitFor();
          await capture(theme + '-currency-info');
          await back();
          await page.getByRole('dialog', { name: 'Currency restrictions' }).waitFor({ state: 'hidden' });
        }
        if (premium && id === 'notifications') {
          await click('Preview another reminder');
          await page.getByText('Task due now', { exact: true }).waitFor();
          await capture(theme + '-tone-preview');
        }
        await back('home');
      }
      await click(/^Privacy & Security/); await section('privacy'); await capture(theme + '-privacy');
      for (const [label, id] of [[/^App lock/, 'app-lock'], [/^Recovery/, 'recovery'], [/^Legal & Privacy/, 'legal']]) {
        await click(label); await section(id);
        if (id === 'legal') {
          await page.locator('[data-profile-section="legal"]').getByText('Internal draft documents for review. Legal acceptance is disabled.').waitFor();
          if (premium) await page.getByRole('region', { name: 'Document library' }).waitFor();
        }
        await capture(theme + '-' + id);
        if (premium && id === 'recovery') {
          await click('Set up recovery kit');
          await page.getByRole('heading', { name: 'Recovery setup' }).waitFor();
          await capture(theme + '-recovery-setup');
          await back('recovery');
        }
        if (premium && id === 'legal') {
          const library = page.getByRole('region', { name: 'Document library' });
          const firstDoc = library.getByRole('button').first();
          const name = (await firstDoc.locator('strong').innerText()).trim();
          await firstDoc.click();
          await page.getByRole('dialog', { name, exact: true }).waitFor();
          await capture(theme + '-legal-reader');
          await back();
          await page.getByRole('dialog', { name, exact: true }).waitFor({ state: 'hidden' });
        }
        await back('privacy');
      }
      await back('home');
      await click(/^Backup & Restore/); await section('data'); await capture(theme + '-backup-restore');
      if (premium) {
        await click('Export encrypted backup');
        await page.getByRole('heading', { name: 'Protect your backup' }).waitFor();
        await capture(theme + '-backup-passphrase');
        await back('data');
      }
      await click('Export transactions CSV'); await page.getByRole('alertdialog').waitFor(); await capture(theme + '-csv-warning'); await click('Cancel');
      await click('Erase local records'); await page.getByRole('alertdialog').waitFor(); await capture(theme + '-reset-warning'); await click('Keep my data');
      await back('home');
      await click(/^About/); await section('about');
      if (premium) await page.waitForFunction(() => {
        const icon = document.querySelector('.profile-brand-hero img');
        return icon?.complete && icon.naturalWidth > 0;
      });
      await capture(theme + '-about');
      await click('Open-source licenses'); await section('licenses'); await capture(theme + '-licenses');
      if (premium) {
        await click('Web libraries and Inter font');
        const text = page.getByRole('dialog', { name: 'Web libraries and Inter font' }).locator('pre');
        await text.waitFor();
        assert.match(await text.innerText(), /BusyDoo third-party notices \| Web libraries and font/);
        await capture(theme + '-license-reader');
        await back();
        await page.getByRole('dialog', { name: 'Web libraries and Inter font' }).waitFor({ state: 'hidden' });
      }
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
    if (premium) {
      await click('Edit name');
      const longName = 'Synthetic workspace name with a long final word';
      await page.getByLabel('Display name').fill(longName);
      await click('Save name');
      await page.getByRole('heading', { name: longName, exact: true }).waitFor();
      for (const width of [320, 360, 393, 430]) {
        await page.setViewportSize({ width, height: 805 });
        await page.evaluate(() => { document.documentElement.style.fontSize = '125%'; });
        await geometry();
        await capture('large-text-profile-' + width);
        await click('Preferences');
        await section('preferences');
        await geometry();
        await capture('large-text-preferences-' + width);
        await back('home');
      }
      await click('Edit name');
      await page.setViewportSize({ width: 360, height: 465 });
      await page.getByLabel('Display name').focus();
      await capture('name-entry-reduced-viewport-360');
      await click('Cancel');
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
    if (premium) {
      await back(); await tab('settings'); await click('Backup & Restore'); await section('data');
      const passphrase = 'Disposable-profile-test-passphrase';
      await click('Export encrypted backup');
      await page.getByLabel('Backup passphrase').fill(passphrase);
      const exported = page.waitForEvent('download');
      await click('Continue to export');
      const backup = await exported;
      assert.match(backup.suggestedFilename(), /^busydoo-backup-.*\.json$/);
      const backupPath = await backup.path();
      await page.locator('[data-profile-section="data"] input[type=file]').setInputFiles(backupPath);
      await page.getByLabel('Backup passphrase').fill(passphrase);
      await click('Validate backup');
      await page.getByRole('alertdialog', { name: 'Replace existing BusyDoo data?' }).waitFor();
      await capture('restore-replace-review');
      await click('Replace and restore');
      await page.getByText('Backup restored successfully', { exact: true }).waitFor();
      assert.equal(await page.evaluate(async () => (await (await import('/src/db.ts')).StorageService.tasks.getAll()).length), 2);
      await click('Export transactions CSV');
      const csv = page.waitForEvent('download');
      await click('Export CSV');
      assert.match((await csv).suggestedFilename(), /\.csv$/);
      await page.evaluate(async () => (await import('/src/db.ts')).StorageService.settings.set('biometricLockEnabled', true));
      await click('Erase local records');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Erase local records', exact: true }).click();
      await page.getByText('All personal records erased', { exact: true }).waitFor();
      const result = await page.evaluate(async () => {
        const { StorageService } = await import('/src/db.ts');
        return {
          tasks: (await StorageService.tasks.getAll()).length,
          appLock: await StorageService.settings.get('biometricLockEnabled', false),
          photo: await StorageService.settings.get('profilePhoto', null),
          prefs: await StorageService.settings.get('userPreferences', null),
          motion: document.documentElement.dataset.motionPreset,
        };
      });
      assert.deepEqual(result, { tasks: 0, appLock: true, photo: null, prefs: null, motion: 'silky' });
      await back('home');
      await page.getByRole('heading', { name: 'Your profile' }).waitFor();
      await capture('profile-after-reset');
    }
    assert.deepEqual(errors, []);
    console.log('Profile and Notification Centre browser journey passed. Evidence: ' + evidence);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
