'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createServer } = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');
const { installSmartMoneyFixture } = require('./smart-money-2-fixture.cjs');

const root = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const evidence = path.resolve(process.argv[3]);
const port = Number(process.env.LIFEOS_MOTION_PORT || 4183);
const origin = 'http://127.0.0.1:' + port;
const reduced = process.env.LIFEOS_MOTION_REDUCED === '1';
const viewport = { width: 390, height: 844 };
const colorScheme = process.env.LIFEOS_MOTION_SCHEME === 'dark' ? 'dark' : 'light';
const fourDestinations = process.env.LIFEOS_FOUR_DESTINATIONS === '1';
const primaryOnly = process.env.LIFEOS_MOTION_PRIMARY === '1';
const profileCorrection = process.env.LIFEOS_PROFILE_CORRECTION === '1';
const shareReview = process.env.LIFEOS_SHARE_REVIEW === '1';
const bankSmsReview = process.env.LIFEOS_BANK_SMS_REVIEW === '1';
const coldAlert = 'Bank account xxxx4521 debited INR 17.25 at Sydney Cafe on 21/11/2026 Ref 552001818273';
fs.mkdirSync(evidence, { recursive: false });

const report = {
  source: process.env.LIFEOS_MOTION_SOURCE || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  viewport, reduced, colorScheme, sequences: {}, errors: [], interactions: [],
  worktreeStatus: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(),
};
let server, browser;

