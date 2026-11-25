package com.lifeos.personal;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

final class BankSmsQueue {
    private static final String KEY = "lifeos_private_sms_staging_v1";
    private static final long RETENTION = 72L * 60 * 60 * 1000;
    private static final int CAPACITY = 32;
    private static final int MAX_RECEIPTS = 96;
    private static final Pattern FINANCIAL = Pattern.compile(
        "₹|\\b(?:INR|USD|EUR|GBP|Rs\\.?|JPY|AED|KWD)\\s*\\d|\\b\\d[\\d.,]*\\s+(?:INR|USD|EUR|GBP|JPY|AED|KWD)\\b",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern EVENT = Pattern.compile(
        "\\b(?:debit(?:ed)?|credit(?:ed)?|paid|spent|withdraw\\w*|received|purchase\\w*|refund\\w*|revers\\w*|transfer\\w*|failed|pending|initiated|authori[sz]\\w*|charg(?:e|es|ed)|UPI\\s+(?:CR|DR))\\b",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern CONTEXT = Pattern.compile(
        "\\b(?:bank|acct|account|a/c|card|upi|neft|imps|ach|atm|rtgs|vpa|nach)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern EXCLUDED = Pattern.compile(
        "\\b(?:OTP|verification code|one[- ]time|promo(?:tion)?|loan offer|pre[- ]?approved loan|apply now)\\b",
        Pattern.CASE_INSENSITIVE);

    private BankSmsQueue() {}

    static SharedPreferences settings(Context context) {
        return context.getSharedPreferences(KEY, Context.MODE_PRIVATE);
    }

    static boolean permitted(Context context) {
        return supported(context) && context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean supported(Context context) {
        return context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_TELEPHONY);
    }

    static synchronized boolean enabled(Context context) {
        SharedPreferences prefs = settings(context);
        if (!prefs.getBoolean("enabled", false)) return false;
        if (permitted(context)) return prefs.contains("vault") && context.getPackageManager().getComponentEnabledSetting(
            new ComponentName(context, BankSmsReceiver.class)) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
        disable(context);
        return false;
    }

    static synchronized void disable(Context context) {
        boolean saved = settings(context).edit().putBoolean("enabled", false).commit();
        receiver(context, PackageManager.COMPONENT_ENABLED_STATE_DISABLED);
        if (!saved) throw new IllegalStateException("Could not save SMS monitoring status.");
    }

    static synchronized void bind(Context context, String vault) {
        SharedPreferences prefs = settings(context);
        if (vault.equals(prefs.getString("vault", ""))) return;
        disable(context);
        file(context).delete();
        if (!prefs.edit().putString("vault", vault).commit()) throw new IllegalStateException("Could not bind the SMS queue.");
    }

    static synchronized void enable(Context context, String vault) throws Exception {
        if (!permitted(context)) return;
        bind(context, vault);
        key();
        if (!settings(context).edit().putBoolean("enabled", true).commit()) throw new IllegalStateException("Could not enable monitoring.");
        receiver(context, PackageManager.COMPONENT_ENABLED_STATE_ENABLED);
    }

    private static void receiver(Context context, int state) {
        context.getPackageManager().setComponentEnabledSetting(new ComponentName(context, BankSmsReceiver.class),
            state, PackageManager.DONT_KILL_APP);
    }

    /**
     * Intentionally coarse prefilter. The authenticated review uses the canonical TypeScript
     * parser, including its conservative classification and historical deduplication.
     */
    static synchronized boolean stage(Context context, String raw) throws Exception {
        if (!enabled(context) || !SmartImportSharePlugin.isSafeText(raw) ||
                EXCLUDED.matcher(raw).find() || !FINANCIAL.matcher(raw).find() || !EVENT.matcher(raw).find()
                || !CONTEXT.matcher(raw).find()) return false;
        String message = raw.trim().replaceAll("\\s+", " ");
        String digest = Base64.encodeToString(MessageDigest.getInstance("SHA-256")
            .digest(message.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        JSONArray rows = current(context);
        int pending = 0;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i);
            if (digest.equals(row.optString("digest"))) return false;
            if (row.has("text")) pending++;
        }
        if (pending >= CAPACITY) return false;
        if (rows.length() >= MAX_RECEIPTS) {
            for (int i = 0; i < rows.length(); i++) {
                if (!rows.getJSONObject(i).has("text")) { rows.remove(i); break; }
            }
        }
        rows.put(new JSONObject().put("id", UUID.randomUUID().toString())
            .put("received", System.currentTimeMillis()).put("digest", digest).put("text", message));
        save(context, rows);
        return true;
    }

    static synchronized JSONArray list(Context context, String vault) throws Exception {
        bind(context, vault);
        JSONArray rows = current(context);
        JSONArray pending = new JSONArray();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i);
            if (row.has("text")) pending.put(new JSONObject().put("id", row.getString("id")).put("text", row.getString("text")));
        }
        return pending;
    }

    static synchronized void remove(Context context, String vault, String id) throws Exception {
        bind(context, vault);
        if (id == null) {
            file(context).delete();
            return;
        }
        JSONArray rows = current(context);
        for (int i = 0; i < rows.length(); i++) {
            if (id.equals(rows.getJSONObject(i).getString("id"))) {
                rows.getJSONObject(i).remove("text");
                save(context, rows);
                return;
            }
        }
    }

    private static AtomicFile file(Context context) {
        return new AtomicFile(new File(context.getNoBackupFilesDir(), "bank-sms-queue.bin"));
    }

    private static SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY)) return (SecretKey) store.getKey(KEY, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }

    private static JSONArray current(Context context) throws Exception {
        AtomicFile atomic = file(context);
        byte[] disk;
        try { disk = atomic.readFully(); }
        catch (java.io.FileNotFoundException empty) { return new JSONArray(); }
        if (disk.length < 29 || disk.length > 300000 || disk[0] != 1) throw new IllegalStateException("Invalid SMS staging file.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, disk, 1, 12));
        cipher.updateAAD(settings(context).getString("vault", "").getBytes(StandardCharsets.UTF_8));
        byte[] clear = cipher.doFinal(disk, 13, disk.length - 13);
        try {
            JSONArray rows = new JSONArray(new String(clear, StandardCharsets.UTF_8));
            long now = System.currentTimeMillis();
            boolean changed = false;
            for (int i = rows.length() - 1; i >= 0; i--) {
                long age = now - rows.getJSONObject(i).getLong("received");
                if (age >= RETENTION || age < 0) { rows.remove(i); changed = true; }
            }
            if (changed) save(context, rows);
            return rows;
        } finally {
            Arrays.fill(clear, (byte) 0);
        }
    }

    private static void save(Context context, JSONArray rows) throws Exception {
        AtomicFile atomic = file(context);
        if (rows.length() == 0) { atomic.delete(); return; }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(settings(context).getString("vault", "").getBytes(StandardCharsets.UTF_8));
        byte[] clear = rows.toString().getBytes(StandardCharsets.UTF_8);
        try {
            byte[] encrypted = cipher.doFinal(clear);
            byte[] iv = cipher.getIV();
            if (iv.length != 12) throw new IllegalStateException("Invalid staging nonce.");
            FileOutputStream stream = atomic.startWrite();
            try {
                stream.write(1);
                stream.write(iv);
                stream.write(encrypted);
                atomic.finishWrite(stream);
            } catch (Exception error) {
                atomic.failWrite(stream);
                throw error;
            }
        } finally {
            Arrays.fill(clear, (byte) 0);
        }
    }
}
