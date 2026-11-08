# Release Candidate Validation Matrix

Candidate: `integration/lifeos2-release-candidate-20261108`
Pinned base: `d7882d29d68fa45ac026c1da490b80aa910cd0a0`

Status meanings: PASS = executed successfully on the recorded candidate/stage; FAIL = executed and failed; BLOCKED = required environment/evidence unavailable; NOT RUN = not yet executed. Compiled-only tests are not execution passes.

| Gate | Evidence required | Status | Evidence / blocker |
|---|---|---|---|
| Git ancestry and no duplicate integration | Exact PR SHAs, merge parents, stage ancestry | PASS baseline | #18/#19 join at #20; candidate integrated through #22 only; #23–#25 not integrated due stop condition |
| Candidate isolation | New branch/worktree from pinned main; no prior worktree changed | PASS baseline | Clean candidate at pinned base |
| Per-stage focused tests | Relevant npm contracts after each integrated stage | PASS through #24 | #22 category fixture uses `cat_food`; #24 also checks normal `cat_inv`, unchanged past expenses, savings contribution accounting, encrypted rollback, and no expense posting. DB atomicity 39; encrypted atomicity 8/8; WP0 11/11. Logs under `validation-logs/`. | `npm test` exit 0 after each; simulated/native-source and disposable IndexedDB tests |
| Per-stage TypeScript | `npx tsc --noEmit` after each stage | PASS through #24 | #24 exit 0: `validation-logs/20261108-pr24-typescript.txt` | Exit 0 after each |
| Full npm suite | `npm test` on exact candidate head | PASS through #24 | #23 expanded suite exit 0: `20261108-pr23-npm-test.txt`; #24 suite exit 0: `20261108-pr24-npm-test.txt`; initial outdated atomicity expectation documented separately |
| Sentinel | `npm run test:sentinel` on exact candidate head | PASS | 6/6 suites; SAF runtime uses bridge simulation/source checks, physical document picker remains outstanding |
| Production build | `npm run build` on exact candidate head | PASS through #24 | #24: 2,249 modules, exit 0; main JS chunk 537.59 kB exceeds 500 kB advisory threshold |
| Dexie v1→v2 upgrade | Legacy records/indexes preserved in disposable database | NOT RUN | |
| Encrypted migration safety | Existing ciphertext, plaintext legacy rows, retry/interruption/concurrency | NOT RUN | Physical/installed upgrade still required |
| Backup compatibility | Legacy 11-table and current 15-table validation/round-trip/rollback | FAIL / PARTIAL | Legacy validator 19/19 and raw IndexedDB atomicity fixture 5/5 now pass independently; `test_db_atomicity.js` still fails at line 108 because inactive encrypted storage masks its session-only error expectation; current 15-table tests are downstream of #25 and not run |
| Android SAF backup/restore | Real Android document picker and restore | BLOCKED | Requires emulator/device execution |
| Money 2.0 invariants | Exact balances, liability signs, transfer/reversal/undo, no income inflation | NOT RUN | Synthetic scenario required |
| Android instrumentation API 29 | Full suite; exact expected/executed/pass/fail/skip count | NOT RUN | Historical #20 run passed; candidate suite not yet executed |
| Android instrumentation API 34 | Full suite; exact expected/executed/pass/fail/skip count | NOT RUN | Existing workflow does not yet fail on skips/count mismatch; candidate fix pending |
| Android instrumentation API 35 | Full suite including screenshot/lifecycle acceptance | NOT RUN | Prior failure must be resolved and rerun |
| Notification Android acceptance | Optional reminders, permission behavior, restore and tap route | NOT RUN | No architecture change planned |
| Profile/navigation acceptance | Settings persistence, swipe guards, fonts, keyboard, accessibility | NOT RUN | Physical acceptance required |
| Debug APK | Exact candidate SHA, package, version, signer fingerprint, artifact integrity | BLOCKED | No CI run triggered and no APK for this candidate SHA |
| Installed-data update test | Candidate install over disposable prior build; encrypted data retained | BLOCKED | Physical Android update install required |
| Draft candidate PR | Correct base, draft state, exact candidate SHA | BLOCKED | Not opened: candidate is incomplete and mandatory suite fails at #22 |
