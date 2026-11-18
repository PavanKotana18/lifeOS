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

async function activeTab(name) {
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
  page = await context.newPage(); page.setDefaultTimeout(12_000); page.setDefaultNavigationTimeout(30_000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  const completed = new Set();
  try {
    await journey('first launch and safe browsing', async () => {
      await page.goto(`${origin}/tests/browser/index.html?onboarding-auth=success`, { waitUntil: 'networkidle' });
      await page.locator('input[autocomplete="nickname"]').fill('Synthetic acceptance user');
      await capture('welcome-390');
      await clickButton('Continue');
      await page.getByRole('heading', { name: 'Biometric setup' }).waitFor();
      await capture('biometric-390');
      await clickButton('Not now');
      await page.getByRole('heading', { name: 'Recovery setup' }).waitFor();
      await capture('recovery-390');
      await clickButton('Do this later');
      await page.getByTestId('today-dashboard').waitFor();
      await page.getByRole('dialog', { name: 'Stay on top of what matters' }).waitFor();
      await capture('today-notification-opt-in-390');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-notification-consent')), null);
      await clickButton('Maybe later');
      await page.getByRole('dialog', { name: 'Stay on top of what matters' }).waitFor({ state: 'hidden' });
      const storage = await page.evaluate(async () => {
        const db = await import('/src/db.ts');
        return { active: db.isEncryptedStorageActivated(),
          privateCount: await db.lifeOSDatabase.tasks.count() };
      });
      assert.deepEqual(storage, { active: false, privateCount: 0 }, 'welcome opens safe browsing without private storage');
      completed.add('first launch and safe browsing');
    });

    await journey('primary tab navigation and details', async () => {
      for (const [tab, label] of [['dashboard', 'today'], ['finance', 'money'], ['plan', 'plan'], ['life', 'life']]) {
        await activeTab(tab); await inspectVisiblePage(`${label}-empty`); await capture(`${label}-empty-390`);
      }
      await activeTab('finance');
      await page.getByTestId('money-home').getByRole('button', { name: /^Budgets/ }).click();
      await page.getByRole('heading', { name: 'Budgets', exact: true }).waitFor();
      await clickButton('Money overview');
      await page.getByTestId('money-home').waitFor();
      await activeTab('plan');
      assert.equal(await page.getByRole('button', { name: 'Open calendar' }).count(), 0);
      assert.equal(await page.locator('[data-tab="plan"]').getAttribute('aria-current'), 'page');
      await activeTab('life');
      await page.getByRole('button', { name: 'Add a habit', exact: true }).waitFor();
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
      await clickButton('Create Task');
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
      const category = dialog().getByLabel('Category', { exact: false }).last();
      await category.selectOption({ index: 1 });
      await saveDialog('Save transaction');
      await page.getByText('QA acceptance: expense', { exact: true }).waitFor();
      await page.getByTestId('money-home').getByRole('button', { name: /^Budgets/ }).click();
      await clickButton('Add budget', { exact: false });
      await fillDialogField('Monthly limit', '1000');
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
      await page.getByRole('heading', { name: 'Financial insights' }).waitFor();
      await page.getByText(/Posted expenses/).waitFor();
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
      await saveDialog('Save savings');
      await clickButton('Add contribution');
      await fillDialogField('Amount', '100');
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
      await activeTab('life'); await clickButton('Add a habit', { exact: false });
      await fillDialogField('Habit name', 'QA acceptance: read ten pages');
      await saveDialog('Save habit');
      const checkIn = page.getByRole('button', { name: /Complete QA acceptance: read ten pages for today/ });
      await checkIn.click();
      const undoCheckIn = page.getByRole('button', { name: 'Mark QA acceptance: read ten pages incomplete' });
      await undoCheckIn.waitFor();
      assert.equal(await undoCheckIn.getAttribute('aria-pressed'), 'true', 'LifeHub reflects the saved habit check-in');
      await page.getByRole('button', { name: /QA acceptance: read ten pages/ }).last().click();
      await page.getByRole('heading', { name: 'QA acceptance: read ten pages' }).waitFor();
      await capture('life-habit-detail-390');
      await clickButton('Back to list');
      await clickButton('Add habit', { exact: false });
      await fillDialogField('Habit name', 'QA acceptance: drink water');
      await dialog().getByLabel('Progress tracking').selectOption('quantity');
      await fillDialogField('Daily quantity target', '4');
      await fillDialogField('Unit', 'glasses');
      await saveDialog('Save habit');
      await page.getByRole('button', { name: /QA acceptance: drink water/ }).last().click();
      await page.getByRole('heading', { name: 'QA acceptance: drink water' }).waitFor();
      await page.getByText('0 / 4 glasses', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Add one glass to QA acceptance: drink water' }).click();
      await page.getByText('1 glass / 4 glasses', { exact: true }).waitFor();
      await capture('life-quantity-habit-detail-390');
      completed.add('create and check in a habit');
    });

    await journey('create a goal, milestone and progress update', async () => {
      await clickButton('Back to list');
      await clickButton('Back to Life');
      await activeTab('life'); await clickButton('Add a goal', { exact: false });
      await fillDialogField('Goal title', 'QA acceptance: finish one course');
      await dialog().getByLabel('Target', { exact: true }).fill('10');
      await fillDialogField('Target date', '2026-12-31');
      await saveDialog('Save goal');
      await page.getByRole('button', { name: 'QA acceptance: finish one course' }).click();
      await page.getByRole('heading', { name: 'QA acceptance: finish one course' }).waitFor();
      await clickButton('+ Milestone');
      await fillDialogField('Milestone title', 'QA acceptance: finish first module');
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
      await saveDialog('Save progress');
      await page.getByRole('progressbar', { name: 'QA acceptance: finish one course progress' }).waitFor();
      await capture('life-goal-detail-390');
      completed.add('create a goal, milestone and progress update');
    });

    await journey('back navigation and ciphertext persistence', async () => {
      await clickButton('Back to list');
      await page.getByRole('heading', { name: 'Personal Goals' }).waitFor();
      await clickButton('Back to Life');
      await page.getByTestId('life-hub').waitFor();
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
      await clickButton('Create Task');
      const title = 'QA acceptance: timed task';
      await fillDialogField('Task title', title);
      await fillDialogField('Due date', '2099-04-22');
      await fillDialogField('Time (optional)', '19:36');
      await dialog().getByText('More task details', { exact: true }).click();
      await dialog().getByLabel('Extra reminder').selectOption('15');
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

    await journey('compact settings and six-month sample data', async () => {
      await clickButton('Open profile and settings');
      await page.getByTestId('profile-settings-home').waitFor();
      await capture('profile-390');
      for (const name of ['Appearance', 'Preferences', 'Notifications', 'Privacy & Security', 'Backup & Restore', 'About', 'Developer tools']) {
        await clickButton(name);
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
          await activeTab('life');
          await capture('life-sample-390');
          await clickButton('Open profile and settings');
          await clickButton('Developer tools');
          await clickButton('Remove sample data');
          await page.getByRole('alertdialog').getByRole('button', { name: 'Remove sample data', exact: true }).click();
          await page.getByText('Sample data removed').waitFor();
        }
        await clickButton('Profile');
      }
      await activeTab('dashboard');
    });

    await journey('all Money destinations render on narrow screens', async () => {
      for (const width of [320, 390, 768, 1280]) {
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
          await clickButton('Money overview');
        }
      }
    });

    await journey('responsive layouts and live accessibility audit', async () => {
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        for (const [tab, label] of [['dashboard', 'today'], ['finance', 'money'], ['plan', 'plan'], ['life', 'life']]) {
          await activeTab(tab);
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
      await clickButton('Open profile and settings');
      await clickButton('Preferences');
      assert.equal(await page.getByLabel('Date-only task alerts').inputValue(), '09:00');
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
