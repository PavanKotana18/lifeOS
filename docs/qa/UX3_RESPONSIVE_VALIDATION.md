# UX 3.0 responsive validation

## Layout rules implemented

- Main content has a fluid width bounded by a readable maximum and responsive `clamp()` gutters.
- Primary navigation has its own wider bounded measure and bottom safe-area padding.
- Shell uses `100vh` fallback plus `100dvh`; sheets use available dynamic viewport height and safe-area constraints, scroll internally and do not assume keyboard height.
- Sheets expand to a wider bounded width on large windows. Today/Money/Life reflow to two columns at a logical-width breakpoint. Compact windows reduce gutters and reflow Money quick actions.
- Android may rotate; the manifest no longer forces portrait. Existing `adjustResize` remains.
- No device model, physical pixel resolution or fixed keyboard offset is used.
- System font scaling and theme remain governed by the existing type/theme system.

## Automated layout contract

`test_ux3_responsive_contracts.cjs` checks bounded measures, fluid spacing, dynamic viewport/safe-area styles, sheet constraints, orientation config, gesture-compatible wrapping filters and the absence of device-specific conditions. TypeScript and the Vite production build pass.

## Runtime matrix

| Viewport / state | Logical viewport | Evidence status | What is still needed |
|---|---:|---|---|
| Compact narrow phone | 320 × 640 | Automated contract only | Emulator screenshot and interaction; confirm wrapped actions and bottom nav. |
| Standard phone | 390 × 844 | Automated contract only | Populated and empty captures. |
| Large phone | 432 × 936 | Automated contract only | Confirm bounded reading measure. |
| Landscape / small height | 844 × 390 | Manifest/config verified; no rendered capture | Emulator screenshot, keyboard-open form, navigation reachability. |
| Foldable inner display | 673 × 841 | Layout rule only | Real window-size validation, hinge/folding posture checks. |
| Tablet | 800 × 1280 | Layout rule only | Rendered capture and task-flow validation. |
| Resized / split-screen | 520 × 720 | Layout rule only | Runtime resize during a sheet and scroll. |
| Large text 130% / 200% | — | Native font-scale mapping and launch checks passed on API 29/34/35; no page screenshot | Verify clipping, wrapped actions and field visibility on emulator/device. |
| Theme variants | — | Existing theme/render tests pass; no screenshot | Light, dark and alternate theme visual review. |
| Keyboard open/closed | — | Source contract only | Actual Android numeric/text keyboards and focused-field visibility. |
| Gesture / three-button nav | — | Native inset instrumentation passed on API 29/34/35; no touch recording | Verify edge-back and tab swipe on Android runtime and iQOO. |

Hosted Android instrumentation passed on exact candidate head `e8bd5aabb6327d90ef5c56efe133c3ec81292388` in run [42523767928](https://github.com/PavanKotana18/lifeOS/actions/runs/42523767928): API 29 14/14, API 34 19/19, API 35 19/19, zero failures/skips. It covers native WebView font-scale mapping and system-gesture insets, not visual layouts at the listed viewport sizes. `adb devices -l` returned no connected device and no browser screenshot tooling was available locally. This is not visual acceptance, device support certification or a claim of no overflow. If the PR head advances, use its current linked run from PR #34.
