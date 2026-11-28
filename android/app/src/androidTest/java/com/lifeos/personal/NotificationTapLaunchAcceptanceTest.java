package com.lifeos.personal;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.ComponentName;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import static org.junit.Assert.*;

/** Positive private PendingIntent and negative exported-launch acceptance. */
@RunWith(AndroidJUnit4.class)
public class NotificationTapLaunchAcceptanceTest {
    private static final int ID = 2147000012;
    private static Intent action(Context context, Class<?> target) {
        return new Intent(context, target).setAction(Intent.ACTION_MAIN)
            .putExtra("LocalNotificationId", ID)
            .putExtra("LocalNotificationUserAction", "lifeos-task-done")
            .putExtra("LocalNotficationObject", "{\"id\":2147000012,\"extra\":{\"kind\":\"taskReminders\",\"taskId\":\"synthetic-tap-task\",\"occurrenceAt\":\"2026-11-28T00:00:00.000Z\"}}");
    }
    private static String matching(ActivityScenario<MainActivity> scenario) throws Exception {
        return WebViewTestSupport.evaluateAsync(scenario,
            "(async()=>{const p=window.Capacitor.Plugins.NotificationTapLaunch;" +
            "return (await p.getPendingActions()).actions.filter(a=>a.notification.id===2147000012);})()");
    }
    @Test public void coldStartTaskActionIsAvailableUntilJavascriptAcknowledgesIt() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        assertFalse(context.getPackageManager().getActivityInfo(new ComponentName(context, NotificationEntryActivity.class), 0).exported);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(action(context, MainActivity.class))) {
            WebViewTestSupport.awaitReactRoot(scenario);
            assertEquals("[]", matching(scenario));
            scenario.onActivity(a -> a.onNewIntent(action(context, MainActivity.class)));
            assertEquals("[]", matching(scenario));
            scenario.onActivity(a -> a.onNewIntent(new Intent(Intent.ACTION_MAIN).putExtra("LocalNotificationId", "invalid")));
            assertEquals("[]", matching(scenario));
        }
        PendingIntent token = PendingIntent.getActivity(context, ID, action(context, NotificationEntryActivity.class),
            PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT);
        token.send();
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        try { token.send(); fail("Mutating PendingIntent must be single-use"); }
        catch (PendingIntent.CanceledException expected) { /* expected */ }
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            WebViewTestSupport.awaitReactRoot(scenario);
            String result = WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{const p=window.Capacitor.Plugins.NotificationTapLaunch;const end=Date.now()+5000;" +
                "let action;while(Date.now()<end){action=(await p.getPendingActions()).actions.find(a=>a.notification.id===2147000012);if(action)break;await new Promise(r=>setTimeout(r,50));}" +
                "if(!action)return {available:false};await p.acknowledgeInitialAction({tapKey:action.tapKey});" +
                "return {available:true,taskId:action.notification.extra.taskId,actionId:action.actionId,cleared:!(await p.getPendingActions()).actions.some(a=>a.notification.id===2147000012)};})()");
            JSONObject outcome = new JSONObject(result);
            assertTrue("Trusted private action must survive startup: " + result, outcome.optBoolean("available"));
            assertEquals("synthetic-tap-task", outcome.optString("taskId"));
            assertEquals("lifeos-task-done", outcome.optString("actionId"));
            assertTrue(outcome.optBoolean("cleared"));
            // A second trusted token for the same consumed occurrence cannot requeue a mutation.
            PendingIntent replay = PendingIntent.getActivity(context, ID, action(context, NotificationEntryActivity.class),
                PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT);
            replay.send();
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            assertEquals("[]", matching(scenario));
        }
    }
}
