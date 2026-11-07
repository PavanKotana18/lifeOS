package com.lifeos.personal;

import static org.junit.Assert.assertEquals;

import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class SystemFontScaleAcceptanceTest {
    @Test
    public void androidFontScaleMapsToWebViewTextZoom() {
        assertEquals(100, MainActivity.webTextZoomForFontScale(1f));
        assertEquals(135, MainActivity.webTextZoomForFontScale(1.35f));
        assertEquals(200, MainActivity.webTextZoomForFontScale(2f));
        assertEquals(100, MainActivity.webTextZoomForFontScale(0f));
        assertEquals(100, MainActivity.webTextZoomForFontScale(Float.NaN));
    }

    @Test
    public void launchedWebViewUsesCurrentAndroidFontScale() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                WebView webView = activity.getBridge().getWebView();
                assertEquals(MainActivity.webTextZoomForFontScale(
                        activity.getResources().getConfiguration().fontScale),
                    webView.getSettings().getTextZoom());
            });
        }
    }
}
