'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loaded, file) => loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { buildCustomAccentOverrides, normalizeCustomAccent } = require('./src/services/customAccent.ts');
const { THEME_CATALOG, contrastRatio } = require('./src/services/themeCatalog.ts');
const Picker = require('./src/components/CustomAccentPicker.tsx').default;

assert.equal(normalizeCustomAccent('#ab03fF'), '#AB03FF');
for (const value of [null, undefined, '', '#fff', 'red', '#12345Z', ' #123456', '#123456;', 'var(--ink)', '#12345600', {}]) {
  assert.equal(normalizeCustomAccent(value), undefined);
}
assert.throws(() => buildCustomAccentOverrides('red', 'soft-ivory-sage', 'light'), /RRGGBB/);
const colors = ['#FFFFFF', '#000000', '#FFFF00', '#00FFFF', '#FF00FF', '#FF0000', '#00FF00', '#0000FF', '#777777', '#416B51', '#123456', '#EECCAA'];
let comparisons = 0;
for (const [themeId, theme] of Object.entries(THEME_CATALOG)) {
  for (const mode of ['light', 'dark']) {
    assert.deepEqual(buildCustomAccentOverrides(undefined, themeId, mode), {}, 'No preference leaves catalog untouched');
    for (const color of colors) {
      const result = buildCustomAccentOverrides(color, themeId, mode);
      assert.ok(contrastRatio(result['--accent-foreground'], result['--accent']) >= 4.5, `${themeId}/${mode}/${color}: button text`);
      for (const background of [theme[mode].background, theme[mode].surface, theme[mode].elevatedSurface, result['--accent-tint']]) {
        assert.ok(contrastRatio(result['--accent'], background) >= 4.5, `${themeId}/${mode}/${color}: accent text`);
        assert.ok(contrastRatio(result['--focus-color'], background) >= 3, `${themeId}/${mode}/${color}: focus indicator`);
        comparisons++;
      }
      assert.equal(result['--chart-1'], result['--accent']);
      assert.equal(result['--surface-muted'], result['--accent-tint']);
      for (const value of Object.values(result)) assert.match(value, /^#[0-9A-F]{6}$/);
    }
  }
}
assert.equal(buildCustomAccentOverrides('#416B51', 'soft-ivory-sage', 'light')['--accent'], '#416B51', 'Already readable accent stays unchanged');
const markup = renderToStaticMarkup(React.createElement(Picker, { value: '#FFFF00', onChange: () => {} }));
assert.match(markup, /Pick accent color/);
assert.match(markup, /Hex color/);
assert.match(markup, /Readable accent:/);
assert.match(markup, /Apply accent/);
assert.match(markup, /Use palette accent/);
assert.match(markup, /aria-describedby=/);
const invalidMarkup = renderToStaticMarkup(React.createElement(Picker, { value: 'invalid', onChange: () => {} }));
assert.match(invalidMarkup, /role="alert"/);
assert.match(invalidMarkup, /aria-invalid="true"/);
assert.match(invalidMarkup, /disabled=""[^>]*>Apply accent/);
const resetMarkup = renderToStaticMarkup(React.createElement(Picker, { onChange: () => {} }));
assert.match(resetMarkup, /disabled=""[^>]*>Use palette accent/);
console.log(`CUSTOM ACCENT: strict color validation, ${comparisons} palette/background contrast combinations and accessible picker rendering passed.`);

// Actual App handlers plus production bootstrap settings. This is synthetic
// storage/DOM evidence; it does not claim browser or native rendering.
const h = require('./tests/wp0/production-harness.cjs');
const { applyThemeTokens, DEFAULT_THEME_ID } = require('./src/services/themeCatalog.ts');
const appAst = ts.createSourceFile('App.tsx', fs.readFileSync('src/App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const themeDeclaration = appAst.statements.flatMap(statement => ts.isVariableStatement(statement)
  ? [...statement.declarationList.declarations] : []).find(declaration => declaration.name.getText(appAst) === 'applyDomTheme');
assert.ok(themeDeclaration);
const themeValues = new Map();
const fakeRoot = { style: { setProperty: (key, value) => themeValues.set(key, value) }, classList: { toggle() {} } };
const applyDom = h.bind(themeDeclaration.initializer.getText(appAst), {
  document: { documentElement: fakeRoot, querySelector: () => ({ setAttribute() {} }) },
  applyThemeTokens: (themeId, mode) => applyThemeTokens(themeId, mode, fakeRoot), DEFAULT_THEME_ID,
  buildCustomAccentOverrides, normalizeCustomAccent,
});
applyDom('light', 'soft-ivory-sage', '#FFFF00');
assert.notEqual(themeValues.get('--accent'), '#FFFF00', 'Applied custom color is made readable');
applyDom('dark', 'ocean-mist', '#FFFF00');
assert.ok(contrastRatio(themeValues.get('--accent'), THEME_CATALOG['ocean-mist'].dark.surface) >= 4.5);
applyDom('dark', 'ocean-mist', undefined);
assert.equal(themeValues.get('--accent'), THEME_CATALOG['ocean-mist'].dark.accent, 'Reset restores the current catalog, not an obsolete custom variable');
assert.equal(themeValues.get('--surface-muted'), THEME_CATALOG['ocean-mist'].dark.accentTint);

(async () => {
  const fixture = await h.fixture({ activate: false });
  try {
    const source = h.appFunction('applyCustomAccent');
    let applied;
    const notifications = [];
    const queue = { current: Promise.resolve() };
    const deps = { ...fixture.appDeps(), customAccentSaveQueue: queue,
      setCustomAccent: value => { applied = value; }, showToast: (message, type) => notifications.push({ message, type }) };
    const saveAccent = h.bind(source, deps);
    const nativeCalls = [...fixture.native.calls];
    await saveAccent('#ff0000');
    assert.equal(applied, '#FF0000');
    assert.equal(await fixture.StorageService.settings.get('customAccent'), '#FF0000');
    assert.equal(global.localStorage.getItem('lifeos-custom-accent'), '#FF0000');
    const stored = await fixture.lifeOSDatabase.settings.get('customAccent');
    assert.equal(stored.value, '#FF0000');
    assert.equal(stored.__lifeosEncrypted, undefined, 'Only the safe cosmetic hex is bootstrap-visible');
    assert.deepEqual(fixture.native.calls, nativeCalls, 'Applying a cosmetic color never provisions or unlocks private storage');
    await saveAccent('url(unsafe)');
    assert.equal(await fixture.StorageService.settings.get('customAccent'), '#FF0000');
    assert.match(notifications.at(-1).message, /RRGGBB/);
    await Promise.all([saveAccent('#111111'), saveAccent('#222222')]);
    assert.equal(applied, '#222222');
    assert.equal(await fixture.StorageService.settings.get('customAccent'), '#222222');
    const fail = h.bind(source, { ...deps, StorageService: { settings: { set: async () => { throw new Error('Synthetic storage failure'); } } } });
    await fail('#333333');
    assert.equal(applied, '#222222', 'A rejected persistence write never applies a color');
    assert.match(notifications.at(-1).message, /Could not save/);
    await saveAccent(undefined);
    assert.equal(applied, undefined);
    assert.equal(await fixture.StorageService.settings.get('customAccent'), null);
    assert.equal(global.localStorage.getItem('lifeos-custom-accent'), null);
    assert.equal(await fixture.lifeOSDatabase.transactions.count(), 0);
    console.log('CUSTOM ACCENT INTEGRATION: production handler persistence, validation, serialized saves, safe bootstrap, failure rollback and palette reset passed.');
  } finally { await fixture.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
