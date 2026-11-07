'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./scripts/register-ts-test-loader.cjs');
const { mergeUserPreferences, DEFAULT_USER_PREFERENCES } = require('./src/services/userPreferences.ts');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const profile = fs.readFileSync('src/components/ProfileSettings.tsx', 'utf8');
const settings = app.slice(app.indexOf('        {/* VIEW 6: SETTINGS */}'), app.indexOf('      {createKind && ('));
for (const section of ['appearance', 'preferences', 'notifications', 'privacy', 'data', 'about']) {
  assert.ok(profile.includes(`section: '${section}'`), `Profile links to ${section}`);
  assert.ok(settings.includes(`profileSection === '${section}'`), `${section} has an independent destination`);
}
assert.match(profile, /Your information stays on this device/);
assert.match(profile, /aria-label="Profile settings"/);
assert.match(settings, /onBack=\{\(\) => setProfileSection\('home'\)\}/);
assert.match(settings, /onClick=\{\(\) => void saveUserPreference\('swipeNavigationEnabled', !userPrefs\.swipeNavigationEnabled\)\}/);
assert.match(settings, /Export encrypted backup/);
assert.match(settings, /Currency for financial records/);
assert.match(settings, /disabled=\{transactions\.length > 0 \|\| budgets\.length > 0 \|\| savingsGoals\.length > 0\}/);
assert.match(settings, /Clear All Application Data/);
const fresh = mergeUserPreferences({}, 'INR');
assert.equal(fresh.swipeNavigationEnabled, true);
assert.equal(mergeUserPreferences({ ...fresh, swipeNavigationEnabled: false }, 'INR').swipeNavigationEnabled, false, 'explicit opt-out survives hydration');
assert.equal(mergeUserPreferences({ currency: 'JPY' }, 'INR').currency, 'JPY', 'saved supported currency survives hydration');
assert.equal(mergeUserPreferences({}, 'INR').currency, DEFAULT_USER_PREFERENCES.currency);
console.log('PROFILE SETTINGS: routes, local profile copy, preserved data actions and preference hydration checks passed.');
