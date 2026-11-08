# Financial data migration boundary

## Current stored meaning

- Dexie remains schema version 1 with 11 stores. Android production storage wraps those records in the existing encrypted facade; backups enumerate those same stores and validate their existing contracts.
- Transactions contain a positive numeric amount and only `income` or `expense`; they have no account ID, currency code, refund relation, or transfer identity. Budgets, savings goals, and contributions also have no currency field.
- The UI has historically formatted and aggregated all transaction amounts using the current profile currency. This is the only application-level interpretation available for old records. It does not prove the currency in which a user originally entered them, especially if the profile preference changed.
- A savings contribution is a goal-progress record. Older versions could additionally create a separate expense row labelled `Savings transfer`; that row is existing user data and remains untouched by this change.

## Safe boundary for new work

- Do not assign legacy account IDs or currency codes automatically. No account or original-currency provenance exists to support such inference.
- Do not rewrite old transaction types, savings contributions, budgets, or historical expenses as part of account/transfer work.
- New financial identity fields may be optional on the TypeScript shape for backward compatibility, but every new-write API must require and validate them before persistence.
- Any future legacy-currency reconciliation must be an explicit, cancellable user choice. It must be resumable, idempotent, compare before replacement, and verify encrypted copies through the existing encrypted storage APIs. Until the user confirms a currency, unresolved rows must not be silently included in a differently denominated aggregate.
- If a new Dexie store is chosen, the change must update the Dexie version, encrypted-table allowlist, backup validator, backup round-trip tests, migration coverage, and restore behavior together. A native Keystore operation and a Dexie transaction are not one atomic transaction.
- Account opening balances and transfers must use currency minor units and explicit account types. No account is assigned to an existing transaction by default; account-less transactions remain valid.

## Change in this package

New savings contributions now update only the savings goal and contribution records in one existing encrypted-storage/Dexie transaction. They do not create spending rows. Existing `Savings transfer` expenses remain unchanged. This uses no new store or migration and is backward compatible with existing backups.

## Deferred until the ledger contract is implemented

Account-aware transfers, per-record currency reporting/reconciliation, refunds, loan and card accounting, and planned budget commitments are not activated by this package. Those concepts need an event/relationship contract and migration tests before UI writes them. In particular, current cash-flow analytics cannot safely aggregate unlike currencies, and the current task model has no amount or paid-transaction relation for commitments.
