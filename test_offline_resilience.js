const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');
const db = fs.readFileSync('src/db.ts', 'utf8');
const cap = fs.readFileSync('capacitor.config.ts', 'utf8');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`PASS: ${name}`);
}

check('Application database is Dexie-backed local IndexedDB', () => {
  assert.match(db, /extends Dexie/);
  assert.match(db, /super\('LifeOS_Database'\)/);
});

check('Application bootstrap reads local settings before rendering', () => {
  assert.match(main, /StorageService\.settings\.get/);
  assert.match(main, /renderApp\(\)/);
});

check('Application initial data loading uses local StorageService and Dexie tables', () => {
  assert.match(app, /const initApp = async/);
  assert.match(app, /const reloadAllData = async/);
  assert.match(app, /StorageService\.transactions\.getAll\(\)/);
  assert.match(app, /db\.milestones\.toArray\(\)/);
});

check('Connectivity state initializes from navigator.onLine', () => {
  assert.match(app, /useState\(\(\) => typeof navigator === 'undefined' \|\| navigator\.onLine\)/);
});

check('Online and offline browser events update connectivity state', () => {
  assert.match(app, /window\.addEventListener\('online', handleOnline\)/);
  assert.match(app, /window\.addEventListener\('offline', handleOffline\)/);
  assert.match(app, /window\.removeEventListener\('online', handleOnline\)/);
  assert.match(app, /window\.removeEventListener\('offline', handleOffline\)/);
});

check('Offline indicator explains local data availability', () => {
  assert.match(app, /role="status" aria-live="polite"/);
  assert.match(app, /Offline — LifeOS records remain stored on this device\./);
});

check('Connectivity indicator does not gate local database operations', () => {
  assert.doesNotMatch(app, /if\s*\(\s*!isOnline\s*\)\s*(return|throw)/);
  assert.match(app, /StorageService\.habits\.logCompletion/);
});

check('Capacitor app is configured to use packaged local web assets', () => {
  assert.match(cap, /webDir:\s*'dist'/);
  assert.doesNotMatch(cap, /server:\s*\{\s*url:/);
});

check('No application-level fetch dependency exists in bootstrap or database layer', () => {
  assert.doesNotMatch(main, /\bfetch\s*\(/);
  assert.doesNotMatch(db, /\bfetch\s*\(/);
});

console.log(`OFFLINE RESILIENCE SOURCE CHECKS: ${passed}/9 PASSED`);
