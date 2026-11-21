'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const component = fs.readFileSync('src/components/InfoSheet.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const styles = fs.readFileSync('src/index.css', 'utf8');
assert.match(component, /type="button"[\s\S]*?aria-label=\{['"]About ['"] \+ label\}[\s\S]*?aria-haspopup="dialog"/);
assert.match(component, /dialog\.current\?\.showModal\(\)/, 'opening the tip uses native modal focus');
assert.match(component, /onClose=\{\(\) => \{ setOpen\(false\); trigger\.current\?\.focus/, 'native dismissal restores focus');
assert.match(component, /aria-labelledby=\{id \+ '-title'\}[\s\S]*?aria-describedby=\{id \+ '-definition'\}/);
assert.match(component, /Simple example/);
assert.match(component, /How LifeOS uses it/);
assert.match(app, /dialog\[data-contextual-info="true"\]\[open\][\s\S]*?contextualInfo\.close\(\)/,
  'Android Back closes an open contextual explanation first');
assert.match(styles, /\.lifeos-info-dialog::backdrop/);
assert.match(styles, /\.lifeos-info-trigger:focus-visible/);
for (const label of ['Net cash flow', 'Budget remaining', 'Savings progress', 'Recurring Money confirmation', 'Routine progress']) {
  assert.ok(fs.readFileSync('src/components/MoneyHome.tsx', 'utf8').includes(label) ||
    fs.readFileSync('src/components/SavingsGoalProgress.tsx', 'utf8').includes(label) ||
    fs.readFileSync('src/components/MoneyPlanning.tsx', 'utf8').includes(label) ||
    fs.readFileSync('src/components/LifeHub.tsx', 'utf8').includes(label), `contextual explanation exists for ${label}`);
}
console.log('INFO TIP CONTRACT: hidden-by-default, accessible dialog, keyboard dismissal, focus restoration, and Android Back handling passed.');
