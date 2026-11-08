# Changed files

Branch `fix/lifeos-security-data-sprint1-20261106`. Parent / published WP0 commit `370a445f19c843abe42b7d6450d4d521bbb07824`; audited main `d7882d29d68fa45ac026c1da490b80aa910cd0a0`. Tests ran on the uncommitted sprint patch; `evidence/source-sha256.json` identifies exact reviewed bytes. The final source commit is the PR head. No merge or release is performed.

Review includes tracked modifications and newly added files; no package-lock/dependency versions, Android manifest/permissions/Gradle/app-version changes. Original `~/lifeOS` worktree remains at93f882f with its original3modified files and private backup directory untouched. New local Git refs/worktrees and authorized pushes are intentional.

- `android/app/src/main/java/com/lifeos/personal/LifeOSCryptoPlugin.java`
- `capacitor.config.ts`
- `docs/remediation/sprint-1/ANDROID_VALIDATION_GAPS.md`
- `docs/remediation/sprint-1/CHANGED_FILES.md`
- `docs/remediation/sprint-1/FINDINGS_REMAINING.md`
- `docs/remediation/sprint-1/FINDINGS_RESOLVED.md`
- `docs/remediation/sprint-1/IMPLEMENTATION_SUMMARY.md`
- `docs/remediation/sprint-1/NEXT_SPRINT_HANDOFF.md`
- `docs/remediation/sprint-1/SECURITY_VALIDATION.md`
- `docs/remediation/sprint-1/SHA256SUMS.txt`
- `docs/remediation/sprint-1/SPRINT1_HANDOFF.zip`
- `docs/remediation/sprint-1/TEST_RESULTS.md`
- `docs/remediation/sprint-1/evidence/source-sha256.json`
- `docs/remediation/sprint-1/evidence/verification.json`
- `docs/testing/WP0.md`
- `package.json`
- `scripts/run-wp0-regressions.cjs`
- `src/App.tsx`
- `src/components/BackupPassphraseDialog.tsx`
- `src/components/RecoveryDialog.tsx`
- `src/db.ts`
- `src/services/backupCryptoService.ts`
- `src/services/backupImportService.ts`
- `src/services/cryptoService.ts`
- `src/services/cryptoSessionCoordinator.ts`
- `src/services/encryptedStorageFacade.ts`
- `src/services/recoveryService.ts`
- `test_encrypted_storage_facade.js`
- `test_sprint1_security.js`
- `tests/wp0/production-cases.cjs`
- `tests/wp0/production-harness.cjs`
- `tests/wp0/test-inventory.json`

Production/test content hashes are in evidence/source-sha256.json. Test source is committed normally, but the ZIP includes reports and compact evidence only, never source snapshots, dependencies, build outputs or raw logs. The reviewed backup codec originated from committed93f882f source, not dirty App.tsx; import/bounds and UI integration were corrected here. WP0's original17-file commit remains separately available.