async function auditBankSms(page, button, tab) {
  const settings = page.getByRole('region', { name: 'Automatic bank SMS monitoring' });
  const queue = page.getByRole('dialog', { name: 'Bank SMS review' });
  const ledger = () => page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('LifeOS_Database');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise((resolve, reject) => {
      const request = database.transaction('transactions').objectStore('transactions').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { count: rows.length, sealed: rows.every(row => row.__lifeosEncrypted === 1 && !row.description && !row.importReference) };
  });
  const receive = (id, text) => page.evaluate(({ id, text }) => window.__qaSmartMoney.receiveSms(id, text), { id, text });
  const mark = state => settings.getByRole('status').filter({ hasText: new RegExp('^' + state + '$') }).waitFor();
  const appSignal = isActive => page.evaluate(isActive => {
    window.dispatchEvent(new CustomEvent('qa-app-appStateChange', { detail: { isActive } }));
  }, isActive);
  const seed = () => page.evaluate(() => { window.__qaSmartMoney.sms.nextGrant = true; });
  const merchant = 'SMS fixture bakery';
  const alert = coldAlert.replace('Sydney Cafe', merchant);
  await tab('settings').click();
  await button('Money & Imports').click();
  await mark('Off');
  await button('Set up protected storage', settings).click();
  await button('Protect this device and save').click();
  await button('Enable monitoring', settings).click();
  await mark('Permission needed');
  assert.equal(await queue.count(), 0);
  await seed();
  await button('Enable monitoring', settings).click();
  await mark('On');
  report.interactions.push('Explicit opt-in handled simulated denial and grant.');
  await appSignal(false);
  await page.getByRole('heading', { name: /locked/i }).waitFor();
  await receive('pending-fixture', alert);
  await receive('duplicate-fixture', alert);
  await receive('refund-fixture', 'Bank account refunded INR 8.00 on 21/11/2026 Ref 552001877321');
  assert.equal(await page.evaluate(() => window.__qaSmartMoney.sms.peeks), 0);
  assert.equal(await queue.count(), 0);
  await appSignal(true);
  await mark('On');
  await button('Open review queue', settings).click();
  await queue.getByText(merchant, { exact: false }).waitFor();
  await queue.getByText(/Refund · check the original expense/).waitFor();
  assert.equal(await queue.getByRole('button', { name: 'Review & save' }).count(), 1);
  assert.deepEqual(await ledger(), { count: 0, sealed: true });
  await page.screenshot({ path: path.join(evidence, 'sms-review-queue.png') });
  await button('Review & save', queue).click();
  const composer = page.locator('#record-dialog');
  await composer.getByLabel('Merchant or description').fill(merchant + ' edited');
  await button(/^Category/, composer).click();
  await page.getByRole('dialog', { name: 'Category' }).getByRole('option').nth(1).click();
  await button('Add transaction', composer).click();
  await composer.waitFor({ state: 'hidden' });
  assert.deepEqual(await ledger(), { count: 1, sealed: true });
  report.interactions.push('Locked delivery withheld the raw alert. Duplicate delivery collapsed. An edited confirmed expense wrote one ciphertext row.');

  await page.evaluate(alert => window.__qaSmartMoney.share('same-sms-shared', alert), alert);
  const share = page.getByRole('dialog', { name: 'Smart Import' });
  await button('Detect transaction', share).click();
  await button('Review transaction', share).click();
  await button(/^Category/, composer).click();
  await page.getByRole('dialog', { name: 'Category' }).getByRole('option').nth(1).click();
  await button('Add transaction', composer).click();
  await page.getByText(/matching transaction is already recorded/).first().waitFor();
  assert.equal((await ledger()).count, 1);
  await button('Cancel', composer).click();
  await button(/Discard/, page.getByRole('alertdialog')).click();
  await composer.waitFor({ state: 'hidden' });
  await tab('settings').click();
  await button('Money & Imports').click();
  await mark('On');
  await button('Turn off monitoring', settings).click();
  await mark('Off');
  await receive('disabled-fixture', alert.replace('552001818273', '552001818279'));
  await button('Open review queue', settings).click();
  await queue.getByText(/Refund · check the original expense/).waitFor();
  assert.equal(await queue.getByRole('button', { name: 'Dismiss', exact: true }).count(), 1);
  await button('Dismiss', queue).click();
  await queue.getByText('No suggestions waiting for review.').waitFor();
  await button('Close', queue).click();
  await button('Enable monitoring', settings).click();
  await mark('On');
  await page.evaluate(() => {
    window.__qaSmartMoney.sms.granted = false;
    window.__qaSmartMoney.sms.requestable = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await mark('Permission needed');
  assert.equal(await button('Enable monitoring', settings).isDisabled(), true);
  assert.deepEqual(await ledger(), { count: 1, sealed: true });
  report.interactions.push('Share replay, disable, refund dismissal and simulated revocation left the confirmed ledger unchanged.');
}

async function auditShares(page, button) {
  const sheet = page.getByRole('dialog', { name: 'Smart Import' });
  const appSignal = isActive => page.evaluate(isActive => {
    window.dispatchEvent(new CustomEvent('qa-app-appStateChange', { detail: { isActive } }));
  }, isActive);
  const share = (id, text) => page.evaluate(({ id, text }) => window.__qaSmartMoney.share(id, text), { id, text });
  const state = () => page.evaluate(() => window.__qaSmartMoney.state);
  const crop = name => page.screenshot({ path: path.join(evidence, name + '.png') });
  const ledger = () => page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('LifeOS_Database');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise((resolve, reject) => {
      const request = database.transaction('transactions').objectStore('transactions').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { count: rows.length, encrypted: rows.every(row => row.__lifeosEncrypted === 1 &&
      !('importFingerprint' in row || 'description' in row || 'amount' in row)) };
  });
  const composer = page.locator('#record-dialog');
  const confirmCategory = async () => {
    await button(/^Category/, composer).click();
    await page.getByRole('dialog', { name: 'Category' }).getByRole('option').nth(1).click();
  };
  const detect = () => button('Detect transaction', sheet).click();
  const review = () => button('Review transaction', sheet).click();
  const close = () => button('Close', sheet).click();

  await button('Review shared alert').waitFor();
  assert.equal((await state()).peeks, 0);
  assert.equal(await sheet.count(), 0);
  await button('Review shared alert').click();
  await button('Protect this device and save').click();
  await sheet.waitFor();
  assert.equal(await sheet.getByLabel('Bank alert').inputValue(), coldAlert);
  assert.equal(await sheet.evaluate(node => node.open), true);
  assert.equal((await state()).secure, true);
  assert.equal((await ledger()).count, 0);
  await share('repeated-intent', coldAlert);
  await detect();
  await review();
  await composer.getByLabel('Merchant or description', { exact: true }).fill('Edited shared fixture');
  await confirmCategory();
  assert.equal((await ledger()).count, 0);
  assert.equal((await state()).secure, true);
  await crop('shared-transaction-review');
  await button('Add transaction', composer).click();
  await composer.waitFor({ state: 'hidden' });
  assert.deepEqual(await ledger(), { count: 1, encrypted: true });
  assert.equal((await state()).acknowledgements, 1);
  report.interactions.push('Cold launch held an alert until protected storage setup. Editing and explicit confirmation created one encrypted row.');

  await appSignal(false);
  await page.getByRole('heading', { name: /(?:locked|unlock)/i }).waitFor();
  const peeks = (await state()).peeks;
  const alternate = coldAlert.replace('xxxx4521', '').replace('Sydney Cafe', 'SYDNEY CAFE');
  await share('while-locked', alternate);
  assert.equal((await state()).peeks, peeks);
  assert.equal(await sheet.count(), 0);
  await appSignal(true);
  await sheet.waitFor();
  assert.equal(await sheet.getByLabel('Bank alert').inputValue(), alternate);
  await detect();
  await review();
  await confirmCategory();
  await button('Add transaction', composer).click();
  await page.locator('.lifeos-snackbar').getByText(/matching transaction is already recorded/).waitFor();
  assert.equal((await ledger()).count, 1);
  await button('Cancel', composer).click();
  await button(/Discard/, page.getByRole('alertdialog')).click();
  await composer.waitFor({ state: 'hidden' });
  report.interactions.push('Locked delivery withheld the alert until resume. A changed account hint with the same bank reference was blocked.');

  await share('cancel-warm', coldAlert.replace('552001818273', '552001818277'));
  await sheet.waitFor();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-app-backButton')));
  await sheet.waitFor({ state: 'hidden' });
  assert.equal((await ledger()).count, 1);
  await share('otp-warm', 'Bank account OTP 123456. Never share this code.');
  await sheet.waitFor();
  await detect();
  await sheet.getByRole('status').getByText('No supported transaction was found.').waitFor();
  await close();
  assert.equal((await ledger()).count, 1);
  report.interactions.push('Foreground cancellation and OTP rejection left the encrypted ledger unchanged.');

  await page.reload();
  await sheet.waitFor();
  await detect();
  await review();
  await confirmCategory();
  await button('Add transaction', composer).click();
  await page.locator('.lifeos-snackbar').getByText(/matching transaction is already recorded/).waitFor();
  assert.deepEqual(await ledger(), { count: 1, encrypted: true });
  report.interactions.push('A fresh page with the same cold-share payload could not add a second encrypted row.');
}

async function auditProfile(page, cdp, tab, button) {
  const expectedFixed = process.env.LIFEOS_PROFILE_BASELINE !== '1';
  const heading = page.locator('#primary-route-title');
  const screenshot = name => page.screenshot({ path: path.join(evidence, name + '.png') });
  const geometry = () => page.evaluate(() => {
    const panel = document.querySelector('#screen-settings');
    const track = document.querySelector('.ui-tab-screen-stack');
    const viewport = document.querySelector('.ui-tab-viewport').getBoundingClientRect().toJSON();
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    const current = document.querySelector('[data-tab][aria-current="page"]')?.getAttribute('data-tab');
    const indicator = document.querySelector('.alive-nav-indicator')?.getBoundingClientRect().toJSON();
    const visible = [...track.querySelectorAll('[data-lifeos-screen]')]
      .filter(node => !node.hidden || node.hasAttribute('data-gesture-preview'))
      .map(node => ({ id: node.id, ...node.getBoundingClientRect().toJSON() }));
    const headerStyle = getComputedStyle(document.querySelector('.primary-masthead'));
    return { viewport, visible, current, indicator, scrollX, documentWidth: document.documentElement.scrollWidth,
      windowWidth: innerWidth, transform: getComputedStyle(track).transform, dragging: track.hasAttribute('data-track-dragging'),
      panel: panel.getBoundingClientRect().toJSON(), panelPadding: [getComputedStyle(panel).paddingLeft, getComputedStyle(panel).paddingRight],
      content: rect('#screen-settings .profile-track-page'), controls: rect('#screen-settings .profile-settings'),
      masthead: rect('.primary-masthead'), mastheadPadding: [headerStyle.paddingLeft, headerStyle.paddingRight],
      openHeading: rect('#primary-route-title') };
  });
  const settled = () => page.waitForFunction(() => {
    const track = document.querySelector('.ui-tab-screen-stack');
    return getComputedStyle(track).transform === 'none' && !track.hasAttribute('data-track-dragging') &&
      !track.querySelector('[data-transition-state="outgoing"]');
  });
  const touch = (type, x, y = 392) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: x == null ? [] : [{ x, y, id: 1 }],
  });
  const swipe = async direction => {
    const width = page.viewportSize().width;
    const points = (direction === 'left' ? [.84, .67, .24] : [.15, .32, .75]).map(fraction => Math.round(width * fraction));
    await touch('touchStart', points[0]);
    await touch('touchMove', points[1]);
    await touch('touchMove', points[2]);
  };
  const back = () => page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-app-backButton')));
  const checkBounds = measured => {
    assert.ok(Math.abs(measured.panel.left - measured.viewport.left) < 1 && Math.abs(measured.panel.right - measured.viewport.right) < 1);
    assert.ok(measured.content.left >= measured.panel.left && measured.content.right <= measured.panel.right + 1);
    assert.ok(measured.controls.left >= measured.content.left && measured.controls.right <= measured.content.right + 1);
    assert.equal(measured.current, 'settings');
    assert.equal(measured.scrollX, 0);
    assert.ok(measured.documentWidth <= measured.windowWidth);
    assert.equal(measured.transform, 'none');
  };

  await page.keyboard.press('Tab');
  report.headingFocus = [];
  for (const route of ['dashboard', 'finance', 'plan']) {
    await tab(route).click();
    await settled();
    await page.keyboard.press('Tab');
    await heading.focus();
    const title = await heading.evaluate(node => {
      const style = getComputedStyle(node);
      return { label: node.textContent, active: document.activeElement === node, focusVisible: node.matches(':focus-visible'),
        tabIndex: node.tabIndex, outline: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor,
        shadow: style.boxShadow, border: style.borderTopStyle };
    });
    assert.equal(title.active, true);
    assert.equal(title.tabIndex, -1);
    if (expectedFixed) assert.equal(title.outline, 'none');
    else assert.notEqual(title.outline, 'none');
    report.headingFocus.push(title);
    await screenshot('heading-' + route);
  }
  await tab('settings').focus();
  const keyboardControl = await tab('settings').evaluate(node => ({ outline: getComputedStyle(node).outlineStyle, focused: node.matches(':focus-visible') }));
  assert.ok(keyboardControl.focused && keyboardControl.outline !== 'none');
  report.keyboardControl = keyboardControl;

  await page.evaluate(() => { window.__qaSmartMoney.state.holdProtection = true; });
  await swipe('left');
  await page.waitForSelector('[data-track-dragging]');
  const during = await geometry();
  assert.equal(during.visible.length, 2);
  assert.ok(Math.abs(during.visible[0].right - during.visible[1].left) < 1);
  assert.equal(during.current, 'plan');
  assert.ok(during.indicator && during.indicator.x > 195 && during.indicator.x < 292.5);
  await screenshot('profile-drag');
  await touch('touchEnd');
  await page.waitForFunction(() => window.__qaSmartMoney.waitingForProtection() > 0);
  await touch('touchStart', 188, 34);
  await touch('touchEnd');
  await page.evaluate(() => window.__qaSmartMoney.releaseProtection());
  await page.waitForTimeout(500);
  const interrupted = await geometry();
  report.interruption = { drag: during, after: interrupted };
  await screenshot('profile-interrupted');
  if (expectedFixed) assert.equal(interrupted.transform, 'none');
  else assert.notEqual(interrupted.transform, 'none');
  assert.equal(interrupted.current, 'plan');
  if (!expectedFixed) return;

  await swipe('left'); await touch('touchEnd');
  await page.getByRole('heading', { level: 1, name: 'Profile', exact: true }).waitFor();
  await settled();
  report.profileWidths = [];
  for (const width of [320, 360, 390, 412, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await settled();
    const home = await geometry();
    checkBounds(home);
    await screenshot('profile-' + width);
    await button('Appearance').click();
    await page.getByRole('heading', { level: 1, name: 'Appearance', exact: true }).waitFor();
    const nested = await geometry();
    checkBounds(nested);
    await swipe('right'); await touch('touchEnd');
    assert.equal(await heading.textContent(), 'Appearance');
    await back();
    await page.getByRole('heading', { level: 1, name: 'Profile', exact: true }).waitFor();
    report.profileWidths.push({ width, home, nested });
  }
  await page.setViewportSize(viewport);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 42, right: 34 } });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#screen-settings')).paddingLeft === '42px');
  report.asymmetricInsets = await geometry();
  checkBounds(report.asymmetricInsets);
  assert.deepEqual(report.asymmetricInsets.panelPadding, ['42px', '34px']);
  assert.deepEqual(report.asymmetricInsets.mastheadPadding, ['42px', '34px']);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 0, right: 0 } });
  for (const route of ['plan', 'finance', 'dashboard', 'finance', 'plan', 'settings']) {
    const from = await page.locator('[data-tab][aria-current="page"]').getAttribute('data-tab');
    const order = ['dashboard', 'finance', 'plan', 'settings'];
    await swipe(order.indexOf(route) < order.indexOf(from) ? 'right' : 'left'); await touch('touchEnd');
    await page.waitForFunction(route => document.querySelector('[data-tab="' + route + '"]')?.getAttribute('aria-current') === 'page', route);
    await settled();
    if (route === 'settings') checkBounds(await geometry());
    report.interactions.push(from + ' to ' + route + ' settled');
  }
  await back();
  await page.waitForFunction(() => document.querySelector('[data-tab="plan"]')?.getAttribute('aria-current') === 'page');
  await settled();
}

