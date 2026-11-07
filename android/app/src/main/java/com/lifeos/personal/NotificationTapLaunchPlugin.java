package com.lifeos.personal;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

/** Delivers a notification tap used to cold-start the Activity to the JS router. */
@CapacitorPlugin(name = "NotificationTapLaunch")
public class NotificationTapLaunchPlugin extends Plugin {
    private static final String NOTIFICATION_ID = "LocalNotificationId";
    private static final String ACTION_ID = "LocalNotificationUserAction";
    private static final String NOTIFICATION_JSON = "LocalNotficationObject";
    private static final String PREFS = "lifeos_notification_taps";
    private static final String PENDING_ACTION = "pending_action";

    @Override
    public void load() {
        super.load();
        captureAction(getContext(), getActivity().getIntent());
    }

    /** Persist a tap before JavaScript/WebView startup so cold-start actions cannot be lost. */
    static void captureAction(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_MAIN.equals(intent.getAction()) || !intent.hasExtra(NOTIFICATION_ID)) return;
        int id = intent.getIntExtra(NOTIFICATION_ID, Integer.MIN_VALUE);
        String source = intent.getStringExtra(NOTIFICATION_JSON);
        if (id == Integer.MIN_VALUE || source == null) return;
        try {
            JSONObject original = new JSONObject(source);
            JSObject notification = new JSObject();
            notification.put("id", id);
            JSONObject extra = original.optJSONObject("extra");
            if (extra != null) notification.put("extra", new JSObject(extra.toString()));
            JSObject action = new JSObject();
            action.put("actionId", intent.getStringExtra(ACTION_ID));
            action.put("notification", notification);
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(PENDING_ACTION, action.toString()).apply();
            // Prevent Activity recreation from treating this launch as a second tap.
            intent.removeExtra(NOTIFICATION_ID);
            intent.removeExtra(ACTION_ID);
            intent.removeExtra(NOTIFICATION_JSON);
        } catch (JSONException ignored) {
            // Invalid native payload is ignored; normal app startup remains safe.
        }
    }

    @PluginMethod
    public void getInitialAction(PluginCall call) {
        JSObject result = new JSObject();
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
        String serialized = preferences.getString(PENDING_ACTION, null);
        if (serialized != null) {
            try { result.put("action", new JSObject(serialized)); }
            catch (JSONException error) { preferences.edit().remove(PENDING_ACTION).apply(); }
        }
        call.resolve(result);
    }

    @PluginMethod
    public void acknowledgeInitialAction(PluginCall call) {
        int id = call.getInt("id", Integer.MIN_VALUE);
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
        String serialized = preferences.getString(PENDING_ACTION, null);
        if (serialized != null) {
            try {
                JSObject pending = new JSObject(serialized);
                JSObject notification = pending.getJSObject("notification");
                if (notification != null && notification.getInteger("id") == id) preferences.edit().remove(PENDING_ACTION).apply();
            } catch (JSONException ignored) { preferences.edit().remove(PENDING_ACTION).apply(); }
        }
        call.resolve();
    }
}
