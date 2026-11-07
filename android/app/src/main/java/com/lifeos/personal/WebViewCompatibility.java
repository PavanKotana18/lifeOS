package com.lifeos.personal;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Matches the Chrome 87 baseline emitted by the Vite build. Android API level
 * alone does not identify the independently updated WebView engine. */
final class WebViewCompatibility {
    static final int MINIMUM_CHROMIUM_MAJOR = 87;
    static final String UPDATE_REQUIRED_TAG = "lifeos-webview-update-required";
    private static final Pattern CHROMIUM_VERSION = Pattern.compile("Chrome/(\\d+)(?:\\.|\\s|$)");

    static int chromiumMajor(String userAgent) {
        Matcher match = CHROMIUM_VERSION.matcher(userAgent == null ? "" : userAgent);
        if (!match.find()) return 0;
        try { return Integer.parseInt(match.group(1)); }
        catch (NumberFormatException ignored) { return 0; }
    }

    static boolean isSupported(String userAgent) {
        return chromiumMajor(userAgent) >= MINIMUM_CHROMIUM_MAJOR;
    }

    private WebViewCompatibility() {}
}
