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
const Q = '33333333-3333-4333-8333-333333333333';
const ANS = '44444444-4444-4444-8444-444444444444';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const clickText = text => evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const input = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const select = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const submit = label => evaluate(`document.querySelector('form[aria-label="${label}"]').requestSubmit()`);
const mode = value => evaluate(`window.__mode=${JSON.stringify(value)}`);
const writes = () => evaluate(`window.__requests.filter(r=>r.method==='PATCH')`);
const formClosed = label => until(`!document.querySelector('form[aria-label="${label}"]')`);
const profileReady = () => until(`document.querySelector('#edit-profile-course option[value="'+window.__profile.course.id+'"]') && !document.querySelector('form[aria-label="Edit profile"] button[type="submit"]').disabled`);
try {
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
 await send('Storage.clearDataForOrigin',{origin:'http://127.0.0.1:5173',storageTypes:'local_storage'});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__viewer=sessionStorage.getItem('viewer')||'${A}';
  localStorage.setItem('university_qa_session',JSON.stringify({session:{access_token:'edit-token'},user:{id:window.__viewer}}));
  window.__requests=[];window.__mode='';window.__courseError=false;window.__deptError=false;
  window.__profile=JSON.parse(sessionStorage.getItem('profile-'+window.__viewer)||'null')||{id:window.__viewer,full_name:window.__viewer==='${A}'?'Alice':'Bob',student_id:'READ-ONLY',year_level:2,department:{id:'d1',name:'Business'},course:{id:'c1',name:'Accounting'},created_at:'2026-09-15T09:00:00Z'};
  window.__question=JSON.parse(sessionStorage.getItem('question')||'null')||{id:'${Q}',title:'Original question title',body:'Original **question** body',author:{id:'${A}',full_name:'Alice'},department:{id:'d1',name:'Business'},tags:[{id:'tag',name:'javascript'}],created_at:'2026-09-15T09:00:00Z',vote_count:2,answer_count:1,has_accepted_answer:true};
  window.__answer=JSON.parse(sessionStorage.getItem('answer')||'null')||{id:'${ANS}',question_id:'${Q}',body:'Original **answer** body',author:{id:'${B}',full_name:'Bob'},is_accepted:true,vote_count:1,created_at:'2026-09-15T10:00:00Z'};
  const json=(data,status=200,details)=>new Response(JSON.stringify(status<400?{success:true,data}:{success:false,error:{message:data,details}}),{status,headers:{'Content-Type':'application/json'}});
  const original=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
   const url=new URL(input,location.href),path=url.pathname;
   if(!path.startsWith('/api/'))return original(input,init);
   const body=init.body?JSON.parse(init.body):undefined;
   window.__requests.push({path,method:init.method,body,params:Object.fromEntries(url.searchParams),token:init.headers.Authorization});
   if(path.endsWith('/accept')){const snapshot={...window.__answer,is_accepted:init.method==='POST'};await new Promise(r=>setTimeout(r,650));window.__answer.is_accepted=snapshot.is_accepted;return json(snapshot);}
   if(init.method==='PATCH'){
    if(init.headers.Authorization!=='Bearer edit-token')throw Error('Missing token');
    const mode=window.__mode;await new Promise(r=>setTimeout(r,mode==='slow'?650:100));
    if(mode==='validation')return json('Validation failed',400,[{path:'body.'+(path.includes('/questions/')?'title':path.includes('/profiles/')?'full_name':'body'),message:'Backend field validation'}]);
    if(mode==='error')return json('Save unavailable',500);
    if(mode==='forbidden')return json('Only the author can edit',403);
    if(mode==='network')throw TypeError('Offline');
    if(path.includes('/questions/')){Object.assign(window.__question,body,{tags:body.tags.map(name=>({id:name,name}))});sessionStorage.setItem('question',JSON.stringify(window.__question));return json(window.__question);}
    if(path.includes('/answers/')){Object.assign(window.__answer,body);sessionStorage.setItem('answer',JSON.stringify(window.__answer));return json(window.__answer);}
    Object.assign(window.__profile,{full_name:body.full_name,year_level:body.year_level,department:{id:body.department_id,name:body.department_id==='d1'?'Business':'Computing'},course:{id:body.course_id,name:body.course_id==='c1'?'Accounting':'Computer Science'}});sessionStorage.setItem('profile-'+window.__viewer,JSON.stringify(window.__profile));return json(window.__profile);
   }
   if(path==='/api/me')return json(window.__profile);
   if(path==='/api/departments')return window.__deptError?json('Departments unavailable',503):json([{id:'d1',name:'Business'},{id:'d2',name:'Computing'},{id:'d3',name:'Empty department'}]);
   if(path.endsWith('/courses')){const dep=path.split('/')[3];await new Promise(r=>setTimeout(r,dep==='d1'?350:100));return window.__courseError?json('Courses unavailable',503):json(dep==='d1'?[{id:'c1',name:'Accounting'}]:dep==='d2'?[{id:'c2',name:'Computer Science'}]:[]);}
   if(path==='/api/tags')return json([{id:'tag',name:'javascript'}]);
   if(path==='/api/votes')return json({vote_count:1,has_voted:false});
   if(path.endsWith('/comments'))return json([]);
   if(path.endsWith('/answers'))return json([window.__answer]);
   if(path==='/api/questions')return json({items:[window.__question],total:1,page:1,limit:20});
   return json(path.endsWith('${Q}')?window.__question:{...window.__question,id:'other',title:'Other question',author:{id:'other',full_name:'Other'}});
  };
 `});
 await navigate('/questions/'+Q);await until(`!!document.querySelector('#answers-heading')`);
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit answer')`),false);
 await clickText('Edit question');assert.equal(await evaluate(`document.querySelector('#edit-question-title').value`),'Original question title');assert.equal(await evaluate(`document.querySelector('#edit-question-body').value`),'Original **question** body');assert.equal(await evaluate(`document.querySelector('#tags').value`),'javascript');assert.equal(await evaluate(`document.querySelector('#edit-question-department').readOnly`),true);
 await input('#edit-question-title','Discard this edit');await clickText('Cancel');await formClosed('Edit question');assert.equal((await writes()).length,0);assert.equal(await evaluate(`document.querySelector('main h1').textContent`),'Original question title');
 console.log('PASS: question author-only edit, exact prefill, read-only department, Cancel sends no PATCH');
 await clickText('Edit question');await input('#edit-question-title','  ');await input('#edit-question-body',' ');await input('#tags',Array.from({length:11},(_,i)=>'tag'+i).join(','));await submit('Edit question');await until(`document.querySelector('form[aria-label="Edit question"] [role="alert"]')`);assert.equal((await writes()).length,0);
 await input('#edit-question-title','Edited question title');await input('#edit-question-body','## Edited Markdown\n\n**Saved question**\n\n```javascript\nconst edited = true;\n```');await input('#tags','JavaScript, editing, JAVASCRIPT');
 for(const failure of ['validation','error','forbidden','network']){await mode(failure);await submit('Edit question');await until(`!document.querySelector('form[aria-label="Edit question"]').getAttribute('aria-busy').includes('true') && !!document.querySelector('form[aria-label="Edit question"] [role="alert"]')`);assert.equal(await evaluate(`document.querySelector('#edit-question-title').value`),'Edited question title');}
 await mode('slow');const before=(await writes()).length;await evaluate(`const f=document.querySelector('form[aria-label="Edit question"]');f.requestSubmit();f.requestSubmit();`);await until(`document.querySelector('form[aria-label="Edit question"]')?.getAttribute('aria-busy')==='true'`);assert.ok(await evaluate(`document.querySelector('form[aria-label="Edit question"] fieldset').disabled`));await formClosed('Edit question');assert.equal((await writes()).length,before+1);
 const qPatch=(await writes()).at(-1);assert.deepEqual(Object.keys(qPatch.body).sort(),['body','tags','title']);assert.deepEqual(qPatch.body.tags,['javascript','editing']);assert.equal(qPatch.token,'Bearer edit-token');await until(`!!document.querySelector('.question-markdown .hljs-keyword')`);assert.equal(await evaluate(`document.querySelector('main h1').textContent`),'Edited question title');
 await send('Page.reload');await until(`document.querySelector('main h1')?.textContent==='Edited question title'`);
 console.log('PASS: question validation, backend/403/network errors preserve draft, save lock, whitelisted payload, Markdown and reload persistence');
 await evaluate(`sessionStorage.setItem('viewer','${B}')`);await send('Page.reload');await until(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit answer')`);
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit question')`),false);
 await clickText('Edit answer');assert.equal(await evaluate(`document.querySelector('form[aria-label="Edit answer"] textarea').value`),'Original **answer** body');await input('form[aria-label="Edit answer"] textarea','Discard answer');await clickText('Cancel');await formClosed('Edit answer');assert.equal((await writes()).length,0);
 await clickText('Edit answer');await input('form[aria-label="Edit answer"] textarea',' ');await submit('Edit answer');await until(`document.querySelector('form[aria-label="Edit answer"] [role="alert"]')`);assert.equal((await writes()).length,0);
 const editedAnswer='**Edited answer**\n\n```javascript\nlet editedAnswer = true;\n```';await input('form[aria-label="Edit answer"] textarea',editedAnswer);
 for(const failure of ['validation','error','network']){await mode(failure);await submit('Edit answer');await until(`document.querySelector('form[aria-label="Edit answer"]')?.getAttribute('aria-busy')==='false' && !!document.querySelector('form[aria-label="Edit answer"] [role="alert"]')`);assert.equal(await evaluate(`document.querySelector('form[aria-label="Edit answer"] textarea').value`),editedAnswer);}
 await mode('slow');const answerBefore=(await writes()).length;await evaluate(`const f=document.querySelector('form[aria-label="Edit answer"]');f.requestSubmit();f.requestSubmit();`);await formClosed('Edit answer');assert.equal((await writes()).length,answerBefore+1);assert.deepEqual((await writes()).at(-1).body,{body:editedAnswer});await until(`!!document.querySelector('article[aria-label="Answer by Bob"] .hljs-keyword')`);assert.ok(await evaluate(`document.querySelector('article[aria-label="Answer by Bob"]').textContent.includes('Accepted answer')`));await send('Page.reload');await until(`document.querySelector('article[aria-label="Answer by Bob"]')?.textContent.includes('Edited answer')`);
 console.log('PASS: Student B cannot see question edit; own answer Cancel/validation/errors/save/Markdown/reload retain acceptance');
 await navigate('/profile');await clickText('Edit Profile');await profileReady();assert.equal(await evaluate(`document.querySelector('#edit-profile-student-id').readOnly`),true);await input('#edit-profile-name','Discard profile');await clickText('Cancel');await formClosed('Edit profile');assert.equal((await writes()).length,0);
 await clickText('Edit Profile');await profileReady();await input('#edit-profile-name',' ');await submit('Edit profile');await until(`document.querySelector('#edit-profile-name-error')`);assert.equal((await writes()).length,0);await input('#edit-profile-name','Edited Bob');
 await select('#edit-profile-department','d2');await until(`document.querySelector('#edit-profile-course').disabled`);assert.equal(await evaluate(`document.querySelector('#edit-profile-course').value`),'');await until(`!!document.querySelector('#edit-profile-course option[value="c2"]')`);assert.equal(await evaluate(`!!document.querySelector('#edit-profile-course option[value="c1"]')`),false);await submit('Edit profile');await until(`!!document.querySelector('#edit-profile-course-error')`);assert.equal((await writes()).length,0);
 await select('#edit-profile-department','d3');await until(`document.querySelector('main').textContent.includes('No courses available')`);await submit('Edit profile');assert.equal((await writes()).length,0);
 await evaluate(`window.__courseError=true`);await select('#edit-profile-department','d2');await until(`document.querySelector('main').textContent.includes('Courses unavailable')`);assert.ok(await evaluate(`document.querySelector('form[aria-label="Edit profile"] button[type="submit"]').disabled`));await evaluate(`window.__courseError=false`);await clickText('Try again');await until(`!!document.querySelector('#edit-profile-course option[value="c2"]')`);
 await select('#edit-profile-department','d1');await until(`document.querySelector('#edit-profile-course').disabled`);await select('#edit-profile-department','d2');await until(`!!document.querySelector('#edit-profile-course option[value="c2"]')`);await new Promise(r=>setTimeout(r,450));assert.equal(await evaluate(`!!document.querySelector('#edit-profile-course option[value="c1"]')`),false);await select('#edit-profile-course','c2');await select('#edit-profile-year','8');
 for(const failure of ['validation','error','network']){await mode(failure);await submit('Edit profile');await until(`document.querySelector('form[aria-label="Edit profile"]')?.getAttribute('aria-busy')==='false' && !!document.querySelector('form[aria-label="Edit profile"] [role="alert"]')`);assert.equal(await evaluate(`document.querySelector('#edit-profile-name').value`),'Edited Bob');}
 await mode('slow');const pBefore=(await writes()).length;await evaluate(`const f=document.querySelector('form[aria-label="Edit profile"]');f.requestSubmit();f.requestSubmit();`);await formClosed('Edit profile');assert.equal((await writes()).length,pBefore+1);assert.deepEqual((await writes()).at(-1).body,{full_name:'Edited Bob',department_id:'d2',course_id:'c2',year_level:8});assert.ok(await evaluate(`document.querySelector('header').textContent.includes('Edited Bob') && document.querySelector('main + aside').textContent.includes('Computing')`));
 await evaluate(`document.querySelector('a[href="/"]').click()`);await until(`window.__requests.some(r=>r.path==='/api/questions'&&r.params.department_id==='d2')`);await send('Page.reload');await until(`document.querySelector('header')?.textContent.includes('Edited Bob')`);await navigate('/profile');await until(`document.querySelector('main')?.textContent.includes('Computer Science')`);
 console.log('PASS: profile readonly ID, Cancel, validation, filtered courses, loading/empty/error/retry, stale-response guard, save errors/lock, canonical auth refresh and new Home scope persist');
 await evaluate(`window.__deptError=true`);await clickText('Edit Profile');await until(`document.querySelector('main').textContent.includes('Departments unavailable')`);await input('#edit-profile-name','Keep this draft');await evaluate(`window.__deptError=false`);await clickText('Try again');await profileReady();assert.equal(await evaluate(`document.querySelector('#edit-profile-name').value`),'Keep this draft');await clickText('Cancel');
 await navigate('/questions/'+Q);await until(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit answer')`);await clickText('Edit answer');await input('form[aria-label="Edit answer"] textarea','Late saved answer');await mode('slow');await submit('Edit answer');await evaluate(`history.pushState({},'', '/questions/other');dispatchEvent(new PopStateEvent('popstate'))`);await until(`document.querySelector('main h1')?.textContent==='Other question'`);await new Promise(r=>setTimeout(r,750));assert.equal(await evaluate(`document.querySelector('main h1').textContent`),'Other question');
 // An author can answer their own question. A delayed acceptance response must
 // not replace a newer Markdown edit with its old body snapshot.
 await evaluate(`window.__question.author.id='${B}';sessionStorage.setItem('question',JSON.stringify(window.__question))`);
 await navigate('/questions/'+Q);await until(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit answer')`);
 await clickText('Edit answer');await input('form[aria-label="Edit answer"] textarea','Concurrent **body edit**');await mode('');await submit('Edit answer');await clickText('Unaccept answer');
 await formClosed('Edit answer');await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Accept answer'&&!b.disabled)`);
 assert.ok(await evaluate(`document.querySelector('article[aria-label="Answer by Bob"]').textContent.includes('Concurrent body edit')`));
 console.log('PASS: a delayed acceptance response cannot overwrite a newer answer body edit');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await navigate('/profile');await clickText('Edit Profile');await profileReady();assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`));
 assert.deepEqual(errors,[]);console.log('PASS: department retry preserves draft, late edit response cannot replace another route, mobile fits, no runtime/console errors');
}finally{ws.close();}
