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
const { installSmartMoneyFixture } = require('./smart-money-2-fixture.cjs');
const standardImportGate = process.env.LIFEOS_STANDARD_IMPORT_GATE === '1';

const root = path.resolve(__dirname, '../..');
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidence = process.env.LIFEOS_BROWSER_EVIDENCE_DIR || path.join(localAppData, 'LifeOS', 'checkpoints', `full-app-acceptance-${runId}`);
if (fs.existsSync(evidence)) throw new Error(`Evidence directory already exists; refusing to overwrite: ${evidence}`);
fs.mkdirSync(evidence, { recursive: true });

const report = {
  startedAt: new Date().toISOString(), repository: root, commit: '',
  environment: 'Actual React application, ephemeral browser context, disposable synthetic native crypto plugin, isolated IndexedDB; no Android/physical device',
  evidence, journeys: [], responsive: [], screenshots: [], consoleErrors: [], pageErrors: [],
  accessibility: [], overflow: [], networkBlocked: [], blocked: [],
};
const plannedJourneys = [
    'first launch and safe browsing', 'primary tab navigation and details',
  'create and complete a task', 'create a posted expense and budget',
  'create a savings goal and contribution', 'create and check in a habit',
  'create a goal, milestone and progress update', 'back navigation and ciphertext persistence',
];
let browser, context, page, vite;
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
  const profileBack = page.locator('.profile-page-heading button:visible');
  for (let depth = 0; depth < 3 && await profileBack.isVisible(); depth++) await profileBack.click();
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

async function chooseComposerOption(label, option) {
  await dialog().getByRole('button', { name: label, exact: true }).click();
  const sheet = page.getByRole('dialog', { name: label, exact: true });
  if (typeof option === 'number') await sheet.getByRole('option').nth(option).click();
  else await sheet.getByRole('option', { name: option, exact: true }).click();
  await sheet.waitFor({ state: 'hidden' });
}

async function saveDialog(buttonName) {
  await dialog().getByRole('button', { name: buttonName, exact: true }).click();
  await dialog().waitFor({ state: 'detached', timeout: 15_000 }).catch(async () => {
    assert.equal(await dialog().count(), 0, `Dialog remained open after ${buttonName}`);
  });
}

