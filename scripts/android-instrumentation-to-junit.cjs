'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseInstrumentation(output) {
  const tests = [];
  let status = {};
  for (const line of output.split(/\r?\n/)) {
    const field = line.match(/^INSTRUMENTATION_STATUS: ([^=]+)=(.*)$/);
    if (field) {
      status[field[1]] = field[2];
      continue;
    }
    const codeMatch = line.match(/^INSTRUMENTATION_STATUS_CODE: (-?\d+)/);
    if (!codeMatch) continue;
    const code = Number(codeMatch[1]);
    if ([0, -2, -3, -4].includes(code) && status.class && status.test) {
      tests.push({
        classname: status.class,
        name: status.test,
        code,
        failure: status.stack || status.stream || 'Android instrumentation reported a failure without a stack trace.',
      });
      status = {};
    }
    status = {};
  }
  return tests;
}

function xmlEscape(value) {
  return String(value).replace(/[<>&"']/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[char]);
}

function completionProblems(output, tests) {
  const expected = [...new Set([...output.matchAll(/^INSTRUMENTATION_STATUS: numtests=(\d+)$/gm)].map(match => Number(match[1])))];
  const problems = [];
  if (expected.length !== 1 || expected[0] !== tests.length) problems.push(`Expected test count ${expected.join(',') || 'missing'}; completed ${tests.length}.`);
  if (!/^INSTRUMENTATION_CODE: -1\s*$/m.test(output)) problems.push('AndroidJUnitRunner did not terminate normally.');
  if (/^INSTRUMENTATION_(?:FAILED|RESULT: shortMsg=)/m.test(output)) problems.push('Android instrumentation reported a runner failure or process crash.');
  return problems;
}

function junit(tests, problems = []) {
  const failures = tests.filter(test => test.code === -2);
  const skipped = tests.filter(test => test.code === -3 || test.code === -4);
  const cases = tests.map(test => {
    if (test.code === -2) return `  <testcase classname="${xmlEscape(test.classname)}" name="${xmlEscape(test.name)}"><failure message="instrumentation failure"><![CDATA[${test.failure.replaceAll(']]>', ']]]]><![CDATA[>')}]]></failure></testcase>`;
    if (test.code === -3 || test.code === -4) return `  <testcase classname="${xmlEscape(test.classname)}" name="${xmlEscape(test.name)}"><skipped message="instrumentation skipped"/></testcase>`;
    return `  <testcase classname="${xmlEscape(test.classname)}" name="${xmlEscape(test.name)}"/>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="LifeOS Android instrumentation" tests="${tests.length}" failures="${failures.length}" skipped="${skipped.length}" errors="${problems.length}">\n${cases}\n</testsuite>\n`;
}

function selfTest() {
  const sample = [
    'INSTRUMENTATION_STATUS: class=example.Smoke',
    'INSTRUMENTATION_STATUS: test=opensApp',
    'INSTRUMENTATION_STATUS_CODE: 1',
    'INSTRUMENTATION_STATUS: class=example.Smoke',
    'INSTRUMENTATION_STATUS: test=opensApp',
    'INSTRUMENTATION_STATUS_CODE: 0',
    'INSTRUMENTATION_STATUS: class=example.Crypto',
    'INSTRUMENTATION_STATUS: test=rejectsTamper',
    'INSTRUMENTATION_STATUS_CODE: 1',
    'INSTRUMENTATION_STATUS: class=example.Crypto',
    'INSTRUMENTATION_STATUS: test=rejectsTamper',
    'INSTRUMENTATION_STATUS: stack=synthetic fixture failure',
    'INSTRUMENTATION_STATUS_CODE: -2',
    'INSTRUMENTATION_STATUS: class=example.Optional',
    'INSTRUMENTATION_STATUS: test=requiresHumanBiometric',
    'INSTRUMENTATION_STATUS_CODE: 1',
    'INSTRUMENTATION_STATUS: class=example.Optional',
    'INSTRUMENTATION_STATUS: test=requiresHumanBiometric',
    'INSTRUMENTATION_STATUS_CODE: -3',
  ].join('\n');
  const tests = parseInstrumentation(sample);
  if (tests.length !== 3 || tests.filter(test => test.code === -2).length !== 1) throw new Error('Instrumentation parser failure handling self-test failed.');
  if (tests.filter(test => test.name === 'requiresHumanBiometric').length !== 1) throw new Error('Instrumentation parser did not count the completed skip event.');
  const xml = junit(tests);
  if (!xml.includes('tests="3" failures="1" skipped="1"') || !xml.includes('synthetic fixture failure')) throw new Error('JUnit output self-test failed.');
  const complete = sample + '\nINSTRUMENTATION_STATUS: numtests=3\nINSTRUMENTATION_CODE: -1\n';
  if (completionProblems(complete, tests).length) throw new Error('Normal runner completion was rejected.');
  const crashed = sample + '\nINSTRUMENTATION_STATUS: numtests=4\nINSTRUMENTATION_RESULT: shortMsg=Process crashed.\nINSTRUMENTATION_CODE: 0\n';
  if (completionProblems(crashed, tests).length !== 3) throw new Error('Partial process crash was not rejected.');
  if (!completionProblems(sample, tests).length) throw new Error('Missing runner completion was accepted.');
  console.log('Instrumentation parser self-test passed (synthetic parser fixture only; no Android execution).');
}

if (process.argv[2] === '--self-test') {
  selfTest();
  process.exit(0);
}

const [input, destination, ...required] = process.argv.slice(2);
if (!input || !destination) throw new Error('Usage: node scripts/android-instrumentation-to-junit.cjs <raw-output> <junit-xml> [required-test-fragment ...]');
const output = fs.readFileSync(input, 'utf8').replace(/\r\n/g, '\n');
const tests = parseInstrumentation(output);
const problems = completionProblems(output, tests);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, junit(tests, problems));
const passed = tests.filter(test => test.code === 0);
const failures = tests.filter(test => test.code === -2);
const skipped = tests.filter(test => test.code === -3 || test.code === -4);
console.log(`Android instrumentation: ${tests.length} completed test cases; ${passed.length} passed, ${failures.length} failed, ${skipped.length} skipped.`);
if (problems.length) throw new Error(problems.join(' '));
if (tests.length === 0) throw new Error('Android instrumentation produced no completed test cases.');
if (passed.length === 0) throw new Error('Android instrumentation completed no passing test cases.');
for (const fragment of required) {
  if (!passed.some(test => `${test.classname}#${test.name}`.includes(fragment))) throw new Error(`Required Android smoke test did not pass: ${fragment}`);
}
if (failures.length) process.exitCode = 1;
