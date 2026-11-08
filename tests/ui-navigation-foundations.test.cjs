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
assert.equal(service.exports.retainedScreenTransitionState(true, false, 'prepare'), 'enter-prepare');
assert.equal(service.exports.retainedScreenTransitionState(true, false, 'running'), 'entering');
assert.equal(service.exports.retainedScreenTransitionState(true, false, null), 'active');
assert.equal(service.exports.retainedScreenTransitionState(false, true, 'prepare'), 'exit-prepare');
assert.equal(service.exports.retainedScreenTransitionState(false, true, 'running'), 'exiting');
assert.equal(service.exports.retainedScreenTransitionState(false, false, null), 'inactive');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
assert.match(appSource, /<RetainedScreen active=\{activeTab === 'dashboard'\}/);
assert.match(appSource, /<RetainedScreen active=\{activeTab === 'finance'\}/);
assert.match(appSource, /<RetainedScreen active=\{activeTab === 'plan'\}/);
assert.match(appSource, /<RetainedScreen active=\{activeTab === 'life'\}/);
assert.match(appSource, /prefers-reduced-motion/);
assert.match(appSource, /navigateTo\('planner'\)/);
assert.match(appSource, /resolveBackAction/);
assert.match(appSource, /activeTransitionId\.current = id/, 'each route transition receives a cancellation token');
assert.match(appSource, /tabTransition\?\.to === previous[\s\S]*getComputedStyle\(outgoing\)/, 'rapid retargeting starts the outgoing route from its current painted position');
assert.match(appSource, /window\.requestAnimationFrame\(\(\) =>/, 'enter and exit targets change after a paint opportunity');
assert.match(appSource, /onExitTransitionEnd/, 'outgoing view stays until its opacity transition ends');
assert.match(appSource, /duration \+ 120/, 'transition end has a bounded cleanup fallback');
assert.match(appSource, /transitionToTab\(tab\)/, 'primary tab changes enter the shared transition lifecycle');
assert.match(appSource, /activeTransitionId\.current = null;\s*setTabTransition\(null\);\s*setActiveTab\(tab\)/, 'reduced motion settles navigation immediately');
assert.match(appSource, /if \(!isLocked\) return;[\s\S]*setTabTransition\(null\)/, 'locking settles transitions before private screens unmount');
assert.match(appSource, /screenScrollKey\(/, 'nested destinations receive separate scroll keys');
assert.match(appSource, /rememberActiveScroll\(\)/, 'navigation records the outgoing route scroll position');
assert.match(appSource, /pendingNotificationTaskId\.current/, 'notification task navigation remains connected');
assert.ok(appSource.indexOf('if (isLocked) {') < appSource.indexOf('<main className="max-w-md'), 'locked rendering replaces the retained private screen tree');

const retainedSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'RetainedScreen.tsx'), 'utf8');
assert.match(retainedSource, /useState\(active\)/, 'screens are mounted only when first visited');
assert.match(retainedSource, /hidden=\{!active && !exiting\}/, 'outgoing screen remains paintable until exit completes');
assert.match(retainedSource, /aria-hidden=\{!active\}[\s\S]*toggleAttribute\('inert', !active\)/, 'inactive and exiting screens cannot be focused or activated');
assert.match(retainedSource, /data-transition-state=\{transitionState\}/, 'incoming screens receive a distinct entry state');
assert.match(retainedSource, /React\.memo\(RetainedScreen/, 'visited inactive routes skip unrelated parent renders');
const styles = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');
assert.match(styles, /--motion-tab: 260ms/);
assert.match(styles, /enter-prepare[^}]*opacity: \.88; transform: translate3d\(0, 16px, 0\)/);
assert.match(styles, /data-transition-state="exiting"[^}]*opacity: \.88/);
assert.match(styles, /ui-tab-screen-stack > \[data-lifeos-screen\] \{ grid-area: 1 \/ 1;/);
assert.match(styles, /data-transition-state="entering"\],\s*\.ui-tab-screen\[data-transition-state="active"\] \{ z-index: 2;/);
assert.match(styles, /\.ui-tab-screen\[data-transition-state\].*transition: none !important/s);

console.log('UI navigation foundation checks passed: 15 service assertions and 28 integration assertions.');
