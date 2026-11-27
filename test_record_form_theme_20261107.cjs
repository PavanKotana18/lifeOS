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
const shell = fs.readFileSync('src/components/ComposerShell.tsx', 'utf8');
const css = fs.readFileSync('src/styles/approved-composers.css', 'utf8');
assert.match(dialog, /<ComposerShell key=\{createKind\} id="record-dialog"/);
assert.match(shell, /role="dialog" aria-modal="true"[\s\S]*aria-labelledby=\{accessibleName \? undefined : titleId\}/);
assert.match(shell, /<FeatherHeader title=\{title\} id=\{present \? titleId : undefined\} back=\{footerDismissOnly \? undefined : \{ label: 'Close'/);
assert.match(css, /\.feather-composer-content \{[^}]*overflow-y: auto/);
assert.match(css, /\.feather-icon-button[\s\S]*min-(?:block|inline)-size:/);
assert.ok(!/\b(?:text|bg|border)-(?:slate|indigo|emerald|amber|rose)-\d{2,3}(?:\/\d+)?\b/.test(dialog), 'dialog surfaces use semantic theme colors');
assert.ok(!dialog.includes('hover:lifeos-raised'), 'dialog does not contain invalid generated utility classes');
const sourceFile = ts.createSourceFile('src/App.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const controls = [];
const sheets = [];
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
  if (ts.isJsxSelfClosingElement(node) && node.pos >= start && node.end <= end && ['ComposerChoice', 'PreferenceChoice'].includes(node.tagName.getText(sourceFile))) sheets.push(node);
  ts.forEachChild(node, visit);
};
visit(sourceFile);
assert.ok(controls.length + sheets.length >= 30, 'shared dialog retains its existing editable record fields');
assert.ok(controls.every(className => className.includes('lifeos-input') && className.includes('min-h-11')), 'editable fields use semantic inputs and minimum touch sizing');
assert.ok(/border border-\[var\(--danger\)\][^\"]*text-\[var\(--danger\)\]/.test(dialog), 'delete action remains visibly dangerous');
assert.match(shell, /className="ui-form-actions feather-composer-actions"[\s\S]*type="submit" disabled=\{saving \|\| submitDisabled\} className="feather-primary"/);
assert.match(css, /\.feather-composer-actions \{[^}]*grid-template-columns:/, 'the save action stays in a separate rail while fields scroll');
console.log(`RECORD FORM THEME: 11 source-level dialog checks passed; ${controls.length} editable JSX controls inspected.`);
