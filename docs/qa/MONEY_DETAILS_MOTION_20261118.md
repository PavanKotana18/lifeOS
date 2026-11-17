# Money detail and persisted motion increment

Baseline ae8363c preserved in external recovery bundle: C:/Users/kotan/AppData/Local/LifeOS/checkpoints/money-details-motion-20261118/baseline.bundle. Branch feature/money-details-motion-20261118. No publishing or device operations.

Implemented: focused Money detail header across Transactions, Budgets, Savings, Accounts, Analytics and Planning; explanatory posted/planned labels; explicit overview navigation; valid month selection available directly on budget screens; collapsible transaction filters with count/reset; exact stored minor-unit transaction amounts; responsive detail layouts. Existing create/edit, deletion confirmation, ledger and storage callbacks retained.

Motion: persisted Silky/Snappy/Oil setting, serialized storage writes, bounded startup, cache fallback, stale-hydration protection, failure feedback; preset controls actual drag resistance, release spring and route timing. OS reduced-motion overrides animation. Preference is cosmetic bootstrap data, not private record storage.

Obsolete UI test review: the previous test required a Transfer action even for zero accounts, despite the production transfer model requiring two accounts. It also required destinations hidden in a More tools disclosure. Replacement asserts rendered expense/income actions, absence of impossible Transfer, optional Accounts and visible destination navigation; directed Money tests retain Transfer with sufficient synthetic accounts and unchanged accounting assertions. This batch replaces the native section dropdown contract with focused heading/back-route assertions and actual header handler tests. No accounting/security assertion was removed.

Remaining: comprehensive redesign of budget/savings editors, analytics charts and Life detail flows is unfinished. Existing functioning forms remain. Browser evidence must distinguish synthetic mounted components from the protected full App; native acceptance is unexecuted. Final results are recorded externally in results.json and check logs, preserving failed attempts if any.
