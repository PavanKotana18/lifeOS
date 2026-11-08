# Unique Changes

Baseline Sprint 1 `3e11619d612fc4207bf5972979a8583da069ea3e`; verified implementation checkpoint `6bd8f0e42bf90d50a1058ed8cf9856d12b15b2d3`. No main/develop/Sprint 1 merge. Final reports commit is the draft PR head.

83 source/equivalent fixture files were hashed and preserved; 60 differ from corresponding Sprint 1 paths. This count includes historical `.pre-*` snapshots and obsolete prototypes; it is not a count of missing fixes.

| Source | Classification / disposition |
|---|---|
| Original dirty App + two tests | Conflicting, engineering resolution applied selectively in Sprint 1. Shared controller, native-state checks and fail-closed tests supersede source-string assertions. Candidate also activates encryption and uses background debounce; these remain excluded. |
| data-integrity-integration db/test | Conflicting: existing unresolved three-stage merge on both files. Positive finite amount/date validation and immutable identity are already implemented/tested in baseline. Preserve conflict exactly; never copy merge markers or old date regex. |
| lifeOS-next `.pre-*` source/test snapshots | Unsafe/insufficiently validated rollback snapshots of key recovery, session drain, transaction primitives and codecs. Preserved privately with per-file hashes; modern equivalents exist and pass mandatory suites. Individual archived variants not rerun. |
| sentinel-review staged QA/SAF files | Most exact-byte equivalents already integrated. MainActivity lacks current native crypto/backup registration. Extra App/db/CryptoService/backupPersistenceService implement incompatible JS CryptoManager/Node filesystem architecture; experimental, excluded. |
| stash 3de0ebd7a7e2c8814e1251800bad464ebff38627 | Auth generation ownership, calendar-date checks, identity regression assertions already in Sprint 1. Source hunks preserved privately. No stash pop/apply/delete. |
| Prior lifeos-audit helper backups | Earlier auth/calendar implementations, superseded by baseline. |
| Gemini candidate 93f882f317e76998963582d547efa7deb438ad03 | Valuable missing exact-alarm permission flow and cents-based finance analytics ported, with budget residual completion. Native/recovery/activation code not copied. |
| Local-only def99bb | Experimental Sentinel ancestor/architecture; current QA/native API replaces it. Retained local branch and transfer bundle; no upload of full old snapshot. |

All branch/HEAD pairs are reconciled below using ancestry, patch equivalence and branch-changed file equivalence, supplemented by prior branch audit evidence and selective function comparisons above. Ancestry and patch-unique counts do not establish missing production behavior. Nonintegrated historical variants remain preserved, not discarded.

