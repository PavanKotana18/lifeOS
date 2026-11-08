# Next engineering handoff

Branch `fix/lifeos-security-data-sprint1-20261106`. Parent / published WP0 commit `370a445f19c843abe42b7d6450d4d521bbb07824`; audited main `d7882d29d68fa45ac026c1da490b80aa910cd0a0`. Tests ran on the uncommitted sprint patch; `evidence/source-sha256.json` identifies exact reviewed bytes. The final source commit is the PR head. No merge or release is performed.

Review this draft PR before merging. This is a tested partial WP1/WP2 delivery. WP0 is already pushed separately at `370a445f19c843abe42b7d6450d4d521bbb07824`; no WP0 or sprint merge into main. Original dirty work remains untouched and must not be reset/copied blindly.

## Current commands and gates

- `npm test`: original tests + mandatory4 encrypted suites + policy/controls +13 focused service tests.
- `npm run test:sentinel`:6 Node suites, with legacy/native-simulation/static limitations preserved.
- `npm run test:all`, `npx tsc --noEmit`, `npm run build`: local checks pass.
- `node scripts/run-wp0-regressions.cjs --controls --json test-results/acceptance.json`:9 mandatory scenarios.
- `npm run test:regressions`:3 KNOWN_DEFECT +1 BLOCKED. `npm run test:regressions:strict` intentionally exits1.

Fixes promote the original correct expectations, never defect-shaped expectations. Current promoted LOS-003 proves JS/native-interface contract only; keep real Android case blocked. If future controllers/React structure change, adapt AST tests to actual production exports; don't copy obsolete implementation into mocks.

## Recommended next batch

1. Native compilation and dedicated device instrumentation described in ANDROID_VALIDATION_GAPS; verify cancellation/generation/Keystore/quarantine/rebind/persistence failures. Review new boolean-only proof API and all terminal callbacks.
2. Exercise full backup/recovery UI and portable legacy/encrypted files on Android. Current record proof is one actual encrypted record; mixed-key/corruption handling and broader domain validation need explicit policy.32MiB UTF-8 payload cap is intentional; do not silently accept unsafe larger files.
3. Only after recovery/restore/device acceptance, implement WP3 fresh setup + recovery provisioning + resumable migration + restart activation. **Do not remove the ciphertext startup gate or enable raw fallback to make the UI open.** Recovery currently repairs/locks the wrapper and does not activate storage.
4. WP4 P1 work: LOS-006 duplicate creates, LOS-009 orphan notification reset/import reconciliation, LOS-010 production CSV sanitizer. Their pending status remains visible; do not mark them covered by this sprint.
5. WP5 target SDK/AAB/signature/provenance and remaining audit debt before release. No Play readiness claim.

## Data/rollback constraints

Use disposable fixtures only. Never roll encrypted rows back into an old raw build, delete healthy aliases for generic errors, stash/reset original changes, or merge historical branches wholesale. Native recovery may deliberately create a new device wrapping key after verified recovery; it never creates a replacement data key. Preserve known-good validated backups and recovery material outside reports. Source SHA256 evidence allows comparing the tested pre-commit patch with the final PR head.

No extra packages/toolchains installed. Remote Actions/device status must be checked live; local green Node/static checks are not hardware evidence. All reports, compact evidence and the sanitized ZIP are hosted in this branch; full logs remain external locally.
