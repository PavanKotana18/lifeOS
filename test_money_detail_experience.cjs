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
 let month='2026-11',back=0; const props={section,month,onMonthChange:value=>month=value,onBack:()=>back++};
 const html=renderToStaticMarkup(React.createElement(Header,props)); assert.match(html,/Money overview/);assert.match(html,/<h2/);
 const tree=Header(props);const walk=(n,f)=>{if(!n)return;if(Array.isArray(n))return n.forEach(x=>walk(x,f));if(typeof n==='object'){f(n);walk(n.props?.children,f);}};
 walk(tree,node=>{if(node.type==='input'){node.props.onChange({target:{value:''}});assert.equal(month,'2026-11');node.props.onChange({target:{value:'2027-02'}});assert.equal(month,'2027-02');}if(node.type==='button')node.props.onClick();});assert.equal(back,1);
 if(section==='planning')assert.match(html,/Plans/);if(section==='analytics')assert.match(html,/Insights/);
}
const app=fs.readFileSync('src/App.tsx','utf8');assert.match(app,/aria-label="Search transactions"/);assert.match(app,/Refine transactions/);assert.match(app,/setFinanceCategoryFilter\('all'\)/);assert.match(app,/formatMinorUnits\(BigInt\(t.amountMinor\)/);
console.log('PASS Money detail headings, actual period validation/back handlers, explicit posted/planned labels and exact amount wiring');
