
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
  let timer, captured, sorts = 0, opens = 0;
  const listeners = new Map();
  const mockWindow = {
    setTimeout: handler => { timer = handler; return 1; }, addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener() {},
  };
  const document = { addEventListener() {}, removeEventListener() {} };
  const order = ['focus', 'money'];
  const card = {
    dataset: { todayCard: 'focus' },
    getBoundingClientRect: () => ({ top: 10, left: 10 }),
    removeAttribute: name => { delete card.dataset[name.replace('data-today-', 'today').replace(/(pressed|lifted)/, match => match[0].toUpperCase() + match.slice(1))]; },
    style: { getPropertyValue: () => '0px', removeProperty() {} },
  };
  const root = { contains: () => true, setPointerCapture: () => { captured = true; }, hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; } };
  const target = interactive => ({ closest: selector => selector === '[data-today-card]' ? card : (interactive ? {} : null) });
  const event = { target: target(false), currentTarget: root, pointerId: 1, button: 0, isPrimary: true, clientX: 12, clientY: 12,
    preventDefault() {}, stopPropagation() {} };
  const react = { useRef: ref, useEffect: fn => { fn(); }, useState: initial => [initial, () => {}] };
  const compiled = ts.transpileModule(fs.readFileSync('src/hooks/useTodayCardDrag.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const output = {};
  new Function('exports', 'require', 'window', 'document', 'navigator', 'requestAnimationFrame', 'cancelAnimationFrame', 'clearTimeout', compiled)(
    output, name => name === 'react' ? react : { flushSync: callback => callback() }, mockWindow, document, {},
    () => 1, () => {}, () => { timer = undefined; },
  );
  const hook = output.useTodayCardDrag(order, true, reduced, () => {}, next => { assert.equal(next, order); sorts++; },
    (id, trigger) => { assert.equal(id, 'focus'); assert.equal(trigger, card); opens++; });
  return { card, event, handlers: hook.handlers, listeners, child: target(true), beginDrag: () => timer(), isDragging: hook.isDragging,
    get opens() { return opens; }, get sorts() { return sorts; } };
}

const press = cardHook();
press.handlers.onPointerDown(press.event);
assert.equal(press.card.dataset.todayPressed, 'true');
press.handlers.onPointerMove({ ...press.event, clientY: 30 });
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
press.handlers.onPointerUp(press.event);
assert.equal(press.isDragging(), false);
assert.equal(press.sorts, 1);
press.handlers.onClick(press.event);
assert.equal(press.opens, 1, 'release from a reorder cannot navigate');
const reduced = cardHook(true);
reduced.handlers.onPointerDown(reduced.event);
assert.equal(reduced.card.dataset.todayPressed, undefined);
reduced.handlers.onPointerCancel();

assert.equal(formatHabitQuantity(2, 'L'), '2 L');
assert.equal(formatHabitProgress(3, undefined, 2, 'L'), 'Recorded 3 (unit unknown) · Target 2 L');
assert.equal(formatHabitProgress(300, 'mL', 2, 'L'), 'Recorded 300 mL · Target 2 L');
assert.equal(formatHabitProgress(1, 'L', 2, 'L'), '1 / 2 L');
assert.equal(formatHabitProgress(undefined, undefined, 2, 'L'), '0 / 2 L');
console.log('REFINEMENT PASS: Today origin/Back precedence, nested routes, focus target, press cancellation, child actions, drag click suppression, reduced motion and units.');
