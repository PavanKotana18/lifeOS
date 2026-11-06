package com.lifeos.personal;

import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real WebView/IndexedDB execution; owns a separate synthetic database only.
 * Does not provision keys or claim process-death, airplane-mode or biometric acceptance. */
@RunWith(AndroidJUnit4.class)
public class LocalPersistenceAcceptanceTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script, value -> {
            result.set(value); done.countDown();
        }));
        assertTrue("WebView evaluation timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        for (int i=0; i<300; i++) {
            if ("true".equals(evaluate(scenario, "location.hostname === 'localhost' && document.readyState === 'complete' && !!document.getElementById('root') && document.getElementById('root').childElementCount > 0"))) return;
            Thread.sleep(100);
        }
        fail("Packaged application did not render its React root: " + evaluate(scenario, "JSON.stringify({ready:document.readyState,rootChildren:document.getElementById('root') ? document.getElementById('root').childElementCount : -1})"));
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
            ready(scenario);
            try {
                runAsync(scenario, open+"try{await new Promise((ok,no)=>{const t=db.transaction('fixtures','readwrite');t.objectStore('fixtures').put({amount:12345,occurredAt:'2026-11-07T05:31:42.123Z'},'synthetic');t.oncomplete=()=>ok();t.onabort=()=>no(t.error);t.onerror=()=>no(t.error);});}finally{db.close();}");
                scenario.moveToState(Lifecycle.State.CREATED);
                scenario.moveToState(Lifecycle.State.RESUMED);
                scenario.recreate();
                ready(scenario);
                scenario.onActivity(activity -> {
                    assertNotNull("Appearance bridge registration must survive recreation",activity.getBridge().getPlugin("SystemAppearance"));
                    assertNotNull("Crypto bridge registration must survive recreation",activity.getBridge().getPlugin("LifeOSCrypto"));
                });
                runAsync(scenario, open+"try{const v=await new Promise((ok,no)=>{const r=db.transaction('fixtures').objectStore('fixtures').get('synthetic');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});if(!v||v.amount!==12345||v.occurredAt!=='2026-11-07T05:31:42.123Z')throw Error('persistence mismatch');}finally{db.close();}");
            } finally {
                runAsync(scenario, "await new Promise((ok,no)=>{const r=indexedDB.deleteDatabase('"+name+"');r.onsuccess=()=>ok();r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('cleanup blocked'));});");
            }
        }
    }
}
