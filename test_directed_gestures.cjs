'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const {
  beginPrimaryGesture,
  updatePrimaryGesture,
  resolvePrimaryGestureEnd,
  shouldStartPrimaryGesture,
  shouldSuppressPrimaryGestureClick,
  matchesPrimaryGestureClickSuppression,
  shouldCancelPrimaryCaptureLoss,
} = require('./src/services/navigationGestures.ts');

const context = (targetKind) => ({ enabled: true, pointerType: 'touch', targetKind });
const button = { contains: (target) => target === button };
const otherButton = { contains: (target) => target === otherButton };

// An ordinary button/card remains a candidate until horizontal intent wins.
assert.equal(shouldStartPrimaryGesture(context('ordinary-interactive')), true);
let session = beginPrimaryGesture({ pointerId: 7, x: 240, y: 320, at: 1000, viewportWidth: 400 });
assert.equal(shouldSuppressPrimaryGestureClick(session), false, 'a tap stays activatable while movement is pending');
assert.equal(resolvePrimaryGestureEnd('dashboard', session, 7, 240, 320, 1040, true), null, 'a tap does not navigate');

const horizontal = updatePrimaryGesture(session, 7, 155, 322).session;
assert.equal(horizontal.axis, 'horizontal', 'ordinary control movement can claim horizontal intent');
assert.equal(shouldSuppressPrimaryGestureClick(horizontal), true, 'only a confirmed horizontal drag suppresses its originating click');
assert.equal(resolvePrimaryGestureEnd('dashboard', horizontal, 7, 155, 322, 1160, true), 'finance');

const suppression = { pointerId: 7, target: button, expiresAt: 1600 };
const click = (overrides = {}) => ({ pointerId: 7, detail: 1, target: button, now: 1200, ...overrides });
assert.equal(matchesPrimaryGestureClickSuppression(suppression, click()), true, 'the native click from the dragged control is suppressed');
assert.equal(matchesPrimaryGestureClickSuppression(suppression, click({ pointerId: 7, target: otherButton })), false,
  'a browser-reused pointer ID must not suppress a tap on another control');
assert.equal(matchesPrimaryGestureClickSuppression(suppression, click({ pointerId: 8 })), false,
  'a different pointer cannot consume the drag suppression');
assert.equal(matchesPrimaryGestureClickSuppression(suppression, click({ detail: 0 })), false,
  'keyboard activation is never suppressed');
assert.equal(matchesPrimaryGestureClickSuppression(suppression, click({ now: 1601 })), false,
  'expired suppression cannot affect a later interaction');
assert.equal(matchesPrimaryGestureClickSuppression(suppression, click({ pointerId: undefined })), true,
  'legacy click events still match by originating control');

session = beginPrimaryGesture({ pointerId: 9, x: 100, y: 100, at: 2000, viewportWidth: 400 });
const vertical = updatePrimaryGesture(session, 9, 103, 125).session;
assert.equal(vertical.axis, 'vertical', 'vertical intent is handed to page scrolling');
assert.equal(shouldSuppressPrimaryGestureClick(vertical), false, 'vertical movement never suppresses a control click');
assert.equal(matchesPrimaryGestureClickSuppression(suppression, click({ target: otherButton })), false);

for (const targetKind of ['text-entry', 'native-picker', 'slider', 'chart', 'horizontal-control', 'dialog']) {
  assert.equal(shouldStartPrimaryGesture(context(targetKind)), false, `${targetKind} retains gesture ownership`);
}

assert.equal(shouldCancelPrimaryCaptureLoss(false, true), false,
  'a child lost-capture event is ignored when capture has transferred to the main gesture owner');
assert.equal(shouldCancelPrimaryCaptureLoss(true, false), true,
  'loss reported by the owner itself cancels the active gesture');
assert.equal(shouldCancelPrimaryCaptureLoss(false, false), true,
  'a child/browser capture loss without active owner capture cancels the gesture');

console.log('DIRECTED GESTURES: ordinary-control ownership, axis lock, vertical scrolling, click safety, and capture-transfer handling passed.');
