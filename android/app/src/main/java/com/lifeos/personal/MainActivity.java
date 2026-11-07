package com.lifeos.personal;

import android.os.Bundle;
import android.animation.ValueAnimator;
import android.os.Handler;
import android.os.Looper;
import android.content.res.Configuration;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.TextView;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    private boolean coldLaunch;
    private volatile boolean keepLaunchSplash;
    private boolean sensitiveScreen = true;
    private boolean activityResumed = false;
    private boolean webViewCompatibilityBlocked = false;
    private boolean resumeValidationPending = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Save notification taps before Capacitor or React initialize. The native
        // plugin keeps this action until the authenticated JS router acknowledges it.
        NotificationTapLaunchPlugin.captureAction(this, getIntent());
        coldLaunch = savedInstanceState == null;
        keepLaunchSplash = coldLaunch;
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> keepLaunchSplash);
        splashScreen.setOnExitAnimationListener(provider -> {
            if (!ValueAnimator.areAnimatorsEnabled()) {
                provider.remove();
                return;
            }
            provider.getView().animate().alpha(0f).setDuration(180L)
                .withEndAction(provider::remove).start();
        });
        if (coldLaunch) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> keepLaunchSplash = false, 2500L);
        }
        registerPlugin(BiometricAuthPlugin.class);
        registerPlugin(LifeOSCryptoPlugin.class);
        registerPlugin(LifeOSBackupPlugin.class);
        registerPlugin(NotificationSettingsPlugin.class);
        registerPlugin(StorageAccessPlugin.class);
        registerPlugin(SystemAppearancePlugin.class);
        registerPlugin(ScreenCaptureProtectionPlugin.class);
        registerPlugin(LaunchExperiencePlugin.class);
        registerPlugin(NotificationTapLaunchPlugin.class);
        registerPlugin(RuntimeInfoPlugin.class);
        super.onCreate(savedInstanceState);

        // Start protected for every build. Debug UI may opt into screenshots only
        // after React confirms that the visible surface contains no secrets.
        applyScreenshotProtection();
        applySystemFontScale();
        showWebViewUpdateIfRequired();
    }

    @Override
    public void onNewIntent(android.content.Intent intent) {
        setIntent(intent);
        android.content.Intent notificationAction = new android.content.Intent(intent);
        super.onNewIntent(intent);
        NotificationTapLaunchPlugin.captureAction(this, notificationAction);
    }

    public boolean isColdLaunch() {
        return coldLaunch;
    }

    public void releaseLaunchSplash() {
        keepLaunchSplash = false;
    }

    static int webTextZoomForFontScale(float fontScale) {
        if (Float.isNaN(fontScale) || Float.isInfinite(fontScale) || fontScale <= 0f) return 100;
        return Math.round(fontScale * 100f);
    }

    private void applySystemFontScale() {
        if (bridge == null || bridge.getWebView() == null) return;
        float fontScale = getResources().getConfiguration().fontScale;
        bridge.getWebView().getSettings().setTextZoom(webTextZoomForFontScale(fontScale));
    }

    public void setSensitiveScreen(boolean sensitive) {
        if (!sensitive && resumeValidationPending) {
            // A stale pre-background JS update cannot unlock screenshots after resume.
            sensitiveScreen = true;
            applyScreenshotProtection();
            return;
        }
        sensitiveScreen = sensitive;
        applyScreenshotProtection();
    }

    public void confirmResumeValidation() {
        if (!activityResumed) return;
        resumeValidationPending = false;
        sensitiveScreen = true;
        applyScreenshotProtection();
    }

    private void applyScreenshotProtection() {
        boolean secure = ScreenshotProtectionPolicy.shouldProtect(
            isDebuggableVariant(), sensitiveScreen, activityResumed, webViewCompatibilityBlocked,
            resumeValidationPending);
        if (secure) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }

    private boolean isDebuggableVariant() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private void showWebViewUpdateIfRequired() {
        if (bridge == null || bridge.getWebView() == null) return;
        WebView webView = bridge.getWebView();
        if (WebViewCompatibility.isSupported(webView.getSettings().getUserAgentString())) return;
        webViewCompatibilityBlocked = true;
        applyScreenshotProtection();

        // This is a compatibility message, never an authenticated app surface.
        // Native views work even when the packaged JavaScript cannot be parsed.
        webView.stopLoading();
        webView.setVisibility(android.view.View.GONE);
        TextView message = new TextView(this);
        message.setTag(WebViewCompatibility.UPDATE_REQUIRED_TAG);
        message.setText("Update your Android web component\n\nLifeOS needs a newer Android System WebView or Chrome. Update it from your device's app store, then reopen LifeOS.");
        message.setTextSize(18);
        message.setTextColor(Color.WHITE);
        message.setBackgroundColor(Color.rgb(9, 13, 22));
        message.setGravity(Gravity.CENTER);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        message.setPadding(padding, padding, padding, padding);
        addContentView(message, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void notifyWebTheme(Configuration configuration) {
        if (bridge == null || bridge.getWebView() == null) return;
        int nightMode = configuration.uiMode & Configuration.UI_MODE_NIGHT_MASK;
        if (nightMode != Configuration.UI_MODE_NIGHT_YES && nightMode != Configuration.UI_MODE_NIGHT_NO) return;
        boolean dark = nightMode == Configuration.UI_MODE_NIGHT_YES;
        String script = "window.lifeosSystemDark=" + dark + ";window.dispatchEvent(new CustomEvent('lifeos:system-appearance',{detail:{dark:" + dark + "}}));";
        final WebView webView = bridge.getWebView();
        webView.post(() -> {
            // Activity recreation can destroy the queued view before dispatch.
            if (isFinishing() || isDestroyed() || bridge == null || bridge.getWebView() != webView) return;
            if (webView.getVisibility() != android.view.View.VISIBLE) return;
            webView.evaluateJavascript(script, null);
        });
    }

    private void notifyScreenshotPolicyRefresh() {
        if (bridge == null || bridge.getWebView() == null) return;
        final WebView webView = bridge.getWebView();
        webView.post(() -> {
            if (isFinishing() || isDestroyed() || bridge == null || bridge.getWebView() != webView) return;
            if (webView.getVisibility() != android.view.View.VISIBLE) return;
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('lifeos:activity-resumed'))", null);
        });
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applySystemFontScale();
        notifyWebTheme(newConfig);
    }

    @Override
    public void onResume() {
        // Keep the window protected until JS re-evaluates the current screen.
        activityResumed = true;
        sensitiveScreen = true;
        applyScreenshotProtection();
        super.onResume();
        notifyScreenshotPolicyRefresh();
        notifyWebTheme(getResources().getConfiguration());
    }

    @Override
    public void onPause() {
        activityResumed = false;
        sensitiveScreen = true;
        resumeValidationPending = true;
        applyScreenshotProtection();
        super.onPause();
    }
}
