package com.lifeos.personal;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.concurrent.Executor;
import java.lang.Runnable;
import java.util.function.Consumer;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

@CapacitorPlugin(name = "LifeOSCrypto")
public class LifeOSCryptoPlugin extends Plugin {

    private static final String KEY_ALIAS = "lifeos_database_master_v1";
    private static final String PREFS = "lifeos_crypto_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int KEY_SIZE = 256;
    private static final int IV_SIZE = 12;
    private static final int TAG_SIZE = 128;
    private static final int TAG_BYTES = TAG_SIZE / 8;
    private static final int MAX_PLAINTEXT_BYTES = 1024 * 1024;
    private static final int MAX_AAD_BYTES = 4096;
    private static final int MAX_CIPHERTEXT_BYTES = MAX_PLAINTEXT_BYTES + TAG_BYTES;

    private final Object keyLock = new Object();
    private final ReentrantReadWriteLock cryptoLock = new ReentrantReadWriteLock();
    private byte[] dataKey;
    // A recovered key stays quarantined until device Keystore re-binding succeeds.
    private boolean recoveryNeedsRebind;
    private boolean setupInProgress;
    private String pendingRecoverySalt;
    private String pendingRecoveryIv;
    private String pendingRecoveryWrapped;
    private long lockGeneration;

