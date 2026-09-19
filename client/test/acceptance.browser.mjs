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
const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const until = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('Timed out: ' + expression); };
const navigate = async path => { await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path }); await until(`document.readyState === 'complete' && !!document.querySelector('main h1')`); };
const ID = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const first = '55555555-5555-4555-8555-555555555555';
const second = '66666666-6666-4666-8666-666666666666';
const control = author => `document.querySelector('article[aria-label="Answer by ${author}"] > button')`;
const click = author => evaluate(`${control(author)}.click()`);
const ready = () => until(`${control('Bob')} && !${control('Bob')}.disabled`);
const mode = value => evaluate(`window.__mode=${JSON.stringify(value)}`);
const accepted = author => evaluate(`${control(author)}.textContent.trim()==='Unaccept answer'`);
const countWrites = () => evaluate(`window.__writes.length`);
try {
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.bringToFront');
  await send('Storage.clearDataForOrigin', { origin: 'http://127.0.0.1:5173', storageTypes: 'local_storage' });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('university_qa_session', JSON.stringify({session:{access_token:'test-token'},user:{id:'alice'}}));
    window.__mode=''; window.__readError=false; window.__writes=[];
    window.__answers=JSON.parse(sessionStorage.getItem('acceptance-answers')||'null')||[
      {id:'${first}',question_id:'${ID}',author:{id:'bob',full_name:'Bob'},body:'First answer',is_accepted:false,created_at:'2026-09-15T10:00:00Z',vote_count:0},
      {id:'${second}',question_id:'${ID}',author:{id:'charlie',full_name:'Charlie'},body:'Second answer',is_accepted:false,created_at:'2026-09-15T11:00:00Z',vote_count:0}
    ];
    const json=(data,status=200)=>new Response(JSON.stringify(status<400?{success:true,data}:{success:false,error:{message:data}}),{status,headers:{'Content-Type':'application/json'}});
    const original=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const path=new URL(input,location.href).pathname;
      if(!path.startsWith('/api/'))return original(input,init);
      if(path==='/api/me')return json({id:'alice',full_name:'Alice',department:{id:'dept',name:'Engineering'}});
      if(init.headers.Authorization!=='Bearer test-token')throw Error('Missing authenticated API helper token');
      if(path.endsWith('/accept')){
        window.__writes.push({path,method:init.method});const mode=window.__mode;
        await new Promise(r=>setTimeout(r,mode==='slow'?650:100));
        if(mode==='403')return json('Only the question author can accept an answer',403);
        if(mode==='error')return json('Acceptance unavailable',500);
        if(mode==='read-failure'){window.__readError=true;return json('Acceptance unavailable',500);}
        if(mode==='partial'){window.__answers.forEach(a=>a.is_accepted=false);return json('Second write failed',500);}
        const target=window.__answers.find(a=>path.includes(a.id));
        if(init.method==='POST')window.__answers.forEach(a=>a.is_accepted=a.id===target.id);
        else target.is_accepted=false;
        sessionStorage.setItem('acceptance-answers',JSON.stringify(window.__answers));
        if(mode==='lost')throw TypeError('Response lost after commit');
        return json(target);
      }
      if(path.endsWith('/answers'))return window.__readError?json('Read unavailable',503):json(path.includes('${OTHER}')?[]:window.__answers);
      if(path.endsWith('/comments'))return json([]);
      if(path==='/api/votes')return json({has_voted:false,vote_count:0});
      return json({id:path.split('/')[3],title:'Acceptance test',body:'Question body',author:{id:path.includes('${OTHER}')?'bob':'alice',full_name:'Alice'},department:{name:'Engineering'},tags:[],vote_count:0,answer_count:2,has_accepted_answer:window.__answers.some(a=>a.is_accepted),created_at:'2026-09-15T09:00:00Z'});
    };
  ` });
  await navigate('/questions/'+ID); await ready();
  assert.equal(await accepted('Bob'),false);
  await mode('slow'); const before=await countWrites();
  await evaluate(`${control('Charlie')}.click(); ${control('Bob')}.click(); ${control('Charlie')}.click()`);
  await until(`${control('Bob')}.disabled && ${control('Charlie')}.disabled`);
  await ready();assert.equal(await countWrites(),before+1);assert.equal(await accepted('Charlie'),true);
  assert.equal(await evaluate(`document.querySelector('article[aria-label^="Answer by"]').getAttribute('aria-label')`),'Answer by Charlie');
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('No accepted answer yet')`),false);
  console.log('PASS: author controls use auth helper; shared lock prevents duplicate/simultaneous accepts; accepted answer moves first and question status updates');
  await mode('');await click('Bob');await ready();assert.equal(await accepted('Bob'),true);assert.equal(await accepted('Charlie'),false);
  await click('Bob');await ready();assert.equal(await accepted('Bob'),false);assert.ok(await evaluate(`document.querySelector('main').textContent.includes('No accepted answer yet')`));
  await click('Charlie');await ready();await send('Page.reload');await ready();assert.equal(await accepted('Charlie'),true);
  console.log('PASS: switching acceptance clears previous badge; unaccept updates question; accepted state reloads');
  for(const value of ['403','error']){await mode(value);await click('Bob');await ready();assert.equal(await accepted('Bob'),false);assert.equal(await accepted('Charlie'),true);assert.ok(await evaluate(`!!document.querySelector('[role="alert"]')`));}
  await mode('partial');await click('Bob');await ready();assert.equal(await accepted('Charlie'),false);assert.equal(await accepted('Bob'),false);
  await mode('lost');await click('Bob');await ready();assert.equal(await accepted('Bob'),true);
  console.log('PASS: authorization/server failures preserve server state; partial writes and lost responses reconcile from backend');
  await mode('read-failure');await click('Charlie');await until(`document.querySelector('main').textContent.includes('Retry answer status')`);
  assert.ok(await evaluate(`${control('Bob')}.disabled && ${control('Charlie')}.disabled`));
  await evaluate(`window.__readError=false; window.__mode=''; [...document.querySelectorAll('button')].find(b=>b.textContent==='Retry answer status').click()`);await ready();assert.equal(await accepted('Bob'),true);
  assert.equal(await evaluate(`!!document.querySelector('[role="alert"]')`),false);
  console.log('PASS: failed reconciliation blocks further writes until a successful explicit retry');
  await mode('slow');await click('Charlie');
  await evaluate(`history.pushState({},'', '/questions/${OTHER}'); dispatchEvent(new PopStateEvent('popstate'))`);
  await until(`document.querySelector('main').textContent.includes('No answers yet')`);await new Promise(r=>setTimeout(r,800));
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>/^(Unaccept|Accept) answer$/.test(b.textContent.trim()))`),false);
  assert.ok(await evaluate(`document.querySelector('main').textContent.includes('No answers yet')`));
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('Updating accepted answer')`),false);
  console.log('PASS: late acceptance response cannot modify another question; non-author controls remain hidden');
  assert.deepEqual(errors,[]);console.log('PASS: no browser runtime exceptions or console errors');
} finally {ws.close();}
