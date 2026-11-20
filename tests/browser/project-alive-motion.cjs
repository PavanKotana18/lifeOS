'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createServer } = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const root = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const evidence = path.resolve(process.argv[3]);
const port = Number(process.env.LIFEOS_MOTION_PORT || 4183);
const origin = 'http://127.0.0.1:' + port;
const reduced = process.env.LIFEOS_MOTION_REDUCED === '1';
const viewport = { width: 390, height: 844 };
const colorScheme = process.env.LIFEOS_MOTION_SCHEME === 'dark' ? 'dark' : 'light';
const primaryOnly = process.env.LIFEOS_MOTION_PRIMARY === '1';
fs.mkdirSync(evidence, { recursive: false });

const report = {
  source: process.env.LIFEOS_MOTION_SOURCE || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  viewport, reduced, colorScheme, sequences: {}, errors: [], interactions: [],
  worktreeStatus: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(),
};
let server, browser;

async function main() {
  const output = process.env.LIFEOS_MOTION_FIXTURE_DIST || path.join(evidence, 'fixture-dist');
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
  await page.goto(origin + '/tests/browser/index.html?onboarding-auth=success', { waitUntil: 'domcontentloaded', timeout: 60000 });
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

  const cdp = await context.newCDPSession(page);
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
      const send = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null ? [] : [{ x, y: swipeY, id: 1 }] });
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
      ['swipe-plan-money', 'finance', 'right'], ['swipe-money-today', 'dashboard', 'right'],
    ]) {
      await capture(name, tab(destination), screens, direction, name === 'swipe-plan-money' ? 395 : 215);
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
        await capture('swipe-scrolled-money-plan', tab('plan'), screens, 'left', 195);
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
                const slotWidth = viewport.width / 3;
                const first = ['screen-dashboard', 'screen-finance', 'screen-plan'].indexOf(sorted[0].id);
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
  await capture('open-profile', button('Open profile and settings'), '.profile-page-screen|.profile-settings');
  await capture('appearance', button('Appearance'), '.profile-page-screen|.profile-settings');
  const profileBack = await page.locator('.feather-expressive').count() ? 'Profile' : 'Back from profile';
  await capture('profile-back', button(profileBack), '.profile-page-screen|.profile-settings');
  await capture('profile-close', button('Back from profile'), '.profile-page-screen|.profile-settings');
  await tab('finance').click();
  const money = page.getByRole('navigation', { name: 'Money destinations' });
  await capture('money-scheduled', button('Scheduled', money), '.money-page|[data-testid=money-planning]');
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
  await capture('scheduled-back', alive ? button('Back to Scheduled') : button('Cancel', planForm), scheduledSurface);
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
    const targets = await page.locator('.app-bottom-nav [data-tab]').evaluateAll(nodes => nodes.map(node => {
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
