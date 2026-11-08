# Test Results

Baseline Sprint 1 `3e11619d612fc4207bf5972979a8583da069ea3e`; verified implementation checkpoint `6bd8f0e42bf90d50a1058ed8cf9856d12b15b2d3`. No main/develop/Sprint 1 merge. Final reports commit is the draft PR head.

Scripts inspected before execution; no installs or global environment changes. Termux uses independently copied existing node_modules, disposable fake-indexeddb and synthetic records only. Implementation bytes are identified in compact evidence. Full raw logs remain private/external.

| Command | Exit | Result |
|---|---|---|
| `npm test` | 0 | PASS |
| `npm run test:sentinel` | 0 | PASS |
| `npm run test:all` | 0 | PASS |
| `npx --no-install tsc --noEmit` | 0 | PASS |
| `npm run build` | 0 | PASS |
| `node scripts/run-wp0-regressions.cjs --controls --json <external-evidence>/mandatory.json` | 0 | PASS |
| `npm run test:regressions -- --json <external-evidence>/known.json` | 0 | PASS |
| `npm run test:regressions:strict` | 1 | Expected observations: two known defects plus Android blocked |
| `git diff --check` | 0 | PASS |

Five new focused cases pass: cents arithmetic, exact-alarm denial, permission UI contract, stale reschedule cleanup, failed-reset preservation. Ten WP0 mandatory scenarios pass; LOS-001 and LOS-010 remain KNOWN_DEFECT and LOS-003-ANDROID BLOCKED. Strict exit1 is intentional and not a harness failure. Existing tests did not regress. Native interfaces are simulated; mounted React/full UI and actual Android alarms are not executed locally.

Local Android build BLOCKED: Java exists, but this checkout has no Gradle wrapper and no installed Gradle/verified SDK toolchain. No toolchain installed. GitHub debug build is enabled on this exact branch; live run evidence is linked in PR delivery. A debug APK build is compilation evidence, never physical-device acceptance.

GitHub checkpoint verification: [run42227295792](https://github.com/PavanKotana18/lifeOS/actions/runs/42227295792), exact code commit `6bd8f0e42bf90d50a1058ed8cf9856d12b15b2d3`: automated checks and Android debug build **PASS**. Merged notification manifest check also passed. The existing workflow additionally ran its configured signed APK build; no signing configuration/credentials were changed or accessed locally. No app-store deployment occurred. Final reports-only head will trigger a separate run; this evidence belongs specifically to the code checkpoint.
