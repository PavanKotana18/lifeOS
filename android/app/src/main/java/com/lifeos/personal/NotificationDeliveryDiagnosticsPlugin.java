package com.lifeos.personal;

import android.app.NotificationManager;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Read-only OS post timestamps for notifications that remain active. */
@CapacitorPlugin(name = "LifeOSNotificationDeliveryDiagnostics")
public final class NotificationDeliveryDiagnosticsPlugin extends Plugin {
    @PluginMethod
    public void getRecentDeliveries(PluginCall call) {
        JSArray events = new JSArray();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (manager != null) {
                StatusBarNotification[] active = manager.getActiveNotifications();
                SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
                for (int index = active.length - 1; index >= 0 && events.length() < 32; index--) {
                    StatusBarNotification notification = active[index];
                    JSObject event = new JSObject();
                    event.put("id", notification.getId());
                    event.put("postedAt", formatter.format(new Date(notification.getPostTime())));
                    events.put(event);
                }
            }
        }
        JSObject result = new JSObject();
        result.put("notifications", events);
        call.resolve(result);
    }
}
