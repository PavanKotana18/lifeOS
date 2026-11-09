package com.lifeos.personal;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.view.WindowManager;
import android.content.pm.ApplicationInfo;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

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

    @Test public void debugActivityRequiresExplicitSafeStateAndRestoresProtectionOnLifecycle() throws Exception {
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

            scenario.moveToState(androidx.lifecycle.Lifecycle.State.STARTED);
            AtomicInteger paused = new AtomicInteger();
            scenario.onActivity(activity -> paused.set(hasSecureFlag(activity) ? 1 : 0));
            assertEquals("Backgrounded Activity must be protected", 1, paused.get());

            AtomicInteger resumed = new AtomicInteger();
            AtomicInteger staleUpdate = new AtomicInteger();
            AtomicInteger confirmed = new AtomicInteger();
            AtomicReference<MainActivity> target = new AtomicReference<>();
            scenario.onActivity(target::set);
            CountDownLatch resumeAssertionsCompleted = new CountDownLatch(1);
            AtomicBoolean captureNextResume = new AtomicBoolean(false);
            Application application = target.get().getApplication();
            Application.ActivityLifecycleCallbacks lifecycleProbe = new Application.ActivityLifecycleCallbacks() {
                @Override public void onActivityResumed(Activity activity) {
                    if (activity != target.get() || !captureNextResume.compareAndSet(true, false)) return;
                    MainActivity resumedActivity = (MainActivity) activity;
                    // Run these native assertions synchronously in the resume
                    // turn. Capacitor 6 dispatches JS plugin calls through its
                    // separate CapacitorPlugins HandlerThread and then posts
                    // UI work; queued startup/JS resume traffic must not race
                    // this direct native state-machine verification.
                    resumed.set(hasSecureFlag(resumedActivity) ? 1 : 0);
                    resumedActivity.setSensitiveScreen(false);
                    staleUpdate.set(hasSecureFlag(resumedActivity) ? 1 : 0);
                    resumedActivity.confirmResumeValidation();
                    resumedActivity.setSensitiveScreen(false);
                    confirmed.set(hasSecureFlag(resumedActivity) ? 1 : 0);
                    resumeAssertionsCompleted.countDown();
                }

                @Override public void onActivityCreated(Activity activity, Bundle state) {}
                @Override public void onActivityStarted(Activity activity) {}
                @Override public void onActivityPaused(Activity activity) {}
                @Override public void onActivityStopped(Activity activity) {}
                @Override public void onActivitySaveInstanceState(Activity activity, Bundle state) {}
                @Override public void onActivityDestroyed(Activity activity) {}
            };
            application.registerActivityLifecycleCallbacks(lifecycleProbe);
            try {
                captureNextResume.set(true);
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);
                assertTrue("Resume lifecycle callback did not run", resumeAssertionsCompleted.await(5, TimeUnit.SECONDS));
            } finally {
                application.unregisterActivityLifecycleCallbacks(lifecycleProbe);
            }
            assertEquals("Resume stays protected until React revalidates the screen", 1, resumed.get());
            assertEquals("Stale safe-screen updates cannot clear post-resume protection", 1, staleUpdate.get());
            assertEquals("Authenticated resume permits ordinary debug screenshots", 0, confirmed.get());
        }
    }
}
