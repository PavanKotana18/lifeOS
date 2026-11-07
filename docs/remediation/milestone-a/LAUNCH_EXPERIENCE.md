# LifeOS launch identity

LifeOS uses the AndroidX SplashScreen API for the system-owned first frame. Its vector mark uses the same locally authored growth-loop emblem as the React header and first-run onboarding lockup; the adaptive launcher icon reuses that mark. Light and night native resources provide coordinated launch surfaces without network assets.

On native cold starts, `LaunchExperience.getLaunchInfo()` identifies a fresh Activity creation. The system splash is held until React has committed the matching brand reveal, then released by the native plugin; a 2.5-second watchdog prevents an indefinitely held system splash. The web reveal then runs for 1.6 seconds and exits only after application startup reports ready or a recoverable error. This ensures the next visible route is the actual onboarding, lock/authentication, recovery, or app destination. Activity resumes do not show the reveal. If launch metadata is unavailable for 700 ms, normal app startup proceeds without the extra reveal. Reduced-motion preference removes the web animation delay, and Android's animator setting controls the native fade.

The launch layer does not authenticate, provision keys, unlock storage, or change screenshot-protection policy. It covers the app until the existing startup state machine is ready. All art is vector/code bundled in the repository and works offline.

Automated evidence covers component rendering, reduced-motion state, cold-only gating, app-readiness gating, AndroidX theme/resource wiring, and onboarding identity. Local Termux does not have Gradle or an emulator, so native compilation and visual timing on Android remain CI/device checks; no device screenshot is claimed by this change.
