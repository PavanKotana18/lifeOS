'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  loadedModule._compile(output, filename);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
require('./scripts/register-ts-test-loader.cjs');
const Onboarding = require('./src/components/Onboarding.tsx').default;
const html = renderToStaticMarkup(React.createElement(Onboarding, {
  initialName: 'Synthetic User', onSaveIdentity: async () => {}, onFinish: async () => {},
}));
assert.match(html, /Welcome\. What should we call you\?/);
assert.match(html, /Continue/);
assert.match(html, /Synthetic User/);
assert.match(html, /LifeOS/);
assert.doesNotMatch(html, /Enable selected notifications|Follow system theme|role="progressbar"/i);
assert.match(html, /name="?[^\"]*|placeholder="Name"/);
assert.match(html, /Step 1 of 3/);
const { INITIAL_ONBOARDING_JOURNEY } = require('./src/services/onboardingJourney.ts');
for (const stage of ['protection', 'recovery']) {
 const screen = renderToStaticMarkup(React.createElement(Onboarding, { initialName:'Synthetic', initialJourney:{...INITIAL_ONBOARDING_JOURNEY, stage}, onSaveIdentity:async()=>{}, onFinish:async()=>{} }));
 assert.match(screen, stage === 'protection' ? /A little privacy, just for you/ : /A name to help you find your way back/);
 assert.match(screen, stage === 'protection' ? /Not now/ : /Set this up later/);
 assert.match(screen, /Your records stay on your device/);
 if(stage==='recovery') assert.match(screen, /name alone cannot restore your data/);
}
console.log('ONBOARDING: all three real components render optional protection, non-secret recovery label and clear progress.');
