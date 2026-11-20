const fs = require('node:fs');

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const [sourceFile, browserFile, outputFile, focusedFile] = process.argv.slice(2);
const source = read(sourceFile);
const browser = read(browserFile);
const focused = focusedFile ? read(focusedFile) : null;
const browserRuns = [browser, focused].filter(Boolean);
const snapshots = browserRuns.flatMap(run => Object.entries(run.auditedControls ?? {}));
const verifiedBehaviors = [
  ['create and complete a task', /Add task|Mark QA acceptance.*complete/, 'Open, commit and complete a task through the encrypted fixture'],
  ['create a posted expense and budget', /Add transaction|Add budget|Category|Time period/, 'Commit exact minor units or apply a choice and verify the resulting UI'],
  ['create and check in a habit', /Add habit|Progress tracking|Mark QA acceptance|Increase.*quantity|Decrease.*quantity/, 'Save and verify tracked check-ins and quantity'],
  ['create a goal, milestone and progress update', /Add goal|Edit goal|Save changes|Milestone|Update progress|Pause goal|Resume goal|Target date and notes/, 'Verify saved goal data, deadline state, progress or lifecycle'],
  ['accounts, transfer and recurring plan persist encrypted', /Add account|Record transfer|Add scheduled item|Frequency|Category \(optional\)|Record occurrence|History/, 'Verify encrypted ledger or scheduled records and history'],
  ['reconstruction interaction gate', /Notes and subtasks|Priority|Currency|Search currencies|Cancel/, 'Verify retained note state, sheet selection or dismissal, keyboard focus and draft behavior'],
];
const resultRows = [];
function row(scope, control, run) {
  const journey = scope.split(' / ').at(-1);
  const found = run.controlActions?.find(event => event.journey === journey && scope === event.scope + ' / ' + journey && event.control.name === control.name && event.control.type === control.type);
  const passed = run.journeys.some(entry => entry.name === journey && entry.status === 'PASS');
  const verified = passed && found && verifiedBehaviors.find(([name, labels]) => name === journey && labels.test(control.name));
  return { scope, source: '', type: control.type, label: control.name, expected: verified?.[2] || '', actual: found ? found.event : '',
    destination: '', dataOperation: '', feedback: '', back: '', accessibility: control.name, motion: '',
    test: found ? journey : '', result: verified ? (journey === 'reconstruction interaction gate' ? 'FIXED AND VERIFIED' : 'VERIFIED') : control.disabled ? 'INTENTIONALLY DISABLED' : 'UNTESTED',
    issue: verified || control.disabled ? '' : 'A definition, visibility, or event alone does not verify the outcome.' };
}
for (const run of browserRuns) for (const [scope, controls] of Object.entries(run.auditedControls ?? {})) {
  for (const control of Object.values(controls)) resultRows.push(row(scope, control, run));
}
for (const entry of source.entries) resultRows.push({
  scope: entry.conditional.join(' / '), source: entry.source + ':' + entry.line,
  type: entry.control, label: entry.label, expected: Object.keys(entry.handlers).join(', '), actual: '',
  destination: '', dataOperation: '', feedback: '', back: '', accessibility: entry.role, motion: '',
  test: '', result: entry.result, issue: entry.issue, resolution: entry.resolution,
});
for (const label of ['Android system Back', 'Android credentials and biometrics', 'Android date and time dialogs', 'System file or photo picker', 'Native notification delivery and alarm routing', 'Physical WebView swipe pacing']) {
  resultRows.push({ scope: 'Android system', type: 'platform', label, result: 'BLOCKED', issue: 'Host memory makes the emulator impractical. Android behavior was not tested.' });
}
const keys = ['scope','source','type','label','expected','actual','destination','dataOperation','feedback','back','accessibility','motion','test','result','issue','resolution'];
const quote = value => '"' + String(value ?? '').replaceAll('"','""') + '"';
fs.writeFileSync(outputFile, [keys.join(','), ...resultRows.map(record => keys.map(key => quote(record[key])).join(','))].join('\n') + '\n');
console.log(JSON.stringify({ source: source.sourceControlCount, renderedScopes: snapshots.length,
  rows: resultRows.length, statuses: Object.fromEntries([...new Set(resultRows.map(row => row.result))]
    .map(status => [status, resultRows.filter(row => row.result === status).length])) }));
