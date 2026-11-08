'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const retained = fs.readFileSync('src/components/RetainedScreen.tsx', 'utf8');

const pointerDown = app.match(/const handleContentPointerDown = \(event: React\.PointerEvent<HTMLElement>\) => \{([\s\S]*?)\n  \};/);
assert.ok(pointerDown, 'the primary content surface has one explicit pointer-down owner');
assert.match(pointerDown[1], /button,a,label,summary/, 'ordinary buttons and row controls remain swipe candidates');
assert.match(pointerDown[1], /textEntry = target\.closest/, 'editable fields remain excluded');
assert.match(pointerDown[1], /recharts-wrapper.*canvas/, 'charts and canvas controls retain their own gestures');
assert.doesNotMatch(pointerDown[1], /setPointerCapture/, 'tap controls are not captured at pointer-down');

const pointerMove = app.match(/const handleContentPointerMove = \(event: PointerEvent\) => \{([\s\S]*?)\n  \};/);
assert.ok(pointerMove, 'the active pointer has one movement handler');
assert.match(pointerMove[1], /axis === 'horizontal'.*setPointerCapture/s, 'capture begins only after horizontal intent is recognized');

assert.match(app, /window\.addEventListener\('pointermove',[\s\S]*window\.addEventListener\('pointerup',[\s\S]*window\.addEventListener\('pointercancel',[\s\S]*window\.addEventListener\('lostpointercapture'/,
  'pointer ownership survives leaving the content surface and handles cancellation/lost capture');
assert.match(app, /onClickCapture=\{handleContentClickCapture\}/, 'a horizontal drag suppresses only its pointer-generated control click');
assert.match(app, /navigateTo\(target, deltaX < 0 \? 'left' : 'right'\)/, 'a committed drag updates navigation without an intermediate reset');
assert.match(css, /\.app-main[^\n]*touch-action: pan-y pinch-zoom/, 'vertical scroll and pinch remain browser-owned');
assert.match(retained, /hidden=\{!active\}[\s\S]*aria-hidden=\{!active\}[\s\S]*toggleAttribute\('inert', !active\)/,
  'inactive retained destinations are hidden from touch, focus and assistive technology');
assert.match(css, /prefers-reduced-motion: reduce/, 'reduced-motion rules remain present');

console.log('PHOENIX SWIPE WIRING: pointer ownership, ordinary controls, browser scrolling, cancellation, click preservation, inactive-screen isolation and reduced motion contracts passed.');
