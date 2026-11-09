# PR #36 — Mandatory security onboarding

## Flow and storage boundary

New installations must finish name, secure device-protected key setup, and real recovery-kit confirmation before `onboardingCompleted` can be written or Today can open. The name starts as a bootstrap draft because no encrypted key exists yet. After native protection is verified, the app writes the authoritative profile name through encrypted settings and deletes the draft. Private-record admission still depends on the encrypted-storage facade.

Recovery is no longer a label-only choice. The recovery stage calls the existing native `prepareRecovery` / `confirmRecovery` path and opens the protected recovery-kit dialog. It requires the user to confirm the generated code. Cancelling leaves onboarding incomplete and the workspace gated. The optional label is metadata only.

Existing completed installations are not routed back into onboarding. Existing encrypted keys, records, and recovery metadata are not replaced. Plaintext legacy profile names are included in the established authenticated migration, which verifies encrypted copies before retiring source rows.

## Keystore authentication compatibility

Fresh keys on API 30+ can use Android's strong-biometric or device-credential authenticator set with the minimum non-zero one-second Keystore authorization window. Android does not allow the device-credential combination with a `BiometricPrompt.CryptoObject`, so that mode authenticates with the system prompt before using the time-bound key. Existing keys without the new durable policy marker retain their original biometric-only, per-use `CryptoObject` path. Interrupted legacy setup aliases also remain on that original path. API 29 remains on the strong-biometric per-use path because the combined device-credential API is unavailable there. No custom PIN or unauthenticated fallback was added.

This policy has native-source regression checks, but actual biometric/device-credential acceptance and key behavior still require Android instrumentation or a device with secure lock enrollment.

## Verification status

- Node regression suite and all six Sentinel suites passed; TypeScript and production build passed. The build retains the existing large-JavaScript-chunk warning.
- Android native compilation and hosted instrumentation are pending the exact-new-commit CI run. This Termux environment has no Android SDK.
- Emulator visual coverage is limited to non-secret onboarding screens. The recovery-code dialog is never rendered or captured by the visual test; Activity screenshot protection stays enabled.
- Physical-device onboarding and existing-user upgrade acceptance remain required. Tests use synthetic data and do not capture recovery codes.
