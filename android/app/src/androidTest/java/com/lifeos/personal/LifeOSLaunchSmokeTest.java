package com.lifeos.personal;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Launches the real Activity on a fresh emulator; no auth result is injected. */
@RunWith(AndroidJUnit4.class)
public class LifeOSLaunchSmokeTest {
 @Test public void activityCreatesLocalCapacitorWebView() {
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
   scenario.onActivity(activity -> {
    assertNotNull("Capacitor bridge must initialize",activity.getBridge());
    assertNotNull("Local app WebView must initialize",activity.getBridge().getWebView());
    assertTrue("WebView must load packaged localhost assets",activity.getBridge().getWebView().getUrl().contains("localhost"));
   });
  }
 }
}
