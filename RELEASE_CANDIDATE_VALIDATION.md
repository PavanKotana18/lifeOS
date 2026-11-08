# Release Candidate Validation Matrix

Candidate: `integration/lifeos2-release-candidate-20261108`
Pinned base: `d7882d29d68fa45ac026c1da490b80aa910cd0a0`

Status meanings: PASS = executed successfully on the recorded candidate/stage; FAIL = executed and failed; BLOCKED = required environment/evidence unavailable; NOT RUN = not yet executed. Compiled-only tests are not execution passes.

| Gate | Evidence required | Status | Evidence / blocker |
|---|---|---|---|
| Git ancestry and no duplicate integration | Exact PR SHAs, merge parents, stage ancestry | PASS baseline | #18/#19 join at #20; all #13–#25 ancestry reaches #25 |
| Candidate isolation | New branch/worktree from pinned main; no prior worktree changed | PASS baseline | Clean candidate at pinned base |
| Per-stage focused tests | Relevant npm contracts after each integrated stage | PASS for #13 | `npm test` exit 0 after #13; simulated/native-source and disposable IndexedDB tests |
| Per-stage TypeScript | `npx tsc --noEmit` after each stage | PASS for #13 | Exit 0 after #13 |
| Full npm suite | `npm test` on exact candidate head | NOT RUN | |
| Sentinel | `npm run test:sentinel` on exact candidate head | NOT RUN | |
| Production build | `npm run build` on exact candidate head | NOT RUN | |
| Dexie v1→v2 upgrade | Legacy records/indexes preserved in disposable database | NOT RUN | |
| Encrypted migration safety | Existing ciphertext, plaintext legacy rows, retry/interruption/concurrency | NOT RUN | Physical/installed upgrade still required |
| Backup compatibility | Legacy 11-table and current 15-table validation/round-trip/rollback | NOT RUN | |
| Android SAF backup/restore | Real Android document picker and restore | BLOCKED | Requires emulator/device execution |
| Money 2.0 invariants | Exact balances, liability signs, transfer/reversal/undo, no income inflation | NOT RUN | Synthetic scenario required |
| Android instrumentation API 29 | Full suite; exact expected/executed/pass/fail/skip count | NOT RUN | |
| Android instrumentation API 34 | Full suite; exact expected/executed/pass/fail/skip count | NOT RUN | |
| Android instrumentation API 35 | Full suite including screenshot/lifecycle acceptance | NOT RUN | Prior failure must be resolved and rerun |
| Notification Android acceptance | Optional reminders, permission behavior, restore and tap route | NOT RUN | No architecture change planned |
| Profile/navigation acceptance | Settings persistence, swipe guards, fonts, keyboard, accessibility | NOT RUN | Physical acceptance required |
| Debug APK | Exact candidate SHA, package, version, signer fingerprint, artifact integrity | NOT RUN | Hosted CI required |
| Installed-data update test | Candidate install over disposable prior build; encrypted data retained | BLOCKED | Physical Android update install required |
| Draft candidate PR | Correct base, draft state, exact candidate SHA | NOT RUN | Create after candidate branch push |
