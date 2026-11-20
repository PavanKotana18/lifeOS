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
const MoneyPlanning = require('./src/components/MoneyPlanning.tsx').default;
const source = fs.readFileSync('./src/components/MoneyPlanning.tsx', 'utf8');
const noop = async () => {};
const props = {
  commitments: [], rates: [], accounts: [], categories: [], confirmAction: async () => true,
  onAddCommitment: noop, onUpdateCommitment: noop, onDeleteCommitment: noop,
  onAddRate: noop, onUpdateRate: noop, onDeleteRate: noop,
};
const draftState = {
  commitment: { title: 'Rent', amount: '25000.00', currency: 'INR', frequency: 'monthly', date: '2026-12-01', categoryId: '', accountId: '', notes: 'Keep this draft' },
  rate: { base: 'USD', quote: 'INR', value: '83.25', date: '2026-11-09', source: 'Bank statement' },
  commitmentDirty: true,
  rateDirty: true,
};
const markup = renderToStaticMarkup(React.createElement(MoneyPlanning, { ...props, draftState, onDraftStateChange: () => {}, saving: true }));
assert.match(markup, /aria-labelledby="money-commitment-dialog-title"[^>]*aria-busy="true"/);
assert.match(markup, /aria-label="Manual exchange rate"[^>]*aria-busy="true"/);
assert.match(markup, /value="Rent"/);
assert.match(markup, /value="25000\.00"/);
assert.match(markup, /value="Keep this draft"/);
assert.match(markup, /value="83\.25"/);
assert.match(markup, /value="Bank statement"/);
assert.equal((markup.match(/disabled=""/g) || []).length, 6, 'Close, Cancel and Save are disabled in both composers during a guarded write');
assert.match(markup, />Saving…</);

assert.match(source, /export type MoneyPlanningDraftState = \{ commitment: CommitmentDraft \| null; rate: RateDraft \| null; commitmentDirty: boolean; rateDirty: boolean \}/);
assert.match(source, /draftState\?: MoneyPlanningDraftState/);
assert.match(source, /onDraftStateChange\?: Dispatch<SetStateAction<MoneyPlanningDraftState>>/);
assert.match(source, /onDraftStateChange\(state => update\(state\)\)/, 'external draft writes use functional updates to avoid stale snapshots');
assert.match(source, /setCommitment\(current => current \? \{ \.\.\.current, title: e\.target\.value \} : current\)/);
assert.match(source, /setRate\(current => current \? \{ \.\.\.current, value: e\.target\.value \} : current\)/);
assert.match(source, /if \(saving \|\| !commitment\) return/);
assert.match(source, /if \(saving \|\| !rate\) return/);
const composer = fs.readFileSync('./src/components/ComposerShell.tsx', 'utf8');
assert.match(composer, /if \(!saving && event\.target === event\.currentTarget\)/, 'backdrop dismissal is ignored while saving');
assert.match(source, /decimalToMinorUnits\(commitment\.amount, commitment\.currency\)/, 'the existing minor-unit conversion remains in use');
assert.match(source, /baseCurrencyCode: rate\.base, quoteCurrencyCode: rate\.quote, rate: rate\.value\.trim\(\), effectiveDate: rate\.date/);
console.log('DIRECTED MONEY PLANNING: externally controlled drafts, saving guards, retained payload semantics, and rendered dirty drafts passed.');

const appSource = fs.readFileSync('src/App.tsx', 'utf8');
assert.ok(appSource.indexOf('<MoneyPlanning ') >= 0 && appSource.indexOf('<MoneyPlanning ') < appSource.indexOf('<PlannedCashFlow commitments='),
  'the timeline and scheduled controls precede the cash-flow summary in reading order');
assert.match(appSource, /financeSubtab === 'projection' && <Suspense/, 'Projection loads only on its own Money destination');

for(const [currency,min] of [['JPY','1'],['USD','0.01'],['KWD','0.001']]) {
 const rendered=renderToStaticMarkup(React.createElement(MoneyPlanning,{...props,draftState:{...draftState,rate:null,commitment:{...draftState.commitment,currency,amount:min}},onDraftStateChange:()=>{}}));
 assert.ok(rendered.includes(`min="${min}" step="any" inputMode="decimal"`),`${currency} bill entry accepts its smallest minor unit`);
}
