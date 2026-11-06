const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { resolveInitialAppearancePreference, resolveInitialSystemDark } = require('./src/services/systemAppearance.ts');

(async () => {
  let checks = 0;
  const check = (actual, expected) => { assert.equal(actual, expected); checks++; };
  check(await resolveInitialAppearancePreference(async () => 'dark'), 'dark');
  check(await resolveInitialAppearancePreference(async () => 'light'), 'light');
  check(await resolveInitialAppearancePreference(async () => 'bad preference'), 'system');
  check(await resolveInitialAppearancePreference(() => { throw new Error('store unavailable'); }), 'system');
  check(await resolveInitialAppearancePreference(() => new Promise(() => {}), 5), 'system');
  check(await resolveInitialSystemDark(true, () => new Promise(() => {}), 5), true);
  check(await resolveInitialSystemDark(false, () => Promise.reject(new Error('bridge unavailable'))), false);
  check(await resolveInitialSystemDark(false, async () => ({ dark: true })), true);
  check(await resolveInitialSystemDark(true, async () => ({ dark: false })), false);
  check(await resolveInitialSystemDark(true, async () => null), true);
  check(await resolveInitialSystemDark(false, async () => ({ dark: 'true' })), false);
  // A late rejection must be observed even after the cosmetic timeout expires.
  let rejectLate;
  check(await resolveInitialSystemDark(false, () => new Promise((_, reject) => { rejectLate = reject; }), 5), false);
  rejectLate(new Error('late native rejection'));
  await new Promise(resolve => setImmediate(resolve));
  console.log(`Android startup appearance: ${checks} checks passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });

// Exercise the real entrypoint with only the platform/DOM surface replaced.
// No App/auth implementation is loaded or bypassed; this checks appearance
// failures cannot prevent handing control to the real application root.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mainCode = ts.transpileModule(fs.readFileSync('src/main.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
}).outputText;
async function entrypointScenario({ readPreference, nativeAppearance, cacheThrows = false }) {
  let renderCount = 0;
  let ready = false;
  const root = {};
  const html = { classList: { toggle() {} }, style: {}, dataset: {} };
  let resolveRendered;
  const rendered = new Promise(resolve => { resolveRendered = resolve; });
  const react = { createElement: () => ({}), StrictMode: {} };
  const dom = { createRoot: actual => {
    assert.equal(actual, root);
    return { render: () => { renderCount++; ready = html.dataset.themeReady === 'true'; resolveRendered(); } };
  } };
  const imports = {
    react,
    'react-dom/client': dom,
    './App': () => {},
    './db': { StorageService: { settings: { get: readPreference } } },
    './services/domainUtils': { resolveAppearance: (preference, systemDark) => preference === 'system' ? systemDark ? 'dark' : 'light' : preference },
    './services/systemAppearance': { resolveInitialAppearancePreference, resolveInitialSystemDark },
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true }, registerPlugin: () => ({ getSystemAppearance: nativeAppearance }) },
    './index.css': {},
  };
  vm.runInNewContext(mainCode, {
    exports: {},
    require: name => { assert.ok(Object.hasOwn(imports, name), `Unexpected entrypoint dependency ${name}`); return imports[name]; },
    document: { getElementById: () => root, documentElement: html, querySelector: () => ({ setAttribute() {} }) },
    window: { matchMedia: () => ({ matches: false }) },
    localStorage: { setItem: () => { if (cacheThrows) throw new Error('cache unavailable'); } },
    console: { warn() {} },
  });
  let deadline;
  try {
    await Promise.race([rendered, new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('entrypoint did not render')), 4500); })]);
    assert.equal(renderCount, 1, 'Entry point must create exactly one application root');
    assert.equal(ready, true, 'Appearance completion marker precedes app render');
  } finally { clearTimeout(deadline); }
}
(async () => {
  await entrypointScenario({ readPreference: async () => 'dark', nativeAppearance: async () => ({ dark: false }), cacheThrows: true });
  await entrypointScenario({ readPreference: () => Promise.reject(new Error('store unavailable')), nativeAppearance: () => Promise.reject(new Error('bridge unavailable')) });
  await entrypointScenario({ readPreference: () => new Promise(() => {}), nativeAppearance: () => new Promise(() => {}) });
  console.log('Android startup entrypoint: 3 scenarios passed (cache failure, rejected dependencies, stalled dependencies)');
})().catch(error => { console.error(error); process.exitCode = 1; });
