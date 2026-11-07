# Financial core and savings planner

The Finance **Planning** tab runs fully offline and does not create or modify ledger records. Users compare two savings scenarios using the same starting amount, contribution schedule and inflation assumption.

## Monetary model

- Amounts are parsed into integer minor units using versioned metadata (`lifeos-iso4217-subset-v1`). The supported metadata subset covers the current INR/USD/EUR/GBP preferences and common zero- and three-decimal currencies. Unknown codes are rejected.
- Decimal ties round half away from zero. BigInt is used for sums and serialization is base-10 text; no IEEE-754 arithmetic is used for ledger-like amounts.
- The projection treats annual nominal return and inflation as simple APR inputs divided by 12. Interest is applied monthly and rounded half up to the currency minor unit; contributions are added at month end. Optional step-ups happen after the selected number of months.
- Inflation-adjusted output deflates by the compounded monthly inflation assumption. The form names inputs and outputs and displays assumptions, exclusions, and a non-guarantee statement. Taxes, fees, rate changes, exchange conversion and investment recommendations are not modeled.

## Compatibility boundary

This is a planning calculator, not yet a currency-aware ledger. Existing transaction, budget and savings records keep their current schema and global reporting-currency display behavior. No record receives a guessed currency and no conversion is performed. Before currency identity is added to persisted records, a migration and user-confirmed classification flow is required for existing ambiguous amounts.

Focused evidence: `test_finance_core_20261107.cjs` exercises decimal rounding, currencies with 0/2/3 fraction digits, large BigInt values, formatting, step-ups, scenario comparison and long-horizon inflation. The UI is build-validated; no Android tap-through test currently targets this screen.
