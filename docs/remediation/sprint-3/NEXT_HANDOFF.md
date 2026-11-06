# Next engineering handoff

Base PR #14 `5848a0eb4c887d5c9479208ae282d8a72a228268`. Code / acceptance checkpoint `cd503d8033b40b9ee6957bf876e8bb18d1b8f5f9`; final reports-only commit is the PR head. Stacked target `integration/lifeos-local-consolidation-20261106`. No merge or release.

Review this draft against the consolidation branch, not main. Two coherent code checkpoints are8751471 (CSV/committed-save/native synthetic scaffold) and the exact acceptance checkpoint above (real biometric test). Reports-only head is the final draft PR head. Existing originals and the shared stash must remain untouched.

1. Download matching debug/test APKs from the exact CI run. Execute synthetic-native and opt-in real biometric tests on separate fresh named AVD profiles per matrix. Attach sanitized JUnit/device metadata; never call APK compilation an instrumented pass.
2. Extend dedicated native recovery acceptance for real key invalidation, rebind durability/commit failure and process interruption. Current recovered-record proof authenticates one record, not every mixed-key/corrupt DB row. Preserve quarantine and no silent replacement DEK.
3. Exercise actual backup/recovery UI/SAF and encrypted/raw relationships on synthetic WebView data; inspect wrong-password/malformed/failed-restore preservation. Reconcile genuine failures with focused tests before activation.
4. Only after those gates, implement WP3 provisioning/recovery-kit UX, migration/restart backend activation and physical encrypted persistence for LOS-001. Never remove the ciphertext startup gate merely to make data open.
5. Add serialized notification/reset/import coordination and actual reboot/permission-revocation acceptance. Then mounted-React save/cross-form checks, CSV target-spreadsheet/SAF behavior and remaining release engineering.

Local commands: `npm test`, `npm run test:sentinel`, `npm run test:all`, `npx tsc --noEmit`, `npm run build`, `node scripts/run-wp0-regressions.cjs --controls`. Known observations contain LOS-001 and Android BLOCKED; strict intentionally exits1. Guarded native runner exits2 without a selected fresh AVD/APKs. No installs, device changes, recovery provisioning or app data restoration were performed locally. No source archives, node_modules/build artifacts or personal records are in reports.
