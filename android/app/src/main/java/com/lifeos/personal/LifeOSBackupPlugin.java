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

@CapacitorPlugin(name = "LifeOSBackup")
public class LifeOSBackupPlugin extends Plugin {

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

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        startActivityForResult(call, intent, "handleSaveFileResult");
    }

    @ActivityCallback
    private void handleSaveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

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

            if (output == null) {
                throw new IllegalStateException(
                    "Android could not open the selected destination."
                );
            }

            output.write(bytes);
            output.flush();

        } catch (Exception error) {
            call.reject("Could not save the backup file.", error);
            return;
        }

        // The output stream has closed successfully at this point.
        JSObject response = new JSObject();
        response.put("saved", true);
        response.put("cancelled", false);
        response.put("bytesWritten", bytes.length);
        call.resolve(response);
    }
}
