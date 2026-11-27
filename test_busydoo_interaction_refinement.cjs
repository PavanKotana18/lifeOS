
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const h = require('./tests/wp0/production-harness.cjs');
require('./scripts/register-ts-test-loader.cjs');
const { resolveBackAction } = require('./src/services/domainUtils.ts');
const { popTabHistory } = require('./src/services/tabHistory.ts');
const { formatHabitQuantity, formatHabitProgress } = require('./src/services/userPreferences.ts');
const { primaryDestinationForTab } = require('./src/services/navigationCatalog.ts');

const ref = current => ({ current });

function navigation(destination, initial = {}) {
  const history = ['settings', 'dashboard'];
  const todayOrigin = ref(null), todayReturnFocus = ref(null);
  const navigationHistory = ref(history);
  const financeSubtabHistory = ref(['transactions']);
  const taskDetailReturnTabRef = ref('plan'), taskDetailReturnFocusRef = ref({ previous: true });
  const taps = [], focus = {};
  const state = { appReady: true, isLocked: false, activeTab: destination, financeSubtab: 'overview',
    habitsSubtab: 'checklist', goalsSubtab: 'active', ...initial };
  const open = h.bind(h.appFunction('openFromToday'), {
    todayOrigin, navigationHistory, financeSubtabHistory, taskDetailReturnTabRef, taskDetailReturnFocusRef,
    navigateTo: tab => { taps.push('open:' + tab); navigationHistory.current = [...history, 'dashboard']; },
    setFinanceSubtab: value => { state.financeSubtab = value; },
    setLifeDetail: value => { state.lifeDetail = value; },
    setPlannerDetailTaskId: value => { state.plannerDetailTaskId = value; },
    setHabitsSubtab: value => { state.habitsSubtab = value; }, setGoalsSubtab: value => { state.goalsSubtab = value; },
  });
  const fakeDocument = { querySelector: () => null, querySelectorAll: () => [] };
  const back = h.bind(h.appFunction('navigateBack'), {
    document: fakeDocument, backState: ref(state), swipePointer: ref(null), cancelProfileAdmission: () => false,
    navigationMotion: { cancelPending() {} }, confirmationResolver: ref(null), firstRecordSecurityResolver: ref(null),
    todayOrigin, todayReturnFocus, financeSubtabHistory, navigationHistory, resolveBackAction, popTabHistory,
    rememberActiveScroll: () => taps.push('scroll'),
    showLifeDetail: value => { state.lifeDetail = value; taps.push('detail'); },
    requestCloseForm: () => { state.createKind = null; taps.push('dialog'); }, setModalContent() {},
    closeTaskDetail: () => { state.plannerDetailTaskId = null; taps.push('task'); },
    setFinanceSubtab: value => { state.financeSubtab = value; taps.push('finance:' + value); },
    transitionToTab: tab => taps.push('back:' + tab),
  });
  return { open: () => open(destination, focus), back, todayOrigin, todayReturnFocus, navigationHistory,
    financeSubtabHistory, state, taps, focus, history, doc: fakeDocument };
}

const money = navigation('finance');
money.open();
assert.equal(money.state.financeSubtab, 'monthly');
assert.deepEqual(money.financeSubtabHistory.current, []);
money.state.financeSubtab = 'budgets';
money.financeSubtabHistory.current = ['monthly'];
money.back();
assert.equal(money.state.financeSubtab, 'monthly');
assert.equal(money.todayOrigin.current.destination, 'finance');
money.back();
assert.equal(money.taps.at(-1), 'back:dashboard');
assert.equal(money.todayReturnFocus.current, money.focus);
assert.equal(money.state.financeSubtab, 'overview');
assert.equal(money.todayOrigin.current, null);
assert.equal(money.navigationHistory.current, money.history);

const directMoney = navigation('finance', { financeSubtab: 'monthly' });
directMoney.financeSubtabHistory.current = ['overview'];
directMoney.back();
assert.deepEqual(directMoney.taps, ['scroll', 'finance:overview']);

