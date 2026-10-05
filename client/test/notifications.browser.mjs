// Run with Vite on port 5173 and Chrome remote debugging on port 9223.
// All API responses in this suite are mocked; it does not write to Supabase.
import assert from 'node:assert/strict';
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args);
});
// Wait for the new document before interacting; a reload reply can arrive
// while the old login form is still present.
const send = (method, params = {}) => {
  let loaded = Promise.resolve();
  if (['Page.navigate', 'Page.reload'].includes(method)) {
    loaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.removeEventListener('message', onLoad); reject(new Error('Navigation load timed out')); }, 30000);
      function onLoad({ data }) {
        if (JSON.parse(data).method === 'Page.loadEventFired') {
          clearTimeout(timer); ws.removeEventListener('message', onLoad); resolve();
        }
      }
      ws.addEventListener('message', onLoad);
    });
  }
  const response = new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  });
  return Promise.all([response, loaded]).then(([result]) => result);
};
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const until = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('Timed out: ' + expression); };
const navigate = async path => { await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path }); await until(`document.readyState === 'complete' && !!document.querySelector('main h1')`); };
const click=text=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const bell=()=>evaluate(`document.querySelector('a[href="/notifications"]').getAttribute('aria-label')`);
const open=()=>evaluate(`document.querySelector('a[href="/notifications"]').click()`);
const ready=()=>until(`!!document.querySelector('[data-notification-id]') && !document.querySelector('main [role="status"]')`);
try {
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.setItem('university_qa_session',JSON.stringify({session:{access_token:'notification-token'},user:{id:'student'}}));
  window.__requests=[];window.__mode='';window.__readMode='';
  window.__notifications=JSON.parse(sessionStorage.getItem('notifications')||'null')||Array.from({length:22},(_,i)=>({id:'notice-'+i,type:['question_answer','question_comment','answer_comment','answer_accepted'][i%4],question_id:'question',actor:{id:'actor',full_name:'Test Student'},question:{title:'Question title'},created_at:'2026-10-05T00:00:00Z',is_read:false}));
  const originalInterval=window.setInterval;window.setInterval=(fn,ms,...args)=>{if(ms===30000)window.__poll=fn;return originalInterval(fn,ms,...args)};
  const json=(data,status=200)=>new Response(JSON.stringify(status<400?{success:true,data}:{success:false,error:{message:data}}),{status,headers:{'Content-Type':'application/json'}});
  const original=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
   const url=new URL(input,location.href),path=url.pathname;if(!path.startsWith('/api/'))return original(input,init);
   window.__requests.push({path,method:init.method,token:init.headers.Authorization,body:init.body,params:Object.fromEntries(url.searchParams)});
   if(path.startsWith('/api/notifications')){
    if(init.headers.Authorization!=='Bearer notification-token')throw Error('Missing token');
    if(init.method==='GET'){
     const mode=window.__mode,page=Number(url.searchParams.get('page')),limit=20;
     const snapshot={items:window.__notifications.slice((page-1)*limit,page*limit).map(n=>({...n})),page,limit,total:window.__notifications.length,unread_count:window.__notifications.filter(n=>!n.is_read).length};
     await new Promise(r=>setTimeout(r,mode==='slow'?850:250));
     if(mode==='error')return json('Notifications unavailable',500);
     return json(snapshot);
    }
    const mode=window.__readMode;await new Promise(r=>setTimeout(r,500));
    if(mode==='error')return json('Cannot mark notifications read',500);
    if(mode==='network')throw TypeError('Offline');
    const id=path.split('/')[3];window.__notifications.forEach(n=>{if(id==='read-all'||id===n.id)n.is_read=true});
    sessionStorage.setItem('notifications',JSON.stringify(window.__notifications));
    if(mode==='lost')throw TypeError('Response lost');return json({updated:true});
   }
   if(path==='/api/me')return json({id:'student',full_name:'Current Student',department:{id:'dept',name:'Computing'},course:{name:'CS'},year_level:2});
   if(path.endsWith('/comments')||path.endsWith('/answers'))return json([]);
   if(path==='/api/votes')return json({vote_count:0,has_voted:false});
   return json({id:'question',title:'Question title',body:'Question body',author:{id:'actor',full_name:'Test Student'},department:{name:'Computing'},tags:[],created_at:'2026-10-05T00:00:00Z',answer_count:0,vote_count:0});
  };
 `});
 await navigate('/notifications');await until(`document.querySelector('main')?.textContent.includes('Loading notifications')`);await ready();assert.match(await bell(),/22 unread/);
 assert.equal(await evaluate(`document.querySelectorAll('[data-notification-id]').length`),20);
 for(const action of ['answered your question','commented on your question','commented on your answer','accepted your answer'])assert.ok(await evaluate(`document.querySelector('main').textContent.includes(${JSON.stringify(action)})`));
 await click('Older');await until(`document.querySelector('main').textContent.includes('Page 2') && document.querySelectorAll('[data-notification-id]').length===2`);assert.match(await bell(),/22 unread/);await click('Newer');await ready();
 console.log('PASS: loading, four event messages, dates, unread badge and pagination with full unread count');
 await evaluate(`document.querySelector('[data-notification-id="notice-0"] button').click()`);await until(`location.pathname==='/questions/question'`);await until(`document.querySelector('a[href="/notifications"]').getAttribute('aria-label').includes('21 unread')`);
 await open();await ready();assert.equal(await evaluate(`document.querySelector('[data-notification-id="notice-0"]').dataset.read`),'true');await send('Page.reload');await ready();assert.match(await bell(),/21 unread/);
 console.log('PASS: open navigates to question, marks read through auth helper, and persists after reload');
 await evaluate(`window.__readMode='error'`);await click('Mark all as read');await until(`!!document.querySelector('[role="alert"]') && ![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Retry notification')).disabled`);assert.match(await bell(),/21 unread/);
 await evaluate(`window.__readMode=''`);const before=await evaluate(`window.__requests.filter(r=>r.method==='PATCH').length`);await evaluate(`const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry notification update');b.click();b.click()`);await until(`document.querySelectorAll('[data-read="false"]').length===0 && !document.querySelector('[role="alert"]')`);assert.equal(await evaluate(`window.__requests.filter(r=>r.method==='PATCH').length`),before+1);assert.equal(await bell(),'Notifications');
 console.log('PASS: failed read-all preserves state, retry succeeds and duplicate clicks are blocked');
 await until(`!document.querySelector('main [role="status"]')`);
 await evaluate(`window.__notifications.unshift({...window.__notifications[0],id:'arrival',is_read:false});window.__poll()`);await until(`document.querySelector('[data-notification-id="arrival"]')?.dataset.read==='false'`);assert.match(await bell(),/1 unread/);
 await evaluate(`window.__mode='error';window.dispatchEvent(new Event('focus'))`);await until(`document.querySelector('main').textContent.includes('Notifications unavailable')`);assert.match(await bell(),/1 unread/);await evaluate(`window.__mode=''`);await click('Try again');await until(`!document.querySelector('main').textContent.includes('Notifications unavailable')`);
 console.log('PASS: polling and focus discover arrivals; failed fetch retains count/list and retry recovers');
 await evaluate(`window.__mode='slow';window.__poll();window.__mode=''`);await evaluate(`document.querySelector('[data-notification-id="arrival"] button').click()`);await until(`document.querySelector('a[href="/notifications"]').getAttribute('aria-label')==='Notifications'`);await new Promise(r=>setTimeout(r,1000));assert.equal(await bell(),'Notifications');
 await open();await ready();await evaluate(`window.__notifications[0].is_read=false;window.__poll()`);await until(`document.querySelector('[data-read="false"]')`);await evaluate(`window.__readMode='lost'`);await click('Mark all as read');await until(`!!document.querySelector('[role="alert"]') && document.querySelectorAll('[data-read="false"]').length===0`);assert.equal(await bell(),'Notifications');
 await evaluate(`window.__readMode=''`);await click('Retry notification update');await until(`!document.querySelector('[role="alert"]')`);
 console.log('PASS: stale polling cannot undo read success; lost-response reconciliation uses canonical state');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`));
 await evaluate(`window.__notifications=[];window.__poll()`);await until(`document.querySelector('main').textContent.includes('No notifications yet.')`);assert.equal(await bell(),'Notifications');
 assert.deepEqual(errors,[]);console.log('PASS: empty state, mobile layout, no runtime/console errors');
}finally{ws.close();}
