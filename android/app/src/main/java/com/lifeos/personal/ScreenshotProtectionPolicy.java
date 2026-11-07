package com.lifeos.personal;

/** Pure policy for screenshot visibility; release builds are always protected. */
final class ScreenshotProtectionPolicy {
    private ScreenshotProtectionPolicy() {}

    static boolean shouldProtect(boolean debugBuild, boolean sensitiveScreen,
            boolean activityResumed, boolean compatibilityBlocked, boolean resumeValidationPending) {
        return !debugBuild || sensitiveScreen || !activityResumed || compatibilityBlocked || resumeValidationPending;
    }
}
