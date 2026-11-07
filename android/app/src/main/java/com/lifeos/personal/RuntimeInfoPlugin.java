package com.lifeos.personal;

import android.os.Build;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Exposes non-identifying runtime build facts for support diagnostics. */
@CapacitorPlugin(name = "LifeOSRuntimeInfo")
public class RuntimeInfoPlugin extends Plugin {
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
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read app runtime version information.", error);
        }
    }
}