for (const route of ['plan', 'habits', 'goals', 'planner']) {
  const fixture = navigation(route);
  fixture.open();
  fixture.state.createKind = 'task';
  fixture.back();
  assert.equal(fixture.taps.at(-1), 'dialog');
  assert.equal(fixture.todayOrigin.current.destination, route);
  if (route === 'habits' || route === 'goals') {
    fixture.state.lifeDetail = { kind: route === 'habits' ? 'habit' : 'goal' };
    fixture.back();
    assert.equal(fixture.taps.at(-1), 'detail');
  }
  if (route === 'planner') {
    fixture.state.plannerDetailTaskId = 'synthetic';
    fixture.back();
    assert.equal(fixture.taps.at(-1), 'task');
  }
  fixture.back();
  assert.equal(fixture.taps.at(-1), 'back:dashboard');
  assert.equal(fixture.todayReturnFocus.current, fixture.focus);
}

const replacementOrigin = ref({ destination: 'finance', history: [] }), replacementFocus = ref({});
const navigateTo = h.bind(h.appFunction('navigateTo'), {
  activeTabRef: ref('finance'), primaryDestinationForTab, todayOrigin: replacementOrigin, todayReturnFocus: replacementFocus,
  transitionToTab() {}, cancelProfileAdmission() {},
});
navigateTo('plan', 'left');
assert.equal(replacementOrigin.current, null);
assert.equal(replacementFocus.current, null);

