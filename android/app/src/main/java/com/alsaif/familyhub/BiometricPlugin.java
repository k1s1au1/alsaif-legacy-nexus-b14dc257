package com.alsaif.familyhub;

import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricPlugin extends Plugin {

    @PluginMethod
    public void checkBiometry(PluginCall call) {
        BiometricManager biometricManager = BiometricManager.from(getContext());
        int canAuthenticate = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL);

        JSObject ret = new JSObject();
        ret.put("isAvailable", canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("reason", canAuthenticate);
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "الدخول بالبصمة");
        String subtitle = call.getString("subtitle", "يرجى تأكيد الهوية للمتابعة");

        new Handler(Looper.getMainLooper()).post(() -> {
            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt biometricPrompt = new BiometricPrompt(getActivity(), executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    super.onAuthenticationError(errorCode, errString);
                    call.reject(errString.toString(), String.valueOf(errorCode));
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
                    // Keep waiting or let user try again
                }
            });

            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                    .build();

            biometricPrompt.authenticate(promptInfo);
        });
    }
}
