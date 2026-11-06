# WP0 changed files

WP0 only; source base `d7882d29d68fa45ac026c1da490b80aa910cd0a0`, branch `test/wp0-production-regressions-20261106`, isolated worktree `/data/data/com.termux/files/home/lifeos-wp0`. HEAD remains at the base commit: changes are **uncommitted**; no implementation SHA exists. Original branch remains `fix/gemini-vapt-remediation-20261105` at `93f882f317e76998963582d547efa7deb438ad03`. Audit source: `/data/data/com.termux/files/home/lifeos-audit-reports/20261106T111738Z`. Execution on Termux/aarch64, Node24.17.0/npm11.17.0; CI Node20 is configured but not executed remotely. No WP1–WP6 production fixes.

All modifications are in the isolated worktree only, unstaged/uncommitted. Original source/worktree remains preserved. `node_modules/` is an ignored independent copy of existing dependencies, not a source/dependency/version change; generated ignored dist output is from verification.

| Path | Change | Purpose |
|---|---|---|
| `.github/workflows/build-apk.yml` | Modified | Add known-defect observation step and JSON artifact only; native/release jobs unchanged. |
| `docs/testing/WP0.md` | Added | Test infrastructure documentation/report copy. |
| `docs/testing/WP0_ANDROID_TEST_PLAN.md` | Added | Test infrastructure documentation/report copy. |
| `docs/testing/WP0_CHANGED_FILES.md` | Added | Test infrastructure documentation/report copy. |
| `docs/testing/WP0_CI_COVERAGE.md` | Added | Test infrastructure documentation/report copy. |
| `docs/testing/WP0_HANDOFF.md` | Added | Test infrastructure documentation/report copy. |
| `docs/testing/WP0_IMPLEMENTATION_SUMMARY.md` | Added | Test infrastructure documentation/report copy. |
| `docs/testing/WP0_REGRESSION_RESULTS.md` | Added | Test infrastructure documentation/report copy. |
| `docs/testing/WP0_TEST_INVENTORY.md` | Added | Test infrastructure documentation/report copy. |
| `package.json` | Modified | Append mandatory encrypted/WP0 suites and add explicit observation/strict scripts; no dependencies/version changed. |
| `scripts/run-encrypted-tests.cjs` | Added | Sequential fail-closed4-suite execution and completion counts. |
| `scripts/run-wp0-regressions.cjs` | Added | Bounded per-case child runner, source hashes, result/exit policy and JSON. |
| `tests/wp0/harness-selftest.cjs` | Added | Policy, AST/side-effect boundary, taxonomy and real missing-dependency tests. |
| `tests/wp0/production-cases.cjs` | Added | Control and7 production acceptance scenarios. |
| `tests/wp0/production-harness.cjs` | Added | Real TS graph, AST function extraction, fake IndexedDB and native/browser substitutes. |
| `tests/wp0/result-policy.cjs` | Added | Only tagged known assertions non-blocking; other failure policy. |
| `tests/wp0/test-inventory.json` | Added | Machine-readable categories/limits for22 root tests, Sentinel and WP0. |

## Explicit unchanged scope

No diffs from base under src/, android/, src_core_logic.js or package-lock.json. All existing root test source files, including the4 newly scheduled suites, are unchanged; only their orchestration improved. No dirty original App/test changes copied. No production Android config, app package/version, schema, auth, encryption, storage, notification or export implementation changes.

## Original modified-file preservation

| Original path | SHA256 before/after (identical) |
|---|---|
| `src/App.tsx` | `a5e7da7c0fbefb7696c7accdd196f61b51582483543ef3bdb821bccd80c447fa` |
| `test_auth_lifecycle.js` | `fbdc45c6dd19573b6b5fdb4cfd329d87d082a34d0eed2c6f805001edbe34872f` |
| `test_sec01_orphan_keystore.js` | `e23f5e4fea2f32fd3a655b4865405b1ede1ff6a5783e970e321c4fa057653d07` |

Original branch/HEAD/status/all141tracked hashes and untracked path inventory verified in preservation-check.json. .audit-backup/ contents intentionally not opened or hashed. Git metadata includes the authorized new local branch/worktree; no commit/push/merge or original checkout. Artifact file-manifest.json contains final changed-file hashes; it is external because the implementation is not committed.
