'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sourceText = fs.readFileSync('src/App.tsx', 'utf8');
const app = sourceText;
const start = app.indexOf('      {createKind && (');
const end = app.indexOf('      {/* Floating Bottom Nav */}', start);
assert.ok(start >= 0 && end > start, 'shared create/edit dialog boundaries are present');
const dialog = app.slice(start, end);
assert.ok(/role="dialog" aria-modal="true" aria-labelledby="record-form-title"/.test(dialog));
assert.ok(/id="record-form-title"/.test(dialog));
assert.ok(/className="lifeos-panel w-full max-w-md/.test(dialog));
assert.ok(/aria-label="Close"[^\n]*min-h-11 min-w-11/.test(dialog));
assert.ok(!/\b(?:text|bg|border)-(?:slate|indigo|emerald|amber|rose)-\d{2,3}(?:\/\d+)?\b/.test(dialog), 'dialog surfaces use semantic theme colors');
assert.ok(!dialog.includes('hover:lifeos-raised'), 'dialog does not contain invalid generated utility classes');
const sourceFile = ts.createSourceFile('src/App.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const controls = [];
const visit = node => {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.pos >= start && node.end <= end && ['input', 'select', 'textarea'].includes(node.tagName.getText(sourceFile))) {
    const attributes = node.attributes.properties;
    const typeAttribute = attributes.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === 'type');
    const isCheckbox = typeAttribute && ts.isJsxAttribute(typeAttribute) && typeAttribute.initializer && ts.isStringLiteral(typeAttribute.initializer) && typeAttribute.initializer.text === 'checkbox';
    if (!isCheckbox) {
      const classAttribute = attributes.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === 'className');
      controls.push(classAttribute && ts.isJsxAttribute(classAttribute) && classAttribute.initializer && ts.isStringLiteral(classAttribute.initializer) ? classAttribute.initializer.text : '');
    }
  }
  ts.forEachChild(node, visit);
};
visit(sourceFile);
assert.ok(controls.length >= 30, 'shared dialog retains its existing editable record fields');
assert.ok(controls.every(className => className.includes('lifeos-input') && className.includes('min-h-11')), 'editable fields use semantic inputs and minimum touch sizing');
assert.ok(/border border-\[var\(--danger\)\][^\"]*text-\[var\(--danger\)\]/.test(dialog), 'delete action remains visibly dangerous');
assert.ok(/lifeos-accent-button px-4 py-3 text-sm font-semibold/.test(dialog), 'save action uses the semantic accent button');
console.log(`RECORD FORM THEME: 11 source-level dialog checks passed; ${controls.length} editable JSX controls inspected.`);
