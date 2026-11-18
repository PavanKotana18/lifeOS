package com.lifeos.personal;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.Lifecycle;
import android.os.ParcelFileDescriptor;
import android.service.notification.StatusBarNotification;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Executes the Capacitor 6 local-notification bridge in the packaged Android app. */
@RunWith(AndroidJUnit4.class)
public class LocalNotificationBridgeAcceptanceTest {
    @Test public void registeredPluginCanScheduleAndReadBackSyntheticTaskReminder() throws Exception {
        requireNotificationPermission(ApplicationProvider.getApplicationContext());
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            WebViewTestSupport.awaitReactRoot(scenario);
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
        final String syntheticTaskId = "synthetic-background-task";
        Context context = ApplicationProvider.getApplicationContext();
        requireNotificationPermission(context);
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            WebViewTestSupport.awaitReactRoot(scenario);
            WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{window.__lifeosQaNotificationTap=null;" +
                "await window.Capacitor.Plugins.LocalNotifications.addListener('localNotificationActionPerformed'," +
                "action=>window.__lifeosQaNotificationTap=action);return true;})()");
            String scheduled = WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{const p=window.Capacitor.Plugins.LocalNotifications;" +
                "await p.createChannel({id:'lifeos-reminders',name:'LifeOS reminders',importance:4,visibility:0});" +
                "const at=new Date(Date.now()+8000);await p.schedule({notifications:[{id:" + id + ",title:'LifeOS synthetic task reminder'," +
                "body:'Synthetic test only',schedule:{at,allowWhileIdle:true},channelId:'lifeos-reminders',smallIcon:'ic_transparent'," +
                "extra:{kind:'taskReminders',taskId:'" + syntheticTaskId + "'}}]});" +
                "const q=await p.getPending();return JSON.stringify({pending:q.notifications.some(n=>n.id===" + id + "),exact:(await p.checkExactNotificationSetting()).exact_alarm});})()");
            JSONObject queued = new JSONObject(scheduled);
            assertTrue("Synthetic task reminder must enter the Capacitor pending store", queued.optBoolean("pending"));
            Intent alarmIntent = new Intent(context, TimedNotificationPublisher.class);
            int alarmFlags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) alarmFlags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent scheduledAlarm = PendingIntent.getBroadcast(context, id, alarmIntent, alarmFlags);
            assertNotNull("Android AlarmManager must retain the synthetic reminder's scheduled broadcast", scheduledAlarm);

