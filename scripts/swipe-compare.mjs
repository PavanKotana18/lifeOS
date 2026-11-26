
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const serial = 'emulator-5554';
const pkg = 'com.lifeos.personal.debug';
const dir = 'evidence';
mkdirSync(dir, { recursive: true });
const adb = (...args) => {
  const cmd = spawnSync('adb', ['-s', serial, ...args], { encoding: 'utf8', timeout: 20_000, maxBuffer: 15e6 });
  if (cmd.error || cmd.status !== 0) throw Error('adb ' + args.join(' ') + ': ' + (cmd.error || cmd.stderr || cmd.stdout));
  return cmd.stdout.trim();
};
const put = (name, text) => writeFileSync(dir + '/' + name, typeof text === 'string' ? text : JSON.stringify(text, null, 2));
if (adb('shell','getprop','ro.kernel.qemu') !== '1' || process.env.GITHUB_ACTIONS !== 'true') throw Error('Dedicated hosted emulator required');
if (adb('shell','pm','list','packages',pkg).includes(pkg)) throw Error('Existing installation');
for (const [name, cmd] of Object.entries({ display: ['dumpsys','display'], cpu: ['cat','/proc/cpuinfo'], mem: ['cat','/proc/meminfo'], webview: ['dumpsys','webviewupdate'], gpu: ['dumpsys','SurfaceFlinger'] })) {
  put('environment-' + name + '.txt', adb('shell',...cmd));
}
put('host.txt', spawnSync('bash',['-c','uname -a; nproc; lscpu; free -m'],{encoding:'utf8'}).stdout);

