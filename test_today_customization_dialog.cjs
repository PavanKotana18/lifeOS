'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const h = require('./tests/wp0/production-harness.cjs');
require('./scripts/register-ts-test-loader.cjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const layout = require('./src/services/todayLayout.ts');
const text = fs.readFileSync('src/App.tsx', 'utf8');
const source = ts.createSourceFile('App.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let dialogNode, closeEffect;
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute =>
    ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'id' && attribute.initializer?.text === 'today-customization')) dialogNode = node;
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes("activeTab !== 'dashboard' || isLocked")) closeEffect = node.arguments[0].getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(dialogNode && closeEffect, 'The contextual Today dialog and navigation cleanup exist');
const jsx = ts.transpileModule(`module.exports = () => (${dialogNode.getText(source)});`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
let writes = 0;
const deps = { ...layout, todayLayout: layout.DEFAULT_TODAY_LAYOUT, todayLayoutRef: { current: layout.DEFAULT_TODAY_LAYOUT },
  persistTodayLayout: () => { writes++; }, closeTodayCustomization: () => {} };
const moduleValue = { exports: {} };
new Function('require', 'module', 'exports', ...Object.keys(deps), jsx)(require, moduleValue, moduleValue.exports, ...Object.values(deps));
const markup = renderToStaticMarkup(React.createElement(moduleValue.exports));
assert.equal(writes, 0, 'Opening/rendering Customize does not alter layout preferences');
assert.match(markup, /role="dialog" aria-modal="true"/);
assert.match(markup, /aria-labelledby="today-customization-title"/);
assert.match(markup, /aria-describedby="today-customization-description"/);
assert.match(markup, /Changes save as you make them/);
assert.match(markup, />Done<\/button>/);
assert.match(markup, /Restore default layout/);
assert.match(markup, /Move .* up/); assert.match(markup, /Move .* down/);
assert.match(text, /useRecordDialog\(todayCustomizationOpen[\s\S]*?closeTodayCustomization, 'today-customization'\)/);
assert.match(text, /todayCustomizationOpen && createPortal\(<div className="ui-sheet-backdrop"/);
assert.match(text, /<\/section><\/div>, document\.body\)/, 'The modal escapes transformed/clipped retained screen ancestors');

let closes = 0;
const close = h.bind(h.appFunction('closeTodayCustomization'), { setTodayCustomizationOpen: value => { assert.equal(value, false); closes++; } });
const backdrop = h.bind(h.appFunction('dismissTodayCustomizationBackdrop'), { closeTodayCustomization: close });
const surface = {};
backdrop({ target: {}, currentTarget: surface }); assert.equal(closes, 0, 'Interacting inside the sheet does not dismiss it');
backdrop({ target: surface, currentTarget: surface }); assert.equal(closes, 1, 'A direct backdrop interaction dismisses the sheet');
close(); assert.equal(closes, 2);

const backExpression = h.appFunction('navigateBack');
const navigation = { swipePointer: { current: null }, cancelProfileAdmission: () => false, navigationMotion: { cancelPending() {} } };
const state = { appReady: true, isLocked: false, activeTab: 'dashboard', todayCustomizationOpen: true, onboardingRequired: false, onboardingComplete: true };
h.bind(backExpression, { ...navigation, backState: { current: state }, confirmationResolver: { current: null }, firstRecordSecurityResolver: { current: null },
  closeTodayCustomization: close, resolveBackAction: () => { throw new Error('Customization must close before navigation'); },
})();
assert.equal(closes, 3, 'Native Back closes Customize before any navigation or exit');
let confirmationDismissed = false;
h.bind(backExpression, { ...navigation, backState: { current: state }, confirmationResolver: { current: () => {} },
  settleConfirmation: value => { assert.equal(value, false); confirmationDismissed = true; },
  closeTodayCustomization: () => { throw new Error('Nested confirmation owns Back'); },
})();
assert.equal(confirmationDismissed, true);
for (const [activeTab, isLocked, expected] of [['dashboard', false, 0], ['finance', false, 1], ['dashboard', true, 1]]) {
  let changes = 0;
  h.bind(closeEffect, { activeTab, isLocked, setTodayCustomizationOpen: value => { assert.equal(value, false); changes++; } })();
  assert.equal(changes, expected, 'Leaving Today or locking removes its private customization surface');
}

// Exercise the actual reused dialog hook with an isolated DOM model. This is
// focus/Escape contract evidence, not a mounted browser or native UI claim.
const listeners = new Map(), cleanups = [], styles = new Map();
const documentValue = { activeElement: null, documentElement: { style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) } },
  addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name), getElementById: id => id === 'today-customization' ? sheet : null };
class Element {
  constructor(name) { this.name = name; this.isConnected = true; this.style = documentValue.documentElement.style; }
  focus() { documentValue.activeElement = this; }
  getClientRects() { return [{}]; }
  scrollIntoView() {}
}
const opener = new Element('Customize'), first = new Element('First toggle'), last = new Element('Done'), outside = new Element('Nested confirmation');
const sheet = new Element('Sheet');
sheet.contains = element => [first, last, sheet].includes(element);
sheet.querySelector = selector => selector === '.ui-form-actions' ? null : first;
sheet.querySelectorAll = () => [first, last];
documentValue.activeElement = opener;
const reactStub = { useRef: value => ({ current: value }), useEffect: callback => { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); } };
const hookCode = ts.transpileModule(fs.readFileSync('src/hooks/useRecordDialog.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const hookModule = { exports: {} };
new Function('require', 'module', 'exports', 'document', 'window', 'HTMLElement', 'ResizeObserver', hookCode)(
  name => name === 'react' ? reactStub : require(name), hookModule, hookModule.exports,
  documentValue, { innerHeight: 800, visualViewport: undefined }, Element, undefined,
);
let escaped = 0;
hookModule.exports.useRecordDialog(true, () => { escaped++; }, 'today-customization');
assert.equal(documentValue.activeElement, first, 'Opening moves focus into Customize');
const press = (key, shiftKey = false) => { let prevented = false; listeners.get('keydown')({ key, shiftKey, preventDefault() { prevented = true; } }); return prevented; };
assert.equal(press('Tab', true), true); assert.equal(documentValue.activeElement, last);
assert.equal(press('Tab'), true); assert.equal(documentValue.activeElement, first);
documentValue.activeElement = outside; press('Escape'); assert.equal(escaped, 0, 'A nested dialog owns Escape');
documentValue.activeElement = first; assert.equal(press('Escape'), true); assert.equal(escaped, 1);
for (const cleanup of cleanups.reverse()) cleanup();
assert.equal(documentValue.activeElement, opener, 'Closing returns focus to Customize');
assert.equal(listeners.has('keydown'), false, 'Closing removes the keyboard trap');
console.log('TODAY CUSTOMIZATION: contextual dialog, retained controls, backdrop/Back priority, focus cycling, Escape and focus restoration passed; DOM/native rendering remains unverified.');
