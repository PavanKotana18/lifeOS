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
assert.match(markup, /aria-busy="true"[^>]*aria-label="Planned commitment"/);
assert.match(markup, /aria-busy="true"[^>]*aria-label="Manual exchange rate"/);
assert.match(markup, /value="Rent"/);
assert.match(markup, /value="25000\.00"/);
assert.match(markup, /value="Keep this draft"/);
assert.match(markup, /value="83\.25"/);
assert.match(markup, /value="Bank statement"/);
assert.equal((markup.match(/disabled=""/g) || []).length, 4, 'both Save and Cancel actions are disabled while either guarded write is pending');
assert.match(markup, />Saving…</);

assert.match(source, /export type MoneyPlanningDraftState = \{ commitment: CommitmentDraft \| null; rate: RateDraft \| null; commitmentDirty: boolean; rateDirty: boolean \}/);
assert.match(source, /draftState\?: MoneyPlanningDraftState/);
assert.match(source, /onDraftStateChange\?: Dispatch<SetStateAction<MoneyPlanningDraftState>>/);
assert.match(source, /onDraftStateChange\(state => update\(state\)\)/, 'external draft writes use functional updates to avoid stale snapshots');
assert.match(source, /setCommitment\(current => current \? \{ \.\.\.current, title: e\.target\.value \} : current\)/);
assert.match(source, /setRate\(current => current \? \{ \.\.\.current, value: e\.target\.value \} : current\)/);
assert.match(source, /if \(saving \|\| !commitment\) return/);
assert.match(source, /if \(saving \|\| !rate\) return/);
assert.match(source, /if \(!saving && event\.target === event\.currentTarget\)/, 'backdrop dismissal is ignored while saving');
assert.match(source, /decimalToMinorUnits\(commitment\.amount, commitment\.currency\)/, 'the existing minor-unit conversion remains in use');
assert.match(source, /baseCurrencyCode: rate\.base, quoteCurrencyCode: rate\.quote, rate: rate\.value\.trim\(\), effectiveDate: rate\.date/);
console.log('DIRECTED MONEY PLANNING: externally controlled drafts, saving guards, retained payload semantics, and rendered dirty drafts passed.');

const appSource = fs.readFileSync('src/App.tsx', 'utf8');
assert.ok(appSource.indexOf('<MoneyPlanning draftState=') < appSource.indexOf('Explore a savings projection'), 'Bills and explicit rates appear before optional scenarios');
assert.match(appSource, /activeTab === 'finance' && projectionExpanded && <Suspense/, 'Projection loads only after its disclosure is expanded on Money');
