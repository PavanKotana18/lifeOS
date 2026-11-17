# Money 2.0 development baseline and incremental plan

Prepared 2026-11-17, branch `local/lifeos-debug-isolated`.
Native Android execution remains an outstanding release gate, not a prerequisite
for React/TypeScript development. This mission performs no device operations.

## Recovery checkpoint

`C:\Users\kotan\AppData\Local\LifeOS\checkpoints\money-baseline-2026-11-17T15-48-00-471Z`
contains a binary `tracked.patch` relative to recorded HEAD, copies of all 35
changed/untracked files, SHA-256 manifest, Git status, and restore instructions.
Restore into a separate checkout at the recorded HEAD and review before copying
over newer work. No stash, index change, commit, or reset was used. Ignored
files and credential stores are excluded; candidate key/environment files and
private-key content were screened before copying. Signing values were not
read from the environment or credential files.

Baseline logs and machine-readable results:
`%LOCALAPPDATA%\LifeOS\qa-reports\money-development-baseline-20261117\`.
The requested checks are npm test, npm run test:sentinel,
npx --no-install tsc --noEmit, and npm run build. See report.md there for final
results. Android runner fixtures in npm test use simulated ADB only.
All four baseline checks completed with exit code 0: JavaScript PASS, Sentinel
PASS, TypeScript PASS, Vite PASS. Vite retains the existing >500 kB chunk
advisory. Native Android acceptance was not executed and remains open.

## Architecture and existing features

| Area | Existing implementation | Development gap |
|---|---|---|
| Entry | App.tsx form, userPreferences.ts buildTransactionUpdate, transactionDraft.ts duplication; create/edit/delete, optional description, local date/time, optional account, currency and minor units, submission guards | Duplicate helper omits currencyCode/accountId and converts amount through Number; clarify fallback for inactive/missing accounts and historical currency |
| Account-optional tracking | Transaction.accountId is optional; MoneyAccounts explains optional tracking; encrypted facade validates account/currency links | Strengthen cross-screen lifecycle coverage, including editing an assigned record to unassigned; inspect existing-account fallback in saveNewRecord before changing it |
| Accounts | Opening balances, asset/card liability semantics, transfers, reversals, active-state and referenced-account safeguards | Extend existing paths only; no second ledger or stored derived balances |
| Recurrence | Transaction.isRecurring flag; PlannedCommitment weekly/monthly/yearly frequency, next due date, pause state, optional category/account; MoneyPlanning CRUD | No transaction recurrence engine or atomic planned-occurrence posting found. A boolean does not generate future transactions; planned bills do not count as spending |
| Insights | MoneyHome recorded income/expenses/net, budgets, largest expense category, previous-month changes; financeAnalytics uses integer minor-unit sums and excludes other currencies | Keep missing months distinct from zero, show coverage/period context; future plans must remain distinct from posted activity |
| Persistence | db.ts StorageService integration, encryptedStorageFacade, encrypted transaction coordinator, Dexie, crypto admission, backup validation | Preserve facade writes, authentication boundaries, encryption, offline behavior and legacy imports |

Do not duplicate existing accounts, transfer UI, planned-bill editor, budgets,
savings contributions, manual rates, currency converter, reports, or quick entry.
Account balances and recorded cash flow have different meanings. Transfers and
savings allocations must not inflate income/expense totals. Manual rates are
explicit; no online-rate dependency is needed.

## Overlap with current uncommitted work

- App.tsx contains Tasks 2.0 navigation/detail work and owns Money handlers and
  forms. Edit individual Money handlers; do not replace the component wholesale.
- types.ts has the new optional TaskSubtask structure. Additive Money fields
  must preserve it and historical records.
- db.ts contains subtask backup validation. Future finance validation/migration
  changes must preserve those checks and use synthetic backup fixtures.
- index.css contains Tasks motion/layout work and shared form styles. Prefer
  existing Money classes; avoid global style rewrites.
- package.json combines Tasks 2.0 regressions and QA/emulator commands. Append
  future tests without replacing either group.
- Existing test harness edits support Windows execution and synthetic fixtures.
  Money and Planner tests share App.tsx parsing and encrypted storage fixtures.
- Android debug suffix/signing isolation, notification instrumentation,
  emulator safety helpers and hosted workflow are separate release infrastructure.
  Preserve their uncommitted changes and AC-power guards.

## Recommended first end-to-end slice: reliable Duplicate transaction

User outcome: duplicate a recorded transaction into an editable new entry with
the same currency and exact amount, optional valid account, and today's new-entry
date/time; save once and see the new record in history and recorded cash flow.
Cancel or failed security admission must write nothing.

Proposed source scope:

- `src/services/transactionDraft.ts`: derive the decimal draft from amountMinor
  using existing financeCore helpers when currency metadata is available; carry
  source currency. Resolve legacy currency explicitly through new-entry context.
- `src/App.tsx`: pass account context into duplication; preserve an active,
  matching-currency account, otherwise leave it unassigned and explain the
  fallback. Do not silently change currency to fit the default account.
- Reuse `src/services/userPreferences.ts`, `financeCore.ts` and
  `encryptedStorageFacade.ts` for validation/persistence. No schema, new table,
  new ledger, or native bridge is required for this slice.

Regression work:

- Extend `test_transaction_duplicate_20261107.cjs`: source currency differs from
  preferences; 0/2/3-decimal currencies; exact minor-unit formatting; no inherited
  ID/timestamps; source record remains unchanged; optional account preserved or
  deliberately cleared for inactive/missing/mismatched account.
- Extend `test_directed_transaction_entry.cjs` with synthetic production-facade
  round trip: duplicate draft -> buildTransactionUpdate -> encrypted add -> read,
  new ID, ciphertext at rest, one write, cancel/failure writes zero records.
- Assert Money analytics gain exactly one posted transaction in the correct
  currency, and excluded currencies remain excluded; use existing
  `test_finance_analytics_money_20261107.cjs` and account balance fixtures.
- Retain `test_money2_financial_workflows_20261108.cjs`, Tasks 2.0, full JS,
  Sentinel, TypeScript and Vite checks. Android keyboard/back/rendering and
  persistence acceptance remain pending for release.

## Subsequent increments

1. Account-optional edit lifecycle: demonstrate assigning then clearing an
   account, preserving currency and encrypted history; test actual save handler
   fallback and facade updates, not just UI copy.
2. Planned bill -> reviewed expense: reuse MoneyPlanning. Require amount,
   currency/category confirmation; atomically post one occurrence and advance
   its due date in the existing coordinator. Add durable occurrence identity and
   duplicate-submit/retry protection, month-end/leap-year rules, pause behavior,
   backup validation and encrypted restart tests. Keep this explicit and offline;
   no background or native scheduling dependency.
3. Broader recurrence: define income support, cadence anchor, skipped/edited
   occurrence policy and catch-up behavior before extending the existing model.
   Never infer schedules from legacy isRecurring=true alone or auto-post history.
4. Cash-flow clarity: reuse financeAnalytics for recorded totals; add a clearly
   labeled upcoming-plan view separately, with currency coverage and date range.
   Avoid invented balances, implicit conversion and unsupported forecast claims.

No feature implementation is included in this planning mission.
