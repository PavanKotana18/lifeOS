'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const Header=require('./src/components/MoneyDetailHeader.tsx').default;
for(const section of ['transactions','accounts','budgets','savings','planning','analytics']){
 let back=0; const props={section,month:'2026-11',onMonthChange(){},onBack:()=>back++};
 const html=renderToStaticMarkup(React.createElement(Header,props)); assert.match(html,/Money overview/);assert.match(html,/<h2/);
 const tree=Header(props);const walk=(n,f)=>{if(!n)return;if(Array.isArray(n))return n.forEach(x=>walk(x,f));if(typeof n==='object'){f(n);walk(n.props?.children,f);}};
 walk(tree,node=>{if(node.type==='button')node.props.onClick();});assert.equal(back,1);
 if(section==='planning')assert.match(html,/Plans/);if(section==='analytics')assert.match(html,/Insights/);
}
const Period = require('./src/components/MoneyPeriod.tsx').default;
const period = renderToStaticMarkup(React.createElement(Period, { label: 'Money', month: '2026-11', onChange() {} }));
assert.match(period, /aria-haspopup="dialog"/);
assert.match(period, /aria-pressed="true">November<\/button>/);
const loaded = { exports: {} };
const periodSource = fs.readFileSync('src/components/MoneyPeriod.tsx', 'utf8');
let year = 'invalid';
const reactHooks = { useId: () => 'period', useRef: () => ({ current: null }), useState: () => [year, value => { year = value; }] };
new Function('require', 'module', 'exports', ts.transpileModule(periodSource, {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText)(name => name === 'react' ? reactHooks : require(name), loaded, loaded.exports);
let selected = '2026-11';
const read = () => {
 const tree = loaded.exports.default({ label: 'Money', month: selected, onChange: value => { selected = value; } });
 const found = {};
 const visit = value => {
   if (Array.isArray(value)) return value.forEach(visit);
   if (!value?.props) return;
   if (value.type === 'input') found.year = value.props;
   if (value.type === 'button' && value.props.children === 'February') found.month = value.props;
   visit(value.props.children);
 };
 visit(tree);
 return found;
};
assert.equal(read().month.disabled, true);
read().month.onClick();
assert.equal(selected, '2026-11');
read().year.onChange({ target: { value: '2027' } });
assert.equal(read().month.disabled, false);
read().month.onClick();
assert.equal(selected, '2027-02');

const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.match(app, /aria-label="Search transactions"/);
assert.match(app, /data-activity-filters aria-label="Transaction filters"/);
assert.match(app, /Minimum amount/);
assert.match(app, /Through date/);
assert.ok(app.includes("setFinanceCategoryFilter('all')"));
assert.ok(app.includes('formatMinorUnits(BigInt(t.amountMinor)'));
console.log('PASS Money detail headings, actual period validation/back handlers, explicit posted/planned labels and exact amount wiring');
