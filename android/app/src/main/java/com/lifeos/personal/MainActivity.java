package com.lifeos.personal;

import android.os.Bundle;
import android.content.res.Configuration;
import android.view.View;
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
        applyScreenshotProtection();
        super.onCreate(savedInstanceState);
    }

    private void applyScreenshotProtection() {
        // Only debug APKs permit capture. Release windows, including recent-app
        // previews, stay protected for the entire Activity lifecycle.
        if (BuildConfig.DEBUG) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }

    private void notifyWebTheme(Configuration configuration) {
        if (bridge == null || bridge.getWebView() == null) return;
        int nightMode = configuration.uiMode & Configuration.UI_MODE_NIGHT_MASK;
        if (nightMode != Configuration.UI_MODE_NIGHT_YES && nightMode != Configuration.UI_MODE_NIGHT_NO) return;
        boolean dark = nightMode == Configuration.UI_MODE_NIGHT_YES;
        String script = "window.lifeosSystemDark=" + dark + ";window.dispatchEvent(new CustomEvent('lifeos:system-appearance',{detail:{dark:" + dark + "}}));";
        View webView = bridge.getWebView();
        webView.post(() -> bridge.getWebView().evaluateJavascript(script, null));
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        notifyWebTheme(newConfig);
    }

    @Override
    public void onResume() {
        super.onResume();
        applyScreenshotProtection();
        notifyWebTheme(getResources().getConfiguration());
    }
}
