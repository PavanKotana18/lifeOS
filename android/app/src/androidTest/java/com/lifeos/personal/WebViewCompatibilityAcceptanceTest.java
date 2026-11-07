package com.lifeos.personal;

import android.view.View;
import android.view.WindowManager;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Compatibility acceptance is independent from supported-runtime app acceptance. */
@RunWith(AndroidJUnit4.class)
public class WebViewCompatibilityAcceptanceTest {
    @Test public void chromiumVersionBoundaryRejectsOldAndUnknownEngines() {
        assertEquals(51, WebViewCompatibility.chromiumMajor("Mozilla/5.0 Chrome/51.0.2704.90 Mobile Safari/537.36"));
        assertFalse(WebViewCompatibility.isSupported("Chrome/86.0.1"));
        assertTrue(WebViewCompatibility.isSupported("Chrome/87.0.4280.101"));
        assertTrue(WebViewCompatibility.isSupported("Chrome/131.0.0.0"));
        assertFalse(WebViewCompatibility.isSupported(null));
        assertFalse(WebViewCompatibility.isSupported("unrecognized engine"));
        assertFalse(WebViewCompatibility.isSupported("Chrome/999999999999999999999.0"));
    }

    @Test public void unsupportedEngineShowsNativeUpdateMessage() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicBoolean supported = new AtomicBoolean();
            AtomicBoolean messagePresent = new AtomicBoolean();
            AtomicInteger messageVisibility = new AtomicInteger(-1);
            AtomicInteger webViewVisibility = new AtomicInteger(-1);
            AtomicInteger flags = new AtomicInteger();
            scenario.onActivity(activity -> {
                String userAgent = activity.getBridge().getWebView().getSettings().getUserAgentString();
                supported.set(WebViewCompatibility.isSupported(userAgent));
                View message = activity.getWindow().getDecorView().findViewWithTag(WebViewCompatibility.UPDATE_REQUIRED_TAG);
                messagePresent.set(message != null);
                if (message != null) messageVisibility.set(message.getVisibility());
                webViewVisibility.set(activity.getBridge().getWebView().getVisibility());
                flags.set(activity.getWindow().getAttributes().flags);
            });
            Assume.assumeFalse("Supported runtime: update-message case does not apply", supported.get());
            assertTrue("An unsupported WebView must show native update guidance", messagePresent.get());
            assertEquals(View.VISIBLE, messageVisibility.get());
            assertEquals(View.GONE, webViewVisibility.get());
            assertTrue("Compatibility guidance must preserve screenshot protection",
                (flags.get() & WindowManager.LayoutParams.FLAG_SECURE) != 0);
        }
    }
}
