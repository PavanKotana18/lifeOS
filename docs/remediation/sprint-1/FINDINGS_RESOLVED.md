# Verified production fixes

Branch `fix/lifeos-security-data-sprint1-20261106`. Parent / published WP0 commit `370a445f19c843abe42b7d6450d4d521bbb07824`; audited main `d7882d29d68fa45ac026c1da490b80aa910cd0a0`. Tests ran on the uncommitted sprint patch; `evidence/source-sha256.json` identifies exact reviewed bytes. The final source commit is the PR head. No merge or release is performed.

Resolved within stated Node integration scope, not a hardware certification:

| Finding | Production change | Evidence |
|---|---|---|
| LOS-002 | `src/services/encryptedStorageFacade.ts` calls the throwing validator rather than treating valid table names as errors | Actual11-table encrypted roundtrip; consent rejection; invalid references unchanged; injected late tasks-table failure rolls back earlier clears/adds |
| LOS-007 | Encrypted goal update/milestone toggle reconciles numeric target AND all milestones, preserves Paused and identity/timestamps | Original desired raw/encrypted parity assertions promoted unchanged; last milestone/reopening/ineligible completion covered |
| LOS-008 | Encrypted recurrence uses actual local today; repeated completion is idempotent | Daily/Weekly/Monthly overdue parity through actual helpers, stable next occurrence links |
| LOS-023 | `backupImportService.ts` explicitly validates/confirms legacy tables/data JSON; actual App uses it. Encrypted exports use `backupCryptoService.ts` | Old-main synthetic export imports into activated encrypted backend without plaintext downgrade; wrong passphrase/tamper do not mutate DB or invoke legacy fallback |

Additional safeguards: milestone creation checks parent inside raw transaction/encrypted coordinator; export uses the same logical write queue; UI import only grants replaceExisting when replacement was actually confirmed, preserving a write that arrives after an empty preflight observation. The broader LOS-015 validation backlog remains open.

LOS-003's original Node simulation is fixed/promoted and now mandatory, but its Android requirement remains BLOCKED. LOS-004/005/016 native and UI changes are implemented with limited validation; they are not listed as fully resolved. LOS-017's byte/envelope contract is corrected and numerically tested; actual large native file I/O remains unverified. See FINDINGS_REMAINING.
