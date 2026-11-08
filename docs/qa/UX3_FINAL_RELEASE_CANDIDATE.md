# UX 3.0 final release candidate

Status: **LOCAL GATES PASSED; HOSTED ANDROID ACCEPTANCE PENDING.** No UX 3.0 APK has been generated yet.

## Source and integration

- Protected baseline: `cc39f1484821a4050f067dd34c0d3e5c9f753d64`.
- Integrated UI 2.0 candidate: `2160b2e52c1a2c2082cfb8a0e505c607c692d852`.
- PR #33 base and UX 3.0 starting head: `43dad611d6dee2aa3eaf04b5574e01437b67056e`.
- Branch: `feature/lifeos-ux3-complete-product-experience`.
- Worktree: `/data/data/com.termux/files/home/lifeos-ux3-complete-product-experience`.
- PR #27–#32 and #33 remain open, draft, and unmodified. UX 3.0 is stacked on PR #33; it is not integrated to `main`.
- Final code SHA and draft PR URL will be filled after the isolated branch is committed and published.

## Locally verified

- `npm test`: exit 0; full configured suite passed. Existing sub-suites include actual Dexie/IndexedDB, finance, recurrence, notification source contracts, encryption admission, theme, Settings, UI render and source contracts.
- `npm run test:sentinel`: exit 0; 6/6 suites passed, 0 failed, 0 blocked.
- `npx --no-install tsc --noEmit`: exit 0.
- `npm run build`: exit 0. Main JS 642.61 kB (182.84 kB gzip); FinanceCharts 415.42 kB (112.67 kB gzip). Vite's >500 kB warning remains.
- `git diff --check`: exit 0.
- Navigation gesture helper and wiring contracts, reminder-detail redaction, responsive contracts and UI 2 regressions pass.
- Native Android API matrix, signed artifact and screenshot captures have not yet run for this revision.

## Android acceptance plan

The draft PR should target `feature/lifeos-ui2-final-product-refinement-20261108` (PR #33 head). The emulator workflow is configured to checkout the exact PR head SHA, then run API 29 (14 unattended tests), API 34 (19), API 35 (19), and the two-test API 34 notification isolation job. Any count mismatch, skip, failure or runner crash blocks the candidate.

The push-triggered Android build workflow must produce the signed Debug APK. Verify exact source commit, artifact URL/ID/retention, ZIP integrity, package `com.lifeos.personal`, version metadata, APK SHA-256 and stable debug certificate before recommending installation.

Hosted emulator success does not prove actual iQOO swipe, visual quality, Android keyboard, Recent Apps protection, SAF picker or installed-data update behavior.

## Outstanding physical acceptance

On iQOO Neo 9 Pro / Android 16, install as an update without uninstalling or clearing data; verify tap and left/right swipe navigation, rapid switching/no ghost screens, vertical scrolling, Android edge-back, nested Money state, forms/keyboards, Today/Plan/Life flows, notification deep links, lock/background/Recent Apps privacy, persistence, theme and screen/font scaling. This session has not performed or claimed that test.