async function main() {
  const output = path.resolve(process.env.LIFEOS_MOTION_FIXTURE_DIST || path.join(evidence, 'fixture-dist'));
  if (!process.env.LIFEOS_MOTION_FIXTURE_DIST) {
    const { build, loadConfigFromFile } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
    const { config } = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(root, 'vite.config.ts'), root);
    const buildOutput = await build({ ...config, root, configFile: false, logLevel: 'warn',
      build: { ...config.build, outDir: output, target: 'esnext', rollupOptions: { input: path.join(root, 'tests/browser/index.html') } } });
    report.bundleBytes = Object.fromEntries(buildOutput.output.filter(item => item.type === 'chunk')
      .map(chunk => [chunk.fileName, Buffer.byteLength(chunk.code)]));
  }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  server = createServer((request, response) => {
    const filename = path.resolve(output, '.' + new URL(request.url, origin).pathname);
    if (!filename.startsWith(output + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
    fs.createReadStream(filename).pipe(response);
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
  const executablePath = process.env.LIFEOS_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
  browser = await chromium.launch({ executablePath, headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme,
    reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: true, hasTouch: true });
  if (profileCorrection || shareReview || bankSmsReview) await installSmartMoneyFixture(context, {
    coldAlert: shareReview ? coldAlert : undefined, privateSms: bankSmsReview,
  });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/')
    || /^(data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
  await context.addInitScript(() => {
    let rendererId = 0;
    const renderers = new Map();
    const commits = [];
    window.__ALIVE_QA_COMMITS__ = commits;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers,
      inject: renderer => { renderers.set(++rendererId, renderer); return rendererId; },
      onCommitFiberRoot: (_, root) => commits.push({ time: performance.now(), duration: root.current.actualDuration ?? null }),
      onCommitFiberUnmount() {},
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(origin + '/tests/browser/index.html?onboarding-auth=success' +
    (profileCorrection || shareReview || bankSmsReview ? '&qa-native-back=enabled' : ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  const button = (name, scope = page) => scope.getByRole('button', { name, exact: typeof name === 'string' });
  const tab = name => page.locator('[data-tab="' + name + '"]');
  const composer = () => page.locator('form#record-dialog');
  await page.locator('input[autocomplete="nickname"]').fill('LifeOS motion fixture');
  await button('Continue').click();
  await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor();
  await button('Allow notifications').click();
  await page.getByText('Notifications allowed', { exact: true }).waitFor();
  await button('Enable precise reminders').click();
  await page.getByText(/Without it, reminders may arrive late/).waitFor();
  await button('Enable precise reminders').click();
  await page.evaluate(() => {
    sessionStorage.setItem('qa-exact-alarm', 'true');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByText('Precise reminders enabled', { exact: true }).waitFor();
  await button('Continue').click();
  await button('Not now').click();
  await button('Review deferral').click();
  await button('Do this later').click();
  await page.getByTestId('today-dashboard').waitFor();

  assert.equal(await page.locator('html').evaluate(root => root.classList.contains('dark')), colorScheme === 'dark');

  if (shareReview) {
    await auditShares(page, button);
    assert.deepEqual(report.errors, []);
    return;
  }
  if (bankSmsReview) {
    await auditBankSms(page, button, tab);
    assert.deepEqual(report.errors, []);
    return;
  }
  const cdp = await context.newCDPSession(page);
  if (profileCorrection) {
    await auditProfile(page, cdp, tab, button);
    assert.deepEqual(report.errors, []);
    return;
  }
  await cdp.send('Performance.enable');
  let frames = null;
  cdp.on('Page.screencastFrame', frame => {
    frames?.push({ data: frame.data, timestamp: frame.metadata.timestamp });
    void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: viewport.width, maxHeight: viewport.height, everyNthFrame: 1 });
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));

  async function capture(name, target, selector, swipeDirection, swipeY = 215) {
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(580);
    const bounds = await target.boundingBox();
    assert.ok(bounds, name + ' has a visible trigger');
    assert.equal(await page.locator('[data-sensitive-recovery-code],#recovery-code-confirmation').count(), 0);
    const directory = path.join(evidence, name);
    fs.mkdirSync(directory);
    await page.screenshot({ path: path.join(directory, 'before.png'), animations: 'allow' });
    const before = await metrics();
    frames = [];
    const captureOrigin = Date.now() / 1000;
    await page.evaluate(({ selector, swipe, geometry }) => {
      const masthead = document.getElementById('primary-route-title');
      const clip = document.querySelector('.ui-tab-viewport');
      const nav = document.querySelector('.app-bottom-nav');
      const result = { frames: [], longTasks: [], longFrames: [], events: [], shifts: [], input: null, press: null, commitIndex: 0 };
      window.__ALIVE_QA_SAMPLE__ = result;
      let began;
      const preClick = [];
      const selectors = selector.split('|');
      const observers = [
        ['longtask', 'longTasks'],
        ['long-animation-frame', 'longFrames'],
        ['event', 'events'],
        ['layout-shift', 'shifts'],
      ].flatMap(([type, key]) => {
        if (!PerformanceObserver.supportedEntryTypes.includes(type)) return [];
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) result[key].push({
            time: entry.startTime, duration: entry.duration, value: entry.value, recentInput: entry.hadRecentInput,
            name: entry.name, renderStart: entry.renderStart, styleAndLayoutStart: entry.styleAndLayoutStart,
            inputDelay: entry.processingStart == null ? undefined : entry.processingStart - entry.startTime,
            processing: entry.processingEnd == null ? undefined : entry.processingEnd - entry.processingStart,
            blocking: entry.blockingDuration,
            scripts: entry.scripts?.map(script => ({ duration: script.duration, invoker: script.invoker,
              forcedLayout: script.forcedStyleAndLayoutDuration, source: script.sourceURL?.split('/').at(-1),
              offset: script.sourceCharPosition, name: script.sourceFunctionName })),

          });
        });
        observer.observe({ type, ...(type === 'event' ? { durationThreshold: 16 } : {}) });
        return [observer];
      });
      let pressed;
      window.addEventListener('pointerdown', event => {
        result.press = performance.now();
        if (swipe) {
          began = result.input = result.press;
          result.commitIndex = window.__ALIVE_QA_COMMITS__.length;
        }
        pressed = event.target instanceof Element ? event.target.closest('button,input,label,summary,[role=button]') : null;
      }, { once: true, capture: true });
      if (swipe) {
        result.touch = [];
        const move = event => result.touch.push({ x: event.clientX, time: performance.now() - began });
        window.addEventListener('pointermove', move, { capture: true });
        window.addEventListener('pointerup', () => { result.release = performance.now() - began; window.removeEventListener('pointermove', move, true); }, { once: true, capture: true });
      } else window.addEventListener('click', () => {
        began = result.input = performance.now();
        result.commitIndex = window.__ALIVE_QA_COMMITS__.length;
      }, { once: true, capture: true });
      function sample(time) {
        const surfaces = selectors.flatMap(query => Array.from(document.querySelectorAll(query))
          .filter(node => !node.hidden || node.hasAttribute('data-gesture-preview')).map(node => {
            const style = getComputedStyle(node);
            const position = style.transform === 'none' ? new DOMMatrix() : new DOMMatrix(style.transform);
            const rect = geometry && node.matches('[data-lifeos-screen]') ? node.getBoundingClientRect() : null;
            const heading = rect ? node.querySelector('h1,h2') : null;
            const title = heading?.getBoundingClientRect();
            return { id: node.id || query, left: rect?.left, right: rect?.right, top: rect?.top,
              heading: title ? { left: title.left, right: title.right, text: heading.textContent } : undefined, x: position.m41, y: position.m42, translate: style.translate,
              width: node.matches('.alive-nav-indicator') ? node.offsetWidth : undefined, opacity: Number(style.opacity), visibility: style.visibility, height: query.includes('disclosure') ? node.getBoundingClientRect().height : undefined,
              stroke: style.strokeDashoffset, position: style.position, inert: node.inert, state: node.dataset.transitionState,
              animations: node.getAnimations().map(animation => ({ name: animation.animationName, state: animation.playState,
                current: animation.currentTime, duration: animation.effect?.getComputedTiming().endTime })) };
          }));
        if (began !== undefined) {
          const mastheadRect = masthead?.getBoundingClientRect();
          const title = mastheadRect ? { x: mastheadRect.x, y: mastheadRect.y, text: masthead.textContent } : undefined;
          const coverageGap = mastheadRect && clip && nav ? nav.getBoundingClientRect().top - clip.getBoundingClientRect().bottom : undefined;
          result.frames.push({ time: time - began, surfaces, title, coverageGap });
        }
        else if (result.press !== null) {
          const style = pressed && getComputedStyle(pressed);
          preClick.push({ time: time - result.press, surfaces, pressTransform: style?.transform ?? 'none' });
        }
        result.pressFrames = preClick;
        if (began === undefined || time - began < (swipe ? (result.release ?? Infinity) + 480 : 690)) requestAnimationFrame(sample);
        else { observers.forEach(observer => observer.disconnect()); result.done = true; }
      }
      requestAnimationFrame(sample);
    }, { selector, swipe: !!swipeDirection, geometry: process.env.LIFEOS_VIDEO_COMPARE === '1' });
    if (swipeDirection) {
      const right = swipeDirection === 'right';
      const start = right ? 74 : viewport.width - 74;
      const safeY = await page.evaluate(({ x, preferred }) => [preferred, 215, 285, 350, 395, 590].find(y => {
        const target = document.elementFromPoint(x, y);
        return target?.closest('.app-main') && !target.closest('button,input,a,label,summary,[data-no-tab-swipe],[data-swipe-exclude]');
      }), { x: start, preferred: swipeY });
      assert.ok(safeY, name + ' has a non-interactive touch starting point');
      const send = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null ? [] : [{ x, y: safeY, id: 1 }] });
      await send('touchStart', start);
      for (const step of [5, 11, 28, 56, 88, 116, 155]) {
        await page.waitForTimeout(18);
        await send('touchMove', start + (right ? step : -step));
      }
      await send('touchEnd');
    } else {
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(34);
      await page.mouse.up();
    }
    await page.waitForFunction(() => window.__ALIVE_QA_SAMPLE__.done);
    const captured = frames;
    frames = null;
    const after = await metrics();
    captured.forEach((frame, index) => fs.writeFileSync(path.join(directory, String(index).padStart(3, '0') + '.jpg'), Buffer.from(frame.data, 'base64')));
    await page.screenshot({ path: path.join(directory, 'after.png'), animations: 'allow' });
    const record = await page.evaluate(() => {
      const sample = window.__ALIVE_QA_SAMPLE__;
      return { ...sample, commits: window.__ALIVE_QA_COMMITS__.slice(sample.commitIndex).map(commit => ({ ...commit, time: commit.time - sample.input })),
        preference: { preset: document.documentElement.dataset.motionPreset,
          cache: localStorage.getItem('lifeos-motion-preset'),
          reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
          tabDuration: getComputedStyle(document.documentElement).getPropertyValue('--motion-tab') } };
    });
    record.captureOrigin = captureOrigin;
    record.captureTimestamps = captured.map(frame => frame.timestamp);
    record.heapBytes = [before.JSHeapUsedSize, after.JSHeapUsedSize];
    record.browserLayoutCount = after.LayoutCount - before.LayoutCount;
    record.browserTaskMs = (after.TaskDuration - before.TaskDuration) * 1000;
    report.sequences[name] = record;
    console.log(name, captured.length, 'compositor frames');
  }

  const screens = '[data-lifeos-screen]|.app-bottom-nav [aria-current]|.alive-nav-indicator|.ui-tab-screen-stack';
  await capture('today-money', tab('finance'), screens);
  await capture('money-plan', tab('plan'), screens);
  if (process.env.LIFEOS_MOTION_COMPARE_SWIPE === '1') {
    await capture('plan-today', tab('dashboard'), screens);
    for (const [name, destination, direction] of [
      ['swipe-today-money', 'finance', 'left'], ['swipe-money-plan', 'plan', 'left'],
      ...(fourDestinations ? [['swipe-plan-profile', 'settings', 'left'], ['swipe-profile-plan', 'plan', 'right']] : []),
      ['swipe-plan-money', 'finance', 'right'], ['swipe-money-today', 'dashboard', 'right'],
    ]) {
      await capture(name, tab(destination), screens, direction, name === 'swipe-plan-money' ? 395 : 250);
      assert.equal(await tab(destination).getAttribute('aria-current'), 'page', name + ' commits the target');
      assert.equal(await page.locator('[data-gesture-preview],[data-gesture-dragging]').count(), 0, name + ' removes drag surfaces');
    }
    if (process.env.LIFEOS_VIDEO_COMPARE === '1') {
      await tab('plan').click();
      const plan = page.getByRole('navigation', { name: 'Plan destinations' });
      await capture('plan-tasks-habits', button('Habits', plan), screens);
      await capture('plan-habits-goals', button('Goals', plan), screens);
      if (await page.locator('#primary-route-title').count()) {
        await page.setViewportSize({ width: viewport.width, height: 640 });
        await tab('finance').click();
        await page.waitForTimeout(580);
        const scroll = await page.evaluate(() => {
          window.scrollTo({ top: 115, behavior: 'instant' });
          return window.scrollY;
        });
        assert.ok(scroll > 0, 'Money fixture can reproduce a scrolled route before dragging');
        await capture('swipe-scrolled-money-plan', tab('plan'), screens, 'left', 275);
        assert.equal(await tab('plan').getAttribute('aria-current'), 'page');
        await capture('swipe-plan-scrolled-money', tab('finance'), screens, 'right', 195);
        assert.equal(await tab('finance').getAttribute('aria-current'), 'page');
        assert.equal(await page.evaluate(() => window.scrollY), scroll, 'swiping back restores the Money scroll offset');
      }
      if (await page.locator('.ui-tab-viewport').count()) {
        for (const [name, sequence] of Object.entries(report.sequences)) {
          const anchored = sequence.frames.find(frame => frame.title)?.title;
          for (const frame of sequence.frames) {
            if (anchored) {
              assert.equal(frame.title?.x, anchored.x, name + ' keeps the route title horizontally anchored');
              assert.equal(frame.title?.y, anchored.y, name + ' keeps the route title vertically anchored');
              assert.ok(frame.coverageGap < 48, name + ' keeps the track clipped to the visible content area');
            }
            const sorted = frame.surfaces.filter(surface => surface.left != null && surface.visibility === 'visible').sort((a, b) => a.left - b.left);
            if (name.startsWith('plan-') && name !== 'plan-today') {
              assert.ok(sorted.length <= 1, name + ' renders one Plan header');
            }
            if (sorted.length === 2) {
              assert.ok(Math.abs(sorted[0].right - sorted[1].left) < 1, name + ' panels share one seam');
              assert.equal(sorted[0].opacity, 1, name + ' foreground remains opaque');
              assert.equal(sorted[1].opacity, 1, name + ' neighboring panel remains opaque');
              if (anchored && name.startsWith('swipe-')) {
                const indicator = frame.surfaces.find(surface => surface.id === '.alive-nav-indicator');
                const slotWidth = viewport.width / 4;
                const first = ['screen-dashboard', 'screen-finance', 'screen-plan', 'screen-settings'].indexOf(sorted[0].id);
                if (first >= 0 && indicator) {
                  const left = Math.max(0, Math.min(1, -sorted[0].left / viewport.width));
                  const expectedSlot = first + left;
                  const indicatorSlot = indicator.x / (indicator.width || slotWidth);
                  assert.ok(Math.abs(expectedSlot - indicatorSlot) < .08, name + ' indicator tracks panel progress');
                }
              }
            }
          }
        }
      }
    }
    if (fourDestinations) {
      await tab('settings').click();
      await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
      await page.waitForTimeout(620);
      await button('Appearance').click();
      await page.getByRole('heading', { name: 'Appearance', exact: true }).waitFor();
      const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null ? [] : [{ x, y: 350, id: 1 }] });
      await touch('touchStart', 74);
      await touch('touchMove', 136);
      await touch('touchMove', 265);
      await touch('touchEnd');
      assert.equal(await tab('settings').getAttribute('aria-current'), 'page');
      await page.getByRole('heading', { name: 'Appearance', exact: true }).waitFor();
      report.interactions.push('A horizontal touch on Appearance does not switch primary destinations');
    }
    if (process.env.LIFEOS_PLAN_PRESS_COMPARE === '1') {
      await tab('plan').click();
      const action = page.getByRole('button', { name: 'Add task', exact: true });
      await action.waitFor();
      await page.waitForTimeout(620);
      const box = await action.boundingBox();
      await page.screenshot({ path: path.join(evidence, 'plan-press-rest.png') });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(80);
      report.planPress = await action.evaluate(element => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow }));
      await page.screenshot({ path: path.join(evidence, 'plan-press-held.png'), animations: 'allow' });
      await page.mouse.move(2, 2);
      await page.mouse.up();
      if (fourDestinations) {
        assert.equal(report.planPress.transform, 'none');
        assert.notEqual(report.planPress.shadow, 'none');
      }
    }
    await cdp.send('Page.stopScreencast');
    assert.deepEqual(report.errors, []);
    return;
  }
  if (primaryOnly) {
    for (let i = 1; i <= 5; i++) {
      await tab('dashboard').click();
      await capture('warm-today-money-' + i, tab('finance'), screens);
      await capture('warm-money-plan-' + i, tab('plan'), screens);
    }
    await cdp.send('Page.stopScreencast');
    assert.deepEqual(report.errors, []);
    return;
  }
  await capture('create-task', button('Create Task'), '#record-dialog');
  await capture('expand-task', composer().getByText('Add details', { exact: true }), '.task-composer-section|.alive-disclosure-grid|.alive-disclosure-body');
  await capture('close-task', button('Close', composer()), '#record-dialog');
  await button('Create Task').click();
  await composer().getByLabel('Task title').fill('Review weekly plan');
  await composer().locator('button[type=submit]').click();
  await button('Protect this device and save').click();
  await button(/Review weekly plan/).waitFor();
  await capture('complete-task', page.getByRole('checkbox', { name: 'Mark Review weekly plan complete' }), '.plan-hub-task-check input|.alive-task-mark path|[data-alive-doodle]');
  await tab('dashboard').click();
  await capture('open-profile', button('Profile'), '.profile-track-page|.profile-settings');
  await capture('appearance', button('Appearance'), '.profile-track-page|.profile-settings');
  const profileBack = await page.locator('.feather-expressive').count() ? 'Back to Profile' : 'Back from profile';
  await capture('profile-back', button(profileBack), '.profile-track-page|.profile-settings');
  await capture('profile-close', tab('plan'), '.profile-track-page|.profile-settings');
  await tab('finance').click();
  const money = page.getByRole('navigation', { name: 'Money destinations' });
  await capture('money-scheduled', button('Schedule', money), '.money-page|[data-testid=money-planning]');
  await button('Add').click();
  const planForm = page.locator('#money-commitment-dialog');
  await planForm.getByRole('textbox', { name: 'Name', exact: true }).fill('Monthly utility');
  await planForm.getByLabel('Amount', { exact: false }).fill('30.50');
  await planForm.getByLabel('Frequency').selectOption('monthly');
  await button('Save plan', planForm).click();
  await page.getByTestId('money-planning').getByText('Monthly utility', { exact: true }).waitFor();
  const alive = await page.locator('.alive-nav').count() > 0;
  const recurring = alive ? button('View Monthly utility') : button('Edit', page.locator('.scheduled-plan-row').filter({ hasText: 'Monthly utility' }));
  const scheduledSurface = '#money-commitment-dialog|dialog[data-scheduled-details]|.money-page';
  await capture('scheduled-detail', recurring, scheduledSurface);
  await capture('scheduled-back', alive ? button('Back to Schedule') : button('Cancel', planForm), scheduledSurface);
  await tab('plan').click();
  const plan = page.getByRole('navigation', { name: 'Plan destinations' });
  await capture('first-habit', button('Habits', plan), '#screen-habits|[data-alive-doodle]|.alive-doodle-ink');
  await button(/Add habit/).click();
  await composer().getByLabel('Habit name').fill('Read ten pages');
  await button('Save habit', composer()).click();
  await capture('habit-check-in', button('Mark Read ten pages complete'), '.alive-habit-check|.alive-habit-day|.alive-habit-check svg');
  await button('Mark Read ten pages incomplete').waitFor();
  await capture('first-goal', button('Goals', plan), '#screen-goals|[data-alive-doodle]|.alive-doodle-ink');
  await button(/Add goal/).click();
  await composer().getByLabel('Goal title').fill('Finish one course');
  await composer().getByLabel('Target', { exact: true }).fill('10');
  await button('Save goal', composer()).click();
  await button(/^Finish one course/).click();
  await button('Update progress').click();
  await composer().getByLabel('Current progress').fill('6');
  await capture('goal-progress', button('Save progress', composer()), '[role=progressbar]|.lifeos-progress-fill|#record-dialog');
  await page.getByRole('progressbar', { name: 'Finish one course progress' }).waitFor();
  assert.equal(await page.getByRole('progressbar', { name: 'Finish one course progress' }).getAttribute('aria-valuenow'), '60');
  await button('+ Milestone').click();
  await composer().getByLabel('Milestone title').fill('Finish the first module');
  await button('Save milestone', composer()).click();
  await capture('goal-milestone', page.getByRole('checkbox', { name: /Finish the first module/ }), '[data-alive-doodle]|.alive-doodle-ink');
  await button('Back to list').click();
  if (process.env.LIFEOS_MOTION_REPEAT === '1') {
    for (let i = 1; i <= 3; i++) {
      await tab('dashboard').click();
      await capture('warm-today-money-' + i, tab('finance'), screens);
      await capture('warm-money-plan-' + i, tab('plan'), screens);
    }
  }
  if (alive) {
    const settled = name => page.waitForFunction(name => document.querySelector('[data-tab="' + name + '"]')?.getAttribute('aria-current') === 'page'
      && !document.querySelector('.ui-tab-screen[data-transition-state=outgoing]')
      && document.querySelectorAll('.ui-tab-screen:not([hidden]):not([inert])').length === 1, name);
    const targets = await page.locator('.app-bottom-nav [data-tab]:not([data-tab=profile])').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }));
    for (let index = 0; index < 30; index++) {
      const point = targets[index % targets.length];
      await page.mouse.click(point.x, point.y);
    }
    await settled('plan');
    report.interactions.push('Thirty rapid primary tab clicks settled to one accessible Plan screen');

    await tab('dashboard').click();
    await settled('dashboard');
    const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null ? [] : [{ x, y: 215, id: 1 }] });
    await touch('touchStart', 304);
    await touch('touchMove', 254);
    if (!reduced) await page.locator('[data-gesture-dragging=true]').waitFor();
    await touch('touchCancel');
    await page.locator('[data-gesture-dragging=true]').waitFor({ state: 'detached' });
    await settled('dashboard');
    report.interactions.push('Cancelled native touch dispatch released the drag and preserved Today');

    await touch('touchStart', 304);
    await touch('touchMove', 235);
    await touch('touchMove', 288);
    await touch('touchEnd');
    await settled('dashboard');
    report.interactions.push('Reversed touch settled back to Today');
    await touch('touchStart', 304);
    await touch('touchMove', 236);
    await touch('touchMove', 140);
    await touch('touchEnd');
    await settled('finance');
    report.interactions.push('Completed touch navigated from Today to Money');
    for (const sequence of Object.values(report.sequences)) {
      for (const frame of sequence.frames) {
        for (const surface of frame.surfaces) {
          if (surface.state === 'outgoing') assert.equal(surface.inert, true);
          if (reduced && /^screen-|record-dialog|scheduled|profile/.test(surface.id)) assert.ok(Math.abs(surface.x) < .01);
        }
      }
    }
  }
  await cdp.send('Page.stopScreencast');
  assert.deepEqual(report.errors, []);
}

main().catch(error => { report.failure = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  server?.close();
});
