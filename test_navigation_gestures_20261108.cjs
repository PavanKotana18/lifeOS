'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const {
  resolvePrimarySwipe, classifyPointerAxis, beginPrimaryGesture,
  updatePrimaryGesture, resolvePrimaryGestureEnd, recordGestureTrace,
  primaryGestureStartBlockReason, shouldStartPrimaryGesture,
  isHardGestureExcludedTarget, shouldSuppressPrimaryGestureClick,
  shouldAnimatePrimaryGestureSettlement,
} = require('./src/services/navigationGestures.ts');
const sample = (overrides = {}) => ({ deltaX: 100, deltaY: 0, durationMs: 240, startedAtSystemEdge: false, startedInHorizontalControl: false, startedInHardExcludedControl: false, enabled: true, ...overrides });
assert.equal(resolvePrimarySwipe('dashboard', sample({ deltaX: -120 })), 'finance');
assert.equal(resolvePrimarySwipe('finance', sample({ deltaX: 120 })), 'dashboard');
assert.equal(resolvePrimarySwipe('plan', sample({ deltaX: -120 })), 'life');
assert.equal(resolvePrimarySwipe('life', sample({ deltaX: -120 })), null, 'last destination does not wrap');
assert.equal(resolvePrimarySwipe('dashboard', sample({ deltaX: 120 })), null, 'first destination does not wrap');
assert.equal(resolvePrimarySwipe('planner', sample({ deltaX: 120 })), 'finance', 'child routes resolve through their primary destination');
assert.equal(resolvePrimarySwipe('finance', sample({ deltaX: -90, deltaY: 64 })), null, 'diagonal scroll is not captured');
assert.equal(resolvePrimarySwipe('finance', sample({ deltaX: -20, deltaY: 90 })), null, 'vertical scrolling is not captured');
assert.equal(resolvePrimarySwipe('finance', sample({ deltaX: -67 })), null, 'slow short gesture is below threshold');
assert.equal(resolvePrimarySwipe('finance', sample({ deltaX: -40, durationMs: 50 })), 'plan', 'short fast swipe is accepted');
assert.equal(resolvePrimarySwipe('finance', sample({ startedAtSystemEdge: true })), null);
assert.equal(resolvePrimarySwipe('finance', sample({ startedInHorizontalControl: true })), null);
assert.equal(resolvePrimarySwipe('finance', sample({ startedInHardExcludedControl: true })), null);
assert.equal(resolvePrimarySwipe('finance', sample({ enabled: false })), null);

const startContext = (overrides = {}) => ({ enabled: true, pointerType: 'touch', targetKind: 'content', ...overrides });
assert.equal(shouldStartPrimaryGesture(startContext()), true, 'ordinary content can begin a candidate gesture');
assert.equal(shouldStartPrimaryGesture(startContext({ targetKind: 'ordinary-interactive' })), true,
  'buttons, row actions and other ordinary controls remain swipe candidates until intent is clear');
assert.equal(isHardGestureExcludedTarget('ordinary-interactive'), false,
  'ordinary buttons are not rejected at pointer-down');
assert.equal(isHardGestureExcludedTarget('content'), false, 'cards, text and summaries are eligible');
const buttonCandidate = beginPrimaryGesture({ pointerId: 3, x: 180, y: 260, at: 700, viewportWidth: 400 });
assert.equal(shouldSuppressPrimaryGestureClick(buttonCandidate), false,
  'an ordinary button tap is not suppressed while intent is pending');
const buttonDrag = updatePrimaryGesture(buttonCandidate, 3, 92, 264);
assert.equal(buttonDrag.intent, 'horizontal');
assert.equal(shouldSuppressPrimaryGestureClick(buttonDrag.session), true,
  'the same button surface yields ownership after horizontal intent is recognized');
assert.equal(resolvePrimaryGestureEnd('dashboard', buttonDrag.session, 3, 92, 264, 940, true), 'finance');
for (const targetKind of ['text-entry', 'native-picker', 'slider', 'chart', 'horizontal-control', 'dialog']) {
  assert.equal(isHardGestureExcludedTarget(targetKind), true, `${targetKind} keeps its own gesture behavior`);
  assert.equal(shouldStartPrimaryGesture(startContext({ targetKind })), false,
    `${targetKind} is rejected before pointer capture`);
}
assert.equal(primaryGestureStartBlockReason(startContext({ enabled: false })), 'preference-disabled');
assert.equal(primaryGestureStartBlockReason(startContext({ pointerType: 'mouse' })), 'mouse-pointer');
assert.equal(primaryGestureStartBlockReason(startContext({ settingsScreen: true })), 'settings-screen');
assert.equal(primaryGestureStartBlockReason(startContext({ modalOpen: true })), 'modal-open');
assert.equal(primaryGestureStartBlockReason(startContext({ multiplePointers: true })), 'multiple-pointers');
assert.equal(primaryGestureStartBlockReason(startContext({ systemEdge: true })), 'system-edge');
assert.equal(classifyPointerAxis(4, 3), 'pending');
assert.equal(classifyPointerAxis(16, 4), 'horizontal');
assert.equal(classifyPointerAxis(4, 16), 'vertical');
assert.equal(classifyPointerAxis(12, 10), 'pending', 'ambiguous diagonal motion is left to the browser');

