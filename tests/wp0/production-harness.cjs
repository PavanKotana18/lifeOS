'use strict';

// Test-only Node host. No browser profile, Android bridge or real user DB exists here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const ts = require('typescript'); // Required: missing dependencies must fail, never skip.
require('fake-indexeddb/auto');
const { IDBFactory } = require('fake-indexeddb');
const ROOT = path.resolve(__dirname, '../..');
const TABLES = ['transactions', 'categories', 'budgets', 'savingsGoals',
  'savingsContributions', 'habits', 'habitLogs', 'goals', 'milestones', 'tasks', 'settings'];
let checks = 0;
function check(value, message) { checks++; assert.ok(value, message); }
function equal(actual, expected, message) { checks++; assert.deepEqual(actual, expected, message); }
class ContractFailure extends Error {
  constructor(expected, actual) {
    super('Production acceptance contract is not satisfied');
    this.code = 'WP0_CONTRACT_FAILURE';
    this.expected = expected;
    this.actual = actual;
  }
}
function contract(actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected); }
  catch (error) {
    if (error.code !== 'ERR_ASSERTION') throw error;
    throw new ContractFailure(expected, actual);
  }
}
function compile(source, filename) {
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length, 0, `Invalid test extraction: ${filename}`);
  const result = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true } });
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length,
    0, `Transpilation failed: ${filename}`);
  return result.outputText;
}
function loader(overrides) {
  const cache = new Map();
  function load(relative, testOnlyExports = '') {
    const filename = path.resolve(ROOT, relative);
    assert.ok(filename.startsWith(ROOT + path.sep), 'Only this worktree can be loaded');
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(filename, loaded);
    loaded.require = id => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), id);
        const candidates = path.extname(target) ? [target] : [target + '.ts', target + '.tsx', target + '.js'];
        const found = candidates.find(f => fs.existsSync(f));
        assert.ok(found, `Production dependency missing: ${id}`);
        if (/\.tsx?$/.test(found)) return load(path.relative(ROOT, found));
        return require(found);
      }
      return require(id);
    };
    loaded._compile(compile(fs.readFileSync(filename, 'utf8') + testOnlyExports, filename), filename);
    return loaded.exports;
  }
  return load;
}
function appSource() {
  const filename = path.join(ROOT, 'src/App.tsx');
  const source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  const app = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'App');
  assert.ok(app?.body, 'Production App declaration missing');
  return { source, ast, app };
}
function one(nodes, description) {
  assert.equal(nodes.length, 1, `Expected exactly one production AST node: ${description}`);
  return nodes[0];
}
function walk(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  ts.forEachChild(node, child => { walk(child, predicate, found); });
  return found;
}
function appFunction(name) {
  const { ast, app } = appSource();
  return one(app.body.statements.flatMap(n => ts.isVariableStatement(n)
    ? [...n.declarationList.declarations].filter(d => ts.isIdentifier(d.name) && d.name.text === name)
    : []), name).initializer.getText(ast);
}
function lifecycleCallback() {
  const { ast, app } = appSource();
  const calls = walk(app, n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
    && n.expression.expression.getText(ast) === 'CapacitorApp'
    && n.expression.name.text === 'addListener' && n.arguments[0]?.text === 'appStateChange');
  const cb = one(calls, 'Capacitor appStateChange registration').arguments[1];
  assert.ok(ts.isArrowFunction(cb), 'Lifecycle callback structure changed');
  return cb.getText(ast);
}
function buttonHandler(label) {
  const { ast, app } = appSource();
  const buttons = walk(app, n => ts.isJsxElement(n)
    && n.openingElement.tagName.getText(ast) === 'button'
    && n.children.filter(ts.isJsxText).map(n => n.text).join(' ').trim() === label);
  const button = one(buttons, `button ${label}`);
  const attr = one(button.openingElement.attributes.properties.filter(n => ts.isJsxAttribute(n)
    && n.name.getText(ast) === 'onClick'), `${label} onClick`);
  assert.ok(ts.isJsxExpression(attr.initializer) && attr.initializer.expression,
    'Production handler missing');
  return attr.initializer.expression.getText(ast);
}
function bind(expression, deps, prelude = '') {
  const names = Object.keys(deps);
  const source = `module.exports = function({${names.join(',')}}) { ${prelude}\nreturn (${expression}); };`;
  const m = { exports: {} };
  new Function('module', compile(source, 'wp0-extracted.ts'))(m);
  return m.exports(deps);
}
function noopSetters(expression) {
  // Derive setters from actual React useState bindings. A setTimeout/setInterval
  // or similarly named business function must never be mistaken for a UI setter.
  const { app } = appSource();
  const setters = new Set();
  for (const statement of app.body.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isArrayBindingPattern(declaration.name) || !declaration.initializer
        || !ts.isCallExpression(declaration.initializer)
        || declaration.initializer.expression.getText() !== 'useState') continue;
      const name = declaration.name.elements[1]?.name;
      if (name && ts.isIdentifier(name)) setters.add(name.text);
    }
  }
  assert.ok(setters.size > 0, 'Actual React state bindings must be discoverable');
  const ast = ts.createSourceFile('expression.tsx', expression, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return Object.fromEntries(walk(ast, n => ts.isIdentifier(n) && setters.has(n.text))
    .map(n => [n.text, () => {}]));
}
function freezeClock() {
  process.env.TZ = 'Asia/Kolkata';
  const RealDate = global.Date;
  const now = RealDate.parse('2026-11-06T06:30:00.000Z');
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
}
function memoryStorage() {
  const map = new Map();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
}
async function fixture({ activate = true } = {}) {
  freezeClock();
  assert.ok(global.indexedDB instanceof IDBFactory, 'Disposable fake IndexedDB is required');
  global.localStorage = memoryStorage();
  let key = crypto.randomBytes(32); // Synthetic, process-local; never logged or persisted.
  let unlocked = true;
  let recoveryKey = null, recoveryVerified = false, recoveryDeferred = false;
  const calls = [];
  const native = {
    calls,
    onStop() { unlocked = false; }, // SIMULATED Android handleOnStop, not Java execution.
    async getKeyState() { calls.push('getKeyState'); return { keyProvisioned: true,
      recoveryProvisioned: !recoveryDeferred, recoveryDeferred, recoveryNeedsRebind: recoveryKey !== null, metadataConsistent: true,
      keystoreAliasPresent: true, unlocked }; },
    async isUnlocked() { calls.push('isUnlocked'); return { unlocked }; },
    async unlock() { calls.push('unlock'); unlocked = true; return { success: true }; },
    async lock() { calls.push('lock'); unlocked = false; recoveryVerified = false;
      if (recoveryKey) recoveryKey.fill(0); recoveryKey = null; return { success: true }; },
    // Explicit simulated recovery. The synthetic code selects the fixture key;
    // it does NOT implement Android/PBKDF2 recovery and is never device evidence.
    async recoverWithSecret({ recoveryCode }) {
      calls.push('recover'); unlocked = false;
      recoveryKey = recoveryCode === 'A'.repeat(43) ? Buffer.from(key) : crypto.randomBytes(32);
      return { success: true };
    },
    async verifyRecoveryRecord({ iv, ciphertext, aad }) {
      calls.push('proof'); assert.ok(recoveryKey, 'No simulated quarantined key');
      const data = Buffer.from(ciphertext, 'base64');
      const cipher = crypto.createDecipheriv('aes-256-gcm', recoveryKey, Buffer.from(iv, 'base64'));
      cipher.setAAD(Buffer.from(aad)); cipher.setAuthTag(data.subarray(-16));
      const plain = Buffer.concat([cipher.update(data.subarray(0, -16)), cipher.final()]);
      plain.fill(0); recoveryVerified = true; return { verified: true };
    },
    async rebindLocalKey() {
      calls.push('rebind'); assert.ok(recoveryVerified, 'No rebind without authenticated proof');
      recoveryKey.fill(0); recoveryKey = null; recoveryVerified = false; unlocked = true;
      return { success: true };
    },
    async setup() { throw new Error('Unexpected setup in preprovisioned fixture'); },
    async deferRecovery() { calls.push('deferRecovery'); recoveryDeferred = true; return { success: true }; },
    async prepareRecovery() { return { success: true, recoveryCode: 'A'.repeat(43), envelope: { version: 1, kdf: 'PBKDF2-HMAC-SHA-256', iterations: 600000, salt: Buffer.alloc(16).toString('base64'), iv: Buffer.alloc(12).toString('base64'), wrappedKey: Buffer.alloc(48).toString('base64') } }; },
    async confirmRecovery() { recoveryDeferred = false; return { success: true }; },
    async encrypt({ plaintext, aad }) {
      calls.push('encrypt');
      assert.ok(unlocked, 'SIMULATED_NATIVE_KEY_LOCKED');
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(aad));
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
      return { iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), keyVersion: 1 };
    },
    async decrypt({ ciphertext, iv, aad }) {
      calls.push('decrypt');
      if (!unlocked) throw new Error('SIMULATED_NATIVE_KEY_LOCKED');
      const data = Buffer.from(ciphertext, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(data.subarray(-16));
      return { plaintext: Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]).toString('utf8') };
    }
  };
  const pending = new Map();
  const delivered = new Map();
  const notifications = {
    async createChannel() {}, async listChannels() { return { channels: [] }; },
    async areEnabled() { return { value: true }; },
    async checkPermissions() { return { display: 'granted' }; },
    async requestPermissions() { return { display: 'granted' }; },
    async checkExactNotificationSetting() { return { exact_alarm: 'granted' }; },
    async getPending() { return { notifications: [...pending.values()] }; },
    async getDeliveredNotifications() { return { notifications: [...delivered.values()] }; },
    async cancel({ notifications }) { notifications.forEach(n => { pending.delete(n.id); delivered.delete(n.id); }); },
    async schedule({ notifications }) { notifications.forEach(n => pending.set(n.id, structuredClone(n))); }
  };
  const plugins = { LifeOSCrypto: native, LifeOSRuntimeInfo: { async getInfo() { return { androidApi: 35, packageName: 'com.lifeos.personal', versionName: 'test', versionCode: 1, batteryOptimizationExempt: false }; } } };
  const availablePlugins = new Set(['LifeOSCrypto', 'LocalNotifications', 'LifeOSRuntimeInfo']);
  const nativeOverrides = {
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android',
      isPluginAvailable: name => availablePlugins.has(name) },
      registerPlugin: name => plugins[name] || new Proxy({}, { get: () => () => {
        throw new Error(`Unexpected native interface ${name}`);
      } }) },
    '@capacitor/local-notifications': { LocalNotifications: notifications,
      Weekday: { Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6, Saturday: 7 } }
  };
  const load = loader(nativeOverrides);
  // Legacy internals are exported ONLY in this test host, never application code.
  const db = load('src/db.ts', '\nexport { rawStorageService as legacyStorageService };');
  await db.lifeOSDatabase.open();
  equal(await db.lifeOSDatabase.transactions.count(), 0, 'Fixture must start empty');
  const notificationModule = load('src/services/notificationService.ts');
  const domain = load('src/services/domainUtils.ts');
  const preferences = load('src/services/userPreferences.ts');
  const state = { startupComplete: { current: true }, biometricAuthenticated: { current: false }, safeFirstRunBrowse: { current: false }, visualThemeId: 'soft-ivory-sage' };
  function appDeps() {
    const deps = { ...domain, ...preferences, ...load('src/services/themeCatalog.ts'), ...load('src/services/systemAppearance.ts'), ...load('src/services/todayLayout.ts'), ...db, ...notificationModule, ...state,
      ...load('src/services/csvExportService.ts'),
      reconcileNotificationOnboardingOnResume: load('src/services/notificationOnboarding.ts').reconcileNotificationOnboardingOnResume,
      reconcileNotificationPreferences: async () => {},
      CryptoService: load('src/services/cryptoService.ts').CryptoService,
      ensurePrivateStorageBeforeWrite: async () => {
        if (!db.isEncryptedStorageActivated() || !db.sessionManager.isUnlocked()) {
          throw new Error('Synthetic test admission rejected an unprotected write');
        }
      },
      encryptedSession: load('src/services/cryptoSessionCoordinator.ts').createProtectedSessionController(
        load('src/services/cryptoService.ts').CryptoService, db.sessionManager, {
          hasEncryptedRecords: db.hasEncryptedRecords,
          requestInitialSetup: async () => { throw new Error('Explicit provisioning UI was not configured in fixture'); },
          confirmRecovery: async () => { throw new Error('Recovery confirmation UI was not configured in fixture'); },
          activateStorage: db.activateEncryptedStorage,
          isStorageActive: db.isEncryptedStorageActivated,
        }),
      localStorage: global.localStorage, window: { confirm: () => true },
      todayLayoutRef: { current: load('src/services/todayLayout.ts').DEFAULT_TODAY_LAYOUT },
      systemDarkPreference: () => false, applyDomTheme() {},
      BiometricService: { async isAvailable() { return { isAvailable: true }; } },
      backupPassphraseResolver: { current: null }, secureSetupResolver: { current: null },
      authCoordinator: { resetForBackground() {} }, notificationsEnabled: false,
      confirmScreenshotResume: async () => {},
      notificationPreferences: notificationModule.DEFAULT_NOTIFICATION_PREFERENCES,
      effectiveNotificationPreferences: (p, master = false) => master ? p : notificationModule.DEFAULT_NOTIFICATION_PREFERENCES,
      async triggerBiometricAuth() { throw new Error('Unexpected optional biometric UI call'); },
      async refreshNotificationDiagnostics() {}, showToast() {} };
    const reload = appFunction('reloadAllData');
    deps.reloadAllData = bind(reload, { ...deps, ...noopSetters(reload) });
    const sync = appFunction('syncNotificationSchedules');
    deps.syncNotificationSchedules = bind(sync, deps);
    return deps;
  }
  // Default integration fixtures actually migrate through production APIs;
  // security boundary tests explicitly request { activate: false }.
  if (activate) { db.sessionManager.unlock(); await db.activateEncryptedStorage(); }
  return { ...db, native, pending, delivered, notifications, load, appDeps, ...notificationModule,
    setPluginAvailable(name, available) { if (available) availablePlugins.add(name); else availablePlugins.delete(name); },
    async restart() {
      db.sessionManager.lock(); await db.sessionManager.waitForIdle();
      db.lifeOSDatabase.close(); await native.lock();
      const freshLoad = loader(nativeOverrides);
      const fresh = freshLoad('src/db.ts');
      await fresh.lifeOSDatabase.open();
      return { ...fresh, load: freshLoad };
    },
    async activate() { db.sessionManager.unlock(); await db.activateEncryptedStorage();
      check(db.isEncryptedStorageActivated(), 'Production encrypted activation must complete'); },
    async dispose() { db.sessionManager.lock(); await db.sessionManager.waitForIdle();
      await db.lifeOSDatabase.delete(); key.fill(0); key = null; if (recoveryKey) recoveryKey.fill(0); }
  };
}
module.exports = { ROOT, TABLES, check, equal, contract, ContractFailure, fixture,
  appFunction, lifecycleCallback, buttonHandler, bind, noopSetters, compile,
  assertions: () => checks };
