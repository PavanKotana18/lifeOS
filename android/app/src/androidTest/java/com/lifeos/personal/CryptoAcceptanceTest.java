package com.lifeos.personal;

import android.util.Base64;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import static org.junit.Assert.*;

/** Actual plugin, disposable unattached instances only. Never accesses app preferences,
 * real Keystore aliases or biometric UI. This is NOT device-authentication acceptance. */
@RunWith(AndroidJUnit4.class)
public class CryptoAcceptanceTest {
    private final LifeOSCryptoPlugin plugin = new LifeOSCryptoPlugin();
    private static class Call extends PluginCall {
        JSObject response; String error; int settlements;
        Call(String method, JSObject data) { super(null, "LifeOSCrypto", "synthetic", method, data); }
        @Override public void resolve(JSObject data) { assertEquals(0, settlements++); response = data; }
        @Override public void reject(String message) { assertEquals(0, settlements++); error = message; }
    }
    private Object get(String name) throws Exception { Field f=LifeOSCryptoPlugin.class.getDeclaredField(name); f.setAccessible(true); return f.get(plugin); }
    private void set(String name,Object value) throws Exception { Field f=LifeOSCryptoPlugin.class.getDeclaredField(name); f.setAccessible(true); f.set(plugin,value); }
    private static byte[] key() { byte[] key=new byte[32]; Arrays.fill(key,(byte)42); return key; }
    private static String b64(byte[] value) { return Base64.encodeToString(value,Base64.NO_WRAP); }
    private static JSObject args(String aad) { JSObject a=new JSObject(); a.put("plaintext","synthetic record");a.put("aad",aad); return a; }
    private void locked() { Call c=new Call("isUnlocked",new JSObject());plugin.isUnlocked(c);assertEquals(1,c.settlements);assertFalse(c.response.optBoolean("unlocked",true)); }
    @After public void wipeSyntheticMemory() { Call c=new Call("lock",new JSObject());plugin.lock(c); }

