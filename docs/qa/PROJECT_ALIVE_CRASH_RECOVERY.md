# Project Alive crash recovery

## Preserved state

- Worktree is `C:/Users/kotan/Dev/lifeOS-project-alive`, on `feature/project-alive-20261120`. Recovered HEAD was `06119e7bb84192b41f4b4bb1cb6681e51cd9fadf`. No staged files were pending. The branch had no corresponding GitHub ref or Actions run.
- GitHub reported `main` at `20d2a58ba9b1e7e13b9d802d0e8b9a31c00da000` and `feature/lifeos-product-maturity-2` at `a1a3c1b9acdfbc63497a6a4b62f1108a3ac906cb`. The last build on that upstream branch was [run 44472512408](https://github.com/PavanKotana18/lifeOS/actions/runs/44472512408). It predates the owner APK and Project Alive.
- Local commits recovered were `06119e7` (diagnosis and prototype), `72c3fde` (browser recovery harness fix), `003ce4c` (Motion 3.0 APK source), and `5b3c7bd` (atomic planned commitment recording). The refs `checkpoint/project-alive-before-crash-recovery` and `checkpoint/project-alive-motion-3` retain the two starting points.
- The checkpoint directory `%LOCALAPPDATA%/LifeOS/checkpoints/project-alive/crash-recovery-153427` contains byte-for-byte copies, SHA-256 hashes, separate staged and unstaged patches, status and reflog. Recovered modifications were `App.tsx`, `AliveDisclosure.tsx`, `MoneyPlanning.tsx`, `ProfilePreferences.tsx`, `RetainedScreen.tsx`, `index.css`, and `aliveMotion.ts`. Untracked files were `AliveDetailDialog.tsx`, `TaskComposerOptions.tsx`, and `useAliveNavigation.ts`. All ten survived. TypeScript and diff whitespace checks passed on retrieval. The separate `lifeOS-dev` checkout and all other linked worktrees were preserved.

## Work at interruption

| Work | Status at recovery | Evidence |
| --- | --- | --- |
| Motion 3.0 baseline diagnosis | COMPLETE | Source inspection and synthetic-data production browser traces on the recovered APK-equivalent application source |
| Motion library research | COMPLETE | Sources and tradeoffs in PROJECT_ALIVE.md |
| New architecture prototype | COMPLETE | `06119e7` and real capture workflows |
| Before/after comparison | COMPLETE for browser prototype | Thirteen paired sequences and six warm tab trials per version |
| Performance instrumentation | IN PROGRESS | rAF, native Chrome compositor images, long tasks, layout shifts, heap, and React commit counts recorded. Physical display latency and native traces remain open. |
| Navigation engine | IN PROGRESS | Coordinator and direct-drag handoff recovered. Browser interruption QA pending. |
| Microinteractions | IN PROGRESS | Indicator, press, checkbox draw and disclosure recovered. Broader feedback missing. |
| Create Task | IN PROGRESS | Title-first option tiles and animated detail panels recovered. Keyboard, recurrence and error-flow testing pending. |
| Plan | IN PROGRESS | Completion glyph recovered. Habit, goal and detail choreography pending. |
| Money Scheduled | IN PROGRESS | Featured next item, timeline and browse dialog recovered. Runtime and accounting regression tests pending. |
| Original doodles | NOT STARTED | No doodle component at the recovered checkout. |
| Android QA | IN PROGRESS | Prior emulator boot/install attempt failed. Recovery baseline smoke below. |

## Crash evidence and workload order

- VS Code logged `CodeWindow: renderer process gone (reason: oom)` at 15:28:45 IST on November 20. Windows resource exhaustion event 2004 at 15:28:42 listed the headless Android emulator at 4,276,789,248 bytes of virtual memory. The earlier 15:08 event listed the first emulator at 3,921,592,320 bytes. VS Code has other OOM renderer entries on November 19. The extension host in the latest event exited with code zero. Crashpad preserved a corresponding dump. The logs identify a renderer allocation failure during system memory pressure.
- The host had about 0.55 GiB of free physical memory and 0.58 GiB free virtual memory while the AVD ran. C: had about 137 GiB free. Emulator, browser suites and Gradle are run sequentially. No system configuration changes were made.
- The dedicated API 34 AVD booted on the second attempt using hardware GPU and two cores. Its WebView was 113.0.5672.136. Window and transition animation scales were 1.0, animator duration scale was unset, and accessibility was disabled. The existing signed Motion 3.0 APK installed and cold-launched, package version 1000002. Window flags showed SECURE and hardware acceleration. Baseline PSS was 87,240 KiB at that snapshot. Native launch took 10,784 ms on the memory-constrained host. The AVD was then shut down without clearing data. Native visual acceptance remains open.