    private KeyStore keyStore() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        return store;
    }

    private SecretKey getOrCreateMasterKey() throws Exception {
        KeyStore store = keyStore();

        if (store.containsAlias(KEY_ALIAS)) {
            return (SecretKey) store.getKey(KEY_ALIAS, null);
        }

        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );

        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true);

        if (Build.VERSION.SDK_INT >= 30) {
            builder.setUserAuthenticationParameters(
                0,
                KeyProperties.AUTH_BIOMETRIC_STRONG
            );
        } else {
            builder.setUserAuthenticationValidityDurationSeconds(-1);
        }

        generator.init(builder.build());
        return generator.generateKey();
    }


    private boolean isPermanentlyInvalidated(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if ("android.security.keystore.KeyPermanentlyInvalidatedException"
                    .equals(current.getClass().getName())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    // Called only after the recovery envelope has successfully authenticated
    // and the recovered database key has entered quarantine.
    private SecretKey getOrCreateMasterKeyForRecovery() throws Exception {
        KeyStore store = keyStore();
        android.content.SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS, 0);

        boolean hasWrapped = prefs.contains("wrapped_key");
        boolean hasIv = prefs.contains("wrapped_iv");
        boolean hasVersion = prefs.contains("key_version");

        if (hasWrapped != hasIv ||
            (hasVersion && (!hasWrapped || !hasIv)) ||
            (hasWrapped && (
                !hasVersion || prefs.getInt("key_version", -1) != 1
            ))) {
            throw new IllegalStateException(
                "Inconsistent local Keystore wrapper state; refusing recovery"
            );
        }

        if (store.containsAlias(KEY_ALIAS)) {
            SecretKey existing;

            try {
                existing = (SecretKey) store.getKey(KEY_ALIAS, null);

                if (existing == null) {
                    throw new IllegalStateException(
                        "Existing Keystore alias returned no key"
                    );
                }

                Cipher probe = Cipher.getInstance(TRANSFORMATION);
                probe.init(Cipher.ENCRYPT_MODE, existing);

            } catch (Exception e) {
                if (!isPermanentlyInvalidated(e)) {
                    throw e;
                }

                // Delete only when Android explicitly reports permanent
                // biometric/key invalidation. Generic errors never reach here.
                store.deleteEntry(KEY_ALIAS);

                boolean cleared = prefs.edit()
                    .remove("wrapped_key")
                    .remove("wrapped_iv")
                    .remove("key_version")
                    .commit();

                if (!cleared) {
                    throw new IllegalStateException(
                        "Unable to clear invalidated local wrapper metadata"
                    );
                }

                return getOrCreateMasterKey();
            }

            if (hasWrapped) {
                throw new IllegalStateException(
                    "A healthy local wrapper already exists; refusing replacement"
                );
            }

            // A usable orphaned alias can safely protect the recovered key.
            return existing;
        }

        // A missing alias means any persisted local wrapper is unusable.
        // Recovery has already authenticated the database key at this point.
        if (hasWrapped || hasIv || hasVersion) {
            boolean cleared = prefs.edit()
                .remove("wrapped_key")
                .remove("wrapped_iv")
                .remove("key_version")
                .commit();

            if (!cleared) {
                throw new IllegalStateException(
                    "Unable to clear stale local wrapper metadata"
                );
            }
        }

        return getOrCreateMasterKey();
    }

    private void runFailure(Runnable onFailure) {
        try {
            onFailure.run();
        } catch (Exception ignored) {
            // Cleanup must not interrupt authentication error handling.
        }
    }

    private void authenticate(
        PluginCall call,
        Cipher cipher,
        Consumer<Cipher> onSuccess,
        Runnable onFailure
    ) {
        try {
            FragmentActivity activity = (FragmentActivity) getActivity();
            if (activity == null) {
                runFailure(onFailure);
                call.reject("Authentication activity unavailable");
                return;
            }

            int availability = BiometricManager.from(activity).canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
            );

            if (availability != BiometricManager.BIOMETRIC_SUCCESS) {
                runFailure(onFailure);
                call.reject("Strong biometric authentication unavailable: " + availability);
                return;
            }

            Executor executor = ContextCompat.getMainExecutor(activity);

            BiometricPrompt prompt = new BiometricPrompt(
                activity,
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(
                        @NonNull BiometricPrompt.AuthenticationResult result
                    ) {
                        super.onAuthenticationSucceeded(result);
                        try {
                            BiometricPrompt.CryptoObject object = result.getCryptoObject();
                            if (object == null || object.getCipher() == null) {
                                  runFailure(onFailure);
                                call.reject("Authenticated cryptographic operation unavailable");
                                return;
                            }
                            onSuccess.accept(object.getCipher());
                          } catch (Exception e) {
                              runFailure(onFailure);
                            call.reject("Cryptographic operation failed");
                        }
                    }

                    @Override
                    public void onAuthenticationError(
                        int errorCode,
                        @NonNull CharSequence message
                    ) {
                        super.onAuthenticationError(errorCode, message);
                        runFailure(onFailure);
                        JSObject response = new JSObject();
                        response.put("success", false);
                        response.put("errorCode", errorCode);
                        response.put("message", message.toString());
                        call.resolve(response);
                    }
                }
            );

            BiometricPrompt.PromptInfo info =
                new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Unlock LifeOS")
                    .setSubtitle("Authenticate to protect your personal data")
                    .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG
                    )
                    .setNegativeButtonText("Cancel")
                    .build();

            prompt.authenticate(info, new BiometricPrompt.CryptoObject(cipher));

        } catch (Exception e) {
            runFailure(onFailure);
            call.reject("Biometric cryptographic authentication failed");
        }
    }


    private static final int RECOVERY_KDF_ITERATIONS = 600000;
    private static final int RECOVERY_KEY_BITS = 256;
    private static final String RECOVERY_AAD = "LifeOS recovery envelope v1";

    private byte[] deriveRecoveryKey(String recoveryCode, byte[] salt)
        throws Exception {
        if (recoveryCode == null ||
            !recoveryCode.matches("[A-Za-z0-9_-]{43}") ||
            salt == null || salt.length != 16) {
            throw new IllegalArgumentException("Invalid recovery parameters");
        }

        byte[] password = recoveryCode.getBytes(StandardCharsets.US_ASCII);
        byte[] block = new byte[salt.length + 4];
        byte[] u = null;
        byte[] t = null;

        try {
            System.arraycopy(salt, 0, block, 0, salt.length);
            block[block.length - 1] = 1;

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(password, "HmacSHA256"));

            u = mac.doFinal(block);
            t = u.clone();

            for (int i = 1; i < RECOVERY_KDF_ITERATIONS; i++) {
                byte[] next = mac.doFinal(u);
                Arrays.fill(u, (byte) 0);
                u = next;

                for (int j = 0; j < t.length; j++) {
                    t[j] ^= u[j];
                }
            }

            return t.clone();

        } finally {
            Arrays.fill(password, (byte) 0);
            Arrays.fill(block, (byte) 0);
            if (u != null) Arrays.fill(u, (byte) 0);
            if (t != null) Arrays.fill(t, (byte) 0);
        }
    }

    @PluginMethod
    public void prepareRecovery(PluginCall call) {
        byte[] key = getDataKey();
        if (key == null) {
            call.reject("Unlock LifeOS before creating a recovery code");
            return;
        }

        byte[] codeBytes = new byte[32];
        byte[] salt = new byte[16];
        byte[] wrappingKey = null;
        byte[] iv = new byte[IV_SIZE];
        byte[] wrapped = null;

        try {
            android.content.SharedPreferences prefs =
                getContext().getSharedPreferences(PREFS, 0);

            synchronized (keyLock) {
                if (pendingRecoverySalt != null ||
                    pendingRecoveryIv != null ||
                    pendingRecoveryWrapped != null) {
                    call.reject("A recovery code is already awaiting confirmation");
                    return;
                }
            }

            if (prefs.contains("recovery_wrapped") ||
                prefs.contains("recovery_salt") ||
                prefs.contains("recovery_iv")) {
                call.reject("A recovery envelope already exists");
                return;
            }

            SecureRandom random = new SecureRandom();
            random.nextBytes(codeBytes);
            random.nextBytes(salt);
            random.nextBytes(iv);

            String recoveryCode = Base64.encodeToString(
                codeBytes,
                Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
            );

            wrappingKey = deriveRecoveryKey(recoveryCode, salt);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                Cipher.ENCRYPT_MODE,
                new SecretKeySpec(wrappingKey, "AES"),
                new GCMParameterSpec(TAG_SIZE, iv)
            );
            cipher.updateAAD(RECOVERY_AAD.getBytes(StandardCharsets.UTF_8));
            wrapped = cipher.doFinal(key);

            String saltText = Base64.encodeToString(salt, Base64.NO_WRAP);
            String ivText = Base64.encodeToString(iv, Base64.NO_WRAP);
            String wrappedText = Base64.encodeToString(wrapped, Base64.NO_WRAP);

            synchronized (keyLock) {
                if (pendingRecoverySalt != null ||
                    pendingRecoveryIv != null ||
                    pendingRecoveryWrapped != null) {
                    call.reject("Another recovery request is already pending");
                    return;
                }

                pendingRecoverySalt = saltText;
                pendingRecoveryIv = ivText;
                pendingRecoveryWrapped = wrappedText;
            }

            JSObject envelope = new JSObject();
            envelope.put("version", 1);
            envelope.put("kdf", "PBKDF2-HMAC-SHA-256");
            envelope.put("iterations", RECOVERY_KDF_ITERATIONS);
            envelope.put("salt", saltText);
            envelope.put("iv", ivText);
            envelope.put("wrappedKey", wrappedText);

            JSObject response = new JSObject();
            response.put("success", true);
            response.put("recoveryCode", recoveryCode);
            response.put("envelope", envelope);
            call.resolve(response);

        } catch (Exception e) {
            clearPendingRecovery();
            call.reject("Unable to prepare recovery envelope");
        } finally {
            Arrays.fill(key, (byte) 0);
            Arrays.fill(codeBytes, (byte) 0);
            Arrays.fill(salt, (byte) 0);
            Arrays.fill(iv, (byte) 0);
            if (wrappingKey != null) Arrays.fill(wrappingKey, (byte) 0);
            if (wrapped != null) Arrays.fill(wrapped, (byte) 0);
            cryptoLock.readLock().unlock();
        }
    }

    @PluginMethod
    public void confirmRecovery(PluginCall call) {
        cryptoLock.readLock().lock();
        try {
            if (dataKey == null) {
                call.reject("LifeOS is locked");
                return;
            }

            synchronized (keyLock) {
                if (pendingRecoverySalt == null ||
                    pendingRecoveryIv == null ||
                    pendingRecoveryWrapped == null) {
                    call.reject("No pending recovery code to confirm");
                    return;
                }

                android.content.SharedPreferences prefs =
                    getContext().getSharedPreferences(PREFS, 0);

                if (prefs.contains("recovery_wrapped") ||
                    prefs.contains("recovery_salt") ||
                    prefs.contains("recovery_iv")) {
                    clearPendingRecoveryFields();
                    call.reject("A recovery envelope already exists");
                    return;
                }

                boolean persisted = prefs.edit()
                    .putString("recovery_salt", pendingRecoverySalt)
                    .putString("recovery_iv", pendingRecoveryIv)
                    .putString("recovery_wrapped", pendingRecoveryWrapped)
                    .putInt("recovery_version", 1)
                    .putInt("recovery_kdf_iterations", RECOVERY_KDF_ITERATIONS)
                    .commit();

                if (!persisted) {
                    clearPendingRecoveryFields();
                    call.reject("Unable to persist recovery envelope");
                    return;
                }

                clearPendingRecoveryFields();
            }

            JSObject response = new JSObject();
            response.put("success", true);
            call.resolve(response);

        } catch (Exception e) {
            clearPendingRecovery();
            call.reject("Unable to confirm recovery envelope");
        } finally {
            cryptoLock.readLock().unlock();
        }
    }

    private void clearPendingRecoveryFields() {
        pendingRecoverySalt = null;
        pendingRecoveryIv = null;
        pendingRecoveryWrapped = null;
    }

    private void clearPendingRecovery() {
        synchronized (keyLock) {
            clearPendingRecoveryFields();
        }
    }


    @PluginMethod
    public void recoverWithSecret(PluginCall call) {
        long authGeneration = getLockGeneration();

        String recoveryCode = call.getString("recoveryCode");
        JSObject envelope = call.getObject("envelope");

        byte[] salt = null;
        byte[] iv = null;
        byte[] wrapped = null;
        byte[] wrappingKey = null;
        byte[] recovered = null;

        try {
            if (recoveryCode == null ||
                !recoveryCode.matches("[A-Za-z0-9_-]{43}") ||
                envelope == null ||
                envelope.optInt("version", -1) != 1 ||
                !"PBKDF2-HMAC-SHA-256".equals(envelope.getString("kdf")) ||
                envelope.optInt("iterations", -1) != RECOVERY_KDF_ITERATIONS) {
                throw new IllegalArgumentException("Unsupported recovery envelope");
            }

            String saltText = envelope.getString("salt");
            String ivText = envelope.getString("iv");
            String wrappedText = envelope.getString("wrappedKey");

            if (saltText == null || !saltText.matches("[A-Za-z0-9+/]{22}==") ||
                ivText == null || !ivText.matches("[A-Za-z0-9+/]{16}") ||
                wrappedText == null || !wrappedText.matches("[A-Za-z0-9+/]{64}")) {
                throw new IllegalArgumentException("Invalid recovery envelope encoding");
            }

            salt = Base64.decode(saltText, Base64.NO_WRAP);
            iv = Base64.decode(ivText, Base64.NO_WRAP);
            wrapped = Base64.decode(wrappedText, Base64.NO_WRAP);

            if (salt.length != 16 || iv.length != IV_SIZE ||
                wrapped.length != 32 + TAG_BYTES) {
                throw new IllegalArgumentException("Invalid recovery envelope sizes");
            }

            wrappingKey = deriveRecoveryKey(recoveryCode, salt);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                Cipher.DECRYPT_MODE,
                new SecretKeySpec(wrappingKey, "AES"),
                new GCMParameterSpec(TAG_SIZE, iv)
            );
            cipher.updateAAD(RECOVERY_AAD.getBytes(StandardCharsets.UTF_8));
            recovered = cipher.doFinal(wrapped);

            if (recovered.length != 32) {
                throw new IllegalArgumentException("Invalid recovered key size");
            }

            cryptoLock.writeLock().lock();
            try {
                if (lockGeneration != authGeneration) {
                    throw new IllegalStateException("Recovery expired after app lock");
                }
                if (dataKey != null) {
                    throw new IllegalStateException(
                        "Lock the existing session before device recovery"
                    );
                }

                dataKey = recovered.clone();
                recoveryNeedsRebind = true;
            } finally {
                cryptoLock.writeLock().unlock();
            }

            JSObject response = new JSObject();
            response.put("success", true);
            response.put("keyVersion", 1);
            call.resolve(response);

        } catch (Exception e) {
            call.reject("Recovery failed: invalid code, envelope, or app state");
        } finally {
            if (salt != null) Arrays.fill(salt, (byte) 0);
            if (iv != null) Arrays.fill(iv, (byte) 0);
            if (wrapped != null) Arrays.fill(wrapped, (byte) 0);
            if (wrappingKey != null) Arrays.fill(wrappingKey, (byte) 0);
            if (recovered != null) Arrays.fill(recovered, (byte) 0);
        }
    }

    @PluginMethod
    public void rebindLocalKey(PluginCall call) {
        long authGeneration = getLockGeneration();
        byte[] key = null;

        cryptoLock.readLock().lock();
        try {
            if (dataKey == null) {
                call.reject("Recover the database key before local re-binding");
                return;
            }
            key = dataKey.clone();
        } finally {
            cryptoLock.readLock().unlock();
        }

        try {
            SecretKey masterKey = getOrCreateMasterKeyForRecovery();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, masterKey);

            final byte[] keyCopy = key.clone();

            authenticate(call, cipher, authorizedCipher -> {
                byte[] wrapped = null;
                byte[] iv = null;

                cryptoLock.writeLock().lock();
                try {
                    if (lockGeneration != authGeneration || dataKey == null) {
                        throw new IllegalStateException(
                            "Device re-binding expired after app lock"
                        );
                    }

                    wrapped = authorizedCipher.doFinal(keyCopy);
                    iv = authorizedCipher.getIV();

                    boolean persisted = getContext()
                        .getSharedPreferences(PREFS, 0)
                        .edit()
                        .putString(
                            "wrapped_key",
                            Base64.encodeToString(wrapped, Base64.NO_WRAP)
                        )
                        .putString(
                            "wrapped_iv",
                            Base64.encodeToString(iv, Base64.NO_WRAP)
                        )
                        .putInt("key_version", 1)
                        .commit();

                    if (!persisted) {
                        throw new IllegalStateException(
                            "Unable to persist local Keystore wrapper"
                        );
                    }

                    recoveryNeedsRebind = false;

                    JSObject response = new JSObject();
                    response.put("success", true);
                    response.put("keyVersion", 1);
                    call.resolve(response);

                } catch (Exception e) {
                    call.reject("Unable to re-bind the recovered database key");
                } finally {
                    if (wrapped != null) Arrays.fill(wrapped, (byte) 0);
                    if (iv != null) Arrays.fill(iv, (byte) 0);
                    Arrays.fill(keyCopy, (byte) 0);
                    cryptoLock.writeLock().unlock();
                }
            }, () -> Arrays.fill(keyCopy, (byte) 0));

        } catch (Exception e) {
            call.reject("Unable to initialize local Keystore protection");
        } finally {
            Arrays.fill(key, (byte) 0);
        }
    }

    @PluginMethod
    public void setup(PluginCall call) {
        long authGeneration = getLockGeneration();
        synchronized (keyLock) {
            if (setupInProgress) {
                call.reject("Encryption setup is already in progress");
                return;
            }
            setupInProgress = true;
        }

        try {
            android.content.SharedPreferences existingPrefs =
                getContext().getSharedPreferences(PREFS, 0);

            String existingWrapped = existingPrefs.getString("wrapped_key", null);
            String existingIv = existingPrefs.getString("wrapped_iv", null);

            if (existingWrapped != null || existingIv != null) {
                releaseSetupGuard();
                call.reject(
                    "Encryption is already initialized or partially initialized. Refusing to replace the existing key."
                );
                return;
            }

            SecretKey masterKey = getOrCreateMasterKey();

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, masterKey);

            byte[] generatedKey = new byte[32];
            new SecureRandom().nextBytes(generatedKey);

            authenticate(call, cipher, authorizedCipher -> {
                byte[] wrapped = null;
                byte[] iv = null;
                cryptoLock.writeLock().lock();
                try {
                    if (lockGeneration != authGeneration) {
                        throw new IllegalStateException("Authentication expired after app lock");
                    }
                    wrapped = authorizedCipher.doFinal(generatedKey);
                    iv = authorizedCipher.getIV();

                    boolean persisted = getContext()
                        .getSharedPreferences(PREFS, 0)
                        .edit()
                        .putString("wrapped_key", Base64.encodeToString(wrapped, Base64.NO_WRAP))
                        .putString("wrapped_iv", Base64.encodeToString(iv, Base64.NO_WRAP))
                        .putInt("key_version", 1)
                        .commit();

                    if (!persisted) {
                        throw new IllegalStateException("Unable to persist wrapped database key");
                    }

                    cryptoLock.writeLock().lock();
                    try {
                        clearDataKey();
                        dataKey = generatedKey.clone();
                        recoveryNeedsRebind = false;
                    } finally {
                        cryptoLock.writeLock().unlock();
                    }

                    JSObject response = new JSObject();
                    response.put("success", true);
                    response.put("keyVersion", 1);
                    call.resolve(response);

                } catch (Exception e) {
                    call.reject("Unable to protect database key");
                } finally {
                    cryptoLock.writeLock().unlock();
                    if (wrapped != null) Arrays.fill(wrapped, (byte) 0);
                    if (iv != null) Arrays.fill(iv, (byte) 0);
                    Arrays.fill(generatedKey, (byte) 0);
                    releaseSetupGuard();
                }
            }, () -> {
                Arrays.fill(generatedKey, (byte) 0);
                releaseSetupGuard();
            });

        } catch (Exception e) {
            releaseSetupGuard();
            call.reject("Unable to initialize Android Keystore");
        }
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        long authGeneration = getLockGeneration();
        final byte[][] unlockBuffers = new byte[2][];

        try {
            android.content.SharedPreferences prefs =
                getContext().getSharedPreferences(PREFS, 0);

            String wrappedText = prefs.getString("wrapped_key", null);
            String ivText = prefs.getString("wrapped_iv", null);

            if (wrappedText == null || ivText == null) {
                call.reject("LifeOS encryption has not been initialized");
                return;
            }

            if (wrappedText.length() != 64 || ivText.length() != 16 ||
                prefs.getInt("key_version", -1) != 1) {
                call.reject("Invalid or unsupported encryption key metadata");
                return;
            }

            unlockBuffers[0] = Base64.decode(wrappedText, Base64.NO_WRAP);
            unlockBuffers[1] = Base64.decode(ivText, Base64.NO_WRAP);

            final byte[] wrapped = unlockBuffers[0];
            final byte[] iv = unlockBuffers[1];

            if (wrapped.length != 32 + TAG_BYTES || iv.length != IV_SIZE) {
                Arrays.fill(wrapped, (byte) 0);
                Arrays.fill(iv, (byte) 0);
                call.reject("Invalid wrapped database key parameters");
                return;
            }

            SecretKey masterKey = (SecretKey) keyStore().getKey(KEY_ALIAS, null);
            if (masterKey == null) {
                throw new IllegalStateException("Database master key is unavailable");
            }

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                Cipher.DECRYPT_MODE,
                masterKey,
                new GCMParameterSpec(TAG_SIZE, iv)
            );

            authenticate(call, cipher, authorizedCipher -> {
                byte[] recovered = null;
                cryptoLock.writeLock().lock();

                try {
                    if (lockGeneration != authGeneration) {
                        throw new IllegalStateException("Authentication expired after app lock");
                    }

                    recovered = authorizedCipher.doFinal(wrapped);

                    if (recovered.length != 32) {
                        throw new IllegalStateException("Invalid database key length");
                    }

                    clearDataKey();
                    dataKey = recovered.clone();
                    recoveryNeedsRebind = false;

                    JSObject response = new JSObject();
                    response.put("success", true);
                    response.put("keyVersion", prefs.getInt("key_version", 1));
                    call.resolve(response);

                } catch (Exception e) {
                    call.reject("Unable to unlock database encryption key");
                } finally {
                    if (recovered != null) {
                        Arrays.fill(recovered, (byte) 0);
                    }
                    Arrays.fill(wrapped, (byte) 0);
                    Arrays.fill(iv, (byte) 0);
                    cryptoLock.writeLock().unlock();
                }
            }, () -> {
                Arrays.fill(wrapped, (byte) 0);
                Arrays.fill(iv, (byte) 0);
            });

        } catch (Exception e) {
            if (unlockBuffers[0] != null) {
                Arrays.fill(unlockBuffers[0], (byte) 0);
            }
            if (unlockBuffers[1] != null) {
                Arrays.fill(unlockBuffers[1], (byte) 0);
            }
            call.reject("Keystore key unavailable or invalidated");
        }
    }

    @PluginMethod
    public void encrypt(PluginCall call) {
        byte[] key = getDataKey();
        if (key == null) {
            call.reject("LifeOS is locked");
            return;
        }

        byte[] plaintextBytes = null;
        byte[] aadBytes = null;
        byte[] encrypted = null;
        byte[] iv = null;
        try {
            String plaintext = call.getString("plaintext");
            String aad = call.getString("aad");

            if (plaintext == null || aad == null || aad.trim().isEmpty()) {
                call.reject("Plaintext and non-empty associated data are required");
                return;
            }

            plaintextBytes = plaintext.getBytes(StandardCharsets.UTF_8);
            aadBytes = aad.getBytes(StandardCharsets.UTF_8);
            if (plaintextBytes.length > MAX_PLAINTEXT_BYTES || aadBytes.length > MAX_AAD_BYTES) {
                call.reject("Encryption input exceeds the permitted size");
                return;
            }

            iv = new byte[IV_SIZE];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                Cipher.ENCRYPT_MODE,
                new SecretKeySpec(key, "AES"),
                new GCMParameterSpec(TAG_SIZE, iv)
            );
            cipher.updateAAD(aadBytes);

            encrypted = cipher.doFinal(plaintextBytes);

            JSObject response = new JSObject();
            response.put("iv", Base64.encodeToString(iv, Base64.NO_WRAP));
            response.put("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP));
            response.put("keyVersion", 1);
            call.resolve(response);

        } catch (Exception e) {
            call.reject("Encryption failed");
        } finally {
            if (plaintextBytes != null) Arrays.fill(plaintextBytes, (byte) 0);
            if (aadBytes != null) Arrays.fill(aadBytes, (byte) 0);
            if (encrypted != null) Arrays.fill(encrypted, (byte) 0);
            if (iv != null) Arrays.fill(iv, (byte) 0);
            Arrays.fill(key, (byte) 0);
            cryptoLock.readLock().unlock();
        }
    }

    @PluginMethod
    public void decrypt(PluginCall call) {
        byte[] key = getDataKey();
        if (key == null) {
            call.reject("LifeOS is locked");
            return;
        }

        byte[] aadBytes = null;
        byte[] ciphertext = null;
        byte[] plaintext = null;
        byte[] iv = null;
        try {
            String ivText = call.getString("iv");
            String ciphertextText = call.getString("ciphertext");
            String aad = call.getString("aad");

            if (ivText == null || ciphertextText == null ||
                aad == null || aad.trim().isEmpty()) {
                call.reject("IV, ciphertext and associated data are required");
                return;
            }

            if (ivText.length() != 16 || ciphertextText.length() > 1398124) {
                call.reject("Invalid encryption input size");
                return;
            }

            aadBytes = aad.getBytes(StandardCharsets.UTF_8);
            if (aadBytes.length > MAX_AAD_BYTES) {
                call.reject("Associated data exceeds the permitted size");
                return;
            }

            iv = Base64.decode(ivText, Base64.NO_WRAP);
            ciphertext = Base64.decode(ciphertextText, Base64.NO_WRAP);

            if (iv.length != IV_SIZE || ciphertext.length < TAG_BYTES ||
                ciphertext.length > MAX_CIPHERTEXT_BYTES) {
                call.reject("Invalid encryption parameters");
                return;
            }

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                Cipher.DECRYPT_MODE,
                new SecretKeySpec(key, "AES"),
                new GCMParameterSpec(TAG_SIZE, iv)
            );
            cipher.updateAAD(aadBytes);

            plaintext = cipher.doFinal(ciphertext);

            JSObject response = new JSObject();
            response.put("plaintext", new String(plaintext, StandardCharsets.UTF_8));
            call.resolve(response);

        } catch (Exception e) {
            call.reject("Decryption failed or authenticated data was modified");
        } finally {
            if (plaintext != null) Arrays.fill(plaintext, (byte) 0);
            if (aadBytes != null) Arrays.fill(aadBytes, (byte) 0);
            if (iv != null) Arrays.fill(iv, (byte) 0);
            if (ciphertext != null) Arrays.fill(ciphertext, (byte) 0);
            Arrays.fill(key, (byte) 0);
            cryptoLock.readLock().unlock();
        }
    }

    @PluginMethod
    public void lock(PluginCall call) {
        cryptoLock.writeLock().lock();
        try {
            lockGeneration++;
            clearDataKey();
            clearPendingRecovery();
        } finally {
            cryptoLock.writeLock().unlock();
        }
        JSObject response = new JSObject();
        response.put("success", true);
        call.resolve(response);
    }

    @PluginMethod
    public void getKeyState(PluginCall call) {
        cryptoLock.readLock().lock();
        try {
            android.content.SharedPreferences prefs =
                getContext().getSharedPreferences(PREFS, 0);

            boolean hasWrapped = prefs.contains("wrapped_key");
            boolean hasIv = prefs.contains("wrapped_iv");
            boolean hasVersion = prefs.contains("key_version");

            boolean localAbsent = !hasWrapped && !hasIv && !hasVersion;

            String wrappedText = prefs.getString("wrapped_key", null);
            String ivText = prefs.getString("wrapped_iv", null);

            boolean localComplete =
                hasWrapped && hasIv && hasVersion &&
                prefs.getInt("key_version", -1) == 1 &&
                wrappedText != null &&
                wrappedText.matches("[A-Za-z0-9+/]{64}") &&
                ivText != null &&
                ivText.matches("[A-Za-z0-9+/]{16}");

            boolean hasRecoveryWrapped = prefs.contains("recovery_wrapped");
            boolean hasRecoverySalt = prefs.contains("recovery_salt");
            boolean hasRecoveryIv = prefs.contains("recovery_iv");
            boolean hasRecoveryVersion = prefs.contains("recovery_version");
            boolean hasRecoveryIterations =
                prefs.contains("recovery_kdf_iterations");

            boolean recoveryAbsent =
                !hasRecoveryWrapped && !hasRecoverySalt &&
                !hasRecoveryIv && !hasRecoveryVersion &&
                !hasRecoveryIterations;

            String recoveryWrapped =
                prefs.getString("recovery_wrapped", null);
            String recoverySalt =
                prefs.getString("recovery_salt", null);
            String recoveryIv =
                prefs.getString("recovery_iv", null);

            boolean recoveryComplete =
                hasRecoveryWrapped && hasRecoverySalt &&
                hasRecoveryIv && hasRecoveryVersion &&
                hasRecoveryIterations &&
                prefs.getInt("recovery_version", -1) == 1 &&
                prefs.getInt(
                    "recovery_kdf_iterations", -1
                ) == RECOVERY_KDF_ITERATIONS &&
                recoveryWrapped != null &&
                recoveryWrapped.matches("[A-Za-z0-9+/]{64}") &&
                recoverySalt != null &&
                recoverySalt.matches("[A-Za-z0-9+/]{22}==") &&
                recoveryIv != null &&
                recoveryIv.matches("[A-Za-z0-9+/]{16}");

            boolean aliasPresent = keyStore().containsAlias(KEY_ALIAS);

            boolean metadataConsistent =
                (localAbsent || localComplete) &&
                (recoveryAbsent || recoveryComplete);

            JSObject result = new JSObject();
            result.put("keyProvisioned", localComplete && aliasPresent);
            result.put("recoveryProvisioned", recoveryComplete);
            result.put("recoveryNeedsRebind", recoveryNeedsRebind);
            result.put("metadataConsistent", metadataConsistent);
            result.put("keystoreAliasPresent", aliasPresent);
            result.put(
                "unlocked",
                dataKey != null && !recoveryNeedsRebind
            );

            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not inspect native encryption state.");
        } finally {
            cryptoLock.readLock().unlock();
        }
    }

    @PluginMethod
    public void isUnlocked(PluginCall call) {
        JSObject response = new JSObject();
        cryptoLock.readLock().lock();
        try {
            response.put("unlocked", dataKey != null && !recoveryNeedsRebind);
        } finally {
            cryptoLock.readLock().unlock();
        }
        call.resolve(response);
    }

    private long getLockGeneration() {
        cryptoLock.readLock().lock();
        try {
            return lockGeneration;
        } finally {
            cryptoLock.readLock().unlock();
        }
    }

    private byte[] getDataKey() {
        cryptoLock.readLock().lock();
        if (dataKey == null || recoveryNeedsRebind) {
            cryptoLock.readLock().unlock();
            return null;
        }
        return dataKey.clone();
    }

    private void clearDataKey() {
        if (dataKey != null) {
            Arrays.fill(dataKey, (byte) 0);
            dataKey = null;
        }
        recoveryNeedsRebind = false;
    }

    private void releaseSetupGuard() {
        synchronized (keyLock) {
            setupInProgress = false;
        }
    }

    @Override
    protected void handleOnStop() {
        cryptoLock.writeLock().lock();
        try {
            lockGeneration++;
            clearDataKey();
            clearPendingRecovery();
        } finally {
            cryptoLock.writeLock().unlock();
        }
        super.handleOnStop();
    }
}
