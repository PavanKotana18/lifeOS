/** TEST ENTRY ONLY. Real React and encrypted repositories, synthetic native adapter.
 * This entry is never imported by src or included in the production APK build.
 * Disposable browser profiles only; no Android authentication acceptance is claimed. */
import { registerPlugin } from '@capacitor/core';
const db = await new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('LifeOS-browser-qa-native', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('fixture');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function readKey(): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const r = db.transaction('fixture').objectStore('fixture').get('key');
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
let key = await readKey(), unlocked = false;
const recoveryConfirmed = () => sessionStorage.getItem('qa-recovery-provisioned') === 'true';
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
registerPlugin('LifeOSCrypto', { web: () => ({
  getKeyState: async () => ({ keyProvisioned: Boolean(key), recoveryProvisioned: recoveryConfirmed(), recoveryDeferred: sessionStorage.getItem('qa-recovery-deferred') === 'true' && !recoveryConfirmed(), recoveryNeedsRebind: false, metadataConsistent: true, keystoreAliasPresent: Boolean(key), unlocked }),
  setup: async () => {
    const mode = new URLSearchParams(location.search).get('onboarding-auth') || 'success';
    if (mode !== 'success') return { success: false, message: mode === 'unavailable' ? 'A supported Android secure unlock is not available on this device.' : 'Authentication was cancelled. Try again when ready.' };
    if (key) throw Error('Synthetic key already exists');
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await new Promise<void>((resolve, reject) => { const t = db.transaction('fixture', 'readwrite'); t.objectStore('fixture').put(key, 'key'); t.oncomplete = () => resolve(); t.onabort = () => reject(t.error); });
    unlocked = true; return { success: true, keyVersion: 1 };
  },
  unlock: async () => { unlocked = Boolean(key); return { success: unlocked }; },
  lock: async () => { unlocked = false; return { success: true }; },
  isUnlocked: async () => ({ unlocked }),
  deferRecovery: async () => { if (!key || !unlocked) throw Error('Synthetic session locked'); sessionStorage.setItem('qa-recovery-deferred', 'true'); return { success: true }; },
  prepareRecovery: async () => ({ success: true, recoveryCode: 'A'.repeat(43), envelope: { version: 1, kdf: 'PBKDF2-HMAC-SHA-256', iterations: 600000, salt: btoa('0123456789abcdef'), iv: btoa('0123456789ab'), wrappedKey: btoa('012345678901234567890123456789012345678901234567') } }),
  confirmRecovery: async () => { if (!key || !unlocked || sessionStorage.getItem('qa-recovery-deferred') !== 'true') throw Error('Synthetic recovery is not ready'); sessionStorage.setItem('qa-recovery-provisioned', 'true'); sessionStorage.removeItem('qa-recovery-deferred'); return { success: true }; },
  encrypt: async ({ plaintext, aad }: { plaintext: string; aad: string }) => {
    if (!key || !unlocked) throw Error('Synthetic session locked');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) }, key, new TextEncoder().encode(plaintext));
    return { iv: encode(iv), ciphertext: encode(new Uint8Array(data)), keyVersion: 1 };
  },
  decrypt: async ({ iv, ciphertext, aad }: { iv: string; ciphertext: string; aad: string }) => {
    if (!key || !unlocked) throw Error('Synthetic session locked');
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(aad) }, key, decode(ciphertext));
    return { plaintext: new TextDecoder().decode(data) };
  },
}) });
// Explicit test-entry adapter, absent from production builds. Native acceptance
// uses the real plugin; these scenarios cover deterministic cancellation/success.
if (new URLSearchParams(location.search).has('onboarding-auth')) {
  const { BiometricService } = await import('../../src/services/biometricService');
  BiometricService.isAvailable = async () => ({ isAvailable: true, biometricsSupported: true, code: 'SUCCESS' });
  BiometricService.authenticate = async () => {
    const host = window as Window & { qaAuthCalls?: number };
    host.qaAuthCalls = (host.qaAuthCalls || 0) + 1;
    return { success: true, message: '' };
  };
}
await import('../../src/main');
