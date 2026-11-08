'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const ts = require('typescript');
require.extensions['.tsx'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  loadedModule._compile(output, filename);
};
const { mergeUserPreferences, DEFAULT_USER_PREFERENCES } = require('./src/services/userPreferences.ts');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { ProfileHome, ProfileSubpage } = require('./src/components/ProfileSettings.tsx');
const ProfilePreferences = require('./src/components/ProfilePreferences.tsx').default;
const app = fs.readFileSync('src/App.tsx', 'utf8');
const profile = fs.readFileSync('src/components/ProfileSettings.tsx', 'utf8');
const preferences = fs.readFileSync('src/components/ProfilePreferences.tsx', 'utf8');
const settings = app.slice(app.indexOf('        {/* VIEW 6: SETTINGS */}'), app.indexOf('      {createKind && ('));
for (const section of ['appearance', 'preferences', 'notifications', 'privacy', 'data', 'about']) {
  assert.ok(profile.includes(`section: '${section}'`), `Profile links to ${section}`);
  assert.ok(settings.includes(`profileSection === '${section}'`), `${section} has an independent destination`);
}
assert.match(profile, /Your information stays on this device/);
assert.match(profile, /aria-label="Profile settings"/);
assert.match(settings, /onBack=\{\(\) => setProfileSection\('home'\)\}/);
assert.match(preferences, /onClick=\{\(\) => onChange\('swipeNavigationEnabled', !preferences\.swipeNavigationEnabled\)\}/);
assert.match(settings, /Export encrypted backup/);
assert.match(preferences, /Currency for financial records/);
assert.match(preferences, /disabled=\{hasFinancialRecords\}/);
assert.match(settings, /Clear All Application Data/);
const fresh = mergeUserPreferences({}, 'INR');
assert.equal(fresh.swipeNavigationEnabled, true);
assert.equal(mergeUserPreferences({ ...fresh, swipeNavigationEnabled: false }, 'INR').swipeNavigationEnabled, false, 'explicit opt-out survives hydration');
assert.equal(mergeUserPreferences({ currency: 'JPY' }, 'INR').currency, 'JPY', 'saved supported currency survives hydration');
assert.equal(mergeUserPreferences({}, 'INR').currency, DEFAULT_USER_PREFERENCES.currency);

const homeMarkup = renderToStaticMarkup(React.createElement(ProfileHome, { name: 'Asha', initial: 'A', onNameChange: () => {}, onOpen: () => {} }));
for (const title of ['Appearance', 'Preferences', 'Notifications', 'Privacy &amp; security', 'Data &amp; backup', 'About LifeOS']) assert.ok(homeMarkup.includes(title), `rendered profile exposes ${title.replaceAll('&amp;', '&')}`);
assert.ok(homeMarkup.includes('Asha') && homeMarkup.includes('Your information stays on this device.'));
assert.match(homeMarkup, /aria-label="Profile settings"/);
const subpageMarkup = renderToStaticMarkup(React.createElement(ProfileSubpage, { title: 'Appearance', description: 'Theme settings', onBack: () => {}, children: React.createElement('p', null, 'Preview') }));
assert.ok(subpageMarkup.includes('Appearance') && subpageMarkup.includes('Preview') && subpageMarkup.includes('Profile'));
const preferenceMarkup = renderToStaticMarkup(React.createElement(ProfilePreferences, { preferences: DEFAULT_USER_PREFERENCES, hasFinancialRecords: true, onChange: () => {} }));
assert.match(preferenceMarkup, /Currency for financial records/);
assert.match(preferenceMarkup, /Search currencies/);
assert.match(preferenceMarkup, /Search by name, code or symbol/);
assert.match(preferenceMarkup, /disabled=""/);
assert.match(preferenceMarkup, /locked because saved financial records do not yet store their own currency/i);
assert.match(preferenceMarkup, /Swipe between tabs/);

console.log('PROFILE SETTINGS: routes, live server rendering, currency safety, local profile copy, preserved data actions and preference hydration checks passed.');
