package com.lifeos.personal;

import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Launches the real Activity on a fresh emulator; no auth result is injected. */
@RunWith(AndroidJUnit4.class)
public class LifeOSLaunchSmokeTest {
 @Test public void activityCreatesLocalCapacitorWebView() throws Exception {
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
   WebViewTestSupport.checkpoint("launch: waiting for real React root");
   WebViewTestSupport.awaitReactRoot(scenario);
   AtomicReference<String> url = new AtomicReference<>();
   AtomicBoolean updateMessage = new AtomicBoolean();
   AtomicBoolean startupProviderPresent = new AtomicBoolean();
   AtomicBoolean downloadableEmojiInitializerPresent = new AtomicBoolean();
   scenario.onActivity(activity -> {
    url.set(activity.getBridge().getWebView().getUrl());
    updateMessage.set(activity.getWindow().getDecorView().findViewWithTag(WebViewCompatibility.UPDATE_REQUIRED_TAG) != null);
    ProviderInfo startupProvider = activity.getPackageManager().resolveContentProvider(
      activity.getPackageName() + ".androidx-startup", PackageManager.GET_META_DATA);
    startupProviderPresent.set(startupProvider != null);
    downloadableEmojiInitializerPresent.set(startupProvider != null
      && startupProvider.metaData != null
      && startupProvider.metaData.containsKey("androidx.emoji2.text.EmojiCompatInitializer"));
   });
   assertNotNull("WebView must have a local app URL", url.get());
   assertTrue("WebView must load packaged localhost assets", url.get().contains("localhost"));
   assertFalse("Supported-runtime acceptance must not use a compatibility placeholder", updateMessage.get());
   assertTrue("AndroidX Startup provider must remain registered", startupProviderPresent.get());
   assertFalse("Startup must not bind LifeOS to an optional downloadable emoji-font provider",
     downloadableEmojiInitializerPresent.get());
   WebViewTestSupport.checkpoint("launch: real React root rendered");
  }
 }
}
