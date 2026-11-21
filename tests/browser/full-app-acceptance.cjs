'use strict';

// Full React application acceptance in an ephemeral Chromium context. The real
// encrypted IndexedDB facade is exercised with tests/browser/bootstrap.ts's
// disposable synthetic crypto plugin. No production database or native device.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');

const root = process.env.LIFEOS_APP_ROOT ? path.resolve(process.env.LIFEOS_APP_ROOT) : path.resolve(__dirname, '../..');
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidence = process.env.LIFEOS_BROWSER_EVIDENCE_DIR || path.join(localAppData, 'LifeOS', 'checkpoints', `full-app-acceptance-${runId}`);
if (fs.existsSync(evidence)) throw new Error(`Evidence directory already exists; refusing to overwrite: ${evidence}`);
fs.mkdirSync(evidence, { recursive: true });

const touchReview = process.env.LIFEOS_TOUCH_REVIEW === '1';
const touchComposers = new Set([
  'task-composer-390', 'add-habit-composer-390', 'add-goal-composer-390',
  'add-transaction-composer-390', 'add-savings-composer-390', 'planned-bill-composer-390',
]);

const report = {
  startedAt: new Date().toISOString(), repository: root, commit: '',
  environment: 'Actual React application, ephemeral browser context, disposable synthetic native crypto plugin, isolated IndexedDB; no Android/physical device',
  evidence, journeys: [], responsive: [], screenshots: [], consoleErrors: [], pageErrors: [],
  accessibility: [], overflow: [], networkBlocked: [], blocked: [],
  auditedControls: {}, controlActions: [], touchFeedback: [],
};
const plannedJourneys = [
    'first launch and safe browsing', 'primary tab navigation and details',
  'create and complete a task', 'create a posted expense and budget',
  'create a savings goal and contribution', 'create and check in a habit',
  'create a goal, milestone and progress update', 'back navigation and ciphertext persistence',
];
let browser, context, page, vite, touchCdp;
let port;
let currentJourney = 'boot';
let failures = 0;

function record(status, name, detail = '') {
  report.journeys.push({ name, status, ...(detail ? { detail } : {}) });
  if (status === 'FAIL') failures++;
}

async function journey(name, run) {
  currentJourney = name;
  const started = Date.now();
  try {
    await run();
    record('PASS', name, `${Date.now() - started} ms`);
  } catch (error) {
    record('FAIL', name, error instanceof Error ? error.message : String(error));
    try { await capture(`failure-${report.journeys.length}`); } catch { /* preserve the original failure */ }
    throw error;
  }
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}

async function startVite() {
  port = await freePort();
  const viteEntry = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  vite = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' },
  });
  let recent = '';
  const save = chunk => { recent = (recent + chunk.toString()).slice(-3000); };
  vite.stdout.on('data', save); vite.stderr.on('data', save);
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Disposable Vite server exited: ${recent}`);
    try { const response = await fetch(origin); if (response.ok) return origin; } catch { /* wait for Vite */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Disposable Vite server did not become ready: ${recent}`);
}

async function clickButton(name, options = {}) {
  const button = page.getByRole('button', { name, exact: options.exact ?? true }).last();
  await button.waitFor({ state: 'visible' });
  await button.click();
}

async function planDestination(name) {
  await activeTab('plan');
  const button = page.getByRole('navigation', { name: 'Plan destinations' }).getByRole('button', { name, exact: true });
  if (await button.getAttribute('aria-current') !== 'page') await button.click();
  await button.waitFor();
}

async function activeTab(name) {
  const profile = page.getByRole('region', { name: 'Profile and settings' });
  const profileClose = profile.getByRole('button', { name: 'Back from profile', exact: true });
  while (await profile.isVisible()) {
    if (await profileClose.isVisible()) await profileClose.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(50);
  }
  const tab = page.locator(`[data-tab="${name}"]`);
  await tab.waitFor({ state: 'visible' });
  if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.waitForFunction(expected => document.querySelector(`[data-tab="${expected}"]`)?.getAttribute('aria-current') === 'page', name);
}

function dialog() { return page.locator('form[role="dialog"]:visible').last(); }

async function fillDialogField(label, value) {
  const field = dialog().getByLabel(label, { exact: false }).last();
  await field.waitFor({ state: 'visible' });
  await field.fill(String(value));
  return field;
}

async function chooseOption(scope, label, value) {
  const trigger = scope.getByRole('button', { name: label, exact: true });
  await trigger.click();
  const choices = page.locator('dialog[data-preference-choice][open]').last();
  const buttons = choices.locator('button[data-option-value]:enabled');
  const option = typeof value === 'object' ? buttons.nth(value.index) :
    choices.locator('button[data-option-value=' + JSON.stringify(value) + ']');
  const selected = await option.getAttribute('data-option-value');
  await option.click();
  await choices.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(button => button.closest('[data-choice-field]')?.getAttribute('data-choice-value')), selected);
  return selected;
}

async function saveDialog(buttonName) {
  await dialog().getByRole('button', { name: buttonName, exact: true }).click();
  await dialog().waitFor({ state: 'detached', timeout: 15_000 }).catch(async () => {
    assert.equal(await dialog().count(), 0, `Dialog remained open after ${buttonName}`);
  });
}

async function capture(name, fullPage = true) {
  // Recovery codes and recovery confirmation fields are categorically excluded.
  if (await page.locator('[data-sensitive-recovery-code],#recovery-code-confirmation').count()) {
    throw new Error(`Refusing screenshot while recovery material is rendered (${name})`);
  }
  const file = path.join(evidence, `${name}.png`);
  await page.screenshot({ path: file, fullPage, animations: 'disabled', timeout: 15_000 });
  report.screenshots.push(path.basename(file));
  if (!touchReview || !touchComposers.has(name)) return;
  touchCdp ??= await page.context().newCDPSession(page);
  const composer = page.locator('.feather-composer:visible').last();
  for (const selector of ['.task-option:not(:disabled), .alive-disclosure > button', 'button[type="submit"]']) {
    const control = composer.locator(selector).first();
    await control.scrollIntoViewIfNeeded();
    const rect = await control.boundingBox();
    assert.ok(rect, name + ' has a visible control for ' + selector);
    const rest = await control.evaluate(element => getComputedStyle(element).boxShadow);
    const handle = await control.elementHandle();
    const touchPoints = [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }];
    let pressed;
    try {
      await touchCdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      await page.waitForFunction(({ element, rest }) => getComputedStyle(element).boxShadow !== rest,
        { element: handle, rest }, { timeout: 1200 });
      pressed = await control.evaluate(element => getComputedStyle(element).boxShadow);
    } finally {
      try {
        await touchCdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await page.waitForFunction(({ element, rest }) => getComputedStyle(element).boxShadow === rest,
          { element: handle, rest }, { timeout: 1200 });
      } finally {
        await handle.dispose();
      }
    }
    report.touchFeedback.push({ scenario: name, control: await control.innerText(), rest, pressed });
  }
}

async function inspectVisiblePage(label) {
  const result = await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' &&
        !element.closest('details:not([open])');
    };
    const unnamed = [...document.querySelectorAll('button,[role="button"],input:not([type="hidden"]),select,textarea,[role="checkbox"],[role="radio"]')]
      .filter(visible).filter(element => {
        const labelledBy = element.getAttribute('aria-labelledby');
        const hasLabel = element.getAttribute('aria-label') || element.getAttribute('title') ||
          (labelledBy && document.getElementById(labelledBy)?.innerText) ||
          (element.labels && [...element.labels].some(label => label.innerText.trim())) ||
          (element.matches('button,[role="button"]') && element.textContent?.trim());
        return !hasLabel;
      }).map(element => ({ tag: element.tagName, type: element.getAttribute('type'), id: element.id, role: element.getAttribute('role'),
        html: element.outerHTML.slice(0, 300) })).slice(0, 20);
    const overflowing = [...document.querySelectorAll('.app-shell,main,.app-main,.app-content-width,.app-bottom-nav')]
      .filter(visible).map(element => ({ selector: element.className?.toString().slice(0, 80) || element.tagName,
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
      .filter(item => item.scrollWidth > item.clientWidth + 1);
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth, unnamed, overflowing };
  });
  const overflow = result.documentWidth > result.viewport + 1 || result.bodyWidth > result.viewport + 1 || result.overflowing.length > 0;
  report.overflow.push({ screen: label, ...result, status: overflow ? 'FAIL' : 'PASS' });
  report.accessibility.push({ screen: label, unnamedControls: result.unnamed, status: result.unnamed.length ? 'FAIL' : 'PASS' });
  assert.equal(overflow, false, `${label} horizontal overflow: ${JSON.stringify(result)}`);
  assert.deepEqual(result.unnamed, [], `${label} has visible controls without accessible names`);
}

