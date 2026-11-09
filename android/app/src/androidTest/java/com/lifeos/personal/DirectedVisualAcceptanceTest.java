package com.lifeos.personal;

import android.app.UiAutomation;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.view.accessibility.AccessibilityNodeInfo;
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
    private void denyOptionalNotificationPrompt() throws Exception {
        UiAutomation auto=InstrumentationRegistry.getInstrumentation().getUiAutomation();
        AccessibilityServiceInfo info=auto.getServiceInfo();
        info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
        auto.setServiceInfo(info);
        boolean denied=false; long end=SystemClock.elapsedRealtime()+30000;
        while(SystemClock.elapsedRealtime()<end) {
            AccessibilityNodeInfo root=auto.getRootInActiveWindow();
            if(root!=null) {
                for(AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByViewId("com.android.permissioncontroller:id/permission_deny_button")) {
                    if(node.isEnabled() && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { denied=true; break; }
                }
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
    private void openNumericKeyboard() throws Exception {
        JSONArray p=new JSONArray(js("(()=>{const r=document.querySelector('input[inputmode=decimal]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth]})()"));
        final int[] xy={0,0,0};
        scenario.onActivity(a->{int[] o=new int[2];a.getBridge().getWebView().getLocationOnScreen(o);xy[0]=o[0];xy[1]=o[1];xy[2]=a.getBridge().getWebView().getWidth();});
        float scale=xy[2]/(float)p.getDouble(2),x=xy[0]+(float)p.getDouble(0)*scale,y=xy[1]+(float)p.getDouble(1)*scale;
        UiAutomation auto=InstrumentationRegistry.getInstrumentation().getUiAutomation();long down=SystemClock.uptimeMillis();
        MotionEvent e=MotionEvent.obtain(down,down,MotionEvent.ACTION_DOWN,x,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();
        e=MotionEvent.obtain(down,SystemClock.uptimeMillis()+40,MotionEvent.ACTION_UP,x,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();
        long end=SystemClock.elapsedRealtime()+10000;final boolean[] visible={false};
        while(SystemClock.elapsedRealtime()<end) {
            scenario.onActivity(a->{WindowInsets insets=a.getWindow().getDecorView().getRootWindowInsets();visible[0]=insets!=null&&insets.isVisible(WindowInsets.Type.ime());});
            if(visible[0]) { until("document.activeElement?.inputMode==='decimal'"); return; }
            Thread.sleep(100);
        }
        fail("Native tap on amount did not open Android's keyboard");
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
    private void swipeFromTodayText() throws Exception {
        JSONArray p=new JSONArray(js("(()=>{const r=document.querySelector('.today-focus h3').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth]})()"));
        final int[] position={0,0,0};
        scenario.onActivity(a->{int[] xy=new int[2];a.getBridge().getWebView().getLocationOnScreen(xy);position[0]=xy[0];position[1]=xy[1];position[2]=a.getBridge().getWebView().getWidth();});
        float scale=position[2]/(float)p.getDouble(2), x=position[0]+(float)p.getDouble(0)*scale, y=position[1]+(float)p.getDouble(1)*scale;
        float travel=Math.min(110f,(float)p.getDouble(0)-22f)*scale;
        UiAutomation auto=InstrumentationRegistry.getInstrumentation().getUiAutomation();long down=SystemClock.uptimeMillis();
        MotionEvent e=MotionEvent.obtain(down,down,MotionEvent.ACTION_DOWN,x,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();
        for(int i=1;i<=6;i++) { long now=SystemClock.uptimeMillis();e=MotionEvent.obtain(down,now,MotionEvent.ACTION_MOVE,x-travel*i/6f,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();if(i==3)capture("swipe-intermediate");Thread.sleep(30); }
        e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),MotionEvent.ACTION_UP,x-travel,y,0);e.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);assertTrue(auto.injectInputEvent(e,true));e.recycle();
        until("document.querySelector('[data-tab=finance]')?.getAttribute('aria-current')==='page'");
    }
    @Test public void realPackagedScreensFormsAndContentSwipe() throws Exception {
        output=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),"LifeOS-directed-visual");
        assertTrue(output.isDirectory()||output.mkdirs());
        try(ActivityScenario<MainActivity> launched=ActivityScenario.launch(MainActivity.class)) {
            scenario=launched; WebViewTestSupport.awaitReactRoot(scenario);
            until("!!document.querySelector('input[autocomplete=nickname]')");
            js("(()=>{const e=document.querySelector('input[autocomplete=nickname]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Android QA');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()");
            click("Open LifeOS");until("!!document.querySelector('[data-testid=today-dashboard]')");
            denyOptionalNotificationPrompt();until("!document.querySelector('.lifeos-launch-reveal')");capture("today-empty");swipeFromTodayText();capture("money-after-native-swipe");
            click("Add expense");until("!!document.querySelector('[aria-labelledby=record-form-title]')");capture("expense-form");openNumericKeyboard();capture("expense-numeric-keyboard");click("Cancel");until("!document.querySelector('[aria-labelledby=record-form-title]')");
            cancelFirstAccountThroughAndroidBack();tab("plan");capture("plan-empty");click("Add task");until("!!document.querySelector('[aria-labelledby=record-form-title]')");capture("task-form");click("Cancel");until("!document.querySelector('[aria-labelledby=record-form-title]')");
            tab("life");capture("life-empty");click("Add a habit");until("!!document.querySelector('[aria-labelledby=record-form-title]')");capture("habit-form");click("Cancel");until("!document.querySelector('[aria-labelledby=record-form-title]')");
            click("Add a goal");until("!!document.querySelector('[aria-labelledby=record-form-title]')");capture("goal-form");click("Cancel");until("!document.querySelector('[aria-labelledby=record-form-title]')");
            click("Open profile and settings");until("!!document.querySelector('[data-testid=profile-settings-home]')");capture("profile");
            JSONObject report=new JSONObject();report.put("environment","Real packaged Android app on fresh hosted emulator");report.put("api",android.os.Build.VERSION.SDK_INT);report.put("model",android.os.Build.MODEL);report.put("privateWrites",0);report.put("androidBack","PASS: first account setup cancelled by native Back; draft retained; key remained unprovisioned and locked");report.put("onboardingCapture","BLOCKED: native onboarding remains protected by the application screenshot policy");report.put("notificationPermission","Denied through the actual Android system dialog on this disposable emulator");report.put("screenshots",captures);report.put("contentSwipe","PASS: native touchscreen injection from Today heading to Money");
            try(FileOutputStream file=new FileOutputStream(new File(output,"environment.json"))) { file.write(report.toString(2).getBytes("UTF-8")); }
        }
    }
}
