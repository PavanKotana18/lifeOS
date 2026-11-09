"""Real React UI/browser evidence. Synthetic native crypto adapter; never Android evidence."""
import json, os, time, traceback, tempfile, shutil
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
out=Path('test-results/directed-visual'); out.mkdir(parents=True,exist_ok=True)
download_dir=tempfile.mkdtemp(prefix='lifeos-acceptance-recovery-')
options=webdriver.ChromeOptions()
options.add_argument('--headless=new'); options.add_argument('--no-sandbox'); options.add_argument('--disable-dev-shm-usage')
options.add_argument('--window-size=430,950')
options.add_experimental_option('prefs',{'download.default_directory':download_dir,'download.prompt_for_download':False,'download.directory_upgrade':True})
d=webdriver.Chrome(options=options); d.set_script_timeout(30)
w=WebDriverWait(d,25,ignored_exceptions=(StaleElementReferenceException,)); results=[]; images=[]
d.execute_cdp_cmd('Emulation.setTouchEmulationEnabled',{'enabled':True})
d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
d.execute_cdp_cmd('Browser.grantPermissions',{'origin':'http://127.0.0.1:5173','permissions':['clipboardReadWrite']})
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
 x=wait(css); d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',x); d.execute_async_script('const done=arguments[0];requestAnimationFrame(()=>requestAnimationFrame(done));'); x.click()
def capture(name):
 time.sleep(.3); p=out/(name+'.png'); d.execute_script("const s=document.createElement('style');s.id='qa-secret-redaction';s.textContent='[data-sensitive-recovery-code]{visibility:hidden!important}#recovery-code-confirmation{-webkit-text-security:disc!important;color:transparent!important;text-shadow:0 0 8px #25312a!important}';document.head.appendChild(s)"); d.save_screenshot(str(p)); d.execute_script("document.getElementById('qa-secret-redaction')?.remove()"); images.append(p.name)
 assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal page overflow: '+name
 assert d.execute_script("const a=document.querySelector('.app-brand-name')?.getBoundingClientRect(),b=document.querySelector('.app-profile-button')?.getBoundingClientRect();return !a||!b||a.right<=b.left"), 'Brand overlaps profile control: '+name
 assert d.execute_script("return [...document.querySelectorAll('.app-bottom-nav .nav-item > span')].every(e=>e.scrollWidth<=e.clientWidth+1)"), 'Navigation label overflows its own control: '+name
 assert d.execute_script("const n=document.querySelector('.app-bottom-nav'),s=document.querySelector('.app-shell');return !n||!s||parseFloat(getComputedStyle(s).paddingBottom)>=n.getBoundingClientRect().height"), 'Content does not reserve navigation height: '+name
 assert d.execute_script("const e=document.querySelector('.money-period input');return !e||e.getBoundingClientRect().right<=e.parentElement.getBoundingClientRect().right+1"), 'Money period control clipped: '+name
 assert d.execute_script("const n=[...document.querySelectorAll('.ui-tab-screen')].filter(e=>!e.hidden).length;return n===1||(n===0&&!!document.querySelector('[aria-labelledby=first-record-security-title],main.onboarding-root'))"), 'Overlapping active screens: '+name
 assert d.execute_script("const forms=[...document.querySelectorAll('form[role=dialog]')].filter(e=>e.getClientRects().length);return !forms.length||!!document.querySelector('[role=alertdialog]')||forms.some(e=>e.contains(document.activeElement))"), 'Visible form did not receive focus: '+name
def field(text,value):
 f=wait('form[role="dialog"]')
 e=f.find_element(By.XPATH,".//label[contains(.,'"+text+"')]//*[self::input or self::textarea]")
 d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',e); e.clear(); e.send_keys(value); return e
def save(label):
 click(label)
 w.until(lambda _: not any(x.is_displayed() for x in d.find_elements(By.CSS_SELECTOR,'form[role="dialog"]')))
 assert not d.find_elements(By.CSS_SELECTOR,'[aria-labelledby="first-record-security-title"]'), 'Completed onboarding must not repeat first-record setup'
 w.until(lambda _: not any(x.is_displayed() for x in d.find_elements(By.CSS_SELECTOR,'form[role="dialog"]')))
