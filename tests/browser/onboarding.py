"""Mandatory onboarding browser coverage. Native auth is simulated; recovery secrets are never captured or reported."""
import json, time, traceback, os, tempfile, shutil
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import StaleElementReferenceException

out=Path('test-results/directed-visual/onboarding'); out.mkdir(parents=True,exist_ok=True)
download_dir=tempfile.mkdtemp(prefix='lifeos-recovery-export-')
options=webdriver.ChromeOptions()
for arg in ['--headless=new','--no-sandbox','--disable-dev-shm-usage']: options.add_argument(arg)
options.add_experimental_option('prefs',{'download.default_directory':download_dir,'download.prompt_for_download':False,'download.directory_upgrade':True})
d=webdriver.Chrome(options=options); d.set_script_timeout(25)
w=WebDriverWait(d,25,ignored_exceptions=(StaleElementReferenceException,)); results=[]; screenshots=[]
d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
base='http://127.0.0.1:5173/tests/browser/index.html'
def find(css): return w.until(lambda _: next((e for e in d.find_elements(By.CSS_SELECTOR,css) if e.is_displayed()),False))
def click(text):
 e=w.until(lambda _: next((x for x in d.find_elements(By.TAG_NAME,'button') if x.is_displayed() and x.is_enabled() and ' '.join(x.text.split())==text),False))
 d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',e); e.click()
def shot(name):
 time.sleep(.15); d.execute_script("const s=document.createElement('style');s.id='qa-secret-redaction';s.textContent='[data-sensitive-recovery-code]{visibility:hidden!important}#recovery-code-confirmation{-webkit-text-security:disc!important;color:transparent!important;text-shadow:0 0 8px #25312a!important}';document.head.appendChild(s)")
 d.save_screenshot(str(out/(name+'.png'))); d.execute_script("document.getElementById('qa-secret-redaction')?.remove()")
 screenshots.append(name+'.png')
 assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+1'), 'horizontal overflow: '+name
 assert d.execute_script('return [...document.querySelectorAll(".initial-setup button,input")].every(e=>e.getBoundingClientRect().width<=innerWidth)'), 'clipped control: '+name
def fresh(mode='success'):
 d.get('about:blank'); d.execute_cdp_cmd('Storage.clearDataForOrigin',{'origin':'http://127.0.0.1:5173','storageTypes':'all'}); d.get(base+'?onboarding-auth='+mode); find('input[autocomplete=nickname]')
