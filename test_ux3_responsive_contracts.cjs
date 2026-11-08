'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('./src/index.css', 'utf8');
const manifest = fs.readFileSync('./android/app/src/main/AndroidManifest.xml', 'utf8');
const app = fs.readFileSync('./src/App.tsx', 'utf8');

assert.match(css, /--page-measure:\s*\d+rem/);
assert.match(css, /--content-measure:\s*\d+rem/);
assert.match(css, /--page-gutter:\s*clamp\(/);
assert.match(css, /min-height:\s*100dvh/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /@media \(min-width: 48rem\)/, 'wider windows receive intentional multi-column reflow');
assert.match(css, /@media \(max-width: 24rem\)/, 'compact windows receive a separate control layout');
assert.match(css, /max-height: min\(90dvh, calc\(100dvh - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\) - 1rem\)\)/,
  'sheets fit the current viewport and safe areas without assuming a keyboard size');
assert.match(css, /min-height:\s*100vh;\s*min-height:\s*100dvh/);
assert.match(manifest, /android:configChanges="[^"]*orientation[^"]*"/);
assert.match(manifest, /android:windowSoftInputMode="adjustResize"/);
assert.doesNotMatch(manifest, /screenOrientation=/, 'Android can reflow on rotation instead of forcing portrait');
assert.match(app, /role="group" aria-label="Filter transactions by type" className="flex flex-wrap/,
  'primary-screen horizontal filters wrap and leave horizontal gesture ownership clear');
assert.doesNotMatch(app, /flex gap-1\.5 overflow-x-auto text-xs pb-1/,
  'no unmarked horizontally scrolling control remains in the primary gesture surface');
assert.match(app, /aria-pressed=\{financeTypeFilter === t\}/);

for (const forbidden of [/iQOO/i, /Neo 9/i, /1080\s*[x×]\s*2400/i, /innerWidth\s*[<>=]/]) {
  assert.doesNotMatch(`${css}\n${app}\n${manifest}`, forbidden, 'responsive behavior is not keyed to a specific phone or pixel resolution');
}

console.log('UX3 RESPONSIVE CONTRACTS: adaptive measures, safe areas, keyboard resize, orientation and gesture-compatible filters passed.');
