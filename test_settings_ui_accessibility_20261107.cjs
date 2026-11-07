'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const settingsStart = app.indexOf('        {/* VIEW 6: SETTINGS */}');
const settingsEnd = app.indexOf('      {createKind && (', settingsStart);
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart, 'settings view boundaries are present');
const settings = app.slice(settingsStart, settingsEnd);

assert.match(app, /aria-pressed=\{appearance === value\}/);
assert.match(app, /lifeos-panel flex min-h-11 items-center justify-center/);
assert.match(app, /aria-label=\{`Preview \$\{option\.label\}`\}/);
assert.match(app, /onClick=\{cancelVisualThemePreview\}/);
assert.match(app, /onClick=\{\(\) => void applyVisualTheme\(\)\}/);
assert.match(app, /role="switch" aria-checked=\{biometricEnabled\}[^\n]*min-h-11/);
assert.match(app, /role="switch" aria-checked=\{notificationsEnabled\}[^\n]*min-h-11/);
assert.match(app, /role="switch" aria-checked=\{notificationPreferences\[key\]\}[^\n]*min-h-11/);
assert.match(app, /lifeos-input mt-1\.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm/);
assert.match(app, /lifeos-raised min-h-11 flex-1 rounded-xl px-3 text-xs font-semibold">Restore JSON/);
assert.match(app, /lifeos-raised min-h-11 w-full rounded-xl px-3 text-xs font-semibold">Export transactions CSV/);
assert.ok(/className="lifeos-raised min-h-11 w-full rounded-xl px-3 text-xs font-semibold transition"\s*>\s*Load Sample Demo Data/.test(app), 'sample-data action retains a 44px target and semantic surface styling');
assert.match(settings, /lifeos-panel rounded-2xl border p-5 space-y-4/);
assert.match(settings, /lifeos-accent-button flex h-14 w-14/);
assert.ok(!/\b(?:text|bg|border)-(?:slate|indigo|emerald|amber|rose)-\d{2,3}\b/.test(settings), 'settings colors use semantic theme tokens');
assert.match(settings, /lifeos-danger min-h-11 w-full rounded-xl border/);

console.log('SETTINGS UI: 17 source-level theme, preference, switch and export accessibility checks passed.');
