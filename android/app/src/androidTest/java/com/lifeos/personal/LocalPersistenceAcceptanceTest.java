package com.lifeos.personal;

import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real WebView/IndexedDB execution; owns a separate synthetic database only.
 * Does not provision keys or claim process-death, airplane-mode or biometric acceptance. */
@RunWith(AndroidJUnit4.class)
public class LocalPersistenceAcceptanceTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        return WebViewTestSupport.evaluate(scenario, script);
    }

    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        WebViewTestSupport.awaitReactRoot(scenario);
    }

    private void runAsync(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        evaluate(scenario, "window.__lifeosQaResult='PENDING'; (async()=>{" + script + "})().then(()=>window.__lifeosQaResult='PASS').catch(()=>window.__lifeosQaResult='FAIL');");
        for (int i=0; i<300; i++) {
            String value=evaluate(scenario, "window.__lifeosQaResult");
            if ("\"PASS\"".equals(value)) return;
            assertNotEquals("Synthetic IndexedDB operation failed", "\"FAIL\"", value);
            Thread.sleep(100);
        }
        fail("Synthetic IndexedDB operation timed out");
    }

    @Test public void committedIndexedDbRecordSurvivesBackgroundAndActivityRecreation() throws Exception {
        String name="lifeos_qa_disposable_"+UUID.randomUUID().toString().replace("-", "");
        String open="const db=await new Promise((ok,no)=>{const r=indexedDB.open('"+name+"',1);r.onupgradeneeded=()=>r.result.createObjectStore('fixtures');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});";
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            WebViewTestSupport.checkpoint("persistence: initial React root");
            ready(scenario);
            try {
                runAsync(scenario, open+"try{await new Promise((ok,no)=>{const t=db.transaction('fixtures','readwrite');t.objectStore('fixtures').put({amount:12345,occurredAt:'2026-11-07T05:31:42.123Z'},'synthetic');t.oncomplete=()=>ok();t.onabort=()=>no(t.error);t.onerror=()=>no(t.error);});}finally{db.close();}");
                WebViewTestSupport.checkpoint("persistence: fixture committed; backgrounding");
                scenario.moveToState(Lifecycle.State.CREATED);
                WebViewTestSupport.checkpoint("persistence: resuming");
                scenario.moveToState(Lifecycle.State.RESUMED);
                WebViewTestSupport.checkpoint("persistence: recreating Activity");
                scenario.recreate();
                WebViewTestSupport.checkpoint("persistence: recreated React root");
                ready(scenario);
                AtomicBoolean appearanceRegistered = new AtomicBoolean();
                AtomicBoolean cryptoRegistered = new AtomicBoolean();
                scenario.onActivity(activity -> {
                    appearanceRegistered.set(activity.getBridge().getPlugin("SystemAppearance") != null);
                    cryptoRegistered.set(activity.getBridge().getPlugin("LifeOSCrypto") != null);
                });
                assertTrue("Appearance bridge registration must survive recreation", appearanceRegistered.get());
                assertTrue("Crypto bridge registration must survive recreation", cryptoRegistered.get());
                runAsync(scenario, open+"try{const v=await new Promise((ok,no)=>{const r=db.transaction('fixtures').objectStore('fixtures').get('synthetic');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});if(!v||v.amount!==12345||v.occurredAt!=='2026-11-07T05:31:42.123Z')throw Error('persistence mismatch');}finally{db.close();}");
                WebViewTestSupport.checkpoint("persistence: recreated fixture verified");
            } finally {
                runAsync(scenario, "await new Promise((ok,no)=>{const r=indexedDB.deleteDatabase('"+name+"');r.onsuccess=()=>ok();r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('cleanup blocked'));});");
            }
        }
    }
}
