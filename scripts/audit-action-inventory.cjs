const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(process.argv[2] || '.');
const output = process.argv[3];
const tags = new Set(['button', 'select', 'details', 'summary', 'input', 'textarea']);
const interactiveRole = /button|menuitem|combobox|tab|switch|checkbox|slider|radio|link/;
const events = /^on(?:Click|Pointer|Touch|Key|Submit|Change|Input|Cancel|Close|DoubleClick)/;
const primitives = /(?:Choice|Picker|Dialog|Disclosure|Sheet|ComposerShell|FeatherHeader|MoneyPeriod|TaskSubtasks|InfoTip)$/;
const rows = [];
function read(dir) {
  for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, child.name);
    if (child.isDirectory()) read(file);
    else if (/\.tsx$/.test(file)) scan(file);
  }
}
function scan(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const props = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute)
        .map(prop => [prop.name.getText(source), prop.initializer?.getText(source) ?? true]));
      const handlers = Object.entries(props).filter(([name]) => events.test(name));
      if (tags.has(tag) || tag === 'a' && props.href || interactiveRole.test(String(props.role ?? '')) || handlers.length || primitives.test(tag)) {
        const parent = ts.isJsxOpeningElement(node) ? node.parent : node;
        const labelNode = parent.parent?.openingElement?.tagName?.getText(source) === 'label' ? parent.parent : parent;
        const label = props['aria-label'] ?? props.label ?? props.title ?? labelNode.children?.filter(ts.isJsxText).map(part => part.getText(source).trim()).filter(Boolean).join(' ');
        const fileName = path.relative(root, file).split(path.sep).join('/');
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const conditional = [];
        for (let ancestor = node.parent; ancestor && ancestor !== source; ancestor = ancestor.parent) {
          if (ts.isConditionalExpression(ancestor)) conditional.push(ancestor.condition.getText(source));
          else if (ts.isBinaryExpression(ancestor) && ancestor.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) conditional.push(ancestor.left.getText(source));
        }
        rows.push({ source: fileName, line, control: tag, label: label || '(computed or inherited)',
          handlers: Object.fromEntries(handlers), conditional, role: props.role ?? '',
          disabled: props.disabled ?? false, result: props.disabled === true ? 'INTENTIONALLY DISABLED' : 'UNTESTED',
          test: '', issue: tag === 'select' ? 'Platform dropdown' : '', resolution: '' });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
read(path.join(root, 'src'));
const report = JSON.stringify({ root, sourceControlCount: rows.length, entries: rows }, null, 2) + '\n';
if (output) fs.writeFileSync(output, report);
else process.stdout.write(report);
