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
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const Q='33333333-3333-4333-8333-333333333333', ANS='44444444-4444-4444-8444-444444444444';
const row=id=>`[data-comment-id="${id}"]`;
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const button=(id,text)=>evaluate(`[...document.querySelectorAll('${row(id)} button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const input=value=>evaluate(`(()=>{const el=document.querySelector('form[aria-label="Edit comment"] textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const submit=()=>evaluate(`document.querySelector('form[aria-label="Edit comment"]').requestSubmit()`);
const writes=()=>evaluate(`window.__requests.filter(r=>['PATCH','DELETE'].includes(r.method))`);
const mode=value=>evaluate(`window.__mode=${JSON.stringify(value)}`);
const closed=()=>until(`!document.querySelector('form[aria-label="Edit comment"]')`);
const failure=()=>until(`document.querySelector('form[aria-label="Edit comment"]')?.getAttribute('aria-busy')==='false' && !!document.querySelector('form[aria-label="Edit comment"] [role="alert"]')`);
try {
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.setItem('university_qa_session',JSON.stringify({session:{access_token:'comment-token'},user:{id:'${B}'}}));
  window.__requests=[];window.__mode='';
  const profile={id:'${B}',full_name:'Bob',department:{id:'dept',name:'Computing'},course:{name:'Computer Science'},year_level:2};
  const question={id:'${Q}',title:'Comment verification question',body:'Question body',author:{id:'${A}',full_name:'Alice'},department:{name:'Computing'},tags:[],created_at:'2026-10-05T00:00:00Z',answer_count:1,vote_count:0};
  const make=(id,author_id,target)=>({id,body:'Original '+id,author:{id:author_id,full_name:author_id==='${A}'?'Alice':'Bob'},created_at:'2026-10-05T00:00:00Z',...target});
  window.__comments=JSON.parse(sessionStorage.getItem('comments')||'null')||[make('own-q','${B}',{question_id:'${Q}'}),make('other-q','${A}',{question_id:'${Q}'}),make('own-a','${B}',{answer_id:'${ANS}'})];
  const json=(data,status=200,details)=>new Response(JSON.stringify(status<400?{success:true,data}:{success:false,error:{message:data,details}}),{status,headers:{'Content-Type':'application/json'}});
  const original=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
   const path=new URL(input,location.href).pathname;if(!path.startsWith('/api/'))return original(input,init);
   const body=init.body?JSON.parse(init.body):undefined;window.__requests.push({path,method:init.method,body,token:init.headers.Authorization});
   if(['PATCH','DELETE'].includes(init.method)){
    const id=path.split('/').pop(),mode=window.__mode;await new Promise(r=>setTimeout(r,mode==='slow'?650:100));
    if(mode==='validation')return json('Validation failed',400,[{path:'body.body',message:'Backend comment validation'}]);
    if(mode==='error')return json('Comment write unavailable',500);
    if(mode==='forbidden')return json('Only the comment author may change it',403);
    if(mode==='network')throw TypeError('Offline');
    if(mode==='missing')return json('Comment not found',404);
    const comment=window.__comments.find(c=>c.id===id);
    if(init.method==='PATCH')comment.body=body.body;
    else window.__comments=window.__comments.filter(c=>c.id!==id);
    sessionStorage.setItem('comments',JSON.stringify(window.__comments));
    return json(init.method==='PATCH'?comment:{deleted:true});
   }
   if(path==='/api/me')return json(profile);
   if(path==='/api/votes')return json({vote_count:0,has_voted:false});
   if(path.endsWith('/comments'))return json(window.__comments.filter(c=>path.includes('/questions/')?c.question_id===path.split('/')[3]:c.answer_id===path.split('/')[3]));
   if(path.endsWith('/answers'))return json([{id:'${ANS}',question_id:'${Q}',body:'Answer body',author:profile,vote_count:0,created_at:'2026-10-05T00:00:00Z'}]);
   return json(path.endsWith('${Q}')?question:{...question,id:'other',title:'Other question'});
  };
 `});
 await navigate('/questions/'+Q);await until(`!!document.querySelector('${row('own-a')}')`);
 assert.equal(await evaluate(`document.querySelectorAll('${row('other-q')} button').length`),0);
 for(const id of ['own-q','own-a']) {
  await button(id,'Edit');assert.equal(await evaluate(`document.querySelector('form[aria-label="Edit comment"] textarea').value`),'Original '+id);
  await input('Discard edit');await button(id,'Cancel');await closed();assert.equal((await writes()).length,0);
 }
 console.log('PASS: own-only actions on question/answer comments; prefill and Cancel send no writes');
 await button('own-q','Edit');
 for(const text of [' \n ', 'x'.repeat(1001)]) {await input(text);await submit();await failure();assert.equal((await writes()).length,0);}
 const text='Plain **comment** <img src=x onerror="alert(1)">';await input(text);
 for(const value of ['validation','error','forbidden','network','missing']) {
  await mode(value);await submit();await failure();assert.equal(await evaluate(`document.querySelector('form[aria-label="Edit comment"] textarea').value`),text);
 }
 await mode('slow');let before=(await writes()).length;
 await evaluate(`const f=document.querySelector('form[aria-label="Edit comment"]');f.requestSubmit();f.requestSubmit()`);
 await until(`document.querySelector('form[aria-label="Edit comment"]')?.getAttribute('aria-busy')==='true'`);
 assert.equal(await evaluate(`document.querySelector('form[aria-label="Edit comment"] fieldset').disabled`),true);
 await closed();assert.equal((await writes()).length,before+1);assert.deepEqual((await writes()).at(-1).body,{body:text});assert.equal((await writes()).at(-1).token,'Bearer comment-token');
 assert.equal(await evaluate(`document.querySelector('${row('own-q')} p').textContent`),text);assert.equal(await evaluate(`!!document.querySelector('${row('own-q')} img, ${row('own-q')} strong')`),false);
 await send('Page.reload');await until(`document.querySelector('${row('own-q')} p')?.textContent===${JSON.stringify(text)}`);
 console.log('PASS: validation/error drafts, duplicate lock, body-only authenticated save, plain-text safety and refresh persistence');
 await button('own-a','Edit');await input('Saved answer comment');await submit();await closed();assert.equal(await evaluate(`document.querySelector('${row('own-a')} p').textContent`),'Saved answer comment');
 before=(await writes()).length;await button('own-a','Delete');assert.equal((await writes()).length,before);await button('own-a','Cancel');assert.equal((await writes()).length,before);
 await button('own-a','Delete');
 for(const value of ['error','forbidden','network']) {
  await mode(value);await button('own-a','Confirm delete');await until(`document.querySelector('${row('own-a')} [role="group"]')?.getAttribute('aria-busy')==='false' && !!document.querySelector('${row('own-a')} [role="alert"]')`);
  assert.equal(await evaluate(`document.querySelector('${row('own-a')} p').textContent`),'Saved answer comment');
 }
 await mode('slow');before=(await writes()).length;await evaluate(`const b=[...document.querySelectorAll('${row('own-a')} button')].find(b=>b.textContent==='Confirm delete');b.click();b.click();`);
 await until(`document.querySelector('${row('own-a')} [role="group"]')?.getAttribute('aria-busy')==='true'`);
 assert.equal(await evaluate(`[...document.querySelectorAll('${row('own-a')} button')].every(b=>b.disabled)`),true);
 await until(`!document.querySelector('${row('own-a')}')`);assert.equal((await writes()).length,before+1);
 assert.ok(await evaluate(`document.querySelector('section[aria-label="answer comments"]').textContent.includes('No comments yet')`));
 await send('Page.reload');await until(`document.querySelector('section[aria-label="answer comments"]')?.textContent.includes('No comments yet')`);
 console.log('PASS: answer comment save; delete confirmation/Cancel, failed-delete retention, retry, pending lock, empty count and refresh persistence');
 await button('own-q','Delete');await mode('missing');await button('own-q','Confirm delete');await until(`!document.querySelector('${row('own-q')}')`);
 console.log('PASS: delete retry reconciles already-deleted 404');
 await send('Page.reload');await until(`!!document.querySelector('${row('own-q')}')`);await button('own-q','Edit');await input('Late edit');await mode('slow');await submit();
 await evaluate(`history.pushState({},'', '/questions/other');dispatchEvent(new PopStateEvent('popstate'))`);await until(`document.querySelector('main h1')?.textContent==='Other question'`);await new Promise(r=>setTimeout(r,750));assert.equal(await evaluate(`document.querySelectorAll('[data-comment-id]').length`),0);
 await navigate('/questions/'+Q);await until(`!!document.querySelector('${row('own-q')}')`);await button('own-q','Edit');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`));
 assert.deepEqual(errors,[]);console.log('PASS: late response cannot alter another thread; mobile editor fits; no runtime/console errors');
} finally {ws.close();}
