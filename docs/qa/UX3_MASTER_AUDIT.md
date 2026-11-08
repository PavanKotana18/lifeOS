# UX 3.0 master audit

## Baseline and scope

- Repository: `PavanKotana18/lifeOS`.
- Protected main: `cc39f1484821a4050f067dd34c0d3e5c9f753d64` (verified as ancestor of the candidate).
- UX 2 integrated candidate: `2160b2e52c1a2c2082cfb8a0e505c607c692d852`.
- PR #33 head and UX 3 branch base: `43dad611d6dee2aa3eaf04b5574e01437b67056e`.
- Work branch: `feature/lifeos-ux3-complete-product-experience`.
- Existing worktree: `/data/data/com.termux/files/home/lifeos-ux3-complete-product-experience`.
- PR #27–#32 are open drafts stacked in order; #33 is an open draft on the integrated candidate. The exact refs were re-fetched before this audit. No old PR was merged or edited.
- Several unrelated worktrees were already dirty or conflicted before this work. They remain untouched; see the session inventory. The UX 3 worktree was clean when created.

## Runtime and architecture

Verified from `package.json`, `vite.config.ts`, `capacitor.config.ts` and Android Gradle configuration: React 18.3, TypeScript 5.6, Vite 6, Capacitor 6, Dexie 4, Recharts 2.13; Android min SDK 29, target SDK 34, application ID `com.lifeos.personal`. The project has no dedicated animation or gesture library. Tests are custom Node scripts plus native Android instrumentation; no browser automation dependency is installed. `adb devices -l` found no connected device.

```text
main.tsx
  ├─ appearance bootstrap / native splash handoff
  └─ App.tsx (large application shell and domain orchestration)
       ├─ primary nav: Today / Money / Plan / Life
       ├─ secondary screen state: transactions, accounts, budgets, savings,
       │  financial planning, analytics, planner, habits, goals, insights,
       │  Profile and Settings
       ├─ RetainedScreen.tsx + uiNavigation.ts (screen lifecycle/scroll keys)
       ├─ navigationGestures.ts (pure gesture classification)
       ├─ data selectors from Dexie-backed StorageService in db.ts
       ├─ domain calculations in finance/domain services and domainUtils.ts
       ├─ theme/settings services and profile components
       └─ native Capacitor plugins for auth, secure storage, notifications,
          backup/document access, screenshots and system appearance
```

The screen state, form state, modal state, navigation, data loading and much of the rendered UI are currently coordinated in `src/App.tsx` (about 2,776 lines, 29 `useState`, 17 `useEffect`, 219 JSX event props at the audited head). The shared stylesheet is `src/index.css` (689 lines). There is no `src/hooks` directory. This is confirmed code structure, not a judgment that every state should be extracted.

## Screen and journey inventory

| Destination | User intention / primary action | Secondary routes and state | Key data and safe source |
|---|---|---|---|
| Today | See today’s priorities; complete or add a task | Customizable sections, habits, money snapshot, future tasks; links to Plan/Life/Money | Today selectors and `todayLayout.ts`; tasks, habits, goal and finance selectors in App |
| Money | Understand recorded cash flow; add expense, income or transfer | Transactions, accounts, budgets, savings, planning, analytics; transaction/account/transfer forms | `MoneyHome.tsx`, `MoneyAccounts.tsx`, `MoneyPlanning.tsx`, `FinanceCharts.tsx`; finance services remain authoritative |
| Plan | See what to do next; add/complete/open task | Date ranges, full planner, calendar, search/filter, detail and recurrence/reminder fields | `PlanHub.tsx`, planner JSX in App, recurrence/reminder domain services |
| Life | Check in to habits and review longer-term goals | Habit list/history, goal status filters, milestones, insights | `LifeHub.tsx`, habits/goals/milestone JSX in App, domain calculations |
| Profile/Settings | Set identity, appearance, preferences, notification choices, privacy, backup and about | Profile landing and individual sections with back handling | `ProfileSettings.tsx`, `ProfilePreferences.tsx`, other settings JSX in App |
| Onboarding / security | Establish profile and secure private storage | Secure setup, recovery, lock/unlock, first-record security | `Onboarding.tsx`, security dialogs, auth/session/encryption services; protected logic is out of UX scope |

Most create/edit flows use the shared `createKind` form sheet in App; account and transfer sheets live in `MoneyAccounts.tsx`; destructive confirmations use `ConfirmationDialog.tsx`. Finance charts are lazy-loaded. The launch path applies cached/system theme before React and releases the native splash after the startup-ready handshake. Notification taps are captured natively before React initialization and handed to the authenticated router.

## Confirmed findings before changes