async function until(fn, label, timeout=35_000) {
  const expires=Date.now()+timeout;
  do {
    const value=await fn();
    if (value) return value;
    await sleep(200);
  } while(Date.now()<expires);
  throw Error('Timed out: '+label);
}
async function connect() {
  const socketName = await until(() => {
    const pid=adb('shell','pidof',pkg).split(' ')[0];
    if (!pid) return null;
    const sockets=adb('shell','cat','/proc/net/unix');
    return sockets.includes('webview_devtools_remote_'+pid) && 'webview_devtools_remote_'+pid;
  },'debug WebView socket');
  adb('forward','tcp:9222','localabstract:'+socketName);
  const target=await until(async () => {
    try { return (await (await fetch('http://127.0.0.1:9222/json/list')).json()).find(x=>x.type==='page' && x.url.startsWith('https://localhost')); }
    catch { return null; }
  },'application WebView');
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  const pending=new Map();
  const events=new Map();
  let seq=0;
  ws.addEventListener('message',({data})=>{
    const x=JSON.parse(data);
    if(x.method) events.get(x.method)?.(x.params);
    if(!pending.has(x.id)) return;
    const {resolve,reject,timer}=pending.get(x.id);
    clearTimeout(timer);pending.delete(x.id);
    if (x.error) reject(Error(JSON.stringify(x.error))); else resolve(x.result);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},25_000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
  const js=async (expression)=>{
    const reply=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(reply.exceptionDetails) throw Error(reply.exceptionDetails.text);
    return reply.result.value;
  };
  return { js, send, events, close:()=>ws.close() };
}
const probe = `(() => {
  if (window.__swipeBench) return;
  const bench = window.__swipeBench = { commits: [], buffers: null };
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    let id = 0;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber:true, inject:()=>++id,
      onCommitFiberRoot:()=>bench.commits.push(performance.now()),
      onCommitFiberUnmount:()=>{},
    };
  }
  bench.start = duration => {
    bench.commits.length=0;
    const start=performance.now(), frames=[], tasks=[], pointers=[], moves=[];
    const listeners=['pointerdown','pointermove','pointerup','pointercancel'];
    const touch=e=>{if (e.pointerType==='touch') pointers.push([e.type,e.timeStamp,performance.now(),e.clientX]);};
    const long = new PerformanceObserver(list=>{for(const e of list.getEntries())tasks.push([e.startTime,e.duration]);});
    long.observe({type:'longtask'});
    const stage=document.querySelector('.ui-tab-screen-stack');
    const observer=new MutationObserver(records=>{
      const t=performance.now();
      for (const r of records) {
        const n=r.target;
        if (n===stage || n.id?.startsWith('screen-')) moves.push([t,n.id || 'track',n.style.transform || n.style.getPropertyValue('--gesture-x')]);
      }
    });
    observer.observe(stage,{subtree:true,attributes:true,attributeFilter:['style']});
    for(const type of listeners) addEventListener(type,touch,true);
    return new Promise(resolve=>{
      const frame=(t)=>{
        frames.push(t);
        if (t-start<duration) return requestAnimationFrame(frame);
        long.disconnect();observer.disconnect();
        for(const type of listeners) removeEventListener(type,touch,true);
        resolve({start, frames, tasks, pointers, moves, commits:bench.commits.slice()});
      };
      requestAnimationFrame(frame);
    });
  };
})()`;
const mainReady="!!document.querySelector('[data-tab=dashboard]')";
async function onboard(js) {
  const heading="document.querySelector('.initial-setup h1')?.textContent";
  const nickname="!!document.querySelector('input[autocomplete=nickname]')";
  const click=(text)=>until(()=>js(`(()=>{const q=${JSON.stringify(text)};const b=[...document.querySelectorAll('button')].find(x=>!x.disabled&&x.getClientRects().length&&x.textContent.trim()===q); if(!b)return false;b.click();return true})()`),text);
  const initial=()=>js(`(${mainReady}) || (${nickname}) || ['Notifications','Biometric setup','Recovery setup'].includes(${heading})`);
  await until(initial,'startup');
  if (await js(nickname)) {
    await js("(()=>{const e=document.querySelector('input[autocomplete=nickname]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Synthetic benchmark');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click('Continue');
    await until(()=>js(heading+"==='Notifications'"),'notifications stage');
  }
  if (await js(heading+"==='Notifications'")) {
    await click('Not now');
    await until(()=>js("(()=>{const b=[...document.querySelectorAll('button')].find(x=>!x.disabled&&x.getClientRects().length&&x.innerText.startsWith('Continue'));if(!b)return false;b.click();return true})()"),'notification continuation');
    await until(()=>js(heading+"==='Biometric setup'"),'biometric stage');
  }
  if (await js(heading+"==='Biometric setup'")) {
    await click('Not now');
    await until(()=>js(heading+"==='Recovery setup'"),'recovery stage');
  }
  if (await js(heading+"==='Recovery setup'")) {
    await click('Review deferral');
    await click('Do this later');
  }
  await until(()=>js(mainReady),'workspace');
}

const config = `buffers { size_kb: 65536 fill_policy: RING_BUFFER }
duration_ms: 14000
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
data_sources { config { name: "linux.ftrace" ftrace_config {
  ftrace_events: "sched/sched_switch"
  ftrace_events: "sched/sched_waking"
  ftrace_events: "power/cpu_frequency"
  atrace_categories: "gfx"
  atrace_categories: "view"
  atrace_categories: "input"
  atrace_categories: "am"
  atrace_apps: "com.lifeos.personal.debug"
} } }
data_sources { config { name: "linux.process_stats" process_stats_config { scan_all_processes_on_start: true } } }
`;
function asyncAdb(args, stdin) {
  const child=spawn('adb',['-s',serial,...args],{stdio:['pipe','pipe','pipe']});
  const done=new Promise((resolve,reject)=>{
    let out='',err='';
    child.stdout.on('data',d=>out+=d);
    child.stderr.on('data',d=>err+=d);
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve(out):reject(Error(err+' '+out)));
  });
  child.stdin.end(stdin);
  return done;
}

const failures=[];
for (const variant of ['main','navigation','combined']) {
  let dev;
  try {
    const folder='candidates/'+variant;
    const apk=readdirSync(folder,{recursive:true}).find(n=>n.endsWith('app-debug.apk')) || readdirSync(folder,{recursive:true}).find(n=>n.endsWith('.apk'));
    if(!apk) throw Error('No APK: '+variant);
    const packageLine=spawnSync(process.env.ANDROID_HOME+'/build-tools/34.0.0/aapt',['dump','badging',folder+'/'+apk],{encoding:'utf8'}).stdout?.split('\n')[0];
    if (!packageLine?.includes("name='"+pkg+"'")) throw Error('Unexpected APK package: '+packageLine);
    adb('shell','cmd','uimode','night','no');
    adb('install',folder+'/'+apk);
    adb('shell','am','start','-n',pkg+'/com.lifeos.personal.MainActivity');
    dev=await connect();
    const {js,send}=dev;
    await send('Page.addScriptToEvaluateOnNewDocument',{source:probe});
    await send('Page.reload');
    await onboard(js);
    const tabs=await js("[...document.querySelectorAll('[data-tab]')].map(e=>e.dataset.tab)");
    const expected=variant==='main'?['dashboard','finance','plan']:['dashboard','finance','plan','life'];
    if (JSON.stringify(tabs)!==JSON.stringify(expected)) throw Error('Unexpected route list: '+tabs);
    const switchTo=async tab=>{
      await js("document.querySelector('[data-tab="+tab+"]').click()");
      await until(()=>js("document.querySelector('[data-tab="+tab+"]')?.getAttribute('aria-current')==='page'"),tab);
      await sleep(450);
    };
    const size=adb('shell','wm','size').match(/(\d+)x(\d+)/g).at(-1).split('x').map(Number);
    const [w,h]=size, y=Math.round(h*.29);
    const pair=(left)=>[Math.round(w*(left?.76:.24)),y,Math.round(w*(left?.24:.76)),y,380].map(String);
    const sequence=[...expected.slice(1).map(to=>[true,to]),...expected.slice(0,-1).reverse().map(to=>[false,to])];
    // Warm every route and lazy chunk; run the same number of common transitions for all candidates.
    for (const name of expected) await switchTo(name);
    const samples=[];
    for(const theme of ['light','dark']) {
      adb('shell','cmd','uimode','night',theme==='dark'?'yes':'no');
      await until(()=>js("document.documentElement.classList.contains('dark')==="+(theme==='dark')),'theme '+theme);
      // Rotate measurement mode order per theme. Native input is identical in the two gesture modes.
      const modes=theme==='light'?['idle','native','probe']:['idle','probe','native'];
      for(const mode of modes) {
        await switchTo('dashboard');
        adb('shell','dumpsys','gfxinfo',pkg,'reset');
        if(mode==='idle') {
          samples.push({theme,mode,data:await js('window.__swipeBench.start(1250)')});
        } else {
          for(let round=0;round<2;round++) for(const [left,to] of sequence) {
            const from=await js("document.querySelector('[data-tab][aria-current=page]')?.dataset.tab");
            const data=js('window.__swipeBench.start(1350)');
            await sleep(180);
            const start=Date.now();
            const input=asyncAdb(['shell','input','swipe',...pair(left)]);
            let bridgeMs=null;
            if(mode==='probe') {
              await sleep(160);
              const at=Date.now();
              await js("document.querySelector('.ui-tab-screen-stack').getBoundingClientRect().width");
              bridgeMs=Date.now()-at;
            }
            await input;
            const sample=await data;
            const actual=await js("document.querySelector('[data-tab][aria-current=page]')?.dataset.tab");
            samples.push({theme,mode,from,to,actual,round,inputAndProbeHostMs:Date.now()-start,bridgeMs,data:sample});
            put(variant+'-samples.json',{tabs,samples});
            if (actual!==to) throw Error('Swipe '+from+' to '+to+' ended at '+actual);
          }
        }
        put(variant+'-'+theme+'-'+mode+'-gfxinfo.txt',adb('shell','dumpsys','gfxinfo',pkg,'framestats'));
      }
    }
    put(variant+'-samples.json',{tabs,samples});
    put(variant+'-memory.txt',adb('shell','dumpsys','meminfo',pkg));
    // Independently capture rich traces so their overhead cannot contaminate the timing comparison.
    await switchTo('dashboard');
    const perfetto=asyncAdb(['shell','perfetto','--txt','-c','-','-o','/data/misc/perfetto-traces/lifeos-swipe.trace'],config);
    perfetto.catch(()=>{});
    const layerCounts=[];
    dev.events.set('LayerTree.layerTreeDidChange',e=>layerCounts.push(e.layers?.length || 0));
    await send('LayerTree.enable').catch(()=>{});
    const traceEvents=[];
    dev.events.set('Tracing.dataCollected',e=>{traceEvents.push(...e.value);});
    const traceEnded=new Promise(resolve=>dev.events.set('Tracing.tracingComplete',resolve));
    await send('Tracing.start',{categories:'devtools.timeline,blink,cc,v8,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame',transferMode:'ReportEvents'});
    for(const [left,to] of sequence) {
      await asyncAdb(['shell','input','swipe',...pair(left)]);
      await until(()=>js("document.querySelector('[data-tab="+to+"]')?.getAttribute('aria-current')==='page'"),to);
      await sleep(450);
    }
    await send('Tracing.end');
    await Promise.race([traceEnded,sleep(8000)]);
    put(variant+'-chrome-trace.json',{traceEvents});
    put(variant+'-layers.json',layerCounts);
    await perfetto;
    adb('pull','/data/misc/perfetto-traces/lifeos-swipe.trace',dir+'/'+variant+'.perfetto-trace');
  } catch(err) {
    failures.push({variant,error:String(err)});
    put('failures.json',failures);
    console.error(variant,err);
  } finally {
    dev?.close();
    try { adb('forward','--remove','tcp:9222'); } catch {}
    // Package was absent before this job and installed only on this isolated runner.
    if(adb('shell','pm','list','packages',pkg).includes(pkg)) adb('uninstall',pkg);
  }
}
if (failures.length) process.exitCode=1;

