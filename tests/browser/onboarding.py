"""Real rendered onboarding, synthetic native auth outcomes. Never physical evidence."""
import json, time, traceback, os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
out=Path('test-results/directed-visual/onboarding');out.mkdir(parents=True,exist_ok=True)
options=webdriver.ChromeOptions()
for arg in ['--headless=new','--no-sandbox','--disable-dev-shm-usage']:options.add_argument(arg)
d=webdriver.Chrome(options=options);d.set_script_timeout(25);w=WebDriverWait(d,25);results=[];screens=[]
d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
base='http://127.0.0.1:5173/tests/browser/index.html'
def find(css):return w.until(lambda _:next((e for e in d.find_elements(By.CSS_SELECTOR,css) if e.is_displayed()),False))
def click(text):
 e=w.until(lambda _:next((e for e in d.find_elements(By.TAG_NAME,'button') if e.is_displayed() and e.is_enabled() and e.text.strip()==text),False))
 d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})',e);e.click()
def shot(name):
 time.sleep(.2);d.save_screenshot(str(out/(name+'.png')));screens.append(name+'.png')
 assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+1'),name+' page overflow'
 assert d.execute_script('return [...document.querySelectorAll(".initial-setup button,input")].every(e=>e.getBoundingClientRect().width<=innerWidth)'),name+' control width'
def fresh(mode):
 d.get('about:blank');d.execute_cdp_cmd('Storage.clearDataForOrigin',{'origin':'http://127.0.0.1:5173','storageTypes':'all'});d.get(base+'?onboarding-auth='+mode);find('input[autocomplete=nickname]')
def store(key):return d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>done(await m.StorageService.settings.get("+json.dumps(key)+",null)));" )
def protected():
 v=d.execute_async_script("const done=arguments[0];Promise.all([import('/src/db.ts'),import('/src/services/cryptoService.ts')]).then(async([m,c])=>{let denied=false;try{await m.StorageService.transactions.getAll()}catch{denied=true}done({denied,key:(await c.CryptoService.getKeyState()).keyProvisioned,active:m.isEncryptedStorageActivated()});});")
 assert v=={'denied':True,'key':False,'active':False},str(v)
def passed(name):results.append({'test':name,'status':'PASS','environment':'Real Chrome React UI; simulated native authentication only'})
try:
 # All four combinations, resumable stages, no automatic/native auth on skips.
 for enable,named in [(False,False),(False,True),(True,False),(True,True)]:
  fresh('success');find('input[autocomplete=nickname]').send_keys('Synthetic start');click('Continue');find('[aria-label="Set up app protection"]');shot('protection-'+str(enable)+'-'+str(named));assert store('onboardingCompleted') is not True
  d.refresh();find('[aria-label="Set up app protection"]');assert d.execute_script('return window.qaAuthCalls||0')==0
  click('Set up protection' if enable else 'Not now');find('[aria-label="Name your recovery setup"]');protected()
  assert bool(store('biometricLockEnabled'))==enable
  d.refresh()
  if enable:
   find('button');w.until(lambda _:'LifeOS is Locked' in d.find_element(By.TAG_NAME,'body').text);click('Verify Biometrics')
  find('[aria-label="Name your recovery setup"]');protected();shot('recovery-'+str(enable)+'-'+str(named))
  if named:find('input[placeholder="My personal space"]').send_keys('My synthetic space');click('Continue')
  else:click('Set this up later')
  find('[data-testid=today-dashboard]');assert store('onboardingCompleted') is True
  p=store('onboardingJourney');assert p['protection']==('enabled' if enable else 'skipped');assert p['recovery']==('named' if named else 'skipped');assert p['recoveryName']==('My synthetic space' if named else '')
  d.refresh()
  if enable:
   w.until(lambda _:'LifeOS is Locked' in d.find_element(By.TAG_NAME,'body').text);click('Verify Biometrics')
  find('[data-testid=today-dashboard]');assert not d.find_elements(By.CSS_SELECTOR,'.initial-setup');protected();passed('Choices '+str(enable)+'/'+str(named)+': restart at both stages, correct optional lock and name persistence, completed restart, no encryption admission')
 for mode in ['unavailable','cancel']:
  fresh(mode);find('input[autocomplete=nickname]').send_keys('Synthetic cancel');click('Continue');click('Set up protection');find('[role=alert]');shot('protection-'+mode)
  assert store('biometricLockEnabled') is not True;assert store('onboardingJourney')['stage']=='protection';protected()
  click('Not now');find('[aria-label="Name your recovery setup"]');click('Set this up later');find('[data-testid=today-dashboard]');passed('Native adapter '+mode+': no silent enablement, retry/skip remains available')
 # Existing version's completed name-only onboarding must upgrade without reset.
 fresh('unavailable');d.execute_async_script("const done=arguments[0];import('/src/db.ts').then(async m=>{await m.StorageService.settings.set('displayName','Existing synthetic owner');await m.StorageService.settings.set('onboardingCompleted',true);done(true);});");d.refresh();find('[data-testid=today-dashboard]');assert store('onboardingJourney') is None;assert store('displayName')=='Existing synthetic owner';passed('Existing completed installation with no new metadata bypasses new setup without writes/reset')
 fresh('unavailable');find('input[autocomplete=nickname]').send_keys('Synthetic visual');click('Continue')
 for stage in ['protection','recovery']:
  for width,height,scale in [(320,640,1),(390,844,1),(390,844,1.3),(390,844,2),(844,390,1)]:
   d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':True});d.execute_script('document.documentElement.style.fontSize=arguments[0]',str(scale*100)+'%');shot(stage+'-'+str(width)+'x'+str(height)+'-font'+str(scale));
   for button in d.find_elements(By.CSS_SELECTOR,'.initial-setup button'):
    d.execute_script('arguments[0].scrollIntoView({block:"center"})',button);assert button.is_displayed()
  d.execute_script('document.documentElement.style.fontSize="100%"');d.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
  if stage=='protection':click('Not now')
 passed('Both real screens: narrow, standard, landscape, 130% and 200% text reflow; actions remain reachable')
except Exception as e:
 results.append({'test':'Current onboarding scenario','status':'FAIL','error':str(e),'trace':traceback.format_exc()});d.save_screenshot(str(out/'failure.png'));raise
finally:
 (out/'results.json').write_text(json.dumps({'sourceCommit':os.getenv('GITHUB_SHA'),'results':results,'screenshots':screens},indent=2));d.quit()
