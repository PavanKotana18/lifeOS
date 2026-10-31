package com.lifeos.personal;

import android.content.Context;
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

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Context context = getContext();
        BiometricManager biometricManager = BiometricManager.from(context);
        int canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
        );

        JSObject ret = new JSObject();
        if (canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS) {
            ret.put("isAvailable", true);
            ret.put("biometricsSupported", true);
            ret.put("code", "SUCCESS");
        } else if (canAuthenticate == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            ret.put("isAvailable", false);
            ret.put("biometricsSupported", true);
            ret.put("code", "NOT_ENROLLED");
        } else {
            ret.put("isAvailable", false);
            ret.put("biometricsSupported", false);
            ret.put("code", "NO_HARDWARE");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                FragmentActivity activity = (FragmentActivity) getActivity();
                Executor executor = ContextCompat.getMainExecutor(activity);

                BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("errorCode", errorCode);
                            ret.put("message", errString.toString());
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                        }
                    }
                );

                String title = call.getString("title", "Unlock LifeOS");
                String subtitle = call.getString("subtitle", "Authenticate using fingerprint or device credential");

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                    )
                    .build();

                biometricPrompt.authenticate(promptInfo);
            } catch (Exception e) {
                call.reject("Biometric authentication invocation failed: " + e.getMessage());
            }
        });
    }
}
