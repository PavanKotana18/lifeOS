# Security validation and trust boundaries

Branch `fix/lifeos-security-data-sprint1-20261106`. Parent / published WP0 commit `370a445f19c843abe42b7d6450d4d521bbb07824`; audited main `d7882d29d68fa45ac026c1da490b80aa910cd0a0`. Tests ran on the uncommitted sprint patch; `evidence/source-sha256.json` identifies exact reviewed bytes. The final source commit is the PR head. No merge or release is performed.

| Boundary | Implemented protection | Verification limit |
|---|---|---|
| JS/native session | Single-flight protected open, immediate admission close, lease drain, generation invalidation, native state verification, retry failed native lock before auth; never calls setup | Actual JS state tests and App callback simulation, not real Activity |
| Native prompt | Entire construction/observer lifecycle on main executor; RESUMED gate; STOP/DESTROY cancellation; terminal CAS and single prompt ownership | Static/source checks; Android execution pending |
| Recovery | File bounded8KiB; native recovery keeps key quarantined; boolean-only GCM/AAD proof against actual existing ciphertext before rebind; strong biometric wrapper; recovery metadata committed with wrapper; buffer cleanup | Service failure/cancel/race tests and actual wrapper+Node GCM substitute. Native PBKDF2/Keystore and persistence semantics not executed |
| Private data | Recovery never clears/imports database; startup refuses ciphertext through raw backend; no fresh encryption activation | Disposable snapshots unchanged in wrong/successful recovery simulations. Real DB untouched |
| Backup | AES-256-GCM, fresh salt/nonce, PBKDF2-SHA256310k; validated explicit legacy conversion; no encrypted-to-plaintext fallback; nonextractable WebCrypto key | Actual WebCrypto correct/wrong/tampered tests; legacy plaintext has no cryptographic authenticity, schema validation only |
| Logs | `capacitor.config.ts` loggingBehavior none; no kit/code/key logging or clipboard copy introduced | Actual resolved config/logcat not tested |

Native master-key deletion policy remains restricted to explicit permanent invalidation or stale unusable metadata in the existing recovery function; generic errors never trigger automatic data-key replacement. Proof is against one authenticated existing record, not a claim that a mixed-key/corrupt database has been completely verified. Missing/corrupt/no-challenge states fail closed.

The original uncommitted protected-session work and recent native lifecycle fixes were reviewed, not blindly merged. In installed Capacitor6 source, appStateChange(false) comes from Activity.onStop; native key eviction is authoritative, so no debounce bypass retains access across a genuine stop. Vendor prompt transitions still need physical testing.

Known-pattern credential scan plus manual review of proposed files found no real tokens/keys/private data. Synthetic keys stay process-local; JSON kit fixtures are explicitly synthetic. Full tests use fake-indexeddb, never a personal browser/native database. JS strings/React collections cannot be claimed securely zeroized; retained React data and other defense-in-depth privacy backlog remain. No comprehensive MASVS/VAPT pass, packet capture or hardware attestation asserted.