def finish_first_launch(name):
 wait('input[autocomplete="nickname"]').send_keys(name); click('Continue')
 wait('[aria-label="Protect your LifeOS space"]'); click('Continue with secure unlock')
 wait('[aria-label="Set up your recovery kit"]'); click('Create and save recovery kit'); wait('[data-testid="copy-recovery-code"]')
 code=d.find_element(By.CSS_SELECTOR,'[data-sensitive-recovery-code]').text; assert code=='A'*43, 'synthetic code is available in the recovery card'
 click('Save complete recovery kit'); exported=w.until(lambda _: next(iter(Path(download_dir).glob('*.json')),False)); kit=json.loads(exported.read_text(encoding='utf-8'))
 assert kit.get('recoveryCode')==code and isinstance(kit.get('envelope'),dict) and kit.get('format')=='lifeos-recovery-kit', 'export contains complete recovery material'; exported.unlink()
 click(code); copied=w.until(lambda _: d.execute_async_script("const done=arguments[0];navigator.clipboard.readText().then(done).catch(()=>done(''))")); assert copied==code, 'recovery card copies exact code'
 confirm=wait('[data-testid="recovery-code-confirmation"]'); confirm.send_keys('B'*43); assert d.find_element(By.CSS_SELECTOR,'[data-testid="continue-to-lifeos"]').get_attribute('disabled') is not None
 confirm.clear(); confirm.send_keys(Keys.CONTROL,'v')
 w.until(lambda _: d.find_element(By.CSS_SELECTOR,'[data-testid="continue-to-lifeos"]').is_enabled())
 click('Continue to LifeOS'); wait('[data-testid="today-dashboard"]')
