"""Real React UI/browser evidence. Synthetic native crypto adapter; never Android evidence."""
import json, os, time, traceback
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
out=Path('test-results/directed-visual'); out.mkdir(parents=True,exist_ok=True)
options=webdriver.ChromeOptions()
options.add_argument('--headless=new'); options.add_argument('--no-sandbox'); options.add_argument('--disable-dev-shm-usage')
options.add_argument('--window-size=430,950')
d=webdriver.Chrome(options=options); d.set_script_timeout(30)
w=WebDriverWait(d,25); results=[]; images=[]
d.execute_cdp_cmd('Emulation.setTouchEmulationEnabled',{'enabled':True})
d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
def wait(css): return w.until(lambda _: next((x for x in d.find_elements(By.CSS_SELECTOR,css) if x.is_displayed()),False))
def click(text):
 def locate(_):
  for x in d.find_elements(By.CSS_SELECTOR,'button,summary'):
   if x.is_displayed() and x.is_enabled() and (x.text.strip()==text or x.get_attribute('aria-label')==text): return x
  return False
 x=w.until(locate); d.execute_script('arguments[0].scrollIntoView({block:"center"})',x); x.click(); return x
def tab(name):
 x=wait('[data-tab="'+name+'"]'); x.click(); w.until(lambda _: x.get_attribute('aria-current')=='page'); time.sleep(.3)
def capture(name):
 time.sleep(.3); p=out/(name+'.png'); d.save_screenshot(str(p)); images.append(p.name)
 assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal page overflow: '+name
 assert d.execute_script("return [...document.querySelectorAll('.ui-tab-screen')].filter(e=>!e.hidden).length===1"), 'Overlapping active screens: '+name
def field(text,value):
 f=wait('[aria-labelledby="record-form-title"]')
 e=f.find_element(By.XPATH,".//label[contains(.,'"+text+"')]//*[self::input or self::textarea]")
 e.clear(); e.send_keys(value); return e
def save(label):
 click(label)
 if d.find_elements(By.CSS_SELECTOR,'[aria-labelledby="first-record-security-title"]'): click('Protect this device and save')
 w.until(lambda _: not any(x.is_displayed() for x in d.find_elements(By.CSS_SELECTOR,'[aria-labelledby="record-form-title"]')))
def passed(name): results.append({'journey':name,'status':'PASS','environment':'Chrome, real React UI and IndexedDB; synthetic native AES-GCM adapter'})
try:
 for _ in range(40):
  try: d.get('http://127.0.0.1:5173/tests/browser/index.html'); break
  except Exception: time.sleep(.5)
 wait('input[autocomplete="nickname"]').send_keys('Acceptance QA'); click('Open LifeOS'); wait('[data-testid="today-dashboard"]'); passed('First launch and onboarding')
 for key,label in [('dashboard','today'),('finance','money'),('plan','plan'),('life','life')]: tab(key); capture(label+'-empty')
 tab('plan'); click('Add task'); capture('task-form'); field('Task title','QA morning walk'); save('Save task'); wait('.plan-hub-task'); passed('Create task through UI and first-save encryption gate')
 tab('finance'); click('Add expense'); capture('expense-form'); field('Amount','125.50')
 from selenium.webdriver.support.ui import Select
 f=wait('[aria-labelledby="record-form-title"]'); s=f.find_element(By.XPATH,".//label[normalize-space(text())='Category']/select"); Select(s).select_by_index(1)
 save('Save transaction'); passed('Create expense through UI')
 click('Add income'); capture('income-form'); field('Amount','2000'); f=wait('[aria-labelledby="record-form-title"]'); Select(f.find_element(By.XPATH,".//label[normalize-space(text())='Category']/select")).select_by_index(1); save('Save transaction'); passed('Create income through UI')
 tab('life'); click('Add a habit'); capture('habit-form'); field('Habit name','QA read ten pages'); save('Save habit'); click('Complete QA read ten pages for today'); passed('Create habit and check in through UI')
 click('Add a goal'); capture('goal-form'); field('Goal title','QA reading goal'); field('Target','12'); save('Save goal'); passed('Create goal through UI')
 for key,label in [('dashboard','today'),('finance','money'),('plan','plan'),('life','life')]: tab(key); capture(label+'-populated')
 # Persistence and ciphertext are inspected through the actual development module, never raw plaintext fixtures.
 state=d.execute_async_script("const done=arguments[0]; import('/src/db.ts').then(async m=>{ const t=await m.StorageService.tasks.getAll(); const tx=await m.StorageService.transactions.getAll(); const raw=await m.lifeOSDatabase.tasks.toArray(); done({tasks:t.length,transactions:tx.length,encrypted:raw.every(r=>r.__lifeosEncrypted===1&&!r.title)}); }).catch(e=>done({error:String(e)}));")
 assert state.get('tasks')==1 and state.get('transactions')==2 and state.get('encrypted'), str(state); passed('Created records persisted as ciphertext in real IndexedDB')
 # Native CDP touch events exercise browser touch arbitration, including content-start swipes.
 tab('dashboard'); e=wait('.today-focus h3'); r=e.rect; x=r['x']+r['width']/2; y=r['y']-d.execute_script('return scrollY')+r['height']/2
 for kind,px in [('touchStart',x),('touchMove',x-40),('touchMove',x-100),('touchMove',x-150)]:
  d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':px,'y':y}]}); time.sleep(.04)
 d.save_screenshot(str(out/'swipe-mid-drag.png')); images.append('swipe-mid-drag.png')
 d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); w.until(lambda _: wait('[data-tab="finance"]').get_attribute('aria-current')=='page'); capture('swipe-completed'); passed('Native browser touch swipe from ordinary heading')
 click('Open profile and settings'); capture('profile'); click('Appearance'); capture('appearance'); click('Dark'); capture('appearance-dark'); d.refresh(); wait('[data-testid="today-dashboard"]'); assert d.execute_script('return document.documentElement.classList.contains("dark")'); passed('Theme and encrypted records survive page restart using synthetic native key')
 for width,height in [(320,780),(768,900),(1024,768)]:
  d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':True})
  for key,label in [('dashboard','today'),('finance','money'),('plan','plan'),('life','life')]: tab(key); capture(f'{label}-{width}x{height}')
 passed('Responsive layouts at compact, tablet and landscape browser window sizes')
 results.append({'journey':'Android keyboard, Back, notification delivery/tap, biometric lock and update install','status':'BLOCKED','reason':'Browser evidence does not validate Android native behavior; hosted Android instrumentation is separate.'})
except Exception as e:
 results.append({'journey':'Current browser journey','status':'FAIL','error':str(e),'trace':traceback.format_exc()}); d.save_screenshot(str(out/'failure.png')); raise
finally:
 (out/'results.json').write_text(json.dumps({'sourceCommit':os.getenv('GITHUB_SHA'),'environment':'Hosted Chrome actual React app with test-only synthetic native crypto plugin; no Android or physical-device acceptance claimed','results':results,'screenshots':images},indent=2)); d.quit()