| Branch | HEAD | Classification | Patch unique/equivalent |
|---|---|---|---|
| `archive/develop-pre-sanitization-20261102` | `6fa0862292178e4dcc70ecc65d169129a7b04f93` | Experimental or obsolete | 2/0 |
| `audit/intake-20261101-122710` | `a575105e9bc988ef2fd6d9c5d16c557017da49d9` | Experimental or obsolete | 8/0 |
| `chore/repository-sanitization-20261102` | `087d0d87d064baddb2c07bfc24c9cf77107ec5d2` | Superseded by current implementation; differing historical variants not wholesale integrated | 0/1 |
| `cleanup/habit-planner-quality-20261101` | `890e2d1c6ed8c9f658bd47bfeafebe0d42301e88` | Superseded by current implementation; differing historical variants not wholesale integrated | 51/0 |
| `develop` | `eb3159b048c660ab6bb0d347616caef0ca4930ce` | Superseded by current implementation; differing historical variants not wholesale integrated | 1/0 |
| `development/lifeos-mainline-20261101` | `08a27f009d58d2787f1c845a13891fdb08712184` | Already integrated | 0/0 |
| `docs/release-process-and-changelog` | `4fe45a3c8ab0524fafb4f0a17a9f7f61570e8c08` | Superseded by current implementation; differing historical variants not wholesale integrated | 2/0 |
| `feature/lifeos-crypto-hardening-20261102` | `0a5e9630437061be66eed215ab74eefbdbdd214e` | Superseded by current implementation; differing historical variants not wholesale integrated | 3/0 |
| `feature/professional-ui-redesign` | `e87554cfba9805807d3824d4a435df0fbba8ca52` | Experimental or obsolete | 5/0 |
| `fix/gemini-vapt-remediation-20261105` | `93f882f317e76998963582d547efa7deb438ad03` | Valuable and missing: selective permission/finance port; other changes superseded/conflicting | 4/0 |
| `fix/independent-audit-remediation` | `6eb039e54960afe9675c8cc1e04120d8fce72ed9` | Superseded by current implementation; differing historical variants not wholesale integrated | 7/0 |
| `fix/lifeos-audit-core-20261102` | `5b97829a3fa2e41bb82f180cecb4923919b8d720` | Already integrated | 0/0 |
| `fix/lifeos-data-integrity-20261101-123045` | `a575105e9bc988ef2fd6d9c5d16c557017da49d9` | Superseded by current implementation; differing historical variants not wholesale integrated | 8/0 |
| `fix/lifeos-data-integrity-20261101-123130` | `890e2d1c6ed8c9f658bd47bfeafebe0d42301e88` | Superseded by current implementation; differing historical variants not wholesale integrated | 51/0 |
| `fix/lifeos-security-data-sprint1-20261106` | `3e11619d612fc4207bf5972979a8583da069ea3e` | Already integrated | 0/0 |
| `integration/lifeos-data-integrity-20261101` | `2516a6381994551ad09968d657a30dd26faacc4b` | Already integrated | 0/0 |
| `integration/lifeos-db-integrity-v2` | `d96546be3a996c0b65ab02e07a64884cb27a384c` | Superseded by current implementation; differing historical variants not wholesale integrated | 2/0 |
| `integration/lifeos-reconciliation-20261101` | `0bb6ae94f129616b4c8b5a3da01f5d6581245080` | Superseded by current implementation; differing historical variants not wholesale integrated | 0/1 |
| `integration/lifeos-sentinel-candidate-20261102` | `3ef89ba07ccec98070c5048fce8d43b2e4376eef` | Superseded by current implementation; differing historical variants not wholesale integrated | 57/3 |
| `integration/pr2-security-selective-20261101` | `2d7ddc675985fd84271ab74c77336e8f0d475bf2` | Superseded by current implementation; differing historical variants not wholesale integrated | 5/0 |
| `lifeos/autonomous-remediation-20261101-115555` | `6eb039e54960afe9675c8cc1e04120d8fce72ed9` | Superseded by current implementation; differing historical variants not wholesale integrated | 7/0 |
| `main` | `ac5c88119b559d74b7714a84d113f4868d387d15` | Already integrated | 0/0 |
| `promote/lifeos-sentinel-main-20261102` | `454a3a3df93a51a8cfa705b4c225d5ba11ec1108` | Already integrated | 0/0 |
| `promotion/lifeos-phase3-to-main-20261101` | `f08550038ff4f0425167ae5706018b66ba852a8d` | Superseded by current implementation; differing historical variants not wholesale integrated | 5/0 |
| `review/sentinel-pr7-on-main` | `08a27f009d58d2787f1c845a13891fdb08712184` | Already integrated | 0/0 |
| `sentinel-review-def99bb` | `def99bbe6f1ceaf9489b00c2c85ee13501a86723` | Experimental or obsolete | 0/0 |
| `test/wp0-production-regressions-20261106` | `370a445f19c843abe42b7d6450d4d521bbb07824` | Already integrated | 0/0 |
| `vapt/f10-pre-review-20261105` | `29d0d3737da75c21507143829ae6c7bd53759fe7` | Already integrated | 0/0 |
| `work/pr8-implementation-20261102` | `0a5e9630437061be66eed215ab74eefbdbdd214e` | Superseded by current implementation; differing historical variants not wholesale integrated | 3/0 |
| `fix/independent-audit-remediation` | `f2b5788c0f9c4f93732e1a45cb484216b7f2380d` | Superseded by current implementation; differing historical variants not wholesale integrated | 7/0 |
| `fix/lifeos-feature-correctness-20261102` | `f2b5788c0f9c4f93732e1a45cb484216b7f2380d` | Superseded by current implementation; differing historical variants not wholesale integrated | 7/0 |

Detailed safe source-file dispositions are in `evidence/source-provenance.json`. Full original inventories remain private.
