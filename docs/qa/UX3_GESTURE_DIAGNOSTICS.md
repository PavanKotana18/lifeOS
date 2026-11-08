# UX 3.0 gesture diagnostics

## Confirmed report and source diagnosis

The user physically confirmed that primary-tab swiping fails on the iQOO Neo 9 Pro running Android 16. That remains a physical-device finding; this session did not capture its WebView event stream.

At the audited PR #33 source, pointer handlers were attached to `<main>` and called `setPointerCapture`, but the gesture surface had no `touch-action` policy. There was also an `overflow-x-auto` transaction filter inside the same surface. Android WebView/browser arbitration is therefore a plausible root cause for `pointercancel` or lost horizontal ownership, but it has not been proven on the user's device.

## Implemented event lifecycle

One React surface owns `pointerdown`, `pointermove`, `pointerup`, `pointercancel` and `lostpointercapture`.

- `.app-main` declares `touch-action: pan-y` before gesture start: browser retains vertical scrolling while the app may process horizontal motion.
- The transaction-type filter wraps rather than competing for horizontal scrolling.
- Pointer ID is fixed at start; secondary pointers cancel and suppress the sequence.
- The axis locks after intent is clear. Vertical intent stays with scrolling; later horizontal wobble cannot take ownership.
- Horizontal movement follows near finger-speed and is limited by 42% of the current logical viewport width.
- Resize, blur, backgrounding, browser cancellation, lost capture and multi-touch clear any drag state.
- Inputs, buttons, text fields, dialogs, settings, charts/SVG, sliders, marked horizontal controls and Android system-edge regions do not initiate a tab swipe.
- Native edge insets are queried from `WindowInsets.Type.systemGestures()` on API 30+, with API 29 `getSystemGestureInsets()` fallback and CSS safe-area fallback. Native pixels are converted to density-independent units.
- The current page is the only painted route. A committed swipe switches to an opaque destination; canceled gestures settle the current page back. Inactive content is hidden, inert and `aria-hidden`.
- A navigation ID prevents stale transition callbacks from settling a newer destination. Reduced motion skips decorative animation and immediately changes state.

## Diagnostics privacy

`recordGestureTrace()` only records in development and stores at most 40 events in memory. Fields are event type, pointer ID, rounded deltas, axis/state, cancellation reason and navigation decision. It has no API parameter for target text, account values, record IDs, notes or form data. Production passes `import.meta.env.DEV` as the enable flag.

## Automated evidence

`test_navigation_gestures_20261108.cjs` checks tab boundaries/direction, short/fast gestures, axis lock, wrong pointer, scroll ownership, disabled preference, viewport-relative drag limit and bounded/redacted trace behavior. `tests/ui-navigation-foundations.test.cjs` checks event wiring, exclusions, native edge use, lock behavior, screen visibility, transition lifecycle and scroll restoration. `SystemGestureInsetsAcceptanceTest` checks the native inset object from a real activity window and pixel-to-dp conversion on emulator.

These tests do not emulate a human swipe on the iQOO. `adb devices -l` returned no connected device. The acceptance gate remains **REQUIRES PHYSICAL DEVICE** until the user confirms a left/right swipe on that exact device and checks that vertical scroll and Android edge-back remain independent.
