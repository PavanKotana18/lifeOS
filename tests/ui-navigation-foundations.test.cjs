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
assert.equal(navigation.screenScrollKey({ tab: 'planner', detailKey: 'fixture' }), 'planner:fixture');
assert.equal(navigation.readMotionDuration('170ms', 260), 170);
assert.equal(navigation.readMotionDuration('0ms', 260), 0);
assert.equal(navigation.readMotionDuration('invalid', 260), 260);
assert.equal(navigation.retainedScreenTransitionState(true, 'prepare'), 'enter-prepare');
assert.equal(navigation.retainedScreenTransitionState(true, 'running'), 'entering');
assert.equal(navigation.retainedScreenTransitionState(true, null), 'active');
assert.equal(navigation.retainedScreenTransitionState(false, 'prepare'), 'inactive');
assert.equal(navigation.retainedScreenTransitionState(false, 'running'), 'inactive');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
assert.match(app, /<RetainedScreen active=\{activeTab === 'dashboard'\} retainInactive/, 'Today is retained for swipe previews');
assert.match(app, /<RetainedScreen active=\{activeTab === 'plan'\} retainInactive/, 'Tasks retains its local filters across Plan sections and detail routes');
assert.match(app, /retainInactive prepare=\{primaryPrepared\} id="screen-settings"/, "Profile is retained and prewarmed for the swipe track");
assert.match(app, /<RetainedScreen active=\{activeTab === 'finance'\} retainInactive/,
  'Money retains local account and planning form drafts while another tab is briefly visited');
assert.match(app, /useInterfaceMotion\(\)/);
assert.match(app, /navigateTo\('planner'\)/, 'Today routes into the task destination');
assert.match(app, /resolveBackAction/);
const track = fs.readFileSync(path.join(__dirname, '..', 'src', 'hooks', 'useAliveNavigation.ts'), 'utf8');
assert.match(track, /if \(reduced\) return/);
assert.match(track, /useLayoutEffect\(\(\) => \{\s*if \(!tabTransition\) return;/,
  'the track animates during the incoming route commit before paint');
assert.match(track, /Promise\.all\(animations\.map\(animation => animation\.finished\)\)\.then\(finish, finish\)/,
  'settles when synchronized animations finish or reject');
assert.match(track, /if \(!animations\.length\) \{ cancel\(\); return; \}/, 'unsupported animation falls back to an immediate route');
assert.match(track, /transition\.current\?\.id !== flight\.id/, 'obsolete transitions cannot settle newer navigation');
assert.match(app, /transitionToTab\(tab, direction, velocity,/, 'tap and swipe destinations share one transition path');
assert.match(track, /clearDrag\(\);\s*cancel\(\);[\s\S]*?if \(reduced \|\| !old/, 'reduced-motion navigation clears the outgoing drag state');
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
assert.match(app, /\[data-horizontal-scroll\].*\[role="slider"\]/);
assert.match(app, /textarea,select,\[contenteditable="true"\].*input:not\(\[type="button"\]/,
  'text entry, native pickers and sliders do not hand their interaction to tab navigation');
assert.match(app, /if \(activeTouchPointers\.current\.size > 1\)/, 'multi-touch cancels the current gesture');
assert.match(app, /if \(start\.viewportWidth !== window\.innerWidth\)/, 'a resized viewport cancels the active gesture');
assert.match(app, /if \(!isLocked\) return;[\s\S]*cancelPrimaryGesture\('app-locked'\)[\s\S]*cancelTrack\(\)/, 'locking cancels active gestures and settles transitions before private screens are removed');
assert.match(app, /screenScrollKey\(/);
assert.match(app, /rememberActiveScroll\(\)/);
assert.match(app, /pendingNotification\.current/, 'notification task routing remains connected');

const retained = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'RetainedScreen.tsx'), 'utf8');
assert.match(retained, /visited\.current = true/);
assert.match(retained, /if \(!active && !outgoing && !refresh && \(!retainInactive \|\| !visited\.current\)\) return null/);
assert.match(retained, /hidden=\{!active && !outgoing\}/, 'only the current and moving outgoing surfaces can be painted');
assert.match(retained, /aria-hidden=\{!active\}[\s\S]*toggleAttribute\('inert', !active\)/,
  'inactive previews and outgoing content are removed from accessibility and focus navigation');
assert.match(retained, /data-transition-state=\{outgoing \? "outgoing" : transitionState\}/);
assert.doesNotMatch(retained, /exiting|exit-prepare|onExitTransitionEnd/);

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');
const feather = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'feather-expressive.css'), 'utf8');
assert.match(css, /--motion-tab: 190ms/);
assert.match(css, /\.app-main[^\n]*touch-action: pan-y pinch-zoom/);
assert.match(css, /\.ui-tab-screen \{[^}]*background: var\(--page\)/);
assert.match(css, /\.ui-tab-screen\[hidden\] \{ display: none !important; \}/);
assert.match(feather, /\.ui-tab-viewport[^}]*overflow-x: clip; overflow-y: clip/);
assert.match(feather, /\.ui-tab-screen-stack\[data-track-dragging\][^}]*will-change: transform/);
assert.match(feather, /\[data-gesture-preview\]\[hidden\][^}]*pointer-events: none/);
assert.doesNotMatch(css, /\.ui-tab-screen[^}]*enter-prepare[^}]*opacity: \.92/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.app-bottom-nav[^\n]*safe-area-inset-bottom/);

console.log('UI NAVIGATION: scroll, transition lifecycle, gesture ownership, privacy, and responsive-shell contracts passed.');
