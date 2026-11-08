package com.lifeos.personal;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenCaptureProtection")
public class ScreenCaptureProtectionPlugin extends Plugin {
    @PluginMethod
    public void setSensitive(PluginCall call) {
        Boolean sensitive = call.getBoolean("sensitive");
        // Missing or malformed state must fail closed.
        boolean protect = sensitive == null || sensitive;
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("Screenshot protection is unavailable; the window remains protected.");
            return;
        }
        MainActivity activity = (MainActivity) getActivity();
        activity.runOnUiThread(() -> {
            activity.setSensitiveScreen(protect);
            call.resolve();
        });
    }

    @PluginMethod
    public void confirmResume(PluginCall call) {
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("Resume validation is unavailable; the window remains protected.");
            return;
        }
        MainActivity activity = (MainActivity) getActivity();
        activity.runOnUiThread(() -> {
            activity.confirmResumeValidation();
            call.resolve();
        });
    }
}
