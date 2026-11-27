'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const component = fs.readFileSync('src/components/InfoSheet.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const styles = fs.readFileSync('src/index.css', 'utf8');
assert.match(component, /type="button"[\s\S]*?aria-label=\{triggerText \|\| 'About ' \+ label\}[\s\S]*?aria-haspopup="dialog"/,
  'the visible information control is a named keyboard-operable button');
assert.match(component, /showSheet\(sheet\)/, 'opening the tip uses native modal dialog focus handling');
assert.match(component, /onClose=\{\(\) => \{ setOpen\(false\)/,
  'Escape dismisses the explanation and restores focus');
assert.match(component, /trigger\.current\?\.focus\(\{ preventScroll: true \}\)/, 'dismissal returns focus to the information button');
assert.match(component, /aria-labelledby=\{id \+ '-title'\} aria-describedby=\{id \+ '-definition'\}/,
  'the dialog description is available to screen readers');
assert.match(app, /dialog\[data-contextual-info="true"\]\[open\][\s\S]*?closeSheet\(contextualInfo\)/,
  'Android Back closes an open contextual explanation first');
const lifecycle = fs.readFileSync('src/components/sheetMotion.ts', 'utf8');
assert.match(lifecycle, /dialog\.showModal\(\)/);
assert.match(lifecycle, /dialog\.close\(\)[\s\S]*230/);
assert.match(styles, /\.lifeos-info-dialog::backdrop/);
assert.match(styles, /\.lifeos-info-trigger:focus-visible/);
for (const label of ['Net cash flow', 'Budget remaining', 'Savings progress', 'Recurring Money confirmation', 'Routine progress']) {
  assert.ok(fs.readFileSync('src/components/MoneyHome.tsx', 'utf8').includes(label) ||
    fs.readFileSync('src/components/SavingsGoalProgress.tsx', 'utf8').includes(label) ||
    fs.readFileSync('src/components/MoneyPlanning.tsx', 'utf8').includes(label) ||
    fs.readFileSync('src/components/LifeHub.tsx', 'utf8').includes(label), `contextual explanation exists for ${label}`);
}
console.log('INFO TIP CONTRACT: hidden-by-default, accessible dialog, keyboard dismissal, focus restoration, and Android Back handling passed.');
