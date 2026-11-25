package com.lifeos.personal;

import android.content.ClipData;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayDeque;
import java.util.Iterator;
import java.util.UUID;

@CapacitorPlugin(name = "SmartImportShare")
public class SmartImportSharePlugin extends Plugin {
    private static final int MAX_TEXT = 2000;
    private static final int MAX_PENDING = 3;
    private static final long TTL_MS = 5 * 60 * 1000L;
    private static final ArrayDeque<Alert> pending = new ArrayDeque<>();
    private static final Handler expiry = new Handler(Looper.getMainLooper());

    private static final class Alert {
        final String id = UUID.randomUUID().toString();
        final String text;
        final long expiresAt = SystemClock.elapsedRealtime() + TTL_MS;
        final Runnable expire = () -> remove(id);

        Alert(String text) { this.text = text; }
    }

    static Intent consumeShareIntent(Intent intent) {
        if (intent == null) return null;
        if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) return new Intent(Intent.ACTION_MAIN);
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return intent;
        try {
            if ("text/plain".equalsIgnoreCase(intent.getType()) && intent.getData() == null
                    && !intent.hasExtra(Intent.EXTRA_STREAM) && containsOnlyText(intent)) {
                CharSequence payload = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
                if (payload != null && payload.length() > 0 && payload.length() <= MAX_TEXT) {
                    String text = payload.toString();
                    if (isSafeText(text)) enqueue(text.trim());
                }
            }
        } catch (RuntimeException ignored) {
            // Exported intents can carry malformed parcels. Never log the payload.
        }
        // Do not retain the shared extras in the Activity or pass them to other plugins.
        return new Intent(Intent.ACTION_MAIN);
    }

    private static boolean containsOnlyText(Intent intent) {
        ClipData clip = intent.getClipData();
        if (clip == null) return true;
        if (clip.getItemCount() != 1) return false;
        ClipData.Item item = clip.getItemAt(0);
        return item.getUri() == null && item.getIntent() == null;
    }

    static boolean isSafeText(String text) {
        if (text.length() > MAX_TEXT || text.trim().isEmpty()) return false;
        for (int offset = 0; offset < text.length();) {
            int code = text.codePointAt(offset);
            if ((Character.isISOControl(code) && code != 10 && code != 13 && code != 9)
                    || (code >= 0x202A && code <= 0x202E) || (code >= 0x2066 && code <= 0x2069)
                    || (code >= 0xD800 && code <= 0xDFFF)) return false;
            offset += Character.charCount(code);
        }
        return true;
    }

    private static synchronized void enqueue(String text) {
        pruneExpired();
        if (pending.size() >= MAX_PENDING) return;
        for (Alert alert : pending) if (alert.text.equals(text)) return;
        Alert alert = new Alert(text);
        pending.addLast(alert);
        expiry.postDelayed(alert.expire, TTL_MS);
    }

    private static synchronized void remove(String id) {
        for (Iterator<Alert> iterator = pending.iterator(); iterator.hasNext();) {
            Alert alert = iterator.next();
            if (!alert.id.equals(id)) continue;
            iterator.remove();
            expiry.removeCallbacks(alert.expire);
            return;
        }
    }

    private static void pruneExpired() {
        long now = SystemClock.elapsedRealtime();
        while (!pending.isEmpty() && pending.peekFirst().expiresAt <= now) {
            expiry.removeCallbacks(pending.removeFirst().expire);
        }
    }

    private static synchronized Alert next() {
        pruneExpired();
        return pending.peekFirst();
    }

    void signalAvailable() {
        notifyListeners("alertAvailable", new JSObject());
    }

    @PluginMethod
    public void status(PluginCall call) {
        Alert alert = next();
        call.resolve(alert == null ? new JSObject() : new JSObject().put("id", alert.id));
    }

    @PluginMethod
    public void peek(PluginCall call) {
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("Protected review is unavailable.");
            return;
        }
        MainActivity activity = (MainActivity) getActivity();
        activity.runOnUiThread(() -> {
            if (!activity.isProtectingSharedAlert()) {
                call.reject("Protected review is unavailable.");
                return;
            }
            Alert alert = next();
            call.resolve(alert == null ? new JSObject() : new JSObject().put("id", alert.id).put("text", alert.text));
        });
    }

    @PluginMethod
    public void acknowledge(PluginCall call) {
        remove(call.getString("id"));
        call.resolve();
    }
}
