package com.lifeos.personal;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONObject;

/** Private PendingIntent target. MainActivity accepts only single-use in-process handoffs. */
public final class NotificationEntryActivity extends Activity {
    private static final String HANDOFF = "busydoo.internal.notification.handoff";
    private static final String ID = "LocalNotificationId";
    private static final String ACTION = "LocalNotificationUserAction";
    private static final String JSON = "LocalNotficationObject";
    private static final String REMOVABLE = "LocalNotificationRepeating";
    private static final int MAX_JSON = 32768;
    private static final long TTL = 30000L;
    private static final int MAX_HANDOFFS = 16;
    private static final Map<String, Forward> handoffs = new LinkedHashMap<>();

    private static final class Forward {
        final Intent action;
        final long expires = SystemClock.elapsedRealtime() + TTL;
        Forward(Intent action) { this.action = action; }
    }

    private static synchronized String issue(Intent action) {
        long now = SystemClock.elapsedRealtime();
        handoffs.entrySet().removeIf(row -> row.getValue().expires <= now);
        while (handoffs.size() >= MAX_HANDOFFS) {
            Iterator<String> keys = handoffs.keySet().iterator();
            keys.next(); keys.remove();
        }
        String token = UUID.randomUUID().toString();
        handoffs.put(token, new Forward(action));
        return token;
    }

    static synchronized Intent take(Intent incoming) {
        try {
            if (incoming == null || !Intent.ACTION_MAIN.equals(incoming.getAction())) return null;
            String token = incoming.getStringExtra(HANDOFF);
            if (token == null || token.length() != 36) return null;
            Forward forward = handoffs.remove(token);
            return forward != null && forward.expires > SystemClock.elapsedRealtime() ? forward.action : null;
        } catch (RuntimeException malformed) {
            return null;
        }
    }

    /** Copy only the data needed by the existing authenticated router and Capacitor. */
    private static Intent validatedAction(Intent incoming) throws Exception {
        if (incoming == null || !Intent.ACTION_MAIN.equals(incoming.getAction())) return null;
        int id = incoming.getIntExtra(ID, Integer.MIN_VALUE);
        String verb = incoming.getStringExtra(ACTION);
        String raw = incoming.getStringExtra(JSON);
        if (id < 0 || raw == null || raw.length() > MAX_JSON ||
            !("tap".equals(verb) || "lifeos-task-done".equals(verb) || "lifeos-task-snooze".equals(verb))) return null;
        JSONObject original = new JSONObject(raw);
        if (!(original.opt("id") instanceof Number) || original.getDouble("id") != id) return null;
        JSONObject source = original.optJSONObject("extra");
        if (source == null) return null;
        JSONObject extra = new JSONObject();
        for (String field : new String[] {"kind", "taskId", "habitId", "milestoneId", "goalId", "occurrenceAt", "originalReminderAt", "noteId", "reminderId"}) {
            Object value = source.opt(field);
            if (value == null || value == JSONObject.NULL) continue;
            if (!(value instanceof String) || ((String) value).length() > 160) return null;
            extra.put(field, value);
        }
        String kind = extra.optString("kind");
        boolean task = "taskReminders".equals(kind) || "dueTime".equals(kind) || "upcomingDeadlines".equals(kind) || "overdueAlerts".equals(kind) || "taskSnooze".equals(kind);
        if (task) {
            if (extra.optString("taskId").isEmpty()) return null;
        } else {
            if (!"tap".equals(verb)) return null;
            if ("habitReminder".equals(kind)) {
                if (extra.optString("habitId").isEmpty()) return null;
            } else if ("milestoneReminder".equals(kind)) {
                if (extra.optString("milestoneId").isEmpty()) return null;
            } else if ("notesReminder".equals(kind)) {
                if (extra.optString("noteId").isEmpty() || extra.optString("reminderId").isEmpty() || extra.optString("occurrenceAt").isEmpty()) return null;
            } else if (!"test".equals(kind)) return null;
        }
        JSONObject notification = new JSONObject().put("id", id).put("extra", extra);
        return new Intent(Intent.ACTION_MAIN).putExtra(ID, id).putExtra(ACTION, verb)
            .putExtra(JSON, notification.toString()).putExtra(REMOVABLE, incoming.getBooleanExtra(REMOVABLE, true));
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            // Recreating this short-lived relay must not issue another action.
            if (state != null) return;
            Intent action = validatedAction(getIntent());
            if (action == null) return;
            String token = issue(action);
            startActivity(new Intent(this, MainActivity.class).setAction(Intent.ACTION_MAIN)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(HANDOFF, token));
        } catch (Exception malformed) {
            // Reject malformed or failed handoffs without logging payloads.
        } finally {
            finish();
        }
    }
}
