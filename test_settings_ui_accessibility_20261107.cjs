'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');

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

console.log('SETTINGS UI: 12 source-level theme, preference, switch and export accessibility checks passed.');
