# Mission 07 integration and Money duplication

## Completed work and branch order

The original `local/lifeos-debug-isolated` branch and its 35-file checkpoint
remain intact. Checkpoint hashes were verified. The current working branch is
`feature/money-reliable-duplicate-20261117`; the commits form a dependency chain:

1. `feature/tasks2-and-portable-regressions-20261117`: `21bb399`, task detail,
   encrypted subtasks, Upcoming date grouping, backup validation, Windows test
   portability and associated regressions.
2. `qa/emulator-only-isolated-dev-20261117`: `39a23f0` and `8c9630f`, isolated
   Dev identity/signing, emulator-only selection, sanitized evidence, AVD
   safety helpers and hosted Dev version checks. This builds on Tasks so npm
   test can include its regression. It also fixes an undefined local runner
   variable, AVD console-name parsing, unreachable physical-device code, and
   the CI version suffix check discovered during review.
3. `feature/money-reliable-duplicate-20261117`: reliable duplicate draft entry
   and production encrypted-storage regressions, building on the first two.

Money duplication retains editable type, category, title, notes, payment method
and recurrence marker. Stored minor units format directly as decimal strings;
source currency overrides preference defaults. Accounts are preserved when
active and currency-compatible; missing, inactive or incompatible assignments
become unassigned. The draft contains no copied transaction IDs or audit
timestamps and uses new-entry date/time. Opening Duplicate does not write.
Persistence remains through the protected encrypted facade; analytics are
derived from posted records rather than copied summary state.

## Validation and release gates

Full JavaScript, Sentinel, TypeScript and Vite results and logs are stored at
`%LOCALAPPDATA%\LifeOS\qa-reports\mission07-20261117\results.json`.
All four checks completed with exit code 0 (4 PASS, 0 FAIL). Vite retains its
existing large-chunk advisory. QA runner simulation and duplicate persistence
tests passed within the full JavaScript suite; script syntax checks passed.
Focused duplicate tests cover 0/2/3-decimal currencies, large exact decimal
drafts, legacy fallback, account validity, source immutability, draft-only
opening, encrypted persistence, new identity, locked-session denial and
currency-specific cash-flow totals. The existing storage layer may reject
amounts too large for its numeric compatibility representation; exact draft
formatting does not change that validation policy.

Android runner contracts executed with synthetic executables only. No Android
native, emulator boot, notification delivery, physical-device or production-app
acceptance is claimed. Existing Windows AC-power guards remain enabled.

## Publishing and merge blockers

- Git push fails: no usable GitHub credential is present for origin. A bounded
  noninteractive retry reports `could not read Username ... terminal prompts
  disabled` and credential manager reports interactivity unavailable.
- The GitHub connector can read repository metadata but opening a PR returns
  HTTP 403 `Resource not accessible by integration`.
- Therefore no branch was published, no PR URL exists, and no PR CI run or
  merge was performed. No completed local work is left uncommitted.
- Remote main is protected. The public branch endpoint confirms protection;
  the protection endpoint returns 401 without authentication, so the exact
  mandatory checks cannot be verified with current credentials. Do not infer
  them from workflow names or bypass them.
- The Android workflow explicitly requires `LIFEOS_DEBUG_KEYSTORE_BASE64`,
  `LIFEOS_DEBUG_KEYSTORE_PASSWORD`, `LIFEOS_DEBUG_KEY_ALIAS`, and
  `LIFEOS_DEBUG_KEY_PASSWORD`. Presence was not verified remotely. Missing
  values are blockers, never a reason to skip signing validation.

Next: authenticate local Git for this repository and grant the GitHub connector
pull-request write access (or use an authenticated GitHub CLI). Push the three
branches above and open focused PRs, in dependency order, against main. Later
PRs include earlier commits until the earlier PRs merge. Check the actual
protected-branch requirements and every applicable CI result, resolve failures,
merge only passing heads, and fetch/recheck main after each merge. Keep all
branches. No force push or protection changes are needed.

Last verified remote main: `0aa9a1114ad5bd942e71405c0ab98e09bd77972f`.
