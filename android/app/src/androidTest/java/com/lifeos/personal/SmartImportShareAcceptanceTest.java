package com.lifeos.personal;

import android.content.Intent;
import android.net.Uri;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

@RunWith(AndroidJUnit4.class)
public class SmartImportShareAcceptanceTest {
    @Test
    public void coldTextShareRetainsMetadataAndAcknowledgesWithoutExposingText() throws Exception {
        Intent launch = new Intent(ApplicationProvider.getApplicationContext(), MainActivity.class)
                .setAction(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, "Synthetic test bank alert for INR 17.25");

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(launch)) {
            scenario.onActivity(activity -> {
                assertEquals(Intent.ACTION_MAIN, activity.getIntent().getAction());
                assertNull(activity.getIntent().getExtras());
            });
            WebViewTestSupport.awaitReactRoot(scenario);
            String result = WebViewTestSupport.evaluateAsync(scenario,
                    "(async()=>{const plugin=window.Capacitor.Plugins.SmartImportShare;" +
                    "const status=await plugin.status();const received=typeof status.id==='string';" +
                    "if(received)await plugin.acknowledge({id:status.id});" +
                    "return {received,metadataOnly:!('text' in status),cleared:!(await plugin.status()).id};})()");
            assertTrue(result.contains("\"received\":true"));
            assertTrue(result.contains("\"metadataOnly\":true"));
            assertTrue(result.contains("\"cleared\":true"));
        }
    }

    @Test
    public void attachmentPayloadIsRemovedBeforeOtherPluginsReceiveTheIntent() {
        Intent upload = new Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, "Synthetic fixture")
                .putExtra(Intent.EXTRA_STREAM, Uri.parse("content://fixture/attachment"));

        Intent sanitized = SmartImportSharePlugin.consumeShareIntent(upload);

        assertEquals(Intent.ACTION_MAIN, sanitized.getAction());
        assertNull(sanitized.getExtras());
        assertNull(sanitized.getClipData());
    }

    @Test
    public void unrelatedIntentAndItsExtrasTakeTheExistingRoute() {
        Intent navigation = new Intent(Intent.ACTION_VIEW).putExtra("fixture", "navigation");

        assertSame(navigation, SmartImportSharePlugin.consumeShareIntent(navigation));
        assertEquals("navigation", navigation.getStringExtra("fixture"));
    }

    @Test
    public void sharedTextAcceptsPlainTextAndRejectsUnsafeControls() {
        assertTrue(SmartImportSharePlugin.isSafeText("Synthetic bank alert\nINR 17.25"));
        assertFalse(SmartImportSharePlugin.isSafeText(" "));
        assertFalse(SmartImportSharePlugin.isSafeText("Synthetic\u202Ealert"));
    }
}
