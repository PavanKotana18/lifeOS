# Next Implementation Handoff

Baseline Sprint 1 `3e11619d612fc4207bf5972979a8583da069ea3e`; verified implementation checkpoint `6bd8f0e42bf90d50a1058ed8cf9856d12b15b2d3`. No main/develop/Sprint 1 merge. Final reports commit is the draft PR head.

Review this stacked draft against `fix/lifeos-security-data-sprint1-20261106`, never main. Verified production checkpoint is identified above; final PR head adds sanitized reports only. Start from the integration head after checking remote base/head. Do not copy dirty originals or reset any tree.

Next batch order:

1. Run dedicated Android instrumentation/physical-device acceptance from Sprint 1's plan: background/resume, cancellation, biometric concurrency, actual key loss, wrong recovery kit, durable proof/rebind, encrypted restore and settings-return lifecycle. Verify debug artifact corresponds to intended commit. No live data.
2. Test notification permissions/grant/revoke, denied exact alarms, settings-return, reschedule/reset/import and reboot on supported Android versions. Add serialized scheduling/reset if races reproduce; test DB failure after native cancellation.
3. Fix LOS-010 with actual CSV export handler tests, and duplicate create-after-refresh failures (LOS-006). Keep known-defect classifications honest.
4. Only after restore/recovery acceptance, implement WP3 provisioning/migration/restart activation. Preserve fail-closed ciphertext gate and never regenerate missing data keys.
5. Review coherent CSP/appearance startup changes and release SDK/AAB/provenance separately. Generalized money validation/decimal policy needs explicit migration/backward-compatibility tests.

Reproduce `npm test`, `npm run test:sentinel`, `npm run test:all`, `npx tsc --noEmit`, `npm run build`, and WP0 controls. Known observations remain explicit; strict exits1 until LOS-001/010 and native block are addressed. Source provenance and compact verification accompany reports. Private evidence is local only; no restore against real personal DBs.
