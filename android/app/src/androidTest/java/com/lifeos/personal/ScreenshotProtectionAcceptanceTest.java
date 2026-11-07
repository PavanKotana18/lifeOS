package com.lifeos.personal;

import android.view.WindowManager;
import android.content.pm.ApplicationInfo;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

@RunWith(AndroidJUnit4.class)
public class ScreenshotProtectionAcceptanceTest {
    private static boolean hasSecureFlag(MainActivity activity) {
        return (activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0;
    }

    @Test public void policyAllowsOnlyResumedNonSensitiveDebugScreens() {
        assertFalse(ScreenshotProtectionPolicy.shouldProtect(true, false, true, false, false));
        assertTrue(ScreenshotProtectionPolicy.shouldProtect(false, false, true, false, false));
        assertTrue(ScreenshotProtectionPolicy.shouldProtect(true, true, true, false, false));
        assertTrue(ScreenshotProtectionPolicy.shouldProtect(true, false, false, false, false));
        assertTrue(ScreenshotProtectionPolicy.shouldProtect(true, false, true, true, false));
        assertTrue(ScreenshotProtectionPolicy.shouldProtect(true, false, true, false, true));
    }

    @Test public void debugActivityRequiresExplicitSafeStateAndRestoresProtectionOnLifecycle() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicInteger before = new AtomicInteger();
            AtomicInteger safe = new AtomicInteger();
            AtomicInteger sensitive = new AtomicInteger();
            AtomicInteger supported = new AtomicInteger();
            AtomicInteger debugVariant = new AtomicInteger();
            scenario.onActivity(activity -> {
                String userAgent = activity.getBridge().getWebView().getSettings().getUserAgentString();
                supported.set(WebViewCompatibility.isSupported(userAgent) ? 1 : 0);
                debugVariant.set((activity.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 ? 1 : 0);
            });
            Assume.assumeTrue("Instrumentation APK must use the debug variant", debugVariant.get() == 1);
            Assume.assumeTrue("Unsupported WebView remains protected and is covered by compatibility tests", supported.get() == 1);
            scenario.onActivity(activity -> {
                before.set(hasSecureFlag(activity) ? 1 : 0);
                activity.setSensitiveScreen(false);
                safe.set(hasSecureFlag(activity) ? 1 : 0);
                activity.setSensitiveScreen(true);
                sensitive.set(hasSecureFlag(activity) ? 1 : 0);
            });
            assertEquals("Activity starts protected", 1, before.get());
            assertEquals("Safe resumed debug screen may be captured", 0, safe.get());
            assertEquals("Sensitive state restores FLAG_SECURE", 1, sensitive.get());

            // Isolate Activity's resume fence from LifeOS's asynchronous resume
            // validation, which is exercised by the application lifecycle suite.
            scenario.onActivity(activity -> {
                activity.getBridge().getWebView().getSettings().setJavaScriptEnabled(false);
                activity.getBridge().getWebView().setVisibility(android.view.View.GONE);
            });
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.STARTED);
            AtomicInteger paused = new AtomicInteger();
            scenario.onActivity(activity -> paused.set(hasSecureFlag(activity) ? 1 : 0));
            assertEquals("Backgrounded Activity must be protected", 1, paused.get());

            scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);
            AtomicInteger resumed = new AtomicInteger();
            AtomicInteger staleUpdate = new AtomicInteger();
            AtomicInteger confirmed = new AtomicInteger();
            scenario.onActivity(activity -> {
                resumed.set(hasSecureFlag(activity) ? 1 : 0);
                activity.setSensitiveScreen(false);
                staleUpdate.set(hasSecureFlag(activity) ? 1 : 0);
                activity.confirmResumeValidation();
                activity.setSensitiveScreen(false);
                confirmed.set(hasSecureFlag(activity) ? 1 : 0);
            });
            assertEquals("Resume stays protected until React revalidates the screen", 1, resumed.get());
            assertEquals("Stale safe-screen updates cannot clear post-resume protection", 1, staleUpdate.get());
            assertEquals("Authenticated resume permits ordinary debug screenshots", 0, confirmed.get());
        }
    }
}
