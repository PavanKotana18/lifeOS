'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { PRIMARY_NAVIGATION, MODULE_CATALOG } = require('./src/services/navigationCatalog.ts');
assert.deepEqual(PRIMARY_NAVIGATION.map(({ tab, label }) => [tab, label]), [
  ['dashboard', 'Today'], ['explore', 'Explore'], ['plan', 'Plan'], ['insights', 'Insights'],
]);
assert.equal(new Set(PRIMARY_NAVIGATION.map(item => item.tab)).size, 4);
for (const tab of ['finance', 'habits', 'goals', 'planner', 'settings']) {
  assert.ok(MODULE_CATALOG.some(module => module.tab === tab), 'Existing module remains reachable from Explore: ' + tab);
}
assert.equal(new Set(MODULE_CATALOG.map(item => item.tab)).size, MODULE_CATALOG.length);
console.log('NAVIGATION IA: 7 checks passed; four primary destinations preserve all five existing modules.');
