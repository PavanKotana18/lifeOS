# Remaining Risks

Baseline Sprint 1 `3e11619d612fc4207bf5972979a8583da069ea3e`; verified implementation checkpoint `6bd8f0e42bf90d50a1058ed8cf9856d12b15b2d3`. No main/develop/Sprint 1 merge. Final reports commit is the draft PR head.

- LOS-001 encryption activation and LOS-010 CSV formula protection remain open. Recovery opening remains gated; Sprint 1's LOS-003/004 device validation gaps are unchanged.
- Exact-alarm/display prompts, settings-return lifecycle, Android13/14 revocation, reboot restoration and OEM scheduling need emulator/device verification. New manifest permissions do not prove runtime success.
- Cancellation and DB clearing are not one cross-system transaction. If cleanup succeeds then DB commit fails, records remain but reminders need resync/retry. Concurrent reschedule/reset, notification ID collisions, delivered notifications and alarm entries from unknown legacy kinds remain separate work; only known record-reminder kinds are removed.
- Finance cents arithmetic is for valid finite conventional two-decimal amounts. Fractional-cent tie policy, unsafe integer magnitude, nonfinite legacy values, per-currency precision and other dashboard/ordinary-write money validation remain unaddressed. No schema/rounding rewrite of user records.
- Existing data-integrity worktree has unresolved merge stages; maintained exactly. Do not resolve it blindly or reuse old source-string tests as production evidence.
- Legacy Sentinel/CryptoManager snapshots and old archives are retained but not runtime validated. Raw archived/private backups are outside safe source integration scope.
- Main/develop/PR13 remain unmerged; stacked review is required. This sprint does not establish release readiness.
