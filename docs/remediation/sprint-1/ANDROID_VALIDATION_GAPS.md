# Android validation gaps

Branch `fix/lifeos-security-data-sprint1-20261106`. Parent / published WP0 commit `370a445f19c843abe42b7d6450d4d521bbb07824`; audited main `d7882d29d68fa45ac026c1da490b80aa910cd0a0`. Tests ran on the uncommitted sprint patch; `evidence/source-sha256.json` identifies exact reviewed bytes. The final source commit is the PR head. No merge or release is performed.

**No hardware or emulator tests performed; no local Android build.** Supported Gradle/SDK/emulator tooling is unavailable in this Termux setup and was not installed. GitHub compilation after push is a separate check and never substitutes for physical Keystore/biometric behavior.

Follow `docs/testing/WP0_ANDROID_TEST_PLAN.md` in a disposable SDK/JDK build environment. The plan's baseline pins are historical setup guidance, not newly installed dependencies or a current Play release recommendation. New native `verifyRecoveryRecord` and prompt ownership code require particular review.

Required before enabling WP3 or treating WP1 fully resolved:

1. Compile debug/test APK with reviewed real dependencies; verify registered proof API and resolved loggingBehavior none. Check live PR Actions status.
2. Real strong-biometric setup/unlock/resume with Activity already resumed/deferred, cancel/destroy/stop, concurrent retries, vendor transient UI and process recreation. No forced authentication success.
3. Existing encrypted fixture + actual saved kit: missing/permanently invalidated alias, wrong/corrupt/wrong-database kit; normal decrypt blocked in quarantine; proof before rebind; healthy wrapper refusal; successful restart unlock after rebind.
4. Inject wrapper/recovery SharedPreferences commit failure, interruptions and app stop during proof/auth/rebind. Demonstrate recoverability without erasing data or silently generating a DEK. Current UI intentionally leaves encrypted data opening gated.
5. Real WebView IndexedDB restore rollback/quota/process kill; explicit legacy conversion with native/browser picker; actual32MiB/native IO and low-memory limits. File.text/WebCrypto support across supported WebView versions.
6. Debug/release synthetic-marker logcat absence, secure-window handling, pending/delivered alarms/reboot/privacy (remaining WP4), foreground/back interactions.

Do not invalidate keys, clear app data or install test APKs over any personal installation. Use an explicitly selected fresh emulator/dedicated device. Record SHA/artifact hash/API/WebView/certificate and sanitized outcomes only, never kits, plaintext DBs, keys or broad raw logcat. Retain LOS-003-ANDROID BLOCKED until evidence exists.
