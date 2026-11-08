package com.lifeos.personal;

import android.content.res.Configuration;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemAppearance")
public class SystemAppearancePlugin extends Plugin {
    @PluginMethod
    public void getSystemAppearance(PluginCall call) {
        int nightMode = getContext().getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK;
        JSObject result = new JSObject();
        result.put("dark", nightMode == Configuration.UI_MODE_NIGHT_YES);
        call.resolve(result);
    }
}
