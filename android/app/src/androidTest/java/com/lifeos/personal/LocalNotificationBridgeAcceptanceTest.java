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
import android.os.ParcelFileDescriptor;
import android.service.notification.StatusBarNotification;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;
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
            Context context = ApplicationProvider.getApplicationContext();
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationStorage storage = new NotificationStorage(context);
            boolean visible = false;
            long deliveryDeadline = android.os.SystemClock.elapsedRealtime() + 20_000L;
            while (android.os.SystemClock.elapsedRealtime() < deliveryDeadline) {
                for (StatusBarNotification active : manager.getActiveNotifications()) {
                    if (active.getId() == id) { visible = true; break; }
                }
                // notify() publishes through the system service before the receiver
                // retires its one-shot pending row. Wait for both observable
                // postconditions; apply() updates this process in memory immediately.
                if (visible && !storage.getSavedNotificationIds().contains(String.valueOf(id))) break;
                Thread.sleep(50L);
            }
            try {
                assertTrue("Native AlarmManager receiver must post the synthetic reminder after app backgrounding; exact-alarm state=" + queued.optString("exact"), visible);
                assertFalse("Capacitor receiver must retire the persisted pending row after posting",
                    storage.getSavedNotificationIds().contains(String.valueOf(id)));
            } finally {
                manager.cancel(id);
                Intent alarmIntent = new Intent(context, TimedNotificationPublisher.class);
                int flags = PendingIntent.FLAG_NO_CREATE;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
                PendingIntent alarm = PendingIntent.getBroadcast(context, id, alarmIntent, flags);
                if (alarm != null) {
                    ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(alarm);
                    alarm.cancel();
                }
                storage.deleteNotification(String.valueOf(id));
            }
        }
    }
}
