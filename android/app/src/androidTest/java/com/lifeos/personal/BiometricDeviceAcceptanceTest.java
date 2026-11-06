package com.lifeos.personal;

import android.os.ParcelFileDescriptor;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import static org.junit.Assert.*;

/** OPT-IN actual prompts + Keystore on a fresh dedicated AVD. No forced success,
 * key extraction/deletion, enrollment bypass, recovery activation or alias reset. */
@RunWith(AndroidJUnit4.class)
public class BiometricDeviceAcceptanceTest {
    private static class Call extends PluginCall {
        final CountDownLatch done=new CountDownLatch(1);
        volatile JSObject response; volatile String error; volatile int settlements;
        Call(String method) { super(null,"LifeOSCrypto","synthetic",method,new JSObject()); }
        @Override public synchronized void resolve(JSObject data) { settlements++;response=data;done.countDown(); }
        @Override public synchronized void reject(String message) { settlements++;error=message;done.countDown(); }
        void await() throws Exception { assertTrue("Real biometric action timed out",done.await(90,TimeUnit.SECONDS));assertEquals(1,settlements);InstrumentationRegistry.getInstrumentation().waitForIdleSync(); }
        void success() throws Exception { await();assertNull(error);assertNotNull(response);assertTrue(response.optBoolean("success")); }
    }
    private static String property(String name) throws Exception {
        ParcelFileDescriptor fd=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("getprop "+name);
        try(BufferedReader reader=new BufferedReader(new InputStreamReader(new ParcelFileDescriptor.AutoCloseInputStream(fd)))) { return reader.readLine(); }
    }
    private static LifeOSCryptoPlugin plugin(ActivityScenario<MainActivity> scenario) {
        LifeOSCryptoPlugin[] p={null};scenario.onActivity(activity->{try { p[0]=(LifeOSCryptoPlugin)activity.getBridge().getPlugin("LifeOSCrypto").load(); } catch(Exception e){throw new AssertionError("Real plugin loading failed",e);} });assertNotNull(p[0]);return p[0];
    }
    private static Call call(String name,Consumer<Call> invoke) { Call c=new Call(name);invoke.accept(c);return c; }
    private static void locked(LifeOSCryptoPlugin p) throws Exception { Call c=call("isUnlocked",p::isUnlocked);c.await();assertFalse(c.response.optBoolean("unlocked",true)); }
    private static void unlocked(LifeOSCryptoPlugin p) throws Exception { Call c=call("isUnlocked",p::isUnlocked);c.await();assertTrue(c.response.optBoolean("unlocked",false)); }
    @Test public void actualSetupCancelConcurrentResumeRecreateAndUnlock() throws Exception {
        assertEquals("yes",InstrumentationRegistry.getArguments().getString("lifeosRealBiometricAcceptance"));
        assertEquals("1",property("ro.kernel.qemu"));assertEquals("lifeos-acceptance-sprint3",property("ro.boot.qemu.avd_name"));
        // Refuse any existing wrapper; this test never deletes or replaces keys.
        android.content.SharedPreferences prefs=InstrumentationRegistry.getInstrumentation().getTargetContext().getSharedPreferences("lifeos_crypto_v1",0);
        assertFalse("Requires fresh disposable profile",prefs.contains("wrapped_key"));assertFalse(prefs.contains("wrapped_iv"));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            LifeOSCryptoPlugin p=plugin(scenario);locked(p);
            try {
                call("setup",p::setup).success();unlocked(p); // Human/emulator must ACCEPT strong biometric.
                call("lock",p::lock).success();locked(p);
                Call cancelled=call("unlock",p::unlock); // Human must CANCEL this prompt.
                Call concurrent=call("unlock",p::unlock);concurrent.await();assertNotNull(concurrent.error);locked(p);
                cancelled.await();assertTrue(cancelled.error!=null || !cancelled.response.optBoolean("success"));locked(p);
                call("unlock",p::unlock).success();unlocked(p); // ACCEPT.
                scenario.moveToState(Lifecycle.State.CREATED);locked(p); // Actual Activity onStop, not direct callback.
                scenario.moveToState(Lifecycle.State.RESUMED);locked(p);
                call("unlock",p::unlock).success();unlocked(p); // ACCEPT; existing DEK wrapper must still work.
                scenario.recreate();LifeOSCryptoPlugin recreated=plugin(scenario);locked(recreated);
                try { call("unlock",recreated::unlock).success();unlocked(recreated); } // ACCEPT after real Activity recreation.
                finally { call("lock",recreated::lock).success(); }
            } finally { call("lock",p::lock).success(); }
        }
        // Wrapper/alias intentionally retained in this disposable profile; no destructive cleanup.
    }
}
