package com.lifeos.personal;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.graphics.Insets;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class SystemGestureInsetsAcceptanceTest {
    @Test
    public void convertsNativeInsetPixelsToWebViewDensityIndependentUnits() {
        assertEquals(24f, RuntimeInfoPlugin.pixelsToDp(48, 2f), 0.01f);
        assertEquals(0f, RuntimeInfoPlugin.pixelsToDp(48, 0f), 0f);
    }

    @Test
    public void readsNonnegativeSystemGestureInsetsFromTheRealActivityWindow() {
        AtomicReference<Insets> observed = new AtomicReference<>();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                View decor = activity.getWindow().getDecorView();
                WindowInsets windowInsets = decor.getRootWindowInsets();
                if (windowInsets == null) return;
                observed.set(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? windowInsets.getInsets(WindowInsets.Type.systemGestures())
                    : windowInsets.getSystemGestureInsets());
            });
        }
        assertNotNull("Activity window should expose system gesture insets", observed.get());
        assertTrue(observed.get().left >= 0);
        assertTrue(observed.get().right >= 0);
    }
}
