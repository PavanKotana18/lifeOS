'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { THEME_CATALOG, DEFAULT_THEME_ID, getThemeTokens, contrastRatio, applyThemeTokens } = require('./src/services/themeCatalog.ts');

assert.equal(DEFAULT_THEME_ID, 'soft-ivory-sage');
assert.equal(THEME_CATALOG[DEFAULT_THEME_ID].label, 'Soft Ivory + Sage Feather');
for (const [id, theme] of Object.entries(THEME_CATALOG)) {
  assert.equal(theme.light.chartSeries.length, 5, `${id} light chart palette`);
  assert.equal(theme.dark.chartSeries.length, 5, `${id} dark chart palette`);
  for (const [mode, tokens] of Object.entries(theme)) {
    if (mode === 'label') continue;
    for (const surface of [tokens.background, tokens.surface, tokens.elevatedSurface]) {
      for (const text of [tokens.primaryText, tokens.secondaryText, tokens.disabled]) {
        assert.ok(contrastRatio(text, surface) >= 4.5, `${id}/${mode}: text ${text} fails contrast on ${surface}`);
      }
      for (const color of [tokens.success, tokens.warning, tokens.danger]) {
        assert.ok(contrastRatio(color, surface) >= 4.5, `${id}/${mode}: status ${color} fails contrast on ${surface}`);
      }
    }
    assert.ok(contrastRatio(tokens.accentForeground, tokens.accent) >= 4.5, `${id}/${mode}: accent foreground contrast`);
    assert.ok(contrastRatio(tokens.accent, tokens.accentTint) >= 3, `${id}/${mode}: accent tint contrast`);
    for (const chartColor of tokens.chartSeries) assert.ok(contrastRatio(chartColor, tokens.surface) >= 3, `${id}/${mode}: chart series contrast`);
  }
}
assert.equal(getThemeTokens('unknown-theme', 'light'), THEME_CATALOG[DEFAULT_THEME_ID].light);
const values = new Map();
const root = { style: { setProperty: (name, value) => values.set(name, value) } };
applyThemeTokens('soft-ivory-sage', 'light', root);
assert.equal(values.get('--page'), '#FAFAF7');
assert.equal(values.get('--accent'), '#416B51');
assert.equal(values.get('--chart-5'), '#69766B');
console.log('THEME CATALOG: semantic token and WCAG contrast checks passed for 6 themes in light and dark modes.');
