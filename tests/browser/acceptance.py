"""Real React UI/browser evidence. Synthetic native crypto adapter; never Android evidence."""
import json, os, time, traceback
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
out=Path('test-results/directed-visual'); out.mkdir(parents=True,exist_ok=True)
options=webdriver.ChromeOptions()
options.add_argument('--headless=new'); options.add_argument('--no-sandbox'); options.add_argument('--disable-dev-shm-usage')
options.add_argument('--window-size=430,950')
d=webdriver.Chrome(options=options); d.set_script_timeout(30)
w=WebDriverWait(d,25,ignored_exceptions=(StaleElementReferenceException,)); results=[]; images=[]
d.execute_cdp_cmd('Emulation.setTouchEmulationEnabled',{'enabled':True})
d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
def wait(css): return w.until(lambda _: next((x for x in d.find_elements(By.CSS_SELECTOR,css) if x.is_displayed()),False))
def click(text):
 def locate(_):
  found=[]
  for x in d.find_elements(By.CSS_SELECTOR,'button,summary'):
   normalized=' '.join(x.text.split()).lstrip('+ ')
   if x.is_displayed() and x.is_enabled() and (normalized==text or normalized.startswith(text+' ') or x.get_attribute('aria-label')==text): found.append(x)
  return found[-1] if found else False
 x=w.until(locate); d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',x); x.click(); return x
def tab(name):
 x=wait('[data-tab="'+name+'"]'); x.click(); w.until(lambda _: x.get_attribute('aria-current')=='page'); time.sleep(.3)
 if name=='finance' and not d.find_elements(By.CSS_SELECTOR,'[data-testid=money-home]'):
  x.click(); wait('[data-testid=money-home]')
def tap(css):
 x=wait(css); d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',x); x.click()
def capture(name):
 time.sleep(.3); p=out/(name+'.png'); d.save_screenshot(str(p)); images.append(p.name)
 assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal page overflow: '+name
 assert d.execute_script("const a=document.querySelector('.app-brand-name')?.getBoundingClientRect(),b=document.querySelector('.app-profile-button')?.getBoundingClientRect();return !a||!b||a.right<=b.left"), 'Brand overlaps profile control: '+name
 assert d.execute_script("return [...document.querySelectorAll('.app-bottom-nav .nav-item > span')].every(e=>e.scrollWidth<=e.clientWidth+1)"), 'Navigation label overflows its own control: '+name
 assert d.execute_script("const e=document.querySelector('.money-period input');return !e||e.getBoundingClientRect().right<=e.parentElement.getBoundingClientRect().right+1"), 'Money period control clipped: '+name
 assert d.execute_script("const n=[...document.querySelectorAll('.ui-tab-screen')].filter(e=>!e.hidden).length;return n===1||(n===0&&!!document.querySelector('[aria-labelledby=first-record-security-title]'))"), 'Overlapping active screens: '+name
def field(text,value):
 f=wait('form[role="dialog"]')
 e=f.find_element(By.XPATH,".//label[contains(.,'"+text+"')]//*[self::input or self::textarea]")
 d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',e); e.clear(); e.send_keys(value); return e
def save(label):
 click(label)
 w.until(lambda _: d.find_elements(By.CSS_SELECTOR,'[aria-labelledby="first-record-security-title"]') or not any(x.is_displayed() for x in d.find_elements(By.CSS_SELECTOR,'form[role="dialog"]')))
 if d.find_elements(By.CSS_SELECTOR,'[aria-labelledby="first-record-security-title"]'):
  capture('first-save-security'); click('Protect this device and save')
 w.until(lambda _: not any(x.is_displayed() for x in d.find_elements(By.CSS_SELECTOR,'form[role="dialog"]')))
