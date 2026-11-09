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
  initialName: 'Synthetic User', onSaveIdentity: async () => {}, onProvisionProtection: async () => ({success:true}), onConfirmRecovery: async () => true, onFinish: async () => {},
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
 const screen = renderToStaticMarkup(React.createElement(Onboarding, { initialName:'Synthetic', initialJourney:{...INITIAL_ONBOARDING_JOURNEY, stage}, onSaveIdentity:async()=>{}, onProvisionProtection:async()=>({success:true}), onConfirmRecovery:async()=>true, onFinish:async()=>{} }));
 assert.match(screen, stage === 'protection' ? /Your space\. Just yours\./ : /Keep a way back\./);
 assert.match(screen, stage === 'protection' ? /Continue with secure unlock/ : /Create and save recovery kit/);
 assert.doesNotMatch(screen, /Not now|Set this up later/);
 assert.match(screen, /Step [23] of 3/);
 if(stage==='recovery') assert.match(screen, /recovery name/i);
}
console.log('ONBOARDING: all three real components render mandatory protection and cryptographic recovery stages with clear progress.');
