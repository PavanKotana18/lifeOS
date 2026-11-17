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

const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.tsx'] = (loaded, file) => loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const MotionPreferences = require('./src/components/MotionPreferences.tsx').default;
const { createMotionPreferenceController, MOTION_CACHE_KEY } = require('./src/services/interfaceMotion.ts');
const markup = renderToStaticMarkup(React.createElement(MotionPreferences, { value: 'oil', onChange() {}, reducedMotion: true, error: 'Synthetic failure' }));
assert.equal((markup.match(/type="radio"/g) || []).length, 3);
assert.match(markup, /<input(?=[^>]*value="oil")(?=[^>]*checked="")[^>]*>/);
assert.match(markup, /Reduced motion is active/);
assert.match(markup, /role="alert"/);
assert.match(markup, /aria-describedby=/);
const busyMarkup = renderToStaticMarkup(React.createElement(MotionPreferences, { value: 'silky', onChange() {}, saving: true }));
assert.equal((busyMarkup.match(/disabled=""/g) || []).length, 3);
for (const preset of MOTION_PRESET_OPTIONS) {
  const reduced = getMotionCssVariables(preset.id, true);
  assert.equal(reduced['--motion-tab'], '0ms');
  assert.equal(reduced['--motion-panel'], '0ms');
  assert.equal(reduced['--motion-feedback'], '0ms');
}

(async () => {
  const h = require('./tests/wp0/production-harness.cjs');
  const fixture = await h.fixture({ activate: false });
  try {
    const nativeBefore = [...fixture.native.calls];
    const controller = createMotionPreferenceController(fixture.StorageService.settings, global.localStorage);
    await controller.load();
    assert.equal(controller.getSnapshot().preset, 'silky');
    assert.equal(await controller.setPreset('oil'), true);
    assert.equal(await fixture.StorageService.settings.get('motionPreset', null), 'oil');
    assert.equal(global.localStorage.getItem(MOTION_CACHE_KEY), 'oil');
    const raw = await fixture.lifeOSDatabase.settings.get('motionPreset');
    assert.equal(raw.value, 'oil');
    assert.equal(raw.__lifeosEncrypted, undefined, 'Only a cosmetic preset is exposed before private unlock');
    assert.deepEqual(fixture.native.calls, nativeBefore, 'Saving motion does not provision or unlock private storage');
    await Promise.all([controller.setPreset('snappy'), controller.setPreset('silky'), controller.setPreset('oil')]);
    assert.equal(controller.getSnapshot().preset, 'oil');
    assert.equal(controller.getSnapshot().saving, false);
    assert.equal(await fixture.StorageService.settings.get('motionPreset', null), 'oil');
    const restored = createMotionPreferenceController(fixture.StorageService.settings);
    await restored.load();
    assert.equal(restored.getSnapshot().preset, 'oil', 'Preference survives a new controller without cache');
    assert.equal(await controller.setPreset('unsafe'), false);
    assert.equal(await fixture.StorageService.settings.get('motionPreset', null), 'oil');
    let rejectWrites = true;
    const failures = createMotionPreferenceController({ get: async () => 'oil', set: async () => { if (rejectWrites) throw new Error('Synthetic failure'); } });
    await failures.load();
    assert.equal(await failures.setPreset('snappy'), false);
    assert.equal(failures.getSnapshot().preset, 'oil', 'Rejected write retains last persisted preference');
    assert.match(failures.getSnapshot().error, /Could not save/);
    assert.equal(failures.getSnapshot().saving, false);
    rejectWrites = false;
    assert.equal(await failures.setPreset('silky'), true, 'A failed save does not poison the queue');
    assert.equal(failures.getSnapshot().error, null);
    let finishRead;
    const race = createMotionPreferenceController({ get: () => new Promise(resolve => { finishRead = resolve; }), set: async () => {} });
    const loading = race.load();
    await Promise.resolve();
    await race.setPreset('snappy');
    finishRead('oil');
    await loading;
    assert.equal(race.getSnapshot().preset, 'snappy', 'Late initialization never overwrites a newer saved choice');
    const hung = createMotionPreferenceController({ get: () => new Promise(() => {}), set: async () => {} }, { getItem: () => 'oil', setItem() {} }, 10);
    await hung.load();
    assert.equal(hung.getSnapshot().preset, 'oil', 'A bounded timeout keeps cached preference');
    const corrupt = createMotionPreferenceController({ get: async () => '<script>', set: async () => {} }, { getItem: () => 'oil', setItem() {} });
    await corrupt.load();
    assert.equal(corrupt.getSnapshot().preset, 'silky', 'Malformed authoritative storage safely restores the default');
    assert.equal(await fixture.lifeOSDatabase.transactions.count(), 0);
    console.log('MOTION PREFERENCES: production persistence, bootstrap isolation, serialized writes, hydration race, timeout, failure recovery and accessible choices passed.');
  } finally { await fixture.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
