# Money 2.0 finance data migration

## Version 2 upgrade

Dexie version 2 adds `financialAccounts`, `accountTransfers`, `manualExchangeRates`, and `plannedCommitments`, and adds a non-unique `accountId` index to transactions. The v2 schema repeats every v1 store and index because Dexie treats omitted stores as removed. Upgrade does not edit or re-key existing records, assign accounts, add currency tags, or reinterpret money. New tables start empty.

Legacy transactions remain valid and unassigned. Existing values and date-only timestamps retain their original representation. Account currency is optional only in the historical transaction sense; new transactions created in the app receive an explicit currency. Changing the reporting currency remains guarded while financial records exist.

## Encrypted storage

All four new tables are included in the encrypted-record codec, CryptoService authenticated-data table allowlist, authenticated storage facade, transaction coordinator, migration scan, private-row admission checks, and backup/restore tables. Account edits cannot change currency once posted records or transfers reference the account. Referenced accounts must be archived rather than deleted.

## Accounting semantics

Opening balances initialize account balances but are not income. Asset balances include posted income, expenses, and account transfers. Credit-card purchases increase the amount owed; payments reduce it. Transfers live in a separate table and are not included in income/expense analytics. Cross-currency transfers require both amounts and an explicit rate that reconciles after currency rounding.

Opening balance and currency become read-only after an account has posted transaction/transfer history; changing either would retroactively rewrite prior balances or reinterpret posted money. The UI and encrypted/raw storage enforce the same rule. Accounts with history can be archived, preserving them for reporting.

Deletion is permitted only for accounts with no transaction, transfer, or planned-commitment references and a zero opening balance. Funded unused accounts must be archived so their initial value is not silently discarded.

A transfer reversal is a separately linked exact counter-entry. It retains the original for history, swaps both accounts/currencies and the already-posted minor-unit amounts, and does not need a newly guessed FX rate. A second reversal is rejected. The original cannot be edited or removed until its reversal is undone; removing the reversal restores the original as editable history.

Commitments are plans only. They do not post expenses or reminders automatically. A real paid transaction remains a separate action, preventing forecasts from being counted as actual spending.

## Backup compatibility

The validator accepts the prior 11-table backup and supplies empty arrays for the four new optional tables. New backups carry all 15 table arrays. Restore validation checks currencies, amounts, duplicate IDs, account/category references, transfer direction, exact reversal linkage and rates, and duplicate pair/date rates before the existing transactional restore begins. Tests cover a real disposable IndexedDB backup round trip with account, transfer/reversal links, rate, and commitment references, plus rollback on failed restore.

## Limits

No historical account assignment or original currency is inferred. Mixed-currency reporting remains separated unless an appropriate dated rate is explicitly supplied; this checkpoint stores rates but does not automatically convert or combine ledger totals. Commitments are listed and paused/resumed, but do not automatically advance occurrences or create actual transactions. Android native instrumentation and physical-device accounting acceptance require hosted/device verification.
