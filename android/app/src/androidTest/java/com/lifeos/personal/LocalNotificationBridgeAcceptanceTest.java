package com.lifeos.personal;

import android.Manifest;
import android.os.Build;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
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
            assertTrue("LocalNotifications must be registered in the native bridge", WebViewTestSupport.evaluate(
                scenario, "window.Capacitor.isPluginAvailable('LocalNotifications')").contains("true"));

            String result = WebViewTestSupport.evaluate(scenario,
                "JSON.stringify((async()=>{const p=window.Capacitor.Plugins.LocalNotifications;const id=2147000001;" +
                "await p.createChannel({id:'lifeos-reminders',name:'LifeOS reminders',importance:4,visibility:0});" +
                "const at=new Date(Date.now()+120000);await p.schedule({notifications:[{id,title:'LifeOS QA reminder',body:'Synthetic test only'," +
                "schedule:{at,allowWhileIdle:true},channelId:'lifeos-reminders',smallIcon:'ic_transparent',extra:{kind:'taskReminders',taskId:'synthetic-qa'} }]});" +
                "let found=null;try{const pending=await p.getPending();found=pending.notifications.find(n=>n.id===id)||null;" +
                "return {scheduled:!!found,at:found&&new Date(found.schedule.at).toISOString()};}" +
                "finally{await p.cancel({notifications:[{id}]});}})())");
            Object value = new JSONTokener(result).nextValue();
            JSONObject report = new JSONObject(String.valueOf(value));
            assertTrue("Native queue must contain the synthetic reminder after schedule: " + result, report.optBoolean("scheduled"));
            assertNotNull("Native schedule must return the selected UTC instant", report.optString("at", null));
        }
    }
}
