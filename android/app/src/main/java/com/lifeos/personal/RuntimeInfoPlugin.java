package com.lifeos.personal;

import android.os.Build;
import android.os.PowerManager;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.view.View;
import android.view.WindowInsets;

/** Exposes non-identifying runtime build facts for support diagnostics. */
@CapacitorPlugin(name = "LifeOSRuntimeInfo")
public class RuntimeInfoPlugin extends Plugin {
    static float pixelsToDp(int pixels, float density) {
        return density > 0 && Float.isFinite(density) ? pixels / density : 0f;
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                info = getContext().getPackageManager().getPackageInfo(
                    getContext().getPackageName(), PackageManager.PackageInfoFlags.of(0));
            } else {
                info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            }
            JSObject result = new JSObject();
            result.put("androidApi", Build.VERSION.SDK_INT);
            result.put("packageName", getContext().getPackageName());
            result.put("versionName", info.versionName == null ? "unknown" : info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode() : info.versionCode);
            PowerManager power = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
            result.put("batteryOptimizationExempt", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && power != null
                ? power.isIgnoringBatteryOptimizations(getContext().getPackageName()) : false);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read app runtime version information.", error);
        }
    }

    /** Returns only Android's system-reserved horizontal gesture areas in CSS-like dp units. */
    @PluginMethod
    public void getSystemGestureInsets(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                View decor = getActivity().getWindow().getDecorView();
                WindowInsets windowInsets = decor.getRootWindowInsets();
                if (windowInsets == null) {
                    call.resolve(new JSObject());
                    return;
                }
                Insets gestures;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    gestures = windowInsets.getInsets(WindowInsets.Type.systemGestures());
                } else {
                    gestures = windowInsets.getSystemGestureInsets();
                }
                float density = getContext().getResources().getDisplayMetrics().density;
                JSObject result = new JSObject();
                result.put("left", pixelsToDp(gestures.left, density));
                result.put("right", pixelsToDp(gestures.right, density));
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Could not read Android system gesture insets.", error);
            }
        });
    }
}