            scenario.moveToState(Lifecycle.State.CREATED);
            NotificationStorage storage = new NotificationStorage(context);
            // Dispatch the exact scheduled broadcast under test control. This
            // exercises the production receiver and NotificationManager path
            // without waiting for inexact-alarm batching on physical devices.
            scheduledAlarm.send();
            boolean visible = false;
            android.app.Notification postedNotification = null;
            long deliveryDeadline = android.os.SystemClock.elapsedRealtime() + 10_000L;
            while (android.os.SystemClock.elapsedRealtime() < deliveryDeadline) {
                for (StatusBarNotification active : manager.getActiveNotifications()) {
                    if (active.getId() == id) { visible = true; postedNotification = active.getNotification(); break; }
                }
                // notify() publishes through the system service before the receiver
                // retires its one-shot pending row. Wait for both observable
                // postconditions; apply() updates this process in memory immediately.
                if (visible && !storage.getSavedNotificationIds().contains(String.valueOf(id))) break;
                Thread.sleep(50L);
            }
            try {
                assertTrue("Native scheduled reminder receiver must post to Android NotificationManager", visible);
                assertFalse("Capacitor receiver must retire the persisted pending row after posting",
                    storage.getSavedNotificationIds().contains(String.valueOf(id)));
                assertNotNull("Posted reminder must expose a native content tap action", postedNotification);
                assertNotNull("Posted reminder content tap must be launchable", postedNotification.contentIntent);
                // The post and pending-row checks above run with the Activity stopped.
                // Resume it before sending the posted content action from the test process.
                scenario.moveToState(Lifecycle.State.RESUMED);
                postedNotification.contentIntent.send();
                JSONObject tap = new JSONObject(WebViewTestSupport.evaluateAsync(scenario,
                    "(async()=>{const until=Date.now()+10000;while(Date.now()<until){if(window.__lifeosQaNotificationTap)" +
                    "return JSON.stringify(window.__lifeosQaNotificationTap);await new Promise(r=>setTimeout(r,50));}return '{}';})()"));
                JSONObject notification = tap.optJSONObject("notification");
                assertNotNull("Posted content action must reach the Capacitor action listener", notification);
                assertEquals(id, notification.optInt("id"));
                JSONObject extra = notification.optJSONObject("extra");
                assertNotNull("Content action must retain its destination payload", extra);
                assertEquals(syntheticTaskId, extra.optString("taskId"));
            } finally {
                manager.cancel(id);
                if (scheduledAlarm != null) {
                    ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(scheduledAlarm);
                    scheduledAlarm.cancel();
                }
                storage.deleteNotification(String.valueOf(id));
            }
        }
    }

    @Test public void immediatePostDoesNotRequireExactAlarmAccess() throws Exception {
        final int id = 2147000003;
        Context context = ApplicationProvider.getApplicationContext();
        requireNotificationPermission(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            WebViewTestSupport.awaitReactRoot(scenario);
            WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{const p=window.Capacitor.Plugins.LocalNotifications;" +
                "await p.createChannel({id:'lifeos-reminders',name:'LifeOS reminders',importance:4,visibility:0});" +
                "await p.schedule({notifications:[{id:" + id + ",title:'LifeOS immediate QA'," +
                "body:'Synthetic test only',channelId:'lifeos-reminders',smallIcon:'ic_lifeos_notification'}]});return true;})()");
            assertNotNull("Immediate bridge request must post through Android", awaitPost(manager, id, 5_000L));
        } finally {
            manager.cancel(id);
        }
    }

    @Test public void exactAlarmFiresNaturallyWhileAppIsBackgrounded() throws Exception {
        final int id = 2147000004;
        Context context = ApplicationProvider.getApplicationContext();
        requireNotificationPermission(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        assumeTrue("Exact alarm access must be enabled on this disposable test device",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms());
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationStorage storage = new NotificationStorage(context);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            WebViewTestSupport.awaitReactRoot(scenario);
            String result = WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{const p=window.Capacitor.Plugins.LocalNotifications;" +
                "await p.createChannel({id:'lifeos-reminders',name:'LifeOS reminders',importance:4,visibility:0});" +
                "const at=Date.now()+10000;await p.schedule({notifications:[{id:" + id +
                ",title:'LifeOS exact alarm QA',body:'Synthetic test only',channelId:'lifeos-reminders'," +
                "smallIcon:'ic_lifeos_notification',schedule:{at:new Date(at),allowWhileIdle:true}}]});return at;})()");
            long expected = Long.parseLong(result);
            ParcelFileDescriptor home = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .executeShellCommand("input keyevent 3");
            if (home != null) home.close();

            StatusBarNotification post = awaitPost(manager, id, 35_000L);
            assertNotNull("AlarmManager must deliver the broadcast without test dispatch", post);
            long drift = post.getPostTime() - expected;
            android.util.Log.i("LifeOSNotificationQA",
                "expected=" + expected + " posted=" + post.getPostTime() + " driftMs=" + drift);
            assertTrue("Alarm posted before its requested time: " + drift, drift >= 0);
            JSONObject pending = new JSONObject(WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{const q=await window.Capacitor.Plugins.LocalNotifications.getPending();" +
                "return JSON.stringify({pending:q.notifications.some(n=>n.id===" + id + ")});})()"));
            assertFalse("The one-shot notification must leave the pending store", pending.optBoolean("pending"));
        } finally {
            manager.cancel(id);
            Intent intent = new Intent(context, TimedNotificationPublisher.class);
            int flags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent token = PendingIntent.getBroadcast(context, id, intent, flags);
            if (token != null) {
                alarms.cancel(token);
                token.cancel();
            }
            storage.deleteNotification(String.valueOf(id));
        }
    }

    private static StatusBarNotification awaitPost(NotificationManager manager, int id, long timeoutMs)
        throws InterruptedException {
        long deadline = android.os.SystemClock.elapsedRealtime() + timeoutMs;
        while (android.os.SystemClock.elapsedRealtime() < deadline) {
            for (StatusBarNotification active : manager.getActiveNotifications()) {
                if (active.getId() == id) return active;
            }
            Thread.sleep(50L);
        }
        return null;
    }

    private static void requireNotificationPermission(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            assumeTrue("BLOCKED: notification permission requires explicit user consent",
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    == android.content.pm.PackageManager.PERMISSION_GRANTED);
        }
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        assumeTrue("BLOCKED: Android notifications are disabled by the user", manager.areNotificationsEnabled());
    }
}
