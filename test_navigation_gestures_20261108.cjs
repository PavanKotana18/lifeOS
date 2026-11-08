'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const {
  resolvePrimarySwipe, classifyPointerAxis, beginPrimaryGesture,
  updatePrimaryGesture, resolvePrimaryGestureEnd, recordGestureTrace,
} = require('./src/services/navigationGestures.ts');
const sample = (overrides = {}) => ({ deltaX: 100, deltaY: 0, durationMs: 240, startedOnInteractive: false, startedAtSystemEdge: false, startedInHorizontalControl: false, enabled: true, ...overrides });
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
assert.equal(resolvePrimarySwipe('finance', sample({ startedOnInteractive: true })), null);
assert.equal(resolvePrimarySwipe('finance', sample({ startedAtSystemEdge: true })), null);
assert.equal(resolvePrimarySwipe('finance', sample({ startedInHorizontalControl: true })), null);
assert.equal(resolvePrimarySwipe('finance', sample({ enabled: false })), null);
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
assert.equal(dragged.session.axis, 'horizontal');
assert.equal(dragged.session.latestOffsetX, -92, 'the active screen follows near finger speed');
const longDrag = updatePrimaryGesture(started, 7, -1000, 300);
assert.equal(longDrag.session.latestOffsetX, -168, 'drag resistance is bounded by the current logical viewport width');
assert.equal(resolvePrimaryGestureEnd('finance', dragged.session, 7, 120, 308, 1120, true), 'plan');
assert.equal(resolvePrimaryGestureEnd('finance', dragged.session, 8, 120, 308, 1120, true), null,
  'pointer-up from another touch cannot commit navigation');

const vertical = updatePrimaryGesture(started, 7, 224, 330);
assert.equal(vertical.session.axis, 'vertical', 'vertical intent is permanently handed to page scrolling');
assert.equal(updatePrimaryGesture(vertical.session, 7, 100, 330).accepted, false,
  'a later horizontal wobble cannot steal an established vertical scroll');
assert.equal(resolvePrimaryGestureEnd('finance', vertical.session, 7, 100, 330, 1120, true), null);

const short = beginPrimaryGesture({ pointerId: 9, x: 200, y: 20, at: 2000, viewportWidth: 400 });
const shortDrag = updatePrimaryGesture(short, 9, 180, 21);
assert.equal(resolvePrimaryGestureEnd('finance', shortDrag.session, 9, 180, 21, 2050, true), null,
  'a short incidental movement does not navigate');
assert.equal(resolvePrimaryGestureEnd('finance', dragged.session, 7, 120, 308, 2120, false), null,
  'turning off the user preference cancels the release');

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