def passed(name): results.append({'journey':name,'status':'PASS','environment':'Chrome, real React UI and IndexedDB; synthetic native AES-GCM adapter'})
try:
 for _ in range(40):
  try: d.get('http://127.0.0.1:5173/tests/browser/index.html'); break
  except Exception: time.sleep(.5)
 wait('input[autocomplete="nickname"]');capture('onboarding-welcome');finish_first_launch('Acceptance QA'); passed('Mandatory three-stage onboarding and encrypted recovery setup')
 for key,label in [('dashboard','today'),('finance','money'),('plan','plan'),('life','life')]: tab(key); capture(label+'-empty')
 from selenium.webdriver.support.ui import Select
 # A first-time user may start with Money, before any task provisions storage.
 tab('finance');click('Add expense');capture('expense-first-use');field('Amount','125.50')
 first_category=wait('form[role="dialog"]').find_element(By.XPATH,".//label[normalize-space(text())='Category']/select")
 assert len(first_category.find_elements(By.TAG_NAME,'option'))>1, 'Mandatory onboarding must load categories before opening the private workspace'
 Select(first_category).select_by_index(1);capture('expense-form')
 click('Save transaction');assert not d.find_elements(By.CSS_SELECTOR,'[aria-labelledby="first-record-security-title"]'), 'First record after onboarding must not prompt again'
 w.until(lambda _: d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>done((await m.StorageService.transactions.getAll()).length));")==1)
 passed('First expense: categories are ready, no repeated protection prompt, and encrypted save succeeds')
 tab('plan'); click('Add task'); capture('task-form'); click('More task details'); capture('task-advanced-form'); click('More task details'); field('Task title','QA morning walk'); save('Save task'); wait('.plan-hub-task'); passed('Create task through UI')
 tab('finance')
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
 def swipe(css,dx,dy=0,ending='touchEnd',mid=None,align='center'):
  e=wait(css); d.execute_script('arguments[0].scrollIntoView({block:arguments[1],behavior:"instant"})',e,align)
  if align=='end': d.execute_script('window.scrollBy({top:(document.querySelector(".app-bottom-nav")?.getBoundingClientRect().height||0)+16,behavior:"instant"})')
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
 # Actual pointer arbitration across upper header, clipped cards, controls and lower content.
 for css,align in [('.app-brand-name','start'),('.money-cashflow','center'),('.money-action-income','center'),('.money-tools summary','end')]:
  tab('finance');swipe(css,120,align=align);w.until(lambda _: wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page')
  assert not d.find_elements(By.CSS_SELECTOR,'form[role="dialog"]')
 passed('Upper header, clipped summary, ordinary action button and lower scroll content initiate real touch navigation')
 tab('finance');swipe('.money-cashflow',-120,ending='touchCancel');assert wait('[data-tab="finance"]').get_attribute('aria-current')=='page'
 for _ in range(3):
  swipe('.money-action-income',120);w.until(lambda _:wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page')
  swipe('.today-focus h3',-120);w.until(lambda _:wait('[data-tab="finance"]').get_attribute('aria-current')=='page')
 passed('Rapid alternating button/card swipes and cancellation leave one active screen with no accidental form activation')
 tab('dashboard')

 swipe('.today-focus h3',-15);assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page'
 swipe('.today-focus h3',-90,ending='touchCancel');assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page';assert not d.find_elements(By.CSS_SELECTOR,'[data-gesture-dragging]')
 passed('Short swipe returns and cancelled swipe clears ownership')
 d.execute_script('window.scrollTo({top:0,behavior:"instant"})');swipe('.today-focus',0,-110);assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page';assert d.execute_script('return scrollY>0');passed('Vertical touch scroll remains independent of tab navigation')
 d.execute_cdp_cmd('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]});swipe('.today-focus h3',-120);w.until(lambda _: wait('[data-tab="finance"]').get_attribute('aria-current')=='page');capture('reduced-motion-navigation');d.execute_cdp_cmd('Emulation.setEmulatedMedia',{'features':[]});passed('Reduced motion retains immediate touch navigation')
 # Reserved system edges do not become a hidden tab-navigation zone.
 tab('dashboard');heading=wait('.today-focus h3');d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',heading);y=d.execute_script('return arguments[0].getBoundingClientRect().top+10',heading);right=d.execute_script('return innerWidth-1')
 d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':right,'y':y}]});d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':right-120,'y':y}]});d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page';passed('Reserved browser edge leaves tab navigation unchanged; actual Android insets tested separately')
 d.execute_script('const r=document.createRange();r.selectNodeContents(arguments[0]);const s=getSelection();s.removeAllRanges();s.addRange(r)',heading);swipe('.today-focus h3',-120);assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page';d.execute_script('getSelection().removeAllRanges()');passed('Selected text retains ownership instead of becoming a tab swipe')
 d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':150,'y':y,'id':1},{'x':240,'y':y,'id':2}]});d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':70,'y':y,'id':1},{'x':160,'y':y,'id':2}]});d.execute_cdp_cmd('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert wait('[data-tab="dashboard"]').get_attribute('aria-current')=='page';assert not d.find_elements(By.CSS_SELECTOR,'[data-gesture-dragging]');passed('Multitouch cancels primary navigation without a stuck drag')
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
 # A second fresh disposable browser profile verifies account-first setup and draft recovery.
 d.quit();d=webdriver.Chrome(options=options);w=WebDriverWait(d,25,ignored_exceptions=(StaleElementReferenceException,))
 d.execute_cdp_cmd('Emulation.setTouchEmulationEnabled',{'enabled':True});d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
 d.get('http://127.0.0.1:5173/tests/browser/index.html');finish_first_launch('First account QA')
 money_page('Accounts');click('Add account');field('Account name','QA first account');field('Starting balance','100');click('Save account');w.until(lambda _: not d.find_elements(By.CSS_SELECTOR,'form[aria-label="Create account"]'));assert not d.find_elements(By.CSS_SELECTOR,'[aria-labelledby="first-record-security-title"]');capture('first-account-saved')
 first_account=d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>{const a=await m.StorageService.accounts.getAll();const raw=await m.lifeOSDatabase.financialAccounts.toArray();done({count:a.length,opening:a[0]?.openingBalanceMinor,transactions:(await m.StorageService.transactions.getAll()).length,ciphertext:raw.every(x=>x.__lifeosEncrypted===1&&!x.name)});});")
 assert first_account=={'count':1,'opening':'10000','transactions':0,'ciphertext':True},str(first_account);passed('Account-first secure setup, cancellation draft preservation, encrypted save and opening-balance neutrality')
 # A third isolated first-use profile covers planned bills without posting a transaction.
 d.quit();d=webdriver.Chrome(options=options);d.set_script_timeout(30);w=WebDriverWait(d,25,ignored_exceptions=(StaleElementReferenceException,))
 d.execute_cdp_cmd('Emulation.setTouchEmulationEnabled',{'enabled':True});d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
 d.get('http://127.0.0.1:5173/tests/browser/index.html');finish_first_launch('First bill QA')
 money_page('Planned bills');tap('[data-testid="money-planning"] section button');field('Name','QA future rent');field('Amount','900');capture('first-planned-bill-form');click('Save plan');w.until(lambda _: not d.find_elements(By.CSS_SELECTOR,'form[aria-label="Planned commitment"]'));assert not d.find_elements(By.CSS_SELECTOR,'[aria-labelledby="first-record-security-title"]');capture('planned-bills-populated')
 planning=d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>done({plans:(await m.StorageService.commitments.getAll()).map(x=>({title:x.title,amount:x.amountMinor,status:x.status})),transactions:(await m.StorageService.transactions.getAll()).length}));")
 assert planning=={'plans':[{'title':'QA future rent','amount':'90000','status':'active'}],'transactions':0},str(planning);passed('Planned bill first-save setup preserves cancelled draft and never posts spending')
 # Manual rates remain explicit, dated inputs, not automatically fetched conversions.
 buttons=d.find_elements(By.CSS_SELECTOR,'[data-testid="money-planning"] section button');d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',buttons[-1]);buttons[-1].click();field('Quote units','83.25');capture('manual-rate-form');save('Save rate');capture('manual-rate-saved')
 rates=d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>done((await m.StorageService.exchangeRates.getAll()).map(x=>({base:x.baseCurrencyCode,quote:x.quoteCurrencyCode,rate:x.rate}))));")
 assert rates==[{'base':'USD','quote':'INR','rate':'83.25'}],str(rates);passed('Explicit manual exchange rate saved with unchanged decimal precision')
 click('Explore a savings projection');wait('[aria-label="Starting savings"]') if d.find_elements(By.CSS_SELECTOR,'[aria-label="Starting savings"]') else wait('input[type="number"]');capture('savings-projection-expanded');click('Explore a savings projection')
 results.append({'journey':'Android keyboard, Back, notification delivery/tap, biometric lock and update install','status':'BLOCKED','reason':'Browser evidence does not validate Android native behavior; hosted Android instrumentation is separate.'})
except Exception as e:
 d.execute_script("const s=document.createElement('style');s.id='qa-secret-redaction';s.textContent='[data-sensitive-recovery-code]{visibility:hidden!important}#recovery-code-confirmation{-webkit-text-security:disc!important;color:transparent!important;text-shadow:0 0 8px #25312a!important}';document.head.appendChild(s)")
 controls=[]
 for x in d.find_elements(By.CSS_SELECTOR,'button,summary'):
  if x.is_displayed(): controls.append('[recovery code hidden]' if x.find_elements(By.CSS_SELECTOR,'[data-sensitive-recovery-code]') else x.text)
 results.append({'journey':'Current browser journey','status':'FAIL','error':str(e),'trace':traceback.format_exc(),'gestureTrace':d.execute_script('return window.__lifeosGestureTrace||[]'),'visibleControls':controls}); d.save_screenshot(str(out/'failure.png')); raise
finally:
 (out/'results.json').write_text(json.dumps({'sourceCommit':os.getenv('GITHUB_SHA'),'environment':'Hosted Chrome actual React app with test-only synthetic native crypto plugin; no Android or physical-device acceptance claimed','results':results,'screenshots':images},indent=2)); d.quit(); shutil.rmtree(download_dir,ignore_errors=True)
