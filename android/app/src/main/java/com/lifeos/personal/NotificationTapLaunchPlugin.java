package com.lifeos.personal;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Holds bounded routing references while the WebView starts or is locked. */
@CapacitorPlugin(name = "NotificationTapLaunch")
public class NotificationTapLaunchPlugin extends Plugin {
    private static final String NOTIFICATION_ID = "LocalNotificationId";
    private static final String ACTION_ID = "LocalNotificationUserAction";
    private static final String NOTIFICATION_JSON = "LocalNotficationObject";
    private static final String PREFS = "lifeos_notification_taps";
    private static final String PENDING_ACTION = "pending_action";
    private static final String QUEUE = "pending_actions_v2";
    private static final int MAX_ACTIONS = 64;
    private static final long MAX_AGE = 24 * 60 * 60 * 1000L;

    @Override
    public void load() {
        super.load();
        captureAction(getContext(), getActivity().getIntent());
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject sanitize(JSONObject action, long capturedAt) throws JSONException {
        JSONObject original = action.getJSONObject("notification");
        JSONObject incoming = original.optJSONObject("extra");
        if (incoming == null) return null;
        JSONObject extra = new JSONObject();
        for (String field : new String[] {
            "kind", "taskId", "habitId", "milestoneId", "goalId", "occurrenceAt", "originalReminderAt", "noteId", "reminderId"
        }) {
            Object raw = incoming.opt(field);
            if (raw instanceof String && ((String) raw).length() <= 160) extra.put(field, raw);
        }
        if (extra.optString("kind").isEmpty()) return null;
        String verb = action.optString("actionId");
        if (!"lifeos-task-done".equals(verb) && !"lifeos-task-snooze".equals(verb)) verb = "tap";
        int id = original.getInt("id");
        String occurrence = extra.optString("occurrenceAt", extra.optString("originalReminderAt", ""));
        if (occurrence.isEmpty() && "habitReminder".equals(extra.optString("kind"))) {
            occurrence = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date(capturedAt));
        }
        String key = id + ":" + verb + ":" + occurrence;
        return new JSONObject().put("actionId", verb).put("tapKey", key).put("capturedAt", capturedAt)
            .put("notification", new JSONObject().put("id", id).put("extra", extra));
    }

    private static JSONArray readQueue(SharedPreferences prefs) {
        JSONArray queue = new JSONArray();
        long now = System.currentTimeMillis();
        try {
            JSONArray existing = new JSONArray(prefs.getString(QUEUE, "[]"));
            for (int i = 0; i < existing.length(); i++) {
                JSONObject entry = existing.optJSONObject(i);
                if (entry != null && entry.optLong("capturedAt") > now - MAX_AGE) queue.put(entry);
            }
            String legacy = prefs.getString(PENDING_ACTION, null);
            if (legacy != null) {
                JSONObject entry = sanitize(new JSONObject(legacy), now);
                if (entry != null) queue.put(entry);
            }
        } catch (JSONException ignored) {
            // Corrupt routing metadata does not block app launch.
        }
        return queue;
    }

    private static void save(SharedPreferences prefs, JSONArray queue) {
        prefs.edit().remove(PENDING_ACTION).putString(QUEUE, queue.toString()).apply();
    }

    static synchronized void captureAction(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_MAIN.equals(intent.getAction()) || !intent.hasExtra(NOTIFICATION_ID)) return;
        int id = intent.getIntExtra(NOTIFICATION_ID, Integer.MIN_VALUE);
        String serialized = intent.getStringExtra(NOTIFICATION_JSON);
        if (id == Integer.MIN_VALUE || serialized == null) return;
        try {
            JSONObject original = new JSONObject(serialized);
            original.put("id", id);
            JSONObject action = sanitize(new JSONObject().put("notification", original)
                .put("actionId", intent.getStringExtra(ACTION_ID)), System.currentTimeMillis());
            if (action == null) return;
            SharedPreferences prefs = preferences(context);
            JSONArray current = readQueue(prefs);
            JSONArray next = new JSONArray();
            for (int i = Math.max(0, current.length() - MAX_ACTIONS + 1); i < current.length(); i++) {
                JSONObject entry = current.getJSONObject(i);
                if (!action.getString("tapKey").equals(entry.optString("tapKey"))) next.put(entry);
            }
            next.put(action);
            save(prefs, next);
        } catch (JSONException ignored) {
            // Invalid native payload is ignored.
        } finally {
            intent.removeExtra(NOTIFICATION_ID);
            intent.removeExtra(ACTION_ID);
            intent.removeExtra(NOTIFICATION_JSON);
        }
    }

    @PluginMethod
    public void getInitialAction(PluginCall call) {
        JSObject result = new JSObject();
        synchronized (NotificationTapLaunchPlugin.class) {
            JSONObject first = readQueue(preferences(getContext())).optJSONObject(0);
            if (first != null) result.put("action", first);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getPendingActions(PluginCall call) {
        JSObject result = new JSObject();
        synchronized (NotificationTapLaunchPlugin.class) {
            SharedPreferences prefs = preferences(getContext());
            JSONArray queue = readQueue(prefs);
            save(prefs, queue);
            result.put("actions", queue);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void acknowledgeInitialAction(PluginCall call) {
        String key = call.getString("tapKey");
        int id = call.getInt("id", Integer.MIN_VALUE);
        synchronized (NotificationTapLaunchPlugin.class) {
            SharedPreferences prefs = preferences(getContext());
            JSONArray current = readQueue(prefs);
            JSONArray next = new JSONArray();
            boolean removed = false;
            for (int i = 0; i < current.length(); i++) {
                JSONObject entry = current.optJSONObject(i);
                JSONObject notification = entry.optJSONObject("notification");
                boolean matches = key == null ? notification != null && notification.optInt("id") == id
                    : key.equals(entry.optString("tapKey"));
                if (matches && !removed) removed = true;
                else next.put(entry);
            }
            save(prefs, next);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearPendingActions(PluginCall call) {
        synchronized (NotificationTapLaunchPlugin.class) {
            save(preferences(getContext()), new JSONArray());
        }
        call.resolve();
    }
}
