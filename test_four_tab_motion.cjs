'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { MOTION_PRESET_OPTIONS, normalizeMotionPreset, getMotionPreset, getMotionCssVariables, resistDrag, estimateDragVelocity, buildInterfaceTransition } = require('./src/services/interfaceMotion.ts');
const { buildSpringSettle, readTranslateX } = require('./src/services/springMotion.ts');

assert.equal(normalizeMotionPreset('unknown'), 'silky');
assert.equal(normalizeMotionPreset(null), 'silky');
assert.equal(normalizeMotionPreset('__proto__'), 'silky');
assert.equal(MOTION_PRESET_OPTIONS.length, 3);
assert.ok(Object.isFrozen(MOTION_PRESET_OPTIONS));
for (const preset of MOTION_PRESET_OPTIONS) {
  assert.ok(Object.isFrozen(preset));
  assert.equal(getMotionPreset(preset.id), preset);
  assert.equal(getMotionCssVariables(preset.id)['--interface-motion-duration'], `${preset.duration}ms`);
  assert.ok(preset.duration > 0 && preset.duration <= 500);
  assert.ok(preset.dampingRatio > 0 && preset.dampingRatio < 1);
  for (const width of [0, NaN, 1, 320, 720, 10000]) {
    let previous = 0;
    for (const distance of [0, 0.001, 1, 10, 50, 100, 500, 1e100]) {
      const x = resistDrag(distance, width, preset.id);
      assert.ok(Number.isFinite(x));
      assert.ok(x >= previous && x <= 640, 'Response is monotonic and bounded');
      assert.ok(x <= distance, 'Resistance does not amplify movement');
      assert.ok(Math.abs(x + resistDrag(-distance, width, preset.id)) < 1e-10, 'Resistance mirrors exactly');
      previous = x;
    }
  }
  assert.equal(resistDrag(Infinity, 320, preset.id), 0);
  assert.ok(resistDrag(0.001, 320, preset.id) < 0.001, 'No discontinuity when a finger first moves');
  assert.equal(estimateDragVelocity([{ x: 0, time: 0 }, { x: 20, time: 20 }, { x: 50, time: 50 }], preset.id), 1000);
  assert.equal(estimateDragVelocity([{ x: 0, time: 0 }, { x: -20, time: 20 }, { x: -50, time: 50 }], preset.id), -1000);
  assert.equal(estimateDragVelocity([{ x: 0, time: 0 }, { x: 100, time: 200 }], preset.id), 0, 'Old samples do not cause a release fling');
  assert.equal(estimateDragVelocity([{ x: 0, time: 0 }, { x: 100, time: 1 }], preset.id), 0, 'Tiny time deltas do not cause a release fling');
  assert.equal(estimateDragVelocity([{ x: 0, time: 0 }, { x: NaN, time: 30 }, { x: 20, time: 20 }, { x: 999, time: 10 }, { x: 50, time: 50 }], preset.id), 1000);
  assert.equal(estimateDragVelocity([{ x: 0, time: 0 }, { x: 1e100, time: 10 }], preset.id), preset.velocityLimit);
  for (const start of [0, 0.1, 30, 150, 640, 1e100, NaN]) {
    for (const velocity of [-1e100, -800, 0, 800, 1e100, Infinity]) {
      const animation = buildSpringSettle(start, velocity, preset.id);
      const mirror = buildSpringSettle(-start, -velocity, preset.id);
      const boundedStart = Number.isFinite(start) ? Math.min(start, 640) : 0;
      assert.ok(animation.duration <= 500);
      assert.equal(readTranslateX(animation.keyframes[0].transform), boundedStart);
      assert.equal(animation.keyframes.at(-1).transform, 'translateX(0px)');
      animation.keyframes.forEach((frame, index) => {
        const position = readTranslateX(frame.transform);
        assert.ok(Number.isFinite(position));
        assert.ok(Math.abs(position) <= boundedStart * 1.15 + 0.001);
        assert.ok(Math.abs(position + readTranslateX(mirror.keyframes[index].transform)) < 0.001);
        assert.equal(frame.offset, index / (animation.keyframes.length - 1));
      });
      if (boundedStart) {
        const tail = animation.keyframes.slice(-7).map(frame => Math.abs(readTranslateX(frame.transform)));
        assert.ok(Math.max(...tail) < boundedStart * 0.015 + 0.001, 'Motion actually decays before final endpoint');
        assert.ok(Math.abs(readTranslateX(animation.keyframes.at(-2).transform)) < 0.2, 'Exact endpoint does not hide a visible jump');
      }
    }
  }
  for (const direction of [-1, 1]) {
    const transition = buildInterfaceTransition(direction, preset.id);
    assert.equal(readTranslateX(transition.keyframes[0].transform), direction * 20);
    assert.equal(transition.keyframes.at(-1).transform, 'translateX(0px)');
    assert.equal(transition.keyframes.at(-1).opacity, 1);
    assert.equal(transition.duration, preset.duration);
    const reduced = buildInterfaceTransition(direction, preset.id, true);
    assert.equal(reduced.duration, 0);
    assert.ok(reduced.keyframes.every(frame => frame.transform === 'translateX(0px)' && frame.opacity === 1));
  }
}
assert.ok(resistDrag(50, 320, 'snappy') > resistDrag(50, 320, 'silky'));
assert.ok(resistDrag(50, 320, 'silky') > resistDrag(50, 320, 'oil'));
assert.equal(estimateDragVelocity([]), 0);
console.log('FOUR TAB MOTION: all presets, physical spring decay, mirrored resistance, recent velocity bounds and reduced-motion endpoints passed.');
