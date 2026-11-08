const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const servicePath = path.join(__dirname, '..', 'src', 'services', 'uiNavigation.ts');
const source = fs.readFileSync(servicePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const service = new Module(servicePath, module);
service.filename = servicePath;
service.paths = Module._nodeModulePaths(path.dirname(servicePath));
service._compile(compiled, servicePath);

assert.equal(service.exports.screenScrollKey({ tab: 'dashboard' }), 'dashboard');
assert.equal(service.exports.screenScrollKey({ tab: 'finance', financeSubtab: 'accounts' }), 'finance:accounts');
assert.equal(service.exports.screenScrollKey({ tab: 'finance', financeSubtab: 'overview' }), 'finance:overview');
assert.equal(service.exports.screenScrollKey({ tab: 'settings', profileSection: 'appearance' }), 'settings:appearance');
assert.equal(service.exports.screenScrollKey({ tab: 'goals', goalsSubtab: 'completed' }), 'goals:completed');
assert.equal(service.exports.screenScrollKey({ tab: 'habits', habitsSubtab: 'weekly' }), 'habits:weekly');
assert.equal(service.exports.readMotionDuration('200ms', 240), 200);
assert.equal(service.exports.readMotionDuration('0ms', 240), 0);
assert.equal(service.exports.readMotionDuration('invalid', 240), 240);

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
assert.match(appSource, /<RetainedScreen active=\{activeTab === 'dashboard'\}/);
assert.match(appSource, /<RetainedScreen active=\{activeTab === 'finance'\}/);
assert.match(appSource, /<RetainedScreen active=\{activeTab === 'plan'\}/);
assert.match(appSource, /<RetainedScreen active=\{activeTab === 'life'\}/);
assert.match(appSource, /prefers-reduced-motion/);
assert.match(appSource, /navigateTo\('planner'\)/);
assert.match(appSource, /resolveBackAction/);
assert.match(appSource, /screenAnimation\.current\?\.cancel\(\)/, 'a rapid route change cancels the previous animation');
assert.match(appSource, /screenScrollKey\(/, 'nested destinations receive separate scroll keys');
assert.match(appSource, /rememberActiveScroll\(\)/, 'navigation records the outgoing route scroll position');
assert.match(appSource, /pendingNotificationTaskId\.current/, 'notification task navigation remains connected');
assert.ok(appSource.indexOf('if (isLocked) {') < appSource.indexOf('<main className="max-w-md'), 'locked rendering replaces the retained private screen tree');

const retainedSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'RetainedScreen.tsx'), 'utf8');
assert.match(retainedSource, /useState\(active\)/, 'screens are mounted only when first visited');
assert.match(retainedSource, /hidden=\{!active\} aria-hidden=\{!active\}/, 'inactive screens leave layout and accessibility navigation');
assert.match(retainedSource, /React\.memo\(RetainedScreen/, 'visited inactive routes skip unrelated parent renders');

console.log('UI navigation foundation checks passed: 9 service assertions and 15 integration assertions.');
