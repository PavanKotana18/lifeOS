'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./scripts/register-ts-test-loader.cjs');
require.extensions['.tsx'] = (loaded, file) => loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const MoneyPlanning = require('./src/components/MoneyPlanning.tsx').default;
const { formatMinorUnits } = require('./src/services/financeCore.ts');
const source = ts.createSourceFile('MoneyPlanning.tsx', fs.readFileSync('src/components/MoneyPlanning.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'recordOccurrence') initializer = node.initializer.getText(source);
  ts.forEachChild(node, find);
}
find(source);
assert.ok(initializer, 'Exercise the actual component confirmation handler');
const handlerCode = ts.transpileModule(`const handler = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const bind = values => new Function(...Object.keys(values), `${handlerCode}; return handler;`)(...Object.values(values));
const category = { id: 'qa-category', name: 'Synthetic salary', type: 'income', color: '#456789' };
const row = { id: 'qa-plan', title: 'Synthetic income', type: 'income', amount: 1.234, amountMinor: '1234', currencyCode: 'KWD', frequency: 'monthly', nextDueDate: '2020-01-31', categoryId: category.id, status: 'active', createdAt: '2020-01-01T00:00:00Z' };
const noop = async () => {};
const markup = renderToStaticMarkup(React.createElement(MoneyPlanning, {
  commitments: [row, { ...row, id: 'paused', title: 'Paused plan', status: 'paused' }, { ...row, id: 'future', title: 'Future plan', nextDueDate: '9999-01-01' }],
  rates: [], accounts: [], categories: [category], confirmAction: async () => true,
  onAddCommitment: noop, onUpdateCommitment: noop, onDeleteCommitment: noop,
  onAddRate: noop, onUpdateRate: noop, onDeleteRate: noop, onRecordOccurrence: noop,
}));
assert.match(markup, /aria-label="Record occurrence for Synthetic income"/);
assert.match(markup, /disabled=""[^>]*aria-label="Record occurrence for Paused plan"/);
assert.match(markup, /disabled=""[^>]*aria-label="Record occurrence for Future plan"/);
assert.match(markup, /Incoming · Monthly/);
assert.match(markup, /aria-label="View Synthetic income"/);
assert.match(markup, /aria-label="About Recurring Money confirmation"/);
assert.match(markup, /An upcoming occurrence is a plan until recording succeeds/);
(async () => {
  for (const consent of [false, true]) {
    const states = [], errors = [], writes = [], confirmations = [];
    await bind({ saving: false, postingId: null, categories: [category], accounts: [], formatMinorUnits,
      setPostingId: value => states.push(value), setError: value => errors.push(value),
      confirmAction: async options => { confirmations.push(options); return consent; },
      onRecordOccurrence: async value => writes.push(value),
    })(row);
    assert.deepEqual(states, [row.id, null]);
    assert.equal(writes.length, consent ? 1 : 0, 'Cancel never reaches the write callback');
    if (consent) assert.equal(writes[0], row, 'The reviewed snapshot reaches the guarded storage operation');
    assert.match(confirmations[0].message, /1\.234/);
    assert.match(confirmations[0].message, /KWD/, 'Confirmation identifies the source currency');
    assert.match(confirmations[0].message, /2020-01-31/);
    assert.match(confirmations[0].message, /income/);
    assert.match(confirmations[0].message, /without an account/);
  }
  let message, called = false;
  await bind({ saving: false, postingId: null, categories: [category], accounts: [], formatMinorUnits,
    setPostingId: noop, setError: value => { message = value; }, confirmAction: async () => true,
    onRecordOccurrence: async () => { called = true; throw new Error('This plan changed. Review it again.'); },
  })(row);
  assert.equal(called, true); assert.match(message, /Review it again/);
  for (const blocked of [{ saving: true, postingId: null }, { saving: false, postingId: row.id }]) {
    let touched = false;
    await bind({ ...blocked, categories: [category], accounts: [], formatMinorUnits,
      setPostingId: () => { touched = true; }, setError: noop,
      confirmAction: async () => { touched = true; return true; },
      onRecordOccurrence: async () => { touched = true; },
    })(row);
    assert.equal(touched, false, 'An active write prevents a second confirmation');
  }
  let confirmed = false, posted = false;
  await bind({ saving: false, postingId: null, categories: [], accounts: [], formatMinorUnits,
    setPostingId: noop, setError: value => { message = value; },
    confirmAction: async () => { confirmed = true; return true; },
    onRecordOccurrence: async () => { posted = true; },
  })(row);
  assert.equal(confirmed, false); assert.equal(posted, false);
  assert.match(message, /choose a category/i);
  console.log('COMMITMENT UI: due/paused/future controls, reviewed currency/date/type, cancellation and write-error feedback passed; no browser/native rendering claimed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
