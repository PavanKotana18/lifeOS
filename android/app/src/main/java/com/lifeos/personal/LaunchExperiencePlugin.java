package com.lifeos.personal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Exposes only launch metadata; it cannot change authentication or storage state. */
@CapacitorPlugin(name = "LaunchExperience")
public class LaunchExperiencePlugin extends Plugin {
    @PluginMethod
    public void getLaunchInfo(PluginCall call) {
        JSObject result = new JSObject();
        boolean coldStart = getActivity() instanceof MainActivity
            && ((MainActivity) getActivity()).isColdLaunch();
        result.put("coldStart", coldStart);
        call.resolve(result);
    }

    @PluginMethod
    public void releaseNativeSplash(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).releaseLaunchSplash();
        }
        call.resolve();
    }
}
