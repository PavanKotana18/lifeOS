package com.lifeos.personal;

import android.util.Log;
import androidx.test.core.app.ActivityScenario;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

/** Diagnostics contain runtime metadata only, never app text, records or keys. */
final class WebViewTestSupport {
    static void checkpoint(String phase) {
        Log.i("LifeOSAcceptance", phase);
    }

    static String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        AtomicReference<String> failure = new AtomicReference<>();
        scenario.onActivity(activity -> {
            // Assertions on the UI thread can terminate the app instead of
            // reporting an instrumentation failure. Marshal diagnostics back.
            try {
                if (activity.getBridge() == null || activity.getBridge().getWebView() == null) {
                    failure.set("Capacitor bridge/WebView is unavailable");
                    done.countDown();
                    return;
                }
                activity.getBridge().getWebView().evaluateJavascript(script, value -> {
                    result.set(value);
                    done.countDown();
                });
            } catch (RuntimeException error) {
                failure.set("WebView evaluation failed: " + error.getClass().getSimpleName());
                done.countDown();
            }
        });
        assertTrue("WebView evaluation callback timed out", done.await(10, TimeUnit.SECONDS));
        assertNull(failure.get(), failure.get());
        return result.get();
    }

    static void awaitReactRoot(ActivityScenario<MainActivity> scenario) throws Exception {
        AtomicInteger engine = new AtomicInteger(0);
        scenario.onActivity(activity -> {
            if (activity.getBridge() != null && activity.getBridge().getWebView() != null) {
                engine.set(WebViewCompatibility.chromiumMajor(
                    activity.getBridge().getWebView().getSettings().getUserAgentString()));
            }
        });
        int major = engine.get();
        checkpoint("WebView Chromium major=" + major);
        assertTrue("Application acceptance BLOCKED: Chromium " + major
            + " is below required " + WebViewCompatibility.MINIMUM_CHROMIUM_MAJOR
            + "; compatibility-message acceptance is a separate test", major >= WebViewCompatibility.MINIMUM_CHROMIUM_MAJOR);
        long deadline = android.os.SystemClock.elapsedRealtime() + 30000;
        while (android.os.SystemClock.elapsedRealtime() < deadline) {
            if ("true".equals(evaluate(scenario, "location.hostname === 'localhost' && document.readyState === 'complete' && !!document.getElementById('root') && document.getElementById('root').childElementCount > 0"))) return;
            Thread.sleep(100);
        }
        fail("Packaged application did not render its React root: " + evaluate(scenario,
            "JSON.stringify({ready:document.readyState,themeReady:document.documentElement.dataset.themeReady || '',rootChildren:document.getElementById('root') ? document.getElementById('root').childElementCount : -1})"));
    }

    private WebViewTestSupport() {}
}
