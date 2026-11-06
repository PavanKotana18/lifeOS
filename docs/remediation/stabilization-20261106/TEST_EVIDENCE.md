# LifeOS functional stabilization — test evidence

## Scope and baseline

- Branch: `fix/lifeos-functional-stabilization-20261106`
- Isolated worktree: `/data/data/com.termux/files/home/lifeos-stabilization-20261106`
- Base commit: `3d05b3720863f9d029c3fa6dbeb4387ea62e5496` (PR #17 QA branch)
- Scope: finance transaction ordering/time preservation, startup system appearance, and permission/onboarding reconciliation after Android settings. Notification scheduling policy, encryption activation, backup formats, and release signing were not changed.

## Focused regressions

Command: `node test_lifeos_stabilization.js`

Result: **PASS — 5/5**

- Finance list ordering uses date plus transaction instant, keeps equal timestamps deterministic, and leaves date-only records with unknown time.
- Disposable Dexie create/edit/read/delete round-trip preserves an entered local transaction time and does not manufacture time for a legacy record.
- Theme bootstrap prefers the native Android appearance before React renders, honors the browser fallback, and preserves explicit theme resolution.
- Permission reconciliation is exercised after the simulated biometric resume succeeds; it reads notification/exact-alarm grants and advances onboarding without invoking authentication or permission prompts itself.
- The exact-alarm settings path persists its onboarding intent before launching the Android settings transition, including when notification display permission is already granted.
- Editing a date-only legacy transaction with the time left blank keeps the original date and does not add `occurredAt`; choosing a date-time persists the selected instant.

Before the finance fix, the production App list comparator was exercised with same-day transactions and returned the date-only tie order (`older,newer`) instead of transaction-time order (`newer,older`). The theme and permission symptoms originated in Android device observations; this environment cannot replay those UI transitions.

## Automated verification

| Command | Result |
|---|---|
| `npm run test:all` | **PASS** — npm test chain and Sentinel; WP0 mandatory controls 11/11; Sentinel suites 6/6. |
| `npm run test:wp0` | **PASS** — harness self-test 137 checks; required WP0 cases 11/11. |
| `node test_lifeos_stabilization.js` | **PASS** — 5/5 focused cases. |
| `npx --no-install tsc --noEmit` | **PASS**. |
| `npm run build` | **PASS** — Vite production bundle completed. |
| `git diff --check` | **PASS**. |

During iteration, `test:all` first exposed that existing WP0 lifecycle fixtures did not inject the newly used production reconciliation helper; the fixture was updated and LOS-003 then passed (18 checks). TypeScript initially caught an appearance string/boolean mismatch, corrected before final checks. No production test failures remain in the final run.

## Android validation boundary

No emulator workflow was run, per instruction. No physical Android UI tests were performed. The native `SystemAppearancePlugin.java` addition and `MainActivity` registration therefore have **not** been compiled by Gradle in this Termux run or verified on device. The PR #17 emulator workflow targets pull requests against its QA branch, so this stabilization publication uses GitHub's `[skip ci]` commit marker to avoid automatically restarting the known stalled emulator job. Consequently, GitHub Actions checks for this PR will be skipped; the local results above are the executed checks, not hosted CI. Permission settings return, Android 16 lifecycle ordering, system theme changes, biometric prompt behavior, and notification delivery still require real-device acceptance.

## Security and data constraints

No encryption activation, cryptographic storage semantics, backup format, signing credentials, private database, or personal record was changed or included. Permission reconciliation only reads grants after resume and requires the existing session/authentication gate; it does not trigger a biometric bypass or issue another permission request.
