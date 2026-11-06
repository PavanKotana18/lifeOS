package com.lifeos.personal;

import android.os.Bundle;
import android.content.res.Configuration;
import android.graphics.Color;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.TextView;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BiometricAuthPlugin.class);
        registerPlugin(LifeOSCryptoPlugin.class);
        registerPlugin(LifeOSBackupPlugin.class);
        registerPlugin(NotificationSettingsPlugin.class);
        registerPlugin(StorageAccessPlugin.class);
        registerPlugin(SystemAppearancePlugin.class);
        super.onCreate(savedInstanceState);

        // Prevent screenshots, screen recording and sensitive recent-app previews.
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        showWebViewUpdateIfRequired();
    }

    private void showWebViewUpdateIfRequired() {
        if (bridge == null || bridge.getWebView() == null) return;
        WebView webView = bridge.getWebView();
        if (WebViewCompatibility.isSupported(webView.getSettings().getUserAgentString())) return;

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

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        notifyWebTheme(newConfig);
    }

    @Override
    public void onResume() {
        super.onResume();
        notifyWebTheme(getResources().getConfiguration());
    }
}