const started = beginPrimaryGesture({ pointerId: 7, x: 220, y: 300, at: 1000, viewportWidth: 400 });
const wrongPointer = updatePrimaryGesture(started, 8, 120, 300);
assert.equal(wrongPointer.accepted, false, 'a secondary pointer cannot control the active gesture');
assert.equal(wrongPointer.session.axis, 'pending');
const dragged = updatePrimaryGesture(started, 7, 120, 308);
assert.equal(dragged.accepted, true, 'horizontal intent is followed by the active screen');
assert.equal(dragged.intent, 'horizontal', 'intent is exposed separately from a tap/pending state');
assert.equal(dragged.session.axis, 'horizontal');
assert.equal(dragged.session.latestOffsetX, -92, 'the active screen follows near finger speed');
assert.equal(shouldSuppressPrimaryGestureClick(dragged.session), true,
  'a button click is suppressed only after horizontal ownership is established');
const longDrag = updatePrimaryGesture(started, 7, -1000, 300);
assert.equal(longDrag.session.latestOffsetX, -168, 'drag resistance is bounded by the current logical viewport width');
assert.equal(resolvePrimaryGestureEnd('finance', dragged.session, 7, 120, 308, 1120, true), 'plan');
assert.equal(resolvePrimaryGestureEnd('finance', dragged.session, 8, 120, 308, 1120, true), null,
  'pointer-up from another touch cannot commit navigation');

const vertical = updatePrimaryGesture(started, 7, 224, 330);
assert.equal(vertical.intent, 'vertical');
assert.equal(vertical.session.axis, 'vertical', 'vertical intent is permanently handed to page scrolling');
assert.equal(shouldSuppressPrimaryGestureClick(vertical.session), false, 'vertical scrolling preserves a control tap');
assert.equal(updatePrimaryGesture(vertical.session, 7, 100, 330).accepted, false,
  'a later horizontal wobble cannot steal an established vertical scroll');
assert.equal(resolvePrimaryGestureEnd('finance', vertical.session, 7, 100, 330, 1120, true), null);

const short = beginPrimaryGesture({ pointerId: 9, x: 200, y: 20, at: 2000, viewportWidth: 400 });
assert.equal(shouldSuppressPrimaryGestureClick(short), false, 'a tap starts pending and stays activatable');
const shortDrag = updatePrimaryGesture(short, 9, 180, 21);
assert.equal(resolvePrimaryGestureEnd('finance', shortDrag.session, 9, 180, 21, 2050, true), null,
  'a short incidental movement does not navigate');
assert.equal(shouldSuppressPrimaryGestureClick(shortDrag.session), true,
  'a deliberate horizontal drag does not click its starting control even if too short to navigate');
assert.equal(resolvePrimaryGestureEnd('finance', dragged.session, 7, 120, 308, 2120, false), null,
  'turning off the user preference cancels the release');
assert.equal(shouldAnimatePrimaryGestureSettlement(false), true, 'normal motion allows the short settlement');
assert.equal(shouldAnimatePrimaryGestureSettlement(true), false,
  'reduced motion disables decorative settlement without disabling swipe navigation');

const rapidLeft = beginPrimaryGesture({ pointerId: 20, x: 300, y: 150, at: 4000, viewportWidth: 400 });
const rapidLeftMove = updatePrimaryGesture(rapidLeft, 20, 210, 152);
assert.equal(resolvePrimaryGestureEnd('dashboard', rapidLeftMove.session, 20, 210, 152, 4140, true), 'finance');
const rapidRight = beginPrimaryGesture({ pointerId: 21, x: 100, y: 150, at: 4200, viewportWidth: 400 });
const rapidRightMove = updatePrimaryGesture(rapidRight, 21, 180, 151);
assert.equal(resolvePrimaryGestureEnd('finance', rapidRightMove.session, 21, 180, 151, 4340, true), 'dashboard',
  'a fresh rapid reverse gesture starts from the latest route without queued stale direction');
assert.equal(resolvePrimaryGestureEnd('finance', rapidLeftMove.session, 21, 210, 152, 4340, true), null,
  'an interrupted gesture cannot be committed by a different pointer');

const traceHost = globalThis;
delete traceHost.__lifeosGestureTrace;
recordGestureTrace({ event: 'pointerdown', pointerId: 1, deltaX: 0, deltaY: 0, state: 'pending' }, false);
assert.equal(traceHost.__lifeosGestureTrace, undefined, 'production-disabled diagnostics do not retain traces');
for (let index = 0; index < 45; index++) {
  recordGestureTrace({ event: 'pointermove', pointerId: index, deltaX: index, deltaY: 0, state: 'horizontal' }, true);
}
assert.equal(traceHost.__lifeosGestureTrace.length, 40, 'diagnostic buffer stays bounded');
assert.equal(traceHost.__lifeosGestureTrace[0].pointerId, 5, 'old traces roll off without accumulating');
assert.equal(Object.hasOwn(traceHost.__lifeosGestureTrace[0], 'target'), false,
  'diagnostics contain no UI text or private record data');
delete traceHost.__lifeosGestureTrace;

console.log('NAVIGATION GESTURES: thresholds, directions, axis lock, pointer identity, cancellation, preference and bounded privacy-safe diagnostics passed.');
