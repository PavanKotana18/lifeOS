package com.lifeos.personal;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "LifeOSBackup")
public class LifeOSBackupPlugin extends Plugin {
    private final Map<String, Long> recoveryExportTokens = new ConcurrentHashMap<>();

    @PluginMethod
    public void saveFile(PluginCall call) {
        String contents = call.getString("contents");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType");

        if (contents == null || fileName == null || mimeType == null) {
            call.reject("Backup content, filename and MIME type are required.");
            return;
        }

        if (fileName.trim().isEmpty()
            || fileName.length() > 128
            || fileName.contains("/")
            || fileName.contains("\\")
            || !("application/json".equals(mimeType)
                || "text/csv".equals(mimeType))) {
            call.reject("Invalid backup filename or file type.");
            return;
        }

        boolean preserveRecovery = Boolean.TRUE.equals(call.getBoolean("preservePendingRecovery"))
            && "application/json".equals(mimeType)
            && fileName.startsWith("lifeos-recovery-kit-");
        long recoveryExportToken = preserveRecovery ? RecoveryExportActivityGuard.begin() : 0L;
        if (recoveryExportToken != 0L) recoveryExportTokens.put(call.getCallbackId(), recoveryExportToken);

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        try {
            startActivityForResult(call, intent, "handleSaveFileResult");
        } catch (RuntimeException error) {
            finishRecoveryExport(call);
            call.reject("Could not open the Android save picker.");
        }
    }

    @ActivityCallback
    private void handleSaveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            RecoveryExportActivityGuard.endCurrent();
            return;
        }
        try {
            if (result == null
                || result.getResultCode() != Activity.RESULT_OK
                || result.getData() == null
                || result.getData().getData() == null) {
                JSObject response = new JSObject();
                response.put("saved", false);
                response.put("cancelled", true);
                call.resolve(response);
                return;
            }

            Uri destination = result.getData().getData();
            String contents = call.getString("contents");
            if (contents == null) {
                call.reject("Backup content is unavailable.");
                return;
            }

            byte[] bytes = contents.getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = getContext()
                    .getContentResolver()
                    .openOutputStream(destination, "w")) {
                if (output == null) throw new IllegalStateException("Android could not open the selected destination.");
                output.write(bytes);
                output.flush();
            }

            // The output stream has closed successfully at this point.
            JSObject response = new JSObject();
            response.put("saved", true);
            response.put("cancelled", false);
            response.put("bytesWritten", bytes.length);
            call.resolve(response);
        } catch (Exception error) {
            // Never include recovery contents or provider exception text in the UI/logs.
            call.reject("Could not save the backup file.");
        } finally {
            finishRecoveryExport(call);
        }
    }

    private void finishRecoveryExport(PluginCall call) {
        Long token = recoveryExportTokens.remove(call.getCallbackId());
        if (token != null) RecoveryExportActivityGuard.end(token);
    }
}
