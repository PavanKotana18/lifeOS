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
      await clickButton('Open LifeOS');
      await page.getByTestId('today-dashboard').waitFor();
      assert.equal(await page.getByRole('button', { name: /notification/i }).count(), 0,
        'the browser synthetic plugin does not expose native notification permission controls');
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
      await activeTab('plan'); await clickButton('Calendar planner');
      await page.getByRole('heading', { name: 'Tasks by date' }).waitFor();
      assert.equal(await page.locator('[data-tab="plan"]').getAttribute('aria-current'), 'page');
      await activeTab('life'); await clickButton('Habits', { exact: false });
      await page.getByRole('heading', { name: 'Habit Tracker' }).waitFor();
      await clickButton('Back to Life');
      completed.add('primary tab navigation and details');
    });

    await journey('create and complete a task', async () => {
      await activeTab('plan');
      const quick = page.getByLabel('Quick task', { exact: true });
      await quick.fill('QA acceptance: review weekly plan');
      await page.getByRole('button', { name: 'Add task', exact: true }).last().click();
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
      await page.locator('.plan-filter-details > summary').click();
      await page.locator('.plan-search-controls select').selectOption('completed');
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
      assert.equal(await page.getByText('This is posted income minus posted expenses for the selected month.', { exact: false }).isVisible().catch(() => false), false,
        'the full explanation is hidden from the default screen');
      await capture('info-net-cashflow-hidden-390');
      await netCashflowInfo.click();
      await infoDialog.waitFor({ state: 'visible' });
      await page.getByText('This is posted income minus posted expenses for the selected month.', { exact: false }).waitFor();
      await capture('info-net-cashflow-open-390');
      await page.keyboard.press('Escape');
      await infoDialog.waitFor({ state: 'hidden' });
      assert.equal(await netCashflowInfo.evaluate(element => document.activeElement === element), true,
        'dismissal restores focus to the information control');
      await page.getByTestId('money-home').getByRole('button', { name: /^Analytics/ }).click();
      await page.getByRole('heading', { name: 'Financial insights' }).waitFor();
      await page.getByText(/Posted expenses/).waitFor();
      assert.ok(await page.locator('.recharts-wrapper').count() > 0, 'real finance chart is rendered from the saved expense');
      await page.getByLabel('Chart range').selectOption('3');
      assert.equal(await page.getByLabel('Chart range').inputValue(), '3');
      await capture('money-analytics-posted-390');
      assert.match(await page.locator('.money-period-control input').getAttribute('aria-label'), /November 2026/,
        'period selector retains a full accessible month name');
      assert.equal(await page.locator('.money-period-value').innerText(), 'Nov 2026',
        'period selector shows a compact month label');
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
