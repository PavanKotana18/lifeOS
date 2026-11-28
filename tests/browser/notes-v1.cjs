
'use strict';
const assert = require('node:assert/strict');
const { mkdir, readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { chromium } = require('playwright-core');

async function main() {
  const origin = process.env.LIFEOS_NOTES_QA_ORIGIN || 'http://127.0.0.1:4317';
  const evidence = process.env.LIFEOS_BROWSER_EVIDENCE_DIR;
  assert.ok(evidence, 'Set LIFEOS_BROWSER_EVIDENCE_DIR to an isolated synthetic evidence path.');
  await mkdir(evidence, { recursive: true });
  const executablePath = process.env.LIFEOS_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] });
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true,
      reducedMotion: 'reduce', acceptDownloads: true,
    });
    const external = [], errors = [];
    await context.route('**/*', route => {
      if (route.request().url().startsWith(origin + '/')) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(10000);
    const click = (name, root = page) => root.getByRole('button', { name, exact: true }).last().click();
    const tab = name => page.locator('[data-tab="' + name + '"]').click();
    const notes = page.locator('#screen-notes');
    const editor = page.locator('[data-notes-editor]:visible');
    const body = editor.getByRole('textbox', { name: 'Note body' });
    const title = editor.getByRole('textbox', { name: 'Note title' });
    const back = () => page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-app-backButton', { detail: { canGoBack: true } })));
    const capture = async name => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' horizontal page overflow');
      const overflows = await page.locator('.notes-card:visible').evaluateAll(cards => cards.some(card => {
        const frame = card.getBoundingClientRect();
        return Array.from(card.children).some(child => child.getBoundingClientRect().right > frame.right);
      }));
      assert.equal(overflows, false, name + ' note content overflows its card');
      await page.screenshot({ path: join(evidence, name + '.png'), animations: 'disabled' });
    };
    const archived = () => notes.getByRole('heading', { name: 'Archive', exact: true, level: 1 });
    const sign = async () => {
      await page.goto(origin + '/tests/browser/index.html?onboarding-auth=success&qa-native-back=enabled');
      {
        await page.locator('input[autocomplete="nickname"]').fill('Synthetic review');
        await click('Continue');
        await click('Allow notifications');
        await page.getByText('Notifications allowed', { exact: true }).waitFor();
        await click('Continue without precise reminders');
        await click('Not now');
        await click('Review deferral');
        await click('Do this later');
        await page.getByTestId('today-dashboard').waitFor();
      }
      await workspace();
      await click('New note', notes);
      await body.fill('Synthetic first protected draft');
      const admission = page.getByRole('dialog', { name: 'Protect your personal data' });
      await admission.getByRole('button', { name: /Cancel saving/ }).click();
      await editor.getByRole('alert').waitFor();
      assert.equal(await body.innerText(), 'Synthetic first protected draft');
      await click('Retry', editor);
      await click('Protect this device and save', admission);
      await saved(); await done();
      await page.evaluate(async () => {
        const db = await import('/src/db.ts');
        const { CryptoService } = await import('/src/services/cryptoService.ts');
        if (!(await CryptoService.getKeyState()).keyProvisioned) {
          await CryptoService.setup(); await CryptoService.deferRecovery();
        }
        await CryptoService.unlock();
        db.sessionManager.unlock();
        await db.activateEncryptedStorage();
        await db.StorageService.settings.set('onboardingCompleted', true);
        const { notes, epoch } = await db.StorageService.notes.workspace();
        const first = notes.find(note => note.document.content.content[0].content[0].text === 'Synthetic first protected draft');
        if (!first) throw new Error('First private draft was not encrypted.');
        await db.StorageService.notes.dispose(epoch, first.id, first.revision, 'trash');
        await db.StorageService.notes.dispose(epoch, first.id, first.revision + 1, 'delete');
        await db.StorageService.settings.set('notificationPreferences', { notesReminders: true });
        await db.StorageService.tasks.add({ title: 'Synthetic follow-up', priority: 'Medium', completed: false, recurring: 'None' });
      });
      await page.reload();
      await page.getByTestId('today-dashboard').waitFor();
    };
    async function workspace() {
      await tab('plan');
      await click('Notes', page.getByRole('navigation', { name: 'Plan destinations' }).filter({ visible: true }));
      await notes.getByRole('heading', { name: 'Notes', exact: true }).waitFor();
    }
    const saved = () => editor.getByRole('status').getByText('Saved', { exact: true }).waitFor();
    async function done() {
      await click('Done', editor);
      await editor.waitFor({ state: 'hidden' });
    }
    async function workspaceMenu(name) {
      await click('Notes options', notes);
      await click(name, notes);
    }
    async function editMenu(name) {
      await click('Note options', editor);
      await click(name, editor);
    }

    await sign();
    await workspace();
    await notes.getByText('A place for your thoughts').waitFor();
    await capture('01-empty-workspace-light-393');
    await click('New note', notes);
    await body.waitFor();
    await done();
    assert.equal(await notes.locator('.notes-card').count(), 0);
    await click('New note', notes);
    await body.fill('Research café and planning');
    await saved();
    await done();
    const first = notes.getByRole('button', { name: /Research café and planning/ });
    await first.waitFor();
    await first.click();
    await title.fill('A weekend to remember');
    await body.press('End');
    await body.press('Enter');
    await click('Heading', editor);
    await page.keyboard.insertText('Saturday plans');
    await body.press('Enter');
    if (await editor.getByRole('button', { name: 'Heading', exact: true }).getAttribute('aria-pressed') === 'true') await click('Heading', editor);
    await click('Checklist', editor);
    await page.keyboard.insertText('Water the garden');
    await body.press('Enter');
    await page.keyboard.insertText('Pick up fruit');
    await body.press('Enter');
    if (await editor.getByRole('button', { name: 'Checklist', exact: true }).getAttribute('aria-pressed') === 'true') await click('Checklist', editor);
    await click('Bold', editor);
    await page.keyboard.insertText('Bring a notebook');
    await click('Undo', editor);
    assert.equal(await body.getByText('Bring a notebook', { exact: true }).count(), 0);
    await click('Redo', editor);
    await body.locator('strong').getByText('Bring a notebook', { exact: true }).waitFor();
    const check = body.getByRole('button', { name: 'Completed' }).first();
    await check.click();
    assert.equal(await check.getAttribute('aria-pressed'), 'true');
    await body.press('Control+End');
    await body.press('Enter');
    await body.evaluate(node => {
      const data = new DataTransfer();
      data.setData('text/html', '<img src="https://invalid.test/image.png"><script>test</script>');
      data.setData('text/plain', ' Safe paste');
      node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    assert.equal(await body.locator('img, script, a').count(), 0);
    await saved();
    await capture('02-mixed-rich-editor-light-393');
    await editMenu('Pin note');
    await saved(); await done();
    await notes.getByRole('heading', { name: 'Pinned', exact: true }).waitFor();
    await capture('03-pinned-list-light-393');
    await click('Switch to grid view', notes);
    await notes.locator('[data-view="grid"]').waitFor();
    await click('New note', notes);
    await title.fill('An unusually long field note about the supplies we need for a family trip next month');
    await body.fill('Reserve garden tools and remember a good umbrella.');
    await saved(); await done();
    await capture('04-pinned-grid-light-393');

    await workspaceMenu('Manage notebooks');
    const manager = page.getByRole('dialog', { name: 'Manage notebooks' });
    await manager.getByRole('textbox').fill('A long notebook name for weekend planning and all other errands');
    await click('Create notebook', manager);
    await manager.getByRole('button', { name: /A long notebook name/ }).waitFor();
    await capture('05-notebook-management-light-393');
    await click('Close', manager);
    const weekend = notes.getByRole('button', { name: /A weekend to remember/ });
    await weekend.click();
    await editMenu('Organize');
    await editor.getByRole('combobox', { name: 'Notebook', exact: true }).selectOption({ label: 'A long notebook name for weekend planning and all other errands' });
    await editor.getByRole('textbox', { name: 'Tags', exact: true }).fill('Garden, list, GARDEN');
    await capture('06-notebook-tags-light-393');
    await click('Done', editor.getByRole('dialog', { name: 'Note options' }));
    await saved();
    await editMenu('Linked records');
    await editor.getByRole('combobox', { name: 'Link a record', exact: true }).selectOption({ label: 'Task · Synthetic follow-up' });
    await click('Add link', editor);
    await editor.getByRole('button', { name: 'Task · Synthetic follow-up', exact: true }).waitFor();
    await capture('07-links-light-393');
    await back();
    await editMenu('Set reminder');
    const local = new Date(Date.now() + 24 * 60 * 60000);
    const localText = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    await editor.getByLabel('Date and time').fill(localText);
    await capture('08-reminder-light-393');
    await click('Save reminder', editor);
    await saved();
    await editMenu('Export note');
    await capture('09-export-light-393');
    await click('Export formats', editor);
    const info = page.locator('dialog[data-contextual-info="true"][open]');
    await info.getByRole('heading', { name: 'Readable note exports' }).waitFor();
    await capture('20-contextual-info-light-393');
    await back();
    await info.waitFor({ state: 'hidden' });
    const download = page.waitForEvent('download');
    await click('Save Markdown', editor);
    const text = await readFile(await (await download).path(), 'utf8');
    assert.match(text, /^# A weekend to remember/m);
    assert.match(text, /- \[x\] Water the garden/);
    await done();

    const search = notes.getByRole('searchbox', { name: 'Search notes' });
    await search.fill('water garden');
    await weekend.waitFor();
    await capture('10-search-light-393');
    await search.fill('no such note');
    await notes.getByText('No matching notes').waitFor();
    await search.fill('garden');
    await weekend.click();
    await body.evaluate(node => {
      const child = node.querySelector('.note-check-item span');
      const range = document.createRange(); range.selectNodeContents(child);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await click('Create task from selection', editor);
    const task = page.getByRole('dialog', { name: 'Add task', exact: true });
    await task.waitFor();
    assert.equal(await task.getByRole('textbox', { name: 'Task title' }).inputValue(), 'Water the garden');
    await capture('11-task-conversion-light-393');
    await back();
    const discardTask = page.getByRole('alertdialog', { name: 'Discard unsaved changes?' });
    await editor.or(discardTask).waitFor().catch(async error => {
      await capture('debug-task-conversion-return');
      console.error(await page.locator('body').innerText());
      throw error;
    });
    if (await discardTask.isVisible()) await click('Discard changes', discardTask);
    await editor.waitFor();
    await body.evaluate(node => {
      const child = node.querySelector('.note-check-item span');
      const range = document.createRange(); range.selectNodeContents(child);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await click('Create task from selection', editor);
    const due = new Date(Date.now() + 86400000);
    await task.getByLabel('Due date', { exact: true }).fill([
      due.getFullYear(), String(due.getMonth() + 1).padStart(2, '0'), String(due.getDate()).padStart(2, '0'),
    ].join('-'));
    await click('Save task', task);
    await editor.waitFor();
    assert.equal(await title.inputValue(), 'A weekend to remember');
    await editMenu('Archive note');
    await saved();
    await done();
    await workspaceMenu('Archive');
    await archived().waitFor();
    await weekend.waitFor();
    await capture('12-archive-light-393');
    await weekend.click();
    await editMenu('Move to Trash');
    await editor.waitFor({ state: 'hidden' });
    await workspaceMenu('Trash');
    await weekend.waitFor();
    await capture('13-trash-light-393');
    await weekend.click();
    await editMenu('Restore note');
    await editor.waitFor({ state: 'hidden' });
    await workspaceMenu('Archive');
    await weekend.waitFor();
    await weekend.click();
    await editMenu('Restore to Notes');
    await saved();
    await done();
    await workspaceMenu('All notes');
    await weekend.waitFor();
    await tab('dashboard');
    assert.equal(await page.locator('[data-today-card="notes"]:visible').count(), 0);
    await click('Today layout');
    await page.getByRole('checkbox', { name: 'Notes', exact: true }).check();
    await click('Done', page.getByRole('dialog', { name: /Make Today yours/ }));
    const card = page.locator('[data-today-card="notes"]:visible');
    await card.evaluate(element => element.scrollIntoView({ block: 'center' }));
    await page.waitForFunction(() => {
      const card = document.querySelector('[data-today-card="notes"]');
      const bar = document.querySelector('.app-bottom-nav');
      return card.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top;
    });
    await capture('14-today-card-light-393');
    await click('Write a note', card);
    await body.waitFor();
    await done();
    await page.getByTestId('today-dashboard').filter({ visible: true }).waitFor();
    await workspace();

    await weekend.click();
    // A competing authenticated revision makes the next editor save fail without touching its draft.
    await page.evaluate(async () => {
      const { StorageService } = await import('/src/db.ts');
      const { notes, epoch } = await StorageService.notes.workspace();
      const note = notes.find(row => row.title === 'A weekend to remember');
      await StorageService.notes.save(epoch, note.revision, { ...note, title: 'A weekend to remember' });
    });
    await title.fill('Uncommitted conflicting edit');
    await editor.getByRole('alert').waitFor();
    await capture('15-failed-save-light-393');
    await click('Discard changes', editor);
    await click('Discard changes', page.getByRole('alertdialog'));
    await editor.waitFor({ state: 'hidden' });

    for (const [width, scheme, fontSize] of [[320, 'dark', 16], [360, 'light', 19], [393, 'dark', 19], [430, 'dark', 16]]) {
      await page.setViewportSize({ width, height: 780 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.evaluate(size => { document.documentElement.style.fontSize = size + 'px'; }, fontSize);
      await capture('16-workspace-' + scheme + '-' + width);
      await weekend.click();
      await body.waitFor();
      await capture('17-editor-' + scheme + '-' + width);
      if (width === 360) {
        await page.setViewportSize({ width, height: 480 });
        await body.click();
        await capture('18-editor-reduced-viewport-light-360');
        await page.setViewportSize({ width, height: 780 });
      }
      await done();
      if (width === 320) {
        await notes.getByRole('button', { name: /An unusually long field note/ }).click();
        await notes.locator('.notes-title').waitFor({ state: 'hidden' });
        const height = await title.evaluate(element => element.getBoundingClientRect().height);
        assert.ok(height > 50, 'long title wraps at a narrow width');
        await capture('21-long-editor-title-dark-320');
        await done();
      }
    }
    const tap = await page.evaluate(async () => {
      const { StorageService } = await import('/src/db.ts');
      const backup = JSON.parse(await StorageService.backup.exportData());
      const note = backup.tables.notes.find(row => row.title === 'A weekend to remember');
      note.reminder = { id: crypto.randomUUID(), at: new Date(Date.now() - 10000).toISOString() };
      await StorageService.backup.importData(JSON.stringify(backup), { replaceExisting: true });
      return { actionId: 'tap', notification: { id: 15000, extra: {
        kind: 'notesReminder', noteId: note.id, reminderId: note.reminder.id, occurrenceAt: note.reminder.at,
      } } };
    });
    await page.reload();
    await page.getByTestId('today-dashboard').filter({ visible: true }).waitFor();
    await page.locator('.notification-bell:visible').click();
    const inbox = page.getByRole('dialog', { name: 'Notification Centre' });
    await inbox.getByText('Note reminder', { exact: true }).waitFor();
    await capture('19-inbox-note-event');
    await click('Open A weekend to remember', inbox);
    await title.waitFor();
    assert.equal(await title.inputValue(), 'A weekend to remember');
    await done();
    await page.evaluate(payload => window.dispatchEvent(new CustomEvent('qa-notification-tap', { detail: payload })), tap);
    await title.waitFor();
    assert.equal(await title.inputValue(), 'A weekend to remember');
    await done();
    await page.evaluate(payload => sessionStorage.setItem('qa-pending-note-tap', JSON.stringify(payload)), tap);
    await page.reload();
    await title.waitFor();
    assert.equal(await title.inputValue(), 'A weekend to remember');
    await done();
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('Notes synthetic browser journey and captures passed. Evidence: ' + evidence);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
