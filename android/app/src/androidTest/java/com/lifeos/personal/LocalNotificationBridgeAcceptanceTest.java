package com.lifeos.personal;

import android.Manifest;
import android.os.Build;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.os.ParcelFileDescriptor;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Executes the Capacitor 6 local-notification bridge in the packaged Android app. */
@RunWith(AndroidJUnit4.class)
public class LocalNotificationBridgeAcceptanceTest {
    @Test public void registeredPluginCanScheduleAndReadBackSyntheticTaskReminder() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            WebViewTestSupport.awaitReactRoot(scenario);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                    ApplicationProvider.getApplicationContext().getPackageName(), Manifest.permission.POST_NOTIFICATIONS);
            }
            assertTrue("Runtime information plugin must be registered", WebViewTestSupport.evaluate(
                scenario, "window.Capacitor.isPluginAvailable('LifeOSRuntimeInfo')").contains("true"));
            JSONObject runtime = new JSONObject(WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>JSON.stringify(await window.Capacitor.Plugins.LifeOSRuntimeInfo.getInfo()))()"));
            assertTrue("Runtime diagnostics must report the Android API", runtime.optInt("androidApi") >= 29);
            assertTrue("Power allowlist status is a boolean diagnostic, not a requested permission", runtime.has("batteryOptimizationExempt"));
            assertTrue("LocalNotifications must be registered in the native bridge", WebViewTestSupport.evaluate(
                scenario, "window.Capacitor.isPluginAvailable('LocalNotifications')").contains("true"));

            String result = WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{const p=window.Capacitor.Plugins.LocalNotifications;const id=2147000001;" +
                "await p.createChannel({id:'lifeos-reminders',name:'LifeOS reminders',importance:4,visibility:0});" +
                "const at=new Date(Date.now()+120000);await p.schedule({notifications:[{id,title:'LifeOS QA reminder',body:'Synthetic test only'," +
                "schedule:{at,allowWhileIdle:true},channelId:'lifeos-reminders',smallIcon:'ic_transparent',extra:{kind:'taskReminders',taskId:'synthetic-qa'} }]});" +
                "let found=null;try{const pending=await p.getPending();found=pending.notifications.find(n=>n.id===id)||null;" +
                "return {scheduled:!!found,at:found&&new Date(found.schedule.at).toISOString()};}" +
                "finally{await p.cancel({notifications:[{id}]});}})()");
            Object value = new JSONTokener(result).nextValue();
            JSONObject report = new JSONObject(String.valueOf(value));
            assertTrue("Native queue must contain the synthetic reminder after schedule: " + result, report.optBoolean("scheduled"));
            assertNotNull("Native schedule must return the selected UTC instant", report.optString("at", null));
        }
    }

    @Test public void backgroundedSyntheticTaskReminderIsActuallyPosted() throws Exception {
        final int id = 2147000002;
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            WebViewTestSupport.awaitReactRoot(scenario);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                    ApplicationProvider.getApplicationContext().getPackageName(), Manifest.permission.POST_NOTIFICATIONS);
            }
            String scheduled = WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{const p=window.Capacitor.Plugins.LocalNotifications;" +
                "await p.createChannel({id:'lifeos-reminders',name:'LifeOS reminders',importance:4,visibility:0});" +
                "const at=new Date(Date.now()+8000);await p.schedule({notifications:[{id:" + id + ",title:'LifeOS synthetic task reminder'," +
                "body:'Synthetic test only',schedule:{at,allowWhileIdle:true},channelId:'lifeos-reminders',smallIcon:'ic_transparent'," +
                "extra:{kind:'taskReminders',taskId:'synthetic-background-task'}}]});" +
                "const q=await p.getPending();return JSON.stringify({pending:q.notifications.some(n=>n.id===" + id + "),exact:(await p.checkExactNotificationSetting()).exact_alarm});})()");
            JSONObject queued = new JSONObject(scheduled);
            assertTrue("Synthetic task reminder must enter the Capacitor pending store", queued.optBoolean("pending"));

            ParcelFileDescriptor home = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .executeShellCommand("input keyevent 3");
            if (home != null) home.close();
            Thread.sleep(20_000L);
            ParcelFileDescriptor relaunch = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .executeShellCommand("am start -n com.lifeos.personal/.MainActivity");
            if (relaunch != null) relaunch.close();
            Thread.sleep(1_000L);
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);
            WebViewTestSupport.awaitReactRoot(scenario);
            boolean visible = false;
            try {
                String result = WebViewTestSupport.evaluateAsync(scenario,
                    "(async()=>{const p=window.Capacitor.Plugins.LocalNotifications;const d=await p.getDeliveredNotifications();" +
                    "return JSON.stringify({visible:d.notifications.some(n=>n.id===" + id + "),pending:(await p.getPending()).notifications.some(n=>n.id===" + id + ")});})()");
                JSONObject state = new JSONObject(result);
                visible = state.optBoolean("visible");
                assertFalse("Delivered notification must leave the plugin's persisted pending store", state.optBoolean("pending"));
            } finally {
                WebViewTestSupport.evaluateAsync(scenario,
                    "(async()=>{const p=window.Capacitor.Plugins.LocalNotifications;await p.cancel({notifications:[{id:" + id + "}]});" +
                    "await p.removeDeliveredNotifications({notifications:[{id:" + id + "}]});return true;})()");
            }
            assertTrue("Native AlarmManager receiver must post the synthetic reminder after app backgrounding; exact-alarm state=" + queued.optString("exact"), visible);
        }
    }
}