async function capture(name) {
  // Recovery codes and recovery confirmation fields are categorically excluded.
  if (await page.locator('[data-sensitive-recovery-code],#recovery-code-confirmation').count()) {
    throw new Error(`Refusing screenshot while recovery material is rendered (${name})`);
  }
  const file = path.join(evidence, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled', timeout: 15_000 });
  report.screenshots.push(path.basename(file));
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
    reducedMotion: 'reduce', acceptDownloads: false });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    report.networkBlocked.push(url); return route.abort();
  });
  if (standardImportGate) await installSmartMoneyFixture(context);
  page = await context.newPage(); page.setDefaultTimeout(12_000); page.setDefaultNavigationTimeout(30_000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  const completed = new Set();
  try {
    await journey('first launch and safe browsing', async () => {
      const backFixture = process.env.LIFEOS_PROFILE_APPEARANCE_GATE === '1' ? '&qa-native-back=enabled' : '';
      await page.goto(`${origin}/tests/browser/index.html?onboarding-auth=success${backFixture}`, { waitUntil: 'networkidle' });
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
      assert.deepEqual(await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button').allTextContents(), ['Today', 'Money', 'Plan', 'Life']);
      await planDestination('Habits');
      await page.getByRole('button', { name: /Add habit/ }).waitFor();
      await capture('habits-empty-390');
      await planDestination('Goals');
      await capture('goals-empty-390');
      await activeTab('finance');
      await clickButton('This month');
      await page.getByRole('heading', { name: 'This month', exact: true }).waitFor();
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
      await filters.getByLabel('Status').selectOption('completed');
      await filters.getByLabel('Priority').selectOption('Medium');
      await capture('plan-filters-390');
      await clickButton('Apply filters');
      await page.getByRole('button', { name: 'Filters (2)' }).waitFor();
      const completedToggle = page.getByRole('checkbox', { name: 'Mark QA acceptance: review weekly plan incomplete' });
      await completedToggle.waitFor();
      assert.equal(await completedToggle.isChecked(), true, 'completed task is shown checked in the completed filter');
      await capture('plan-task-complete-390');
      completed.add('create and complete a task');
    });

    await journey('create a posted expense and budget', async () => {
      await activeTab('finance');
      await clickButton('Add transaction', { exact: false });
      await fillDialogField('Amount', '125.50');
      await fillDialogField('Merchant or description', 'QA acceptance: expense');
      await capture('add-transaction-composer-390');
      await chooseComposerOption('Category', 1);
      await saveDialog('Save transaction');
      await page.getByText('QA acceptance: expense', { exact: true }).waitFor();
      await page.getByTestId('money-home').getByRole('button', { name: /^Budgets/ }).click();
      await clickButton('Add budget', { exact: false });
      await fillDialogField('Monthly limit', '1000');
      await capture('add-budget-composer-390');
      await saveDialog('Save budget');
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
      assert.equal(await page.getByText('Income received minus spending recorded in this period.', { exact: false }).isVisible().catch(() => false), false,
        'the full explanation is hidden from the default screen');
      await capture('info-net-cashflow-hidden-390');
      await netCashflowInfo.click();
      await infoDialog.waitFor({ state: 'visible' });
      await page.getByText('Income received minus spending recorded in this period.', { exact: false }).waitFor();
      await capture('info-net-cashflow-open-390');
      await page.keyboard.press('Escape');
      await infoDialog.waitFor({ state: 'hidden' });
      assert.equal(await netCashflowInfo.evaluate(element => document.activeElement === element), true,
        'dismissal restores focus to the information control');
      await page.getByTestId('money-home').getByRole('button', { name: /^Insights/ }).click();
      await page.getByRole('heading', { name: 'Insights', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Expense categories' }).waitFor();
      assert.ok(await page.locator('.recharts-wrapper').count() > 0, 'real finance chart is rendered from the saved expense');
      await page.getByLabel('Time period').selectOption('3');
      assert.equal(await page.getByLabel('Time period').inputValue(), '3');
      await capture('money-analytics-posted-390');
      assert.match(await page.locator('.money-period-control input').getAttribute('aria-label'), /November 2026/,
        'period selector retains a full accessible month name');
      assert.equal(await page.locator('.money-period-value').innerText(), 'November 2026',
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
      await saveDialog('Save savings');
      await clickButton('Add contribution');
      await fillDialogField('Amount', '100');
      await capture('add-contribution-composer-390');
      await saveDialog('Save contribution');
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
      await saveDialog('Save habit');
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
      await chooseComposerOption('Progress tracking', 'Count a daily quantity');
      await fillDialogField('Daily quantity target', '4');
      await fillDialogField('Unit', 'glasses');
      await capture('add-habit-composer-390');
      await saveDialog('Save habit');
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
      await fillDialogField('Target date', '2026-12-31');
      await capture('add-goal-composer-390');
      await saveDialog('Save goal');
      await page.getByRole('button', { name: /^QA acceptance: finish one course/ }).click();
      await page.getByRole('heading', { name: 'QA acceptance: finish one course' }).waitFor();
      await clickButton('+ Milestone');
      await fillDialogField('Milestone title', 'QA acceptance: finish first module');
      await capture('add-milestone-composer-390');
      await saveDialog('Save milestone');
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
      await saveDialog('Save progress');
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
      await dialog().getByRole('button', { name: 'Schedule No date' }).click();
      await fillDialogField('Due date', '2099-04-22');
      await fillDialogField('Time (optional)', '19:36');
      await dialog().getByRole('button', { name: /Reminder Due-time options/ }).click();
      await chooseComposerOption('Extra reminder', '15 minutes before');
      await capture('task-timed-composer-390');
      await saveDialog('Save task');
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
      await dialog().getByLabel('Alert at due time').uncheck();
      await saveDialog('Save task');
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

    await journey('composer choices, dirty dismissal and duplicate save after reload', async () => {
      await activeTab('plan');
      await clickButton('Add task');
      await fillDialogField('Task title', 'QA composer single submission');
      await dialog().getByRole('button', { name: /Priority Medium/ }).click();
      const choice = page.getByRole('dialog', { name: 'Priority', exact: true });
      assert.equal(await choice.getByRole('option', { name: 'Medium' }).getAttribute('aria-selected'), 'true');
      await page.keyboard.press('Escape');
      await choice.waitFor({ state: 'hidden' });
      assert.match(await page.evaluate(() => document.activeElement?.textContent), /Priority/);
      await dialog().getByRole('button', { name: /Priority Medium/ }).click();
      await choice.getByRole('option', { name: 'High' }).click();
      await dialog().getByRole('button', { name: /Priority High/ }).waitFor();
      await clickButton('Cancel');
      await clickButton('Keep editing');
      assert.equal(await dialog().getByLabel('Task title').inputValue(), 'QA composer single submission');
      await dialog().evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await page.getByRole('button', { name: /QA composer single submission/ }).waitFor();
      await page.reload();
      await activeTab('plan');
      const tasks = await page.evaluate(async () => {
        const { StorageService } = await import('/src/db.ts');
        return (await StorageService.tasks.getAll()).filter(row => row.title === 'QA composer single submission').map(row => row.priority);
      });
      assert.deepEqual(tasks, ['High']);

      await activeTab('finance');
      await clickButton('Add transaction', { exact: false });
      await clickButton('Add optional details');
      const currency = dialog().getByRole('button', { name: 'Currency', exact: true });
      await currency.click();
      const currencies = page.getByRole('dialog', { name: 'Currency', exact: true });
      await currencies.getByRole('searchbox', { name: 'Search currencies' }).fill('JPY');
      await currencies.getByRole('option', { name: /JPY/ }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Currency');
      await dialog().getByLabel('Amount · JPY').waitFor();
      await clickButton('Cancel');
      await clickButton('Discard changes');
      await dialog().waitFor({ state: 'hidden' });
    });

    await journey('retained navigation intermediate frames in light and dark', async () => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const cdp = await context.newCDPSession(page);
      const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      const stable = () => page.waitForFunction(() => !document.querySelector('[data-transition-state=outgoing],[data-track-dragging]'));
      try {
        for (const theme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: theme });
          await page.waitForFunction(mode => document.documentElement.classList.contains('dark') === (mode === 'dark'), theme);
          const pageColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page'));
          for (const [from, to] of [['dashboard', 'finance'], ['finance', 'plan'], ['plan', 'life']]) {
            await activeTab(from);
            await stable();
            await page.locator('#screen-' + to).waitFor({ state: 'attached' });
            const geometry = () => page.evaluate(({ from, to }) => {
              const outgoing = document.getElementById('screen-' + from);
              const incoming = document.getElementById('screen-' + to);
              const stage = document.querySelector('.ui-tab-screen-stack');
              const clip = document.querySelector('.ui-tab-viewport').getBoundingClientRect();
              const indicator = document.querySelector('.alive-nav-indicator');
              return {
                stageX: new DOMMatrix(getComputedStyle(stage).transform).m41,
                outgoingRight: outgoing.getBoundingClientRect().right,
                incomingLeft: incoming.getBoundingClientRect().left,
                width: clip.width, clipLeft: clip.left, clipRight: clip.right,
                opacity: [getComputedStyle(outgoing).opacity, getComputedStyle(incoming).opacity],
                indicator: new DOMMatrix(getComputedStyle(indicator).transform).m41 / indicator.offsetWidth,
                heading: document.querySelector('#primary-route-title').getBoundingClientRect().left,
                previewInert: incoming.inert && incoming.getAttribute('aria-hidden') === 'true',
              };
            }, { from, to });
            const before = await geometry();
            await touch('touchStart', [{ x: 300, y: 160, id: 7 }]);
            await touch('touchMove', [{ x: 257, y: 160, id: 7 }]);
            await touch('touchMove', [{ x: 170, y: 160, id: 7 }]);
            await page.waitForFunction(() => {
              const stage = document.querySelector('.ui-tab-screen-stack');
              return document.querySelector('[data-gesture-preview=true]')
                && new DOMMatrix(getComputedStyle(stage).transform).m41 < -100;
            });
            const middle = await geometry();
            assert.ok(middle.stageX < -100, 'track follows the finger');
            assert.ok(Math.abs(middle.outgoingRight - middle.incomingLeft) < 1, 'adjacent panels meet without a gap or overlap');
            assert.ok(middle.incomingLeft > middle.clipLeft && middle.incomingLeft < middle.clipRight);
            assert.deepEqual(middle.opacity, ['1', '1']);
            assert.equal(middle.heading, before.heading, 'masthead stays stationary');
            assert.ok(middle.previewInert, 'visual preview remains inaccessible');
            assert.ok(Math.abs(middle.indicator - before.indicator - Math.abs(middle.stageX) / middle.width) < .02);
            await page.screenshot({ path: path.join(evidence, `track-${theme}-${from}-to-${to}.png`) });
            report.screenshots.push(`track-${theme}-${from}-to-${to}.png`);
            await touch('touchMove', [{ x: 72, y: 160, id: 7 }]);
            await touch('touchEnd');
            await page.waitForFunction(tab => document.querySelector('[data-tab=' + tab + ']')?.getAttribute('aria-current') === 'page', to);
            await stable();
            assert.ok(Math.abs((await geometry()).stageX) < 1);
            if (!report.retainedNavigation) report.retainedNavigation = [];
            report.retainedNavigation.push({ theme, pageColor, from, to, before, middle });
          }
        }
        const colors = new Set(report.retainedNavigation.map(sample => sample.pageColor));
        assert.equal(colors.size, 2, 'light and dark use different rendered page tokens');
      } finally {
        await cdp.detach();
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
        await page.reload();
        await page.getByTestId('today-dashboard').waitFor();
      }
    });

    if (standardImportGate) {
      await journey('Standard Smart Import review and encrypted duplicate protection', async () => {
        await activeTab('finance');
        await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Transactions', exact: true }).click();
        const alert = 'Bank account xxxx4521 debited INR 17.25 at Fixture Cafe on 21/11/2026 Ref 552001818273';
        const sheet = page.getByRole('dialog', { name: 'Smart Import' });
        const detect = () => sheet.getByRole('button', { name: 'Detect transaction' }).click();
        const confirmCategory = () => chooseComposerOption('Category', 1);
        const review = async input => {
          await clickButton('Import alert');
          await sheet.getByLabel('Bank alert').fill(input);
          await detect();
        };
        await review('Your OTP is 991172 from Bank account xxxx4521');
        await sheet.getByText('No supported transaction was found.').waitFor();
        await sheet.getByRole('button', { name: 'Close', exact: true }).click();

        await review(alert);
        await sheet.getByRole('button', { name: 'Review transaction' }).click();
        assert.equal(await dialog().getByLabel('Transaction date', { exact: true }).inputValue(), '2026-11-21');
        await confirmCategory();
        const testRows = () => page.evaluate(async () => {
          const { lifeOSDatabase, StorageService } = await import('/src/db.ts');
          const rows = (await StorageService.transactions.getAll()).filter(row => row.description === 'Fixture Cafe');
          const encrypted = await Promise.all(rows.map(async row => {
            const raw = await lifeOSDatabase.transactions.get(row.id);
            return raw?.__lifeosEncrypted === 1 && !raw.importFingerprint && !raw.description && !raw.amount;
          }));
          return { count: rows.length, amount: rows[0]?.amountMinor, hasTime: !!rows[0]?.occurredAt, encrypted: encrypted.every(Boolean) };
        });
        assert.equal((await testRows()).count, 0, 'review alone does not record a transaction');
        await saveDialog('Save transaction');
        assert.deepEqual(await testRows(), { count: 1, amount: '1725', hasTime: false, encrypted: true });

        const state = () => page.evaluate(() => window.__qaSmartMoney.state);
        const peekCount = (await state()).peeks;
        const share = (id, text) => page.evaluate(({ id, text }) => window.__qaSmartMoney.share(id, text), { id, text });
        await page.evaluate(() => { window.__qaSmartMoney.state.holdProtection = true; });
        const alias = alert.replace('xxxx4521', '').replace('Fixture Cafe', 'FIXTURE CAFE');
        await share('duplicate-share', alias);
        await page.waitForFunction(() => window.__qaSmartMoney.waitingForProtection() > 0);
        assert.equal((await state()).peeks, peekCount);
        assert.equal(await sheet.count(), 0);
        await page.evaluate(() => window.__qaSmartMoney.releaseProtection());
        assert.equal(await sheet.getByLabel('Bank alert').inputValue(), alias);
        await detect();
        await sheet.getByRole('button', { name: 'Review transaction' }).click();
        assert.equal((await state()).secure, true);
        await confirmCategory();
        await dialog().getByRole('button', { name: 'Save transaction', exact: true }).click();
        await page.getByText(/matching transaction is already recorded/).waitFor();
        assert.equal((await testRows()).count, 1);
        await dialog().getByRole('button', { name: 'Close', exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: /Discard/ }).click();

        await review(alert.replace('552001818273', '552001818274'));
        await sheet.getByRole('button', { name: 'Review transaction' }).click();
        await confirmCategory();
        await dialog().getByRole('button', { name: 'Save transaction', exact: true }).click();
        const confirmation = page.getByRole('alertdialog', { name: 'Record a separate transaction?' });
        await confirmation.getByRole('button', { name: 'Save separate transaction' }).click();
        await dialog().waitFor({ state: 'hidden' });
        assert.equal((await testRows()).count, 2);
      });
      return;
    }

    if (process.env.LIFEOS_PROFILE_APPEARANCE_GATE === '1') {
      await journey('Profile and Appearance studio geometry, persistence and motion', async () => {
        const heading = name => page.getByRole('heading', { name, level: 1, exact: true });
        const back = async (name) => {
          await page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-app-backButton', { detail: { canGoBack: true } })));
          await heading(name).waitFor();
          assert.equal(await heading(name).evaluate(node => node === document.activeElement), true);
        };
        const dark = expected => page.waitForFunction(expected => document.documentElement.classList.contains('dark') === expected, expected);
        const pressed = async (name, expected = true) => page.waitForFunction(({ name, expected }) =>
          [...document.querySelectorAll('button[aria-pressed]')].some(button => button.getAttribute('aria-label') === name && button.getAttribute('aria-pressed') === String(expected)), { name, expected });
        const inspect = () => page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const root = document.querySelector('.profile-settings');
          const bounds = root.getBoundingClientRect();
          const controls = [...root.querySelectorAll('button, input:not([type=radio]), label, .appearance-mini, .accent-studio-swatch, .motion-demo-track')].filter(node => node.getClientRects().length);
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            horizontalScroll: scrollX,
            clipped: controls.flatMap(node => {
              const rect = node.getBoundingClientRect();
              return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 ||
                (node.scrollWidth - node.clientWidth > 2 && !node.matches('input')) ?
                [{ name: node.getAttribute('aria-label') || node.textContent.slice(0, 60), innerOverflow: node.scrollWidth - node.clientWidth }] : [];
            }),
            rows: [...root.querySelectorAll('.profile-navigation-row')].map(row => {
              const edge = row.closest('.profile-link-group').getBoundingClientRect();
              const box = row.getBoundingClientRect();
              const icon = row.querySelector('.profile-navigation-icon').getBoundingClientRect();
              const copy = row.querySelector('.profile-navigation-copy').getBoundingClientRect();
              return { left: icon.left-edge.left, right: edge.right-box.right, icon: icon.width, gap: copy.left-icon.right };
            }),
          };
        });
        const route = async name => {
          if (await page.getByRole('button', { name: 'Open profile and settings' }).isVisible()) await clickButton('Open profile and settings');
          const backButton = page.locator('.profile-page-heading button:visible');
          for (let depth = 0; depth < 2 && !(await heading('Profile').isVisible()); depth++) await backButton.click();
          if (name !== 'Profile') await clickButton('Appearance');
          if (name !== 'Profile' && name !== 'Appearance') await clickButton(name);
          await heading(name).waitFor();
          await heading(name).evaluate(node => Promise.allSettled(node.closest('.profile-settings').getAnimations().map(animation => animation.finished)));
        };
        await clickButton('Open profile and settings');
        await heading('Profile').waitFor();
        await clickButton('Appearance');
        await clickButton('Themes');
        report.appearanceGeometry = [];
        for (const mode of ['Light', 'Dark']) {
          await route('Themes');
          await clickButton(mode);
          await dark(mode === 'Dark');
          for (const name of ['Profile', 'Appearance', 'Themes', 'Accent color', 'Motion']) {
            await route(name);
            await page.setViewportSize({ width: 390, height: 844 });
            await capture('premium-' + mode.toLowerCase() + '-' + name.toLowerCase().replaceAll(' ', '-'));
            for (const width of [320, 360, 390, 412, 768]) {
              await page.setViewportSize({ width, height: 844 });
              await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
              const geometry = await inspect();
              assert.equal(geometry.overflow, 0, mode + ' ' + name + ' document width');
              assert.equal(geometry.horizontalScroll, 0);
              assert.deepEqual(geometry.clipped, [], mode + ' ' + name + ' at ' + width + ' CSS px');
              for (const row of geometry.rows) {
                assert.ok(row.left >= 16 && row.right >= 16 && (width > 412 || row.left <= 20 && row.right <= 20));
                assert.equal(row.icon, 42);
                assert.equal(row.gap, 13);
              }
              report.appearanceGeometry.push({ mode, name, width, ...geometry });
              if (width === 320) await capture('premium-' + mode.toLowerCase() + '-' + name.toLowerCase().replaceAll(' ', '-') + '-200');
              await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
            }
          }
          await page.setViewportSize({ width: 390, height: 844 });
          await route('Themes');
          for (const palette of ['Soft Ivory + Sage Feather', 'Ocean Mist', 'Warm Sand', 'Lavender Haze', 'Midnight Slate', 'Rose Clay']) {
            const name = 'Preview ' + palette;
            await clickButton(name);
            await pressed(name);
            const usesCatalog = await page.getByRole('button', { name, exact: true }).evaluate(button =>
              getComputedStyle(button.querySelector('.appearance-mini')).backgroundColor === getComputedStyle(document.querySelector('.app-shell')).backgroundColor);
            assert.equal(usesCatalog, true, palette + ' uses its real background');
          }
          await clickButton('Cancel preview');
          await route('Accent color');
          for (const accent of ['Sage', 'Ocean', 'Sand', 'Lavender', 'Slate', 'Clay']) {
            await clickButton(accent);
            await pressed(accent);
            const ratio = await page.getByRole('button', { name: accent, exact: true }).evaluate(async node => {
              const { contrastRatio } = await import('/src/services/themeCatalog.ts');
              const swatch = getComputedStyle(node.querySelector('.accent-studio-swatch'));
              const hex = rgb => '#' + rgb.match(/\d+/g).slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('');
              return contrastRatio(hex(swatch.color), hex(swatch.backgroundColor));
            });
            assert.ok(ratio >= 4.5, mode + ' ' + accent + ' contrast ' + ratio);
          }
          await clickButton('Use palette accent');
          await page.waitForFunction(() => localStorage.getItem('lifeos-custom-accent') === null);
        }
        await route('Themes');
        await clickButton('System');
        await pressed('System');
        await page.emulateMedia({ colorScheme: 'light' });
        await dark(false);
        await page.emulateMedia({ colorScheme: 'dark' });
        await dark(true);
        await clickButton('Preview Ocean Mist');
        await clickButton('Apply theme');
        await page.waitForFunction(() => localStorage.getItem('lifeos-theme-id') === 'ocean-mist');
        await clickButton('Preview Warm Sand');
        await back('Appearance');
        await clickButton('Accent color');
        await page.getByLabel('Hex color').fill('#12');
        await page.getByRole('alert').getByText(/Enter six hexadecimal digits/).waitFor();
        await page.getByLabel('Hex color').fill('#FFFF00');
        await clickButton('Apply accent');
        await page.waitForFunction(() => localStorage.getItem('lifeos-custom-accent') === '#FFFF00');
        await back('Appearance');
        await clickButton('Motion');
        await clickButton('Preview Silky');
        assert.equal(await page.locator('[data-motion-demo="silky"]').getAttribute('data-demo-at-end'), 'true');
        assert.equal(await page.locator('.motion-demo-piece').evaluateAll(nodes => nodes.flatMap(node => node.getAnimations()).length), 0);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        report.motionPreviews = [];
        for (const id of ['silky', 'snappy', 'oil']) {
          const track = page.locator('[data-motion-demo="' + id + '"]');
          const preview = page.getByRole('button', { name: 'Preview ' + id[0].toUpperCase() + id.slice(1), exact: true });
          const samples = await track.evaluate(track => new Promise(resolve => {
            const samples = [];
            const node = track.querySelector('.motion-demo-piece');
            track.closest('.motion-studio-card').querySelector('button').click();
            const start = performance.now();
            const sample = time => {
              samples.push(new DOMMatrix(getComputedStyle(node).transform).m41);
              if (track.hasAttribute('data-demo-at-end') || time - start > 1200) resolve(samples);
              else requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          }));
          assert.ok(samples.some(offset => offset > 1), id + ' has intermediate motion');
          assert.equal(await track.getAttribute('data-demo-at-end'), 'true');
          await preview.click();
          await preview.click();
          await preview.click();
          assert.ok(await page.locator('.motion-demo-piece').evaluateAll(nodes => nodes.flatMap(node => node.getAnimations()).length) <= 1);
          await track.locator('xpath=..').locator('xpath=..').locator('.motion-studio-select').click();
          await page.waitForFunction(value => document.querySelector('input[type=radio][value="' + value + '"]')?.checked, id);
          report.motionPreviews.push({ id, samples });
        }
        await back('Appearance');
        await page.reload();
        await page.getByTestId('today-dashboard').waitFor();
        await route('Themes');
        await pressed('System');
        await pressed('Preview Ocean Mist');
        await back('Appearance');
        await clickButton('Accent color');
        assert.equal(await page.getByLabel('Hex color').inputValue(), '#FFFF00');
        await back('Appearance');
        await clickButton('Motion');
        assert.equal(await page.getByRole('radio', { name: 'Oil', exact: true }).isChecked(), true);
      });
      return;
    }

    await journey('Profile photo picker and encrypted persistence', async () => {
      const opener = page.getByRole('button', { name: 'Open profile and settings', exact: true });
      const profile = page.getByTestId('profile-settings-home');
      const image = profile.locator('img.profile-avatar-image');
      await opener.click();

      const upload = async (label, color, mimeType = 'image/png') => {
        const data = await page.evaluate(fill => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 12;
          const context = canvas.getContext('2d');
          context.fillStyle = fill;
          context.fillRect(0, 0, 12, 12);
          return canvas.toDataURL().split(',')[1];
        }, color);
        const chooser = page.waitForEvent('filechooser');
        await profile.getByRole('button', { name: label, exact: true }).click();
        await (await chooser).setFiles({ name: 'synthetic-profile.png', mimeType, buffer: Buffer.from(data, 'base64') });
      };

      await upload('Choose photo', 'navy', 'text/plain');
      await profile.getByRole('alert').getByText(/Choose a JPEG/).waitFor();
      await upload('Choose photo', 'navy');
      await image.waitFor();
      const first = await image.getAttribute('src');
      await upload('Replace photo', 'gold');
      await page.waitForFunction(previous => {
        const src = document.querySelector('[data-testid="profile-settings-home"] .profile-avatar-image')?.getAttribute('src');
        return Boolean(src && src !== previous);
      }, first);
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
        return {
          restoredPhoto: restored.tables.settings.find(row => row.key === 'profilePhoto')?.value,
          rowIsEncrypted: raw?.__lifeosEncrypted === 1 && raw.value === undefined,
          photoInBackupCiphertext: sealed.includes('data:image/jpeg'),
          cachedLocally: Object.values(localStorage).some(value => value.includes('data:image/jpeg')),
        };

      });
      assert.deepEqual(persisted, { restoredPhoto: replacement, rowIsEncrypted: true, photoInBackupCiphertext: false, cachedLocally: false });

      await profile.getByRole('button', { name: 'Back from profile' }).click();
      assert.equal(await opener.locator('img').getAttribute('src'), replacement);
      await page.reload();
      await opener.click();
      assert.equal(await image.getAttribute('src'), replacement);
      const chooser = page.waitForEvent('filechooser');
      await profile.getByRole('button', { name: 'Replace photo', exact: true }).click();
      await (await chooser).setFiles([]);
      await profile.getByRole('button', { name: 'Replace photo', exact: true }).waitFor();
      assert.equal(await image.getAttribute('src'), replacement);
      await profile.getByRole('button', { name: 'Remove photo', exact: true }).click();
      await image.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(async () => (await import('/src/db.ts')).StorageService.settings.get('profilePhoto', null)), null);
      await profile.getByRole('button', { name: 'Back from profile' }).click();
      assert.equal(await opener.locator('img').count(), 0);
    });
    if (process.env.LIFEOS_PROFILE_PHOTO_GATE === '1') return;

    await journey('compact settings and six-month sample data', async () => {
      await clickButton('Open profile and settings');
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
          await clickButton('This month');
          await capture('monthly-overview-sample-390');
          await clickButton('Money overview');
          await planDestination('Habits');
          await capture('habits-sample-390');
          await planDestination('Goals');
          await capture('goals-sample-390');
          await clickButton('Open profile and settings');
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
        for (const name of ['Transactions', 'Accounts', 'Budgets', 'Savings', 'Insights', 'Plans']) {
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
      await clickButton('Open profile and settings');
      await clickButton('Preferences');
      await clickButton(/Time format/);
      await page.getByRole('dialog', { name: 'Time format' }).getByRole('button', { name: '24-hour' }).click();
      const dateOnly = page.getByLabel('Date-only task alerts');
      await dateOnly.fill('09:00');
      await page.waitForFunction(async () => {
        const { StorageService } = await import('/src/db.ts');
        return await StorageService.settings.get('dateOnlyAlertTime', '') === '09:00';
      });
      await clickButton('Profile');
      await clickButton('Appearance');
      await clickButton('Themes');
      await clickButton('Dark');
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
      await activeTab('finance');
      await capture('money-dark-390');
      await page.reload();
      await page.getByTestId('today-dashboard').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'dark display persisted');
      await clickButton('Open profile and settings');
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
      await saveDialog('Save transaction');
      await page.getByRole('button', {name:'View transaction ' + title,exact:true}).click();
      await detail.getByText('More actions', {exact:true}).click();
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
        await saveDialog('Save account');
        await page.getByRole('heading', { name, exact: true }).waitFor();
      }
      await clickButton('Edit QA cash account');
      await fillDialogField('Account name', 'QA edited cash account');
      await capture('edit-account-composer-390');
      await saveDialog('Save account');
      await page.getByRole('heading', { name: 'QA edited cash account', exact: true }).waitFor();
      await clickButton('Transfer');
      await fillDialogField('Amount sent', '20.25');
      await capture('transfer-composer-390');
      await saveDialog('Save transfer');
      await page.getByRole('heading', { name: 'Transfers', exact: true }).waitFor();
      await capture('money-accounts-populated-390');
      await clickButton('Money overview');
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Plans', exact: true }).click();
      await clickButton('Add');
      const name = 'QA recurring utility bill';
      await dialog().getByRole('textbox', { name: 'Name', exact: true }).fill(name);
      await fillDialogField('Amount', '30.50');
      await capture('planned-bill-composer-390');
      await saveDialog('Save plan');
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
      await saveDialog('Save task');
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
      await page.getByRole('navigation', { name: 'Money destinations' }).getByRole('button', { name: 'Plans', exact: true }).click();
      assert.equal(await page.getByText('Currency converter', { exact: true }).count(), 0);
      await clickButton('Savings projection');
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
      await page.getByRole('button', { name: 'Plans', exact: true }).first().click();
      await page.getByTestId('money-planning').waitFor();
    });

    await journey('Profile nested destinations and notification choices persist', async () => {
      await clickButton('Open profile and settings');
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
          await clickButton(back);
        }
        await clickButton('Profile');
      }
      await clickButton('Notifications');
      await clickButton(/^Notification tone/);
      await page.getByRole('dialog', { name: 'Notification tone' }).getByRole('button', { name: 'Playful', exact: true }).click();
      await page.getByRole('button', { name: 'Notification tone Playful', exact: true }).waitFor();
      await capture('notification-tone-playful-390');
      const category = page.getByRole('switch', { name: 'Habit reminders' });
      assert.equal(await category.getAttribute('aria-checked'), 'true');
      await category.click();
      await page.waitForFunction(() => document.querySelector('[role=switch][aria-label="Habit reminders"]')?.getAttribute('aria-checked') === 'false');
      await page.reload();
      await page.getByTestId('today-dashboard').waitFor();
      assert.equal(await page.getByRole('dialog', { name: 'Allow notifications' }).count(), 0);
      await clickButton('Open profile and settings');
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
        let last = performance.now();
        await new Promise(resolve => {
          const sample = time => {
            window.__qaNavigationFrames.push(time - last);
            last = time;
            if (window.__qaNavigationFrames.length < 24) requestAnimationFrame(sample);
            else resolve();
          };
          requestAnimationFrame(sample);
          const destinations = ['dashboard', 'finance', 'plan', 'dashboard', 'finance'];
          const advance = () => {
            const next = destinations.shift();
            if (next) { document.querySelector('[data-tab="' + next + '"]').click(); requestAnimationFrame(advance); }
          };
          advance();
        });
      });
      await page.waitForFunction(() => document.querySelector('#screen-finance')?.dataset.transitionState === 'active' && !document.querySelector('[data-gesture-dragging]'));
      report.navigationTiming = await page.evaluate(() => ({
        lastTransitionMs: performance.getEntriesByName('lifeos-tab-transition').slice(-1)[0]?.duration || 0,
        samples: window.__qaNavigationFrames.length,
        longestSampleMs: Math.max(...window.__qaNavigationFrames),
      }));
      assert.ok(report.navigationTiming.lastTransitionMs > 0 && report.navigationTiming.samples === 24);
      await clickButton('Open profile and settings');
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

    await journey('protected recovery save cancellation and confirmation', async () => {
      const disposable = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', acceptDownloads: false });
      const mainPage = page;
      page = await disposable.newPage();
      page.setDefaultTimeout(12_000);
      try {
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
      } finally {
        await disposable.close();
        page = mainPage;
      }
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
