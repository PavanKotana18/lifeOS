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
    // Pre-hardening queue entries have no trusted-origin evidence. Never replay them.
    private static final String OLD_QUEUE = "pending_actions_v2";
    private static final String QUEUE = "pending_actions_v3";
    private static final String CONSUMED = "consumed_mutations_v3";
    private static final int MAX_CONSUMED = 256;
    private static final int MAX_ACTIONS = 64;
    private static final long MAX_AGE = 24 * 60 * 60 * 1000L;

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
        } catch (JSONException ignored) {
            // Corrupt routing metadata does not block app launch.
        }
        return queue;
    }

    private static boolean mutation(JSONObject action) {
        String verb = action.optString("actionId");
        return "lifeos-task-done".equals(verb) || "lifeos-task-snooze".equals(verb);
    }

    private static JSONObject readConsumed(SharedPreferences prefs) throws JSONException {
        JSONObject prior = new JSONObject(prefs.getString(CONSUMED, "{}"));
        JSONObject current = new JSONObject();
        long cutoff = System.currentTimeMillis() - MAX_AGE;
        java.util.Iterator<String> keys = prior.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            long at = prior.optLong(key, 0L);
            if (at > cutoff) current.put(key, at);
        }
        return current;
    }

    private static boolean save(SharedPreferences prefs, JSONArray queue, JSONObject consumed) {
        return prefs.edit().remove(PENDING_ACTION).remove(OLD_QUEUE)
            .putString(QUEUE, queue.toString()).putString(CONSUMED, consumed.toString()).commit();
    }

    static synchronized boolean captureAction(Context context, Intent intent) {
        // Called only with validated data from the private notification relay.
        try {
            if (intent == null || !Intent.ACTION_MAIN.equals(intent.getAction())) return false;
            int id = intent.getIntExtra(NOTIFICATION_ID, Integer.MIN_VALUE);
            String serialized = intent.getStringExtra(NOTIFICATION_JSON);
            if (id < 0 || serialized == null || serialized.length() > 32768) return false;
            JSONObject original = new JSONObject(serialized);
            original.put("id", id);
            JSONObject action = sanitize(new JSONObject().put("notification", original)
                .put("actionId", intent.getStringExtra(ACTION_ID)), System.currentTimeMillis());
            if (action == null) return false;
            SharedPreferences prefs = preferences(context);
            JSONObject consumed = readConsumed(prefs);
            String key = action.getString("tapKey");
            if (mutation(action) && consumed.has(key)) return false;
            JSONArray current = readQueue(prefs);
            for (int i = 0; i < current.length(); i++) {
                if (key.equals(current.getJSONObject(i).optString("tapKey"))) return false;
            }
            // Do not evict an unacknowledged action to admit a new one.
            if (current.length() >= MAX_ACTIONS) return false;
            current.put(action);
            return save(prefs, current, consumed);
        } catch (JSONException | RuntimeException malformed) {
            return false;
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
            try {
                if (!save(prefs, queue, readConsumed(prefs))) { call.reject("Notification queue unavailable"); return; }
            } catch (JSONException | RuntimeException invalid) { call.reject("Notification queue unavailable"); return; }
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
            try {
            JSONObject consumed = readConsumed(prefs);
            for (int i = 0; i < current.length(); i++) {
                JSONObject entry = current.optJSONObject(i);
                JSONObject notification = entry.optJSONObject("notification");
                boolean matches = key == null ? notification != null && notification.optInt("id") == id
                    : key.equals(entry.optString("tapKey"));
                if (matches && !removed) {
                    removed = true;
                    if (mutation(entry)) {
                        // Retain a bounded, expiring receipt across process restarts.
                        while (consumed.length() >= MAX_CONSUMED) {
                            String oldest = null;
                            java.util.Iterator<String> keys = consumed.keys();
                            while (keys.hasNext()) {
                                String candidate = keys.next();
                                if (oldest == null || consumed.optLong(candidate) < consumed.optLong(oldest)) oldest = candidate;
                            }
                            if (oldest == null) break;
                            consumed.remove(oldest);
                        }
                        consumed.put(entry.getString("tapKey"), System.currentTimeMillis());
                    }
                } else next.put(entry);
            }
            if (!save(prefs, next, consumed)) { call.reject("Notification acknowledgement unavailable"); return; }
            } catch (JSONException | RuntimeException invalid) { call.reject("Notification acknowledgement unavailable"); return; }
        }
        call.resolve();
    }

    @PluginMethod
    public void clearPendingActions(PluginCall call) {
        synchronized (NotificationTapLaunchPlugin.class) {
            if (!save(preferences(getContext()), new JSONArray(), new JSONObject())) {
                call.reject("Notification queue could not be cleared"); return;
            }
        }
        call.resolve();
    }
}