def store(key): return d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>done(await m.StorageService.settings.get("+json.dumps(key)+",null))).catch(e=>done({error:String(e)}));")
def state(): return d.execute_async_script("const done=arguments[0];Promise.all([import('/src/services/cryptoService.ts'),import('/src/db.ts')]).then(async([c,m])=>done({key:(await c.CryptoService.getKeyState()).keyProvisioned,recovery:(await c.CryptoService.getKeyState()).recoveryProvisioned,deferred:(await c.CryptoService.getKeyState()).recoveryDeferred,active:m.isEncryptedStorageActivated()})).catch(e=>done({error:String(e)}));")
def passed(name): results.append({'test':name,'status':'PASS','environment':'Real React UI in disposable Chrome; synthetic native crypto/auth adapter; no Android acceptance claimed'})
def complete_recovery(label='Synthetic recovery'):
 find('input[placeholder="My LifeOS recovery"]').send_keys(label)
 click('Create and save recovery kit'); find('[data-testid="copy-recovery-code"]')
 code=d.find_element(By.CSS_SELECTOR,'[data-sensitive-recovery-code]').text
 assert code=='A'*43, 'synthetic recovery code is present in the tappable copy card'
 assert not d.find_elements(By.CSS_SELECTOR,'textarea,[type="checkbox"]'), 'recovery JSON textarea and saved-kit checkbox are removed'
 d.refresh(); find('[aria-label="Set up your recovery kit"]')
 assert not d.find_elements(By.CSS_SELECTOR,'[data-sensitive-recovery-code]'), 'restart clears the transient recovery code from the screen'
 click('Create and save recovery kit'); find('[data-testid="copy-recovery-code"]')
 code=d.find_element(By.CSS_SELECTOR,'[data-sensitive-recovery-code]').text
 assert code=='A'*43, 'recovery setup can be resumed after the transient code is cleared on restart'
 click('Save complete recovery kit')
 exported=w.until(lambda _: next(iter(Path(download_dir).glob('*.json')),False))
 kit=json.loads(exported.read_text(encoding='utf-8'))
 assert kit.get('product')=='LifeOS' and kit.get('format')=='lifeos-recovery-kit' and kit.get('recoveryCode')==code and isinstance(kit.get('envelope'),dict), 'export contains the code and full encrypted envelope'
 exported.unlink()
 d.execute_script("window.__qaClipboardValue='';const c={writeText:async value=>{window.__qaClipboardValue=value},readText:async()=>window.__qaClipboardValue};window.__qaClipboard=c;Object.defineProperty(navigator,'clipboard',{configurable:true,value:c})")
 assert d.find_element(By.CSS_SELECTOR,'[data-testid="continue-to-lifeos"]').get_attribute('disabled') is not None
 d.execute_script("window.__qaClipboard=navigator.clipboard;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('synthetic failure'))}})")
 click('A'*43); assert 'Copy failed' in find('[data-testid="clipboard-feedback"]').text, 'clipboard failure is reported without exposing recovery content'
 d.execute_script("Object.defineProperty(navigator,'clipboard',{configurable:true,value:window.__qaClipboard})")
 click('A'*43)
 copied=w.until(lambda _: d.execute_async_script("const done=arguments[0];navigator.clipboard.readText().then(done).catch(()=>done(''))"))
 assert copied==code, 'tapping the code copies the exact value'
 confirm=find('[data-testid="recovery-code-confirmation"]'); confirm.send_keys('B'*43)
 assert d.find_element(By.CSS_SELECTOR,'[data-testid="continue-to-lifeos"]').get_attribute('disabled') is not None
 confirm.clear(); confirm.send_keys(copied)
 w.until(lambda _: d.find_element(By.CSS_SELECTOR,'[data-testid="continue-to-lifeos"]').is_enabled())
 click('Continue to LifeOS')