function cardHook(reduced = false) {
  let timer, frame, captured, sorts = 0, opens = 0, measurements = 0, committed;
  const listeners = new Map();
  const mockWindow = {
    setTimeout: handler => { timer = handler; return 1; }, addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener() {}, innerHeight: 600, scrollX: 0, scrollY: 0,
    scrollBy: ({ top }) => { mockWindow.scrollY = Math.max(0, mockWindow.scrollY + top); },
  };
  const document = { addEventListener() {}, removeEventListener() {} };
  const order = ['focus', 'money'];
  const elements = order.map((id, index) => {
    const styles = new Map(), animations = [];
    return {
      dataset: { todayCard: id }, styles, animations,
      get offsetTop() {
        const ordered = Number(styles.get('--today-sort-order') || index + 2);
        return ordered === 2 ? 0 : index === 0 ? 120 : 100;
      },
      offsetLeft: 0, offsetWidth: 240, offsetHeight: index === 0 ? 100 : 120,
      getClientRects: () => [{}],
      removeAttribute: name => { delete elements[index].dataset[name.replace(/^data-/, '').replace(/-([a-z])/g, (_, char) => char.toUpperCase())]; },
      style: { getPropertyValue: name => styles.get(name) || '', setProperty: (name, value) => styles.set(name, value),
        removeProperty: name => styles.delete(name) },
      animate: frames => {
        const animation = { currentTime: 0, cancel() { this.cancelled = true; }, frames };
        animations.push(animation);
        return animation;
      },
    };
  });
  const card = elements[0];
  const root = { contains: () => true, setPointerCapture: () => { captured = true; }, hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; }, querySelectorAll: () => elements,
    getBoundingClientRect: () => { measurements++; return { left: 10, top: 10 - mockWindow.scrollY }; } };
  const target = interactive => ({ closest: selector => selector === '[data-today-card]' ? card : (interactive ? {} : null) });
  const event = { target: target(false), currentTarget: root, pointerId: 1, button: 0, isPrimary: true, clientX: 35, clientY: 45,
    preventDefault() {}, stopPropagation() {} };
  const react = { useRef: ref, useEffect: fn => { fn(); }, useLayoutEffect: fn => { fn(); } };
  const compiled = ts.transpileModule(fs.readFileSync('src/hooks/useTodayCardDrag.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const output = {};
  new Function('exports', 'require', 'window', 'document', 'navigator', 'requestAnimationFrame', 'cancelAnimationFrame', 'clearTimeout', compiled)(
    output, name => name === 'react' ? react : require('./src/services/springMotion.ts'), mockWindow, document, {},
    callback => { frame = callback; return 1; }, () => {}, () => { timer = undefined; },
  );
  const hook = output.useTodayCardDrag(order, true, reduced, () => {}, next => { sorts++; committed = next; },
    (id, trigger) => { assert.equal(id, 'focus'); assert.equal(trigger, card); opens++; });
  return { card, peer: elements[1], event, handlers: hook.handlers, listeners, child: target(true),
    beginDrag: () => timer(), frame: now => frame(now), isDragging: hook.isDragging,
    get measurements() { return measurements; }, get scrollY() { return mockWindow.scrollY; }, get committed() { return committed; },
    get opens() { return opens; }, get sorts() { return sorts; } };
}

const press = cardHook();
press.handlers.onPointerDown(press.event);
assert.equal(press.card.dataset.todayPressed, 'true');
press.handlers.onPointerMove({ ...press.event, clientY: 70 });
assert.equal(press.card.dataset.todayPressed, undefined);
press.handlers.onPointerDown(press.event);
press.listeners.get('scroll')();
assert.equal(press.card.dataset.todayPressed, undefined);
press.handlers.onPointerDown(press.event);
press.handlers.onPointerUp(press.event);
press.handlers.onClick(press.event);
assert.equal(press.opens, 1);
press.handlers.onClick({ ...press.event, target: press.child });
assert.equal(press.opens, 1);
press.handlers.onPointerDown(press.event);
press.beginDrag();
assert.equal(press.isDragging(), true);
assert.equal(press.card.dataset.todayPressed, undefined);
press.frame(0);
press.handlers.onPointerMove({ ...press.event, clientY: 176 });
press.frame(16);
assert.equal(press.measurements, 1, 'Midpoint dead zone and pointer frames do not read layout');
assert.equal(press.card.styles.get('--today-drag-y'), '131px');
press.handlers.onPointerMove({ ...press.event, clientY: 195 });
press.frame(32);
assert.equal(press.measurements, 2, 'Only a confirmed reorder takes a new snapshot');
assert.equal(press.card.styles.get('--today-sort-order'), '3');
assert.equal(press.card.styles.get('--today-drag-y'), '30px');
assert.equal(press.peer.animations.length, 1);
press.frame(48);
press.frame(64);
assert.equal(press.measurements, 2);
assert.equal(press.peer.animations.length, 1);
assert.equal(press.sorts, 0);
press.handlers.onPointerUp(press.event);
press.handlers.onPointerUp(press.event);
assert.equal(press.isDragging(), false);
assert.equal(press.sorts, 1);
assert.deepEqual(press.committed, ['money', 'focus']);
assert.equal(press.card.animations.at(-1).frames[0].transform, 'translate3d(0px, 30px, 0) scale(1.025)');
press.handlers.onClick(press.event);
assert.equal(press.opens, 1, 'release from a reorder cannot navigate');

const scrolled = cardHook();
scrolled.handlers.onPointerDown(scrolled.event);
scrolled.beginDrag();
scrolled.frame(0);
scrolled.handlers.onPointerMove({ ...scrolled.event, clientY: 595 });
scrolled.frame(16);
const firstScroll = scrolled.scrollY;
scrolled.frame(32);
assert.ok(firstScroll > 0 && scrolled.scrollY - firstScroll > firstScroll, 'Edge scroll ramps up');
assert.equal(parseFloat(scrolled.card.styles.get('--today-drag-y')), 550 + scrolled.scrollY);
assert.equal(scrolled.measurements, 1, 'Autoscroll compensates using viewport scroll without remeasuring slots');
scrolled.handlers.onPointerCancel();
assert.equal(scrolled.sorts, 0);
const reduced = cardHook(true);
reduced.handlers.onPointerDown(reduced.event);
assert.equal(reduced.card.dataset.todayPressed, undefined);
reduced.beginDrag();
reduced.frame(0);
reduced.handlers.onPointerCancel();
assert.equal(reduced.card.animations.length, 0);
assert.equal(reduced.sorts, 0);

assert.equal(formatHabitQuantity(2, 'L'), '2 L');
assert.equal(formatHabitProgress(3, undefined, 2, 'L'), 'Recorded 3 (unit unknown) · Target 2 L');
assert.equal(formatHabitProgress(300, 'mL', 2, 'L'), 'Recorded 300 mL · Target 2 L');
assert.equal(formatHabitProgress(1, 'L', 2, 'L'), '1 / 2 L');
assert.equal(formatHabitProgress(undefined, undefined, 2, 'L'), '0 / 2 L');
console.log('REFINEMENT PASS: Today origin/Back precedence, nested routes, focus target, press cancellation, child actions, drag click suppression, reduced motion and units.');
