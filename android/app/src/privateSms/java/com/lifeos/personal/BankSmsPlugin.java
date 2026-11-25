package com.lifeos.personal;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "BankSms", permissions = @Permission(alias = "incomingSms", strings = Manifest.permission.RECEIVE_SMS))
public final class BankSmsPlugin extends Plugin {
    private static volatile WeakReference<BankSmsPlugin> current = new WeakReference<>(null);

    @Override
    public void load() { current = new WeakReference<>(this); }

    static void queueChanged() {
        BankSmsPlugin plugin = current.get();
        android.app.Activity activity = plugin == null ? null : plugin.getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                if (current.get() == plugin && !activity.isDestroyed()) {
                    plugin.notifyListeners("queueChanged", new JSObject());
                }
            });
        }
    }

    private String vault() throws Exception {
        PluginHandle crypto = getBridge().getPlugin("LifeOSCrypto");
        if (crypto == null || !(crypto.getInstance() instanceof LifeOSCryptoPlugin)) return null;
        return ((LifeOSCryptoPlugin) crypto.getInstance()).smsVaultBinding();
    }

    private String requireVault() throws Exception {
        String vault = vault();
        if (vault == null) throw new IllegalStateException("Vault unavailable.");
        return vault;
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            String vault = vault();
            int count = vault == null ? 0 : BankSmsQueue.list(getContext(), vault).length();
            boolean granted = BankSmsQueue.permitted(getContext());
            boolean requested = BankSmsQueue.settings(getContext()).getBoolean("requested", false);
            call.resolve(new JSObject().put("granted", granted)
                .put("supported", BankSmsQueue.supported(getContext()))
                .put("requested", requested)
                .put("requestable", granted || !requested || getActivity().shouldShowRequestPermissionRationale(Manifest.permission.RECEIVE_SMS))
                .put("enabled", vault != null && BankSmsQueue.enabled(getContext())).put("count", count));
        } catch (Exception error) { call.reject("Could not inspect the protected SMS queue."); }
    }

    @PluginMethod
    public void enable(PluginCall call) {
        try {
            if (!BankSmsQueue.supported(getContext())) { status(call); return; }
            String vault = requireVault();
            if (!BankSmsQueue.permitted(getContext())) {
                BankSmsQueue.settings(getContext()).edit().putBoolean("requested", true).apply();
                requestPermissionForAlias("incomingSms", call, "permissionResult");
                return;
            }
            BankSmsQueue.enable(getContext(), vault);
            status(call);
        } catch (Exception error) { call.reject("Unlock LifeOS before enabling SMS monitoring."); }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        // The system dialog can trigger the normal background lock. In that
        // case consent is recorded by Android and the user can finish enabling
        // after unlocking, without an automatic request from the receiver.
        try {
            String vault = vault();
            if (vault != null && BankSmsQueue.permitted(getContext())) BankSmsQueue.enable(getContext(), vault);
            status(call);
        } catch (Exception error) { call.reject("Could not finish enabling SMS monitoring."); }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        try { BankSmsQueue.disable(getContext()); status(call); }
        catch (Exception error) { call.reject("Could not turn off SMS monitoring."); }
    }

    @PluginMethod
    public void list(PluginCall call) {
        if (!(getActivity() instanceof MainActivity)) { call.reject("Protected review is unavailable."); return; }
        MainActivity activity = (MainActivity) getActivity();
        activity.runOnUiThread(() -> {
            try {
                if (!activity.isProtectingSharedAlert()) { call.reject("Protected review is unavailable."); return; }
                call.resolve(new JSObject().put("rows", BankSmsQueue.list(getContext(), requireVault())));
            } catch (Exception error) { call.reject("Unlock LifeOS to review bank alerts."); }
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        try {
            String id = call.getString("id");
            if (id == null || !id.matches("[a-f0-9-]{36}")) { call.reject("Invalid suggestion."); return; }
            BankSmsQueue.remove(getContext(), requireVault(), id);
            queueChanged();
            status(call);
        } catch (Exception error) { call.reject("Could not dismiss the alert."); }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try { BankSmsQueue.remove(getContext(), requireVault(), null); queueChanged(); status(call); }
        catch (Exception error) { call.reject("Could not clear the SMS queue."); }
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getContext().getPackageName(), null)));
            call.resolve();
        } catch (Exception error) { call.reject("Android app settings are unavailable."); }
    }
}