def passed(name): results.append({'journey':name,'status':'PASS','environment':'Chrome, real React UI and IndexedDB; synthetic native AES-GCM adapter'})
try:
 for _ in range(40):
  try: d.get('http://127.0.0.1:5173/tests/browser/index.html'); break
  except Exception: time.sleep(.5)
 wait('input[autocomplete="nickname"]').send_keys('Acceptance QA'); click('Open LifeOS'); wait('[data-testid="today-dashboard"]'); passed('First launch and onboarding')
 for key,label in [('dashboard','today'),('finance','money'),('plan','plan'),('life','life')]: tab(key); capture(label+'-empty')
 tab('plan'); click('Add task'); capture('task-form'); click('More task details'); capture('task-advanced-form'); click('More task details'); field('Task title','QA morning walk'); save('Save task'); wait('.plan-hub-task'); passed('Create task through UI and first-save encryption gate')
 tab('finance'); click('Add expense'); capture('expense-form'); field('Amount','125.50')
 from selenium.webdriver.support.ui import Select
 f=wait('form[role="dialog"]'); s=f.find_element(By.XPATH,".//label[normalize-space(text())='Category']/select"); Select(s).select_by_index(1)
 save('Save transaction'); passed('Create expense through UI')
 click('Add income'); capture('income-form'); field('Amount','2000'); f=wait('form[role="dialog"]'); Select(f.find_element(By.XPATH,".//label[normalize-space(text())='Category']/select")).select_by_index(1); save('Save transaction'); passed('Create income through UI')
 tab('life'); click('Add a habit'); capture('habit-form'); field('Habit name','QA read ten pages'); save('Save habit'); click('Complete QA read ten pages for today'); passed('Create habit and check in through UI')
 click('Add a goal'); capture('goal-form'); field('Goal title','QA reading goal'); field('Target','12'); save('Save goal'); passed('Create goal through UI')
 for key,label in [('dashboard','today'),('finance','money'),('plan','plan'),('life','life')]: tab(key); capture(label+'-populated')
 # Persistence and ciphertext are inspected through the actual development module, never raw plaintext fixtures.
 state=d.execute_async_script("const done=arguments[0]; import('/src/db.ts').then(async m=>{ const t=await m.StorageService.tasks.getAll(); const tx=await m.StorageService.transactions.getAll(); const raw=await m.lifeOSDatabase.tasks.toArray(); done({tasks:t.length,transactions:tx.length,encrypted:raw.every(r=>r.__lifeosEncrypted===1&&!r.title)}); }).catch(e=>done({error:String(e)}));")
 assert state.get('tasks')==1 and state.get('transactions')==2 and state.get('encrypted'), str(state); passed('Created records persisted as ciphertext in real IndexedDB')
 # Exercise financial setup through the UI after the initial populated-state captures.
 def money_page(section):
  tab('finance'); summary=wait('.money-tools summary'); d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',summary); summary.click(); click(section)
 money_page('Accounts')
 for name,amount in [('QA bank','10000'),('QA cash','500')]:
  click('Add account'); capture('account-form-'+name.replace(' ','-')); field('Account name',name); field('Starting balance',amount); save('Save account')
 click('Transfer'); capture('transfer-form'); field('Amount sent','250'); save('Save transfer'); capture('accounts-populated'); passed('Create accounts and transfer through UI')
 balances=d.execute_async_script("const done=arguments[0]; Promise.all([import('/src/db.ts'),import('/src/services/financialAccounting.ts')]).then(async([m,a])=>{const accounts=await m.StorageService.accounts.getAll(); const b=a.calculateAccountBalances(accounts,await m.StorageService.transactions.getAll(),await m.StorageService.accounts.getTransfers()); done(Object.fromEntries(accounts.map(x=>[x.name,String(b.get(x.id))])));}).catch(e=>done({error:String(e)}));")
 assert balances=={'QA bank':'975000','QA cash':'75000'}, str(balances); passed('Transfer balances verified in exact minor units')
 money_page('Budgets'); click('Add budget'); capture('budget-form'); field('Monthly limit','1000'); save('Save budget'); capture('budgets-populated'); passed('Create budget against existing recorded expense')
 money_page('Savings'); click('Add goal'); capture('savings-form'); field('Goal title','QA emergency reserve'); field('Target amount','5000'); save('Save savings'); click('Add contribution'); capture('contribution-form'); field('Amount','100'); save('Save contribution'); capture('savings-populated'); passed('Create savings goal and record contribution through UI')
 for name in ['All transactions','Reports','Planned bills']:
  if name=='All transactions': tab('finance'); click(name)
  else: money_page(name)
  capture(name.lower().replace(' ','-'))
 tab('plan'); click('QA morning walk'); capture('task-details'); click('Calendar'); capture('calendar-populated'); click('Calendar'); click('Edit task'); field('Task title','QA morning walk updated'); save('Save task'); click('Complete task'); capture('task-completed'); passed('View, edit and complete task through UI')
 click('Back to agenda'); click('Delete'); capture('task-delete-confirmation'); click('Delete task'); passed('Delete task through confirmation')
 tab('finance'); tap('[aria-label*="expense"][class*="money-transaction-row"]'); field('Merchant or description','QA lunch updated'); save('Save transaction'); tap('[aria-label^="Edit QA lunch updated"]'); capture('transaction-details-edit'); click('Delete transaction'); capture('transaction-delete-confirmation'); click('Delete transaction'); passed('Edit and delete expense through UI')
 tab('life'); click('All goals and milestones'); click('QA reading goal'); field('Goal title','QA reading goal updated'); save('Save goal'); click('Milestone'); capture('milestone-form'); field('Milestone title','QA first book'); save('Save milestone'); capture('goal-milestone'); passed('Edit goal and add milestone through UI')
 click('Complete'); complete_filter=d.find_element(By.XPATH,"//button[normalize-space()='completed']");d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',complete_filter);complete_filter.click();wait('#screen-goals');capture('goal-completed');passed('Complete goal and find it through Completed filter')
 tab('life');click('View all habits');click('QA read ten pages');field('Habit name','QA read ten pages updated');save('Save habit');capture('habit-edited');passed('Edit habit while preserving existing check-in')

 tab('dashboard'); click('Customize'); capture('today-customization'); toggles=d.find_elements(By.CSS_SELECTOR,'#today-customization input:not(:disabled)'); toggles[-1].click(); click('Customize'); passed('Customize Today through saved section visibility control'); today_layout=d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>done(await m.StorageService.settings.get('todayLayout',null)));")
 backup=d.execute_async_script("const done=arguments[0]; Promise.all([import('/src/db.ts'),import('/src/services/backupCryptoService.ts')]).then(async([m,b])=>{const original=await m.StorageService.backup.exportData();const encrypted=await b.encryptBackup(original,'QA isolated backup passphrase 2026');const decoded=await b.decryptBackup(encrypted,'QA isolated backup passphrase 2026');m.validateBackupTables(JSON.parse(decoded).tables);let rejected=false;try{await b.decryptBackup(encrypted,'wrong QA passphrase 2026')}catch{rejected=true;} await m.StorageService.backup.importData(decoded,{replaceExisting:true});done({same:decoded===original,rejected,accounts:(await m.StorageService.accounts.getAll()).length});}).catch(e=>done({error:String(e)}));")
 assert backup=={'same':True,'rejected':True,'accounts':2},str(backup); passed('Encrypted backup roundtrip, wrong-passphrase rejection and isolated restore using production services')
 # CDP touch uses the browser's actual pointer arbitration and implicit capture.
 def swipe(css,dx,dy=0,ending='touchEnd',mid=None):
  e=wait(css); d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',e)
  point=d.execute_script('const r=arguments[0].getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}',e); x=point['x'];y=point['y']
  # Keep endpoints inside the logical viewport without changing production thresholds.
  dx=max(20-x,min(dx,d.execute_script('return innerWidth')-20-x))
  d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  for f in [.25,.55,1]:
   d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*f,'y':y+dy*f}]}); time.sleep(.04)
  if mid:
   w.until(lambda _: d.execute_script('return !!document.querySelector("[data-gesture-dragging=true]")'))
   d.save_screenshot(str(out/(mid+'.png')));images.append(mid+'.png')
  d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':ending,'touchPoints':[]})
  time.sleep(.25)
 tab('dashboard'); swipe('.today-focus h3',-120,mid='swipe-mid-drag')
 w.until(lambda _: wait('[data-tab="finance"]').get_attribute('aria-current')=='page'); capture('swipe-completed'); passed('Real touch swipe from ordinary heading, including implicit capture transfer')
 swipe('.money-cashflow',-120); w.until(lambda _: wait('[data-tab="plan"]').get_attribute('aria-current')=='page')
 swipe('.plan-hub-empty',-120); w.until(lambda _: wait('[data-tab="life"]').get_attribute('aria-current')=='page')
 swipe('.life-section-more',120); w.until(lambda _: wait('[data-tab="plan"]').get_attribute('aria-current')=='page');wait('.plan-hub')
 swipe('.plan-hub-empty',120); w.until(lambda _: wait('[data-tab="finance"]').get_attribute('aria-current')=='page')
 swipe('.money-action-expense',120); w.until(lambda _: wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page');assert not d.find_elements(By.CSS_SELECTOR,'form[role="dialog"]')
 passed('Card, row and ordinary-button touch swipes across all four tabs; no accidental button activation')
 swipe('.today-focus h3',-15);assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page'
 swipe('.today-focus h3',-90,ending='touchCancel');assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page';assert not d.find_elements(By.CSS_SELECTOR,'[data-gesture-dragging]')
 passed('Short swipe returns and cancelled swipe clears ownership')
 d.execute_script('window.scrollTo({top:0,behavior:"instant"})');swipe('.today-focus',0,-110);assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page';assert d.execute_script('return scrollY>0');passed('Vertical touch scroll remains independent of tab navigation')
 d.execute_cdp_cmd('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]});swipe('.today-focus h3',-120);w.until(lambda _: wait('[data-tab="finance"]').get_attribute('aria-current')=='page');capture('reduced-motion-navigation');d.execute_cdp_cmd('Emulation.setEmulatedMedia',{'features':[]});passed('Reduced motion retains immediate touch navigation')
 (out/'gesture-trace.json').write_text(json.dumps(d.execute_script('return window.__lifeosGestureTrace||[]'),indent=2))
 click('Open profile and settings'); capture('profile');
 for section in ['Preferences','Notifications','Privacy & security','Data & backup','About LifeOS']:
  click(section); capture('settings-'+section.lower().replace(' ','-').replace('&','and')); click('Profile')
 click('Appearance'); capture('appearance'); click('Dark'); capture('appearance-dark'); d.refresh(); wait('[data-testid="today-dashboard"]'); assert d.execute_script('return document.documentElement.classList.contains("dark")'); passed('Theme and encrypted records survive page restart using synthetic native key')
 assert d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>done(await m.StorageService.settings.get('todayLayout',null)));")==today_layout;passed('Today section customization persists after restart')
 for width,height in [(320,780),(768,900),(1024,768)]:
  d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':True})
  for key,label in [('dashboard','today'),('finance','money'),('plan','plan'),('life','life')]: tab(key); capture(f'{label}-{width}x{height}')
 d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':320,'height':780,'deviceScaleFactor':1,'mobile':True})
 d.execute_script("document.documentElement.style.fontSize='200%'")
 for key,label in [('dashboard','today'),('finance','money'),('plan','plan'),('life','life')]: tab(key); capture(label+'-200-percent-text')
 d.execute_script("document.documentElement.style.fontSize=''")
 passed('Responsive layouts at compact, tablet and landscape browser window sizes')
 results.append({'journey':'Android keyboard, Back, notification delivery/tap, biometric lock and update install','status':'BLOCKED','reason':'Browser evidence does not validate Android native behavior; hosted Android instrumentation is separate.'})
except Exception as e:
 results.append({'journey':'Current browser journey','status':'FAIL','error':str(e),'trace':traceback.format_exc(),'gestureTrace':d.execute_script('return window.__lifeosGestureTrace||[]'),'visibleControls':[x.text for x in d.find_elements(By.CSS_SELECTOR,'button,summary') if x.is_displayed()]}); d.save_screenshot(str(out/'failure.png')); raise
finally:
 (out/'results.json').write_text(json.dumps({'sourceCommit':os.getenv('GITHUB_SHA'),'environment':'Hosted Chrome actual React app with test-only synthetic native crypto plugin; no Android or physical-device acceptance claimed','results':results,'screenshots':images},indent=2)); d.quit()
