# Android API 24 recovery acceptance fixture

## Diagnosis

PR #19 run [42274739248](https://github.com/PavanKotana18/lifeOS/actions/runs/42274739248), job `128090084942`, executed 9 Android tests on API 24. The recovery case failed in the test helper `CryptoAcceptanceTest.recoveryEnvelope()` while calling `SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")`. It failed before invoking the native recovery method.

Production `LifeOSCryptoPlugin.deriveRecoveryKey()` does not use `SecretKeyFactory`; it derives PBKDF2-HMAC-SHA-256 using `Mac.getInstance("HmacSHA256")`, retains 600,000 iterations and 256 output bits, and wipes intermediate arrays. The test now supplies a fixed synthetic envelope so API 24 executes that production implementation. No production cryptographic code or parameters were changed.

## Deterministic synthetic vector

- Recovery code: 43 ASCII `A` characters.
- Salt: 16 bytes of `0x03`.
- IV: 12 bytes of `0x04`.
- Synthetic data key: 32 bytes of `0x2a`.
- KDF: PBKDF2-HMAC-SHA-256, 600,000 iterations, 256-bit output.
- Envelope encryption: AES-256-GCM with AAD `LifeOS recovery envelope v1`.

The expected wrapped bytes were generated with Node's standard `crypto.pbkdf2Sync` and AES-GCM implementation and independently decrypted during local validation. The Android test then calls production `recoverWithSecret()` with a wrong code and the correct code, confirms that a successful recovery remains quarantined, verifies record proof, and confirms that proof does not unlock the session.

## CI sequence

The workflow runs only this recovery method on API 24 first. Its JUnit report must contain exactly one passing, non-skipped test before API 34 smoke or the API 24/34/35 matrix can start. The focused result remains pending until the integration PR workflow completes. Emulator results are not physical-device validation.
