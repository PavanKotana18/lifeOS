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

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "StorageAccess")
public class StorageAccessPlugin extends Plugin {

    private static final int MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB safety limit

    @PluginMethod
    public void exportFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        String mimeType = call.getString("mimeType", "application/json");

        // Input validation & boundary checks
        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("File name cannot be null or empty");
            return;
        }

        // Sanitize against directory traversal attacks and null bytes
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\") || fileName.contains("\0")) {
            call.reject("Invalid file name: directory traversal or null bytes detected");
            return;
        }

        if (content == null) {
            call.reject("Content cannot be null");
            return;
        }

        byte[] contentBytes = content.getBytes(StandardCharsets.UTF_8);
        if (contentBytes.length > MAX_FILE_SIZE_BYTES) {
            call.reject("Content exceeds maximum permitted file size of 50MB");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, fileName);

            startActivityForResult(call, intent, "handleExportResult");
        } catch (Exception e) {
            call.reject("Storage Access Framework initiation failed: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void handleExportResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri uri = result.getData().getData();
            if (uri != null) {
                String content = call.getString("content", "");
                byte[] contentBytes = content.getBytes(StandardCharsets.UTF_8);
                boolean writeCompleted = false;

                try {
                    try (OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                        if (os != null) {
                            os.write(contentBytes);
                            os.flush();
                            writeCompleted = true;
                        } else {
                            call.reject("Failed to open output stream for selected URI");
                            return;
                        }
                    } // Stream close() is executed here deterministically
                } catch (Exception e) {
                    call.reject("Failed writing content to storage: " + e.getMessage(), e);
                    return;
                }

                // Resolve only after stream close succeeded
                if (writeCompleted) {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("uri", uri.toString());
                    ret.put("bytesWritten", contentBytes.length);
                    call.resolve(ret);
                    return;
                }
            }
        }

        // User cancelled or back was pressed
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("cancelled", true);
        ret.put("message", "User cancelled storage selection");
        call.resolve(ret);
    }

    @PluginMethod
    public void importFile(PluginCall call) {
        String mimeType = call.getString("mimeType", "application/json");
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);

            startActivityForResult(call, intent, "handleImportResult");
        } catch (Exception e) {
            call.reject("Storage Access Framework file picker initiation failed: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void handleImportResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri uri = result.getData().getData();
            if (uri != null) {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                long totalBytes = 0;
                boolean readCompleted = false;

                try {
                    try (InputStream is = getContext().getContentResolver().openInputStream(uri)) {
                        if (is == null) {
                            call.reject("Failed to open input stream for selected URI");
                            return;
                        }

                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = is.read(buffer)) != -1) {
                            totalBytes += bytesRead;
                            if (totalBytes > MAX_FILE_SIZE_BYTES) {
                                call.reject("Imported file exceeds maximum allowed size of 50MB");
                                return;
                            }
                            baos.write(buffer, 0, bytesRead);
                        }
                        readCompleted = true;
                    } // Stream close() is executed here deterministically
                } catch (Exception e) {
                    call.reject("Failed reading file content: " + e.getMessage(), e);
                    return;
                }

                // Resolve only after stream close succeeded
                if (readCompleted) {
                    String content = new String(baos.toByteArray(), StandardCharsets.UTF_8);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("content", content);
                    ret.put("bytesRead", totalBytes);
                    ret.put("uri", uri.toString());
                    call.resolve(ret);
                    return;
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("cancelled", true);
        ret.put("message", "User cancelled file selection");
        call.resolve(ret);
    }
}
