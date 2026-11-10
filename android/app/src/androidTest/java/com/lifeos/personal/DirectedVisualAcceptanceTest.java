package com.lifeos.personal;

import android.app.UiAutomation;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.WindowInsets;
import android.view.KeyEvent;
import android.view.WindowManager;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Fresh emulator only, no private writes or authentication bypass. */
@RunWith(AndroidJUnit4.class)
public class DirectedVisualAcceptanceTest {
    private ActivityScenario<MainActivity> scenario;
    private File output;
    private final JSONArray captures = new JSONArray();
    private JSONObject keyboardDiagnostics = new JSONObject();
    private String js(String code) throws Exception { return WebViewTestSupport.evaluate(scenario, code); }
    private void until(String code) throws Exception {
        long end=SystemClock.elapsedRealtime()+30000;
        while(SystemClock.elapsedRealtime()<end) { if("true".equals(js(code))) return; Thread.sleep(100); }
        fail("Packaged app did not reach expected state: "+code);
    }
    private void click(String text) throws Exception {
        String q=JSONObject.quote(text);
        until("(()=>{const q="+q+";const e=[...document.querySelectorAll('button')].find(x=>!x.disabled&&x.getClientRects().length&&((x.innerText||'').includes(q)||x.getAttribute('aria-label')===q));if(!e)return false;e.click();return true})()");
    }
    private void tab(String id) throws Exception {
        js("document.querySelector('[data-tab="+id+"]').click()");
        until("document.querySelector('[data-tab="+id+"]')?.getAttribute('aria-current')==='page'");
    }
    private void capture(String name) throws Exception {
        Thread.sleep(350); // Capture settled frames; navigation correctness uses DOM assertions.
        final boolean[] safe={false};
        scenario.onActivity(a->safe[0]=(a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE)==0);
        assertTrue("Normal empty screen remained protected; screenshot capture blocked without weakening privacy",safe[0]);
        Bitmap image=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull("Android screenshot unavailable",image);
        try(FileOutputStream file=new FileOutputStream(new File(output,name+".png"))) { assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,file)); }
        finally { image.recycle(); }
        captures.put(name+".png");
    }
    private void captureSyntheticOnboarding(String name) throws Exception {
        // Test-only view bitmap of our fresh synthetic UI, not a system screenshot.
        // The APK build policy controls native screenshot/Recent Apps protection.
        until("!!document.querySelector('.initial-setup')");
        JSONObject key=new JSONObject(WebViewTestSupport.evaluateAsync(scenario,"window.Capacitor.Plugins.LifeOSCrypto.getKeyState()"));
        assertFalse("Capture is restricted to an unprovisioned synthetic first launch",key.getBoolean("keyProvisioned"));
        final Bitmap[] image={null};
        scenario.onActivity(a->{
            assertEquals("Onboarding follows the APK capture policy",!BuildConfig.DEBUG,(a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE)!=0);
            android.webkit.WebView view=a.getBridge().getWebView();
            image[0]=Bitmap.createBitmap(view.getWidth(),view.getHeight(),Bitmap.Config.ARGB_8888);
            view.draw(new android.graphics.Canvas(image[0]));
        });
        try(FileOutputStream file=new FileOutputStream(new File(output,name+"-android-view.png"))) { assertTrue(image[0].compress(Bitmap.CompressFormat.PNG,100,file)); }
        finally { image[0].recycle(); }
        captures.put(name+"-android-view.png");
    }
    private void mandatoryOnboardingVisuals() throws Exception {
        until("!!document.querySelector('input[autocomplete=nickname]')");
        captureSyntheticOnboarding("onboarding-name");
        js("(()=>{const e=document.querySelector('input[autocomplete=nickname]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Android synthetic owner');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
        click("Continue");
        until("!!document.querySelector('[aria-label=\"Protect your LifeOS space\"]')");
        assertEquals("false",js("!!document.querySelector('[data-testid=today-dashboard]')"));
        assertEquals("false",js("!![...document.querySelectorAll('button')].some(b=>b.innerText.includes('Not now'))"));
        captureSyntheticOnboarding("onboarding-protection");
        scenario.recreate();WebViewTestSupport.awaitReactRoot(scenario);
        until("!!document.querySelector('[aria-label=\"Protect your LifeOS space\"]')");
        for(int zoom:new int[]{130,200}) {
            scenario.onActivity(a->a.getBridge().getWebView().getSettings().setTextZoom(zoom));
            until("document.documentElement.scrollWidth<=innerWidth+1");
            captureSyntheticOnboarding("onboarding-protection-text-"+zoom);
        }
        scenario.onActivity(a->a.getBridge().getWebView().getSettings().setTextZoom(100));
        // Render the recovery screen for visual QA only by advancing disposable
        // bootstrap progress through IndexedDB. evaluateJavascript executes
        // injected code without a module base URL, so importing /src/db.ts
        // here fails in a packaged WebView. No native key is provisioned and
        // the app remains gated; this does not simulate authentication or
        // recovery success.
        WebViewTestSupport.evaluateAsync(scenario,
            "new Promise((resolve,reject)=>{const r=indexedDB.open('LifeOS_Database');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;let tx;try{tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({key:'onboardingJourney',value:{version:1,stage:'recovery',protection:'enabled',recovery:'pending',recoveryName:''}});}catch(e){db.close();reject(e);return;}tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||new Error('Bootstrap progress transaction aborted'));};};})");
        scenario.recreate();WebViewTestSupport.awaitReactRoot(scenario);
        until("!!document.querySelector('[aria-label=\"Set up your recovery kit\"]')");
        assertEquals("false",js("!!document.querySelector('[data-testid=today-dashboard]')"));
        assertEquals("false",js("!!document.querySelector('[aria-label=\"Complete private recovery kit\"]')"));
        captureSyntheticOnboarding("onboarding-recovery");
        openKeyboard("input[placeholder=\"My LifeOS recovery\"]", "document.activeElement?.placeholder==='My LifeOS recovery'");
        assertTrue("Optional recovery label should open the Android keyboard",keyboardVisible());
        InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
        long deadline=SystemClock.elapsedRealtime()+10000;while(keyboardVisible()&&SystemClock.elapsedRealtime()<deadline)Thread.sleep(50);
        assertFalse("Keyboard Back must not discard the recovery stage",keyboardVisible());
        captureSyntheticOnboarding("onboarding-recovery-keyboard-dismissed");
        JSONObject report=new JSONObject();
        report.put("environment","Real packaged React UI on hosted Android emulator; native authentication/recovery not invoked");
        report.put("screenshots",captures);report.put("privateWrites",0);
        report.put("scope","Visual screenshots of name, protection, and recovery stages only. Recovery secret screen was never opened. Activity capture followed the APK build policy.");
        try(FileOutputStream file=new FileOutputStream(new File(output,"onboarding-visual-evidence.json"))) { file.write(report.toString(2).getBytes("UTF-8")); }
    }
    private void captureFailureBeforeTeardown(Throwable failure) {
        // Keep the APK build policy intact. Android may redact system windows;
        // the remaining permission/keyboard evidence is still useful.
        try {
            Bitmap image=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            if(image!=null) { try(FileOutputStream file=new FileOutputStream(new File(output,"failure-before-activity-close.png"))){image.compress(Bitmap.CompressFormat.PNG,100,file);} finally {image.recycle();} }
            JSONObject diagnostics=new JSONObject();diagnostics.put("failure",failure.toString());diagnostics.put("keyboard",keyboardDiagnostics);
            diagnostics.put("dom",js("JSON.stringify({activeTag:document.activeElement?.tagName,activeType:document.activeElement?.type,inputMode:document.activeElement?.inputMode,ready:!!document.querySelector('[data-testid=today-dashboard]')})"));
            JSONArray windows=new JSONArray();for(AccessibilityWindowInfo window:InstrumentationRegistry.getInstrumentation().getUiAutomation().getWindows()){AccessibilityNodeInfo root=window.getRoot();JSONObject item=new JSONObject();item.put("type",window.getType());item.put("package",root==null?"unavailable":String.valueOf(root.getPackageName()));windows.put(item);}diagnostics.put("windows",windows);
            try(FileOutputStream file=new FileOutputStream(new File(output,"failure-diagnostics.json"))){file.write(diagnostics.toString(2).getBytes("UTF-8"));}
        } catch(Exception | AssertionError diagnostic){failure.addSuppressed(diagnostic);}
    }
    private void denyOptionalNotificationPrompt() throws Exception {
        UiAutomation auto=InstrumentationRegistry.getInstrumentation().getUiAutomation();
        AccessibilityServiceInfo info=auto.getServiceInfo();
        info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        auto.setServiceInfo(info);
        boolean denied=false; long end=SystemClock.elapsedRealtime()+30000;
        while(SystemClock.elapsedRealtime()<end) {
            java.util.ArrayList<AccessibilityNodeInfo> roots=new java.util.ArrayList<>();
            AccessibilityNodeInfo active=auto.getRootInActiveWindow();if(active!=null) roots.add(active);
            // An IME can own accessibility focus while the permission window is
            // visible. Select the actual permission-controller button, never a
            // similarly named app control or a forced permission mutation.
            for(AccessibilityWindowInfo window:auto.getWindows()){AccessibilityNodeInfo root=window.getRoot();if(root!=null)roots.add(root);}
            for(AccessibilityNodeInfo root:roots) {
                for(AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByViewId("com.android.permissioncontroller:id/permission_deny_button")) {
                    if(node.isEnabled() && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { denied=true; break; }
                }
                if(denied) break;
            }
            if(denied) break;
            Thread.sleep(100);
        }
        assertTrue("Fresh emulator notification prompt could not be denied through Android UI",denied);
        // The real Activity owns resuming and clearing protection for a safe screen.
        end=SystemClock.elapsedRealtime()+15000;
        final boolean[] safe={false};
        while(SystemClock.elapsedRealtime()<end) {
            scenario.onActivity(a->safe[0]=(a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE)==0);
            if(safe[0]) return;
            Thread.sleep(100);
        }
        fail("Activity did not return to a safe, capturable first-use screen after permission denial");
    }
    private void openNumericKeyboard() throws Exception { openKeyboard("input[inputmode=decimal]", "document.activeElement?.inputMode==='decimal'"); }
    private void openKeyboard(String selector, String focusCondition) throws Exception {
        // Earlier navigation uses JS to activate app controls. End that old IME
        // session, then open the amount with an actual trusted touchscreen tap.
        js("document.activeElement?.blur()");
        scenario.onActivity(a -> ((InputMethodManager)a.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(a.getBridge().getWebView().getWindowToken(),0));
        long hideDeadline=SystemClock.elapsedRealtime()+10000;
        while(keyboardVisible() && SystemClock.elapsedRealtime()<hideDeadline) Thread.sleep(50);
        assertFalse("Previous text keyboard did not dismiss",keyboardVisible());
        WebViewTestSupport.evaluateAsync(scenario,"new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))");
        String selectorLiteral=JSONObject.quote(selector);
        WebViewTestSupport.evaluateAsync(scenario,"new Promise(resolve=>{const field=document.querySelector("+selectorLiteral+");if(!field){resolve(false);return;}field.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)));})");
        JSONArray p=new JSONArray(js("(()=>{const r=document.querySelector("+JSONObject.quote(selector)+").getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth]})()"));
        final int[] xy={0,0,0};
        scenario.onActivity(a->{int[] o=new int[2];a.getBridge().getWebView().getLocationOnScreen(o);xy[0]=o[0];xy[1]=o[1];xy[2]=a.getBridge().getWebView().getWidth();});
        float scale=xy[2]/(float)p.getDouble(2),x=xy[0]+(float)p.getDouble(0)*scale,y=xy[1]+(float)p.getDouble(1)*scale;
        UiAutomation auto=InstrumentationRegistry.getInstrumentation().getUiAutomation();long down=SystemClock.uptimeMillis();
        MotionEvent e=MotionEvent.obtain(down,down,MotionEvent.ACTION_DOWN,x,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();
        e=MotionEvent.obtain(down,SystemClock.uptimeMillis()+40,MotionEvent.ACTION_UP,x,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();
        until(focusCondition);
        scenario.onActivity(a -> assertFalse("Field-aware WebView input must not be replaced by a generic capture connection",a.getBridge().getConfig().isInputCaptured()));
        long end=SystemClock.elapsedRealtime()+10000;final boolean[] visible={false};
        while(SystemClock.elapsedRealtime()<end) {
            scenario.onActivity(a->{WindowInsets insets=a.getWindow().getDecorView().getRootWindowInsets();visible[0]=insets!=null&&insets.isVisible(WindowInsets.Type.ime());});
            if(visible[0] && (!selector.contains("inputmode=decimal") || numericKeyboardVisible(auto))) { until(focusCondition); return; }
            Thread.sleep(100);
        }
        if("true".equals(js("!!document.querySelector('.initial-setup')")))captureSyntheticOnboarding("onboarding-keyboard-failure");else capture("numeric-keyboard-failure-in-app");
        try(FileOutputStream file=new FileOutputStream(new File(output,"keyboard-diagnostics.json"))) {file.write(keyboardDiagnostics.toString(2).getBytes("UTF-8"));}
        fail("Native tap on amount did not produce a visible numeric Android keyboard: "+keyboardDiagnostics);
    }
    private void tapImeKey(String key) throws Exception {
        UiAutomation auto=InstrumentationRegistry.getInstrumentation().getUiAutomation();
        long deadline=SystemClock.elapsedRealtime()+10000;
        while(SystemClock.elapsedRealtime()<deadline) {
            for(AccessibilityWindowInfo window:auto.getWindows()) {
                if(window.getType()!=AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue;
                java.util.ArrayDeque<AccessibilityNodeInfo> nodes=new java.util.ArrayDeque<>();AccessibilityNodeInfo root=window.getRoot();if(root!=null)nodes.add(root);
                while(!nodes.isEmpty()) {
                    AccessibilityNodeInfo node=nodes.remove();String text=String.valueOf(node.getText()),description=String.valueOf(node.getContentDescription());
                    if(key.equals(text)||key.equals(description)||(".".equals(key)&&description.toLowerCase(java.util.Locale.ROOT).contains("decimal"))) {
                        if(node.isEnabled()&&node.performAction(AccessibilityNodeInfo.ACTION_CLICK))return;
                    }
                    for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null)nodes.add(child);}
                }
            }
            Thread.sleep(50);
        }
        fail("Actual Android numeric key was unavailable: "+key);
    }
    private void typeAmountThroughNumericIme() throws Exception {
        tapImeKey("1");until("document.querySelector('input[inputmode=decimal]')?.value==='1'");
        tapImeKey(".");tapImeKey("2");until("document.querySelector('input[inputmode=decimal]')?.value==='1.2'");
        tapImeKey("5");until("document.querySelector('input[inputmode=decimal]')?.value==='1.25'");
    }
    private boolean numericKeyboardVisible(UiAutomation auto) {
        for(AccessibilityWindowInfo window:auto.getWindows()) {
            if(window.getType()!=AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue;
            java.util.ArrayDeque<AccessibilityNodeInfo> nodes=new java.util.ArrayDeque<>();
            AccessibilityNodeInfo root=window.getRoot();if(root==null) continue;nodes.add(root);
            int digits=0;boolean alphabetic=false;
            while(!nodes.isEmpty()) {
                AccessibilityNodeInfo node=nodes.remove();
                String text=String.valueOf(node.getText()).trim(), description=String.valueOf(node.getContentDescription()).trim();
                if(text.matches("[0-9]")||description.matches("[0-9]")) digits++;
                if(text.matches("[a-zA-Z]")||description.matches("[a-zA-Z]")) alphabetic=true;
                for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null)nodes.add(child);}
            }
            try {keyboardDiagnostics.put("digitKeys",digits);keyboardDiagnostics.put("alphabeticKeysPresent",alphabetic);keyboardDiagnostics.put("imeWindow",true);} catch(org.json.JSONException ignored) { throw new AssertionError(ignored); }
            if(digits>=8 && !alphabetic) return true;
        }
        try {keyboardDiagnostics.put("activeField",js("JSON.stringify({type:document.activeElement?.type,inputMode:document.activeElement?.inputMode,tag:document.activeElement?.tagName})"));} catch(Exception cause) { throw new AssertionError(cause); }
        return false;
    }
    private boolean keyboardVisible() {
        final boolean[] visible={false};
        scenario.onActivity(a->{WindowInsets insets=a.getWindow().getDecorView().getRootWindowInsets();visible[0]=insets!=null&&insets.isVisible(WindowInsets.Type.ime());});
        return visible[0];
    }
    private void cancelFirstAccountThroughAndroidBack() throws Exception {
        tab("finance");
        js("document.querySelector('.money-tools summary').click()");click("Accounts");
        until("!!document.querySelector('[data-testid=money-accounts]')");click("Add account");
        until("!!document.querySelector('form[aria-label=\"Create account\"]')");
        js("(()=>{const e=document.querySelector('form[aria-label=\"Create account\"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'QA retained account draft');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()");
        click("Save account");until("!!document.querySelector('[aria-labelledby=first-record-security-title]')");
        if(keyboardVisible()) {
            InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
            long end=SystemClock.elapsedRealtime()+5000;
            while(keyboardVisible()&&SystemClock.elapsedRealtime()<end) Thread.sleep(100);
        }
        if("true".equals(js("!!document.querySelector('[aria-labelledby=first-record-security-title]')"))) InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
        until("document.querySelector('form[aria-label=\"Create account\"] input')?.value==='QA retained account draft'");
        until("document.querySelector('form[aria-label=\"Create account\"]')?.getAttribute('aria-busy')!=='true'");
        JSONObject state=new JSONObject(WebViewTestSupport.evaluateAsync(scenario,"window.Capacitor.Plugins.LifeOSCrypto.getKeyState()"));
        assertFalse("Cancelling first-save setup must not provision a private key",state.getBoolean("keyProvisioned"));
        assertFalse("Cancelling first-save setup must not unlock a native key",state.getBoolean("unlocked"));
        capture("account-draft-after-android-back");click("Cancel");until("!!document.querySelector('[role=alertdialog]')");capture("account-unsaved-confirmation");click("Discard changes");until("!document.querySelector('form[aria-label=\"Create account\"]')");
        until("!!document.querySelector('[data-testid=account-empty-state]')");
    }
    private void captureAndroidFontScaling() throws Exception {
        final int[] originalZoom={100};
        scenario.onActivity(a -> originalZoom[0]=a.getBridge().getWebView().getSettings().getTextZoom());
        try {
            for(float fontScale:new float[]{1.3f,2f}) {
                // Exercise the installed app's actual WebView text zoom and
                // layout path without changing global device settings. The
                // system-font-to-zoom mapping has its own native regression.
                scenario.onActivity(a -> a.getBridge().getWebView().getSettings().setTextZoom(Math.round(fontScale*100)));
                final int[] zoom={0};scenario.onActivity(a -> zoom[0]=a.getBridge().getWebView().getSettings().getTextZoom());
                assertEquals(Math.round(fontScale*100),zoom[0]);
                for(String destination:new String[]{"dashboard","finance","plan","life"}) {
                    tab(destination);
                    until("(()=>{const n=document.querySelector('.app-bottom-nav'),s=document.querySelector('.app-shell');return document.documentElement.scrollWidth<=innerWidth+1&&parseFloat(getComputedStyle(s).paddingBottom)>=n.getBoundingClientRect().height&&[...n.querySelectorAll('.nav-item>span')].every(e=>e.scrollWidth<=e.clientWidth+1)})()");
                    capture(destination+"-android-text-"+Math.round(fontScale*100));
                }
            }
        } finally { scenario.onActivity(a -> a.getBridge().getWebView().getSettings().setTextZoom(originalZoom[0])); }
    }
    private void swipeFromContent(String selector,String destination,boolean left,String alignment) throws Exception {
        js("document.querySelector("+JSONObject.quote(selector)+").scrollIntoView({block:"+JSONObject.quote(alignment)+",behavior:'instant'})");
        if("end".equals(alignment))js("window.scrollBy({top:document.querySelector('.app-bottom-nav').getBoundingClientRect().height+16,behavior:'instant'})");
        JSONArray p=new JSONArray(js("(()=>{const r=document.querySelector("+JSONObject.quote(selector)+").getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth]})()"));
        final int[] position={0,0,0};
        scenario.onActivity(a->{int[] xy=new int[2];a.getBridge().getWebView().getLocationOnScreen(xy);position[0]=xy[0];position[1]=xy[1];position[2]=a.getBridge().getWebView().getWidth();});
        float scale=position[2]/(float)p.getDouble(2), x=position[0]+(float)p.getDouble(0)*scale, y=position[1]+(float)p.getDouble(1)*scale;
        float room=left?(float)p.getDouble(0)-24f:(float)(p.getDouble(2)-p.getDouble(0))-24f;
        float travel=Math.min(110f,room)*scale*(left?-1:1);
        UiAutomation auto=InstrumentationRegistry.getInstrumentation().getUiAutomation();long down=SystemClock.uptimeMillis();
        MotionEvent e=MotionEvent.obtain(down,down,MotionEvent.ACTION_DOWN,x,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();
        for(int i=1;i<=6;i++) { long now=SystemClock.uptimeMillis();e=MotionEvent.obtain(down,now,MotionEvent.ACTION_MOVE,x+travel*i/6f,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();if(i==3&&selector.equals(".today-focus h3"))capture("swipe-intermediate");Thread.sleep(30); }
        e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),MotionEvent.ACTION_UP,x+travel,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();
        until("document.querySelector('[data-tab="+destination+"]')?.getAttribute('aria-current')==='page'");
        assertEquals("false",js("!!document.querySelector('form[role=dialog]')"));
    }
    private void swipeFromTodayText() throws Exception {
        swipeFromContent(".today-focus h3","finance",true,"center");
        swipeFromContent(".money-cashflow","dashboard",false,"center");
        swipeFromContent(".app-brand-name","finance",true,"start");
        swipeFromContent(".money-action-income","dashboard",false,"center");
        swipeFromContent(".today-focus h3","finance",true,"center");
        swipeFromContent(".money-tools summary","dashboard",false,"end");
        swipeFromContent(".today-focus h3","finance",true,"center");
    }
    @Test public void packagedMandatoryOnboardingScreensAndRestart() throws Exception {
        output=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),"LifeOS-directed-visual");
        assertTrue(output.isDirectory()||output.mkdirs());
        try(ActivityScenario<MainActivity> launched=ActivityScenario.launch(MainActivity.class)) {
            scenario=launched;
            try {
                WebViewTestSupport.awaitReactRoot(scenario);
                mandatoryOnboardingVisuals();
                assertEquals("false",js("!!document.querySelector('[data-testid=today-dashboard]')"));
                assertEquals("true",js("!!document.querySelector('[aria-label=\"Set up your recovery kit\"]')"));
                JSONObject key=new JSONObject(WebViewTestSupport.evaluateAsync(scenario,"window.Capacitor.Plugins.LifeOSCrypto.getKeyState()"));
                assertFalse("Visual-only screenshots must not provision a key",key.getBoolean("keyProvisioned"));
                scenario.onActivity(a->assertEquals("Onboarding retains the APK capture policy",!BuildConfig.DEBUG,(a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE)!=0));
            } catch(Exception | AssertionError failure) { captureFailureBeforeTeardown(failure); throw failure; }
        }
    }

}
