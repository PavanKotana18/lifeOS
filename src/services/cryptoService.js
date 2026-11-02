/**
 * LifeOS Cryptographic Service (CJS / Browser compatible)
 * Production-grade AES-256-GCM, PBKDF2 key derivation with domain separation,
 * HMAC-SHA256 integrity verification, verified recovery, transactional rotation,
 * and key lifecycle state management (UNINITIALIZED, ACTIVE, QUARANTINED, ROTATED, DESTROYED).
 */

function getSubtle() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  try {
    const nodeCrypto = require('crypto');
    if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
      return nodeCrypto.webcrypto.subtle;
    }
  } catch (e) {}
  throw new Error('WebCrypto SubtleCrypto is not available in this environment');
}

function getRandomValues(array) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  try {
    const nodeCrypto = require('crypto');
    if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.getRandomValues) {
      return nodeCrypto.webcrypto.getRandomValues(array);
    }
    if (nodeCrypto.randomFillSync) {
      return nodeCrypto.randomFillSync(array);
    }
  } catch (e) {}
  throw new Error('WebCrypto getRandomValues is not available');
}

function bufToHex(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < u8.length; i++) {
    hex += u8[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBuf(hex) {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function deriveDomainSalt(baseSalt, domainTag) {
  const tagBytes = new TextEncoder().encode(domainTag);
  const domainSalt = new Uint8Array(baseSalt.length + tagBytes.length);
  domainSalt.set(baseSalt, 0);
  domainSalt.set(tagBytes, baseSalt.length);
  return domainSalt;
}

class CryptoManager {
  constructor() {
    this.state = 'UNINITIALIZED';
    this.aesKey = null;
    this.hmacKey = null;
    this.currentSalt = null;
    this.verifierContainer = null;
    this.keyStateInfo = { state: 'UNINITIALIZED' };
  }

  getKeyState() {
    return { ...this.keyStateInfo, state: this.state };
  }

  getVerifierContainer() {
    return this.verifierContainer;
  }

  async deriveKeyMaterial(passphrase) {
    const subtle = getSubtle();
    const enc = new TextEncoder();
    return subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey', 'deriveBits']
    );
  }

  async deriveKeysWithDomainSeparation(keyMaterial, salt) {
    const subtle = getSubtle();
    const encSalt = deriveDomainSalt(salt, 'LifeOS-AES-256-GCM-Encryption-v1');
    const macSalt = deriveDomainSalt(salt, 'LifeOS-HMAC-SHA256-Integrity-v1');

    const aesKey = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encSalt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const hmacKey = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: macSalt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign', 'verify']
    );

    return { aesKey, hmacKey };
  }

  async encryptWithKeys(payload, aesKey, hmacKey, salt) {
    const subtle = getSubtle();
    const enc = new TextEncoder();
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const dataBytes = enc.encode(serialized);

    const iv = getRandomValues(new Uint8Array(12));
    const ciphertextBuf = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      dataBytes
    );

    const ciphertextHex = bufToHex(ciphertextBuf);
    const saltHex = bufToHex(salt);
    const ivHex = bufToHex(iv);
    const timestamp = new Date().toISOString();

    const signedData = enc.encode(`1:${saltHex}:${ivHex}:${ciphertextHex}:${timestamp}`);
    const hmacSig = await subtle.sign('HMAC', hmacKey, signedData);

    return {
      version: 1,
      cipher: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: 100000,
      salt: saltHex,
      iv: ivHex,
      ciphertext: ciphertextHex,
      hmac: bufToHex(hmacSig),
      timestamp
    };
  }

  async decryptWithKeys(container, aesKey, hmacKey) {
    if (!container || !container.salt || !container.iv || !container.ciphertext || !container.hmac) {
      throw new Error('Malformed encrypted container: missing required cryptographic fields');
    }

    const subtle = getSubtle();
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const signedData = enc.encode(`1:${container.salt}:${container.iv}:${container.ciphertext}:${container.timestamp}`);
    const claimedHmac = hexToBuf(container.hmac);

    const isValid = await subtle.verify('HMAC', hmacKey, claimedHmac, signedData);
    if (!isValid) {
      throw new Error('HMAC signature mismatch: payload was tampered or corrupted');
    }

    const iv = hexToBuf(container.iv);
    const ciphertext = hexToBuf(container.ciphertext);
    const plaintextBuf = await subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    return JSON.parse(dec.decode(plaintextBuf));
  }

  async initializeKey(passphrase, customSalt) {
    if (!passphrase || passphrase.length < 8) {
      throw new Error('Cryptographic passphrase must be at least 8 characters');
    }

    const keyMaterial = await this.deriveKeyMaterial(passphrase);
    const salt = customSalt || getRandomValues(new Uint8Array(16));
    const { aesKey, hmacKey } = await this.deriveKeysWithDomainSeparation(keyMaterial, salt);

    this.aesKey = aesKey;
    this.hmacKey = hmacKey;
    this.currentSalt = salt;

    this.verifierContainer = await this.encryptWithKeys(
      { verifier: 'LIFEOS_SENTINEL_KEY_VERIFIER_V1', createdAt: new Date().toISOString() },
      aesKey,
      hmacKey,
      salt
    );

    const now = new Date().toISOString();
    this.state = 'ACTIVE';
    this.keyStateInfo = {
      state: 'ACTIVE',
      initializedAt: now,
      keyId: 'key_' + bufToHex(salt).substring(0, 8)
    };

    return this.getKeyState();
  }

  quarantineKey(reason) {
    this.state = 'QUARANTINED';
    this.keyStateInfo.state = 'QUARANTINED';
    this.keyStateInfo.quarantineReason = reason;
    this.keyStateInfo.quarantinedAt = new Date().toISOString();
    console.warn(`[SECURITY ALERT] Key quarantined: ${reason}`);
  }

  async recoverKey(recoveryPassphrase, originalSaltHex, verificationContainer) {
    if (this.state !== 'QUARANTINED') {
      throw new Error('Key recovery can only be invoked when key is in QUARANTINED state');
    }

    if (!recoveryPassphrase || recoveryPassphrase.length < 8) {
      throw new Error('Recovery passphrase must be at least 8 characters');
    }

    const salt = hexToBuf(originalSaltHex);
    const keyMaterial = await this.deriveKeyMaterial(recoveryPassphrase);
    const candidateKeys = await this.deriveKeysWithDomainSeparation(keyMaterial, salt);

    const targetContainer = verificationContainer || this.verifierContainer;
    if (!targetContainer) {
      throw new Error('No verifier token available to authenticate key recovery');
    }

    try {
      await this.decryptWithKeys(targetContainer, candidateKeys.aesKey, candidateKeys.hmacKey);
    } catch (e) {
      throw new Error(`Key recovery failed: Recovery passphrase failed cryptographic verification against verifier (${e.message}). Key remains QUARANTINED.`);
    }

    this.aesKey = candidateKeys.aesKey;
    this.hmacKey = candidateKeys.hmacKey;
    this.currentSalt = salt;
    this.verifierContainer = targetContainer;
    this.state = 'ACTIVE';
    this.keyStateInfo = {
      state: 'ACTIVE',
      initializedAt: new Date().toISOString(),
      keyId: 'key_' + originalSaltHex.substring(0, 8)
    };

    return this.getKeyState();
  }

  async rotateKey(currentPassphrase, newPassphrase, existingContainers = []) {
    if (this.state !== 'ACTIVE' || !this.aesKey || !this.hmacKey || !this.currentSalt) {
      throw new Error(`Cannot rotate key in state ${this.state}`);
    }

    if (!newPassphrase || newPassphrase.length < 8) {
      throw new Error('New passphrase must be at least 8 characters');
    }

    const curMaterial = await this.deriveKeyMaterial(currentPassphrase);
    const verifyKeys = await this.deriveKeysWithDomainSeparation(curMaterial, this.currentSalt);

    if (this.verifierContainer) {
      try {
        await this.decryptWithKeys(this.verifierContainer, verifyKeys.aesKey, verifyKeys.hmacKey);
      } catch (err) {
        throw new Error('Key rotation aborted: Current passphrase failed authentication against verifier.');
      }
    }

    const decryptedPayloads = [];
    for (let i = 0; i < existingContainers.length; i++) {
      try {
        const payload = await this.decryptWithKeys(existingContainers[i], this.aesKey, this.hmacKey);
        decryptedPayloads.push(payload);
      } catch (err) {
        throw new Error(`Key rotation aborted: Existing container at index ${i} failed decryption (${err.message}). No data was rotated.`);
      }
    }

    const newSalt = getRandomValues(new Uint8Array(16));
    const newMaterial = await this.deriveKeyMaterial(newPassphrase);
    const newKeys = await this.deriveKeysWithDomainSeparation(newMaterial, newSalt);

    const reEncryptedContainers = [];
    try {
      for (const payload of decryptedPayloads) {
        const container = await this.encryptWithKeys(payload, newKeys.aesKey, newKeys.hmacKey, newSalt);
        reEncryptedContainers.push(container);
      }
    } catch (err) {
      throw new Error(`Key rotation aborted during re-encryption: ${err.message}. State rolled back.`);
    }

    const newVerifier = await this.encryptWithKeys(
      { verifier: 'LIFEOS_SENTINEL_KEY_VERIFIER_V1', createdAt: new Date().toISOString() },
      newKeys.aesKey,
      newKeys.hmacKey,
      newSalt
    );

    this.aesKey = newKeys.aesKey;
    this.hmacKey = newKeys.hmacKey;
    this.currentSalt = newSalt;
    this.verifierContainer = newVerifier;
    this.state = 'ACTIVE';
    this.keyStateInfo = {
      state: 'ACTIVE',
      initializedAt: new Date().toISOString(),
      keyId: 'key_' + bufToHex(newSalt).substring(0, 8)
    };

    return {
      keyState: this.getKeyState(),
      reEncryptedContainers
    };
  }

  destroyKey() {
    this.aesKey = null;
    this.hmacKey = null;
    if (this.currentSalt) {
      this.currentSalt.fill(0);
      this.currentSalt = null;
    }
    this.verifierContainer = null;
    this.state = 'DESTROYED';
    this.keyStateInfo = { state: 'DESTROYED' };
  }

  async encryptPayload(payload, passphrase) {
    if (passphrase) {
      if (passphrase.length < 8) {
        throw new Error('Cryptographic passphrase must be at least 8 characters');
      }
      const salt = getRandomValues(new Uint8Array(16));
      const keyMaterial = await this.deriveKeyMaterial(passphrase);
      const { aesKey, hmacKey } = await this.deriveKeysWithDomainSeparation(keyMaterial, salt);
      return this.encryptWithKeys(payload, aesKey, hmacKey, salt);
    }

    if (this.state !== 'ACTIVE' || !this.aesKey || !this.hmacKey || !this.currentSalt) {
      throw new Error(`Security Exception: Cannot encrypt payload when key state is ${this.state}`);
    }
    return this.encryptWithKeys(payload, this.aesKey, this.hmacKey, this.currentSalt);
  }

  async decryptPayload(container, passphrase) {
    if (passphrase) {
      if (passphrase.length < 8) {
        throw new Error('Passphrase must be at least 8 characters');
      }
      if (!container || !container.salt || !container.iv || !container.ciphertext || !container.hmac) {
        throw new Error('Malformed encrypted container: missing required cryptographic fields');
      }
      const salt = hexToBuf(container.salt);
      const keyMaterial = await this.deriveKeyMaterial(passphrase);
      const { aesKey, hmacKey } = await this.deriveKeysWithDomainSeparation(keyMaterial, salt);
      return this.decryptWithKeys(container, aesKey, hmacKey);
    }

    if (this.state === 'QUARANTINED') {
      throw new Error(`Security Exception: Decryption blocked. Cryptographic key is QUARANTINED due to: ${this.keyStateInfo.quarantineReason}`);
    }
    if (this.state !== 'ACTIVE' || !this.aesKey || !this.hmacKey) {
      throw new Error(`Security Exception: Key is not in ACTIVE state (current: ${this.state})`);
    }

    try {
      return await this.decryptWithKeys(container, this.aesKey, this.hmacKey);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('HMAC signature mismatch')) {
        this.quarantineKey('Integrity verification failed: HMAC signature mismatch. Payload was tampered or corrupted.');
        throw new Error('Cryptographic Integrity Violation: Backup HMAC signature does not match. Decryption aborted and key quarantined.');
      } else {
        this.quarantineKey(`AES-GCM decryption failed: ${msg}`);
        throw new Error(`Decryption Failed: Authentication tag mismatch or corrupted ciphertext. Key quarantined.`);
      }
    }
  }
}

const CryptoService = new CryptoManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CryptoService,
    CryptoManager
  };
}