1. **Swipe ownership is underspecified in CSS.** Pointer handlers are attached to `<main>` in `App.tsx`; the gesture service classifies direction and the handler calls pointer capture. There is no `touch-action: pan-y` rule for the gesture surface in `index.css`; only controls use `touch-action: manipulation`. This is a code-level defect consistent with Android WebView cancelling pointer streams during browser panning. The exact on-device event trace has not been captured because no Android device is connected. See `UX3_GESTURE_DIAGNOSTICS.md`.
2. **The retained transition stack can show unrelated content through itself.** `RetainedScreen.tsx` retains outgoing and incoming screens in one CSS grid cell; CSS gives them transparent backgrounds and uses `.92` opacity for both entry/exit. The exiting view is deliberately still paintable. This explains how text can overlap; the report does not claim a captured device frame.
3. **Today repeats task information.** App renders focus counts, a Today’s Agenda list, and a separate Coming up list, while the Plan hub also presents open tasks. The initial Today layout shows focus, agenda, habits, money and upcoming by default. This is a confirmed information-architecture source of repetition.
4. **Global and screen headings repeat.** The sticky global header shows a time-based greeting and current-tab subtitle; each primary screen then renders its own title/header. This creates competing heading levels and consumes first-viewport space.
5. **Task reminder troubleshooting exposes implementation fields.** The task detail JSX renders raw diagnostic fields and exact notification IDs/timestamps after “Diagnose reminder”; this is the confirmed source of developer-like content. The underlying notification scheduling behavior is out of scope.
6. **Content width is constrained to a phone-sized measure.** The app header is `max-w-xl`, primary `<main>` and bottom nav are `max-w-md`; this limits larger/foldable/tablet layouts. Android `MainActivity` has `screenOrientation="portrait"`, preventing landscape acceptance.
7. **Some horizontal controls rely on overflow scrolling.** These need explicit gesture ownership or a responsive wrapping layout before a primary-tab swipe surface can reserve horizontal motion.

## UX principles and scope guardrails

- Today answers “What needs my attention today?”; Money answers “What have I recorded and what is my financial position?”; Plan answers “What should I do next?”; Life answers “How are my routines and goals progressing?”
- Put one clear primary action and the essential information first; disclose advanced or secondary tools on demand.
- Keep current colors, theme choices, typography identity, Settings behavior, and all domain/storage/native security semantics.
- Do not change database schemas, finance calculations, encryption, authentication, backup format, reminder delivery, package ID or signing.
- Responsive layout must follow available width/height and text size, not device model or physical pixel dimensions.

## Validation environment and initial status

- `adb devices -l`: no connected devices. No physical-device, local Android runtime, browser screenshot, or local visual capture has been performed.
- Android CI is configured to run when a draft refinement PR targets PR #33's source branch. Every Android job checks out the exact PR head SHA and validates the revised 21-test instrumented inventory.
- Current candidate CI evidence before UX 3: build and Android emulator QA succeeded on integrated candidate SHA `2160b2e...`; those results do not validate PR #33 or UX 3.
- Automated source tests already include navigation threshold tests and integration assertions, but the gesture suite tests a pure resolver and source patterns; it does not drive real Android touch input.

## Corrections made after the audit

- `src/App.tsx`, `src/index.css`, `src/services/navigationGestures.ts`, `src/services/uiNavigation.ts` and `src/components/RetainedScreen.tsx` now use one explicit primary pointer owner, vertical-scroll touch policy, viewport-relative drag, pointer identity/axis lock/cancellation, and a single painted screen. `Money` alone opts into inactive DOM retention because its account/planning forms own local draft flags; Today, Plan and Life unmount while App-owned filters/preferences and scroll keys remain.
- `android/app/src/main/java/com/lifeos/personal/RuntimeInfoPlugin.java` exposes only Android system gesture insets converted from pixels to dp. `SystemGestureInsetsAcceptanceTest.java` checks conversion and activity-window availability. `AndroidManifest.xml` no longer locks orientation.
- Today now defaults to immediate tasks/habits and keeps existing customization/order persistence. The shell no longer repeats a global greeting/subtitle. Today task rows open details and complete directly.
- Task reminder help now presents plain-language status without displaying internal notification IDs. Scheduling and task persistence remain unchanged.
- Money removes a savings contribution action when there are no savings goals to fund, keeps the action beside actual goals, and discloses secondary destinations. Plan and Life remove duplicate/ambiguous row actions without changing domain logic.
- The emulator workflow now runs for a draft PR targeting the PR #33 source branch, checks out the exact PR head SHA in each job, and expects the revised 21-test Android inventory (API 29: 14, API 34/35: 19; notification isolation: 2).

## Verified local evidence

- `npm test`: passed after updating only presentation assertions that expected the previous UI labels/placement.
- `npm run test:sentinel`: all 6 suites passed, 0 failed, 0 blocked.
- `npx --no-install tsc --noEmit`: passed.
- `npm run build`: passed; main bundle warning remains at 642.61 kB (182.84 kB gzip), with charts split to a 415.42 kB (112.67 kB gzip) chunk.
- Focused navigation, gesture, task-detail privacy, responsive contract, finance, encryption, backup, notification and screenshot-policy tests passed.
- Hosted Android emulator QA passed on implementation commit `ffe8666857907fdec4ed2754747fe781ee6d37b4`: API 29 14/14, API 34 19/19 and API 35 19/19, with zero failures, skips or runner errors. The API 29 recovery preflight passed 1/1; all three API 34 notification-isolation attempts passed 2/2; API 34 smoke passed 19/19. The added native inset/font-scale tests executed on the emulator matrix.
- No successful-screen screenshots, emulator UI walkthrough video, or actual iQOO touch interaction were captured. Emulator instrumentation verifies native lifecycle/insets and smoke paths, not swipe recognition, page layout quality, keyboard appearance or visual smoothness.
- No screenshot/video or actual iQOO interaction was captured. Swipe, keyboard, landscape, large text, real recent-apps privacy and visual composition still require runtime/device evidence.

## Audit disposition

The source audit and locally executable validation are complete; they do not establish visual or physical-device acceptance. Findings and closure evidence are tracked in `UX3_ISSUE_REGISTER.md`; viewport status is in `UX3_RESPONSIVE_VALIDATION.md`; heuristic paths are in `UX3_USABILITY_WALKTHROUGHS.md`; the exact artifact and CI state remain in `UX3_FINAL_RELEASE_CANDIDATE.md`.