async function verifyProtectedRows() {
  const state = await page.evaluate(async () => {
    const db = await import('/src/db.ts');
    const [tasks, transactions, budgets, savings, habits, goals] = await Promise.all([
      db.StorageService.tasks.getAll(), db.StorageService.transactions.getAll(), db.StorageService.budgets.getAll(),
      db.StorageService.savings.getGoals(), db.StorageService.habits.getAll(), db.StorageService.goals.getAll(),
    ]);
    const milestones = goals[0] ? await db.StorageService.goals.getMilestones(goals[0].id) : [];
    const raw = await Promise.all(['tasks', 'transactions', 'budgets', 'savingsGoals', 'habits', 'goals', 'milestones']
      .map(name => db.lifeOSDatabase.table(name).toArray()));
    const quantityHabit = habits.find(habit => habit.name === 'QA acceptance: drink water');
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const quantityLog = quantityHabit ? (await db.StorageService.habits.getLogs(quantityHabit.id)).find(log => log.date === todayKey) : undefined;
    return { counts: [tasks.length, transactions.length, budgets.length, savings.length, habits.length, goals.length, milestones.length],
      ciphertext: raw.flat().every(row => row.__lifeosEncrypted === 1 && row.value === undefined),
      records: { task: tasks[0]?.title, transactionMinor: transactions[0]?.amountMinor, budgetMinor: budgets[0]?.amountMinor,
        savingsMinor: savings[0]?.targetAmountMinor, habit: habits[0]?.name, quantitativeHabit: quantityHabit?.name,
        quantityTarget: quantityHabit?.targetPerDay, quantityUnit: quantityHabit?.quantityUnit,
        quantity: quantityLog?.quantity, quantityCompleted: quantityLog?.completed, goal: goals[0]?.title, milestone: milestones[0]?.title } };
  });
  assert.deepEqual(state.counts, [1, 1, 1, 1, 2, 1, 1]);
  assert.equal(state.ciphertext, true, 'all private records must remain encrypted at rest');
  assert.equal(state.records.task, 'QA acceptance: review weekly plan');
  assert.equal(state.records.transactionMinor, '12550');
  assert.equal(state.records.budgetMinor, '100000');
  assert.equal(state.records.savingsMinor, '500000');
  assert.equal(state.records.habit, 'QA acceptance: read ten pages');
  assert.equal(state.records.quantitativeHabit, 'QA acceptance: drink water');
  assert.equal(state.records.quantityTarget, 4);
  assert.equal(state.records.quantityUnit, 'glass');
  assert.equal(state.records.quantity, 1);
  assert.equal(state.records.quantityCompleted, false);
  assert.equal(state.records.goal, 'QA acceptance: finish one course');
  assert.equal(state.records.milestone, 'QA acceptance: finish first module');
}

