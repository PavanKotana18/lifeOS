const fs = require('node:fs');
const assert = require('node:assert/strict');

const native = fs.readFileSync(
  'android/app/src/main/java/com/lifeos/personal/LifeOSCryptoPlugin.java',
  'utf8'
);

assert.match(native, /import androidx\.lifecycle\.Lifecycle;/);
assert.match(native, /import androidx\.lifecycle\.LifecycleEventObserver;/);
assert.match(native, /getCurrentState\(\)[\s\S]{0,100}Lifecycle\.State\.RESUMED/);
assert.match(native, /Lifecycle\.Event\.ON_RESUME/);
assert.match(native, /Lifecycle\.Event\.ON_DESTROY/);
assert.match(native, /removeObserver\(observer\[0\]\)/);
assert.match(native, /prompt\.authenticate\(info, new BiometricPrompt\.CryptoObject\(cipher\)\)/);

const authenticateStart = native.indexOf('private void authenticate(');
const setupStart = native.indexOf('@PluginMethod\n    public void setup(', authenticateStart);
assert.notEqual(authenticateStart, -1);
assert.notEqual(setupStart, -1);

const authenticate = native.slice(authenticateStart, setupStart);
const resumedGate = authenticate.indexOf('Lifecycle.State.RESUMED');
const immediateLaunch = authenticate.indexOf('executor.execute(launchPrompt)');
const resumeEvent = authenticate.indexOf('Lifecycle.Event.ON_RESUME');
const deferredLaunch = authenticate.indexOf('executor.execute(launchPrompt)', immediateLaunch + 1);
const promptCall = authenticate.indexOf('prompt.authenticate(info, new BiometricPrompt.CryptoObject(cipher))');

assert.ok(resumedGate !== -1, 'Activity RESUMED state must be checked');
assert.ok(promptCall !== -1, 'CryptoObject prompt invocation must exist');
assert.ok(immediateLaunch > resumedGate, 'Already-resumed Activity must launch through executor after lifecycle check');
assert.ok(resumeEvent !== -1, 'Deferred prompt must wait for ON_RESUME');
assert.ok(deferredLaunch !== -1, 'Deferred prompt must launch through executor after ON_RESUME');
assert.ok(authenticate.includes('completed.compareAndSet(false, true)'), 'Lifecycle observer must prevent duplicate prompt launches');

console.log('SEC-02 biometric Activity lifecycle regression tests: all passed');
