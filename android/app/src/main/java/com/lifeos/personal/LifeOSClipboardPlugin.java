package com.lifeos.personal;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.os.PersistableBundle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Clipboard operations for sensitive one-time recovery material. */
@CapacitorPlugin(name = "LifeOSClipboard")
public final class LifeOSClipboardPlugin extends Plugin {
    private static final String RECOVERY_CODE_PATTERN = "[A-Za-z0-9_-]{43}";

    static ClipData createSensitiveClip(String text) {
        ClipData clip = ClipData.newPlainText("LifeOS recovery code", text);
        PersistableBundle extras = new PersistableBundle();
        // Use the documented extra string so this also works below API 33.
        extras.putBoolean("android.content.extra.IS_SENSITIVE", true);
        clip.getDescription().setExtras(extras);
        return clip;
    }

    @PluginMethod
    public void copyRecoveryCode(PluginCall call) {
        String code = call.getString("code");
        if (code == null || !code.matches(RECOVERY_CODE_PATTERN)) {
            call.reject("Recovery code could not be copied.");
            return;
        }
        try {
            ClipboardManager clipboard = (ClipboardManager) getContext()
                .getSystemService(android.content.Context.CLIPBOARD_SERVICE);
            if (clipboard == null) throw new IllegalStateException("Clipboard unavailable");
            clipboard.setPrimaryClip(createSensitiveClip(code));
            JSObject result = new JSObject();
            result.put("copied", true);
            call.resolve(result);
        } catch (Exception error) {
            // Do not log or return the recovery code or platform exception text.
            call.reject("Recovery code could not be copied.");
        }
    }

    @PluginMethod
    public void clearRecoveryCodeIfMatches(PluginCall call) {
        String code = call.getString("code");
        if (code == null || !code.matches(RECOVERY_CODE_PATTERN)) {
            call.reject("Recovery clipboard could not be cleared.");
            return;
        }
        try {
            ClipboardManager clipboard = (ClipboardManager) getContext()
                .getSystemService(android.content.Context.CLIPBOARD_SERVICE);
            if (clipboard == null) throw new IllegalStateException("Clipboard unavailable");
            ClipData current = clipboard.getPrimaryClip();
            if (current != null && current.getItemCount() == 1 &&
                code.contentEquals(current.getItemAt(0).coerceToText(getContext()))) {
                clipboard.clearPrimaryClip();
            }
            JSObject result = new JSObject();
            result.put("cleared", true);
            call.resolve(result);
        } catch (Exception error) {
            // Clipboard cleanup is best effort and must not leak sensitive data.
            call.reject("Recovery clipboard could not be cleared.");
        }
    }
}
