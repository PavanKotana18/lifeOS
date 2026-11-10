package com.lifeos.personal;

/** Only debug APKs permit capture, regardless of screen or lifecycle state. */
final class ScreenshotProtectionPolicy {
    private ScreenshotProtectionPolicy() {}

    static boolean shouldProtect(boolean debugBuild, boolean sensitiveScreen,
            boolean activityResumed, boolean compatibilityBlocked, boolean resumeValidationPending) {
        // Keep the bridge/lifecycle inputs compatible with existing callers.
        // They cannot override the policy selected by the Android build variant.
        return !debugBuild;
    }
}