try:
 # Save name and restart before continuing. The temporary draft is bootstrap-only.
 fresh(); shot('welcome'); find('input[autocomplete=nickname]').send_keys('Synthetic owner'); click('Continue'); find('[aria-label="Protect your LifeOS space"]')
 assert store('onboardingNameDraft')=='Synthetic owner'; d.refresh(); find('[aria-label="Protect your LifeOS space"]'); assert store('onboardingJourney')['stage']=='protection'; passed('Name persists and setup resumes after restart at App Protection')

 # A cancelled or unavailable native prompt cannot advance or enable storage.
 fresh('cancel'); find('input[autocomplete=nickname]').send_keys('Synthetic retry'); click('Continue'); shot('app-protection'); click('Continue with secure unlock'); find('[role="alert"]')
 assert store('onboardingCompleted') is not True; assert state()=={'key':False,'recovery':False,'deferred':False,'active':False}; assert not d.find_elements(By.CSS_SELECTOR,'[data-testid=today-dashboard]')
 passed('Cancelled native authentication does not provision or advance; user can retry')
 d.execute_script("history.replaceState(null,'',location.pathname+'?onboarding-auth=success')")
 click('Continue with secure unlock'); find('[aria-label="Set up your recovery kit"]')
 result=state(); assert result=={'key':True,'recovery':False,'deferred':True,'active':True},str(result)
 assert store('onboardingCompleted') is not True and not d.find_elements(By.CSS_SELECTOR,'[data-testid=today-dashboard]')
 name=d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>{const raw=await m.lifeOSDatabase.settings.get('displayName');done({value:await m.StorageService.settings.get('displayName',''),encrypted:raw?.__lifeosEncrypted===1&&raw.value===undefined,draft:await m.StorageService.settings.get('onboardingNameDraft',null)});});")
 assert name=={'value':'Synthetic retry','encrypted':True,'draft':None},str(name)
 passed('Device protection provisions real test-facade encryption, but Today stays blocked until recovery verification')

 # Restart during Recovery Kit stage: key remains protected and the flow resumes.
 shot('recovery-kit'); d.refresh(); find('[aria-label="Set up your recovery kit"]'); assert state()=={'key':True,'recovery':False,'deferred':True,'active':True}; shot('recovery-kit-resumed')
 assert not d.find_elements(By.CSS_SELECTOR,'[aria-label="Complete private recovery kit"]')
 complete_recovery(); find('[data-testid=today-dashboard]'); assert store('onboardingCompleted') is True
 journey=store('onboardingJourney'); assert journey['protection']=='enabled' and journey['recovery']=='confirmed' and journey['recoveryName']=='Synthetic recovery'
 raw=d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>done({rows:await m.lifeOSDatabase.transactions.count(),state:await m.StorageService.settings.get('displayName','')}));")
 assert raw=={'rows':0,'state':'Synthetic retry'}
 passed('Recovery-kit confirmation verifies native recovery state before opening Today')

 # Complete install restart is not routed through onboarding again.
 d.refresh(); find('[data-testid=today-dashboard]'); assert store('onboardingCompleted') is True; assert store('displayName')=='Synthetic retry'; passed('Restart after completion preserves profile and does not repeat onboarding')

 # Older optional choices never satisfy the new mandatory journey on an empty installation.
 fresh(); d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>{await m.StorageService.settings.set('onboardingJourney',{version:1,stage:'recovery',protection:'skipped',recovery:'skipped'});done(true);});")
 d.refresh(); find('[aria-label="Protect your LifeOS space"]'); j=store('onboardingJourney'); assert j['protection']=='pending' and j['recovery']=='pending'
 assert not d.find_elements(By.CSS_SELECTOR,'[data-testid=today-dashboard]'); passed('Legacy optional skips cannot bypass mandatory steps for a fresh empty installation')

 # Existing completed installations are grandfathered and not forced through the new flow.
 fresh('success'); d.execute_async_script("const done=arguments[0];Promise.all([import('/src/services/cryptoService.ts'),import('/src/db.ts')]).then(async([c,m])=>{await c.CryptoService.setup({deferRecovery:true});await c.CryptoService.deferRecovery();m.sessionManager.unlock();await m.activateEncryptedStorage();await m.StorageService.settings.set('displayName','Existing encrypted owner');await m.StorageService.settings.set('onboardingCompleted',true);done(true);}).catch(e=>done({error:String(e)}));")
 d.refresh(); find('[data-testid=today-dashboard]'); assert store('displayName')=='Existing encrypted owner'; passed('Existing completed installation is not re-onboarded')

 # Recovery kit screen is inspected without opening or capturing secret-bearing UI.
 fresh(); find('input[autocomplete=nickname]').send_keys('Visual check'); click('Continue'); click('Continue with secure unlock'); find('[aria-label="Set up your recovery kit"]')
 for width,height,scale in [(320,640,1),(390,844,1),(390,844,1.3),(390,844,2),(844,390,1)]:
  d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':True}); d.execute_script('document.documentElement.style.fontSize=arguments[0]',str(scale*100)+'%'); shot(f'recovery-{width}x{height}-font-{scale}')
  for button in d.find_elements(By.CSS_SELECTOR,'.initial-setup button'): assert button.is_displayed()
 passed('Recovery screen reflows on compact, standard, landscape and enlarged text layouts; screenshots contain no recovery secret')
except Exception as e:
 d.execute_script("const s=document.createElement('style');s.id='qa-secret-redaction';s.textContent='[data-sensitive-recovery-code]{visibility:hidden!important}#recovery-code-confirmation{-webkit-text-security:disc!important;color:transparent!important;text-shadow:0 0 8px #25312a!important}';document.head.appendChild(s)")
 results.append({'test':'Mandatory onboarding scenario','status':'FAIL','error':str(e),'trace':traceback.format_exc()}); d.save_screenshot(str(out/'failure.png')); raise
finally:
 (out/'results.json').write_text(json.dumps({'sourceCommit':os.getenv('GITHUB_SHA'),'results':results,'screenshots':screenshots},indent=2)); d.quit(); shutil.rmtree(download_dir,ignore_errors=True)
