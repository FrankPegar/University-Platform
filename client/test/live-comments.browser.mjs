// Live browser test: uses two dedicated test accounts and creates real Q&A data.
// Credentials come from COURSEPOINT_TEST_ACCOUNTS, never from source control.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const {run, students:[A,B]} = JSON.parse(await readFile(process.env.COURSEPOINT_TEST_ACCOUNTS || '/private/tmp/coursepoint-phase5f-accounts.json','utf8'));
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0; const pending=new Map(), errors=[], requests=[], responses=[], report=[];
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes(':4000/api/'))requests.push({url:m.params.request.url,method:m.params.request.method});if(m.method==='Network.responseReceived'&&m.params.response.url.includes(':4000/api/'))responses.push({url:m.params.response.url,status:m.params.response.status});});
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
    const n = ++seq; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  });
  return Promise.all([response, loaded]).then(([result]) => result);
};
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const until=async expression=>{for(let i=0;i<200;i++){if(await ev(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
const nav=async path=>{await send('Page.navigate',{url:'http://localhost:5173'+path});await until(`document.readyState==='complete'`);};
const click=selector=>ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
const textButton=text=>ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const input=(selector,value)=>ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const mark=label=>{report.push(label);console.log('PASS: '+label);};
const login=async student=>{await until(`!!document.querySelector('#email')`);await input('#email',student.email);await input('#password',student.password);await ev(`document.querySelector('form').requestSubmit()`);await until(`!!document.querySelector('header [aria-haspopup="menu"]')`);assert.ok(await ev(`document.querySelector('header').textContent.includes(${JSON.stringify(student.full_name)})`));};
const logout=async()=>{await click('[aria-haspopup="menu"]');await textButton('Log out');await until(`location.pathname==='/login' && !!document.querySelector('#email')`);assert.equal(await ev(`localStorage.getItem('university_qa_session')`),null);};
const feedReady=()=>until(`!!document.querySelector('[aria-label="Question feed"]') && !document.querySelector('[aria-label="Question feed"] [role="status"]')`);
const voteReady=type=>until(`!!document.querySelector('[aria-label="${type} voting"] button') && !document.querySelector('[aria-label="${type} voting"] button').disabled`);
const voted=type=>ev(`document.querySelector('[aria-label="${type} voting"] button').getAttribute('aria-pressed')==='true'`);
const detailReady=()=>until(`!!document.querySelector('#answers-heading') && !!document.querySelector('form[aria-label="Post an answer"] button') && !document.querySelector('form[aria-label="Post an answer"] button').disabled`);
const {questionId}=JSON.parse(await readFile('/private/tmp/coursepoint-phase5f-live-artifacts.json','utf8'));
const created=[];
const row=id=>`[data-comment-id="${id}"]`;
const button=(id,text)=>ev(`[...document.querySelectorAll('${row(id)} button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const submit=()=>ev(`document.querySelector('form[aria-label="Edit comment"]').requestSubmit()`);
const closed=()=>until(`!document.querySelector('form[aria-label="Edit comment"]')`);
const writes=()=>requests.filter(r=>['PATCH','DELETE'].includes(r.method)&&r.url.includes('/comments/')).length;
try {
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');await send('Network.enable');
 await send('Storage.clearDataForOrigin',{origin:'http://localhost:5173',storageTypes:'local_storage'});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await nav('/login');await login(B);await nav('/questions/'+questionId);await detailReady();
 for(const type of ['question','answer']) {
  const section=`section[aria-label="${type} comments"]`;
  const text=`v1.3 ${run} ${type} comment ${Date.now()}`;
  await until(`!!document.querySelector('${section} form[aria-label="Add ${type} comment"] button') && !document.querySelector('${section} form[aria-label="Add ${type} comment"] button').disabled`);
  await input(`${section} form[aria-label="Add ${type} comment"] textarea`,text);
  await ev(`document.querySelector('${section} form[aria-label="Add ${type} comment"]').requestSubmit()`);
  await until(`[...document.querySelectorAll('${section} li')].some(li=>li.textContent.includes(${JSON.stringify(text)}))`);
  const id=await ev(`[...document.querySelectorAll('${section} li')].find(li=>li.textContent.includes(${JSON.stringify(text)})).dataset.commentId`);
  created.push({id,type,text});
  await button(id,'Edit');assert.equal(await ev(`document.querySelector('form[aria-label="Edit comment"] textarea').value`),text);
  let before=writes();await input('form[aria-label="Edit comment"] textarea','Cancel this edit');await button(id,'Cancel');await closed();assert.equal(writes(),before);assert.equal(await ev(`document.querySelector('${row(id)} p').textContent`),text);
  await button(id,'Edit');await input('form[aria-label="Edit comment"] textarea','   ');await submit();await until(`!!document.querySelector('form[aria-label="Edit comment"] [role="alert"]')`);assert.equal(writes(),before);
  const saved=text+' edited **plain text** <b>literal HTML</b>';
  await input('form[aria-label="Edit comment"] textarea',saved);await submit();await closed();assert.equal(await ev(`document.querySelector('${row(id)} p').textContent`),saved);assert.equal(await ev(`!!document.querySelector('${row(id)} p strong, ${row(id)} p b')`),false);
  await send('Page.reload');await detailReady();await until(`document.querySelector('${row(id)} p')?.textContent===${JSON.stringify(saved)}`);
  await button(id,'Delete');before=writes();await button(id,'Cancel');assert.equal(writes(),before);assert.ok(await ev(`!!document.querySelector('${row(id)}')`));
  mark(`Student B ${type} comment prefill, Cancel, non-empty validation, save, plain text, refresh persistence and delete cancellation`);
 }
 await logout();await login(A);await nav('/questions/'+questionId);await detailReady();
 for(const {id,type} of created) {
  await until(`!!document.querySelector('${row(id)}')`);assert.equal(await ev(`document.querySelectorAll('${row(id)} button').length`),0);
  for(const method of ['patch','delete']) {
   const status=await ev(`(async()=>{const {apiClient}=await import('/src/lib/apiClient.js');const token=JSON.parse(localStorage.getItem('university_qa_session')).session.access_token;try{await apiClient.${method}('/comments/${id}',${method==='patch'?JSON.stringify({body:'Forbidden edit',author_id:B.id,user_id:B.id})+',':''}{token});return 200;}catch(e){return e.statusCode;}})()`);
   assert.equal(status,403);
  }
  mark(`Student A cannot edit/delete Student B ${type} comment: no controls and actual PATCH/DELETE 403`);
 }
 await logout();await login(B);await nav('/questions/'+questionId);await detailReady();
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await until(`!!document.querySelector('${row(created[0].id)}')`);await button(created[0].id,'Edit');assert.ok(await ev(`document.documentElement.scrollWidth<=innerWidth`));
 await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}).then(r=>writeFile('/private/tmp/coursepoint-v13-comment-mobile.png',Buffer.from(r.data,'base64')));await button(created[0].id,'Cancel');
 for(const {id,type} of created) {
  const section=`section[aria-label="${type} comments"]`;
  await until(`!!document.querySelector('${row(id)}')`);const before=await ev(`document.querySelectorAll('${section} li').length`);
  await button(id,'Delete');await button(id,'Confirm delete');await until(`!document.querySelector('${row(id)}')`);assert.equal(await ev(`document.querySelectorAll('${section} li').length`),before-1);
  await send('Page.reload');await detailReady();await until(`document.querySelector('${section} h3')?.textContent.includes('(')`);assert.equal(await ev(`!!document.querySelector('${row(id)}')`),false);
  mark(`Student B deletes own ${type} comment; list/count update and deletion persists after refresh`);
 }
 assert.deepEqual(errors,[]);mark('Mobile comment editor fits; no runtime exceptions; dedicated v1.3 comments cleaned up');
 await writeFile('/private/tmp/coursepoint-v13-live-results.json',JSON.stringify({questionId,report},null,2));
} catch(error) {console.error(error.message);console.error(await ev(`({path:location.pathname,text:document.querySelector('main')?.innerText})`));process.exitCode=1;} finally {ws.close();}