async function main() {
  try { report.commit = require('node:child_process').execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* evidence still remains useful */ }
  const origin = await startVite();
  const edge = process.env.LIFEOS_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
  browser = await chromium.launch({ ...(edge ? { executablePath: edge } : {}), headless: true, timeout: 30_000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce', acceptDownloads: false, isMobile: touchReview, hasTouch: touchReview });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    report.networkBlocked.push(url); return route.abort();
  });
  if (process.env.LIFEOS_ACTION_AUDIT === '1') {
    await context.exposeBinding('__recordLifeOSControl', (_, action) => {
      const state = action.scope + ' / ' + currentJourney;
      const group = report.auditedControls[state] ??= {};
      for (const control of action.controls ?? []) {
        const { key, ...details } = control;
        group[key] = { ...group[key], ...details };
      }
      if (action.event) report.controlActions.push({ journey: currentJourney, ...action });
    });
    await context.addInitScript(() => {
      const selector = 'button,select,details,summary,input,textarea,a[href],[role=button],[role=menuitem],[role=combobox],[role=tab],[role=switch],[role=checkbox],[role=slider]';
      const label = el => el.getAttribute('aria-label') || el.getAttribute('title') ||
        [...(el.labels ?? [])].map(label => label.innerText).join(' ') ||
        el.textContent.trim() || el.getAttribute('placeholder') || el.getAttribute('type') || '(unnamed)';
      const scope = () => {
        const dialogs = [...document.querySelectorAll('dialog[open],[role=dialog]:not([aria-hidden=true])')];
        const active = dialogs.findLast(node => node.getClientRects().length) ||
          document.querySelector('.profile-track-page,.ui-tab-screen:not([hidden]):not([inert])');
        return active?.getAttribute('aria-label') || active?.querySelector('h1,h2')?.textContent || active?.id || location.pathname;
      };
      const describe = el => {
        const name = label(el).trim().replace(/\s+/g, ' ').slice(0, 150);
        const type = el.getAttribute('role') || el.tagName.toLowerCase();
        const disabled = el.matches(':disabled,[aria-disabled=true]');
        return { key: type + ' / ' + name, type, name, disabled };
      };
      const safe = () => !document.querySelector('[data-sensitive-recovery-code],#recovery-code-confirmation');
      const visible = el => !el.closest('[inert],[aria-hidden=true],dialog:not([open])') && el.getClientRects().length && getComputedStyle(el).visibility === 'visible';
      let timer;
      function inventory() {
        if (!safe()) return;
        window.__recordLifeOSControl({ scope: scope(), controls: [...document.querySelectorAll(selector)].filter(visible).map(describe) }).catch(() => {});
      }
      new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(inventory, 110);
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'hidden', 'inert', 'aria-hidden', 'aria-expanded', 'aria-current', 'disabled'] });
      for (const event of ['click', 'change', 'submit']) window.addEventListener(event, hit => {
        const el = hit.target instanceof Element && hit.target.closest(selector + ',form');
        if (!el || !safe()) return;
        window.__recordLifeOSControl({ scope: scope(), event, control: describe(el) }).catch(() => {});
      }, true);
    });
  }
  page = await context.newPage(); page.setDefaultTimeout(12_000); page.setDefaultNavigationTimeout(30_000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  const completed = new Set();
  try {
    await journey('first launch and safe browsing', async () => {
      await page.goto(`${origin}/tests/browser/index.html?onboarding-auth=success${(process.env.LIFEOS_EXPERIENCE_GATE === '1' || process.env.LIFEOS_FINALIZATION_GATE === '1') ? '&qa-native-back=enabled' : ''}`, { waitUntil: 'networkidle' });
      await page.locator('input[autocomplete="nickname"]').fill('Synthetic acceptance user');
      await capture('welcome-390');
      await clickButton('Continue');
      await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor();
      await capture('onboarding-notifications-390');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-notification-consent')), null);
      await clickButton('Allow notifications');
      await page.getByText('Notifications allowed', { exact: true }).waitFor();
      await capture('onboarding-precise-reminders-390');
      await clickButton('Enable precise reminders');
      await page.getByText(/Without it, reminders may arrive late/).waitFor();
      await clickButton('Enable precise reminders');
      await page.evaluate(() => {
        sessionStorage.setItem('qa-exact-alarm', 'true');
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.getByText('Precise reminders enabled', { exact: true }).waitFor();
      await clickButton('Continue');
      await page.getByRole('heading', { name: 'Biometric setup' }).waitFor();
      await capture('biometric-390');
      await clickButton('Not now');
      await page.getByRole('heading', { name: 'Recovery setup' }).waitFor();
      await capture('recovery-390');
      await clickButton('Review deferral');
      await capture('recovery-deferral-390');
      await clickButton('Do this later');
      await page.getByTestId('today-dashboard').waitFor();
      const categories = await page.evaluate(async () => {
        const { StorageService } = await import('/src/db.ts');
        return StorageService.settings.get('notificationPreferences', null);
      });
      assert.deepEqual(categories, { taskReminders: true, upcomingDeadlines: true, overdueAlerts: false, habitReminders: true, milestoneReminders: true });
      const storage = await page.evaluate(async () => {
        const db = await import('/src/db.ts');
        return { active: db.isEncryptedStorageActivated(),
          privateCount: await db.lifeOSDatabase.tasks.count() };
      });
      assert.deepEqual(storage, { active: false, privateCount: 0 }, 'welcome opens safe browsing without private storage');
      await page.getByText('Notifications enabled', { exact: true }).waitFor({ state: 'hidden' });
      completed.add('first launch and safe browsing');
    });


    if (process.env.LIFEOS_FINALIZATION_GATE === '1') {
      await journey('finalization navigation, period and help', async () => {
        const nav = page.getByRole('navigation', { name: 'Main navigation' });
        assert.deepEqual(await nav.getByRole('button').allTextContents(), ['Today', 'Money', 'Plan', 'Profile']);
        await page.getByRole('heading', { name: 'LifeOS', exact: true }).waitFor();
        await capture('today-four-tabs', false);
        await activeTab('finance');
        await page.getByRole('heading', { name: 'Money', exact: true }).waitFor();
        const money = page.getByRole('navigation', { name: 'Money destinations' });
        assert.deepEqual(await money.getByRole('button').allTextContents(), ['Transactions', 'Accounts', 'Budgets', 'Savings', 'Insights', 'Schedule']);
        await page.getByRole('heading', { name: 'Activity', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Add transaction', exact: true }).count(), 0);
        await capture('money-home-four-tabs', false);
        const period = page.locator('button.money-period-control:visible');
        await period.click();
        const picker = page.getByRole('dialog', { name: 'Reporting period' });
        await picker.getByRole('button', { name: 'Next year' }).click();
        await capture('month-picker', false);
        await picker.getByRole('button', { name: 'December', exact: true }).click();
        assert.match(await period.innerText(), /December/);
        assert.equal(await period.evaluate(element => document.activeElement === element), true);
        const help = page.getByRole('button', { name: 'About Net cash flow' });
        await help.click();
        const sheet = page.getByRole('dialog', { name: 'Net cash flow' });
        await sheet.getByRole('heading', { name: 'Simple example' }).waitFor();
        await sheet.getByRole('heading', { name: 'How LifeOS uses it' }).waitFor();
        await capture('money-info-sheet', false);
        const androidBack = () => page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-app-backButton', { detail: { canGoBack: true } })));
        await androidBack();
        await sheet.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'About Net cash flow');
        await money.getByRole('button', { name: 'Transactions' }).click();
        await page.getByRole('heading', { name: 'Transactions' }).waitFor();
        await page.getByText('Money in', { exact: true }).waitFor();
        await capture('transactions-empty', false);
        await nav.getByRole('button', { name: 'Profile' }).click();
        await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
        assert.equal(await nav.getByRole('button', { name: 'Profile' }).getAttribute('aria-current'), 'page');
        await capture('profile-four-tabs', false);
        await androidBack();
        await page.getByRole('heading', { name: 'Transactions' }).waitFor();
        await nav.getByRole('button', { name: 'Profile' }).click();
        await nav.getByRole('button', { name: 'Plan' }).click();
        await page.getByRole('heading', { name: 'Plan', exact: true }).waitFor();
        await capture('plan-four-tabs', false);
        await activeTab('finance');
        await nav.getByRole('button', { name: 'Money' }).click();
        await money.getByRole('button', { name: 'Schedule' }).click();
        await page.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
        await capture('schedule-four-tabs', false);
        if (process.env.LIFEOS_PROFILE_AUDIT === '1') {
          await nav.getByRole('button', { name: 'Profile', exact: true }).click();
          const surfaces = [
            ['Profile', []], ['Appearance', ['Appearance']], ['Themes', ['Appearance', 'Themes']],
            ['Accent color', ['Appearance', 'Accent color']], ['Preferences', ['Preferences']],
            ['Motion', ['Appearance', 'Motion']], ['Notifications', ['Notifications']],
            ['Privacy & security', ['Privacy & Security']], ['App lock', ['Privacy & Security', 'App lock']],
            ['Recovery', ['Privacy & Security', 'Recovery']], ['Backup & Restore', ['Backup & Restore']],
            ['About LifeOS', ['About']], ['Open-source licenses', ['About', 'Open-source licenses']],
            ['Developer tools', ['Developer tools']],
          ];
          report.profileGeometry = [];
          for (const [title, path] of surfaces) {
            await nav.getByRole('button', { name: 'Profile', exact: true }).click();
            for (const item of path) await clickButton(new RegExp("^" + item));
            await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
            const geometry = await page.evaluate(() => {
              const header = document.querySelector('.primary-masthead').getBoundingClientRect();
              const content = document.querySelector('#screen-settings .profile-settings').getBoundingClientRect();
              return { headerHeight: header.height, contentTop: content.top, overflow: document.documentElement.scrollWidth - innerWidth };
            });
            assert.ok(geometry.contentTop - geometry.headerHeight < 36 && geometry.overflow < 2, title + ' layout');
            report.profileGeometry.push({ title, ...geometry });
            const name = 'profile-audit-' + title.toLowerCase().replace(/[^a-z]+/g, '-');
            await capture(name, false);
            await page.setViewportSize({ width: 320, height: 844 });
            await page.evaluate(() => document.documentElement.style.fontSize = '125%');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), title + ' enlarged width');
            await capture(name + '-large', false);
            await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
            await page.setViewportSize({ width: 390, height: 844 });
          }
        }
      });
      return;
    }

    if (process.env.LIFEOS_EXPERIENCE_GATE === '1') {
      await journey('reconstruction interaction gate', async () => {
        await activeTab('plan');
        await clickButton('Add task');
        await fillDialogField('Task title', 'Synthetic draft');
        const disclosure = dialog().getByRole('button', { name: 'Notes and subtasks', exact: true });
        assert.equal(await disclosure.getAttribute('aria-expanded'), 'false');
        await disclosure.click();
        await fillDialogField('Notes', 'Keep this when collapsing');
        await disclosure.click();
        await disclosure.click();
        assert.equal(await dialog().getByLabel('Notes').inputValue(), 'Keep this when collapsing');
        const priority = dialog().getByRole('button', { name: /^Priority/ });
        await priority.click();
        const sheet = page.locator('dialog[data-preference-choice][open]');
        await sheet.getByRole('option', { name: 'High', exact: true }).click();
        await sheet.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement?.textContent.includes('High'));
        await priority.click();
        await page.keyboard.press('Escape');
        await sheet.waitFor({ state: 'hidden' });
        assert.equal(await dialog().getByLabel('Task title').inputValue(), 'Synthetic draft');
        await capture('task-disclosure-390', false);
        await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
        const discard = page.getByRole('alertdialog');
        if (await discard.isVisible()) await discard.getByRole('button', { name: /Discard/ }).click();
        await dialog().waitFor({ state: 'hidden' });
        await activeTab('finance');
        await capture('money-overview-390', false);
        await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Accounts' }).click();
        await clickButton('Add account');
        const currency = dialog().getByRole('button', { name: 'Currency', exact: true });
        await currency.click();
        const search = sheet.getByRole('searchbox', { name: 'Search currencies' });
        await search.fill('unmatched synthetic option');
        await sheet.getByText('No matching options.', { exact: true }).waitFor();
        await search.fill('JPY');
        await search.press('ArrowDown');
        assert.equal(await sheet.locator('button[data-option-value="JPY"]').evaluate(button => button === document.activeElement), true);
        await capture('choice-search-390', false);
        await sheet.locator('button[data-option-value="JPY"]').click();
        await sheet.waitFor({ state: 'hidden' });
        assert.equal(await currency.evaluate(button => button.closest('[data-choice-field]').getAttribute('data-choice-value')), 'JPY');
        await dialog().getByRole('button', { name: 'Add account', exact: true }).click();
        await dialog().getByText('Complete the highlighted field.', { exact: true }).waitFor();
        const name = dialog().getByLabel('Account name');
        assert.ok(await name.evaluate(element => element === document.activeElement));
        assert.equal(await page.locator('select').count(), 0);
        await currency.click();
        const list = sheet.locator('.choice-options');
        const scroll = await list.evaluate(node => { node.scrollTop = node.scrollHeight; return { top: node.scrollTop, height: node.clientHeight }; });
        assert.ok(scroll.top > 0 && scroll.height > 44, 'the long currency catalog scrolls within the sheet');
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-app-backButton', { detail: { canGoBack: true } })));
        await sheet.waitFor({ state: 'hidden' });
        await currency.waitFor();
        assert.equal(await currency.evaluate(button => button === document.activeElement), true);
        assert.equal(await currency.evaluate(button => button.closest('[data-choice-field]').getAttribute('data-choice-value')), 'JPY');
        await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
        if (await discard.isVisible()) await discard.getByRole('button', { name: /Discard/ }).click();
        await dialog().waitFor({ state: 'hidden' });
        await clickButton('Profile');
        await clickButton('Appearance');
        await clickButton('Dark');
        await activeTab('finance');
        await clickButton('Add account');
        await dialog().getByRole('button', { name: 'Currency', exact: true }).click();
        await capture('choice-dark-390', false);
        await page.keyboard.press('Escape');
        await sheet.waitFor({ state: 'hidden' });

      });
      return;
    }

    if (process.env.LIFEOS_FEATHER_GATE === '1') {
      await journey('Feather rendered comparison', async () => {
        const captureScreen = name => capture(name, false);
        await captureScreen('today');
        await activeTab('finance');
        await captureScreen('money');
        await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Schedule', exact: true }).click();
        await captureScreen('scheduled');
        await activeTab('plan');
        await page.getByRole('navigation', { name: 'Plan destinations' }).waitFor();
        await captureScreen('plan');
        const layouts = [];
        for (const [tab, action, label, key] of [['Tasks','Add task','Task title','task'], ['Habits','Add habit','Habit name','habit'], ['Goals','Add goal','Goal title','goal']]) {
          await planDestination(tab);
          await clickButton(action, { exact: false });
          await dialog().getByLabel(label).waitFor();
          const geometry = () => dialog().evaluate(form => {
            const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
            return { form: box(form), header: box(form.querySelector('header') || form.firstElementChild),
              field: box(form.querySelector('input')), footer: box(form.querySelector('.ui-form-actions')) };
          });
          layouts.push({ key, ...await geometry() });
          await captureScreen('composer-' + key);
          if (await dialog().locator('.feather-composer-content').count()) {
            await page.setViewportSize({ width: 390, height: 490 });
            await page.waitForFunction(() => {
              const actions = document.querySelector('#record-dialog .feather-composer-actions');
              return actions?.getBoundingClientRect().bottom <= window.innerHeight + 2;
            });
            const small = await geometry();
            assert.ok(small.footer.height && small.footer.y + small.footer.height <= 492, 'Footer stays above a shortened viewport');
            await page.setViewportSize({ width: 390, height: 844 });
            await page.waitForFunction(() => document.querySelector('#record-dialog')?.getBoundingClientRect().height >= 842);
          }
          await dialog().getByRole('button', { name: 'Close', exact: true }).click();
          await dialog().waitFor({ state: 'hidden' });
        }
        report.composers = layouts;
        if (layouts.every(layout => layout.form.height > 0) && await page.locator('.feather-expressive').count()) {
          for (const record of layouts.slice(1)) assert.deepEqual(Object.fromEntries(['form','header','field','footer'].map(key => [key,record[key]])),
            Object.fromEntries(['form','header','field','footer'].map(key => [key,layouts[0][key]])), 'All three composers share geometry');
        }
        await clickButton('Add goal', { exact: false });
        await fillDialogField('Goal title', 'Finish one course');
        await dialog().getByLabel('Target', { exact: true }).fill('10');
        await dialog().getByRole('button', { name: 'Add goal', exact: true }).click();
        await clickButton('Protect this device and save');
        await page.getByRole('button', { name: /^Finish one course/ }).click();
        await page.getByRole('heading', { name: 'Finish one course' }).waitFor();
        await page.locator('.ui-toast').waitFor({ state: 'hidden' });
        await captureScreen('detail');
        await clickButton('Profile');
        await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
        await captureScreen('profile');
      });
      return;
    }

    await journey('primary tab navigation and details', async () => {
      for (const [tab, label] of [['dashboard', 'today'], ['finance', 'money'], ['plan', 'plan']]) {
        await activeTab(tab);
        if (tab === 'plan') await page.getByRole('navigation', { name: 'Plan destinations' }).waitFor();
        await inspectVisiblePage(`${label}-empty`); await capture(`${label}-empty-390`);
      }
      await activeTab('finance');
      await page.getByTestId('money-home').getByRole('button', { name: /^Budgets/ }).click();
      await page.getByRole('heading', { name: 'Budgets', exact: true }).waitFor();
      await clickButton('Money overview');
      await page.getByTestId('money-home').waitFor();
      await activeTab('plan');
      assert.equal(await page.getByRole('button', { name: 'Open calendar' }).count(), 0);
      assert.equal(await page.locator('[data-tab="plan"]').getAttribute('aria-current'), 'page');
      assert.deepEqual(await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button').allTextContents(), ['Today', 'Money', 'Plan', 'Profile']);
      await planDestination('Habits');
      await page.getByRole('button', { name: /Add habit/ }).waitFor();
      await capture('habits-empty-390');
      await planDestination('Goals');
      await capture('goals-empty-390');
      await activeTab('finance');
      await clickButton('View monthly summary');
      await page.getByRole('heading', { name: 'Monthly summary', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Savings contributions' }).waitFor();
      await capture('monthly-overview-390');
      await clickButton('Money overview');
      completed.add('primary tab navigation and details');
    });

    await journey('create and complete a task', async () => {
      await activeTab('plan');
      const views = page.getByRole('group', { name: 'Task views' }).getByRole('button');
      assert.match(await views.first().innerText(), /^All/);
      assert.equal(await views.first().getAttribute('aria-pressed'), 'true');
      await clickButton('Add task');
      await fillDialogField('Task title', 'QA acceptance: review weekly plan');
      const footerAtBottom = await dialog().getByRole('button', { name: 'Add task', exact: true }).evaluate(button =>
        innerHeight - button.getBoundingClientRect().bottom < 36,
      );
      assert.equal(footerAtBottom, true, 'the primary action stays at the bottom of a short composer');
      await capture('task-composer-390');
      await dialog().locator('button[type=submit]').click();
      await page.getByRole('dialog', { name: 'Protect your personal data' }).waitFor();
      await clickButton('Protect this device and save');
      await page.waitForFunction(async () => {
        const db = await import('/src/db.ts');
        return db.isEncryptedStorageActivated();
      });
      await page.getByRole('button', { name: /QA acceptance: review weekly plan/ }).waitFor();
      const taskToggle = page.getByRole('checkbox', { name: 'Mark QA acceptance: review weekly plan complete' });
      await taskToggle.click();
      await page.waitForFunction(async title => {
        const db = await import('/src/db.ts');
        const tasks = await db.StorageService.tasks.getAll();
        return tasks.some(task => task.title === title && task.completed);
      }, 'QA acceptance: review weekly plan');
      await clickButton('Filters');
      const filters = page.getByRole('dialog', { name: 'Task filters' });
      await chooseOption(filters, 'Status', 'completed');
      await chooseOption(filters, 'Priority', 'Medium');
      await capture('plan-filters-390');
      await clickButton('Apply filters');
      await page.getByRole('button', { name: 'Filters (2)' }).waitFor();
      const completedToggle = page.getByRole('checkbox', { name: 'Mark QA acceptance: review weekly plan incomplete' });
      await completedToggle.waitFor();
      assert.equal(await completedToggle.isChecked(), true, 'completed task is shown checked in the completed filter');
      await capture('plan-task-complete-390');
      if (process.env.LIFEOS_PROFILE_AND_PRESS_REVIEW === '1') {
        const target = page.locator('.plan-hub-task-open:visible').first();
        const box = await target.boundingBox();
        await capture('plan-press-rest-390', false);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        const pressed = await target.evaluate(element => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow }));
        assert.equal(pressed.transform, 'none');
        assert.notEqual(pressed.shadow, 'none');
        await capture('plan-press-active-390', false);
        await page.mouse.move(2, 2);
        await page.mouse.up();
      }
      completed.add('create and complete a task');
    });

    await journey('create a posted expense and budget', async () => {
      await activeTab('finance');
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Transactions', exact: true }).click();
      await clickButton('Add transaction', { exact: true });
      await fillDialogField('Amount', '125.50');
      await fillDialogField('Merchant or description', 'QA acceptance: expense');
      await capture('add-transaction-composer-390');
      await chooseOption(dialog(), 'Category', { index: 1 });
      if (process.env.LIFEOS_SNACKBAR_REVIEW === '1') {
        const amount = await fillDialogField('Amount', '90071992547409912.37');
        assert.equal(await amount.evaluate(input => input.validity.valid), true, 'the browser delegates precision to the ledger');
        await dialog().getByRole('button', { name: 'Add transaction', exact: true }).click();
        const error = page.locator('.lifeos-snackbar').getByRole('alert');
        await error.getByText('Amount is too large to store safely at this currency precision.').waitFor();
        const box = await page.locator('.lifeos-snackbar').boundingBox();
        const footer = await dialog().locator('.feather-composer-actions').boundingBox();
        assert.ok(footer.y - box.y - box.height >= 10 && footer.y - box.y - box.height <= 20);
        assert.ok(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.lifeos-snackbar'), { x: box.x + box.width / 2, y: box.y + box.height / 2 }), 'the snackbar paints above the composer');
        await capture('transaction-error-snackbar-390', false);
        await amount.fill('125.50');
      }
      await saveDialog('Add transaction');
      const snackbar = page.locator('.lifeos-snackbar').getByRole('status');
      await snackbar.getByText('Transaction recorded', { exact: true }).waitFor();
      const notice = page.locator('.lifeos-snackbar');
      const noticeBottom = (await notice.boundingBox()).y + (await notice.boundingBox()).height;
      const navigationTop = (await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox()).y;
      assert.ok(navigationTop - noticeBottom >= 10 && navigationTop - noticeBottom <= 20);
      await capture('transaction-recorded-snackbar-390', false);
      await notice.getByRole('button', { name: 'Dismiss message' }).click();
      await notice.waitFor({ state: 'hidden' });
      await capture('transactions-populated-390', false);
      await page.locator('[data-tab="finance"]').click();
      await page.getByText('QA acceptance: expense', { exact: true }).waitFor();
      await page.getByTestId('money-home').getByRole('button', { name: /^Budgets/ }).click();
      await clickButton('Add budget', { exact: false });
      await fillDialogField('Monthly limit', '1000');
      await capture('add-budget-composer-390');
      await saveDialog('Add budget');
      const budgetState = await page.evaluate(async () => {
        const db = await import('/src/db.ts');
        const rows = await db.StorageService.budgets.getAll();
        return rows.map(row => row.amountMinor);
      });
      assert.deepEqual(budgetState, ['100000'], 'budget saves exact monthly minor units');
      await capture('money-budget-populated-390');
      await clickButton('Money overview');
      const netCashflowInfo = page.locator('button[aria-label="About Net cash flow"]:visible').last();
      await netCashflowInfo.waitFor();
      const infoDialog = page.locator(await netCashflowInfo.evaluate(button => `#${CSS.escape(button.getAttribute('aria-controls'))}`));
      assert.equal(await infoDialog.evaluate(element => element.open), false, 'contextual information starts closed');
      assert.equal(await page.getByText('Net cash flow is money in minus money out.', { exact: false }).isVisible().catch(() => false), false,
        'the full explanation is hidden from the default screen');
      await capture('info-net-cashflow-hidden-390');
      await netCashflowInfo.click();
      await infoDialog.waitFor({ state: 'visible' });
      await page.getByText('Net cash flow is money in minus money out.', { exact: false }).waitFor();
      await capture('info-net-cashflow-open-390');
      await page.keyboard.press('Escape');
      await infoDialog.waitFor({ state: 'hidden' });
      assert.equal(await netCashflowInfo.evaluate(element => document.activeElement === element), true,
        'dismissal restores focus to the information control');
      await page.getByTestId('money-home').getByRole('button', { name: /^Insights/ }).click();
      await page.getByRole('heading', { name: 'Insights', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Expense categories' }).waitFor();
      assert.ok(await page.locator('.recharts-wrapper').count() > 0, 'real finance chart is rendered from the saved expense');
      await chooseOption(page, 'Time period', '3');
      assert.equal(await page.getByRole('button', { name: 'Time period', exact: true }).evaluate(button => button.closest('[data-choice-field]').getAttribute('data-choice-value')), '3');
      await capture('money-analytics-posted-390');
      assert.match(await page.locator('button.money-period-control:visible').getAttribute('aria-label'), /November 2026/,
        'period selector retains a full accessible month name');
      assert.equal(await page.locator('.money-period-value:visible').innerText(), 'November 2026',
        'period selector shows the full month label');
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForFunction(expected => innerWidth === expected, width);
        const ticks = await page.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').evaluateAll(nodes => {
          const chart = document.querySelector('.recharts-wrapper')?.getBoundingClientRect();
          return nodes.map(node => {
            const rect = node.getBoundingClientRect();
            return { label: node.textContent?.trim() || '', left: rect.left, right: rect.right,
              chartLeft: chart?.left ?? 0, chartRight: chart?.right ?? 0 };
          });
        });
        assert.ok(ticks.length > 0, `finance chart renders Y-axis labels at ${width}px`);
        assert.ok(ticks.every(tick => tick.label.startsWith('₹') && tick.left >= tick.chartLeft - 1 && tick.right <= tick.chartRight + 1),
          `currency labels fit within the chart at ${width}px: ${JSON.stringify(ticks)}`);
        const viewportWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(viewportWidth <= width + 1, `analytics page has no horizontal overflow at ${width}px`);
        await inspectVisiblePage(`analytics-${width}`);
        await capture(`money-analytics-${width}`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      completed.add('create a posted expense and budget');
    });

    await journey('create a savings goal and contribution', async () => {
      await activeTab('finance');
      if (!(await page.getByTestId('money-home').count())) await clickButton('Money overview');
      await page.getByTestId('money-home').getByRole('button', { name: /^Savings/ }).click();
      await clickButton('Add goal', { exact: false });
      await fillDialogField('Goal title', 'QA acceptance: emergency reserve');
      await fillDialogField('Target amount', '5000');
      await capture('add-savings-composer-390');
      await saveDialog('Add savings goal');
      await clickButton('Edit QA acceptance: emergency reserve');
      await capture('edit-savings-composer-390');
      await saveDialog('Save changes');
      await clickButton('Add contribution');
      await fillDialogField('Amount', '100');
      await capture('add-contribution-composer-390');
      await saveDialog('Add savings contribution');
      const savingsState = await page.evaluate(async () => {
        const db = await import('/src/db.ts');
        const goals = await db.StorageService.savings.getGoals();
        const contributions = await db.StorageService.savings.getContributions();
        return { savedMinor: goals[0]?.currentAmountMinor, contributionMinor: contributions[0]?.amountMinor };
      });
      assert.deepEqual(savingsState, { savedMinor: '10000', contributionMinor: '10000' }, 'contribution updates the savings goal in exact minor units');
      await capture('money-savings-populated-390');
      completed.add('create a savings goal and contribution');
    });

    await journey('create and check in a habit', async () => {
      await planDestination('Habits'); await clickButton('Add habit', { exact: false });
      await fillDialogField('Habit name', 'QA acceptance: read ten pages');
      await saveDialog('Add habit');
      const checkIn = page.getByRole('button', { name: 'Mark QA acceptance: read ten pages complete' });
      await checkIn.click();
      const undoCheckIn = page.getByRole('button', { name: 'Mark QA acceptance: read ten pages incomplete' });
      await undoCheckIn.waitFor();
      assert.equal(await undoCheckIn.getAttribute('aria-pressed'), 'true', 'Plan reflects the saved habit check-in');
      await page.getByRole('button', { name: /^QA acceptance: read ten pages/ }).click();
      await page.getByRole('heading', { name: 'QA acceptance: read ten pages' }).waitFor();
      await capture('life-habit-detail-390');
      await clickButton('Back to list');
      await clickButton('Add habit', { exact: false });
      await fillDialogField('Habit name', 'QA acceptance: drink water');
      await chooseOption(dialog(), 'Progress tracking', 'quantity');
      await fillDialogField('Daily quantity target', '4');
      await fillDialogField('Unit', 'glasses');
      await capture('add-habit-composer-390');
      await saveDialog('Add habit');
      await page.getByRole('button', { name: /^QA acceptance: drink water/ }).click();
      await page.getByRole('heading', { name: 'QA acceptance: drink water' }).waitFor();
      await page.getByText('0 / 4 glasses', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Add one glass to QA acceptance: drink water' }).click();
      await page.getByText('1 glass / 4 glasses', { exact: true }).waitFor();
      await capture('life-quantity-habit-detail-390');
      await page.getByRole('button', { name: 'Decrease QA acceptance: drink water quantity' }).click();
      await page.getByText(/^0(?: glasses?)? \/ 4 glasses$/).waitFor();
      await page.getByRole('button', { name: 'Add one glass to QA acceptance: drink water' }).click();
      await page.getByText('1 glass / 4 glasses', { exact: true }).waitFor();
      completed.add('create and check in a habit');
    });

    await journey('create a goal, milestone and progress update', async () => {
      await clickButton('Back to list');
      await planDestination('Goals'); await clickButton('Add goal', { exact: false });
      await fillDialogField('Goal title', 'QA acceptance: finish one course');
      await dialog().getByLabel('Target', { exact: true }).fill('10');
      assert.equal(await dialog().getByLabel('Target date', { exact: true }).inputValue(), '');
      await capture('add-goal-composer-390');
      await saveDialog('Add goal');
      await page.getByRole('button', { name: /^QA acceptance: finish one course/ }).click();
      await page.getByRole('heading', { name: 'QA acceptance: finish one course' }).waitFor();
      await page.getByText('Open-ended', { exact: true }).waitFor();
      await clickButton('Edit goal');
      await dialog().getByRole('button', { name: 'Target date and notes' }).click();
      await fillDialogField('Target date', '2026-12-31');
      await saveDialog('Save changes');
      await clickButton('Edit goal');
      await dialog().getByRole('button', { name: 'Target date and notes' }).click();
      const deadline = dialog().getByLabel('Target date', { exact: true });
      assert.equal(await deadline.inputValue(), '2026-12-31');
      await deadline.fill('');
      await saveDialog('Save changes');
      await page.getByText('Open-ended', { exact: true }).waitFor();
      await clickButton('+ Milestone');
      await fillDialogField('Milestone title', 'QA acceptance: finish first module');
      await capture('add-milestone-composer-390');
      await saveDialog('Add goal milestone');
      const milestoneToggle = page.locator('section[aria-labelledby="goal-detail-title"] label').filter({ hasText: 'QA acceptance: finish first module' }).locator('input[type="checkbox"]');
      await milestoneToggle.waitFor();
      await milestoneToggle.focus();
      await milestoneToggle.press('Space');
      await page.waitForFunction(async () => {
        const db = await import('/src/db.ts');
        const goals = await db.StorageService.goals.getAll();
        const milestones = goals[0] ? await db.StorageService.goals.getMilestones(goals[0].id) : [];
        return milestones.some(item => item.title === 'QA acceptance: finish first module' && item.completed);
      });
      await page.getByText('1 of 1 complete', { exact: true }).waitFor();
      await clickButton('Update progress');
      await fillDialogField('Current progress', '4');
      await capture('goal-progress-composer-390');
      await saveDialog('Save changes');
      await page.getByRole('progressbar', { name: 'QA acceptance: finish one course progress' }).waitFor();
      await capture('life-goal-detail-390');
      await clickButton('Pause goal');
      await page.getByRole('button', { name: 'Resume goal', exact: true }).waitFor();
      await clickButton('Resume goal');
      await page.getByRole('button', { name: 'Pause goal', exact: true }).waitFor();
      completed.add('create a goal, milestone and progress update');
    });

    await journey('back navigation and ciphertext persistence', async () => {
      await clickButton('Back to list');
      await page.getByRole('heading', { name: 'Goals', exact: true }).waitFor();
      await planDestination('Tasks');
      await activeTab('dashboard');
      await page.getByTestId('today-dashboard').waitFor();
      await activeTab('finance');
      if (!(await page.getByTestId('money-home').count())) await clickButton('Money overview');
      await page.getByTestId('money-home').waitFor();
      await verifyProtectedRows();
      completed.add('back navigation and ciphertext persistence');
    });

    await journey('timed task and early reminder persist through edit and deletion', async () => {
      await activeTab('plan');
      const filterButton = page.getByRole('button', { name: /^Filters/ });
      await filterButton.click();
      await clickButton('Clear filters');
      await clickButton('Apply filters');
      await clickButton('Add task');
      const title = 'QA acceptance: timed task';
      await fillDialogField('Task title', title);
      await dialog().getByRole('button', { name: /^Schedule/ }).click();
      await fillDialogField('Due date', '2099-04-22');
      await dialog().getByLabel('Time', { exact: true }).fill('19:36');
      await dialog().getByRole('button', { name: /^Reminder/ }).click();
      await dialog().getByRole('button', { name: /^Extra reminder/ }).click();
      await page.getByRole('dialog', { name: 'Extra reminder' }).getByRole('option', { name: '15 minutes before' }).click();
      await capture('task-timed-composer-390');
      await saveDialog('Add task');
      const stored = () => page.evaluate(async name => {
        const {StorageService} = await import('/src/db.ts');
        return (await StorageService.tasks.getAll()).find(row => row.title === name);
      }, title);
      const first = await stored();
      assert.equal(first.dueTime, '19:36');
      assert.equal(first.reminderLeadMinutes, 15);
      assert.equal(first.dueAlertDisabled, false);
      await page.getByRole('button', { name: new RegExp(title) }).click();
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      await capture('task-timed-detail-390');
      await clickButton('Edit task');
      await dialog().getByRole('button', { name: /^Reminder/ }).click();
      await dialog().getByLabel('Alert at due time').uncheck();
      await saveDialog('Save changes');
      assert.equal((await stored()).dueAlertDisabled, true);
      await clickButton('Delete task');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete task', exact: true }).click();
      await page.waitForFunction(async name => {
        const {StorageService} = await import('/src/db.ts');
        return !(await StorageService.tasks.getAll()).some(row => row.title === name);
      }, title);
    });

    await journey('Money swipe cancellation and repeated navigation', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await activeTab('finance');
      const cdp = await context.newCDPSession(page);
      try {
        const cash = page.locator('.money-flow-split');
        await cash.scrollIntoViewIfNeeded();
        const box = await cash.boundingBox();
        assert.ok(box);
        const y = Math.round(box.y + box.height / 2);
        const touch = (type, xs) => cdp.send('Input.dispatchTouchEvent', {
          type, touchPoints: xs.map((x, id) => ({ x, y, id })),
        });
        const swipe = async (points, end = 'touchEnd') => {
          await touch('touchStart', [points[0]]);
          for (const x of points.slice(1)) await touch('touchMove', [x]);
          await touch(end, []);
        };
        const atRest = () => page.waitForFunction(() => {
          const screen = document.querySelector('#screen-finance');
          return screen && !screen.hasAttribute('data-gesture-dragging') &&
            Math.abs(new DOMMatrix(getComputedStyle(screen).transform).m41) < 1;
        });
        await swipe([265, 245, 224, 269]);
        await atRest();
        await swipe([265, 220, 180], 'touchCancel');
        await atRest();
        await touch('touchStart', [265]);
        await touch('touchMove', [218]);
        await touch('touchStart', [218, 290]);
        await touch('touchCancel', []);
        await atRest();
        assert.equal(await page.locator('[data-tab="finance"]').getAttribute('aria-current'), 'page');
        await swipe([283, 240, 190, 120, 55]);
        await page.waitForFunction(() => document.querySelector('[data-tab="plan"]')?.getAttribute('aria-current') === 'page');
        await activeTab('finance');
        await atRest();
      } finally {
        await cdp.detach();
      }
    });

    await journey('Profile drawer focus, scroll and encrypted photo lifecycle', async () => {
      await activeTab('finance');
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Transactions', exact: true }).click();
      const opener = page.getByRole('button', { name: 'Profile' });
      const drawer = page.getByRole('region', { name: 'Profile and settings' });
      await opener.click();
      await drawer.waitFor();
      assert.ok(await drawer.evaluate(element => element.getBoundingClientRect().width <= innerWidth));
      assert.equal(await page.locator('#screen-finance').evaluate(element => element.inert), true);
      assert.equal(await page.locator('.app-main').evaluate(element => element.inert), false);
      assert.equal(await page.locator('[data-tab]').count(), 4);
      await drawer.getByRole('button', { name: 'Appearance' }).click();
      await drawer.getByRole('button', { name: 'Themes' }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('heading', { name: 'Appearance', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
      const upload = async (label, color, mimeType = 'image/png') => {
        const data = await page.evaluate(fill => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 12;
          const context = canvas.getContext('2d'); context.fillStyle = fill; context.fillRect(0, 0, 12, 12);
          return canvas.toDataURL().split(',')[1];
        }, color);
        const chooser = page.waitForEvent('filechooser');
        await drawer.getByRole('button', { name: label }).click();
        await (await chooser).setFiles({ name: 'synthetic-profile.png', mimeType, buffer: Buffer.from(data, 'base64') });
      };
      await upload('Choose photo', 'navy', 'text/plain');
      await page.getByText('Choose a JPEG, PNG, WebP or AVIF photo under 12 MB.').waitFor();
      await upload('Choose photo', 'navy');
      const image = drawer.locator('img.profile-avatar-image');
      await image.waitFor();
      const first = await image.getAttribute('src');
      await upload('Replace photo', 'gold');
      await page.waitForFunction(previous => document.querySelector('.profile-track-page .profile-avatar-image')?.getAttribute('src') !== previous, first);
      const replacement = await image.getAttribute('src');
      assert.notEqual(first, replacement);
      const persisted = await page.evaluate(async () => {
        const { StorageService, lifeOSDatabase, validateBackupTables } = await import('/src/db.ts');
        const { encryptBackup, decryptBackup } = await import('/src/services/backupCryptoService.ts');
        const exported = await StorageService.backup.exportData();
        const sealed = await encryptBackup(exported, 'Disposable-browser-passphrase-2026');
        const restored = JSON.parse(await decryptBackup(sealed, 'Disposable-browser-passphrase-2026'));
        validateBackupTables(restored.tables);
        const raw = await lifeOSDatabase.settings.get('profilePhoto');
        return { photo: restored.tables.settings.find(row => row.key === 'profilePhoto')?.value, rowIsEncrypted: raw?.__lifeosEncrypted === 1 && raw.value === undefined, ciphertextHasPhoto: sealed.includes('data:image/jpeg') };
      });
      assert.equal(persisted.photo, replacement);
      assert.equal(persisted.rowIsEncrypted, true);
      assert.equal(persisted.ciphertextHasPhoto, false);
      await page.keyboard.press('Escape');
      await drawer.waitFor({ state: 'hidden' });
      assert.ok(await opener.isVisible());
      await page.getByRole('button', { name: /View transaction QA acceptance:/ }).first().waitFor();
      await page.reload();
      await opener.click();
      assert.equal(await image.getAttribute('src'), replacement);
      await drawer.getByRole('button', { name: 'Remove photo' }).click();
      await image.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(async () => (await import('/src/db.ts')).StorageService.settings.get('profilePhoto', null)), null);
      await page.keyboard.press('Escape');
      await drawer.waitFor({ state: 'hidden' });
    });

    await journey('compact settings and six-month sample data', async () => {
      await clickButton('Profile');
      await page.getByTestId('profile-settings-home').waitFor();
      await capture('profile-390');
      for (const name of ['Appearance', 'Preferences', 'Notifications', 'Privacy & Security', 'Backup & Restore', 'About', 'Developer tools']) {
        await clickButton(new RegExp('^' + name));
        await page.getByRole('heading', { name: name === 'About' ? 'About LifeOS' : name === 'Privacy & Security' ? 'Privacy & security' : name, exact: true, level: 1 }).waitFor();
        await inspectVisiblePage(name);
        await capture(name.toLowerCase().replaceAll(' ', '-') + '-390');
        if (name === 'Developer tools') {
          await clickButton('Add sample data');
          await page.getByRole('alertdialog').getByRole('button', { name: 'Add sample data', exact: true }).click();
          await page.getByText('Sample data is ready').waitFor();
          const coverage = await page.evaluate(async () => {
            const { StorageService } = await import('/src/db.ts');
            const rows = (await StorageService.transactions.getAll()).filter(row => row.id.startsWith('lifeos-demo-v2:'));
            const months = new Set(rows.map(row => row.date.slice(0, 7)));
            return { months: months.size, transactions: rows.length };
          });
          assert.equal(coverage.months, 6);
          assert.ok(coverage.transactions >= 55);
          await activeTab('finance');
          await capture('money-sample-390');
          await clickButton('View monthly summary');
          await capture('monthly-overview-sample-390');
          await clickButton('Money overview');
          await planDestination('Habits');
          await capture('habits-sample-390');
          await planDestination('Goals');
          await capture('goals-sample-390');
          await clickButton('Profile');
          await clickButton('Developer tools');
          await clickButton('Remove sample data');
          await page.getByRole('alertdialog').getByRole('button', { name: 'Remove sample data', exact: true }).click();
          await page.waitForFunction(async () => {
            const { StorageService } = await import('/src/db.ts');
            const rows = await StorageService.transactions.getAll();
            return !rows.some(row => row.id.startsWith('lifeos-demo-v2:')) &&
              rows.some(row => row.description === 'QA acceptance: expense');
          });
        }
        await clickButton('Profile');
      }
      await activeTab('dashboard');
    });

    await journey('all Money destinations render on narrow screens', async () => {
      for (const width of [320, 360, 390, 412, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await activeTab('finance');
        const menu = page.getByRole('navigation', { name: 'Money destinations' });
        const metrics = await menu.getByRole('button').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return [rect.width, rect.height, rect.top]; }));
        assert.equal(metrics.length, 6);
        assert.ok(metrics.every(([w,h]) => Math.abs(w - metrics[0][0]) < 1 && Math.abs(h - metrics[0][1]) < 1), 'Money destinations have matching dimensions');
        if (width < 768) assert.equal(new Set(metrics.map(row => row[2])).size, 3, 'phones show two columns and three rows');
        for (const name of ['Transactions', 'Accounts', 'Budgets', 'Savings', 'Insights', 'Schedule']) {
          await menu.getByRole('button', { name, exact: true }).click();
          await page.getByRole('heading', { name, exact: true }).first().waitFor();
          const content = await page.evaluate(() => document.documentElement.scrollWidth);
          assert.ok(content <= width + 1, name + ' overflows at ' + width + 'px');
          if (width === 390) await capture('money-destination-' + name.toLowerCase() + '-390');
          await page.evaluate(() => window.scrollTo(0, 0));
          await clickButton('Money overview');
          await menu.waitFor();
        }
      }
    });

    await journey('responsive layouts and live accessibility audit', async () => {
      for (const width of [320, 360, 390, 412, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        for (const [tab, label] of [['dashboard', 'today'], ['finance', 'money'], ['plan', 'plan'], ['Habits', 'habits'], ['Goals', 'goals']]) {
          if (tab === 'Habits' || tab === 'Goals') await planDestination(tab);
          else await activeTab(tab);
          const status = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
          const overflow = status.document > width + 1 || status.body > width + 1;
          report.responsive.push({ width, screen: label, status: overflow ? 'FAIL' : 'PASS', ...status });
          assert.equal(overflow, false, `${label} overflows at ${width}px: ${JSON.stringify(status)}`);
          await inspectVisiblePage(`${label}-${width}`);
          await capture(`${label}-populated-${width}`);
        }
      }
      completed.add('responsive layouts and live accessibility audit');
    });


    await journey('appearance and date-only alert settings persist', async () => {
      await clickButton('Profile');
      await clickButton('Preferences');
      await clickButton(/Time format/);
      await page.getByRole('dialog', { name: 'Time format' }).getByRole('option', { name: '24-hour' }).click();
      const dateOnly = page.getByLabel('Date-only task alerts');
      await dateOnly.fill('09:00');
      await page.waitForFunction(async () => {
        const { StorageService } = await import('/src/db.ts');
        return await StorageService.settings.get('dateOnlyAlertTime', '') === '09:00';
      });
      await clickButton('Profile');
      await clickButton('Appearance');
      await clickButton('Dark');
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
      await activeTab('finance');
      await capture('money-dark-390');
      await page.reload();
      await page.getByTestId('today-dashboard').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'dark display persisted');
      await clickButton('Profile');
      await clickButton('Preferences');
      assert.equal(await page.getByLabel('Date-only task alerts').inputValue(), '09:00');
      assert.ok(await page.getByRole('button', { name: 'Time format 24-hour' }).isVisible());
      await clickButton('Turn off date-only alerts');
      await page.waitForFunction(async () => {
        const { StorageService } = await import('/src/db.ts');
        return await StorageService.settings.get('dateOnlyAlertTime', 'missing') === '';
      });
    });
    await journey('transaction detail edits and deletes through the encrypted store', async () => {
      await page.setViewportSize({width:390,height:844});
      await activeTab('finance');
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Transactions', exact: true }).click();
      await page.getByRole('button', { name: /View transaction QA acceptance:/ }).first().click();
      const detail = page.locator('dialog[data-transaction-details][open]');
      await detail.waitFor();
      await capture('transaction-detail-390');
      await detail.getByRole('button', {name:'Edit transaction',exact:true}).click();
      const title = 'QA acceptance: edited from transaction details';
      await fillDialogField('Merchant or description', title);
      await capture('edit-transaction-composer-390');
      await saveDialog('Save changes');
      await page.getByRole('button', {name:'View transaction ' + title,exact:true}).click();
      await detail.getByText('Transaction actions', {exact:true}).click();
      await detail.getByRole('button', {name:'Delete transaction',exact:true}).click();
      await page.getByRole('alertdialog').getByRole('button', {name:'Delete transaction',exact:true}).click();
      await page.waitForFunction(async name => {
        const { StorageService } = await import('/src/db.ts');
        return !(await StorageService.transactions.getAll()).some(row => row.description === name);
      }, title);
    });
    await journey('accounts, transfer and recurring plan persist encrypted', async () => {
      await clickButton('Money overview');
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Accounts', exact: true }).click();
      for (const [name, balance] of [['QA cash account', '100'], ['QA reserve account', '0']]) {
        await clickButton('Add account');
        await fillDialogField('Account name', name);
        await fillDialogField('Starting balance', balance);
        if (balance === '100') await capture('add-account-composer-390');
        await saveDialog('Add account');
        await page.getByRole('heading', { name, exact: true }).waitFor();
      }
      await clickButton('Edit QA cash account');
      await fillDialogField('Account name', 'QA edited cash account');
      await capture('edit-account-composer-390');
      await saveDialog('Save changes');
      await page.getByRole('heading', { name: 'QA edited cash account', exact: true }).waitFor();
      await clickButton('Transfer');
      await fillDialogField('Amount sent', '20.25');
      await capture('transfer-composer-390');
      await saveDialog('Record transfer');
      await page.getByRole('heading', { name: 'Transfers', exact: true }).waitFor();
      await capture('money-accounts-populated-390');
      await clickButton('Money overview');
      const moneyDestinations = page.getByRole('navigation', { name: 'Money destinations' });
      await moneyDestinations.getByRole('button', { name: 'Transactions', exact: true }).click();
      const totals = page.getByRole('region', { name: 'Money movement this month' });
      assert.match(await totals.locator('dd').first().innerText(), /^\D*0[.,]00$/, 'a recorded transfer stays out of money in');
      await page.getByRole('button', { name: /^Transfer QA edited cash account to QA reserve account/ }).click();
      const transfer = page.locator('dialog[data-transfer-details][open]');
      assert.equal(await transfer.locator('dd').count(), 2);
      assert.ok((await transfer.locator('dd').allTextContents()).every(amount => amount.includes('20.25')));
      await capture('transfer-timeline-detail-390', false);
      await page.keyboard.press('Escape');
      await transfer.waitFor({ state: 'hidden' });
      await clickButton('Money overview');
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Schedule', exact: true }).click();
      await clickButton('Add scheduled item');
      const name = 'QA recurring utility bill';
      await dialog().getByRole('textbox', { name: 'Name', exact: true }).fill(name);
      await fillDialogField('Amount', '30.50');
      await capture('planned-bill-composer-390');
      await saveDialog('Add scheduled item');
      await page.getByTestId('money-planning').getByText(name, { exact: true }).waitFor();
      const persisted = await page.evaluate(async () => {
        const { lifeOSDatabase } = await import('/src/db.ts');
        const encrypted = row => row.__lifeosEncrypted === 1;
        return {
          accounts: (await lifeOSDatabase.financialAccounts.toArray()).filter(encrypted).length,
          transfers: (await lifeOSDatabase.accountTransfers.toArray()).filter(encrypted).length,
          commitments: (await lifeOSDatabase.plannedCommitments.toArray()).filter(encrypted).length,
        };
      });
      assert.deepEqual(persisted, { accounts: 2, transfers: 1, commitments: 1 });
      await clickButton('View ' + name);
      await clickButton('Edit');
      assert.equal(await dialog().getByRole('textbox', { name: 'Name', exact: true }).inputValue(), name);
      await capture('edit-scheduled-composer-390');
      await saveDialog('Save changes');
      await clickButton('Add scheduled item');
      const once = 'QA one-time repair';
      await dialog().getByRole('textbox', { name: 'Name', exact: true }).fill(once);
      await fillDialogField('Amount', '12.75');
      await chooseOption(dialog(), 'Frequency', 'once');
      await dialog().getByRole('button', { name: 'Currency, account and category', exact: true }).click();
      assert.ok(await chooseOption(dialog(), 'Category (optional)', { index: 1 }));
      await saveDialog('Add scheduled item');
      await clickButton('Record occurrence for ' + once);
      await clickButton('Record occurrence');
      await clickButton('History');
      await page.getByRole('region', { name: 'Recorded occurrences' }).getByText(once, { exact: true }).waitFor();
      const onceResult = await page.evaluate(async title => {
        const { StorageService } = await import('/src/db.ts');
        const plans = await StorageService.commitments.getAll();
        const plan = plans.find(row => row.title === title);
        const rows = (await StorageService.transactions.getAll()).filter(row => row.commitmentId === plan?.id);
        return { status: plan?.status, count: rows.length, recurring: rows[0]?.isRecurring, amount: rows[0]?.amountMinor };
      }, once);
      assert.deepEqual(onceResult, { status: 'recorded', count: 1, recurring: false, amount: '1275' });
      await clickButton('Upcoming');
      await page.getByTestId('money-planning').getByText(name, { exact: true }).waitFor();
      assert.equal(await page.getByTestId('money-planning').getByText(once, { exact: true }).count(), 0);
    });
    await journey('synthetic notification tap opens an encrypted Plan task', async () => {
      await activeTab('dashboard');
      await page.evaluate(async () => {
        const { StorageService } = await import('/src/db.ts');
        const rows = await StorageService.tasks.getAll();
        const task = rows.find(row => row.title === 'QA acceptance: review weekly plan');
        if (!task) throw new Error('Test task missing');
        window.dispatchEvent(new CustomEvent('qa-notification-tap', { detail: { notification: { id: 2147000050, extra: { kind: 'dueTime', taskId: task.id } } } }));
      });
      await page.getByRole('heading', { name: 'QA acceptance: review weekly plan' }).waitFor();
      assert.equal(await page.locator('[data-tab="plan"]').getAttribute('aria-current'), 'page');
      await capture('plan-notification-tap-390');
      await clickButton(/Back to tasks/);
    });

    await journey('synthetic Mark done persists the selected task only', async () => {
      await activeTab('plan');
      await planDestination('Tasks');
      await clickButton('Add task');
      await fillDialogField('Title', 'QA notification action task');
      await saveDialog('Add task');
      const completed = page.getByRole('checkbox', { name: 'Mark QA notification action task incomplete' });
      await page.evaluate(async () => {
        const { StorageService } = await import('/src/db.ts');
        const task = (await StorageService.tasks.getAll()).find(row => row.title === 'QA notification action task');
        if (!task) throw new Error('Synthetic action task missing');
        const detail = { actionId: 'lifeos-task-done', notification: { id: 2147000051, extra: { kind: 'dueTime', taskId: task.id } } };
        window.dispatchEvent(new CustomEvent('qa-notification-tap', { detail }));
        window.dispatchEvent(new CustomEvent('qa-notification-tap', { detail }));
      });
      await completed.waitFor();
      assert.ok(await completed.isChecked());
    });

    await journey('dedicated savings projection calculates, breaks down and resets', async () => {
      await activeTab('finance');
      if (await page.getByRole('button', { name: 'Money overview' }).isVisible()) await clickButton('Money overview');
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Savings', exact: true }).click();
      assert.equal(await page.getByText('Currency converter', { exact: true }).count(), 0);
      await clickButton('View savings projection');
      const projection = page.getByTestId('savings-projection');
      assert.equal(await page.getByText('Currency converter', { exact: true }).count(), 0);
      await projection.getByLabel('Starting savings').fill('1000');
      await projection.getByLabel('Monthly contribution').fill('100');
      await projection.getByLabel('Duration in months').fill('12');
      assert.match(await projection.getByTestId('projected-value').innerText(), /2,200/);
      await clickButton('Period breakdown');
      assert.match(await projection.getByRole('row', { name: /12.*2,200/ }).innerText(), /2,200/);
      await clickButton('Contribution growth and comparison');
      await projection.getByLabel('Increase contribution every (months)').fill('6');
      await projection.getByLabel('Contribution increase (%)').fill('10');
      assert.match(await projection.getByTestId('projected-value').innerText(), /2,260/);
      await capture('savings-projection-390');
      await clickButton('Reset');
      assert.equal(await projection.getByLabel('Starting savings').inputValue(), '0');
      await page.getByRole('button', { name: 'Savings', exact: true }).first().click();
      await page.getByRole('heading', { name: 'Savings', exact: true }).waitFor();
    });

    await journey('Profile nested destinations and notification choices persist', async () => {
      await clickButton('Profile');
      await clickButton('Edit name');
      await page.getByLabel('Display name').fill('Synthetic acceptance profile');
      await clickButton('Save name');
      await page.getByRole('heading', { name: 'Synthetic acceptance profile' }).waitFor();
      for (const [parent, back, children] of [
        ['Appearance', 'Appearance', ['Themes', 'Accent color', 'Motion']],
        ['Privacy & Security', 'Privacy & security', ['App lock', 'Recovery']],
        ['About', 'About LifeOS', ['Open-source licenses']],
      ]) {
        await clickButton(new RegExp('^' + parent));
        for (const name of children) {
          await clickButton(new RegExp('^' + name));
          await page.getByRole('heading', { name, level: 1, exact: true }).waitFor();
          await capture('profile-' + name.toLowerCase().replaceAll(' ', '-') + '-390');
          await clickButton("Back to " + back);
        }
        await clickButton('Profile');
      }
      await clickButton('Notifications');
      await clickButton(/^Notification tone/);
      await page.getByRole('dialog', { name: 'Notification tone' }).getByRole('option', { name: 'Playful', exact: true }).click();
      await page.getByRole('button', { name: 'Notification tone Playful', exact: true }).waitFor();
      await capture('notification-tone-playful-390');
      const category = page.getByRole('switch', { name: 'Habit reminders' });
      assert.equal(await category.getAttribute('aria-checked'), 'true');
      await category.click();
      await page.waitForFunction(() => document.querySelector('[role=switch][aria-label="Habit reminders"]')?.getAttribute('aria-checked') === 'false');
      await page.reload();
      await page.getByTestId('today-dashboard').waitFor();
      assert.equal(await page.getByRole('dialog', { name: 'Allow notifications' }).count(), 0);
      await clickButton('Profile');
      await clickButton('Notifications');
      assert.equal(await category.getAttribute('aria-checked'), 'false');
      await page.getByRole('button', { name: 'Notification tone Playful', exact: true }).waitFor();
      assert.equal(await page.getByRole('switch', { name: 'All notifications' }).getAttribute('aria-checked'), 'true');
      await page.evaluate(() => { window.location.hash = '/life/goals'; });
      await page.getByRole('navigation', { name: 'Plan destinations' }).getByRole('button', { name: 'Goals' }).waitFor();
      assert.equal(await page.getByRole('navigation', { name: 'Plan destinations' }).getByRole('button', { name: 'Goals' }).getAttribute('aria-current'), 'page');
    });

    await journey('rapid navigation settles with measured timing and larger text', async () => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 320, height: 844 });
      await page.evaluate(async () => {
        document.documentElement.style.fontSize = '125%';
        window.__qaNavigationFrames = [];
        window.__qaBlankFrames = 0;
        window.__qaCommitMs = [];
        window.__qaTapsIssued = 0;
        let last = null;
        await new Promise(resolve => {
          const sample = time => {
            if (last !== null) window.__qaNavigationFrames.push(time - last);
            const active = [...document.querySelectorAll('[data-lifeos-screen]')].filter(screen => !screen.hidden && screen.getAttribute('aria-hidden') === 'false');
            window.__qaBlankFrames += active.length === 1 && active[0].getBoundingClientRect().width > 0 ? 0 : 1;
            last = time;
            if (window.__qaNavigationFrames.length < 36) requestAnimationFrame(sample);
            else resolve();
          };
          requestAnimationFrame(sample);
          const destinations = Array.from({ length: 30 }, (_, index) => ['dashboard', 'plan', 'finance'][index % 3]);
          const advance = () => {
            const next = destinations.shift();
            if (next) {
              const started = performance.now();
              window.__qaTapsIssued++;
              document.querySelector('[data-tab="' + next + '"]').click();
              requestAnimationFrame(() => {
                const selected = document.querySelector('[data-tab="' + next + '"][aria-current="page"]');
                if (selected) window.__qaCommitMs.push(performance.now() - started);
                advance();
              });
            }
          };
          advance();
        });
      });
      await page.waitForFunction(() => document.querySelector('#screen-finance')?.dataset.transitionState === 'active' && !document.querySelector('[data-gesture-dragging]'));
      report.navigationTiming = await page.evaluate(() => ({
        lastTransitionMs: performance.getEntriesByName('lifeos-tab-transition').slice(-1)[0]?.duration || 0,
        samples: window.__qaNavigationFrames.length,
        blankLayoutSamples: window.__qaBlankFrames,
        switchesCommitted: window.__qaCommitMs.length,
        tapsIssued: window.__qaTapsIssued,
        medianClickToNextFrameMs: [...window.__qaCommitMs].sort((a, b) => a - b)[Math.floor(window.__qaCommitMs.length / 2)],
        frameIntervalsMs: window.__qaNavigationFrames,
        samplesOver32Ms: window.__qaNavigationFrames.filter(ms => ms > 32).length,
        longestSampleMs: Math.max(...window.__qaNavigationFrames),
      }));
      assert.ok(report.navigationTiming.lastTransitionMs > 0 && report.navigationTiming.samples === 36 && report.navigationTiming.blankLayoutSamples === 0 && report.navigationTiming.tapsIssued === 30 && report.navigationTiming.switchesCommitted > 1);
      await clickButton('Profile');
      await clickButton('Edit name');
      await page.getByLabel('Display name').fill('AlexandriaWithAnUnusuallyLongUnbrokenDisplayName');
      await clickButton('Save name');
      await page.getByRole('heading', { name: 'AlexandriaWithAnUnusuallyLongUnbrokenDisplayName' }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture('profile-large-text-320');
      await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
    });

    if (process.env.LIFEOS_SMART_IMPORT_REVIEW === '1') await journey('Smart Import review and encrypted duplicate protection', async () => {
      await activeTab('finance');
      await page.locator('[data-tab="finance"]').click();
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Transactions', exact: true }).click();
      const alert = 'Bank account xxxx4521 debited INR 17.25 at Fixture Cafe on 21/11/2026 Ref 55200118';
      const review = async input => {
        await clickButton('Import alert');
        const sheet = page.getByRole('dialog', { name: 'Smart Import' });
        await sheet.getByLabel('Bank alert').fill(input);
        await sheet.getByRole('button', { name: 'Detect transaction' }).click();
        return sheet;
      };
      const rejected = await review('Your OTP is 991172 from Bank account xxxx4521');
      await rejected.getByText('No supported transaction was found.').waitFor();
      await rejected.getByRole('button', { name: 'Close' }).click();
      const sheet = await review(alert);
      await sheet.getByRole('button', { name: 'Review transaction' }).waitFor();
      await capture('smart-import-suggestion-390', false);
      await sheet.getByRole('button', { name: 'Review transaction' }).click();
      assert.equal(await dialog().getByLabel('Transaction date', { exact: true }).inputValue(), '2026-11-21');
      await chooseOption(dialog(), 'Category', { index: 1 });
      await saveDialog('Add transaction');
      const testRows = () => page.evaluate(async () => {
        const { lifeOSDatabase, StorageService } = await import('/src/db.ts');
        const rows = (await StorageService.transactions.getAll()).filter(row => row.description === 'Fixture Cafe');
        const raw = await lifeOSDatabase.transactions.get(rows[0]?.id || 'missing');
        return { count: rows.length, amount: rows[0]?.amountMinor, hasTime: !!rows[0]?.occurredAt, encrypted: raw?.__lifeosEncrypted === 1 && !raw.importFingerprint };
      });
      assert.deepEqual(await testRows(), { count: 1, amount: '1725', hasTime: false, encrypted: true });
      const repeat = await review(alert);
      await repeat.getByRole('button', { name: 'Review transaction' }).click();
      await chooseOption(dialog(), 'Category', { index: 1 });
      await dialog().getByRole('button', { name: 'Add transaction', exact: true }).click();
      await page.locator('.lifeos-snackbar').getByText(/matching transaction is already recorded/).waitFor();
      assert.equal((await testRows()).count, 1);
      await capture('smart-import-duplicate-390', false);
      await dialog().getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: /Discard/ }).click();
    });

    await journey('protected recovery save cancellation and confirmation', async () => {
      // Release the populated workspace before testing a fresh profile.
      await context.close();
      context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', acceptDownloads: false });
      page = await context.newPage();
      page.setDefaultTimeout(20_000);
      await page.goto(origin + '/tests/browser/index.html?onboarding-auth=success');
      await page.getByLabel('Your name').fill('Synthetic recovery profile');
      await clickButton('Continue');
      await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor();
      await clickButton('Not now');
      await clickButton('Continue without precise reminders');
      await clickButton('Enable biometrics');
      await page.getByRole('heading', { name: 'Recovery setup' }).waitFor();
      await clickButton('Prepare recovery');
      const save = page.getByTestId('save-complete-recovery-kit');
      await save.waitFor();
      assert.equal(await page.locator('[data-sensitive-recovery-code]').count(), 0);
      await capture('recovery-save-step-390');
      await page.evaluate(() => { window.__qaRecoveryExportMode = 'cancelled'; });
      await save.click();
      await page.getByText('Save cancelled. You can choose a file location again.').waitFor();
      assert.equal(await page.getByTestId('continue-to-lifeos').count(), 0);
      await page.evaluate(() => { window.__qaRecoveryExportMode = 'saved'; });
      await save.click();
      await page.getByTestId('recovery-code-confirmation').fill('A'.repeat(43));
      await page.getByTestId('continue-to-lifeos').click();
      await page.getByText('Your recovery file is saved and confirmed.').waitFor();
      await capture('recovery-complete-step-390');
      await clickButton('Continue to Today');
      await page.getByTestId('today-dashboard').waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-recovery-provisioned')), 'true');
    });
  } catch (error) {
    report.fatal = { journey: currentJourney, message: error instanceof Error ? error.message : String(error) };
    for (const name of plannedJourneys) if (!completed.has(name) && !report.journeys.some(item => item.name === name)) {
      report.blocked.push({ name, status: 'BLOCKED', reason: `Stopped after failure in ${currentJourney}.` });
    }
  }

  if (report.consoleErrors.length || report.pageErrors.length) {
    if (!report.journeys.some(item => item.name === 'browser runtime errors')) {
      record('FAIL', 'browser runtime errors', JSON.stringify({ console: report.consoleErrors, page: report.pageErrors }));
    }
  }
}

main().catch(error => {
  report.fatal = { journey: currentJourney, message: error instanceof Error ? error.message : String(error) };
  failures++;
}).finally(async () => {
  report.finishedAt = new Date().toISOString();
  report.passed = report.journeys.filter(item => item.status === 'PASS').length;
  report.failed = report.journeys.filter(item => item.status === 'FAIL').length;
  report.blockedCount = report.blocked.length;
  fs.writeFileSync(path.join(evidence, 'acceptance-report.json'), JSON.stringify(report, null, 2));
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  if (vite && vite.exitCode === null) { vite.kill(); }
  console.log(JSON.stringify({ evidence, passed: report.passed, failed: report.failed, blocked: report.blockedCount,
    fatal: report.fatal?.message, responsive: report.responsive.length, screenshots: report.screenshots.length,
    consoleErrors: report.consoleErrors.length, pageErrors: report.pageErrors.length }, null, 2));
  if (report.failed || report.fatal || report.blockedCount) process.exitCode = 1;
});
