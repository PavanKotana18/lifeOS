'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function loadTs(relativePath) {
  const filename = path.join(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const navigation = loadTs('src/services/uiNavigation.ts');
assert.equal(navigation.screenScrollKey({ tab: 'dashboard' }), 'dashboard');
assert.equal(navigation.screenScrollKey({ tab: 'finance', financeSubtab: 'accounts' }), 'finance:accounts');
assert.equal(navigation.screenScrollKey({ tab: 'finance', financeSubtab: 'overview' }), 'finance:overview');
assert.equal(navigation.screenScrollKey({ tab: 'settings', profileSection: 'appearance' }), 'settings:appearance');
assert.equal(navigation.screenScrollKey({ tab: 'goals', goalsSubtab: 'completed' }), 'goals:completed');
assert.equal(navigation.screenScrollKey({ tab: 'habits', habitsSubtab: 'weekly' }), 'habits:weekly');
assert.equal(navigation.readMotionDuration('170ms', 260), 170);
assert.equal(navigation.readMotionDuration('0ms', 260), 0);
assert.equal(navigation.readMotionDuration('invalid', 260), 260);
assert.equal(navigation.retainedScreenTransitionState(true, 'prepare'), 'enter-prepare');
assert.equal(navigation.retainedScreenTransitionState(true, 'running'), 'entering');
assert.equal(navigation.retainedScreenTransitionState(true, null), 'active');
assert.equal(navigation.retainedScreenTransitionState(false, 'prepare'), 'inactive');
assert.equal(navigation.retainedScreenTransitionState(false, 'running'), 'inactive');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
for (const tab of ['dashboard', 'plan', 'life']) {
  assert.match(app, new RegExp(`<RetainedScreen active=\\{activeTab === '${tab}'\\}(?! retainInactive)`), `${tab} is unmounted when inactive because its UI state is owned by App`);
}
assert.match(app, /<RetainedScreen active=\{activeTab === 'finance'\} retainInactive/,
  'Money retains local account and planning form drafts while another tab is briefly visited');
assert.match(app, /prefers-reduced-motion/);
assert.match(app, /navigateTo\('planner'\)/, 'Today routes into the task destination');
assert.match(app, /resolveBackAction/);
assert.match(app, /window\.requestAnimationFrame\(\(\) =>[\s\S]*setTabTransition\(current => current\?\.id === id/,
  'the incoming screen is painted in its prepared state before the transition starts');
assert.match(app, /onTransitionEnd: \(event[\s\S]*propertyName === 'transform'[\s\S]*finishTabTransition/,
  'the active transition settles on its own transform lifecycle event');
assert.match(app, /duration \+ 120/, 'a bounded fallback resolves missing transition events');
assert.match(app, /activeTransitionId\.current !== id/, 'obsolete transition callbacks cannot settle a newer navigation');
assert.match(app, /transitionToTab\(tab, direction\)/, 'tap and swipe destinations share one transition path');
const transitionHandler = app.match(/const transitionToTab = \(tab: MainTab[\s\S]*?\n  \};/);
assert.ok(transitionHandler, 'tab transition has one owner');
assert.ok(transitionHandler[0].indexOf("removeAttribute('data-gesture-dragging')") < transitionHandler[0].indexOf('if (reducedMotion)'),
  'reduced-motion navigation clears the outgoing drag state before settling');
assert.match(app, /axis === 'horizontal'.*setPointerCapture\(event\.pointerId\)/s,
  'pointer capture starts only after horizontal intent so an ordinary tap keeps its native click');
assert.match(app, /updatePrimaryGesture\(start, event\.pointerId/);
assert.match(app, /resolvePrimaryGestureEnd\(activeTabRef\.current, start, event\.pointerId/);
assert.match(app, /window\.addEventListener\('pointermove',[\s\S]*window\.addEventListener\('pointerup',[\s\S]*window\.addEventListener\('pointercancel',[\s\S]*window\.addEventListener\('lostpointercapture'/,
  'the single global tracking layer completes gestures outside the content surface and handles interruption');
assert.match(app, /onAdditionalPointerDown[\s\S]*cancelPrimaryGesture\('multiple-pointers'[\s\S]*reason: 'multiple-pointers'/,
  'a second touch outside the content surface cancels an in-progress swipe too');
assert.match(app, /onClickCapture=\{handleContentClickCapture\}/, 'a drag suppresses its own control click while taps remain native');
assert.match(app, /const handleContentLostPointerCapture = \(event[\s\S]*?endPointerTracking\(event\.pointerId\)/,
  'lost capture removes its pointer so a stale ID cannot suppress later gestures');
assert.match(app, /window-blurred[\s\S]*activeTouchPointers\.current\.clear\(\)/);
assert.match(app, /event\.clientX <= leftGutter[\s\S]*event\.clientX >= window\.innerWidth - rightGutter/,
  'system edge areas are excluded using runtime and safe-area values');
assert.match(app, /button,a,label,summary,input\[type="button"\].*\[role="tab"\]/);
assert.match(app, /\[data-horizontal-scroll\].*\.recharts-wrapper.*canvas.*\[role="slider"\]/);
assert.match(app, /textarea,select,\[contenteditable="true"\].*input:not\(\[type="button"\]/,
  'text entry, native pickers and sliders do not hand their interaction to tab navigation');
assert.match(app, /if \(activeTouchPointers\.current\.size > 1\)/, 'multi-touch cancels the current gesture');
assert.match(app, /if \(start\.viewportWidth !== window\.innerWidth\)/, 'a resized viewport cancels the active gesture');
assert.match(app, /if \(!isLocked\) return;[\s\S]*cancelPrimaryGesture\('app-locked'\)[\s\S]*setTabTransition\(null\)/, 'locking cancels active gestures and settles transitions before private screens are removed');
assert.match(app, /screenScrollKey\(/);
assert.match(app, /rememberActiveScroll\(\)/);
assert.match(app, /pendingNotificationTaskId\.current/, 'notification task routing remains connected');

const retained = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'RetainedScreen.tsx'), 'utf8');
assert.match(retained, /if \(active && !visited\) setVisited\(true\)/);
assert.match(retained, /if \(!active && \(!retainInactive \|\| !visited\)\) return null/);
assert.match(retained, /hidden=\{!active\}/, 'only active content is painted; no outgoing ghost layer remains');
assert.match(retained, /aria-hidden=\{!active\}[\s\S]*toggleAttribute\('inert', !active\)/,
  'inactive retained screens are removed from accessibility and focus navigation');
assert.match(retained, /data-transition-state=\{transitionState\}/);
assert.doesNotMatch(retained, /exiting|exit-prepare|onExitTransitionEnd/);

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');
assert.match(css, /--motion-tab: 190ms/);
assert.match(css, /\.app-main[^\n]*touch-action: pan-y pinch-zoom/);
assert.match(css, /\.ui-tab-screen \{[^}]*background: var\(--page\)/);
assert.match(css, /\.ui-tab-screen\[hidden\] \{ display: none !important; \}/);
assert.match(css, /enter-prepare[^}]*opacity: \.92; transform: translate3d\(0, 4px, 0\)/);
assert.match(css, /data-transition-direction="left"\]\[data-transition-state="enter-prepare"\][^}]*translate3d\(16px, 0, 0\)/);
assert.match(css, /data-transition-state="entering"[^}]*transition: opacity var\(--motion-tab\)[^}]*transform var\(--motion-tab\)/);
assert.match(css, /\.ui-tab-screen\[data-gesture-dragging="true"\][^}]*transition: none !important[^}]*translate3d\(var\(--gesture-x/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.app-bottom-nav[^\n]*safe-area-inset-bottom/);

console.log('UI NAVIGATION: scroll, transition lifecycle, gesture ownership, privacy, and responsive-shell contracts passed.');
