# LifeOS Feather — Expressive Edition

Project Alive 2.0 uses the existing Soft Ivory, Sage, dark, and custom accent theme values. Its responsive page gutter runs from 16 to 32 CSS px. The shared spacing scale uses 4, 8, 12, 16, 24, and 32 px. Page titles start at 28 px, and the composer action and navigation icon targets are 46 px. Ink, raised groups, accent tint, and semantic focus and error colors come from the active palette.

## Screens and controls

| Area | Shared treatment |
| --- | --- |
| Today | A page title and highlighted focus area establish priority. Agenda, habit, and money summaries use spacing instead of surrounding panel outlines. |
| Money | Cash flow carries the primary tint. Destinations share button geometry, and Activity, Accounts, Budgets, Savings, Insights, and Scheduled share the same detail header. Dense transaction separators are retained. |
| Plan | Tasks, Habits, and Goals share the destination selector and primary action styling. Task rows drop routine chevrons. Goal details show the selected goal and its actions without re-rendering the list filters above it. |
| Profile | The existing top-left avatar opens the full-height surface from the right. Home and nested settings use a single Back control and the same header. Identity is highlighted through surface tint. Settings keep meaningful group boundaries. |
| Scheduled | Upcoming and recurring commitments lead the reading order. The next due item is distinct from the rest of the timeline. Forecast follows the list. Recurring, History, and Exchange rates preserve their individual data and actions. |
| Composers | Task, Habit, Goal, transaction, budget, savings, account, transfer, planned commitment, and exchange-rate create/edit routes share ComposerShell. Short contribution, milestone, and progress edits use its sheet variant. |

`FeatherHeader` provides a semantic heading, a labeled Back action, and an optional contextual control. `ComposerShell` supplies a leading field treatment, scrollable body, inline validation, and a safe-area-aware action rail. The viewport hook adjusts to the available visual viewport, keeps focused fields visible, and restores focus on close. Saving disables Close, Cancel, and Submit. Styled primitives and existing preference groups, sheets, progress indicators, doodles, toasts, InfoTip, and ConfirmationDialog carry the same theme values, focus states, and existing interaction behavior.

## Motion and diagnosis

The baseline browser trace reproduced cold navigation plateaus after rapid input dispatch. Its Today→Money click waited 0.5 ms for dispatch but took 224 ms through the next paint. React's click path occupied about 26 ms. Two long animation frames lasted 105 and 107 ms. Only 0.4 ms of forced layout was attributed to the click script. The baseline also performed 23–24 browser layouts per Money→Plan sample, and the content and pill were driven by independent animation paths. These measurements show presentation stalls after the tap and redundant layout work during Plan movement. The source identifies separate animation clocks and first-destination preparation on the interaction path. The browser trace cannot identify the exact cause inside the owner's Android WebView.

The primary route retains visited surfaces, prepares Money and Plan during idle time, and caches the stage bounds outside the ordinary tap path. The incoming route, outgoing route, and selection pill share a single start time and a critically damped curve. Existing touch resistance and speed feed the same route transition. Reversals use the current visible poses, and obsolete callbacks cannot settle a new navigation. Reduced motion skips travel. Composers use one directional entrance and reverse dismissal. Existing disclosure, pressed, completion, progress, and confirmation feedback remains tied to the control or actual record state.

## Review evidence

The evidence directory is `%LOCALAPPDATA%/LifeOS/checkpoints/project-alive-2`. Open `compare-screens.html` for the nine matched phone-size views and `compare-motion.html` for captured intermediate frames, scrubbing, and playback. Raw acceptance reports contain composer geometry. Motion JSON contains Event Timing, React commits, rendering-frame samples, browser layouts, layout shifts, and compositor capture timestamps. `PROJECT_ALIVE_2_BASELINE.md` inventories the preceding app and its rendered screens.

Browser runs use synthetic fixtures. Android runtime verification requires sufficient host virtual memory. Physical-device feel and owner acceptance remain separate from browser verification.
