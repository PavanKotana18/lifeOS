'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { buildSpringSettle, readTranslateX } = require('./src/services/springMotion.ts');

assert.equal(readTranslateX('none'), 0);
assert.equal(readTranslateX(''), 0);
assert.equal(readTranslateX('matrix(1, 0, 0, 1, -72.5, 12)'), -72.5);
assert.equal(readTranslateX('matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,85,0,0,1)'), 85);
assert.equal(readTranslateX('translateX(-.5px)'), -0.5);
assert.equal(readTranslateX('translateX(1e2px)'), 100);
assert.equal(readTranslateX('translate3d(25px, 0, 0)'), 25);
for (const input of ['matrix(1,0,0,1,NaN,0)', 'matrix(1,0,0)', 'translateX(Infinitypx)', 'translateX(50%)', 'translate3d(25px,garbage,0)', 'translate3d(25px,0,1e999px)', 'rotate(20deg)', null]) {
  assert.equal(readTranslateX(input), 0);
}
for (const start of [0, 0.1, 20, 80, 320, 640]) {
  for (const velocity of [0, -200, 200, 1e9, -1e9, NaN, Infinity]) {
    const positive = buildSpringSettle(start, velocity);
    const negative = buildSpringSettle(-start, -velocity);
    assert.ok(positive.duration >= 0 && positive.duration <= 500);
    assert.equal(positive.keyframes[0].offset, 0);
    assert.equal(positive.keyframes.at(-1).offset, 1);
    assert.equal(readTranslateX(positive.keyframes[0].transform), start);
    assert.equal(positive.keyframes.at(-1).transform, 'translateX(0px)');
    let previousOffset = -1;
    positive.keyframes.forEach((frame, index) => {
      const x = readTranslateX(frame.transform), mirror = readTranslateX(negative.keyframes[index].transform);
      assert.ok(Number.isFinite(x));
      assert.ok(Math.abs(x) <= start * 1.15 + 0.001, 'Overshoot remains proportional to original drag');
      assert.ok(Math.abs(x + mirror) < 0.001, 'Opposite drag and momentum release symmetrically');
      assert.ok(frame.offset > previousOffset, 'Keyframe time always advances');
      previousOffset = frame.offset;
    });
    if (start > 0) {
      const late = positive.keyframes.slice(-7).map(frame => Math.abs(readTranslateX(frame.transform)));
      assert.ok(Math.max(...late) < start * 0.01 + 0.001, 'Oscillation envelope has genuinely decayed before the final frame');
      const penultimate = readTranslateX(positive.keyframes.at(-2).transform);
      assert.ok(Math.abs(penultimate) < 0.2, 'The final exact zero does not hide an abrupt visible snap');
    }
  }
}
assert.equal(buildSpringSettle(NaN, Infinity).duration, 0);
assert.equal(readTranslateX(buildSpringSettle(1e20, 1e20).keyframes[0].transform), 640);
const basic = buildSpringSettle(100);
const positions = basic.keyframes.map(frame => readTranslateX(frame.transform));
assert.ok(positions.some(value => value < 0), 'An underdamped release settles through a small real overshoot');
assert.ok(positions[3] < positions[1], 'Restoring force brings the drag toward zero');
console.log('SPRING MOTION: bounded physical decay, symmetric momentum, endpoint continuity and computed-transform parsing passed.');
