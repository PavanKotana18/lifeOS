'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const moneyAccounts = fs.readFileSync('src/components/MoneyAccounts.tsx', 'utf8');
const moneyPlanning = fs.readFileSync('src/components/MoneyPlanning.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

for (const [name, source] of [['record', app], ['account', moneyAccounts], ['planning', moneyPlanning]]) {
  assert.match(source, /ui-sheet-backdrop/, `${name} forms share the common backdrop`);
  assert.match(source, /ui-bottom-sheet/, `${name} forms share the common sheet sizing and safe-area behavior`);
}
assert.match(css, /\.ui-bottom-sheet[^\n]*max-height: min\(90dvh, calc\(100dvh/);
assert.match(css, /overscroll-behavior: contain/);
assert.match(css, /padding-bottom: calc\(1\.25rem \+ env\(safe-area-inset-bottom\)\)/);
assert.match(css, /@media \(min-width: 640px\)[\s\S]*\.ui-bottom-sheet \{ max-height: 90dvh/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.ui-interactive-row:active/);
assert.match(css, /button \{\s*min-height: 44px;/);
assert.match(app, /role="status" aria-live="polite" className=\{`ui-toast/);
assert.match(app, /lifeos-nav app-bottom-nav fixed bottom-0/);
assert.match(css, /\.app-bottom-nav[^\n]*padding-bottom: calc\(env\(safe-area-inset-bottom\) \+ \.5rem\)/,
  'the fixed navigation receives safe-area spacing from the shared shell style');
assert.match(manifest, /android:windowSoftInputMode="adjustResize"/);
assert.match(app, /onKeyDown=\{handleGlobalKeyDown\}|onKeyDown=\{event/);

console.log('UI 2.0 SHARED EXPERIENCE: common sheets, keyboard/safe-area layout, reduced motion, touch targets, feedback, and navigation contracts passed.');