    @Test public void newInstanceStartsLockedWithoutProvisioning() { locked(); }
    @Test public void actualAesGcmRoundtripRejectsChangedAad() throws Exception {
        set("dataKey",key()); Call encrypted=new Call("encrypt",args("synthetic:aad"));plugin.encrypt(encrypted);assertNull(encrypted.error);assertNotNull(encrypted.response);
        JSObject a=encrypted.response;a.put("aad","synthetic:aad");Call plain=new Call("decrypt",a);plugin.decrypt(plain);assertEquals("synthetic record",plain.response.optString("plaintext"));
        a.put("aad","different");Call changed=new Call("decrypt",a);plugin.decrypt(changed);assertNotNull(changed.error);assertNull(changed.response);
    }
    @Test public void stopEvictsKeyAndQuarantineAndInvalidatesGeneration() throws Exception {
        byte[] bytes=key();set("dataKey",bytes);set("recoveryNeedsRebind",true);set("recoveryKeyVerified",true);set("recoveredSalt","synthetic");set("pendingRecoverySalt","synthetic");
        long before=(Long)get("lockGeneration");plugin.handleOnStop();assertEquals(before+1,(long)(Long)get("lockGeneration"));assertArrayEquals(new byte[32],bytes);assertNull(get("dataKey"));assertFalse((Boolean)get("recoveryKeyVerified"));assertNull(get("recoveredSalt"));assertNull(get("pendingRecoverySalt"));locked();
        LifeOSCryptoPlugin recreated=new LifeOSCryptoPlugin();Call c=new Call("isUnlocked",new JSObject());recreated.isUnlocked(c);assertFalse(c.response.optBoolean("unlocked",true)); // New instance, not ActivityScenario recreation.
    }
    private void authenticate(Call c,Runnable failure) throws Exception {
        Method m=LifeOSCryptoPlugin.class.getDeclaredMethod("authenticate",PluginCall.class,Cipher.class,Consumer.class,Runnable.class);m.setAccessible(true);
        m.invoke(plugin,c,null,(Consumer<Cipher>)cipher->{throw new AssertionError("Unexpected authentication success");},failure);
    }
    @Test public void concurrentNativeAttemptRejectedWithoutReleasingOwner() throws Exception {
        AtomicBoolean busy=(AtomicBoolean)get("authenticationInProgress");busy.set(true);int[] failures={0};
        try { Call c=new Call("unlock",new JSObject());authenticate(c,()->failures[0]++);assertNotNull(c.error);assertEquals(1,c.settlements);assertEquals(1,failures[0]);assertTrue(busy.get()); }
        finally { busy.set(false); }
    }
    @Test public void unavailableActivityFailsOnceAndReleasesGuard() throws Exception {
        int[] failures={0};Call c=new Call("unlock",new JSObject());authenticate(c,()->failures[0]++);assertNotNull(c.error);assertEquals(1,c.settlements);assertEquals(1,failures[0]);assertFalse(((AtomicBoolean)get("authenticationInProgress")).get());locked();
    }
    private JSObject recoveryEnvelope(String code) {
        // Deterministic synthetic vector: password A*43, salt 0x03*16,
        // AES-GCM IV 0x04*12, and wrapped key 0x2a*32. Generated with
        // PBKDF2-HMAC-SHA-256 (600,000 iterations) and AES-256-GCM. Keeping
        // fixture construction independent of Android's optional
        // SecretKeyFactory providers exercises production KDF on API 24.
        assertEquals("fixture recovery code changed", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", code);
        JSObject env=new JSObject();env.put("version",1);env.put("kdf","PBKDF2-HMAC-SHA-256");env.put("iterations",600000);
        env.put("salt","AwMDAwMDAwMDAwMDAwMDAw==");env.put("iv","BAQEBAQEBAQEBAQE");
        env.put("wrappedKey","QncCnm9uIJeEajV2oWkL27BlawukL6h3HHtRHtnfM1gZdNzW4M+/Ls6AXDJSLym+");
        return env;
    }
    @Test public void realRecoveryKdfRejectsWrongCodeThenProofKeepsKeyQuarantined() throws Exception {
        String code="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";JSObject a=new JSObject();a.put("envelope",recoveryEnvelope(code));a.put("recoveryCode","BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
        Call wrong=new Call("recoverWithSecret",a);plugin.recoverWithSecret(wrong);assertNotNull(wrong.error);assertNull(get("dataKey"));
        a.put("recoveryCode",code);Call recover=new Call("recoverWithSecret",a);plugin.recoverWithSecret(recover);assertNull(recover.error);assertTrue(recover.response.optBoolean("success"));locked();
        Call unverified=new Call("rebindLocalKey",new JSObject());plugin.rebindLocalKey(unverified);assertNotNull(unverified.error); // Guard rejects before any Keystore/context access.
        byte[] iv=new byte[12];Arrays.fill(iv,(byte)7);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key(),"AES"),new GCMParameterSpec(128,iv));cipher.updateAAD("fixture-record".getBytes(StandardCharsets.UTF_8));
        JSObject proof=new JSObject();proof.put("iv",b64(iv));proof.put("ciphertext",b64(cipher.doFinal("synthetic".getBytes(StandardCharsets.UTF_8))));proof.put("aad","wrong-record");
        Call badProof=new Call("verifyRecoveryRecord",proof);plugin.verifyRecoveryRecord(badProof);assertNotNull(badProof.error);assertFalse((Boolean)get("recoveryKeyVerified"));
        proof.put("aad","fixture-record");Call verified=new Call("verifyRecoveryRecord",proof);plugin.verifyRecoveryRecord(verified);assertNull(verified.error);assertEquals(1,verified.response.length());assertTrue(verified.response.optBoolean("verified"));locked();
        Call normal=new Call("encrypt",args("fixture-record"));plugin.encrypt(normal);assertNotNull(normal.error); // Proof is not an unlock or rebind.
    }
    @Test public void malformedRecoveryPreservesExistingSyntheticKey() throws Exception {
        byte[] original=key();set("dataKey",original);Call c=new Call("recoverWithSecret",new JSObject());plugin.recoverWithSecret(c);assertNotNull(c.error);assertSame(original,get("dataKey"));assertArrayEquals(key(),original);
    }
}
