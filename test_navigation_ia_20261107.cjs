'use strict';
const assert = require('node:assert/strict');
require('./scripts/register-ts-test-loader.cjs');
const { PRIMARY_NAVIGATION, MODULE_CATALOG } = require('./src/services/navigationCatalog.ts');
const { pushTabHistory, popTabHistory } = require('./src/services/tabHistory.ts');
assert.deepEqual(PRIMARY_NAVIGATION.map(({ tab, label }) => [tab, label]), [
  ['dashboard', 'Today'], ['finance', 'Money'], ['plan', 'Plan'], ['life', 'Life'],
]);
assert.equal(new Set(PRIMARY_NAVIGATION.map(item => item.tab)).size, 4);
for (const tab of ['habits', 'goals', 'planner', 'settings']) {
  assert.ok(MODULE_CATALOG.some(module => module.tab === tab), 'Existing module remains reachable from Life, Plan or Profile: ' + tab);
}
const { primaryDestinationForTab, resolvePlanPath } = require('./src/services/navigationCatalog.ts');
assert.equal(primaryDestinationForTab('habits'), 'life');
assert.equal(primaryDestinationForTab('goals'), 'life');
assert.equal(primaryDestinationForTab('insights'), 'life');
assert.equal(primaryDestinationForTab('planner'), 'plan');
assert.equal(primaryDestinationForTab('settings'), null);
assert.equal(new Set(MODULE_CATALOG.map(item => item.tab)).size, MODULE_CATALOG.length);
assert.equal(resolvePlanPath('/life'), 'life');
assert.equal(resolvePlanPath('#/life/habits'), 'habits');
assert.equal(resolvePlanPath('/plan/goals'), 'goals');
assert.equal(resolvePlanPath('/life/insights'), 'insights');
assert.equal(resolvePlanPath('/unrelated'), null);
let history = [];
history = pushTabHistory(history, 'dashboard', 'finance');
history = pushTabHistory(history, 'finance', 'plan');
history = pushTabHistory(history, 'plan', 'insights');
const backToFinance = popTabHistory(history, 'dashboard');
const backToExplore = popTabHistory(backToFinance.history, 'dashboard');
assert.equal(backToFinance.next, 'plan');
assert.equal(backToExplore.next, 'finance');
console.log('NAVIGATION IA: primary destinations, module routing and back history passed.');
