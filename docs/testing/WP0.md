# WP0 production regression testing

WP0 adds test infrastructure only. Application/native source and Android configuration
are unchanged. The seven known production defects remain deliberately unresolved.
See [test inventory](WP0_TEST_INVENTORY.md), [CI coverage](WP0_CI_COVERAGE.md),
and [Android plan](WP0_ANDROID_TEST_PLAN.md) for evidence and limits.

## Commands

| Command | Purpose / failure policy |
|---|---|
| `npm test` | Existing tests, four previously omitted encrypted suites, WP0 controls/self-tests; all must pass |
| `npm run test:encrypted` | Four omitted suites, exactly once in the default test chain |
| `npm run test:wp0` | Harness policy/dependency checks and actual activated-runtime controls |
| `npm run test:sentinel` | Existing six suites, including legacy/simulated/static tests; not device acceptance |
| `npm run test:all` | `npm test` then Sentinel, no duplicated encrypted suites within this command |
| `npm run test:regressions` | Seven acceptance scenarios; documented known failures do not block, infrastructure errors do |
| `npm run test:regressions:strict` | Same acceptance assertions, exits nonzero for known failures or blocked device checks |
| `npm run test:regressions -- --json test-results/wp0.json` | Persist structured results, source SHA and production-file hashes |

Run only in a development checkout with disposable fixtures. Node tests use
`fake-indexeddb`, not a browser's or installed app's database. Native crypto is an
explicit **simulation** using synthetic process-local Node AES-GCM. It executes
the actual TS native wrapper, record codec, migration, facade and coordinator;
it does not test Android Keystore, biometric authentication or Java threading.
Synthetic key bytes are never printed/persisted and are zeroed on fixture disposal.
Sentinel filesystem fixtures should use a disposable `TMPDIR`.

## Known-defect policy

The runner distinguishes `PASS`, `KNOWN_DEFECT`, `UNEXPECTED_PASS`,
`HARNESS_FAILURE`, and `BLOCKED`. Only the explicitly listed finding cases may
allow a `WP0_CONTRACT_FAILURE` raised by their final production acceptance assertion.
Missing imports, fixture/precondition assertion errors, parse/extraction drift,
unexpected exceptions, timeouts and invalid/zero-check reports always fail.
Fixed behavior yields `UNEXPECTED_PASS` and fails until that test is promoted
to mandatory acceptance. No general `continue-on-error`, `|| true` or skipped
assertions hide a broken test host. Strict mode is intended to remain red until
the recorded defects and explicit device-validation gap are addressed.

The default policy exits zero for reproduced known defects and the explicitly
blocked Android check. This means the observation job completed, **not that
the app is safe to release**. CI uploads the result JSON even on failure. Existing
mandatory checks continue enforcing passing assertions. `test:all` intentionally
does not include the known-defect observations; CI invokes them separately.

## Production boundaries

- LOS-001 executes the AST-selected actual `initApp`, then writes via actual
  `StorageService` and inspects raw IndexedDB. UI setters/theme DOM and optional
  biometric availability are substituted. This is not a mounted React test.
- LOS-002 uses a nonempty eleven-table backup produced by real services, the
  actual validator and activated encrypted runtime. It never replaces the
  validator with the incorrect historical `[]` mock contract.
- LOS-003 executes the actual registered `appStateChange` callback with real
  session/DB behavior. Fixture activation isolates resume from LOS-001;
  native `onStop` eviction is simulated. Real Android remains `BLOCKED`.
- LOS-007/008 execute identical raw/encrypted service operations with a fixed
  local clock, checking independent raw invariants before backend comparison.
- LOS-009 invokes the actual reset button handler with real database deletion
  and production scheduling against a synthetic native pending-alarm store.
- LOS-010 invokes the actual CSV export button handler and captures file output;
  literal quoting/newline controls distinguish parsing bugs from formula exposure.

`production-harness.cjs` selects unique TypeScript AST nodes and executes their
unmodified expressions. Missing/ambiguous nodes are harness failures, not source
string security passes. If future work extracts controllers, migrate these tests
to import those real controllers; do not copy their old code into tests. Browser
rendering, event binding, React effects, activity ordering and native delivery
remain outside this host. There is no coverage-percentage or device-pass claim.

## Promoting a fixed finding

In the corresponding authorized remediation package, change the production code
and run the existing expectation. Once acceptance succeeds, move the case from
the known list to mandatory controls/acceptance, update classification/hand-off,
and retain its desired-behavior assertion. Do not change expected values to match
the defect or remove assertions. LOS-003's separate device requirement must stay
blocked until instrumented evidence exists. The four older encrypted suites are
useful but include simplified mocks; they cannot replace these production contracts.
