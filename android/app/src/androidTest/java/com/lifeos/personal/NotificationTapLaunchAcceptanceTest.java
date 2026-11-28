package com.lifeos.personal;

import android.content.Intent;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Verifies cold-start action retention through the real Android/Capacitor bridge. */
@RunWith(AndroidJUnit4.class)
public class NotificationTapLaunchAcceptanceTest {
    @Test public void coldStartTaskActionIsAvailableUntilJavascriptAcknowledgesIt() throws Exception {
        Intent launch = new Intent(ApplicationProvider.getApplicationContext(), MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .putExtra("LocalNotificationId", 2147000012)
            .putExtra("LocalNotificationUserAction", "lifeos-task-done")
            .putExtra("LocalNotficationObject", "{\"id\":2147000012,\"extra\":{\"kind\":\"taskReminders\",\"taskId\":\"synthetic-tap-task\"}}");
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(launch)) {
            WebViewTestSupport.awaitReactRoot(scenario);
            String result = WebViewTestSupport.evaluateAsync(scenario,
                "(async()=>{if(!window.Capacitor.isPluginAvailable('NotificationTapLaunch'))return {available:false};" +
                "const p=window.Capacitor.Plugins.NotificationTapLaunch;const first=await p.getInitialAction();" +
                "const action=first&&first.action;const id=action&&action.notification&&action.notification.id;" +
                "const taskId=action&&action.notification&&action.notification.extra&&action.notification.extra.taskId;" +
                "if(id===2147000012)await p.acknowledgeInitialAction({tapKey:action.tapKey});const second=await p.getInitialAction();" +
                "return {available:true,id,taskId,actionId:action&&action.actionId,cleared:!second.action};})()");
            assertTrue("Cold-start tap action must be delivered to the registered native bridge: " + result, result.contains("synthetic-tap-task"));
            assertTrue("The cold-start bridge must keep the original action ID", result.contains("lifeos-task-done"));
            assertTrue("The pending action is acknowledged only after routing consumes it", result.contains("\"cleared\":true"));
        }
    }
}
